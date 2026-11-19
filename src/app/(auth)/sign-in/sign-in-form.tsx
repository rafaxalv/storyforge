"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { authClient } from "@/client/auth-client";

const Email = z.email();

/**
 * Requests a magic link through Better Auth's HTTP endpoint (so its rate limit applies),
 * then shows "check your email". Google goes through Better Auth's OAuth redirect.
 */
export function SignInForm({ next, googleEnabled }: { next: string; googleEnabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!Email.safeParse(email).success) {
      setError("Enter a valid email address.");
      return;
    }
    setPending(true);
    const { error: apiError } = await authClient.signIn.magicLink({
      email,
      callbackURL: next,
      newUserCallbackURL: next,
      errorCallbackURL: "/sign-in/error",
    });
    setPending(false);
    if (apiError) {
      setError(
        apiError.status === 429
          ? "Too many sign-in requests. Wait a few minutes and try again."
          : "Could not send the link. Try again.",
      );
      return;
    }
    router.push("/sign-in/check-email");
  }

  return (
    <>
      <form onSubmit={onSubmit} noValidate>
        <label>
          Email{" "}
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-describedby="sign-in-msg"
          />
        </label>{" "}
        <button type="submit" disabled={pending}>
          Email me a sign-in link
        </button>
        <p id="sign-in-msg" role="alert">
          {error}
        </p>
      </form>
      {googleEnabled && (
        <button
          type="button"
          onClick={() => void authClient.signIn.social({ provider: "google", callbackURL: next })}
        >
          Continue with Google
        </button>
      )}
    </>
  );
}
