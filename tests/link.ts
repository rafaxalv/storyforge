/** The first http(s) URL in an email body: the sign-in link. */
export function extractLink(text: string | undefined): string | undefined {
  return text?.match(/https?:\/\/\S+/)?.[0];
}
