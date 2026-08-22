import {
  currencyExponent,
  formatMinorUnits,
  majorUnitsToMinor as majorUnitsToMinorCore,
} from '../../../../packages/core/src/money-presentation';

export { currencyExponent, formatMinorUnits };

export function majorUnitsToMinor(value: string, currencyCode: string): string {
  try {
    return majorUnitsToMinorCore(value, currencyCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Amount must use Latin digits and a valid decimal format') {
      throw new Error('أدخل مبلغًا صحيحًا بالأرقام اللاتينية.');
    }
    if (message === 'Amount must be greater than zero') {
      throw new Error('يجب أن يكون المبلغ أكبر من صفر.');
    }
    if (message.startsWith('Currency ') && message.includes('does not accept fractional units')) {
      throw new Error(`العملة ${currencyCode.toUpperCase()} لا تقبل كسورًا.`);
    }
    const decimalMatch = /^Currency ([A-Z]{3}) accepts at most (\d+) decimal places$/.exec(message);
    if (decimalMatch) {
      throw new Error(`العملة ${decimalMatch[1]} تقبل ${decimalMatch[2]} منازل عشرية فقط.`);
    }
    throw error;
  }
}
