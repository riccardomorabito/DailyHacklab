"use client";

import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/hooks/use-notifications';
import { UserPlus, Loader2, Mail, Clock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { logger } from '@/lib/logger';

const REGISTER_FORM_CONTEXT = "RegisterForm";

/**
 * Zod schema for user registration form validation
 */
const registerSchema = z.object({
  name: z.string().min(2, { message: "Name must contain at least 2 characters." }),
  email: z.string().email({ message: "Enter a valid email address." }),
  password: z.string().min(6, { message: "Password must contain at least 6 characters." }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

/**
 * Type definition for register form data based on the Zod schema
 */
type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * RegisterForm component - User registration interface
 * Provides comprehensive registration form with avatar upload capabilities
 * Features form validation, avatar preview, and multiple avatar input methods
 * Handles user registration, profile setup, and welcome notifications
 * @returns JSX element representing the registration form
 */
export default function RegisterForm() {
  const { register: registerUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { showWelcomeNotification, requestPermission } = useNotifications();
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string>('');

  const { register, handleSubmit, formState: { errors }, reset } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema)
  });

  /**
   * Handles form submission for user registration
   * @param data - RegisterFormData containing form input values
   */
  const onSubmit: SubmitHandler<RegisterFormData> = async (data) => {
    logger.info(REGISTER_FORM_CONTEXT, "onSubmit: Registration attempt for email:", data.email);
    setIsSubmittingForm(true);

    try {
      const { error } = await registerUser(data.name, data.email, data.password);

      if (error) {
        logger.warn(REGISTER_FORM_CONTEXT, "onSubmit: Registration failed:", error.message);
        toast({ title: "Registration Failed", description: error.message || "The email might already be in use or an error occurred.", variant: "destructive" });
      } else {
        logger.info(REGISTER_FORM_CONTEXT, "onSubmit: Registration submitted successfully for:", data.email);
        setRegisteredEmail(data.email);
        setShowEmailVerification(true);
        
        // Request notification permission for future use
        setTimeout(async () => {
          await requestPermission();
        }, 2000);
        
        reset();
      }
    } catch (e: any) {
      logger.error(REGISTER_FORM_CONTEXT, "onSubmit: Error during registration:", e.message);
      toast({ title: "Registration Error", description: e.message || "An error occurred during registration.", variant: "destructive" });
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const isLoading = authLoading || isSubmittingForm;

  // Show email verification waiting screen
  if (showEmailVerification) {
    return (
      <Card className="w-full max-w-md shadow-xl overflow-hidden">
        <CardHeader className="text-center pb-6 bg-gradient-to-br from-primary/10 via-background to-background">
          <Mail className="mx-auto h-12 w-12 text-primary mb-2" />
          <CardTitle className="text-3xl md:text-4xl font-headline">Check Your Email</CardTitle>
          <CardDescription className="mt-1 text-muted-foreground">
            We've sent a verification link to <strong>{registeredEmail}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="flex items-center justify-center space-x-2 text-muted-foreground">
            <Clock className="h-4 w-4 animate-pulse" />
            <p className="text-sm">Waiting for email confirmation...</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Next Steps:</strong>
            </p>
            <ol className="text-sm text-blue-600 dark:text-blue-400 mt-2 space-y-1 text-left">
              <li>1. Check your email inbox</li>
              <li>2. Click the verification link</li>
              <li>3. Return here to log in</li>
            </ol>
          </div>
          <p className="text-xs text-muted-foreground">
            Didn't receive an email? Check your spam folder or try registering again.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/login" passHref>
            <Button className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Go to Login
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl shadow-xl overflow-hidden">
      <CardHeader className="text-center pb-6 bg-gradient-to-br from-primary/10 via-background to-background">
        <UserPlus className="mx-auto h-12 w-12 text-primary mb-2" />
        <CardTitle className="text-3xl md:text-4xl font-headline">Create Your Account</CardTitle>
        <CardDescription className="mt-1 text-muted-foreground">Join Daily Hacklab to start sharing and collaborating.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" {...register('name')} placeholder="John Doe" className="text-base" disabled={isLoading} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} placeholder="you@example.com" className="text-base" disabled={isLoading} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register('password')} placeholder="••••••••" className="text-base" disabled={isLoading} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input id="confirmPassword" type="password" {...register('confirmPassword')} placeholder="••••••••" className="text-base" disabled={isLoading} />
            {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
          </div>

        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Registering...' : 'Register'}
          </Button>
        </CardFooter>
      </form>
      
    </Card>
  );
}
