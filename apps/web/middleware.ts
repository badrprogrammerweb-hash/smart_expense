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

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);

  if (!isWorkspacePath(request.nextUrl.pathname)) {
    return response;
  }

  const locale = localeFromPath(request.nextUrl.pathname);

  if (!hasSupabaseConfig()) {
    return NextResponse.redirect(new URL(`/${locale}/sign-in`, request.url));
  }

  const supabase = createMiddlewareSupabaseClient(request, response);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL(`/${locale}/sign-in`, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/", "/(en|ar)/:path*", "/((?!_next|_vercel|.*\\..*).*)"],
};
