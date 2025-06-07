"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Frown, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Props interface for ErrorDisplay component
 */
interface ErrorDisplayProps {
  title?: string;
  message: string;
  details?: string;
  className?: string;
  showReturnHomeButton?: boolean;
}

/**
 * ErrorDisplay component.
 * A universal component to display error messages with a consistent UI.
 * Features an icon, title, message, optional details, and a "Return to Home" button.
 *
 * @param {ErrorDisplayProps} props - The component props.
 * @param {string} [props.title="Oops! Something went wrong"] - The main title for the error.
 * @param {string} props.message - The primary error message to display.
 * @param {string} [props.details] - Optional additional details about the error (e.g., for debugging).
 * @param {string} [props.className] - Optional additional class names for the container card.
 * @param {boolean} [props.showReturnHomeButton=true] - Whether to show the "Return to Home" button.
 * @returns {JSX.Element} The error display component.
 */
export default function ErrorDisplay({
  title = "Oops! Something went wrong",
  message,
  details,
  className,
  showReturnHomeButton = true,
}: ErrorDisplayProps) {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex flex-col items-center justify-center flex-grow">
      <Card className={cn("w-full max-w-lg text-center shadow-xl border-destructive/50", className)}>
        <CardHeader className="pb-4">
          <Frown className="mx-auto h-16 w-16 text-destructive mb-4" />
          <CardTitle className="text-2xl md:text-3xl font-headline text-destructive">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CardDescription className="text-base text-destructive">
            {message}
          </CardDescription>
          {details && (
            <div className="mt-2 p-3 bg-destructive/10 rounded-md text-left">
              <p className="text-sm font-mono text-destructive break-all">{details}</p>
            </div>
          )}
        </CardContent>
        {showReturnHomeButton && (
          <CardFooter className="flex flex-col items-center justify-center pt-4">
            <Link href="/" passHref>
              <Button variant="outline">
                <AlertTriangle className="mr-2 h-4 w-4" /> Return to Home
              </Button>
            </Link>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
