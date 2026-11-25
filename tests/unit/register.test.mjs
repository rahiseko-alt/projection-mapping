import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCustomForm } from '../../shared/forms.mjs';
import { registerForm, FORMS, sanitizeScene, pickByKeyword } from '../../shared/scene.mjs';

const aurora = { id: 'aurora', name: 'オーロラ', edge: 'wrap', draw: 'dot', code: 'const w = Math.sin(p.x * .004 + t * .7) * 60; p.vx = p.vx * .9 + .6 * sp; p.vy = p.vy * .9 + (H * .35 + w * p.k - p.y) * .02;' };

test('保存された新しい場面を確かめて登録すると、命令とキーワードで使える', () => {
  const r = loadCustomForm(aurora);
  assert.deepEqual(r.errors, []);
  registerForm({ id: 'aurora', name: 'オーロラ', preset: { colors: ['#22ff99', '#3366ff', '#ccffee'], keys: ['オーロラ', '北'] } });
  assert.equal(FORMS.aurora, 'オーロラ');
  assert.equal(sanitizeScene({ form: 'aurora' }).scene.form, 'aurora');
  assert.equal(pickByKeyword('オーロラ見たい').form, 'aurora');
});

test('元の場面と同じ id や、決まりの外の定義は登録しない', () => {
  assert.ok(loadCustomForm({ ...aurora, id: 'rain' }).errors.length > 0);
  assert.ok(loadCustomForm({ ...aurora, id: 'Bad-ID' }).errors.length > 0);
  assert.ok(loadCustomForm({ ...aurora, edge: 'bounce' }).errors.length > 0);
});
