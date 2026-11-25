import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDirector } from '../../server/director.mjs';

function rig({ brain, timeoutMs = 50 } = {}) {
  const sent = [], logged = [];
  let clock = 0;
  const d = createDirector({ brain, timeoutMs, idleMs: 1000, now: () => clock, log: { write: async (e) => logged.push(e) }, broadcast: (m) => sent.push(m) });
  return { d, sent, logged, tick: (ms) => { clock += ms; } };
}

test('エージェントの答えを、決まりに収めて映す', async () => {
  const { d, sent } = rig({ brain: { decide: async () => ({ form: 'orbit', colors: ['#6b5cff', '#b9b3ff', '#ffffff'], speed: 0.7, reply: 'あなたのそばで回ります' }) } });
  await d.onSpeech('寂しいね');
  assert.equal(sent[0].scene.form, 'orbit');
  assert.equal(sent[0].source, 'agent');
});

test('答えが遅れたらキーワードで代わりに映す', async () => {
  const { d, sent, logged } = rig({ brain: { decide: () => new Promise(() => {}) } });
  await d.onSpeech('悲しい');
  assert.equal(sent[0].source, 'keyword');
  assert.equal(sent[0].scene.form, 'rain');
  assert.ok(logged.some((e) => e.type === 'brain_error'));
});

test('エージェントが無くても動く', async () => {
  const { d, sent } = rig();
  await d.onSpeech('もっと！');
  assert.equal(sent[0].scene.form, 'swarm');
});

test('同じ場面を3回続けて出さない', async () => {
  const { d, sent } = rig({ brain: { decide: async () => ({ form: 'rain' }) } });
  await d.onSpeech('a'); await d.onSpeech('b'); await d.onSpeech('c');
  assert.notEqual(sent[2].scene.form, 'rain');
});

test('人がいない状態が続いたら、静かな場面を1回だけ出す', async () => {
  const { d, sent, tick } = rig();
  await d.onAudience({ people: 0 }); tick(1500);
  await d.onAudience({ people: 0 }); tick(1500);
  await d.onAudience({ people: 0 });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].source, 'idle');
  assert.equal(sent[0].scene.reply, undefined);
});
