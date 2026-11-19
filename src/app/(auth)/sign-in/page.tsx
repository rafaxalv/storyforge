import { redirect } from "next/navigation";
import { getOptionalActor } from "@/server/auth/actor";
import { getEnv } from "@/server/env";
import { safeNext } from "@/shared/safe-next";
import { SignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  if (await getOptionalActor()) redirect(next);
  const env = getEnv();
  return (
    <main style={{ maxWidth: "24rem", margin: "0 auto" }}>
      <h1>Sign in to storyforge</h1>
      <SignInForm
        next={next}
        googleEnabled={Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)}
      />
    </main>
  );
}
