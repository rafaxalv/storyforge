import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth/auth";

export const dynamic = "force-dynamic";

// Better Auth's endpoints (sign-in, magic-link verify, OAuth callbacks, sign-out,
// get-session, delete-user, ...). The instance is created lazily on first request.
const handler = (request: Request) => getAuth().handler(request);

export const { GET, POST } = toNextJsHandler(handler);
