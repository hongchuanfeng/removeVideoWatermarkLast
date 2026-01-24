import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';
import { updateSession } from '@/lib/supabase/middleware';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed'
});

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  console.log('[Middleware] ========================================');
  console.log('[Middleware] Processing request:', pathname);
  console.log('[Middleware] Request URL:', request.url);
  
  // Handle auth callback route separately - skip i18n middleware
  if (pathname === '/auth/callback') {
    console.log('[Middleware] Auth callback route, skipping i18n');
    return await updateSession(request);
  }

  // (no special-case redirects here to avoid redirect loops with intlMiddleware)

  // Apply i18n middleware first - it handles locale routing automatically
  // With localePrefix: 'as-needed', '/' maps to default locale automatically
  console.log('[Middleware] Calling intlMiddleware...');
  let response = intlMiddleware(request);
  
  console.log('[Middleware] Intl response:', response ? response.status : 'null');
  if (response) {
    const rewriteHeader = response.headers.get('x-middleware-rewrite');
    const localeHeader = response.headers.get('x-middleware-request-x-next-intl-locale');
    console.log('[Middleware] Rewrite header:', rewriteHeader);
    console.log('[Middleware] Locale header:', localeHeader);
  }
  
  // Ensure we have a valid response
  if (!response) {
    console.log('[Middleware] No response from intl middleware, redirecting to default locale');
    // Fallback: redirect to default locale if middleware fails
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  }
  
  // If intl middleware returns a redirect, return it immediately
  if (response.status === 307 || response.status === 308 || response.status === 301 || response.status === 302) {
    console.log('[Middleware] Returning redirect response, location:', response.headers.get('location'));
    return response;
  }
  
  // For non-redirect responses, update Supabase session and merge cookies
  console.log('[Middleware] Updating Supabase session...');
  const supabaseResponse = await updateSession(request);
  
  // Merge Supabase cookies into the response
  if (supabaseResponse) {
    console.log('[Middleware] Merging Supabase cookies...');
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value, cookie);
    });
  }
  
  console.log('[Middleware] Returning final response');
  console.log('[Middleware] ========================================');
  return response;
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - files with extensions (e.g. .jpg, .png, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ]
};
