import { describe, expect, it } from 'vitest';

import { formatMinorUnits, majorUnitsToMinor } from './money-display';

describe('mobile money display', () => {
  it('converts YER without floating point', () => {
    expect(majorUnitsToMinor('50000', 'YER')).toBe('50000');
    expect(formatMinorUnits(50000n, 'YER')).toBe('50000 YER');
  });

  it('converts SAR/USD decimals losslessly', () => {
    expect(majorUnitsToMinor('500.25', 'SAR')).toBe('50025');
    expect(majorUnitsToMinor('1.5', 'USD')).toBe('150');
    expect(formatMinorUnits(50025n, 'SAR')).toBe('500.25 SAR');
    expect(formatMinorUnits(-150n, 'USD')).toBe('-1.50 USD');
  });

  it('rejects excess fraction precision', () => {
    expect(() => majorUnitsToMinor('1.01', 'YER')).toThrow();
    expect(() => majorUnitsToMinor('1.001', 'SAR')).toThrow();
  });
});
