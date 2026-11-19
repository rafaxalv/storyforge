import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

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
  if (getSessionCookie(request, { cookiePrefix: "storyforge" })) return NextResponse.next();
  const url = new URL("/sign-in", request.url);
  if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
