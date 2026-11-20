import { getProfile } from "@/server/books/books";
import { LIMITS } from "@/shared/books";
import { ID_SCHEME_COWRITER_V1 } from "@/shared/id-scheme";
import type { RichDoc } from "@/shared/rich-text";
import { loadOr404 } from "../../book-data";
import {
  AddLanguageForm,
  DeleteBookForm,
  LanguageRow,
  ProfileForm,
  RuleEditorForm,
  RuleItem,
  TruthLabelsForm,
} from "../../forms";

export const metadata = { title: "Profile · storyforge" };

const day = (d: Date) => d.toISOString().slice(0, 10);

const SECTIONS = [
  ["profile", "Profile"],
  ["languages", "Languages"],
  ["rules", "Standing rules"],
  ["labels", "Truth labels"],
  ["scheme", "Paragraph-ID scheme"],
  ["delete", "Delete this book"],
] as const;

/** The book's profile, laid out like the Manuscript Desk: sections in the main column, a jump list in the panel. */
export default async function ProfilePage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const p = await loadOr404((actor) => getProfile(actor, bookId));
  const counts: Record<string, number> = {
    languages: p.languages.length,
    rules: p.rules.length,
    labels: p.truthLabels.length,
  };

  return (
    <div className="desk">
      <aside className="panel" aria-labelledby="profile-panel-title">
        <div className="p-head">
          <h2 id="profile-panel-title">Book profile</h2>
        </div>
        <ul className="p-nav" aria-label="Sections">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`}>
                {label} {counts[id] !== undefined && <span className="count">{counts[id]}</span>}
              </a>
            </li>
          ))}
        </ul>
        <hr className="p-sep" />
        <p className="hint">
          Every tool follows this profile: its languages, standing rules, truth labels and the
          paragraph-ID scheme.
        </p>
      </aside>

      <main className="main">
        <div className="page" style={{ maxWidth: 760 }}>
          <div className="eyebrow">Book</div>
          <h1>Profile</h1>

          <section className="plan-sec" id="profile" aria-labelledby="profile-title">
            <header>
              <h2 id="profile-title">Profile</h2>
            </header>
            <div className="card">
              <ProfileForm
                bookId={p.id}
                version={p.version}
                values={{
                  title: p.title,
                  oneLiner: p.oneLiner,
                  lengthTarget: p.lengthTarget,
                  lengthLimit: p.lengthLimit,
                  peopleNotes: p.peopleNotes,
                }}
              />
            </div>
          </section>

          <section className="plan-sec" id="languages" aria-labelledby="languages-title">
            <header>
              <h2 id="languages-title">
                Languages <span className="count">{p.languages.length}</span>
              </h2>
            </header>
            <p className="hint">
              The written-first language is the one you write in first; the others are translations.
            </p>
            <ol className="plain-list cells" aria-label="Languages">
              {p.languages.map((l, i) => (
                <LanguageRow
                  key={l.id}
                  bookId={p.id}
                  language={l}
                  first={i === 0}
                  last={i === p.languages.length - 1}
                />
              ))}
            </ol>
            <AddLanguageForm bookId={p.id} full={p.languages.length >= LIMITS.languages} />
          </section>

          <section className="plan-sec" id="rules" aria-labelledby="rules-title">
            <header>
              <h2 id="rules-title">
                Standing rules <span className="count">{p.rules.length}</span>
              </h2>
            </header>
            <p className="hint">Numbered in order; each shows the day it last changed.</p>
            {p.rules.length === 0 && <p className="p-empty">No standing rules yet.</p>}
            <ol className="plain-list cells" aria-label="Standing rules">
              {p.rules.map((r, i) => (
                <RuleItem
                  key={r.id}
                  bookId={p.id}
                  id={r.id}
                  number={i + 1}
                  date={day(r.updatedAt)}
                  body={r.body as RichDoc}
                  first={i === 0}
                  last={i === p.rules.length - 1}
                />
              ))}
            </ol>
            {p.rules.length < LIMITS.rules ? (
              <details className="card">
                <summary>Add a rule</summary>
                <RuleEditorForm bookId={p.id} />
              </details>
            ) : (
              <p className="p-empty">At most {LIMITS.rules} standing rules.</p>
            )}
          </section>

          <section className="plan-sec" id="labels" aria-labelledby="labels-title">
            <header>
              <h2 id="labels-title">
                Truth labels <span className="count">{p.truthLabels.length}</span>
              </h2>
            </header>
            <p className="hint">
              How sure each fact is, from most to least; facts in the plan carry one.
            </p>
            <div className="card">
              <TruthLabelsForm bookId={p.id} version={p.version} labels={p.truthLabels} />
            </div>
          </section>

          <section className="plan-sec" id="scheme" aria-labelledby="scheme-title">
            <header>
              <h2 id="scheme-title">Paragraph-ID scheme</h2>
            </header>
            <div className="card">
              <p style={{ margin: 0 }}>
                <strong>{ID_SCHEME_COWRITER_V1.name}</strong>: {ID_SCHEME_COWRITER_V1.description}
              </p>
              <p className="row" data-testid="scheme-examples" style={{ marginBottom: 0 }}>
                <span className="muted small">Examples</span>
                {ID_SCHEME_COWRITER_V1.examples.map((e) => (
                  <code key={e} className="pid">
                    {e}
                  </code>
                ))}
              </p>
            </div>
          </section>

          <section className="plan-sec" id="delete" aria-labelledby="delete-title">
            <header>
              <h2 id="delete-title">Delete this book</h2>
            </header>
            <div className="card">
              <p style={{ marginTop: 0 }}>
                This removes the book with its profile, Concept, parts and chapters. It cannot be
                undone.
              </p>
              <DeleteBookForm bookId={p.id} title={p.title} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
