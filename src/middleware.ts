import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_PREFIX, signInPath } from "@/shared/auth";
import { PATH_HEADER } from "@/shared/headers";

/** Paths anyone may open without a session. */
const PUBLIC = [/^\/sign-in(\/|$)/, /^\/goodbye$/, /^\/api\/health$/, /^\/api\/auth\//];

/**
 * First, optimistic layer of page protection: no session cookie → redirect to sign-in with
 * the requested path. A cookie is not proof of a session; the (app) layout and every server
 * action validate it against the database.
 */
export function middleware(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  if (getSessionCookie(request, { cookiePrefix: AUTH_COOKIE_PREFIX })) {
    // Pass the requested path on, so the (app) layout can send a stale-cookie visitor to
    // sign-in with `next` as well.
    const headers = new Headers(request.headers);
    headers.set(PATH_HEADER, `${pathname}${search}`);
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.redirect(new URL(signInPath(`${pathname}${search}`), request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
