import type { ReactNode } from "react";
import { Suspense } from "react";
import { bookHeader } from "../book-data";
import { BookNav } from "../book-nav";
import { ConceptPanel } from "../concept-editor";

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
    <div className="book-layout">
      <div className="book-main">
        <h1 className="book-title">{book.title}</h1>
        <BookNav bookId={book.id} />
        {children}
      </div>
      <Suspense fallback={null}>
        <ConceptPanel bookId={book.id} />
      </Suspense>
    </div>
  );
}
