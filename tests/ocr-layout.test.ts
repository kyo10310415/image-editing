import test from 'node:test';
import assert from 'node:assert/strict';
import { getLayout, recognizeLayout } from '../src/ocr-layout.js';
import type Tesseract from 'tesseract.js';

test('Tesseract7 nested words and lines retain box data', () => {
  const word = { text: 'Fixture', bbox: { x0: 1, y0: 2, x1: 5, y1: 7 }, confidence: 95 };
  const line = { text: 'Fixture', words: [word], bbox: word.bbox, confidence: 95 };
  const page = { blocks: [{ paragraphs: [{ lines: [line] }] }] } as unknown as Tesseract.Page;
  assert.deepEqual(getLayout(page), { words: [word], lines: [line] });
  assert.deepEqual(getLayout({ blocks: null }), { words: [], lines: [] });
  assert.deepEqual(getLayout({ blocks: [] }), { words: [], lines: [] });
});

test('recognition requests blocks and terminates worker on success', async () => {
  const calls: unknown[] = []; const result = { data: { blocks: [] } };
  const factory = async (...args: unknown[]) => { calls.push(args); return {
    recognize: async (...args: unknown[]) => { calls.push(args); return result; },
    terminate: async () => { calls.push('terminated'); },
  }; };
  assert.equal(await recognizeLayout('synthetic-image', () => {}, factory as unknown as typeof Tesseract.createWorker), result);
  assert.equal((calls[0] as unknown[])[0], 'jpn+eng');
  assert.deepEqual(calls[1], ['synthetic-image', {}, { blocks: true }]);
  assert.equal(calls[2], 'terminated');
});

test('recognition failure still terminates worker', async () => {
  let terminated = false;
  const factory = async () => ({ recognize: async () => { throw Error('synthetic failure'); }, terminate: async () => { terminated = true; } });
  await assert.rejects(recognizeLayout('synthetic', () => {}, factory as unknown as typeof Tesseract.createWorker), /synthetic failure/);
  assert.equal(terminated, true);
});
