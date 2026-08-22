import { describe, expect, it } from 'vitest';

import {
  normalizeCurrencyCode,
  parseMoney,
  parsePositiveMinorUnits,
  serializeMinorUnits,
} from './money.js';

describe('money boundary', () => {
  it('preserves integers larger than JavaScript safe integer range', () => {
    const value = parsePositiveMinorUnits('900719925474099312345');
    expect(serializeMinorUnits(value)).toBe('900719925474099312345');
  });

  it('rejects decimals, signs, exponent notation, and zero', () => {
    for (const invalid of ['1.5', '-1', '+1', '1e3', '00', '0']) {
      expect(() => parsePositiveMinorUnits(invalid)).toThrow();
    }
  });

  it('normalizes currency codes', () => {
    expect(normalizeCurrencyCode(' sar ')).toBe('SAR');
    expect(() => normalizeCurrencyCode('YR')).toThrow();
  });

  it('parses API money without floating point conversion', () => {
    expect(parseMoney({ amountMinor: '12500', currencyCode: 'sar' })).toEqual({
      amountMinor: 12500n,
      currencyCode: 'SAR',
    });
  });
});
