import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCreatorTools, MAX_ATTEMPTS } from '../../server/creator.mjs';

const good = { id: 'aurora2', name: 'オーロラ', edge: 'wrap', draw: 'dot', code: 'const w = Math.sin(p.x * .004 + t * .7) * 60; p.vx = p.vx * .9 + .6 * sp; p.vy = p.vy * .9 + (H * .35 + w * p.k - p.y) * .02;', colors: ['#22ff99', '#3366ff', '#ccffee'], speed: 0.8, count: 600, keys: ['オーロラ'] };

function rig() {
  const files = {};
  const t = createCreatorTools({ root: '/r', writeFn: async (p, s) => { files[p] = s; }, mkdirFn: async () => {} });
  return { t, files };
}

test('確かめと試し動かしを通った場面だけを保存する', async () => {
  const { t, files } = rig();
  assert.match(await t.saveForm(good), /保存しました/);
  const saved = JSON.parse(files['/r/config/forms/aurora2.json']);
  assert.equal(saved.preset.keys[0], 'オーロラ');
});

test('通らないときは保存せず、理由を返して直させる', async () => {
  const { t, files } = rig();
  const msg = await t.saveForm({ ...good, code: 'p.x = 1; p.y = 1; p.vx = 0; p.vy = 0;' });
  assert.match(msg, /保存できませんでした.*固ま/);
  assert.equal(Object.keys(files).length, 0);
  assert.equal(t.state.failures.length, 1);
});

test(`試せるのは${MAX_ATTEMPTS}回まで`, async () => {
  const { t } = rig();
  for (let i = 0; i < MAX_ATTEMPTS; i++) await t.saveForm({ ...good, code: 'fetch(1)' });
  assert.match(await t.saveForm(good), /回まで/);
});

test('元からある場面の id は使えない', async () => {
  const { t } = rig();
  assert.match(await t.saveForm({ ...good, id: 'rain' }), /保存できませんでした/);
});

test('作った場面には、範囲に収めた音も一緒に保存する', async () => {
  const { t, files } = rig();
  await t.saveForm({ ...good, id: 'aurora3', sound: { base: 1000, wave: 'sine', bright: 0.5, pulse: 0.3, scale: 'calm' } });
  const saved = JSON.parse(files['/r/config/forms/aurora3.json']);
  assert.equal(saved.sound.base, 400);
});
