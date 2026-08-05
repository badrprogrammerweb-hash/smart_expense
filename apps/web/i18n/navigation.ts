import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

// As of next-intl 4.13.3 the middleware only writes the NEXT_LOCALE cookie for
// document requests, so that a background request (a prefetch or the router
// cache revalidating a route of the locale just switched away from) cannot
// clobber a fresh choice. A locale switch performed as a client-side
// navigation therefore no longer reaches any cookie-writing code path on the
// server, and next-intl expects the client to write the cookie itself. These
// helpers do exactly that (upstream `syncLocaleCookie`); the equivalents from
// `next/navigation` do not, which is why the language switcher uses these.
export const { usePathname, useRouter } = createNavigation(routing);
