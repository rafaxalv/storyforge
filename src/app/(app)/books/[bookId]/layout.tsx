import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { TopBar } from "../../top-bar";
import { bookHeader } from "../book-data";
import { BookNav } from "../book-nav";
import { ConceptPanel } from "../concept-editor";

/** A book's pages: the Desk's top bar (title, tabs), the page, and the Concept panel on the right. */
export default async function BookLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const book = await bookHeader(bookId);
  return (
    <>
      <TopBar
        brand={
          <Link href={`/books/${book.id}`} className="book">
            {`Book: ${book.title}`}
          </Link>
        }
        sub={<Link href="/">Your books</Link>}
      >
        <BookNav bookId={book.id} />
      </TopBar>
      <div className="book-body">
        <div className="book-page">{children}</div>
        <Suspense fallback={null}>
          <ConceptPanel bookId={book.id} />
        </Suspense>
      </div>
    </>
  );
}
