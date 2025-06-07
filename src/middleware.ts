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
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Attempt to refresh session for every request
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    // logger.debug(MIDDLEWARE_CONTEXT, "Session refreshed/validated in middleware for user:", session.user.id);
  } else {
    // logger.debug(MIDDLEWARE_CONTEXT, "No active session found in middleware.");
  }

  return response;
}

/**
 * Middleware configuration specifying which routes should be processed
 * Excludes static files, images, and Next.js internal files from processing
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
