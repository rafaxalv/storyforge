import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main style={{ maxWidth: "24rem", margin: "0 auto" }}>
      <h1>Check your email</h1>
      <p>
        We sent you a sign-in link. It works once and expires in 15 minutes. You can close this tab.
      </p>
      <p>
        <Link href="/sign-in">Use a different address</Link>
      </p>
    </main>
  );
}
