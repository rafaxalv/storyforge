import Link from "next/link";
import { getOutline, type Outline, type OutlineChapter } from "@/server/books/structure";
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

export const metadata = { title: "Chapters · storyforge" };

const KIND_LABEL = {
  prologue: "Prologue",
  epilogue: "Epilogue",
  interlude: "Interlude",
  chapter: "",
};

type Titles = Record<string, string>;

function titleOf(titles: Titles, languages: Language[]): string {
  const first = languages.find((l) => l.writtenFirst)?.code;
  return (first && titles[first]) || Object.values(titles)[0] || "Untitled";
}

function OtherTitles({ titles, languages }: { titles: Titles; languages: Language[] }) {
  const others = languages.filter((l) => !l.writtenFirst && titles[l.code]);
  return (
    <>
      {others.map((l) => (
        <div key={l.code} className="c-alt" lang={l.code.toLowerCase()}>
          <span className="pid">{l.code}</span>
          {titles[l.code]}
        </div>
      ))}
    </>
  );
}

/**
 * The Chapters tab, laid out like the Manuscript Desk: parts as sections, one cell per
 * chapter; selecting a cell (`?sel=<id>` or `?sel=part:<id>`) puts its settings in the left
 * panel. With nothing selected the panel adds chapters and parts.
 */
export default async function ChaptersPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string }>;
  searchParams: Promise<{ sel?: string; panel?: string }>;
}) {
  const { bookId } = await params;
  const { sel, panel } = await searchParams;
  const outline = await loadOr404((actor) => getOutline(actor, bookId));
  const { languages } = outline;
  const href = (selection?: string) => {
    const q = new URLSearchParams();
    if (selection) q.set("sel", selection);
    if (panel) q.set("panel", panel);
    const s = q.toString();
    return s ? `/books/${bookId}?${s}` : `/books/${bookId}`;
  };
  const parts = outline.parts.map((p) => ({ id: p.id, title: titleOf(p.titles, languages) }));
  const allChapters = [...outline.parts.flatMap((p) => p.chapters), ...outline.unparted];
  const selChapter = allChapters.find((c) => c.id === sel);
  const selPart = sel?.startsWith("part:")
    ? outline.parts.find((p) => `part:${p.id}` === sel)
    : undefined;
  const empty = allChapters.length === 0 && outline.parts.length === 0;
  const removedCount = outline.removedParts.length + outline.removedChapters.length;

  const chapterCells = (chapters: OutlineChapter[], label: string) =>
    chapters.length === 0 ? (
      <p className="p-empty">No chapters here yet.</p>
    ) : (
      <ol className="plain-list cells" aria-label={label}>
        {chapters.map((c, i) => {
          const kind = KIND_LABEL[chapterKind(c.code)];
          const selected = c.id === selChapter?.id;
          return (
            <li
              key={c.id}
              className={selected ? "cell sel" : "cell"}
              data-testid={`chapter-${c.code}`}
            >
              <div className="c-head">
                <span className="pid">{c.code}</span>
                {kind && <span className="chip">{kind}</span>}
                <span className="c-tools">
                  <MoveButtons
                    bookId={bookId}
                    kind="chapter"
                    id={c.id}
                    name={`chapter ${c.code}`}
                    first={i === 0}
                    last={i === chapters.length - 1}
                  />
                  <ItemButton
                    bookId={bookId}
                    op="chapter.remove"
                    id={c.id}
                    label={`Remove chapter ${c.code}`}
                  >
                    Remove
                  </ItemButton>
                </span>
              </div>
              <Link
                href={selected ? href() : href(c.id)}
                className="c-title"
                aria-current={selected ? "true" : undefined}
                scroll={false}
              >
                {titleOf(c.titles, languages)}
              </Link>
              <OtherTitles titles={c.titles} languages={languages} />
            </li>
          );
        })}
      </ol>
    );

  return (
    <div className="desk">
      <aside className="panel" aria-labelledby="chapters-panel-title">
        <Panel
          bookId={bookId}
          outline={outline}
          parts={parts}
          selChapter={selChapter}
          selPart={selPart}
          doneHref={href()}
        />
      </aside>

      <main className="main">
        <div className="page">
          <div className="eyebrow">Chapters</div>
          <h1>Outline</h1>
          <div className="meta">
            <span>
              {outline.parts.length} {outline.parts.length === 1 ? "part" : "parts"}
            </span>
            <span>
              {allChapters.length} {allChapters.length === 1 ? "chapter" : "chapters"}
            </span>
            <span>Languages: {languages.map((l) => l.code).join(", ")}</span>
          </div>

          {empty && (
            <p className="notice" id="empty-outline" style={{ marginTop: 16 }}>
              This book has no chapters yet. Add the first chapter in the panel, or start with a
              part.
            </p>
          )}

          {outline.parts.map((p, i) => {
            const title = titleOf(p.titles, languages);
            const selected = selPart?.id === p.id;
            return (
              <section
                key={p.id}
                className="plan-sec"
                aria-labelledby={`part-title-${p.id}`}
                data-testid="part"
              >
                <header>
                  <h2 id={`part-title-${p.id}`}>
                    <Link
                      href={selected ? href() : href(`part:${p.id}`)}
                      scroll={false}
                      style={{
                        color: selected ? "var(--accent)" : "inherit",
                        textDecoration: "none",
                      }}
                    >
                      {title}
                    </Link>
                    <span className="count">{p.chapters.length}</span>
                  </h2>
                  <span className="sec-tools c-tools">
                    <MoveButtons
                      bookId={bookId}
                      kind="part"
                      id={p.id}
                      name={`part ${title}`}
                      first={i === 0}
                      last={i === outline.parts.length - 1}
                    />
                    <ItemButton
                      bookId={bookId}
                      op="part.remove"
                      id={p.id}
                      label={`Remove part ${title}`}
                    >
                      Remove part
                    </ItemButton>
                  </span>
                </header>
                <OtherTitles titles={p.titles} languages={languages} />
                {chapterCells(p.chapters, `Chapters of ${title}`)}
              </section>
            );
          })}

          {(outline.unparted.length > 0 || outline.parts.length > 0) && (
            <section className="plan-sec" aria-labelledby="no-part-title" data-testid="no-part">
              <header>
                <h2 id="no-part-title">
                  {outline.parts.length > 0 ? "No part" : "Chapters"}
                  <span className="count">{outline.unparted.length}</span>
                </h2>
              </header>
              {chapterCells(outline.unparted, "Chapters with no part")}
            </section>
          )}

          {removedCount > 0 && (
            <details className="plan-sec" data-testid="removed">
              <summary>Removed ({removedCount})</summary>
              <ul className="plain-list cells">
                {outline.removedParts.map((p) => (
                  <li key={p.id} className="cell removed">
                    <div className="c-head">
                      <span className="chip">Part</span>
                      <span className="c-tools">
                        <ItemButton
                          bookId={bookId}
                          op="part.restore"
                          id={p.id}
                          label={`Restore part ${titleOf(p.titles, languages)}`}
                        >
                          Restore
                        </ItemButton>
                      </span>
                    </div>
                    <span className="c-title">{titleOf(p.titles, languages)}</span>
                  </li>
                ))}
                {outline.removedChapters.map((c) => (
                  <li key={c.id} className="cell removed" data-testid={`removed-${c.code}`}>
                    <div className="c-head">
                      <span className="pid">{c.code}</span>
                      <span className="c-tools">
                        <ItemButton
                          bookId={bookId}
                          op="chapter.restore"
                          id={c.id}
                          label={`Restore chapter ${c.code}`}
                        >
                          Restore
                        </ItemButton>
                      </span>
                    </div>
                    <span className="c-title">{titleOf(c.titles, languages)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </main>
    </div>
  );
}

/** The left panel: the selected chapter's or part's settings, or the add forms. */
function Panel({
  bookId,
  outline,
  parts,
  selChapter,
  selPart,
  doneHref,
}: {
  bookId: string;
  outline: Outline;
  parts: { id: string; title: string }[];
  selChapter?: OutlineChapter;
  selPart?: { id: string; titles: Titles };
  doneHref: string;
}) {
  const { languages } = outline;
  if (selChapter) {
    return (
      <>
        <div className="p-head">
          <h2 id="chapters-panel-title">Chapter</h2>
          <span className="pid">{selChapter.code}</span>
        </div>
        <ChapterForm
          key={selChapter.id}
          bookId={bookId}
          languages={languages}
          chapter={{ id: selChapter.id, titles: selChapter.titles }}
        />
        {parts.length > 0 && (
          <div className="field">
            <span>Part</span>
            <MoveToPartForm
              bookId={bookId}
              chapterId={selChapter.id}
              code={selChapter.code}
              currentPartId={selChapter.partId}
              parts={parts}
            />
          </div>
        )}
        <p className="hint" style={{ marginTop: 12 }}>
          The code {selChapter.code} never changes; moving the chapter only changes its place.
        </p>
        <hr className="p-sep" />
        <Link href={doneHref} scroll={false} className="btn">
          Done
        </Link>
      </>
    );
  }
  if (selPart) {
    return (
      <>
        <div className="p-head">
          <h2 id="chapters-panel-title">Part</h2>
        </div>
        <PartForm key={selPart.id} bookId={bookId} languages={languages} part={selPart} />
        <hr className="p-sep" />
        <Link href={doneHref} scroll={false} className="btn">
          Done
        </Link>
      </>
    );
  }
  return (
    <>
      <div className="p-head">
        <h2 id="chapters-panel-title">Add a chapter</h2>
      </div>
      <ChapterForm
        bookId={bookId}
        languages={languages}
        parts={parts}
        suggestedCode={outline.suggestedCode}
      />
      <hr className="p-sep" />
      <div className="p-head">
        <h2>Add a part</h2>
      </div>
      <PartForm bookId={bookId} languages={languages} />
      <hr className="p-sep" />
      <p className="p-empty">Select a chapter or a part to rename it or move it.</p>
    </>
  );
}
