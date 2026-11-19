import Link from "next/link";

export default function GoodbyePage() {
  return (
    <main style={{ maxWidth: "24rem", margin: "0 auto" }}>
      <h1>Your account is deleted</h1>
      <p>Everything storyforge held for you is being removed. Thank you for writing with us.</p>
      <p>
        <Link href="/sign-in">Sign in again</Link> creates a new, empty account.
      </p>
    </main>
  );
}
