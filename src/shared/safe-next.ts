/**
 * Where to send the user after sign-in: only a path inside this app ("/settings"), never
 * another host. Anything else ("//evil.com", "https://evil.com", "/\\evil.com", control
 * characters) becomes "/".
 */
export function safeNext(value: string | null | undefined): string {
  if (!value) return "/";
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return "/";
  }
  for (const candidate of [value, decoded]) {
    if (!candidate.startsWith("/") || candidate.startsWith("//")) return "/";
    if (/[\u0000-\u001f\\]/.test(candidate)) return "/";
  }
  // Parse against a dummy origin: if the result leaves it, the path was not local.
  const url = new URL(value, "http://local.invalid");
  if (url.origin !== "http://local.invalid") return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
