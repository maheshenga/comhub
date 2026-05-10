export const replaceLegacyBrandTokens = (value: string, brandName: string) =>
  value.replaceAll(/\bLobe\s*AI\b|LobeHub/gi, brandName);
