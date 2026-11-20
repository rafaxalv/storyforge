import { NewBookForm } from "../forms";

export const metadata = { title: "New book · storyforge" };

export default function NewBookPage() {
  return (
    <main className="content">
      <h1>New book</h1>
      <NewBookForm />
    </main>
  );
}
