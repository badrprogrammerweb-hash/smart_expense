import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { isLocale, routing } from "./i18n/routing";
import { createMiddlewareSupabaseClient, hasSupabaseConfig } from "./lib/supabase/server";

const intlMiddleware = createIntlMiddleware(routing);

function localeFromPath(pathname: string) {
  const [, maybeLocale] = pathname.split("/");
  return isLocale(maybeLocale) ? maybeLocale : routing.defaultLocale;
}

function isWorkspacePath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return isLocale(segments[0]) && segments[1] === "w";
}

// intlMiddleware's response can carry a Set-Cookie (NEXT_LOCALE sync) that a
// bare NextResponse.redirect() would otherwise silently drop.
function redirectPreservingCookies(url: URL, from: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  from.cookies.getAll().forEach(({ name, value, ...options }) => {
    redirectResponse.cookies.set(name, value, options);
  });
  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  if (!isWorkspacePath(request.nextUrl.pathname)) {
    return response;
  }

  const locale = localeFromPath(request.nextUrl.pathname);

  if (!hasSupabaseConfig()) {
    return redirectPreservingCookies(new URL(`/${locale}/sign-in`, request.url), response);
  }

  const supabase = createMiddlewareSupabaseClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectPreservingCookies(new URL(`/${locale}/sign-in`, request.url), response);
  }

  return response;
}

export const config = {
  matcher: ["/", "/(en|ar)/:path*", "/((?!_next|_vercel|.*\\..*).*)"],
};
