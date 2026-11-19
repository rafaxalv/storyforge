"use client";

import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side Better Auth client (same origin). Used for calls that must go through the
 * HTTP endpoints so Better Auth's rate limits apply: requesting a magic link and Google
 * sign-in.
 */
export const authClient = createAuthClient({ plugins: [magicLinkClient()] });
