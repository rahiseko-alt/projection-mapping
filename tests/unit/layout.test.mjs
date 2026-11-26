import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeLayout, surfaceCount, surfaceIds } from '../../shared/layout.mjs';

const quad = [[0, 0], [100, 0], [100, 50], [0, 50]];

test('四隅の補正と黒く塗る区域を、決まりの形に収めて残す', () => {
  const l = sanitizeLayout({
    surfaces: [{ id: 'surface', targetPoints: quad, sourcePoints: quad }, { id: 'evil', targetPoints: quad, sourcePoints: quad }, { id: 'surface2', targetPoints: [[0, 0]], sourcePoints: quad }],
    masks: [[[0.1, 0.1], [0.2, 0.1], [0.2, 2]], [[0, 0], [1, 1]], 'x'],
  });
  assert.deepEqual(l.surfaces.map((s) => s.id), ['surface']);
  assert.equal(l.masks.length, 1);
  assert.deepEqual(l.masks[0][2], [0.2, 1]); // 画面の外は端に寄せる
});

test('壊れた中身なら空にする', () => {
  assert.deepEqual(sanitizeLayout(null), { surfaces: [], masks: [] });
});

test('投影面は1〜4枚', () => {
  assert.equal(surfaceCount({}), 1);
  assert.equal(surfaceCount({ surfaces: 3 }), 3);
  assert.equal(surfaceCount({ surfaces: 9 }), 4);
  assert.deepEqual(surfaceIds(3), ['surface', 'surface2', 'surface3']);
});
