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

export default async function ProfilePage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  const p = await loadOr404((actor) => getProfile(actor, bookId));

  return (
    <main className="content stack">
      <h2 className="visually-hidden">Profile</h2>

      <section aria-labelledby="profile-title">
        <h3 id="profile-title">Profile</h3>
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
      </section>

      <section aria-labelledby="languages-title">
        <h3 id="languages-title">Languages</h3>
        <ol className="plain-list" aria-label="Languages">
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

      <section aria-labelledby="rules-title">
        <h3 id="rules-title">Standing rules</h3>
        {p.rules.length === 0 && <p className="muted">No standing rules yet.</p>}
        <ol className="plain-list" aria-label="Standing rules">
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
          <details>
            <summary>Add a rule</summary>
            <RuleEditorForm bookId={p.id} />
          </details>
        ) : (
          <p className="muted small">At most {LIMITS.rules} standing rules.</p>
        )}
      </section>

      <section aria-labelledby="labels-title">
        <h3 id="labels-title">Truth labels</h3>
        <TruthLabelsForm bookId={p.id} version={p.version} labels={p.truthLabels} />
      </section>

      <section aria-labelledby="scheme-title">
        <h3 id="scheme-title">Paragraph-ID scheme</h3>
        <p>
          <strong>{ID_SCHEME_COWRITER_V1.name}</strong>: {ID_SCHEME_COWRITER_V1.description}
        </p>
        <p className="ui" data-testid="scheme-examples">
          Examples:{" "}
          {ID_SCHEME_COWRITER_V1.examples.map((e) => (
            <code key={e}>{e} </code>
          ))}
        </p>
      </section>

      <section aria-labelledby="delete-title" style={{ marginTop: "3rem" }}>
        <h3 id="delete-title">Delete this book</h3>
        <p>
          This removes the book with its profile, Concept, parts and chapters. It cannot be undone.
        </p>
        <DeleteBookForm bookId={p.id} title={p.title} />
      </section>
    </main>
  );
}
