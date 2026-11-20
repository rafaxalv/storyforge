import Link from "next/link";
import { requirePageActor } from "@/server/auth/page-actor";
import { listBooks } from "@/server/books/books";
import { SiteFrame } from "./top-bar";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export default async function HomePage() {
  const actor = await requirePageActor();
  const books = await listBooks(actor);
  return (
    <SiteFrame>
      <div className="row">
        <div style={{ marginRight: "auto" }}>
          <div className="eyebrow">Your books</div>
          <h1>Books</h1>
        </div>
        <Link href="/books/new" className="btn primary">
          New book
        </Link>
      </div>
      {books.length === 0 ? (
        <p className="p-empty">
          No books yet. <Link href="/books/new">Create your first book</Link>.
        </p>
      ) : (
        <ul className="plain-list book-list" aria-label="Books">
          {books.map((b) => (
            <li key={b.id} className="cell">
              <Link href={`/books/${b.id}`} className="c-title">
                {b.title}
              </Link>
              {b.oneLiner && <div className="c-alt">{b.oneLiner}</div>}
              <div className="meta">Changed {dateFormat.format(b.updatedAt)}</div>
            </li>
          ))}
        </ul>
      )}
    </SiteFrame>
  );
}
