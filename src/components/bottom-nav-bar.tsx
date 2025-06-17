"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, UploadCloud, ListChecks, BarChart2, Server as ServerIcon, Cog, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import React, { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

const BOTTOM_NAV_CONTEXT = "BottomNavBar";

/**
 * Navigation items configuration
 * Defines the structure and properties of bottom navigation items
 */
const navItems = [
  { href: '/', label: 'Home', icon: Home, requiresAuth: false },
  { href: '/posts', label: 'Posts', icon: CalendarDays, requiresAuth: true },
  { href: '/leaderboard', label: 'Leaderboard', icon: BarChart2, requiresAuth: false },
  { href: '/server-farm', label: 'Server Farm', icon: ServerIcon, requiresAuth: true },
  { href: '/settings', label: 'Settings', icon: Cog, requiresAuth: true },
];

/**
 * BottomNavBar component.
 * Displays a navigation bar at the bottom of the screen on mobile devices.
 * Filters navigation items based on user authentication status.
 * @returns {JSX.Element | null} The bottom navigation bar or null if not visible.
 */
export default function BottomNavBar() {
  const pathname = usePathname();
  const { currentUser, loading: authLoading } = useAuth();
  // Initialize isVisible to false. It will be updated client-side.
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    logger.debug(BOTTOM_NAV_CONTEXT, "useEffect for mount and resize: Component is mounting/updating.");
    setIsMounted(true);

    const handleResize = () => {
      const newVisibility = window.innerWidth < 768;
      logger.debug(BOTTOM_NAV_CONTEXT, `handleResize: window.innerWidth = ${window.innerWidth}, newVisibility = ${newVisibility}`);
      setIsVisible(newVisibility);
    };

    // Call on mount to set initial state based on current window size
    handleResize();
    logger.debug(BOTTOM_NAV_CONTEXT, "useEffect for mount and resize: Initial resize check done.");

    window.addEventListener('resize', handleResize);
    logger.debug(BOTTOM_NAV_CONTEXT, "useEffect for mount and resize: Resize listener added.");

    return () => {
      window.removeEventListener('resize', handleResize);
      logger.debug(BOTTOM_NAV_CONTEXT, "useEffect for mount and resize: Resize listener removed on cleanup.");
    };
  }, []); // Empty dependency array ensures this runs once on mount and cleans up on unmount

  if (!isMounted) {
    logger.debug(BOTTOM_NAV_CONTEXT, "Render: Component not mounted yet, returning null.");
    return null;
  }

  if (!isVisible) {
    logger.debug(BOTTOM_NAV_CONTEXT, `Render: Not visible (isMounted: ${isMounted}, isVisible: ${isVisible}), returning null.`);
    return null;
  }

  // Filter navigation items based on authentication requirements
  const filteredNavItems = navItems.filter(item => {
    if (authLoading && item.requiresAuth) return false; // Hide auth-required items while loading
    if (item.requiresAuth && !currentUser) return false; // Hide auth-required items if not logged in
    return true;
  });
  
  if (filteredNavItems.length === 0 && !authLoading) {
    logger.debug(BOTTOM_NAV_CONTEXT, "Render: No items to display after filtering, returning null.");
    return null;
  }
  
  // Loading skeleton for the nav bar
  if (authLoading && isVisible) { 
    logger.debug(BOTTOM_NAV_CONTEXT, "Render: Auth is loading and component is visible, rendering SKELETON.");
    return (
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-background border-t border-border shadow-lg flex justify-around items-center z-40 md:hidden">
        {[...Array(navItems.filter(item => item.requiresAuth === false || currentUser).length || navItems.length)].map((_, i) => ( 
          <div key={i} className="flex flex-col items-center justify-center w-1/6 h-full animate-pulse">
            <div className="w-6 h-6 bg-muted rounded-md mb-1"></div>
            <div className="w-10 h-3 bg-muted rounded"></div>
          </div>
        ))}
      </nav>
    );
  }

  logger.debug(BOTTOM_NAV_CONTEXT, `Render: Rendering ACTUAL BottomNavBar with ${filteredNavItems.length} items.`);
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-background border-t border-border shadow-lg flex justify-around items-center z-40 md:hidden">
      {filteredNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors",
            pathname === item.href
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-label={item.label}
        >
          <item.icon className={cn("h-5 w-5 mb-0.5", pathname === item.href ? "text-primary" : "")} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
