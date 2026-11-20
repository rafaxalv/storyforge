import { getConcept } from "@/server/books/concept";
import { loadOr404 } from "../../book-data";
import { ConceptDesk } from "../../concept-editor";

export const metadata = { title: "Concept · storyforge" };

export default async function ConceptPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const concept = await loadOr404((actor) => getConcept(actor, bookId));
  return <ConceptDesk bookId={bookId} initial={concept.body} version={concept.version} />;
}
