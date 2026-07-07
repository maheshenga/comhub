export const renderTemplateString = (
  template: string,
  values: Record<string, unknown>,
): string =>
  template.replace(/\{\{\s*([\w:-]+)\s*\}\}|\{([\w:-]+)\}/g, (match, doubleKey, singleKey) => {
    const key = doubleKey || singleKey;
    const value = values[key];

    if (value === undefined || value === null) return '';

    return String(value);
  });

export const renderTemplateValue = (
  value: unknown,
  values: Record<string, unknown>,
): unknown => {
  if (typeof value === 'string') return renderTemplateString(value, values);

  if (Array.isArray(value)) return value.map((item) => renderTemplateValue(item, values));

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        renderTemplateValue(item, values),
      ]),
    );
  }

  return value;
};

export const sanitizeArtifactFileName = (value: string): string => {
  const sanitized = value
    .trim()
    .replace(/[\\/:"*?<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return sanitized || 'plugin-result.md';
};
