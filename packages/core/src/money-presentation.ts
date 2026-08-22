const EXPONENTS: Readonly<Record<string, number>> = {
  YER: 0,
  SAR: 2,
  USD: 2,
};

export function currencyExponent(currencyCode: string): number {
  return EXPONENTS[currencyCode.toUpperCase()] ?? 0;
}

export function formatMinorUnits(amountMinor: bigint, currencyCode: string): string {
  const normalizedCode = currencyCode.toUpperCase();
  const exponent = currencyExponent(normalizedCode);
  const negative = amountMinor < 0n;
  const absolute = negative ? -amountMinor : amountMinor;
  if (exponent === 0) return `${negative ? '-' : ''}${absolute.toString()} ${normalizedCode}`;

  const scale = 10n ** BigInt(exponent);
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(exponent, '0');
  return `${negative ? '-' : ''}${whole.toString()}.${fraction} ${normalizedCode}`;
}

export function majorUnitsToMinor(value: string, currencyCode: string): string {
  const normalized = value.trim();
  const normalizedCode = currencyCode.toUpperCase();
  const exponent = currencyExponent(normalizedCode);
  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(normalized);
  if (!match) throw new Error('Amount must use Latin digits and a valid decimal format');
  const whole = match[1] ?? '0';
  const fraction = match[2] ?? '';
  if (fraction.length > exponent) throw new Error(`Currency ${normalizedCode} accepts at most ${exponent} decimal places`);
  if (exponent === 0 && fraction.length > 0) throw new Error(`Currency ${normalizedCode} does not accept fractional units`);
  const padded = fraction.padEnd(exponent, '0');
  const result = `${whole}${padded}`.replace(/^0+(?=\d)/, '');
  if (BigInt(result || '0') <= 0n) throw new Error('Amount must be greater than zero');
  return result || '0';
}
