import { getActor } from "@/server/auth/actor";

export default async function HomePage() {
  const actor = await getActor(undefined, "page.home");
  return (
    <main>
      <h1>Hello, {actor.name}</h1>
      <p>Your books will live here. They arrive with the next epic (E02).</p>
    </main>
  );
}
