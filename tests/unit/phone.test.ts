import { describe, expect, it } from 'vitest';

import { formatPhone, isValidPhone, normalisePhone, toWhatsAppLink } from '@/lib/phone';

/**
 * Phone canonicalisation is what makes duplicate-order detection work: two
 * orders from the same customer must collapse onto the same customer record
 * whether the number was typed as 0912345678, +218 91 234 5678, or in
 * Arabic-Indic digits.
 */
describe('normalisePhone', () => {
  const canonical = '218912345678';

  it('canonicalises every way a Libyan number gets typed', () => {
    for (const input of [
      '0912345678',
      '912345678',
      '+218912345678',
      '00218912345678',
      '218912345678',
      '091 234 5678',
      '091-234-5678',
      '(091) 234 5678',
      '٠٩١٢٣٤٥٦٧٨',
    ]) {
      expect(normalisePhone(input, 'LY').canonical).toBe(canonical);
    }
  });

  it('keeps the national form a merchant would dial', () => {
    expect(normalisePhone('+218912345678', 'LY').national).toBe('0912345678');
  });

  it('marks a well-formed mobile number valid', () => {
    expect(isValidPhone('0912345678', 'LY')).toBe(true);
    expect(isValidPhone('0921234567', 'LY')).toBe(true);
  });

  it('flags — but does not discard — a number it cannot validate', () => {
    // A merchant taking an order by phone must never be blocked by our rules.
    const result = normalisePhone('12345', 'LY');
    expect(result.valid).toBe(false);
    expect(result.canonical).not.toBe('');
  });

  it('rejects a landline prefix as a mobile', () => {
    expect(isValidPhone('0212345678', 'LY')).toBe(false);
  });

  it('returns empty for empty input rather than throwing', () => {
    const result = normalisePhone('', 'LY');
    expect(result).toMatchObject({ canonical: '', national: '', valid: false });
  });

  it('handles other supported countries', () => {
    expect(normalisePhone('20123456789', 'EG').canonical).toBe('20123456789');
    expect(normalisePhone('+21620123456', 'TN').valid).toBe(true);
  });

  it('falls back to the default country for an unknown one', () => {
    expect(normalisePhone('0912345678', 'ZZ').country).toBe('LY');
  });
});

describe('formatPhone', () => {
  it('produces a readable national grouping', () => {
    expect(formatPhone('218912345678', 'LY')).toContain('091');
  });
});

describe('toWhatsAppLink', () => {
  it('builds a wa.me link from the canonical number', () => {
    expect(toWhatsAppLink('0912345678', 'LY')).toBe('https://wa.me/218912345678');
  });

  it('encodes a prefilled message', () => {
    const link = toWhatsAppLink('0912345678', 'LY', 'مرحبا');
    expect(link).toContain('text=');
    expect(link).not.toContain(' ');
  });
});
