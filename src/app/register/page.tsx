"use client";

import { useEffect, useState } from 'react';
import RegisterForm from '@/components/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, ShieldOff } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PUBLIC_REGISTRATION_STORAGE_KEY } from '@/lib/config';

/**
 * RegisterPage component - User registration page
 * Conditionally shows registration form based on public registration settings
 * If public registration is disabled, shows message to contact administrator
 * @returns JSX element representing the registration page
 */
export default function RegisterPage() {
  const [allowPublicRegistration, setAllowPublicRegistration] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedSetting = localStorage.getItem(PUBLIC_REGISTRATION_STORAGE_KEY);
      setAllowPublicRegistration(storedSetting === 'true');
    } else {
      setAllowPublicRegistration(false); 
    }
  }, []);

  if (allowPublicRegistration === null) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow flex flex-col items-center justify-center">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center">
              <AlertTriangle className="mr-2 h-6 w-6 text-primary animate-pulse" /> Checking Registration Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Verifying registration settings...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!allowPublicRegistration) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow flex flex-col items-center justify-center text-center">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader>
             <ShieldOff className="mx-auto h-12 w-12 text-destructive mb-3" />
            <CardTitle className="text-2xl font-headline">Registration Disabled</CardTitle>
            <CardDescription>
              Public registration is currently not active.
              Please contact an administrator to create an account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" passHref>
              <Button variant="outline">Back to Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow flex flex-col items-center justify-center">
      <RegisterForm />
    </div>
  );
}
