"use client";

import { useActionState } from "react";
import { deleteAccountAction, updateNameAction, type FormState } from "./actions";

export function NameForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateNameAction, {});
  return (
    <form action={action}>
      <label>
        Display name{" "}
        <input
          name="name"
          defaultValue={current}
          maxLength={80}
          required
          aria-describedby="name-msg"
        />
      </label>{" "}
      <button type="submit" disabled={pending}>
        Save
      </button>
      <p id="name-msg" role="status">
        {state.error ?? (state.ok ? "Saved." : "")}
      </p>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(deleteAccountAction, {});
  return (
    <form action={action}>
      <label>
        Type <strong>DELETE</strong> to confirm{" "}
        <input name="confirmation" autoComplete="off" aria-describedby="delete-msg" />
      </label>{" "}
      <button type="submit" disabled={pending}>
        Delete my account
      </button>
      <p id="delete-msg" role="alert">
        {state.error ?? ""}
      </p>
    </form>
  );
}
