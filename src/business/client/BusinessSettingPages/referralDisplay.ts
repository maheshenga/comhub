const normalizeReferralDigits = (value: string) => value.replaceAll(/\D/g, '').slice(0, 7);

export const normalizeReferralCodeInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const referralCode = url.searchParams.get('ref') || url.searchParams.get('referral') || '';

      return normalizeReferralDigits(referralCode);
    } catch {
      return '';
    }
  }

  return normalizeReferralDigits(trimmed);
};
