import { getOutline, type OutlineChapter } from "@/server/books/structure";
import { chapterKind } from "@/shared/id-scheme";
import { loadOr404 } from "../book-data";
import {
  ChapterForm,
  ItemButton,
  MoveButtons,
  MoveToPartForm,
  PartForm,
  type Language,
} from "../forms";

export const metadata = { title: "Outline · storyforge" };

const KIND_LABEL = {
  prologue: "Prologue",
  epilogue: "Epilogue",
  interlude: "Interlude",
  chapter: "",
};

function titleOf(titles: Record<string, string>, languages: Language[]): string {
  const first = languages.find((l) => l.writtenFirst)?.code;
  return (first && titles[first]) || Object.values(titles)[0] || "Untitled";
}

function OtherTitles({
  titles,
  languages,
}: {
  titles: Record<string, string>;
  languages: Language[];
}) {
  const others = languages.filter((l) => !l.writtenFirst && titles[l.code]);
  if (others.length === 0) return null;
  return (
    <span className="muted small">
      {others.map((l) => (
        <span key={l.code} lang={l.code.toLowerCase()}>
          {" · "}
          {l.code}: {titles[l.code]}
        </span>
      ))}
    </span>
  );
}

function ChapterRow({
  bookId,
  chapter,
  languages,
  parts,
  first,
  last,
}: {
  bookId: string;
  chapter: OutlineChapter;
  languages: Language[];
  parts: { id: string; title: string }[];
  first: boolean;
  last: boolean;
}) {
  const kind = KIND_LABEL[chapterKind(chapter.code)];
  return (
    <li data-testid={`chapter-${chapter.code}`}>
      <div className="chapter-row">
        <span className="chapter-code">{chapter.code}</span>
        <span>
          {titleOf(chapter.titles, languages)}
          {kind && <span className="muted small ui"> ({kind})</span>}
          <OtherTitles titles={chapter.titles} languages={languages} />
        </span>
        <span className="chapter-controls">
          <MoveButtons
            bookId={bookId}
            kind="chapter"
            id={chapter.id}
            name={`chapter ${chapter.code}`}
            first={first}
            last={last}
          />
          {parts.length > 0 && (
            <MoveToPartForm
              bookId={bookId}
              chapterId={chapter.id}
              code={chapter.code}
              currentPartId={chapter.partId}
              parts={parts}
            />
          )}
          <ItemButton
            bookId={bookId}
            op="chapter.remove"
            id={chapter.id}
            label={`Remove chapter ${chapter.code}`}
          >
            Remove
          </ItemButton>
        </span>
      </div>
      <details>
        <summary className="small">Rename {chapter.code}</summary>
        <ChapterForm
          bookId={bookId}
          languages={languages}
          chapter={{ id: chapter.id, titles: chapter.titles }}
        />
      </details>
    </li>
  );
}

function ChapterList(props: {
  bookId: string;
  chapters: OutlineChapter[];
  languages: Language[];
  parts: { id: string; title: string }[];
  label: string;
}) {
  if (props.chapters.length === 0) return <p className="muted small">No chapters here yet.</p>;
  return (
    <ol className="plain-list" aria-label={props.label}>
      {props.chapters.map((c, i) => (
        <ChapterRow
          key={c.id}
          bookId={props.bookId}
          chapter={c}
          languages={props.languages}
          parts={props.parts}
          first={i === 0}
          last={i === props.chapters.length - 1}
        />
      ))}
    </ol>
  );
}

export default async function OutlinePage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const outline = await loadOr404((actor) => getOutline(actor, bookId));
  const { languages } = outline;
  const parts = outline.parts.map((p) => ({ id: p.id, title: titleOf(p.titles, languages) }));
  const empty = outline.parts.length === 0 && outline.unparted.length === 0;
  const removedCount = outline.removedParts.length + outline.removedChapters.length;

  return (
    <main>
      <h2 className="visually-hidden">Outline</h2>
      {empty && (
        <p className="card" id="empty-outline">
          This book has no chapters yet. Add the first chapter below, or start with a part.
        </p>
      )}

      {outline.parts.map((p, i) => (
        <section
          key={p.id}
          className="outline-part"
          aria-labelledby={`part-title-${p.id}`}
          data-testid="part"
        >
          <header>
            <h3 id={`part-title-${p.id}`}>
              {titleOf(p.titles, languages)} <OtherTitles titles={p.titles} languages={languages} />
            </h3>
            <span className="chapter-controls">
              <MoveButtons
                bookId={bookId}
                kind="part"
                id={p.id}
                name={`part ${titleOf(p.titles, languages)}`}
                first={i === 0}
                last={i === outline.parts.length - 1}
              />
              <ItemButton
                bookId={bookId}
                op="part.remove"
                id={p.id}
                label={`Remove part ${titleOf(p.titles, languages)}`}
              >
                Remove part
              </ItemButton>
            </span>
          </header>
          <details>
            <summary className="small">Rename part</summary>
            <PartForm bookId={bookId} languages={languages} part={{ id: p.id, titles: p.titles }} />
          </details>
          <ChapterList
            bookId={bookId}
            chapters={p.chapters}
            languages={languages}
            parts={parts}
            label={`Chapters of ${titleOf(p.titles, languages)}`}
          />
        </section>
      ))}

      {(outline.unparted.length > 0 || outline.parts.length > 0) && (
        <section className="outline-part" aria-labelledby="no-part-title" data-testid="no-part">
          <header>
            <h3 id="no-part-title">{outline.parts.length > 0 ? "No part" : "Chapters"}</h3>
          </header>
          <ChapterList
            bookId={bookId}
            chapters={outline.unparted}
            languages={languages}
            parts={parts}
            label="Chapters with no part"
          />
        </section>
      )}

      <div className="row" style={{ alignItems: "flex-start", gap: "2rem", marginTop: "2rem" }}>
        <section className="card" aria-labelledby="add-chapter-title" style={{ flex: "1 1 18rem" }}>
          <h3 id="add-chapter-title">Add a chapter</h3>
          <ChapterForm
            bookId={bookId}
            languages={languages}
            parts={parts}
            suggestedCode={outline.suggestedCode}
          />
        </section>
        <section className="card" aria-labelledby="add-part-title" style={{ flex: "1 1 18rem" }}>
          <h3 id="add-part-title">Add a part</h3>
          <PartForm bookId={bookId} languages={languages} />
        </section>
      </div>

      {removedCount > 0 && (
        <details style={{ marginTop: "2rem" }} data-testid="removed">
          <summary>Removed ({removedCount})</summary>
          <ul className="plain-list">
            {outline.removedParts.map((p) => (
              <li key={p.id} className="row">
                <span>Part: {titleOf(p.titles, languages)}</span>
                <ItemButton
                  bookId={bookId}
                  op="part.restore"
                  id={p.id}
                  label={`Restore part ${titleOf(p.titles, languages)}`}
                >
                  Restore
                </ItemButton>
              </li>
            ))}
            {outline.removedChapters.map((c) => (
              <li key={c.id} className="row" data-testid={`removed-${c.code}`}>
                <span className="chapter-code">{c.code}</span>
                <span>{titleOf(c.titles, languages)}</span>
                <ItemButton
                  bookId={bookId}
                  op="chapter.restore"
                  id={c.id}
                  label={`Restore chapter ${c.code}`}
                >
                  Restore
                </ItemButton>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
