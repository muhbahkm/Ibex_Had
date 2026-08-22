const MINOR_UNITS_PATTERN = /^(0|[1-9][0-9]*)$/;
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

export interface MoneyInput {
  readonly amountMinor: string;
  readonly currencyCode: string;
}

export interface Money {
  readonly amountMinor: bigint;
  readonly currencyCode: string;
}

export function parseMinorUnits(value: string): bigint {
  if (!MINOR_UNITS_PATTERN.test(value)) {
    throw new Error('Money minor units must be an unsigned decimal integer string');
  }

  return BigInt(value);
}

export function parsePositiveMinorUnits(value: string): bigint {
  const amount = parseMinorUnits(value);

  if (amount <= 0n) {
    throw new Error('Money amount must be greater than zero');
  }

  return amount;
}

export function normalizeCurrencyCode(value: string): string {
  const code = value.trim().toUpperCase();

  if (!CURRENCY_CODE_PATTERN.test(code)) {
    throw new Error('Currency code must be a 3-letter ISO-style code');
  }

  return code;
}

export function parseMoney(input: MoneyInput): Money {
  return {
    amountMinor: parsePositiveMinorUnits(input.amountMinor),
    currencyCode: normalizeCurrencyCode(input.currencyCode),
  };
}

export function serializeMinorUnits(value: bigint): string {
  return value.toString(10);
}
