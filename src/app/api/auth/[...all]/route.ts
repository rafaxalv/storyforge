import { toNextJsHandler } from "better-auth/next-js";
import { handleAuthRequest } from "@/server/auth/auth";

export const dynamic = "force-dynamic";

// Better Auth's endpoints (sign-in, magic-link verify, OAuth callbacks, sign-out,
// get-session, delete-user, ...). The instance is created lazily on first request.
export const { GET, POST } = toNextJsHandler((request: Request) => handleAuthRequest(request));
