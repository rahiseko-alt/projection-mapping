import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_FORMS, checkFormCode, compileMove, trialRun } from '../../shared/forms.mjs';

test('元からある5つの場面は、試し動かしに通る', () => {
  for (const f of BUILTIN_FORMS) {
    const r = trialRun(f.move, f);
    assert.ok(r.ok, `${f.id}: ${r.errors.join(' / ')}`);
  }
});

test('画面の外に触る・止まらない書き方は断る', () => {
  for (const bad of ['fetch("x")', 'while(true){}', 'window.x=1', 'for(;;){}', 'p.vx = (() => 1)()', 'new Date()']) {
    assert.ok(checkFormCode(bad).length > 0, bad);
  }
  assert.deepEqual(checkFormCode('p.vx += Math.sin(t + p.a) * sp; p.vy *= .95;'), []);
});

test('壊れる動き・消える動き・固まる動きは、試し動かしで落ちる', () => {
  const form = { edge: 'wrap' };
  assert.equal(trialRun(compileMove('p.vx = 0/0;'), form).ok, false);
  assert.equal(trialRun(compileMove('p.vx = p.missing.x;'), form).ok, false);
  assert.equal(trialRun(compileMove('p.x = 5; p.y = 5; p.vx = 0; p.vy = 0;'), form).ok, false);
});

test('ふつうの新しい動きは通る', () => {
  const code = 'const ang = p.a + t * .3 * sp; p.vx = p.vx * .9 + Math.cos(ang + p.y * .004) * .8 * sp; p.vy = p.vy * .9 + Math.sin(t * .5 + p.x * .003) * .3 * sp; if (d < 150) { p.vx -= dx / d; p.vy -= dy / d; }';
  const r = trialRun(compileMove(code), { edge: 'wrap' });
  assert.ok(r.ok, r.errors.join(' / '));
});

test('文字列の組み立てで外に触る書き方も断る', () => {
  assert.ok(checkFormCode("Math['con'+'structor']").length > 0);
  assert.ok(checkFormCode('p.vx = Math.sin(t)["x"]').length > 0);
});

test('文字の書き換え（\\u）や別の名前で、外に触る書き方も断る', () => {
  for (const bad of [
    'var m=\\u0070rocess.getBuiltinModule(String.fromCharCode(102,115));',
    'const m = \\u0066etch;',
    'p.vx = Math.constructor;',
    'function g(){} p.vx = 1;',
    'p.x = 5;',
    'f.x = 1;',
    'const a = String(1);',
    'const p2 = p; p2.vx = 1;',
    'Math.sin = 1;',
  ]) assert.ok(checkFormCode(bad).length > 0, bad);
});

test('元からある5つの場面の動きは、決まりの書き方に収まっている', () => {
  for (const f of BUILTIN_FORMS) {
    const body = f.move.toString().replace(/^move\([^)]*\)\s*\{/, '').replace(/\}$/, '');
    assert.deepEqual(checkFormCode(body), [], f.id);
  }
});
