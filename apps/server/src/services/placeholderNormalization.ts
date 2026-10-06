/**
 * Shared placeholder cleanup for market/discover catalogue items: upstream
 * feeds sometimes carry placeholder rows ('UN' labels, missing identifiers,
 * empty descriptions). These helpers pick the first meaningful text, drop
 * placeholder-only rows, and backfill a Chinese fallback description so the
 * store surfaces never render raw 'UN' placeholders.
 */

export const EMPTY_DESCRIPTION_FALLBACK = '内容暂不可用';

export const isPlaceholderText = (text: string) => text.toUpperCase() === 'UN';

export const firstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const text = value.trim();
    if (isPlaceholderText(text)) continue;
    if (text) return text;
  }
};

/**
 * Normalize one catalogue item: resolve a stable identifier, replace
 * placeholder labels, and backfill the description. Returns the original
 * object identity when nothing changed.
 */
export const normalizeCatalogItem = (
  item: unknown,
  {
    descriptionFallback = EMPTY_DESCRIPTION_FALLBACK,
    fallbackIdentifier,
    iconFields = ['icon', 'avatar'],
    identifierFields = ['identifier', 'slug'],
    labelFields = ['name', 'title', 'displayName'],
    summaryFields = ['description', 'summary'],
  }: {
    descriptionFallback?: string;
    fallbackIdentifier?: unknown;
    iconFields?: string[];
    identifierFields?: string[];
    labelFields?: string[];
    summaryFields?: string[];
  } = {},
) => {
  if (!item || typeof item !== 'object') return;

  const record = item as Record<string, unknown>;
  const identifier = firstText(
    ...identifierFields.map((field) => record[field]),
    fallbackIdentifier,
  );
  if (!identifier) return;

  const hasPlaceholderLabel = labelFields.some(
    (value) => typeof record[value] === 'string' && isPlaceholderText(record[value].trim()),
  );
  const hasDescriptionField = summaryFields.some((field) => field in record);
  const name = firstText(...labelFields.map((field) => record[field]), identifier);
  const title = firstText(record.title, record.displayName);
  const description =
    firstText(...summaryFields.map((field) => record[field])) ||
    (hasDescriptionField || hasPlaceholderLabel ? descriptionFallback : undefined);
  const icon = firstText(...iconFields.map((field) => record[field]));

  const unchanged =
    identifier === record.identifier &&
    name === record.name &&
    (title === undefined || title === record.title) &&
    (description === undefined || description === record.description) &&
    (icon === undefined || icon === record.icon);

  if (unchanged) return item;

  return {
    ...record,
    ...(description ? { description } : {}),
    identifier,
    ...(icon ? { icon } : {}),
    name,
    ...(title ? { title } : {}),
  };
};

/** Apply {@link normalizeCatalogItem} over a `{ items }` list response. */
export const normalizeCatalogListResponse = <T extends { items?: unknown }>(
  response: T,
  normalizeItem: (item: unknown) => unknown,
): T => {
  const items = Array.isArray(response.items) ? response.items : [];
  let changed = !Array.isArray(response.items);
  const normalizedItems: unknown[] = [];

  for (const item of items) {
    const normalized = normalizeItem(item);
    if (!normalized) {
      changed = true;
      continue;
    }

    normalizedItems.push(normalized);
    if (normalized !== item) changed = true;
  }

  return changed ? ({ ...response, items: normalizedItems } as T) : response;
};
