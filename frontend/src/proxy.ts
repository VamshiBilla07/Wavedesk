import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE = 'wavedesk_token';

/**
 * Route protection proxy logic:
 * - Unauthenticated users attempting to access /dashboard routes are redirected to /auth/login
 * - Authenticated users attempting to access /auth routes are redirected to /dashboard
 */
export function handleRouteProtection(request: NextRequest): NextResponse | undefined {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  const isAuthRoute = pathname.startsWith('/auth');
  const isDashboardRoute = pathname.startsWith('/dashboard');

  // If user is trying to access protected dashboard routes without a session cookie
  if (isDashboardRoute && !token) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If already authenticated user is trying to access login/signup
  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return undefined;
}

export default handleRouteProtection;
