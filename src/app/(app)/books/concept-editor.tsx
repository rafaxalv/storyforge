"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { LazyEditor } from "@/client/lazy-editor";
import { plainText, type RichDoc } from "@/shared/rich-text";
import { loadConceptAction, saveConceptAction } from "./actions";

const AUTOSAVE_MS = 1_000;

/**
 * The last Concept save sent from this tab. An editor that leaves the screen sends its final
 * save while the next one (the panel → the Concept page) is already loading; the newcomer
 * waits for that save and catches up to its version instead of starting from an older one.
 */
let lastSave: Promise<unknown> = Promise.resolve();

export interface Heading {
  level: number;
  text: string;
}

/** The document's headings in order, for the panel's "jump to" list. */
export function headingsOf(doc: RichDoc): Heading[] {
  return doc.content
    .filter((n) => n.type === "heading")
    .map((n) => ({ level: n.attrs?.level ?? 1, text: plainText(n).trim() }))
    .filter((h) => h.text);
}
let savesInFlight = 0;

type Status = "saved" | "dirty" | "saving" | "error" | "conflict";

const STATUS_TEXT: Record<Status, string> = {
  saved: "Saved",
  dirty: "Unsaved changes",
  saving: "Saving…",
  error: "Could not save. Keep typing to retry.",
  conflict: "Changed elsewhere. Reload to see the latest version; your text stays here until then.",
};

/**
 * The Concept editor with autosave: saves about a second after typing stops, one save at a
 * time (later edits follow with the newest text), and once more when the page is hidden or
 * left. A save from an older version is refused by the server; then autosave stops and
 * the author's text stays on screen.
 */
export function ConceptEditor({
  bookId,
  initial,
  version: initialVersion,
  idPrefix = "concept",
  onHeadings,
}: {
  bookId: string;
  initial: RichDoc;
  version: number;
  idPrefix?: string;
  /** Called with the document's headings whenever they change (the Concept page's panel). */
  onHeadings?: (headings: Heading[]) => void;
}) {
  const [status, setStatus] = useState<Status>("saved");
  const version = useRef(initialVersion);
  const latest = useRef<RichDoc>(initial);
  const edits = useRef(0); // bumps on every change
  const savedEdits = useRef(0); // edits covered by the last successful save
  const inFlight = useRef(false);
  const stopped = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const editor = useRef<Editor | null>(null);

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    if (stopped.current || inFlight.current || edits.current === savedEdits.current) return;
    inFlight.current = true;
    const sending = edits.current;
    let failed = false;
    setStatus("saving");
    savesInFlight += 1;
    try {
      const pending = saveConceptAction(bookId, latest.current, version.current);
      lastSave = pending.catch(() => undefined);
      const result = await pending;
      if (result.conflict) {
        stopped.current = true;
        setStatus("conflict");
        return;
      }
      if (result.error || result.version === undefined) {
        failed = true;
        setStatus("error");
        return;
      }
      version.current = result.version;
      savedEdits.current = sending;
      setStatus(edits.current === sending ? "saved" : "dirty");
    } catch {
      failed = true;
      setStatus("error");
    } finally {
      inFlight.current = false;
      savesInFlight -= 1;
    }
    // Edits made while this save was in flight follow it. After a failure, the next edit
    // (not a timer) tries again, so a lasting error doesn't resend every second.
    if (!failed && !stopped.current && edits.current !== savedEdits.current)
      timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }, [bookId]);

  const onChange = useCallback(
    (doc: RichDoc) => {
      if (stopped.current) return;
      latest.current = doc;
      onHeadings?.(headingsOf(doc));
      edits.current += 1;
      setStatus("dirty");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
    },
    [save, onHeadings],
  );

  // Catch up with a save another editor of this tab sent just before this one mounted.
  const onReady = useCallback(
    (e: Editor) => {
      editor.current = e;
      if (savesInFlight === 0) return;
      void lastSave
        .then(() => loadConceptAction(bookId))
        .then((r) => {
          if (!r.body || r.version === undefined || r.version <= version.current) return;
          if (edits.current !== 0) return; // the author already typed here; keep their text
          version.current = r.version;
          latest.current = r.body;
          editor.current?.commands.setContent(r.body, { emitUpdate: false });
          onHeadings?.(headingsOf(r.body));
        });
    },
    [bookId, onHeadings],
  );

  useEffect(() => {
    const flush = () => void save();
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (edits.current !== savedEdits.current && !stopped.current) {
        flush();
        e.preventDefault();
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      flush(); // leaving the page inside the app
    };
  }, [save]);

  return (
    <div>
      <div className="row" style={{ minHeight: 30 }}>
        <p
          id={`${idPrefix}-status`}
          role="status"
          style={{ margin: 0 }}
          className={status === "conflict" || status === "error" ? "notice" : "muted small ui"}
        >
          {STATUS_TEXT[status]}
        </p>
        {status === "conflict" && (
          <>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(plainText(latest.current))}
            >
              Copy my text
            </button>
            <button type="button" onClick={() => window.location.reload()}>
              Reload
            </button>
          </>
        )}
      </div>
      <LazyEditor
        initial={initial}
        label="Concept"
        onChange={onChange}
        onReady={onReady}
        minHeight="16rem"
      />
    </div>
  );
}

/** href of the current page with the Concept panel opened or closed. */
function usePanelHref(open: boolean): string {
  const pathname = usePathname();
  const params = new URLSearchParams(useSearchParams().toString());
  if (open) params.set("panel", "concept");
  else params.delete("panel");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function ConceptPanelToggle() {
  const open = useSearchParams().get("panel") === "concept";
  const href = usePanelHref(!open);
  return (
    <Link
      href={href}
      scroll={false}
      className="btn"
      aria-controls="concept-panel"
      aria-expanded={open}
      aria-label={open ? "Close Concept panel" : "Open Concept beside"}
    >
      {open ? "Concept ›" : "‹ Concept"}
    </Link>
  );
}

/** The Concept in a side panel, open while the URL has `?panel=concept`. */
export function ConceptPanel({ bookId }: { bookId: string }) {
  const pathname = usePathname();
  const open = useSearchParams().get("panel") === "concept" && !pathname.endsWith("/concept");
  const closeHref = usePanelHref(false);
  const [loaded, setLoaded] = useState<
    { body: RichDoc; version: number } | { error: string } | null
  >(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!open) {
      setLoaded(null);
      return;
    }
    let live = true;
    void loadConceptAction(bookId).then((r) => {
      if (!live) return;
      setLoaded(
        r.body && r.version !== undefined
          ? { body: r.body, version: r.version }
          : { error: r.error ?? "Could not load the Concept." },
      );
    });
    return () => {
      live = false;
    };
  }, [open, bookId]);

  useEffect(() => {
    if (open && window.matchMedia("(max-width: 900px)").matches) heading.current?.focus();
  }, [open]);

  if (!open) return null;
  return (
    <aside id="concept-panel" className="concept-panel" aria-labelledby="concept-panel-title">
      <div className="p-head">
        <h2 id="concept-panel-title" ref={heading} tabIndex={-1}>
          Concept
        </h2>
        <Link href={closeHref} scroll={false} className="iconbtn" aria-label="Close">
          ›
        </Link>
      </div>
      {!loaded && <p className="p-empty">Loading…</p>}
      {loaded && "error" in loaded && <p className="error">{loaded.error}</p>}
      {loaded && "body" in loaded && (
        <div className="doc">
          <ConceptEditor
            bookId={bookId}
            initial={loaded.body}
            version={loaded.version}
            idPrefix="panel"
          />
        </div>
      )}
    </aside>
  );
}

/**
 * The Concept tab, as the Desk lays out a document: its headings in the left panel to jump
 * to, the text in the document column.
 */
export function ConceptDesk({
  bookId,
  initial,
  version,
}: {
  bookId: string;
  initial: RichDoc;
  version: number;
}) {
  const [headings, setHeadings] = useState<Heading[]>(() => headingsOf(initial));
  const jump = (i: number) => {
    const el = document.querySelectorAll(".doc .tiptap h1, .doc .tiptap h2, .doc .tiptap h3")[i];
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="desk">
      <aside className="panel" aria-labelledby="concept-headings-title">
        <div className="p-head">
          <h2 id="concept-headings-title">Concept</h2>
        </div>
        {headings.length === 0 ? (
          <p className="p-empty">Headings in the Concept appear here, to jump to.</p>
        ) : (
          <ul className="p-nav" aria-label="Headings">
            {headings.map((h, i) => (
              <li key={`${i}-${h.text}`}>
                <a
                  href="#"
                  className={`h${h.level}`}
                  onClick={(e) => {
                    e.preventDefault();
                    jump(i);
                  }}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <main className="main">
        <div className="doc">
          <div className="eyebrow">Concept</div>
          <ConceptEditor
            bookId={bookId}
            initial={initial}
            version={version}
            onHeadings={setHeadings}
          />
        </div>
      </main>
    </div>
  );
}
