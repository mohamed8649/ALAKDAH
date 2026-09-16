import { describe, expect, it } from 'vitest';

import { parseDelimited, toRowObjects } from '@/lib/delimited';

/**
 * Real merchant spreadsheets are messy: exported from Excel with CRLF and a
 * BOM, saved with a semicolon delimiter by a locale that uses the comma as a
 * decimal separator, and containing addresses with commas in them. Each of
 * these has its own test because each one silently corrupts an import.
 */
describe('parseDelimited', () => {
  it('reads a plain comma-separated file', () => {
    const { columns, rows } = parseDelimited('name,price\nشاي,25\nقهوة,30');
    expect(columns).toEqual(['name', 'price']);
    expect(rows).toEqual([
      ['شاي', '25'],
      ['قهوة', '30'],
    ]);
  });

  it('keeps a delimiter that sits inside a quoted field', () => {
    const { rows } = parseDelimited('name,address\n"شاي","طرابلس, حي الأندلس"');
    expect(rows[0]).toEqual(['شاي', 'طرابلس, حي الأندلس']);
  });

  it('unescapes a doubled quote', () => {
    const { rows } = parseDelimited('name\n"قال ""مرحبا"""');
    expect(rows[0]?.[0]).toBe('قال "مرحبا"');
  });

  it('strips a UTF-8 BOM so it does not become part of the first column name', () => {
    const { columns } = parseDelimited('﻿name,price\nشاي,25');
    expect(columns[0]).toBe('name');
  });

  it('handles CRLF line endings from Excel', () => {
    const { columns, rows } = parseDelimited('name,price\r\nشاي,25\r\n');
    expect(columns).toEqual(['name', 'price']);
    expect(rows).toEqual([['شاي', '25']]);
  });

  it('detects a semicolon delimiter', () => {
    const { columns, rows } = parseDelimited('name;price\nشاي;25');
    expect(columns).toEqual(['name', 'price']);
    expect(rows[0]).toEqual(['شاي', '25']);
  });

  it('detects a tab delimiter', () => {
    const { columns } = parseDelimited('name\tprice\nشاي\t25');
    expect(columns).toEqual(['name', 'price']);
  });

  it('drops blank trailing lines', () => {
    const { rows } = parseDelimited('name\nشاي\n\n\n');
    expect(rows).toHaveLength(1);
  });

  it('names an unnamed column rather than losing it', () => {
    const { columns } = parseDelimited('name,,price\nشاي,x,25');
    expect(columns).toEqual(['name', 'column_2', 'price']);
  });

  it('returns no rows for a header-only file', () => {
    const { columns, rows } = parseDelimited('name,price');
    expect(columns).toEqual(['name', 'price']);
    expect(rows).toEqual([]);
  });

  it('does not throw on empty input', () => {
    expect(() => parseDelimited('')).not.toThrow();
  });
});

describe('toRowObjects', () => {
  it('keys each row by column name and trims values', () => {
    const objects = toRowObjects(parseDelimited('name,price\n  شاي  , 25 '));
    expect(objects).toEqual([{ name: 'شاي', price: '25' }]);
  });

  it('fills a short row rather than shifting its values', () => {
    // A row with fewer cells than the header must not slide "25" into `price`
    // when it belongs to a column that is missing entirely.
    const objects = toRowObjects(parseDelimited('name,sku,price\nشاي,25'));
    expect(objects[0]).toEqual({ name: 'شاي', sku: '25', price: '' });
  });
});
