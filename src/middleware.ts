/**
 * Next.js middleware for authentication, security headers, and request filtering
 * Handles Supabase session management and applies security policies
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { logger } from '@/lib/logger';

/**
 * Context identifier for logging operations in middleware
 */
const MIDDLEWARE_CONTEXT = "SupabaseMiddleware";

/**
 * Security headers configuration for enhanced application security
 * Implements Content Security Policy, XSS protection, and other security measures
 */
const SECURITY_HEADERS = {
  'X-XSS-Protection': '1; mode=block',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "media-src 'self'",
    "object-src 'none'",
    "child-src 'none'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "manifest-src 'self'"
  ].join('; '),
  'Permissions-Policy': [
    'accelerometer=()',
    'camera=()',
    'geolocation=()',
    'gyroscope=()',
    'magnetometer=()',
    'microphone=()',
    'payment=()',
    'usb=()'
  ].join(', '),
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin'
} as const;

/**
 * Main middleware function that handles authentication, security, and request filtering
 * @param request - The incoming Next.js request object
 * @returns Promise<NextResponse> - The response with applied security headers and session management
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Add security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Basic security checks
  const pathname = request.nextUrl.pathname;
  const userAgent = request.headers.get('user-agent') || '';
  
  // Block suspicious paths
  const suspiciousPaths = [/\.php$/i, /\.asp$/i, /wp-admin/i, /phpmyadmin/i];
  if (suspiciousPaths.some(pattern => pattern.test(pathname))) {
    logger.warn(MIDDLEWARE_CONTEXT, `Blocked suspicious path: ${pathname}`);
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Block suspicious user agents
  const suspiciousAgents = [/bot/i, /crawler/i, /spider/i, /scan/i];
  if (suspiciousAgents.some(pattern => pattern.test(userAgent))) {
    logger.warn(MIDDLEWARE_CONTEXT, `Blocked suspicious user agent: ${userAgent}`);
    return new NextResponse('Forbidden', { status: 403 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    logger.error(MIDDLEWARE_CONTEXT, "Supabase URL or Anon Key is missing for middleware client.");
    // Potentially redirect to an error page or just proceed without session refresh
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          const cookie = request.cookies.get(name);
          // Only log main auth token, not the fragmented parts to reduce noise
          if (name.includes('auth-token') && !name.includes('.')) {
            logger.debug(MIDDLEWARE_CONTEXT, `Auth token: ${cookie?.value ? 'found' : 'not found'}`);
          }
          return cookie?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Create new response to ensure cookie changes are applied
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          
          // Apply security headers again since we're creating a new response
          Object.entries(SECURITY_HEADERS).forEach(([key, headerValue]) => {
            response.headers.set(key, headerValue);
          });
          
          response.cookies.set({
            name,
            value,
            ...options,
            // Ensure cookies work on Vercel Edge Functions
            secure: true,
            sameSite: 'lax',
            httpOnly: name.includes('auth-token') || name.includes('refresh-token'),
          });
        },
        remove(name: string, options: CookieOptions) {
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          
          // Apply security headers again
          Object.entries(SECURITY_HEADERS).forEach(([key, headerValue]) => {
            response.headers.set(key, headerValue);
          });
          
          response.cookies.set({
            name,
            value: '',
            ...options,
            expires: new Date(0),
            maxAge: 0,
          });
        },
      },
    }
  );

  // Server-side authentication check with secure cookie handling
  let isAuthenticated = false;
  
  try {
    // Use getUser() for secure authentication check (recommended by Supabase)
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (user && !error) {
      logger.debug(MIDDLEWARE_CONTEXT, `Authenticated user: ${user.id}`);
      isAuthenticated = true;
    } else if (error) {
      logger.debug(MIDDLEWARE_CONTEXT, `Auth check failed: ${error.message}`);
      // Fallback: check for auth cookies (even if fragmented)
      const authCookiePattern = /sb-.*-auth-token/;
      const allCookies = request.cookies.getAll();
      const hasAuthCookie = allCookies.some(cookie => authCookiePattern.test(cookie.name));
      
      if (hasAuthCookie) {
        logger.debug(MIDDLEWARE_CONTEXT, "Found auth cookies, treating as authenticated");
        isAuthenticated = true;
      }
    }
  } catch (error) {
    logger.error(MIDDLEWARE_CONTEXT, `Failed to authenticate user: ${error}`);
    isAuthenticated = false;
  }

  // Server-side protection for all sensitive routes (security-first approach)
  
  // Define protected routes that require server-side authentication
  const protectedRoutes = [
    '/posts',
    '/create-post',
    '/events',
    '/dashboard',
    '/profile',
    '/settings',
    '/admin',
    '/server-farm'
  ];
  
  // Define public routes that do not require authentication
  const publicRoutes = ['/login', '/register', '/auth/callback', '/auth/confirm'];
  
  // Define routes handled completely by client (public routes)
  const clientHandledRoutes = ['/', '/leaderboard'];

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  const isClientHandledRoute = clientHandledRoutes.some(route => pathname === route);

  // Skip middleware processing for client-handled routes
  if (isClientHandledRoute) {
    logger.debug(MIDDLEWARE_CONTEXT, `Client-handled route: ${pathname}`);
    return response;
  }

  // Redirect unauthenticated users from protected routes (server-side security)
  if (!isAuthenticated && isProtectedRoute) {
    logger.info(MIDDLEWARE_CONTEXT, `User not authenticated. Redirecting from ${pathname} to /login.`);
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users from auth pages
  if (isAuthenticated && (pathname === '/login' || pathname === '/register')) {
    const redirectedFrom = request.nextUrl.searchParams.get('redirectedFrom');
    
    if (redirectedFrom && protectedRoutes.some(route => redirectedFrom.startsWith(route))) {
      logger.info(MIDDLEWARE_CONTEXT, `User authenticated. Redirecting from ${pathname} back to ${redirectedFrom}.`);
      return NextResponse.redirect(new URL(redirectedFrom, request.url));
    } else {
      logger.info(MIDDLEWARE_CONTEXT, `User authenticated. Redirecting from ${pathname} to home page.`);
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return response;
}

/**
 * Middleware configuration specifying which routes should be processed
 * Only processes specific routes that need authentication checks
 * Excludes static files, images, API routes, and client-handled routes
 */
export const config = {
  matcher: [
    /*
     * Server-side protection for all sensitive routes (security-first approach)
     * - All protected routes require server-side auth checks
     * - Auth routes need redirect logic
     * - Reduced cookie fragmentation with optimized JWT
     *
     * Excludes only:
     * - / (home page - public)
     * - /leaderboard (public page)
     * - Static files and assets
     */
    '/posts/:path*',
    '/create-post/:path*',
    '/events/:path*',
    '/dashboard/:path*',
    '/profile/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/server-farm/:path*',
    '/login',
    '/register',
    '/auth/:path*'
  ],
};
