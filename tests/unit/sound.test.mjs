import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soundFor, sanitizeSound, chimeFreq, BUILTIN_SOUNDS } from '../../shared/sound.mjs';

test('元の5つの場面は、それぞれ違う音になる', () => {
  const keys = Object.keys(BUILTIN_SOUNDS).map((f) => JSON.stringify(soundFor(f)));
  assert.equal(new Set(keys).size, 5);
});

test('新しい場面は保存された音を、範囲に収めて使う', () => {
  const s = soundFor('aurora', { aurora: { base: 9999, wave: 'noise', bright: 0.9, pulse: 1, scale: 'bright' } });
  assert.equal(s.base, 400);
  assert.equal(s.wave, 'sine');
  assert.equal(s.scale, 'bright');
});

test('音の指定が無い新しい場面にも、決まった範囲の音が付く', () => {
  const s = soundFor('mystery');
  assert.deepEqual(sanitizeSound(s), s);
  assert.deepEqual(soundFor('mystery'), s); // 毎回同じ音
});

test('鈴は音階を巡り、聞こえる高さに収まる', () => {
  const s = soundFor('rain');
  const f = [0, 1, 2, 3, 4, 5].map((n) => chimeFreq(s, n));
  assert.equal(new Set(f).size, 6);
  assert.ok(f.every((x) => x > 200 && x < 2000));
});
