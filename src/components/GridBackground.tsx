"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme } from '@/contexts/theme-provider';
import { logger } from '@/lib/logger';

const GRID_CONTEXT = "GridBackground";

/**
 * GridBackground component - Static grid background
 * Creates a static grid background.
 * Features adaptive colors based on theme and responsive design.
 * @returns JSX element representing the grid background
 */
const GridBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { appliedTheme } = useTheme();

  const [gridColorBase, setGridColorBase] = useState({ h: 208, s: 69, l: 69, a: 0.1 });
  
  const gridSizeRef = useRef(40);
  const animationFrameIdRef = useRef<number | null>(null);
  const canvasInitializedRef = useRef(false);


  useEffect(() => {
    if (appliedTheme === 'dark') {
      setGridColorBase({ h: 208, s: 69, l: 69, a: 0.06 });
    } else {
      setGridColorBase({ h: 208, s: 69, l: 69, a: 0.1 });
    }
  }, [appliedTheme]);


  /**
   * Draws the grid on the canvas
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
      
      logger.debug(GRID_CONTEXT, "Canvas setup completed");
      // Redraw the grid after setup
      draw(ctx, canvasRef.current, gridSizeRef.current);
    };

    const handleResize = () => {
      setupCanvas();
    };

    setupCanvas();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      canvasInitializedRef.current = false;
    };
  }, [draw]); // Add draw to dependencies

  // Redraw when theme changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvasInitializedRef.current) {
        draw(ctx, canvas, gridSizeRef.current);
    }
  }, [gridColorBase, draw]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-20 w-full h-full pointer-events-none"
    />
  );
};

export default GridBackground;