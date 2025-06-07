"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import React, { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { logger } from '@/lib/logger';

const PROTECTED_ROUTE_CONTEXT = "ProtectedRoute";

/**
 * Props for the ProtectedRoute component.
 */
interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean; // If true, route requires admin privileges
}

/**
 * ProtectedRoute component.
 * Wraps content that requires authentication and optionally admin privileges.
 * Redirects unauthenticated or unauthorized users.
 * Displays a loading skeleton while authentication state is being determined.
 * @param {ProtectedRouteProps} props - The component props.
 * @param {React.ReactNode} props.children - The content to protect.
 * @param {boolean} [props.adminOnly=false] - Whether the route requires admin privileges.
 * @returns {JSX.Element} The children if authorized, or a loading skeleton/redirect.
 */
export default function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const { currentUser, isAdmin, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    logger.debug(PROTECTED_ROUTE_CONTEXT, `Effect triggered. Path: ${pathname}, Loading: ${loading}, CurrentUser: ${!!currentUser}, IsAdmin: ${isAdmin}, AdminOnly: ${adminOnly}`);
    if (!loading) { // Only act once loading is complete
      if (!currentUser) {
        logger.info(PROTECTED_ROUTE_CONTEXT, `No currentUser, redirecting to /login from ${pathname}`);
        router.replace('/login'); // Redirect to login if not authenticated
      } else if (adminOnly && !isAdmin) {
        logger.warn(PROTECTED_ROUTE_CONTEXT, `AdminOnly page but user is not admin (User: ${currentUser.name}, Role: ${currentUser.role}), redirecting to / from ${pathname}`);
        router.replace('/'); // Redirect to home if adminOnly and user is not admin
      } else {
        // User is authenticated and authorized (if adminOnly)
        logger.debug(PROTECTED_ROUTE_CONTEXT, `Access granted. Path: ${pathname}, User: ${currentUser?.name}`);
      }
    } else {
        logger.debug(PROTECTED_ROUTE_CONTEXT, `Still loading authentication state. Path: ${pathname}`);
    }
  }, [currentUser, isAdmin, loading, adminOnly, router, pathname]);

  // Determine if skeleton should be shown:
  // 1. Auth state is loading.
  // 2. Auth loaded, but no current user (will redirect, but show skeleton briefly).
  // 3. Auth loaded, user exists, page is adminOnly, but user is not admin (will redirect, show skeleton briefly).
  const shouldShowSkeleton = loading || !currentUser || (adminOnly && !isAdmin && !!currentUser);
  
  logger.debug(PROTECTED_ROUTE_CONTEXT, `Render check. Path: ${pathname}, Loading: ${loading}, CurrentUser: ${!!currentUser}, IsAdmin: ${isAdmin}, AdminOnly: ${adminOnly}, ShouldShowSkeleton: ${shouldShowSkeleton}`);

  if (shouldShowSkeleton) {
    logger.info(PROTECTED_ROUTE_CONTEXT, `Rendering SKELETON for ${pathname}. Reason: loading=${loading}, currentUser=${!!currentUser}, adminOnly=${adminOnly}, isAdmin=${isAdmin}`);
    // Render a loading skeleton while checking auth or redirecting
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <div className="flex gap-4">
          <Skeleton className="h-32 w-1/2" />
          <Skeleton className="h-32 w-1/2" />
        </div>
      </div>
    );
  }
  
  // If authenticated and authorized, render children
  logger.info(PROTECTED_ROUTE_CONTEXT, `Rendering CHILDREN for ${pathname}. User: ${currentUser?.name}`);
  return <>{children}</>;
}
