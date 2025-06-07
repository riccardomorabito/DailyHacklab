"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '@/contexts/theme-provider';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger'; // logging

const GRID_SNAKE_CONTEXT = "GridSnakeAnimationBackground";

/**
 * Props interface for GridSnakeAnimationBackground component
 */
interface GridSnakeAnimationBackgroundProps {
  /** Array of avatar URLs to display on snakes */
  avatarUrls?: (string | null)[];
  /** Loading state for avatar data */
  loadingAvatars: boolean;
}

/**
 * GridSnakeAnimationBackground component - Animated background with moving snake patterns
 * Creates an animated grid background with snake-like patterns that can display user avatars
 * Features adaptive colors based on theme, smooth animations, and responsive design
 * @param props - GridSnakeAnimationBackgroundProps containing avatar URLs and loading state
 * @returns JSX element representing the animated grid background
 */
const GridSnakeAnimationBackground: React.FC<GridSnakeAnimationBackgroundProps> = ({ avatarUrls = [], loadingAvatars }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { appliedTheme } = useTheme();

  const [gridColorBase, setGridColorBase] = useState({ h: 208, s: 69, l: 69, a: 0.1 });
  const [snakeColor, setSnakeColor] = useState('hsla(28, 66%, 55%, 0.15)');
  const [loadedAvatarImages, setLoadedAvatarImages] = useState<(HTMLImageElement | null)[]>([]);
  
  const gridSizeRef = useRef(40);
  const numSnakesConfigRef = useRef(avatarUrls.length > 0 ? avatarUrls.length : 12); // Use avatarUrls length or default to 12
  const animationIntervalRef = useRef(8);
  const pixelMoveSpeedRef = useRef(1.5);
  const animationFrameIdRef = useRef<number | null>(null); // Track animation frame ID
  const snakesRef = useRef<Snake[]>([]); // Use useRef for snakes to avoid reinitializations
  const isInitializedRef = useRef(false); // Track if canvas and snakes are initialized
  const canvasInitializedRef = useRef(false); // Track if canvas is set up


  useEffect(() => {
    if (appliedTheme === 'dark') {
      setGridColorBase({ h: 208, s: 69, l: 69, a: 0.06 });
      setSnakeColor('hsla(28, 66%, 55%, 0.1)');
    } else {
      setGridColorBase({ h: 208, s: 69, l: 69, a: 0.1 });
      setSnakeColor('hsla(28, 66%, 55%, 0.15)');
    }
  }, [appliedTheme]);

  useEffect(() => {
    // Update numSnakesConfigRef if avatarUrls changes and has a defined length
    if (avatarUrls && avatarUrls.length > 0) {
      numSnakesConfigRef.current = avatarUrls.length;
    } else {
      numSnakesConfigRef.current = 12; // Default if avatarUrls is empty or undefined
    }

    if (loadingAvatars) {
      // Still loading, don't process yet
      return;
    }

    if (avatarUrls.length === 0) {
      // No avatar URLs provided, set all to null
      setLoadedAvatarImages(Array(numSnakesConfigRef.current).fill(null));
      logger.debug(GRID_SNAKE_CONTEXT, `No avatar URLs provided, setting ${numSnakesConfigRef.current} null images.`);
      return;
    }

    logger.debug(GRID_SNAKE_CONTEXT, "Starting avatar image loading. Number of URLs:", avatarUrls.length, "Valid URLs:", avatarUrls.filter(Boolean).length);
    
    const promises = avatarUrls.map((url, index) => {
        return new Promise<HTMLImageElement | null>((resolve) => {
            if (!url) {
                logger.debug(GRID_SNAKE_CONTEXT, `Avatar ${index}: null URL, using placeholder`);
                resolve(null);
                return;
            }
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = url;
            img.onload = () => {
                logger.debug(GRID_SNAKE_CONTEXT, `Avatar ${index}: Successfully loaded ${url}`);
                resolve(img);
            };
            img.onerror = () => {
                logger.warn(GRID_SNAKE_CONTEXT, `Avatar ${index}: Failed to load ${url}`);
                resolve(null);
            };
        });
    });

    Promise.all(promises).then(resolvedImages => {
        const processedImages = resolvedImages.map((imgOrNull, index) => {
            const isValid = imgOrNull && imgOrNull.complete && imgOrNull.naturalHeight !== 0;
            logger.debug(GRID_SNAKE_CONTEXT, `Avatar ${index}: ${isValid ? 'Valid' : 'Invalid/null'}`);
            return isValid ? imgOrNull : null;
        });
        
        setLoadedAvatarImages(processedImages);
        const validCount = processedImages.filter(Boolean).length;
        logger.debug(GRID_SNAKE_CONTEXT, `Avatar image loading completed. Valid images: ${validCount}/${processedImages.length}`);
    });
  }, [avatarUrls, loadingAvatars]);


  /**
   * Draws the grid and snakes on the canvas
   * @param ctx - Canvas 2D rendering context
   * @param canvas - HTML canvas element
   * @param currentGridSize - Size of grid cells
   */
  const draw = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, currentGridSize: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fadeDistance = Math.min(canvas.width, canvas.height) * 0.20;
    const { h, s, l, a: baseAlpha } = gridColorBase;

    ctx.lineWidth = 0.5;
    for (let x = 0; x <= canvas.width; x += currentGridSize) {
      const distanceToEdge = Math.min(x, canvas.width - x);
      let currentAlpha = baseAlpha;
      if (x <= fadeDistance) currentAlpha = baseAlpha * (x / fadeDistance);
      else if (canvas.width - x <= fadeDistance) currentAlpha = baseAlpha * ((canvas.width - x) / fadeDistance);
      ctx.strokeStyle = `hsla(${h}, ${s}%, ${l}%, ${Math.max(0, currentAlpha)})`;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += currentGridSize) {
      const distanceToEdge = Math.min(y, canvas.height - y);
      let currentAlpha = baseAlpha;
      if (y <= fadeDistance) currentAlpha = baseAlpha * (y / fadeDistance);
      else if (canvas.height - y <= fadeDistance) currentAlpha = baseAlpha * ((canvas.height - y) / fadeDistance);
      ctx.strokeStyle = `hsla(${h}, ${s}%, ${l}%, ${Math.max(0, currentAlpha)})`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    // Draw snakes only if they exist
    if (snakesRef.current.length > 0) {
      snakesRef.current.forEach(snake => snake.draw(ctx));
    }
  }, [gridColorBase]);


  // Canvas setup effect - runs once and handles resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const setupCanvas = () => {
      if (!canvasRef.current || !ctx) return;
      
      const dpr = window.devicePixelRatio || 1;
      const rect = canvasRef.current.getBoundingClientRect();
      canvasRef.current.width = rect.width * dpr;
      canvasRef.current.height = rect.height * dpr;
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      canvasInitializedRef.current = true;
      
      logger.debug(GRID_SNAKE_CONTEXT, "Canvas setup completed");
    };

    const handleResize = () => {
      setupCanvas();
      // Only update snake boundaries, don't recreate them
      if (snakesRef.current.length > 0 && canvasRef.current) {
        const dpr = window.devicePixelRatio || 1;
        const newWidth = canvasRef.current.width / dpr;
        const newHeight = canvasRef.current.height / dpr;
        snakesRef.current.forEach(snake => {
          snake.updateBoundaries(newWidth, newHeight);
        });
      }
    };

    setupCanvas();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      canvasInitializedRef.current = false;
    };
  }, []); // No dependencies - runs once

  // Snake initialization effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const currentGridSize = gridSizeRef.current;
    const currentNumSnakesConfig = numSnakesConfigRef.current;
    const currentPixelMoveSpeed = pixelMoveSpeedRef.current;

    const initSnakes = () => {
      // Check if canvas is ready
      if (!canvasInitializedRef.current) {
        logger.debug(GRID_SNAKE_CONTEXT, "Canvas not ready yet, delaying snake initialization");
        return;
      }

      logger.debug(GRID_SNAKE_CONTEXT, `Initializing snakes. LoadingAvatars: ${loadingAvatars}, LoadedAvatarImages: ${loadedAvatarImages.length}, AvatarUrls: ${avatarUrls.length}`);

      snakesRef.current = []; // Clear existing snakes
      const dpr = window.devicePixelRatio || 1;
      const canvasWidth = canvas.width / dpr;
      const canvasHeight = canvas.height / dpr;

      // Always create snakes - either with avatars or as placeholders
      if (!loadingAvatars && loadedAvatarImages.length > 0) {
        const numSnakesToCreate = Math.min(currentNumSnakesConfig, loadedAvatarImages.length);
        const validAvatars = loadedAvatarImages.filter(Boolean).length;
        logger.debug(GRID_SNAKE_CONTEXT, `Creating ${numSnakesToCreate} snakes. Valid avatars: ${validAvatars}, Placeholders: ${numSnakesToCreate - validAvatars}`);
        
        for (let i = 0; i < numSnakesToCreate; i++) {
          const avatarImg = loadedAvatarImages[i] || null;
          const snakeType = avatarImg ? 'with avatar' : 'placeholder';
          logger.debug(GRID_SNAKE_CONTEXT, `Snake ${i}: ${snakeType}`);
          snakesRef.current.push(new Snake(canvasWidth, canvasHeight, currentGridSize, snakeColor, currentPixelMoveSpeed, avatarImg, i));
        }
      } else {
        // Create placeholder snakes if still loading or no avatars
        logger.debug(GRID_SNAKE_CONTEXT, `Creating ${currentNumSnakesConfig} placeholder snakes (no loaded images).`);
        for (let i = 0; i < currentNumSnakesConfig; i++) {
          snakesRef.current.push(new Snake(canvasWidth, canvasHeight, currentGridSize, snakeColor, currentPixelMoveSpeed, null, i));
        }
      }
      
      isInitializedRef.current = true;
      logger.debug(GRID_SNAKE_CONTEXT, `Snake initialization completed. Created ${snakesRef.current.length} snakes.`);
    };

    // Reset initialization flag to allow recreation
    isInitializedRef.current = false;

    // Try to initialize immediately, then with delays if canvas not ready
    initSnakes();
    
    const timeoutId1 = setTimeout(initSnakes, 100);
    const timeoutId2 = setTimeout(initSnakes, 500);
    
    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
    };
  }, [loadedAvatarImages, loadingAvatars, avatarUrls, snakeColor]); // Dependencies for snake creation

  // Animation loop effect
  useEffect(() => {
    const startAnimationLoop = () => {
      if (!isInitializedRef.current || !canvasInitializedRef.current) {
        // Try again later if not ready
        setTimeout(startAnimationLoop, 100);
        return;
      }
      
      if (animationFrameIdRef.current !== null) return; // Already running

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let frameCount = 0;
      const currentGridSize = gridSizeRef.current;
      const currentAnimationInterval = animationIntervalRef.current;

      const gameLoop = () => {
        if (!canvasRef.current || !ctx) {
          animationFrameIdRef.current = requestAnimationFrame(gameLoop);
          return;
        }

        if (snakesRef.current.length > 0) {
          snakesRef.current.forEach(snake => snake.updateVisuals());
          frameCount++;
          if (frameCount % currentAnimationInterval === 0) {
            snakesRef.current.forEach((snake) => {
              if (canvasRef.current) {
                const dpr = window.devicePixelRatio || 1;
                snake.updateLogic(canvasRef.current.width / dpr, canvasRef.current.height / dpr, currentGridSize);
              }
            });
          }
        }
        draw(ctx, canvasRef.current, currentGridSize);
        animationFrameIdRef.current = requestAnimationFrame(gameLoop);
      };

      logger.debug(GRID_SNAKE_CONTEXT, "Starting animation loop");
      animationFrameIdRef.current = requestAnimationFrame(gameLoop);
    };

    // Start the animation loop
    startAnimationLoop();
    
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
        logger.debug(GRID_SNAKE_CONTEXT, "Animation loop stopped");
      }
    };
  }, [draw, gridColorBase]); // Minimal dependencies

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isInitializedRef.current = false;
      snakesRef.current = [];
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-20 w-full h-full pointer-events-none"
    />
  );
};

class Snake {
  id: number;
  gridX: number;
  gridY: number;
  pixelX: number;
  pixelY: number;
  targetPixelX: number;
  targetPixelY: number;
  dx: number;
  dy: number;
  segments: { x: number; y: number }[];
  maxLength: number;
  color: string;
  pixelSpeed: number;
  stepsSinceLastTurn: number = 0;
  minStepsForTurn: number;
  gridSize: number;
  cubeSize: number;
  avatarImage: HTMLImageElement | null; 
  headColor: string;

  constructor(canvasWidth: number, canvasHeight: number, gridSize: number, color: string, pixelSpeed: number, avatarImage: HTMLImageElement | null = null, id: number) {
    this.id = id;
    this.gridSize = gridSize;
    this.cubeSize = gridSize * 0.4; 
    this.gridX = Math.floor(Math.random() * (canvasWidth / gridSize));
    this.gridY = Math.floor(Math.random() * (canvasHeight / gridSize));
    this.pixelX = this.gridX * gridSize + gridSize / 2;
    this.pixelY = this.gridY * gridSize + gridSize / 2;
    this.segments = [{ x: this.pixelX, y: this.pixelY }];
    this.maxLength = Math.floor(Math.random() * 40) + 80;
    this.color = color;
    this.pixelSpeed = pixelSpeed;
    this.minStepsForTurn = Math.floor(Math.random() * 10) + 15;

    const baseColorMatch = this.color.match(/hsla\((\d+),\s*([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)\)/);
    if (baseColorMatch) {
      const [, h, s, l, a] = baseColorMatch.map(Number);
      this.headColor = `hsla(${h}, ${s}%, ${Math.min(100, l + 30)}%, ${Math.min(1, parseFloat(a.toString()) + 0.6)})`;
    } else {
      this.headColor = 'hsla(0, 0%, 100%, 0.7)'; 
    }
    this.avatarImage = avatarImage; 

    const directions = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];
    const initialDir = directions[Math.floor(Math.random() * directions.length)];
    this.dx = initialDir.dx;
    this.dy = initialDir.dy;
    this.targetPixelX = (this.gridX + this.dx) * gridSize + gridSize / 2;
    this.targetPixelY = (this.gridY + this.dy) * gridSize + gridSize / 2;
  }

  updateVisuals() {
    if (this.pixelX < this.targetPixelX) this.pixelX = Math.min(this.pixelX + this.pixelSpeed, this.targetPixelX);
    else if (this.pixelX > this.targetPixelX) this.pixelX = Math.max(this.pixelX - this.pixelSpeed, this.targetPixelX);
    if (this.pixelY < this.targetPixelY) this.pixelY = Math.min(this.pixelY + this.pixelSpeed, this.targetPixelY);
    else if (this.pixelY > this.targetPixelY) this.pixelY = Math.max(this.pixelY - this.pixelSpeed, this.targetPixelY);
    this.segments.unshift({ x: this.pixelX, y: this.pixelY });
    if (this.segments.length > this.maxLength) this.segments.pop();
  }

  updateLogic(canvasWidth: number, canvasHeight: number, gridSize: number) {
    const atTargetX = Math.abs(this.pixelX - this.targetPixelX) < this.pixelSpeed;
    const atTargetY = Math.abs(this.pixelY - this.targetPixelY) < this.pixelSpeed;

    if (atTargetX && atTargetY) {
        this.pixelX = this.targetPixelX;
        this.pixelY = this.targetPixelY;
        this.gridX += this.dx;
        this.gridY += this.dy;
        this.stepsSinceLastTurn++;

        const numGridCols = Math.floor(canvasWidth / gridSize);
        const numGridRows = Math.floor(canvasHeight / gridSize);
        let wrapped = false;

        if (this.gridX < 0) { this.gridX = numGridCols - 1; wrapped = true; }
        else if (this.gridX >= numGridCols) { this.gridX = 0; wrapped = true; }
        if (this.gridY < 0) { this.gridY = numGridRows - 1; wrapped = true; }
        else if (this.gridY >= numGridRows) { this.gridY = 0; wrapped = true; }

        if (wrapped) {
            this.pixelX = this.gridX * gridSize + gridSize / 2;
            this.pixelY = this.gridY * gridSize + gridSize / 2;
        }
        
        if (this.stepsSinceLastTurn >= this.minStepsForTurn && Math.random() < 0.20) {
            const possibleTurns = [];
            if (this.dx !== 0) possibleTurns.push({ dx: 0, dy: 1 }, { dx: 0, dy: -1 });
            if (this.dy !== 0) possibleTurns.push({ dx: 1, dy: 0 }, { dx: -1, dy: 0 });
            if (possibleTurns.length > 0) {
              const turn = possibleTurns[Math.floor(Math.random() * possibleTurns.length)];
              this.dx = turn.dx; this.dy = turn.dy;
              this.stepsSinceLastTurn = 0;
              this.minStepsForTurn = Math.floor(Math.random() * 10) + 15;
            }
        }
        this.targetPixelX = (this.gridX + this.dx) * gridSize + gridSize / 2;
        this.targetPixelY = (this.gridY + this.dy) * gridSize + gridSize / 2;
    }
  }

  updateBoundaries(newCanvasWidth: number, newCanvasHeight: number) {
    // Update the snake's understanding of canvas boundaries without resetting position
    // This is called when the canvas is resized
    const numGridCols = Math.floor(newCanvasWidth / this.gridSize);
    const numGridRows = Math.floor(newCanvasHeight / this.gridSize);
    
    // Ensure snake is still within bounds after resize
    if (this.gridX >= numGridCols) this.gridX = numGridCols - 1;
    if (this.gridY >= numGridRows) this.gridY = numGridRows - 1;
    
    // Update pixel positions to match grid positions
    this.pixelX = this.gridX * this.gridSize + this.gridSize / 2;
    this.pixelY = this.gridY * this.gridSize + this.gridSize / 2;
    this.targetPixelX = (this.gridX + this.dx) * this.gridSize + this.gridSize / 2;
    this.targetPixelY = (this.gridY + this.dy) * this.gridSize + this.gridSize / 2;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.segments.length === 0) return;
    const baseColorMatch = this.color.match(/hsla\((\d+),\s*([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)\)/);
    let h_body = 0, s_body = 0, l_body = 0, baseAlpha_body = 0.1;
    if (baseColorMatch) [, h_body, s_body, l_body, baseAlpha_body] = baseColorMatch.map(Number);

    for (let i = 1; i < this.segments.length; i++) { 
      const segment = this.segments[i];
      const opacityFactor = 1 - (i / this.segments.length); 
      const finalAlpha = baseAlpha_body * opacityFactor * opacityFactor; 
      if (baseColorMatch) ctx.fillStyle = `hsla(${h_body}, ${s_body}%, ${l_body}%, ${Math.max(0, finalAlpha)})`;
      else ctx.fillStyle = this.color;
      ctx.fillRect(segment.x - this.cubeSize / 2, segment.y - this.cubeSize / 2, this.cubeSize, this.cubeSize);
    }

    const headSegment = this.segments[0];
    const headDrawSize = this.gridSize * 0.65; 
    const headOffset = headDrawSize / 2;

    if (this.avatarImage && this.avatarImage.complete && this.avatarImage.naturalHeight !== 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(headSegment.x, headSegment.y, headOffset, 0, Math.PI * 2, true); // Create circular path
      ctx.closePath();
      ctx.clip(); // Clip to the circular path
      ctx.drawImage(this.avatarImage, headSegment.x - headOffset, headSegment.y - headOffset, headDrawSize, headDrawSize);
      ctx.restore(); // Restore canvas state (remove clipping path)
    } else {
      // Fallback if the image isn't available or it's a placeholder (draw as square)
      ctx.fillStyle = this.headColor; 
      ctx.fillRect(headSegment.x - headOffset, headSegment.y - headOffset, headDrawSize, headDrawSize);
    }
  }
}

export default GridSnakeAnimationBackground;


    