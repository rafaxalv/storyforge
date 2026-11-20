import { SiteFrame } from "../../top-bar";
import { NewBookForm } from "../forms";

export const metadata = { title: "New book · storyforge" };

export default function NewBookPage() {
  return (
    <SiteFrame>
      <div className="eyebrow">Your books</div>
      <h1>New book</h1>
      <div className="card" style={{ maxWidth: 560 }}>
        <NewBookForm />
      </div>
    </SiteFrame>
  );
}
