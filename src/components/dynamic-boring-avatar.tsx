"use client";

import dynamic from 'next/dynamic';
import React from 'react';

/**
 * Props interface for BoringAvatar component
 * Defines type-safe props based on the boring-avatars library
 */
interface BoringAvatarProps {
  size: number | string;
  name: string;
  variant: "marble" | "beam" | "pixel" | "sunset" | "ring" | "bauhaus";
  colors: string[];
  square?: boolean;
  /** Allow any other SVG props as BoringAvatar might pass them down */
  [key: string]: any;
}

const DynamicBoringAvatarComponent = dynamic<BoringAvatarProps>(
  () => import('boring-avatars'), // Assumes BoringAvatar is the default export
  {
    ssr: false,
    loading: () => {
      // Basic loading placeholder. It's hard to make this perfectly match
      // the size without access to props here, but AvatarFallback handles size.
      // Returning a simple div that will be styled by AvatarFallback.
      return <div style={{ width: '100%', height: '100%', backgroundColor: 'hsl(var(--muted))' }} />;
    }
  }
);

/**
 * DynamicBoringAvatar component - Dynamically loaded avatar generator
 * Wraps the boring-avatars library with Next.js dynamic loading for client-side rendering
 * Generates consistent, unique avatars based on name and customizable appearance options
 * @param props - BoringAvatarProps containing size, name, variant, colors, and other options
 * @returns JSX element representing the dynamically loaded boring avatar
 */
const DynamicBoringAvatar: React.FC<BoringAvatarProps> = (props) => {
  return <DynamicBoringAvatarComponent {...props} />;
};

export default DynamicBoringAvatar;
