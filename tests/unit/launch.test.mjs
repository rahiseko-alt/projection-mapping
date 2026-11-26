import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChromeArgs, chromeCandidates, launchShow } from '../../server/launch.mjs';

test('展示用の Chrome は全画面・自動開始・指定の画面に出る', () => {
  const a = buildChromeArgs({ url: 'http://localhost:8787', profileDir: 'C:/x/.chrome-show', screenX: 1920 });
  assert.ok(a.includes('--kiosk'));
  assert.ok(a.includes('--window-position=1920,0'));
  assert.ok(a.includes('--autoplay-policy=no-user-gesture-required'));
  assert.equal(a.at(-1), 'http://localhost:8787?auto=1');
});

test('Chrome の場所は、指定 → Program Files → ユーザーの順に探す', () => {
  const c = chromeCandidates({ ISHI_CHROME: 'D:/chrome.exe', PROGRAMFILES: 'C:/Program Files', LOCALAPPDATA: 'C:/Users/u/AppData/Local' });
  assert.equal(c[0], 'D:/chrome.exe');
  assert.equal(c.length, 3);
});

test('Chrome が無ければ、理由を返して止まらない', () => {
  const r = launchShow({ url: 'u', root: '/r', exists: () => false });
  assert.equal(r.ok, false);
});
