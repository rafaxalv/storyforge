/**
 * Auth constants and helpers shared by the server, the edge middleware and pages. Nothing
 * here may import Node-only code (the middleware runs in the edge runtime).
 */

/** Better Auth cookie prefix: cookies are `storyforge.session_token` etc. */
export const AUTH_COOKIE_PREFIX = "storyforge";

/** How long a sign-in link works. */
export const MAGIC_LINK_TTL_MIN = 15;

/** The sentence shown in emails and pages about link lifetime. */
export const LINK_LIFETIME_NOTE = `The link works once and expires in ${MAGIC_LINK_TTL_MIN} minutes.`;

/** Sign-in URL that returns to `next` afterwards (no `next` for the home page). */
export function signInPath(next: string): string {
  return next === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`;
}
