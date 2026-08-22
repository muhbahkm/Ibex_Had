const EXPONENTS: Readonly<Record<string, number>> = {
  YER: 0,
  SAR: 2,
  USD: 2,
};

export function currencyExponent(currencyCode: string): number {
  return EXPONENTS[currencyCode.toUpperCase()] ?? 0;
}

export function formatMinorUnits(amountMinor: bigint, currencyCode: string): string {
  const exponent = currencyExponent(currencyCode);
  const negative = amountMinor < 0n;
  const absolute = negative ? -amountMinor : amountMinor;
  if (exponent === 0) return `${negative ? '-' : ''}${absolute.toString()} ${currencyCode}`;

  const scale = 10n ** BigInt(exponent);
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(exponent, '0');
  return `${negative ? '-' : ''}${whole.toString()}.${fraction} ${currencyCode}`;
}

export function majorUnitsToMinor(value: string, currencyCode: string): string {
  const normalized = value.trim();
  const exponent = currencyExponent(currencyCode);
  const match = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/.exec(normalized);
  if (!match) throw new Error('أدخل مبلغًا صحيحًا بالأرقام اللاتينية.');
  const whole = match[1] ?? '0';
  const fraction = match[2] ?? '';
  if (fraction.length > exponent) throw new Error(`العملة ${currencyCode} تقبل ${exponent} منازل عشرية فقط.`);
  if (exponent === 0 && fraction.length > 0) throw new Error(`العملة ${currencyCode} لا تقبل كسورًا.`);
  const padded = fraction.padEnd(exponent, '0');
  const result = `${whole}${padded}`.replace(/^0+(?=\d)/, '');
  if (BigInt(result || '0') <= 0n) throw new Error('يجب أن يكون المبلغ أكبر من صفر.');
  return result || '0';
}
