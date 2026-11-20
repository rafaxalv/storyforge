import { requirePageActor } from "@/server/auth/page-actor";
import { SiteFrame } from "../top-bar";
import { DeleteAccountForm, NameForm } from "./forms";

export default async function SettingsPage() {
  const actor = await requirePageActor();
  return (
    <SiteFrame>
      <div className="eyebrow">Account</div>
      <h1>Settings</h1>
      <section className="plan-sec">
        <header>
          <h2>Your name</h2>
        </header>
        <div className="card">
          <NameForm current={actor.name} />
        </div>
      </section>
      <section className="plan-sec">
        <header>
          <h2>Delete account</h2>
        </header>
        <div className="card stack">
          <p style={{ margin: 0 }}>
            This deletes your account and everything storyforge holds for you. It cannot be undone.
            Signed in as {actor.email}.
          </p>
          <DeleteAccountForm />
        </div>
      </section>
    </SiteFrame>
  );
}
