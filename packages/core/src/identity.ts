const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;
const YEMEN_LOCAL_MOBILE_PATTERN = /^7[0-9]{8}$/;

export function normalizeFullName(input: string): string {
  const normalized = input.trim().replace(/\s+/g, ' ');

  if (normalized.length < 2 || normalized.length > 120) {
    throw new Error('Full name must contain between 2 and 120 characters');
  }

  return normalized;
}

export function normalizePhoneE164(input: string, defaultCountryCode = '+967'): string {
  const compact = input.trim().replace(/[\s()-]/g, '');

  if (compact.startsWith('+')) {
    if (!E164_PATTERN.test(compact)) {
      throw new Error('Phone number must be valid E.164');
    }

    return compact;
  }

  const local = compact.startsWith('0') ? compact.slice(1) : compact;

  if (defaultCountryCode === '+967' && YEMEN_LOCAL_MOBILE_PATTERN.test(local)) {
    return `${defaultCountryCode}${local}`;
  }

  throw new Error('Phone number must be E.164 or a valid Yemeni mobile number');
}

export function isPhoneE164(value: string): boolean {
  return E164_PATTERN.test(value);
}
