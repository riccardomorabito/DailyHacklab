"use client";

import RegisterForm from '@/components/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Loader2, ShieldOff } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { usePublicRegistration } from '@/hooks/use-app-settings';
import GlobalLoading from '@/components/global-loading';

/**
 * RegisterPage component - User registration page
 * Conditionally shows registration form based on public registration settings
 * If public registration is disabled, shows message to contact administrator
 * @returns JSX element representing the registration page
 */
export default function RegisterPage() {
  const { enabled: allowPublicRegistration, isLoading } = usePublicRegistration();

  if (isLoading) {
    return <GlobalLoading message="Verifying registration settings..." />;
  }

  if (!allowPublicRegistration) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow flex flex-col items-center justify-center text-center">
        <Card className="w-full max-w-md shadow-xl overflow-hidden">
          <CardHeader className="text-center pb-6 bg-gradient-to-br from-destructive/10 via-background to-background">
            <ShieldOff className="mx-auto h-12 w-12 text-destructive mb-2" />
            <CardTitle className="text-3xl md:text-4xl font-headline">Registration Disabled</CardTitle>
            <CardDescription className="mt-1 text-muted-foreground">Public registration is currently not active. Please contact an administrator.</CardDescription>
          </CardHeader>
          <CardContent className="pt-10 pb-8 px-4 md:px-6 text-center">
            <Link href="/login" passHref>
              <Button variant="outline" size="lg">Back to Login</Button>
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
