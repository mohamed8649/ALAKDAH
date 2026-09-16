import { describe, expect, it } from 'vitest';

import {
  BLOCK_TYPES,
  createBlock,
  defaultProps,
  normaliseDocument,
} from '@/features/pages/blocks';

/**
 * The page builder is the one place a merchant's input becomes page structure,
 * so it is the obvious injection surface. `normaliseDocument` is the gate:
 * whatever a client posts, only known block types with schema-valid props
 * reach the database. These tests are that guarantee written down.
 */
describe('normaliseDocument', () => {
  it('keeps a well-formed document', () => {
    const document = normaliseDocument({
      version: 1,
      blocks: [{ id: 'b1', type: 'text', props: { content: 'مرحبا', align: 'center' } }],
    });

    expect(document.blocks).toHaveLength(1);
    expect(document.blocks[0]).toMatchObject({ id: 'b1', type: 'text' });
    expect(document.blocks[0]?.props.content).toBe('مرحبا');
  });

  it('drops a block type it does not recognise', () => {
    const document = normaliseDocument({
      version: 1,
      blocks: [
        { id: 'b1', type: 'script', props: { src: 'https://evil.example/x.js' } },
        { id: 'b2', type: 'text', props: { content: 'ok' } },
      ],
    });

    expect(document.blocks.map((block) => block.type)).toEqual(['text']);
  });

  it('strips props the schema does not declare', () => {
    const document = normaliseDocument({
      version: 1,
      blocks: [
        {
          id: 'b1',
          type: 'text',
          props: { content: 'ok', onClick: 'alert(1)', dangerouslySetInnerHTML: '<script>' },
        },
      ],
    });

    const props = document.blocks[0]?.props ?? {};
    expect(props).not.toHaveProperty('onClick');
    expect(props).not.toHaveProperty('dangerouslySetInnerHTML');
    expect(props.content).toBe('ok');
  });

  it('falls back to defaults when props are the wrong shape entirely', () => {
    const document = normaliseDocument({
      version: 1,
      blocks: [{ id: 'b1', type: 'text', props: 'not an object' }],
    });

    expect(document.blocks).toHaveLength(1);
    expect(document.blocks[0]?.props).toEqual(defaultProps('text'));
  });

  it('confines a video block to a provider and an id', () => {
    const document = normaliseDocument({
      version: 1,
      blocks: [
        {
          id: 'b1',
          type: 'video',
          props: { provider: 'youtube', videoId: 'abc123', embedHtml: '<iframe src="x">' },
        },
      ],
    });

    const props = document.blocks[0]?.props ?? {};
    expect(props).toEqual({ provider: 'youtube', videoId: 'abc123' });
  });

  it('rejects an unknown video provider rather than passing it through', () => {
    const document = normaliseDocument({
      version: 1,
      blocks: [{ id: 'b1', type: 'video', props: { provider: 'evil', videoId: 'x' } }],
    });

    expect(document.blocks[0]?.props.provider).toBe('youtube');
  });

  it('returns an empty document for anything unparseable', () => {
    for (const input of [null, undefined, 'string', 42, [], { blocks: 'no' }]) {
      expect(normaliseDocument(input)).toEqual({ version: 1, blocks: [] });
    }
  });

  it('is idempotent', () => {
    const once = normaliseDocument({
      version: 1,
      blocks: [{ id: 'b1', type: 'hero', props: {} }],
    });
    expect(normaliseDocument(once)).toEqual(once);
  });
});

describe('every block type', () => {
  it('has usable defaults', () => {
    for (const type of BLOCK_TYPES) {
      expect(() => defaultProps(type)).not.toThrow();
    }
  });

  it('survives a round trip through normalisation', () => {
    const blocks = BLOCK_TYPES.map((type) => createBlock(type));
    const document = normaliseDocument({ version: 1, blocks });

    expect(document.blocks).toHaveLength(BLOCK_TYPES.length);
    expect(document.blocks.map((block) => block.type)).toEqual([...BLOCK_TYPES]);
  });

  it('gives each created block a distinct id', () => {
    const ids = Array.from({ length: 50 }, () => createBlock('text').id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
