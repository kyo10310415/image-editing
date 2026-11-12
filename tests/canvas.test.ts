import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, loadImage } from 'canvas';
import { editImageWithUserCoordinates } from '../src/coordinate-canvas-editor.js';

test('real native canvas edits synthetic data URL and emits readable PNG', async () => {
  const canvas = createCanvas(320, 160); const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 320, 160);
  const result = await editImageWithUserCoordinates({ imageUrl: canvas.toDataURL('image/png'),
    campaignTitle: 'Fixture', discountRate: 10, regularPrice: 1000, hardPrice: 900,
    coordinates: { campaign: { x: 10, y: 10, width: 280, height: 45 } },
  });
  assert.match(result, /^data:image\/png;base64,/);
  const image = await loadImage(result); assert.equal(image.width, 320); assert.equal(image.height, 160);
  assert.notEqual(result, canvas.toDataURL('image/png'));
});

test('invalid synthetic image reports failure without network', async () => {
  await assert.rejects(editImageWithUserCoordinates({ imageUrl: 'data:image/png;base64,broken', campaignTitle: '', discountRate: 0, regularPrice: 0, hardPrice: 0, coordinates: {} }), /editing failed/);
});
