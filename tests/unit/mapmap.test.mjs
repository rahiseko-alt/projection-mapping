import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messagesFor } from '../../server/mapmap.mjs';

test('選んだ場面の層だけを見せ、ほかは消す', () => {
  const m = messagesFor('rain');
  assert.equal(m.length, 5);
  assert.deepEqual(m.find((x) => x.args[0] === 'rain*').args, ['rain*', 1]);
  assert.ok(m.filter((x) => x.args[1] === 0).length === 4);
  assert.equal(m[0].address, '/mapmap/mapping/opacity');
});

test('開発版の書き方と、層の名前の指定に切り替えられる', () => {
  const m = messagesFor('orbit', { style: 'dev', patterns: { orbit: '星*' } });
  assert.equal(m[0].address, '/mapmap/layer/opacity');
  assert.ok(m.some((x) => x.args[0] === '星*' && x.args[1] === 1));
});
