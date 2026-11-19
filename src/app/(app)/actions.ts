"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/server/auth/auth";
import { getOptionalActor } from "@/server/auth/actor";
import { log } from "@/server/log";

/** Ends the session on the server and clears the cookie (via Better Auth's nextCookies). */
export async function signOutAction(): Promise<void> {
  const h = new Headers(await headers());
  const actor = await getOptionalActor(h);
  if (actor) {
    await getAuth().api.signOut({ headers: h });
    log("auth").info({ event: "auth.sign_out", userId: actor.userId }, "signed out");
  }
  redirect("/sign-in");
}
