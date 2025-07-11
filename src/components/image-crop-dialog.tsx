"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Crop as CropIcon, RotateCcw, Check, X, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';

const IMAGE_CROP_CONTEXT = "ImageCropDialog";

interface ImageCropDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageFile: File | null;
  onCropComplete: (croppedFile: File) => void;
  title?: string;
}

// Helper function to create a preview from a file
function readFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

// Helper function to create a cropped image file
async function getCroppedImage(
  image: HTMLImageElement,
  crop: Crop,
  fileName: string
): Promise<File> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  const pixelRatio = window.devicePixelRatio || 1;

  canvas.width = crop.width * pixelRatio;
  canvas.height = crop.height * pixelRatio;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) throw new Error('Canvas is empty');
        
        // Create a file with the cropped image
        const croppedFile = new File([blob], fileName, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
        
        resolve(croppedFile);
      },
      'image/jpeg',
      0.9 // Quality
    );
  });
}

export default function ImageCropDialog({
  isOpen,
  onClose,
  imageFile,
  onCropComplete,
  title = "Crop Profile Picture"
}: ImageCropDialogProps) {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Load image when file changes
  useEffect(() => {
    if (!imageFile) return;
    
    const loadImage = async () => {
      try {
        const imageDataUrl = await readFile(imageFile);
        setImgSrc(imageDataUrl);
      } catch (error) {
        logger.error(IMAGE_CROP_CONTEXT, 'Error loading image:', error);
      }
    };
    
    loadImage();
  }, [imageFile]);

  // Set up initial crop when image loads
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    
    // Create a centered square crop that's 80% of the smaller dimension
    const cropSize = Math.min(width, height) * 0.8;
    const x = (width - cropSize) / 2;
    const y = (height - cropSize) / 2;
    
    const initialCrop = {
      unit: 'px' as const,
      width: cropSize,
      height: cropSize,
      x,
      y,
    };
    
    setCrop(initialCrop);
    setCompletedCrop(initialCrop);
  }, []);



  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      // Small delay to allow animations to complete
      const timer = setTimeout(() => {
        setImgSrc('');
        setCrop(undefined);
        setCompletedCrop(undefined);
        setIsProcessing(false);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset crop to center of image
  const resetCrop = useCallback(() => {
    if (!imgRef.current) return;
    
    const { width, height } = imgRef.current;
    const cropSize = Math.min(width, height) * 0.8;
    const x = (width - cropSize) / 2;
    const y = (height - cropSize) / 2;
    
    const newCrop = {
      unit: 'px' as const,
      width: cropSize,
      height: cropSize,
      x,
      y,
    };
    
    setCrop(newCrop);
    setCompletedCrop(newCrop);
  }, []);

  // Apply the crop and create the cropped file
  const applyCrop = useCallback(async () => {
    if (!completedCrop || !imgRef.current || !imageFile) return;
    
    setIsProcessing(true);
    
    try {
      const croppedImage = await getCroppedImage(
        imgRef.current,
        completedCrop,
        `cropped_${imageFile.name}`
      );
      
      onCropComplete(croppedImage);
      onClose();
    } catch (error) {
      logger.error(IMAGE_CROP_CONTEXT, 'Error applying crop:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [completedCrop, imageFile, onCropComplete, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CropIcon className="h-5 w-5" />
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {imgSrc && (
            <div className="space-y-2">
              <Label>Crop Area</Label>
              <div className="border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900 flex justify-center">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={1}
                  minWidth={50}
                  minHeight={50}
                  keepSelection={true}
                >
                  <img
                    ref={imgRef}
                    alt="Crop preview"
                    src={imgSrc}
                    onLoad={onImageLoad}
                    style={{ maxHeight: '50vh', width: 'auto' }}
                    className="max-w-full"
                  />
                </ReactCrop>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={resetCrop}
            disabled={!imgSrc || isProcessing}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          
          <div className="space-x-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isProcessing}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            
            <Button
              onClick={applyCrop}
              disabled={!completedCrop || isProcessing}
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <span className="animate-spin">
                    <Loader2 className="h-4 w-4" />
                  </span>
                  Processing...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Apply Crop
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
