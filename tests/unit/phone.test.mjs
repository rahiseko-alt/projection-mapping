import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPhoneGate, lanAddress, isLoopback, PHONE_LIMITS } from '../../server/phone.mjs';

test('スマホからの言葉は40字まで、5秒に1回まで', () => {
  let t = 0; const g = createPhoneGate({ now: () => t });
  const a = g.accept(JSON.stringify({ type: 'speech', text: 'あ'.repeat(60) }));
  assert.equal([...a.text].length, PHONE_LIMITS.textChars);
  t = 1000; assert.equal(g.accept({ type: 'speech', text: 'もう一回' }), null);
  t = 6000; assert.equal(g.accept({ type: 'speech', text: 'もう一回' }).text, 'もう一回');
});

test('なでる合図は画面の中の位置だけ、1秒に15回まで', () => {
  let t = 0; const g = createPhoneGate({ now: () => t });
  assert.equal(g.accept({ type: 'touch', x: 2, y: 0.5 }), null);
  let ok = 0; for (let i = 0; i < 30; i++) if (g.accept({ type: 'touch', x: 0.5, y: 0.5 })) ok++;
  assert.equal(ok, 15);
  t = 1000; assert.ok(g.accept({ type: 'touch', x: 0.1, y: 0.9, tap: true }).tap);
});

test('ほかの種類の合図や壊れた合図は受け取らない', () => {
  const g = createPhoneGate();
  assert.equal(g.accept('{bad'), null);
  assert.equal(g.accept({ type: 'scene', scene: { form: 'rain' } }), null);
});

test('同じ Wi-Fi の住所を選び、自分自身の住所は見分ける', () => {
  const ifaces = { lo: [{ family: 'IPv4', address: '127.0.0.1', internal: true }], wifi: [{ family: 'IPv6', address: 'fe80::1', internal: false }, { family: 'IPv4', address: '192.168.1.23', internal: false }] };
  assert.equal(lanAddress(ifaces), '192.168.1.23');
  assert.equal(lanAddress({}), null);
  assert.ok(isLoopback('::ffff:127.0.0.1'));
  assert.ok(!isLoopback('192.168.1.5'));
});
