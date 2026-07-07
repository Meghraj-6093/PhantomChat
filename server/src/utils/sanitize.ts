const CONTROL_CHARS = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]", "g");

/** Strip control characters and clamp length. Markdown is rendered safely client-side. */
export function sanitizeText(input: string, maxLen = 4000): string {
  return input.replace(CONTROL_CHARS, "").slice(0, maxLen).trim();
}

const SPAM_PATTERNS = [/(.)\1{30,}/, /(https?:\/\/\S+\s*){8,}/i];

/** Naive heuristic spam detector used by moderation middleware. */
export function looksLikeSpam(text: string): boolean {
  return SPAM_PATTERNS.some((re) => re.test(text));
}
