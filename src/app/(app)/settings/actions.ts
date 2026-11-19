"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { deleteAccount, updateDisplayName } from "@/server/account/account";
import { getActor } from "@/server/auth/actor";

export interface FormState {
  ok?: boolean;
  error?: string;
}

/** Settings form: rename yourself. */
export async function updateNameAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await getActor(new Headers(await headers()), "settings.updateName");
  try {
    await updateDisplayName(actor, actor.userId, form.get("name"));
  } catch (err) {
    if (err instanceof ZodError) return { error: err.issues[0]?.message ?? "Invalid name" };
    throw err;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

const DELETE_MESSAGES = {
  confirmation: "Type DELETE to confirm.",
  "stale-session": "For safety, sign out and sign in again, then delete your account.",
  unauthenticated: "You are not signed in.",
} as const;

/** Delete-account dialog. On success the session is gone; show the goodbye page. */
export async function deleteAccountAction(_prev: FormState, form: FormData): Promise<FormState> {
  const result = await deleteAccount(new Headers(await headers()), form.get("confirmation"));
  if (!result.ok) return { error: DELETE_MESSAGES[result.reason] };
  redirect("/goodbye");
}
