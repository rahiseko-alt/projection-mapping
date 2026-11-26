import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { listMedia, pickMedia } from '../../server/media.mjs';

test('場面のフォルダの動画と画像だけを、その場面の素材として並べる', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'media-'));
  await mkdir(path.join(dir, 'rain')); await mkdir(path.join(dir, 'all')); await mkdir(path.join(dir, 'Bad Name'));
  await writeFile(path.join(dir, 'rain', 'b.mp4'), 'x');
  await writeFile(path.join(dir, 'rain', 'a 雨.JPG'), 'x');
  await writeFile(path.join(dir, 'rain', 'memo.txt'), 'x');
  await writeFile(path.join(dir, 'all', 'sky.png'), 'x');
  await writeFile(path.join(dir, 'Bad Name', 'x.png'), 'x');
  const m = await listMedia(dir);
  assert.deepEqual(Object.keys(m).sort(), ['all', 'rain']);
  assert.deepEqual(m.rain.map((x) => x.kind), ['image', 'video']);
  assert.equal(m.rain[0].url, '/media/rain/a%20%E9%9B%A8.JPG');
});

test('専用の素材が無い場面は all を使い、何も無ければ背景なし', () => {
  const m = { rain: [{ url: '/r1' }, { url: '/r2' }], all: [{ url: '/a' }] };
  assert.equal(pickMedia(m, 'rain', 1).url, '/r2');
  assert.equal(pickMedia(m, 'swarm').url, '/a');
  assert.equal(pickMedia({}, 'swarm'), null);
});

test('media フォルダが無くても止まらない', async () => {
  assert.deepEqual(await listMedia('/no/such/dir'), {});
});
