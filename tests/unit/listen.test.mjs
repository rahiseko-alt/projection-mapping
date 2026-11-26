import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createListener, speedBoost } from '../../shared/listen.mjs';

test('静かな中の拍手を1回として見つける', () => {
  const l = createListener();
  let hits = 0, t = 0;
  for (let i = 0; i < 120; i++) { if (l.push(0.01, t += 16).hit) hits++; }
  if (l.push(0.5, t += 16).hit) hits++;
  for (let i = 0; i < 5; i++) { if (l.push(0.45, t += 16).hit) hits++; } // 余韻は数えない
  assert.equal(hits, 1);
});

test('ずっと大きな音（音楽）には慣れて、拍手と数えない', () => {
  const l = createListener();
  let hits = 0, t = 0;
  for (let i = 0; i < 600; i++) { if (l.push(0.3, t += 16).hit && i > 300) hits++; }
  assert.equal(hits, 0);
});

test('にぎやかなほど、粒は速くなる（最大1.8倍）', () => {
  assert.equal(speedBoost(0), 1);
  assert.equal(speedBoost(1), 1.8);
  assert.equal(speedBoost(5), 1.8);
});
