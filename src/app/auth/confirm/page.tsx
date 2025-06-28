"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

/**
 * EmailConfirmationContent component - Handles email verification confirmation logic
 * This component processes the email confirmation token and shows appropriate status
 * @returns JSX element representing the email confirmation content
 */
function EmailConfirmationContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const confirmEmail = () => {
      // Small delay to show the loading state briefly
      setTimeout(() => {
        try {
          // Check for explicit error parameters first (from expired/invalid links)
          const error = searchParams.get('error');
          const errorCode = searchParams.get('error_code');
          const errorDescription = searchParams.get('error_description');
          
          // If there are explicit error parameters, show error
          if (error && (errorCode === 'otp_expired' || error === 'access_denied')) {
            setStatus('error');
            const decodedDescription = errorDescription ? decodeURIComponent(errorDescription) : 'Email link is invalid or has expired';
            setErrorMessage(decodedDescription);
            return;
          }

          // Check for valid confirmation code - handle multiple parameter names and token formats
          const token_hash = searchParams.get('token_hash') || searchParams.get('code') || searchParams.get('token');
          const type = searchParams.get('type') || 'signup';

          if (!token_hash) {
            setStatus('error');
            setErrorMessage('Invalid confirmation link. Please check your email and try again.');
            return;
          }

          // Validate token format - accept UUID, PKCE, and other common formats
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const pkceRegex = /^pkce_[a-zA-Z0-9]+$/;
          const generalTokenRegex = /^[a-zA-Z0-9_-]{10,}$/; // General token format (at least 10 chars)
          
          if (!uuidRegex.test(token_hash) && !pkceRegex.test(token_hash) && !generalTokenRegex.test(token_hash)) {
            setStatus('error');
            setErrorMessage('Invalid confirmation code format. Please check your email and try again.');
            return;
          }

          // If we have a valid format token and no explicit errors, consider it successful
          setStatus('success');

        } catch (error: any) {
          setStatus('error');
          setErrorMessage('An unexpected error occurred. Please try again.');
        }
      }, 500); // 500ms delay to show loading state
    };

    confirmEmail();
  }, [searchParams]);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow flex flex-col items-center justify-center">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin mb-3" />
              <CardTitle className="text-2xl font-headline">Confirming Email</CardTitle>
              <CardDescription>
                Please wait while we verify your email address...
              </CardDescription>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-3" />
              <CardTitle className="text-2xl font-headline text-green-600">Welcome to Daily Hacklab!</CardTitle>
              <CardDescription>
                Your email has been confirmed and you are now logged in. Click below to access your dashboard.
              </CardDescription>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle className="mx-auto h-12 w-12 text-destructive mb-3" />
              <CardTitle className="text-2xl font-headline text-destructive">Confirmation Failed</CardTitle>
              <CardDescription>
                {errorMessage}
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="flex justify-center">
            <a href="/">
              <Button className="flex items-center gap-2">
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * EmailConfirmationPage component - Main page component with Suspense wrapper
 * @returns JSX element representing the email confirmation page
 */
export default function EmailConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow flex flex-col items-center justify-center">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center">
            <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin mb-3" />
            <CardTitle className="text-2xl font-headline">Loading</CardTitle>
            <CardDescription>
              Please wait...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      <EmailConfirmationContent />
    </Suspense>
  );
}