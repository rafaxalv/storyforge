import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { PATH_HEADER } from "@/shared/headers";
import { signInPath } from "@/shared/auth";
import { safeNext } from "@/shared/safe-next";
import { getOptionalActor, type Actor } from "./actor";

/** The current request's actor, looked up once per request however many components ask. */
export const currentActor = cache((): Promise<Actor | null> => getOptionalActor());

/**
 * For server components in the (app) area: the signed-in actor, or a redirect to sign-in
 * that keeps the requested page (the middleware passes it in PATH_HEADER). Reaching the
 * redirect means a cookie got past the middleware but its session is gone.
 */
export async function requirePageActor(): Promise<Actor> {
  const actor = await currentActor();
  if (actor) return actor;
  redirect(signInPath(safeNext((await headers()).get(PATH_HEADER))));
}
