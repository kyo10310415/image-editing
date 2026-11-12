import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';

test('public root renders without provider calls', async () => {
  const response = await app.request('/'); assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/html/);
});

test('price calculation uses existing rounding with synthetic input', async () => {
  const response = await app.request('/api/calculate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ discountRate: 10 }) });
  assert.equal(response.status, 200); const body = await response.json();
  assert.equal(body.prices.regular.discounted, 3960); assert.equal(body.prices.hard.discounted, 4455);
});

test('out-of-range discount rejected without image generation', async () => {
  const response = await app.request('/api/calculate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ discountRate: 101 }) });
  assert.equal(response.status, 400);
});
