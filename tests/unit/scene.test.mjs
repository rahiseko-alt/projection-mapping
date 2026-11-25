import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeScene, pickByKeyword, wouldRepeatThrice, idleScene } from '../../shared/scene.mjs';

test('範囲内の命令はそのまま通る', () => {
  const { scene, errors } = sanitizeScene({ form: 'rain', colors: ['#000000', '#111111', '#222222'], speed: 1.2, count: 700, reply: '雨が避けていく' });
  assert.deepEqual(errors, []);
  assert.equal(scene.form, 'rain');
  assert.equal(scene.count, 700);
});

test('範囲外の項目は捨てて理由を返す', () => {
  const { scene, errors } = sanitizeScene({ form: 'fire', colors: ['red'], speed: 9, count: 10 });
  assert.deepEqual(scene, {});
  assert.equal(errors.length, 4);
});

test('返事は30字に切り詰める', () => {
  const { scene, errors } = sanitizeScene({ reply: 'あ'.repeat(40) });
  assert.equal([...scene.reply].length, 30);
  assert.equal(errors.length, 1);
});

test('気分の言葉で場面を選ぶ', () => {
  assert.equal(pickByKeyword('なんか悲しい').form, 'rain');
  assert.equal(pickByKeyword('もっと！').form, 'swarm');
  assert.equal(pickByKeyword('寂しいね').form, 'orbit');
});

test('同じ場面を3回続けない', () => {
  assert.equal(wouldRepeatThrice(['rain', 'rain'], 'rain'), true);
  assert.notEqual(pickByKeyword('悲しい', ['rain', 'rain']).form, 'rain');
});

test('人がいないときは静かな場面で返事なし', () => {
  const s = idleScene(['swarm']);
  assert.ok(['flow', 'bloom'].includes(s.form));
  assert.equal(s.reply, undefined);
});
