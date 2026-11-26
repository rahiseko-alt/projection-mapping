import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildField, sample, pushOut, GRID } from '../../shared/silhouette.mjs';

// 640x360 の映像の、左右の真ん中に縦長の人（x 280〜360）がいる
const mw = 640, mh = 360, mask = new Float32Array(mw * mh);
for (let y = 60; y < 360; y++) for (let x = 280; x < 360; x++) mask[y * mw + x] = 1;
const field = buildField(mask, mw, mh);

test('人のいる升目だけが濃くなる', () => {
  assert.equal(field.length, GRID.w * GRID.h);
  assert.ok(sample(field, 640, 400, 1280, 720, false) > 0.9);
  assert.equal(sample(field, 100, 400, 1280, 720, false), 0);
});

test('前向きのカメラでは左右を反転して重ねる', () => {
  // 映像の右寄りの人は、画面では左寄りに出る
  const m2 = new Float32Array(mw * mh); for (let y = 0; y < mh; y++) for (let x = 500; x < 600; x++) m2[y * mw + x] = 1;
  const f2 = buildField(m2, mw, mh);
  assert.ok(sample(f2, 200, 360, 1280, 720, true) > 0.9);
  assert.equal(sample(f2, 1100, 360, 1280, 720, true), 0);
});

test('人の端にいる粒は外へ押され、人の外の粒は押されない', () => {
  const at = (x, y) => sample(field, x, y, 1280, 720, false);
  const cw = 1280 / GRID.w, ch = 720 / GRID.h;
  assert.ok(pushOut(at, 566, 400, cw, ch).fx < 0, '左の端は左へ');
  assert.ok(pushOut(at, 714, 400, cw, ch).fx > 0, '右の端は右へ');
  assert.ok(pushOut(at, 640, 500, cw, ch).fy < 0, '体の真ん中は上へ');
  assert.deepEqual(pushOut(at, 100, 400, cw, ch), { fx: 0, fy: 0 });
});
