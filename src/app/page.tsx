"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, UploadCloud, BarChart2, Server as ServerIcon, LogIn, CalendarDays, Sparkles } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import Image from "next/image";
import GridSnakeAnimationBackground from "@/components/GridSnakeAnimationBackground";
import EventNotificationsBanner from "@/components/event-notifications-banner";
import { getLeaderboardUsers } from "@/actions/leaderboard";
import type { User } from "@/types";
import { generateBoringAvatarDataUrl } from "@/lib/client-avatar-utils";

const NUM_SNAKES_FOR_BACKGROUND = 12; // Desired number of snakes/avatars in the background

/**
 * HomePage component - Main landing page of the application
 * Shows different content based on authentication status:
 * - Authenticated users: Welcome message with navigation cards
 * - Non-authenticated users: Login prompt and public leaderboard link
 * Features animated background with top user avatars
 * @returns JSX element representing the home page
 */
export default function HomePage() {
  const { currentUser, loading: authLoading } = useAuth();
  const [topUserAvatarUrls, setTopUserAvatarUrls] = useState<(string | null)[]>(Array(NUM_SNAKES_FOR_BACKGROUND).fill(null));
  const [loadingAvatars, setLoadingAvatars] = useState(true);

  useEffect(() => {
    /**
     * Fetches top user avatars for the animated background
     * Falls back to boring avatars or placeholders if user avatars are not available
     */
    async function fetchTopUserAvatars() {
      setLoadingAvatars(true);
      console.log("HomePage: Fetching top user avatars...");
      const { data: users, error } = await getLeaderboardUsers();
      let urlsForBackground: (string | null)[] = Array(NUM_SNAKES_FOR_BACKGROUND).fill(null);

      console.log("HomePage: Leaderboard result:", { users: users?.length, error, usersData: users });

      if (users && !error) {
        // Sort users by score (getLeaderboardUsers seems to do this already, but for safety)
        const sortedUsers = [...users].sort((a, b) => (b.score || 0) - (a.score || 0));
        
        console.log("HomePage: Sorted users:", sortedUsers.map(u => ({ name: u.name, avatarUrl: u.avatarUrl, score: u.score })));
        
        // Get avatar URLs, up to NUM_SNAKES_FOR_BACKGROUND
        // If a user doesn't have an avatar, generate a boring avatar SVG
        for (let i = 0; i < Math.min(sortedUsers.length, NUM_SNAKES_FOR_BACKGROUND); i++) {
          if (sortedUsers[i].avatarUrl) {
            urlsForBackground[i] = sortedUsers[i].avatarUrl || null;
          } else {
            // Generate boring avatar for users without avatars
            try {
              const boringAvatarUrl = generateBoringAvatarDataUrl(
                sortedUsers[i].name || sortedUsers[i].email || sortedUsers[i].id,
                40
              );
              urlsForBackground[i] = boringAvatarUrl;
            } catch (error) {
              console.warn("Failed to generate boring avatar for user", sortedUsers[i].name, error);
              urlsForBackground[i] = "https://placehold.co/300x300.png"; // Fallback
            }
          }
        }
        console.log("HomePage: URLs for background:", urlsForBackground.filter(Boolean).length, "valid URLs out of", urlsForBackground.length);
        setTopUserAvatarUrls(urlsForBackground);
      } else {
        console.warn("HomePage: Could not fetch top users for avatars, using only placeholders:", error);
        setTopUserAvatarUrls(Array(NUM_SNAKES_FOR_BACKGROUND).fill(null)); // Array of nulls if there's an error
      }
      setLoadingAvatars(false);
    }
    fetchTopUserAvatars();
  }, []);

  const isLoading = authLoading || loadingAvatars;

  return (
    <div className="relative isolate min-h-[calc(100vh-theme(spacing.16)-theme(spacing.20))] md:min-h-[calc(100vh-theme(spacing.16)-theme(spacing.20))] flex flex-col justify-center flex-grow">
      <GridSnakeAnimationBackground avatarUrls={topUserAvatarUrls} loadingAvatars={loadingAvatars} />
      
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Zap className="h-16 w-16 text-primary animate-pulse" />
            <p className="text-muted-foreground mt-4">Loading energies...</p>
          </div>
        )}

        {!isLoading && currentUser && (
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
              <Link href="/submit" passHref className="lg:col-span-1">
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer bg-primary/10 border-primary ring-1 ring-primary/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-2xl font-headline">
                      <UploadCloud className="mr-3 h-7 w-7 text-primary" />
                      Share Now
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>Post your update for the community, whenever you want!</CardDescription>
                  </CardContent>
                </Card>
              </Link>
              
              <Link href="/posts" passHref className="lg:col-span-1">
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center text-2xl font-headline">
                      <CalendarDays className="mr-3 h-7 w-7 text-primary" />
                      Posts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>Discover what was presented in previous days.</CardDescription>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/events" passHref className="lg:col-span-1">
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center text-2xl font-headline">
                      <Sparkles className="mr-3 h-7 w-7 text-primary" />
                      Special Events
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>Discover all past, current and future community events.</CardDescription>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/leaderboard" passHref className="lg:col-span-1">
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="flex items-center text-2xl font-headline">
                      <BarChart2 className="mr-3 h-7 w-7 text-primary" />
                      Contributions Leaderboard
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>See who dominates the ranking of the most active members!</CardDescription>
                  </CardContent>
                </Card>
              </Link>
              
              <Link href="/server-farm" passHref className="lg:col-span-4">
                <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer bg-accent/10 border-accent ring-1 ring-accent/50">
                  <CardHeader>
                    <CardTitle className="flex items-center text-2xl font-headline">
                      <ServerIcon className="mr-3 h-7 w-7 text-accent" />
                      Your Datacenter
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>Check your datacenter's status and power it up with your contributions.</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </div>
        )}

        {!isLoading && !currentUser && (
          <div className="flex flex-col items-center justify-center text-center px-4 py-12">
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
                  <BarChart2 className="mr-2 h-5 w-5" /> View Leaderboard
                </Button>
              </Link>
            </div>
            <p className="mt-8 text-sm text-muted-foreground">
              Don't have credentials? Ask an administrator for access.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
