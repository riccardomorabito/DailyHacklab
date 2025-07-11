"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, UploadCloud, BarChart2, Server as ServerIcon, LogIn, CalendarDays, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import EventNotificationsBanner from "@/components/event-notifications-banner";
import GlobalLoading from "@/components/global-loading";

/**
 * HomePageContent component - Main landing page content
 * Shows different content based on authentication status:
 * - Authenticated users: Welcome message with navigation cards
 * - Non-authenticated users: Login prompt and public leaderboard link
 * Features animated background with top user avatars
 * @returns JSX element representing the home page content
 */
function HomePageContent() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for email confirmation code and redirect to confirmation page
  useEffect(() => {
    const code = searchParams.get('code');
    const token = searchParams.get('token');
    const type = searchParams.get('type');
    const error = searchParams.get('error');
    const errorCode = searchParams.get('error_code');
    const errorDescription = searchParams.get('error_description');
    
    if (code || token || error) {
      // Use window.location.replace to avoid React router issues
      if (code) {
        window.location.replace(`/auth/confirm?code=${code}&type=${type || 'signup'}`);
      } else if (token) {
        window.location.replace(`/auth/confirm?token=${token}&type=${type || 'signup'}`);
      } else if (error) {
        window.location.replace(`/auth/confirm?error=${error}&error_code=${errorCode || ''}&error_description=${errorDescription || ''}`);
      }
      return;
    }
  }, [searchParams]);

  const isLoading = authLoading;

    return (
    <>
        {isLoading && <GlobalLoading />}

        {!isLoading && currentUser && (
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 flex-grow">
            <div className="py-8">
              <div className="text-center mb-12">
                <div className="w-32 h-32 mb-6 flex items-center justify-center mx-auto">
                  <img
                      src="/images/logos/logo-icon.png"
                      alt="DailyHacklab Logo"
                      className="w-full h-full object-contain"
                  />
                </div>
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl font-headline">
                  Welcome to DailyHacklab, {currentUser.name}!
                </h1>
                <p className="mt-3 text-lg text-muted-foreground max-w-xl mx-auto">
                  Ready to share your progress and discover what's new in the community?
                </p>
              </div>

              {/* Event Notifications Banner */}
              <div className="mb-8">
                <EventNotificationsBanner />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Link href="/create-post" passHref className="lg:col-span-1">
                  <Card className="h-full shadow-xl overflow-hidden transition-shadow hover:shadow-2xl cursor-pointer">
                    <CardHeader className="text-center p-4 bg-gradient-to-br from-primary/10 via-background to-background">
                      <UploadCloud className="mx-auto h-8 w-8 text-primary mb-2" />
                      <CardTitle className="text-xl font-headline">
                        Share Now
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 text-center text-sm">
                      <CardDescription>Post your update for the community, whenever you want!</CardDescription>
                    </CardContent>
                  </Card>
                </Link>
                
                <Link href="/posts" passHref className="lg:col-span-1">
                  <Card className="h-full shadow-xl overflow-hidden transition-shadow hover:shadow-2xl cursor-pointer">
                    <CardHeader className="text-center p-4 bg-gradient-to-br from-primary/10 via-background to-background">
                      <CalendarDays className="mx-auto h-8 w-8 text-primary mb-2" />
                      <CardTitle className="text-xl font-headline">
                        Posts
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 text-center text-sm">
                      <CardDescription>Discover what was presented in previous days.</CardDescription>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/events" passHref className="lg:col-span-1">
                  <Card className="h-full shadow-xl overflow-hidden transition-shadow hover:shadow-2xl cursor-pointer">
                    <CardHeader className="text-center p-4 bg-gradient-to-br from-primary/10 via-background to-background">
                      <Sparkles className="mx-auto h-8 w-8 text-primary mb-2" />
                      <CardTitle className="text-xl font-headline">
                        Special Events
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 text-center text-sm">
                      <CardDescription>Discover all past, current and future community events.</CardDescription>
                    </CardContent>
                  </Card>
                </Link>

                <Link href="/leaderboard" passHref className="lg:col-span-1">
                  <Card className="h-full shadow-xl overflow-hidden transition-shadow hover:shadow-2xl cursor-pointer">
                    <CardHeader className="text-center p-4 bg-gradient-to-br from-primary/10 via-background to-background">
                      <Trophy className="mx-auto h-8 w-8 text-primary mb-2" />
                      <CardTitle className="text-xl font-headline">
                        Leaderboard
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 text-center text-sm">
                      <CardDescription>See who dominates the ranking of the most active members!</CardDescription>
                    </CardContent>
                  </Card>
                </Link>
                
                <Link href="/server-farm" passHref className="lg:col-span-4">
                  <Card className="h-full shadow-xl overflow-hidden transition-shadow hover:shadow-2xl cursor-pointer">
                    <CardHeader className="text-center p-4 bg-gradient-to-br from-accent/10 via-background to-background">
                      <ServerIcon className="mx-auto h-8 w-8 text-accent mb-2" />
                      <CardTitle className="text-xl font-headline">
                        Your Datacenter
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 text-center text-sm">
                      <CardDescription>Check your datacenter's status and power it up with your contributions.</CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !currentUser && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] text-center px-4">
            <div className="w-48 h-48 mb-8 flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl shadow-2xl">
              <img
                  src="/images/logos/logo-icon.png"
                  alt="DailyHacklab Logo"
                  className="rounded-xl w-40 h-40 object-contain"
              />
            </div>
            
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl font-headline">
              DailyHacklab
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
              Share your daily successes, discover what others create, climb the rankings and grow your virtual datacenter!
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login" passHref>
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">
                  <LogIn className="mr-2 h-5 w-5" /> Login
                </Button>
              </Link>
              <Link href="/leaderboard" passHref>
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  <Trophy className="mr-2 h-5 w-5" /> View Leaderboard
                </Button>
              </Link>
            </div>
            <p className="mt-8 text-sm text-muted-foreground">
              Don't have credentials? Ask an administrator for access.
            </p>
          </div>
        )}
    </>
  );
}

/**
 * HomePage component - Main page with Suspense wrapper
 * @returns JSX element representing the home page with proper error boundaries
 */
export default function HomePage() {
  return (
    <Suspense fallback={<GlobalLoading message="Loading..." />}>
      <HomePageContent />
    </Suspense>
  );
}
