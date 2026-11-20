import Link from "next/link";
import { requirePageActor } from "@/server/auth/page-actor";
import { listBooks } from "@/server/books/books";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export default async function HomePage() {
  const actor = await requirePageActor();
  const books = await listBooks(actor);
  return (
    <main className="content">
      <div className="row">
        <h1 style={{ marginRight: "auto" }}>Your books</h1>
        <Link href="/books/new" className="ui">
          New book
        </Link>
      </div>
      {books.length === 0 ? (
        <p className="muted">
          No books yet. <Link href="/books/new">Create your first book</Link>.
        </p>
      ) : (
        <ul className="plain-list book-list" aria-label="Books">
          {books.map((b) => (
            <li key={b.id}>
              <Link href={`/books/${b.id}`}>{b.title}</Link>
              {b.oneLiner && <div>{b.oneLiner}</div>}
              <div className="muted small ui">Changed {dateFormat.format(b.updatedAt)}</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
