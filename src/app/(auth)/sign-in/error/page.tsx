import Link from "next/link";
import { log } from "@/server/log";

export const dynamic = "force-dynamic";

// Better Auth reports used, unknown and (usually) expired links all as INVALID_TOKEN.
const REASONS: Record<string, "expired" | "invalid"> = {
  EXPIRED_TOKEN: "expired",
  INVALID_TOKEN: "invalid",
};

export default async function SignInErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const code = (await searchParams).error ?? "";
  log("auth").warn(
    { event: "auth.link.invalid", reason: REASONS[code] ?? "unknown" },
    "sign-in link rejected",
  );
  return (
    <main style={{ maxWidth: "24rem", margin: "0 auto" }}>
      <h1>That link no longer works</h1>
      <p>Sign-in links work once and expire after 15 minutes.</p>
      <p>
        <Link href="/sign-in">Get a new link</Link>
      </p>
    </main>
  );
}
