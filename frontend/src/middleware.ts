import type { NextRequest } from 'next/server';
import { handleRouteProtection } from './proxy';

export function middleware(request: NextRequest) {
  return handleRouteProtection(request);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icon.svg).*)'],
};
