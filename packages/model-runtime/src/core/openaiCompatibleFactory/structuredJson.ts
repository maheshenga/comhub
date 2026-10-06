/**
 * ComHub structured-output JSON parsing.
 *
 * The upstream factory parsed `JSON.parse(text)` bare; real OpenAI-compatible
 * providers routinely wrap structured output in a ```json markdown fence, so
 * the fork strips the fence and retries before giving up.
 */

const stripJsonMarkdownFence = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return text;

  const firstLineEnd = trimmed.indexOf('\n');
  if (firstLineEnd < 0) return text;

  const language = trimmed.slice(3, firstLineEnd).trim().toLowerCase();
  if (language && language !== 'json') return text;

  const closingFenceStart = trimmed.lastIndexOf('```');
  if (closingFenceStart <= firstLineEnd) return text;

  const trailing = trimmed.slice(closingFenceStart + 3).trim();
  if (trailing) return text;

  return trimmed.slice(firstLineEnd + 1, closingFenceStart).trim();
};

export const parseStructuredJson = (text?: string) => {
  if (typeof text !== 'string') return undefined;

  const candidates = [text, stripJsonMarkdownFence(text)];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next candidate; callers log the original text once parsing fails.
    }
  }

  return undefined;
};
