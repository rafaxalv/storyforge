"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { LazyEditor } from "@/client/lazy-editor";
import { CHAPTER_CODE_HINT, CHAPTER_CODE_PATTERN } from "@/shared/id-scheme";
import {
  LABEL_MAX,
  LANGUAGE_CODE_HINT,
  LANGUAGE_NAME_MAX,
  LIMITS,
  NOTES_MAX,
  ONE_LINER_MAX,
  TITLE_MAX,
  WORDS_MAX,
} from "@/shared/books";
import { emptyDoc, type RichDoc } from "@/shared/rich-text";
import type { ActionState } from "./action-result";
import {
  addLanguageAction,
  createBookAction,
  deleteBookAction,
  itemAction,
  renameLanguageAction,
  saveChapterAction,
  savePartAction,
  saveRuleAction,
  saveTruthLabelsAction,
  updateProfileAction,
} from "./actions";


export interface Language {
  id: string;
  code: string;
  name: string;
  writtenFirst: boolean;
}

function Message({ id, state, okText }: { id: string; state: ActionState; okText?: string }) {
  return (
    <p id={id} role="status" className={state.error ? "error small" : "ok small"}>
      {state.error ?? (state.ok && okText ? okText : "")}
    </p>
  );
}

const Hidden = ({ name, value }: { name: string; value: string | number }) => (
  <input type="hidden" name={name} value={value} />
);

// ------------------------------------------------------------------ item buttons

/**
 * A small form-backed button for one list item (move, remove, restore…). Works without
 * JavaScript; with it, focus comes back to the same button after the list re-renders
 * (or to `fallbackId` when the button became disabled at an edge).
 */
export function ItemButton({
  bookId,
  op,
  id,
  children,
  label,
  disabled,
  fallbackId,
  className,
  extra,
}: {
  bookId: string;
  op: string;
  id: string;
  children: ReactNode;
  label: string;
  disabled?: boolean;
  fallbackId?: string;
  className?: string;
  extra?: Record<string, string>;
}) {
  const [state, action] = useActionState<ActionState, FormData>(itemAction, {});
  const buttonId = `${op}-${id}`;
  const submitted = useRef(false);
  // Runs when the action's result arrives (a new state object), which commits together with
  // the refreshed list; moving a focused element in the DOM drops its focus.
  useEffect(() => {
    if (!submitted.current) return;
    submitted.current = false;
    const self = document.getElementById(buttonId);
    const usable = self instanceof HTMLButtonElement && !self.disabled;
    const target = usable ? self : fallbackId ? document.getElementById(fallbackId) : null;
    target?.focus();
  }, [state, buttonId, fallbackId]);
  return (
    <form action={action} onSubmit={() => (submitted.current = true)} className="inline-form">
      <Hidden name="bookId" value={bookId} />
      <Hidden name="op" value={op} />
      <Hidden name="id" value={id} />
      {Object.entries(extra ?? {}).map(([k, v]) => (
        <Hidden key={k} name={k} value={v} />
      ))}
      <button
        id={buttonId}
        type="submit"
        aria-label={label}
        title={label}
        disabled={disabled}
        className={className}
      >
        {children}
      </button>
      {state.error && (
        <span role="alert" className="error small">
          {" "}
          {state.error}
        </span>
      )}
    </form>
  );
}

/** Move up / Move down for one item of a list. */
export function MoveButtons({
  bookId,
  kind,
  id,
  name,
  first,
  last,
}: {
  bookId: string;
  kind: "language" | "rule" | "part" | "chapter";
  id: string;
  name: string;
  first: boolean;
  last: boolean;
}) {
  return (
    <>
      <ItemButton
        bookId={bookId}
        op={`${kind}.up`}
        id={id}
        label={`Move ${name} up`}
        disabled={first}
        fallbackId={`${kind}.down-${id}`}
      >
        ↑
      </ItemButton>
      <ItemButton
        bookId={bookId}
        op={`${kind}.down`}
        id={id}
        label={`Move ${name} down`}
        disabled={last}
        fallbackId={`${kind}.up-${id}`}
      >
        ↓
      </ItemButton>
    </>
  );
}

// ------------------------------------------------------------------ new book

export function NewBookForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createBookAction, {});
  return (
    <form action={action} className="stack">
      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" name="title" required maxLength={TITLE_MAX} autoFocus />
      </div>
      <fieldset className="stack">
        <legend>First language (the one you write in first)</legend>
        <div className="row">
          <div className="field" style={{ maxWidth: "8rem" }}>
            <label htmlFor="languageCode">Code</label>
            <input
              id="languageCode"
              name="languageCode"
              required
              defaultValue="EN"
              maxLength={5}
              aria-describedby="code-hint"
            />
          </div>
          <div className="field">
            <label htmlFor="languageName">Name</label>
            <input
              id="languageName"
              name="languageName"
              required
              defaultValue="English"
              maxLength={LANGUAGE_NAME_MAX}
            />
          </div>
        </div>
        <p id="code-hint" className="muted small">
          {LANGUAGE_CODE_HINT}
        </p>
      </fieldset>
      <button type="submit" className="primary" disabled={pending}>
        Create book
      </button>
      <Message id="new-book-msg" state={state} />
    </form>
  );
}

// ------------------------------------------------------------------ profile

export interface ProfileValues {
  title: string;
  oneLiner: string;
  lengthTarget: number | null;
  lengthLimit: number | null;
  peopleNotes: string;
}

export function ProfileForm({
  bookId,
  version,
  values,
}: {
  bookId: string;
  version: number;
  values: ProfileValues;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateProfileAction, {});
  const err = (field: string) => (state.field === field ? state.error : undefined);
  return (
    <form action={action} className="stack" aria-describedby="profile-msg">
      <Hidden name="bookId" value={bookId} />
      <Hidden name="version" value={version} />
      <div className="field">
        <label htmlFor="p-title">Title</label>
        <input
          id="p-title"
          name="title"
          required
          maxLength={TITLE_MAX}
          defaultValue={values.title}
          aria-invalid={Boolean(err("title"))}
        />
      </div>
      <div className="field">
        <label htmlFor="p-one-liner">One-liner</label>
        <input
          id="p-one-liner"
          name="oneLiner"
          maxLength={ONE_LINER_MAX}
          defaultValue={values.oneLiner}
        />
      </div>
      <div className="row">
        <div className="field" style={{ maxWidth: "12rem" }}>
          <label htmlFor="p-target">Length target (words)</label>
          <input
            id="p-target"
            name="lengthTarget"
            type="number"
            min={1}
            max={WORDS_MAX}
            step={1}
            defaultValue={values.lengthTarget ?? ""}
            aria-invalid={Boolean(err("lengthTarget"))}
          />
        </div>
        <div className="field" style={{ maxWidth: "12rem" }}>
          <label htmlFor="p-limit">Hard limit (words)</label>
          <input
            id="p-limit"
            name="lengthLimit"
            type="number"
            min={1}
            max={WORDS_MAX}
            step={1}
            defaultValue={values.lengthLimit ?? ""}
            aria-invalid={Boolean(err("lengthLimit"))}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="p-notes">People notes</label>
        <textarea
          id="p-notes"
          name="peopleNotes"
          maxLength={NOTES_MAX}
          defaultValue={values.peopleNotes}
          rows={6}
        />
      </div>
      <div className="row">
        <button type="submit" className="primary" disabled={pending}>
          Save profile
        </button>
        {state.conflict && (
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        )}
      </div>
      <Message id="profile-msg" state={state} okText="Saved." />
    </form>
  );
}

// ------------------------------------------------------------------ languages

export function LanguageRow({
  bookId,
  language,
  first,
  last,
}: {
  bookId: string;
  language: Language;
  first: boolean;
  last: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(renameLanguageAction, {});
  const { id, code, name, writtenFirst } = language;
  return (
    <li className="row" data-testid={`language-${code}`}>
      <strong className="ui" style={{ minWidth: "4rem" }}>
        {code}
      </strong>
      <form action={action} className="row">
        <Hidden name="bookId" value={bookId} />
        <Hidden name="id" value={id} />
        <label className="visually-hidden" htmlFor={`lang-name-${id}`}>
          Name of {code}
        </label>
        <input
          id={`lang-name-${id}`}
          name="name"
          defaultValue={name}
          required
          maxLength={LANGUAGE_NAME_MAX}
        />
        <button type="submit" disabled={pending}>
          Rename
        </button>
        {state.error && (
          <span role="alert" className="error small">
            {state.error}
          </span>
        )}
      </form>
      {writtenFirst ? (
        <span className="ok small ui">written first</span>
      ) : (
        <ItemButton
          bookId={bookId}
          op="language.first"
          id={id}
          label={`Make ${code} the written-first language`}
        >
          Make written-first
        </ItemButton>
      )}
      <MoveButtons bookId={bookId} kind="language" id={id} name={code} first={first} last={last} />
      {!writtenFirst && (
        <details>
          <summary>Remove…</summary>
          <p className="small">Removing {code} also removes its part and chapter titles.</p>
          <ItemButton
            bookId={bookId}
            op="language.remove"
            id={id}
            label={`Remove ${code} and its titles`}
            className="danger"
          >
            Remove {code} and its titles
          </ItemButton>
        </details>
      )}
    </li>
  );
}

export function AddLanguageForm({ bookId, full }: { bookId: string; full: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addLanguageAction, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={action} className="row" aria-label="Add a language">
      <Hidden name="bookId" value={bookId} />
      <label>
        Code <input name="code" required maxLength={5} size={6} aria-describedby="add-lang-hint" />
      </label>
      <label>
        Name <input name="name" required maxLength={LANGUAGE_NAME_MAX} />
      </label>
      <button type="submit" disabled={pending || full}>
        Add language
      </button>
      <span id="add-lang-hint" className="muted small">
        {full ? `At most ${LIMITS.languages} languages.` : LANGUAGE_CODE_HINT}
      </span>
      <Message id="add-lang-msg" state={state} />
    </form>
  );
}

// ------------------------------------------------------------------ truth labels

export function TruthLabelsForm({
  bookId,
  version,
  labels: initial,
}: {
  bookId: string;
  version: number;
  labels: string[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveTruthLabelsAction, {});
  const [labels, setLabels] = useState(() => initial.map((text, i) => ({ key: i, text })));
  const nextKey = useRef(initial.length);
  // A reset (or a save elsewhere) brings new labels from the server.
  const serverLabels = initial.join("\u0000");
  useEffect(() => {
    setLabels(serverLabels.split("\u0000").map((text, i) => ({ key: nextKey.current + i, text })));
    nextKey.current += 100;
  }, [serverLabels]);

  const move = (i: number, d: -1 | 1) =>
    setLabels((ls) => {
      const next = [...ls];
      const [item] = next.splice(i, 1);
      if (item) next.splice(i + d, 0, item);
      return next;
    });

  return (
    <form action={action} className="stack" aria-describedby="labels-msg">
      <Hidden name="bookId" value={bookId} />
      <Hidden name="version" value={version} />
      <ol className="plain-list">
        {labels.map((l, i) => (
          <li key={l.key} className="row">
            <span className="muted ui small" style={{ minWidth: "1.5rem" }}>
              {i + 1}.
            </span>
            <label className="visually-hidden" htmlFor={`label-${l.key}`}>
              Label {i + 1}
            </label>
            <input
              id={`label-${l.key}`}
              name="label"
              value={l.text}
              required
              maxLength={LABEL_MAX}
              onChange={(e) =>
                setLabels((ls) =>
                  ls.map((x) => (x.key === l.key ? { ...x, text: e.target.value } : x)),
                )
              }
            />
            <button
              type="button"
              aria-label={`Move ${l.text || "label"} up`}
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move ${l.text || "label"} down`}
              disabled={i === labels.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓
            </button>
            <button
              type="button"
              aria-label={`Remove ${l.text || "label"}`}
              disabled={labels.length === 1}
              onClick={() => setLabels((ls) => ls.filter((x) => x.key !== l.key))}
            >
              Remove
            </button>
          </li>
        ))}
      </ol>
      <div className="row">
        <button
          type="button"
          disabled={labels.length >= LIMITS.labels}
          onClick={() => setLabels((ls) => [...ls, { key: nextKey.current++, text: "" }])}
        >
          Add label
        </button>
        <button type="submit" className="primary" disabled={pending}>
          Save labels
        </button>
        <button type="submit" name="intent" value="reset" disabled={pending}>
          Reset to cowriter defaults
        </button>
      </div>
      <Message id="labels-msg" state={state} okText="Saved." />
    </form>
  );
}

// ------------------------------------------------------------------ standing rules

export function RuleEditorForm({
  bookId,
  ruleId,
  initial,
  onDone,
}: {
  bookId: string;
  ruleId?: string;
  initial?: RichDoc;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveRuleAction, {});
  const [body, setBody] = useState<RichDoc>(initial ?? emptyDoc());
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (!state.ok) return;
    if (onDone) onDone();
    else {
      setBody(emptyDoc());
      setGeneration((g) => g + 1); // fresh editor for the next rule
    }
  }, [state, onDone]);
  return (
    <form action={action} className="stack" aria-label={ruleId ? "Edit rule" : "Add a rule"}>
      <Hidden name="bookId" value={bookId} />
      {ruleId && <Hidden name="id" value={ruleId} />}
      <input type="hidden" name="body" value={JSON.stringify(body)} />
      <LazyEditor
        key={generation}
        initial={body}
        label={ruleId ? "Rule text" : "New rule"}
        onChange={setBody}
        minHeight="4rem"
      />
      <div className="row">
        <button type="submit" className="primary" disabled={pending}>
          {ruleId ? "Save rule" : "Add rule"}
        </button>
        {onDone && (
          <button type="button" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
      <Message id={`rule-msg-${ruleId ?? "new"}`} state={state} />
    </form>
  );
}

export function RuleItem({
  bookId,
  id,
  number,
  date,
  body,
  first,
  last,
}: {
  bookId: string;
  id: string;
  number: number;
  date: string;
  body: RichDoc;
  first: boolean;
  last: boolean;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <li data-testid="rule">
      <div className="row">
        <strong className="ui">{number}.</strong>
        <time className="muted small ui" dateTime={date}>
          {date}
        </time>
        <span style={{ marginLeft: "auto" }} className="row">
          <button type="button" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
            {editing ? "Close" : "Edit"}
          </button>
          <MoveButtons
            bookId={bookId}
            kind="rule"
            id={id}
            name={`rule ${number}`}
            first={first}
            last={last}
          />
          <ItemButton
            bookId={bookId}
            op="rule.remove"
            id={id}
            label={`Delete rule ${number}`}
            className="danger"
          >
            Delete
          </ItemButton>
        </span>
      </div>
      {editing ? (
        <RuleEditorForm
          bookId={bookId}
          ruleId={id}
          initial={body}
          onDone={() => setEditing(false)}
        />
      ) : (
        <LazyEditor
          key={JSON.stringify(body)}
          initial={body}
          label={`Rule ${number}`}
          editable={false}
        />
      )}
    </li>
  );
}

// ------------------------------------------------------------------ delete book

export function DeleteBookForm({ bookId, title }: { bookId: string; title: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteBookAction, {});
  return (
    <form action={action} className="stack">
      <Hidden name="bookId" value={bookId} />
      <div className="field">
        <label htmlFor="delete-confirmation">
          Type the title, <strong>{title}</strong>, to confirm
        </label>
        <input
          id="delete-confirmation"
          name="confirmation"
          autoComplete="off"
          aria-describedby="delete-book-msg"
        />
      </div>
      <button type="submit" className="danger" disabled={pending}>
        Delete this book
      </button>
      <p id="delete-book-msg" role="alert" className="error small">
        {state.error ?? ""}
      </p>
    </form>
  );
}

// ------------------------------------------------------------------ parts and chapters

function TitleFields({
  languages,
  titles,
  prefix,
}: {
  languages: Language[];
  titles?: Record<string, string>;
  prefix: string;
}) {
  return (
    <>
      {languages.map((l) => (
        <div className="field" key={l.code}>
          <label htmlFor={`${prefix}-${l.code}`}>
            Title ({l.code}){l.writtenFirst ? "" : ", optional"}
          </label>
          <input
            id={`${prefix}-${l.code}`}
            name={`title.${l.code}`}
            defaultValue={titles?.[l.code] ?? ""}
            required={l.writtenFirst}
            maxLength={TITLE_MAX}
          />
        </div>
      ))}
    </>
  );
}

function useResetOnOk(state: ActionState) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);
  return form;
}

export function PartForm({
  bookId,
  languages,
  part,
}: {
  bookId: string;
  languages: Language[];
  part?: { id: string; titles: Record<string, string> };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(savePartAction, {});
  const form = useResetOnOk(part ? {} : state);
  const prefix = part ? `part-${part.id}` : "new-part";
  return (
    <form
      ref={form}
      action={action}
      className="stack"
      aria-label={part ? "Rename part" : "Add a part"}
    >
      <Hidden name="bookId" value={bookId} />
      {part && <Hidden name="id" value={part.id} />}
      <TitleFields languages={languages} titles={part?.titles} prefix={prefix} />
      <button type="submit" disabled={pending}>
        {part ? "Save titles" : "Add part"}
      </button>
      <Message id={`${prefix}-msg`} state={state} okText={part ? "Saved." : undefined} />
    </form>
  );
}

export function ChapterForm({
  bookId,
  languages,
  parts,
  suggestedCode,
  chapter,
}: {
  bookId: string;
  languages: Language[];
  parts?: { id: string; title: string }[];
  suggestedCode?: string | null;
  chapter?: { id: string; titles: Record<string, string> };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveChapterAction, {});
  const form = useResetOnOk(chapter ? {} : state);
  const prefix = chapter ? `chapter-${chapter.id}` : "new-chapter";
  return (
    <form
      ref={form}
      action={action}
      className="stack"
      aria-label={chapter ? "Rename chapter" : "Add a chapter"}
    >
      <Hidden name="bookId" value={bookId} />
      {chapter && <Hidden name="id" value={chapter.id} />}
      {!chapter && (
        <div className="row">
          <div className="field" style={{ maxWidth: "8rem" }}>
            <label htmlFor="new-chapter-code">Code</label>
            <input
              id="new-chapter-code"
              name="code"
              required
              maxLength={4}
              pattern={CHAPTER_CODE_PATTERN}
              defaultValue={suggestedCode ?? ""}
              key={suggestedCode ?? ""}
              aria-describedby="chapter-code-hint"
            />
          </div>
          {parts && parts.length > 0 && (
            <div className="field" style={{ maxWidth: "16rem" }}>
              <label htmlFor="new-chapter-part">Part</label>
              <select id="new-chapter-part" name="partId" defaultValue={parts.at(-1)?.id ?? ""}>
                {parts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
                <option value="">No part</option>
              </select>
            </div>
          )}
        </div>
      )}
      {!chapter && (
        <p id="chapter-code-hint" className="muted small">
          {CHAPTER_CODE_HINT}. Codes never change once set.
        </p>
      )}
      <TitleFields languages={languages} titles={chapter?.titles} prefix={prefix} />
      <button type="submit" disabled={pending}>
        {chapter ? "Save titles" : "Add chapter"}
      </button>
      <Message id={`${prefix}-msg`} state={state} okText={chapter ? "Saved." : undefined} />
    </form>
  );
}

export function MoveToPartForm({
  bookId,
  chapterId,
  code,
  currentPartId,
  parts,
}: {
  bookId: string;
  chapterId: string;
  code: string;
  currentPartId: string | null;
  parts: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(itemAction, {});
  return (
    <form action={action} className="inline-form row">
      <Hidden name="bookId" value={bookId} />
      <Hidden name="op" value="chapter.toPart" />
      <Hidden name="id" value={chapterId} />
      <label className="visually-hidden" htmlFor={`to-part-${chapterId}`}>
        Part for chapter {code}
      </label>
      <select id={`to-part-${chapterId}`} name="partId" defaultValue={currentPartId ?? ""}>
        {parts.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
        <option value="">No part</option>
      </select>
      <button type="submit" disabled={pending}>
        Move
      </button>
      {state.error && (
        <span role="alert" className="error small">
          {state.error}
        </span>
      )}
    </form>
  );
}
