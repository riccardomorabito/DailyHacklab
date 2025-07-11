"use client";

import { Zap } from "lucide-react";

/**
 * GlobalLoading component - Universal loading indicator
 * Shows the energy symbol (Zap) with pulsing animation
 * Used across the application for consistent loading states
 * @returns JSX element representing the global loading indicator
 */
export default function GlobalLoading({ 
  message = "Loading energies...",
  className = ""
}: { 
  message?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] px-4 ${className}`}>
      <Zap className="h-16 w-16 text-primary animate-pulse" />
      <p className="text-muted-foreground mt-4">{message}</p>
    </div>
  );
}