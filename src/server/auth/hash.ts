import { createHmac } from "node:crypto";

/**
 * A stable, non-reversible tag for an email address in logs: the first 12 hex chars of
 * HMAC-SHA256(secret, lower-cased email). Lets logs correlate events for one address
 * without containing it.
 */
export function emailHash(email: string, secret: string): string {
  return createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("hex").slice(0, 12);
}
