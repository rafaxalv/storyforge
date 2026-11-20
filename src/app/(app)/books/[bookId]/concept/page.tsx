import { getConcept } from "@/server/books/concept";
import { loadOr404 } from "../../book-data";
import { ConceptEditor } from "../../concept-editor";

export const metadata = { title: "Concept · storyforge" };

export default async function ConceptPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const concept = await loadOr404((actor) => getConcept(actor, bookId));
  return (
    <main className="content">
      <h2 className="visually-hidden">Concept</h2>
      <ConceptEditor bookId={bookId} initial={concept.body} version={concept.version} />
    </main>
  );
}
