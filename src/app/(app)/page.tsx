import { requirePageActor } from "@/server/auth/page-actor";

export default async function HomePage() {
  const actor = await requirePageActor();
  return (
    <main>
      <h1>Hello, {actor.name}</h1>
      <p>Your books will live here. They arrive with the next epic (E02).</p>
    </main>
  );
}
