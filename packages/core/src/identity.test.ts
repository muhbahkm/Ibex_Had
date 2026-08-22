import { describe, expect, it } from 'vitest';

import { isPhoneE164, normalizeFullName, normalizePhoneE164 } from './identity.js';

describe('identity normalization', () => {
  it('normalizes whitespace in names', () => {
    expect(normalizeFullName('  محمد   باحكم  ')).toBe('محمد باحكم');
  });

  it('rejects invalid name lengths', () => {
    expect(() => normalizeFullName('A')).toThrow();
    expect(() => normalizeFullName('x'.repeat(121))).toThrow();
  });

  it('normalizes Yemeni local mobile numbers to E.164', () => {
    expect(normalizePhoneE164('777 123 456')).toBe('+967777123456');
    expect(normalizePhoneE164('0777-123-456')).toBe('+967777123456');
  });

  it('preserves valid international E.164 numbers', () => {
    expect(normalizePhoneE164('+966 50 123 4567')).toBe('+966501234567');
  });

  it('rejects invalid phone inputs', () => {
    expect(() => normalizePhoneE164('12345')).toThrow();
    expect(() => normalizePhoneE164('+00012345678')).toThrow();
  });

  it('recognizes E.164 values', () => {
    expect(isPhoneE164('+967777123456')).toBe(true);
    expect(isPhoneE164('777123456')).toBe(false);
  });
});
