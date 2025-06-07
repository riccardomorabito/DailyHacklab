/**
 * @fileoverview Image Crop Dialog Component
 * 
 * This component provides an image cropping interface using react-image-crop.
 * It allows users to crop profile pictures to a square format before uploading.
 * Features include:
 * - Drag and resize crop area
 * - Aspect ratio enforcement (1:1 for avatars)
 * - Preview of cropped result
 * - Canvas-based crop processing
 * - File conversion to optimized format
 * 
 * @author Studio Development Team
 */
"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop, convertToPixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Crop as CropIcon, RotateCcw, Check, X } from 'lucide-react';
import { logger } from '@/lib/logger';

const IMAGE_CROP_CONTEXT = "ImageCropDialog";

interface ImageCropDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Function to call when dialog should close */
  onClose: () => void;
  /** The image file to crop */
  imageFile: File | null;
  /** Function to call when crop is completed with the cropped file */
  onCropComplete: (croppedFile: File) => void;
  /** Optional title for the dialog */
  title?: string;
}

/**
 * Utility function to create a cropped image file from canvas
 * @param canvas - The canvas element containing the cropped image
 * @param originalFile - The original file to base the new file properties on
 * @returns Promise<File> - The cropped image as a File object
 */
function canvasToFile(canvas: HTMLCanvasElement, originalFile: File): Promise<File> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        throw new Error('Canvas toBlob failed');
      }
      
      // Create a new file with the cropped image data
      const fileName = originalFile.name.replace(/\.[^/.]+$/, '') + '_cropped.jpg';
      const file = new File([blob], fileName, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
      
      resolve(file);
    }, 'image/jpeg', 0.9); // High quality JPEG
  });
}

/**
 * Utility function to get cropped image from canvas
 * @param image - The source image element
 * @param crop - The crop configuration
 * @param canvas - The canvas element to draw on
 */
function getCroppedImg(image: HTMLImageElement, crop: Crop, canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No 2d context');
  }

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  // Set canvas size to match the crop size
  const cropWidth = crop.width * scaleX;
  const cropHeight = crop.height * scaleY;
  
  canvas.width = cropWidth;
  canvas.height = cropHeight;

  // Draw the cropped image
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );
}

/**
 * ImageCropDialog Component
 * Provides a modal interface for cropping images before upload
 */
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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load image when file changes
  useEffect(() => {
    if (!imageFile) {
      setImgSrc('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImgSrc(reader.result as string);
    };
    reader.readAsDataURL(imageFile);
    
    logger.debug(IMAGE_CROP_CONTEXT, `Loading image for crop: ${imageFile.name}`);
  }, [imageFile]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setImgSrc('');
      setCrop(undefined);
      setCompletedCrop(undefined);
      setIsProcessing(false);
    }
  }, [isOpen]);

  /**
   * Called when image loads to set initial crop
   */
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
    
    // Create a centered square crop
    const centerAspectCrop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
          height: 90,
        },
        1, // 1:1 aspect ratio for square avatars
        width,
        height
      ),
      width,
      height
    );
    
    setCrop(centerAspectCrop);
    logger.debug(IMAGE_CROP_CONTEXT, 'Initial crop set:', centerAspectCrop);
  }, []);

  /**
   * Reset crop to center of image
   */
  const resetCrop = useCallback(() => {
    if (imgRef.current) {
      const { naturalWidth: width, naturalHeight: height } = imgRef.current;
      const centerAspectCrop = centerCrop(
        makeAspectCrop(
          {
            unit: '%',
            width: 90,
            height: 90,
          },
          1,
          width,
          height
        ),
        width,
        height
      );
      setCrop(centerAspectCrop);
      logger.debug(IMAGE_CROP_CONTEXT, 'Crop reset to center');
    }
  }, []);

  /**
   * Apply the crop and create the cropped file
   */
  const applyCrop = useCallback(async () => {
    if (!completedCrop || !imgRef.current || !canvasRef.current || !imageFile) {
      logger.warn(IMAGE_CROP_CONTEXT, 'Missing required elements for crop application');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Convert crop to pixel coordinates
      const pixelCrop = convertToPixelCrop(
        completedCrop,
        imgRef.current.width,
        imgRef.current.height
      );

      // Draw cropped image to canvas
      getCroppedImg(imgRef.current, pixelCrop, canvasRef.current);
      
      // Convert canvas to file
      const croppedFile = await canvasToFile(canvasRef.current, imageFile);
      
      logger.info(IMAGE_CROP_CONTEXT, `Crop applied successfully. Original: ${imageFile.size} bytes, Cropped: ${croppedFile.size} bytes`);
      
      // Pass the cropped file back to parent
      onCropComplete(croppedFile);
      onClose();
      
    } catch (error: any) {
      logger.error(IMAGE_CROP_CONTEXT, 'Error applying crop:', error.message);
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
            <>
              <div className="space-y-2">
                <Label>Crop Area (Drag corners to resize, drag center to move)</Label>
                <div className="border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900">
                  <ReactCrop
                    crop={crop}
                    onChange={(_, percentCrop) => setCrop(percentCrop)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={1} // Force square aspect ratio
                    circularCrop={false}
                    keepSelection={true}
                    minWidth={50}
                    minHeight={50}
                  >
                    <img
                      ref={imgRef}
                      alt="Crop preview"
                      src={imgSrc}
                      onLoad={onImageLoad}
                      style={{ maxHeight: '400px', width: 'auto' }}
                    />
                  </ReactCrop>
                </div>
              </div>

              {completedCrop && (
                <div className="space-y-2">
                  <Label>Preview (Cropped Result)</Label>
                  <div className="flex justify-center">
                    <canvas
                      ref={canvasRef}
                      className="border rounded-lg max-w-[200px] max-h-[200px] object-contain"
                      style={{
                        width: Math.min(completedCrop.width, 200),
                        height: Math.min(completedCrop.height, 200),
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={resetCrop}
            disabled={!imgSrc || isProcessing}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
          
          <Button
            onClick={applyCrop}
            disabled={!completedCrop || isProcessing}
            className="flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            {isProcessing ? 'Processing...' : 'Apply Crop'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
