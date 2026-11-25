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

test('考えている間に別の場面が出たら、古い答えは映さない', async () => {
  let release;
  const { d, sent } = rig({ timeoutMs: 1000, brain: { decide: () => new Promise((r) => { release = r; }) } });
  const first = d.onSpeech('寂しいね');      // 頭脳が考え中
  await d.onSpeech('悲しい');                  // その間の言葉はキーワードで即答
  release({ form: 'orbit', reply: '古い返事' });
  await first;
  assert.equal(sent.length, 1);
  assert.equal(sent[0].scene.form, 'rain');
});

test('時間切れのときは、頭脳に止める合図を送る', async () => {
  let gotSignal;
  const { d } = rig({ timeoutMs: 30, brain: { decide: (_, { signal }) => { gotSignal = signal; return new Promise(() => {}); } } });
  await d.onSpeech('a');
  assert.equal(gotSignal.aborted, true);
});

test('3回続くのを差し替えるときは、返事も差し替え先のものにする', async () => {
  const { d, sent } = rig({ brain: { decide: async () => ({ form: 'rain', reply: '雨の返事' }) } });
  await d.onSpeech('a'); await d.onSpeech('b'); await d.onSpeech('c');
  assert.notEqual(sent[2].scene.form, 'rain');
  assert.notEqual(sent[2].scene.reply, '雨の返事');
});

test('閉まっている間は言葉に答えない', async () => {
  let asked = 0;
  const { d, sent } = rig({ brain: { decide: async () => { asked++; return { form: 'orbit' }; } } });
  d.setOpen(false);
  await d.onSpeech('寂しいね');
  assert.equal(sent.length, 0);
  assert.equal(asked, 0);
});
