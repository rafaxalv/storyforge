import Link from "next/link";
import { MAGIC_LINK_TTL_MIN } from "@/shared/auth";

// Where Better Auth sends a rejected sign-in link. The rejection itself is logged where it
// happens (auth.link.invalid in handleAuthRequest); this page only explains.
export default function SignInErrorPage() {
  return (
    <main style={{ maxWidth: "24rem", margin: "0 auto" }}>
      <h1>That link no longer works</h1>
      <p>Sign-in links work once and expire after {MAGIC_LINK_TTL_MIN} minutes.</p>
      <p>
        <Link href="/sign-in">Get a new link</Link>
      </p>
    </main>
  );
}
