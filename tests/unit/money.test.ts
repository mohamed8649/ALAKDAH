import { describe, expect, it } from 'vitest';

import {
  applyPercent,
  formatMoney,
  minorDigits,
  parseMoney,
  sumMoney,
  toDecimalString,
} from '@/lib/money';

/**
 * Money is stored as integer minor units, and LYD has three of them. These
 * tests exist because that is the single easiest thing to get wrong in this
 * codebase: a float creeping in anywhere produces order totals that are off by
 * a millime and reconcile against nothing.
 */
describe('parseMoney', () => {
  it('reads a whole number as minor units for the currency', () => {
    expect(parseMoney('235', 'LYD')).toBe(235_000);
    expect(parseMoney('235', 'USD')).toBe(23_500);
  });

  it('pads a short fraction rather than misreading it', () => {
    // "12.5" LYD is twelve and a half dinars, not twelve dinars and 5 millimes.
    expect(parseMoney('12.5', 'LYD')).toBe(12_500);
    expect(parseMoney('12.05', 'LYD')).toBe(12_050);
    expect(parseMoney('12.005', 'LYD')).toBe(12_005);
  });

  it('truncates a fraction longer than the currency allows', () => {
    expect(parseMoney('1.9999', 'LYD')).toBe(1_999);
    expect(parseMoney('1.999', 'USD')).toBe(199);
  });

  it('accepts Arabic-Indic digits and Arabic separators', () => {
    expect(parseMoney('٢٣٥', 'LYD')).toBe(235_000);
    expect(parseMoney('١٢٫٥', 'LYD')).toBe(12_500);
    expect(parseMoney('12,5', 'LYD')).toBe(12_500);
  });

  it('rejects anything that is not a non-negative amount', () => {
    expect(parseMoney('', 'LYD')).toBeNull();
    expect(parseMoney('abc', 'LYD')).toBeNull();
    expect(parseMoney('-5', 'LYD')).toBeNull();
    expect(parseMoney('1.2.3', 'LYD')).toBeNull();
    expect(parseMoney(Number.NaN, 'LYD')).toBeNull();
    expect(parseMoney(Number.POSITIVE_INFINITY, 'LYD')).toBeNull();
  });

  it('round-trips through toDecimalString', () => {
    for (const input of ['0', '0.001', '1', '99.999', '1234.567']) {
      const minor = parseMoney(input, 'LYD');
      expect(minor).not.toBeNull();
      expect(parseMoney(toDecimalString(minor!, 'LYD'), 'LYD')).toBe(minor);
    }
  });
});

describe('toDecimalString', () => {
  it('always writes the currency’s full precision', () => {
    expect(toDecimalString(235_000, 'LYD')).toBe('235.000');
    expect(toDecimalString(1, 'LYD')).toBe('0.001');
    expect(toDecimalString(0, 'LYD')).toBe('0.000');
    expect(toDecimalString(2_350, 'USD')).toBe('23.50');
  });
});

describe('formatMoney', () => {
  it('uses Latin digits even in Arabic', () => {
    const formatted = formatMoney(235_000, 'LYD', 'ar');
    expect(formatted).toMatch(/235/);
    expect(formatted).not.toMatch(/[٠-٩]/);
  });
});

describe('applyPercent', () => {
  it('takes the percentage off, returning what is left', () => {
    expect(applyPercent(100_000, 25)).toBe(75_000);
    expect(applyPercent(100_000, 33)).toBe(67_000);
    expect(applyPercent(100_000, 100)).toBe(0);
  });

  it('leaves the amount alone for a zero or negative percentage', () => {
    expect(applyPercent(100_000, 0)).toBe(100_000);
    expect(applyPercent(100_000, -10)).toBe(100_000);
  });

  it('clamps a percentage above 100 rather than producing a negative price', () => {
    expect(applyPercent(100_000, 150)).toBe(0);
  });

  it('always returns a whole number of minor units', () => {
    // The danger is a discount that lands on 66.66666666666667 millimes and
    // travels into an order total as a float.
    for (const percent of [1, 3, 7, 13, 17, 33, 66, 99]) {
      expect(Number.isInteger(applyPercent(100_001, percent))).toBe(true);
    }
    expect(Number.isInteger(applyPercent(1, 50))).toBe(true);
  });
});

describe('sumMoney', () => {
  it('adds without floating-point drift', () => {
    // The classic 0.1 + 0.2 case, in minor units where it cannot happen.
    expect(sumMoney([100, 200])).toBe(300);
    expect(sumMoney([])).toBe(0);
  });
});

describe('minorDigits', () => {
  it('knows LYD has three', () => {
    expect(minorDigits('LYD')).toBe(3);
    expect(minorDigits('USD')).toBe(2);
  });

  it('falls back to two for an unknown currency', () => {
    expect(minorDigits('XXX')).toBe(2);
  });
});
