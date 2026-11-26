import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOpen, sanitizeSchedule, justClosed } from '../../shared/schedule.mjs';

const at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi);
// 2026-11-23 は月曜日

test('時間割が無ければ、いつでも開いている', () => {
  assert.equal(isOpen(undefined, at(2026, 11, 23, 3, 0)), true);
  assert.equal(isOpen({ open: '10:00', close: '10:00' }, at(2026, 11, 23, 3, 0)), true);
});

test('開く時刻から閉まる時刻の前まで開いている', () => {
  const s = { days: [1, 2, 3, 4, 5], open: '10:00', close: '18:00' };
  assert.equal(isOpen(s, at(2026, 11, 23, 9, 59)), false);
  assert.equal(isOpen(s, at(2026, 11, 23, 10, 0)), true);
  assert.equal(isOpen(s, at(2026, 11, 23, 17, 59)), true);
  assert.equal(isOpen(s, at(2026, 11, 23, 18, 0)), false);
});

test('休みの曜日は開かない', () => {
  const s = { days: [1, 2, 3, 4, 5], open: '10:00', close: '18:00' };
  assert.equal(isOpen(s, at(2026, 11, 29, 12, 0)), false); // 日曜
});

test('夜をまたぐ時間割（18時〜翌2時）', () => {
  const s = { days: [5], open: '18:00', close: '02:00' }; // 金曜の夜
  assert.equal(isOpen(s, at(2026, 11, 27, 23, 0)), true);  // 金
  assert.equal(isOpen(s, at(2026, 11, 28, 1, 30)), true);  // 土の深夜
  assert.equal(isOpen(s, at(2026, 11, 28, 2, 0)), false);
});

test('おかしな時刻は「いつでも開いている」に倒す', () => {
  assert.equal(sanitizeSchedule({ open: '25:00', close: '18:00' }).always, true);
});

test('開いていた → 閉まった、のときだけ振り返りの合図', () => {
  assert.equal(justClosed(true, false), true);
  assert.equal(justClosed(false, false), false);
  assert.equal(justClosed(undefined, false), false);
});

test('一度整えた時間割を渡しても、同じ答えになる（受付役は整えた時間割を使う）', () => {
  const raw = { open: '00:00', close: '01:00' };
  const t = at(2026, 11, 23, 22, 0);
  assert.equal(isOpen(sanitizeSchedule(raw), t), isOpen(raw, t));
  assert.equal(isOpen(sanitizeSchedule(raw), t), false);
});
