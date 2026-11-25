// 展示用に Chrome を開く（show.bat から）。全画面・操作板なし・カメラと音を自動で始める。
// プロジェクターが2枚目の画面なら、config/show.json の screenX（例: 1920）でその画面に出す。
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

export function chromeCandidates(env = process.env) {
  return [
    env.ISHI_CHROME,
    env.PROGRAMFILES && path.win32.join(env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
    env['PROGRAMFILES(X86)'] && path.win32.join(env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
    env.LOCALAPPDATA && path.win32.join(env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
  ].filter(Boolean);
}

export function buildChromeArgs({ url, profileDir, screenX = 0, screenY = 0 }) {
  return [
    `--user-data-dir=${profileDir}`, // 展示用の Chrome（カメラの許可をここに覚える）
    '--kiosk',
    `--window-position=${Math.round(Number(screenX) || 0)},${Math.round(Number(screenY) || 0)}`,
    '--autoplay-policy=no-user-gesture-required', // ボタンを押さなくても音を出す
    '--no-first-run', '--disable-session-crashed-bubble', '--disable-infobars',
    `${url}?auto=1`,
  ];
}

export function launchShow({ url, root, show = {}, exists = existsSync, run = spawn }) {
  const chrome = chromeCandidates().find((p) => exists(p));
  if (!chrome) return { ok: false, reason: 'Chrome が見つかりません（ISHI_CHROME に chrome.exe の場所を入れてください）' };
  const args = buildChromeArgs({ url, profileDir: path.join(root, '.chrome-show'), screenX: show.screenX, screenY: show.screenY });
  run(chrome, args, { detached: true, stdio: 'ignore' }).unref();
  return { ok: true, chrome };
}
