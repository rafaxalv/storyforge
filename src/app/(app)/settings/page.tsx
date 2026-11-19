import { requirePageActor } from "@/server/auth/page-actor";
import { DeleteAccountForm, NameForm } from "./forms";

export default async function SettingsPage() {
  const actor = await requirePageActor();
  return (
    <main>
      <h1>Settings</h1>
      <section>
        <h2>Your name</h2>
        <NameForm current={actor.name} />
      </section>
      <section style={{ marginTop: "3rem" }}>
        <h2>Delete account</h2>
        <p>
          This deletes your account and everything storyforge holds for you. It cannot be undone.
          Signed in as {actor.email}.
        </p>
        <DeleteAccountForm />
      </section>
    </main>
  );
}
