import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, SYSTEM_PROMPT } from '../../server/brain.mjs';

test('頭脳への指示に、言葉・様子・直近の場面・効き目が入る', () => {
  const p = buildPrompt({ trigger: 'speech', text: '寂しいね', audience: { people: 2, hands: 1, fists: 0 }, history: ['swarm', 'rain'], learned: [{ form: 'orbit', avgGained: 1 }] });
  assert.match(p, /寂しいね/);
  assert.match(p, /人数 2/);
  assert.match(p, /swarm → rain/);
  assert.match(p, /orbit/);
});

test('決まり（5つの場面・30字・3回続けない）が指示に書かれている', () => {
  for (const k of ['flow', 'bloom', 'swarm', 'rain', 'orbit', '30字', '3回続けない']) assert.ok(SYSTEM_PROMPT.includes(k), k);
});
