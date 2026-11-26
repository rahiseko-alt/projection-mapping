import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measureEffect, summarizeByForm } from '../../server/effect.mjs';

const t = (s) => new Date(Date.UTC(2026, 0, 1, 0, 0, s)).toISOString();
const events = [
  { at: t(0), type: 'audience', people: 1 },
  { at: t(1), type: 'scene', scene: { form: 'swarm' }, source: 'agent' },
  { at: t(3), type: 'gesture', kind: 'fist' },
  { at: t(5), type: 'audience', people: 3 },
  { at: t(30), type: 'scene', scene: { form: 'rain' }, source: 'keyword' },
  { at: t(32), type: 'audience', people: 1 },
];

test('場面の後に人が増え、手が動いた分を数える', () => {
  const r = measureEffect(events);
  assert.equal(r[0].form, 'swarm');
  assert.equal(r[0].gained, 2);
  assert.equal(r[0].fists, 1);
  assert.equal(r[1].gained, 0); // 人が減っても、前より増えなければ 0
});

test('場面ごとの効き目を、効いた順に並べる', () => {
  const s = summarizeByForm(measureEffect(events));
  assert.equal(s[0].form, 'swarm');
  assert.equal(s.length, 2);
});
