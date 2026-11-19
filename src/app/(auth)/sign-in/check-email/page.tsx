import Link from "next/link";
import { LINK_LIFETIME_NOTE } from "@/shared/auth";

export default function CheckEmailPage() {
  return (
    <main style={{ maxWidth: "24rem", margin: "0 auto" }}>
      <h1>Check your email</h1>
      <p>We sent you a sign-in link. {LINK_LIFETIME_NOTE} You can close this tab.</p>
      <p>
        <Link href="/sign-in">Use a different address</Link>
      </p>
    </main>
  );
}
