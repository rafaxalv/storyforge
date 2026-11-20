"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LazyEditor } from "@/client/lazy-editor";
import { plainText, type RichDoc } from "@/shared/rich-text";
import { loadConceptAction, saveConceptAction } from "./actions";

const AUTOSAVE_MS = 1_000;

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
}: {
  bookId: string;
  initial: RichDoc;
  version: number;
  idPrefix?: string;
}) {
  const [status, setStatus] = useState<Status>("saved");
  const version = useRef(initialVersion);
  const latest = useRef<RichDoc>(initial);
  const edits = useRef(0); // bumps on every change
  const savedEdits = useRef(0); // edits covered by the last successful save
  const inFlight = useRef(false);
  const stopped = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    if (stopped.current || inFlight.current || edits.current === savedEdits.current) return;
    inFlight.current = true;
    const sending = edits.current;
    setStatus("saving");
    try {
      const result = await saveConceptAction(bookId, latest.current, version.current);
      if (result.conflict) {
        stopped.current = true;
        setStatus("conflict");
        return;
      }
      if (result.error || result.version === undefined) {
        setStatus("error");
        return;
      }
      version.current = result.version;
      savedEdits.current = sending;
      setStatus(edits.current === sending ? "saved" : "dirty");
    } catch {
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
    if (!stopped.current && edits.current !== savedEdits.current)
      timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }, [bookId]);

  const onChange = useCallback(
    (doc: RichDoc) => {
      if (stopped.current) return;
      latest.current = doc;
      edits.current += 1;
      setStatus("dirty");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
    },
    [save],
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
    <div className="stack">
      <LazyEditor initial={initial} label="Concept" onChange={onChange} minHeight="16rem" />
      <div className="row">
        <p
          id={`${idPrefix}-status`}
          role="status"
          className={
            status === "conflict" || status === "error" ? "error small ui" : "muted small ui"
          }
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
    <Link href={href} scroll={false} aria-controls="concept-panel" aria-expanded={open}>
      {open ? "Close Concept panel" : "Open Concept beside"}
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
    if (open && window.matchMedia("(max-width: 999px)").matches) heading.current?.focus();
  }, [open]);

  if (!open) return null;
  return (
    <aside id="concept-panel" className="concept-panel" aria-labelledby="concept-panel-title">
      <div className="row">
        <h2 id="concept-panel-title" ref={heading} tabIndex={-1} style={{ margin: 0 }}>
          Concept
        </h2>
        <Link href={closeHref} scroll={false} style={{ marginLeft: "auto" }} className="ui">
          Close
        </Link>
      </div>
      {!loaded && <p className="muted small">Loading…</p>}
      {loaded && "error" in loaded && <p className="error">{loaded.error}</p>}
      {loaded && "body" in loaded && (
        <ConceptEditor
          bookId={bookId}
          initial={loaded.body}
          version={loaded.version}
          idPrefix="panel"
        />
      )}
    </aside>
  );
}
