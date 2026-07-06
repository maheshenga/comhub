const UUID_RE = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

export const formatCreditLedgerDescription = (value?: unknown) => {
  const description = typeof value === 'string' ? value.trim() : '';
  if (!description) return '--';

  const consumedPrefix = 'Consumed on ';
  if (!description.toLowerCase().startsWith(consumedPrefix.toLowerCase())) return description;

  const [provider, model] = description.slice(consumedPrefix.length).split('/');
  const displayModel = model || provider;
  const displayProvider = provider && model && !UUID_RE.test(provider) ? ` · 服务商：${provider}` : '';

  return `模型调用：${displayModel}${displayProvider}`;
};
