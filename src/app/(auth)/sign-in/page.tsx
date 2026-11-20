import { redirect } from "next/navigation";
import { getOptionalActor } from "@/server/auth/actor";
import { googleEnabled } from "@/server/auth/auth";
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
    <main className="narrow">
      <h1>Sign in to storyforge</h1>
      <SignInForm next={next} googleEnabled={googleEnabled(env)} />
    </main>
  );
}
