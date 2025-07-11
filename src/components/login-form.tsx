"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/hooks/use-notifications';
import { LogIn, Loader2, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { logger } from '@/lib/logger';
import { usePublicRegistration } from '@/hooks/use-app-settings';
import GlobalLoading from '@/components/global-loading';

const LOGIN_FORM_CONTEXT = "LoginForm";

/**
 * LoginFormContent component - User authentication interface
 * Provides email/password login functionality with registration link
 * Features form validation, loading states, and notification integration
 * Supports conditional public registration based on application settings
 * @returns JSX element representing the login form
 */
function LoginFormContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading: authLoading, currentUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { showWelcomeNotification, requestPermission } = useNotifications();
  const { enabled: allowPublicRegistration, isLoading: isLoadingRegistrationSetting } = usePublicRegistration();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Redirect if user is already logged in
  useEffect(() => {
    if (currentUser) {
      router.push('/');
    }
  }, [currentUser, router]);

  // Check if user was redirected after email confirmation
  useEffect(() => {
    const confirmed = searchParams.get('confirmed');
    if (confirmed === 'true') {
      setShowConfirmation(true);
      // Clear the URL parameter without causing re-renders
      const url = new URL(window.location.href);
      url.searchParams.delete('confirmed');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  /**
   * Handles form submission for user login
   * @param e - Form submission event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    logger.info(LOGIN_FORM_CONTEXT, `handleSubmit: Login attempt for email: ${email}`);
    setIsSubmitting(true);
    const { error, user } = await login(email, password);
    setIsSubmitting(false);

    if (error) {
      logger.warn(LOGIN_FORM_CONTEXT, `handleSubmit: Login failed for ${email}. Error:`, error.message);
      toast({ title: "Login Failed", description: error.message || "Invalid credentials or user not found.", variant: "destructive" });
    } else if (user) {
      logger.info(LOGIN_FORM_CONTEXT, `handleSubmit: Login successful for ${user.name} (${user.email}). Redirecting to /.`);
      toast({ title: "Login Successful", description: `Welcome back, ${user.name}!` });
      
      // Request notification permission and show welcome notification
      setTimeout(async () => {
        const permission = await requestPermission();
        if (permission === 'granted') {
          showWelcomeNotification(user.name);
        }
      }, 1000);
      
      // Small delay to ensure auth state propagation before navigation
      setTimeout(() => {
        router.push('/');
      }, 100);
    } else {
      logger.error(LOGIN_FORM_CONTEXT, `handleSubmit: Login failed for ${email} without a specific error from Supabase.`);
      toast({ title: "Login Failed", description: "An unknown error occurred.", variant: "destructive"});
    }
  };

  const isLoading = authLoading || isSubmitting;

  return (
    <Card className="w-full max-w-md shadow-xl overflow-hidden">
      <CardHeader className="text-center pb-6 bg-gradient-to-br from-primary/10 via-background to-background">
        <LogIn className="mx-auto h-12 w-12 text-primary mb-2" />
        <CardTitle className="text-3xl md:text-4xl font-headline">Member Access</CardTitle>
        <CardDescription className="mt-1 text-muted-foreground">Enter your credentials to continue</CardDescription>
      </CardHeader>
      {showConfirmation && (
        <div className="px-6 pb-4">
          <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-700 dark:text-green-300">
              <strong>Email verified successfully!</strong> You can now log in to your account.
            </AlertDescription>
          </Alert>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="text-base"
              disabled={isLoading}
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="text-base"
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Logging in...' : 'Login'}
          </Button>
          {!isLoadingRegistrationSetting && allowPublicRegistration && (
            <p className="text-sm text-center text-muted-foreground">
              Don't have an account?{' '}
              <Link href="/register" className="font-medium text-primary hover:underline">
                Register now
              </Link>
            </p>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}

/**
 * LoginForm component - Main component with Suspense wrapper
 * @returns JSX element representing the login form with proper error boundaries
 */
export default function LoginForm() {
  return (
    <Suspense fallback={<GlobalLoading message="Loading login..." />}>
      <LoginFormContent />
    </Suspense>
  );
}
