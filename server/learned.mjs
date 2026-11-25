// 自分で直すための記録: 効き目（learned.json）と改善メモ（notes.md）を読む。
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function loadLearned(root) {
  try { return JSON.parse(await readFile(path.join(root, 'config/learned.json'), 'utf8')).byForm || []; } catch { return []; }
}
export async function loadNotes(root) {
  try { return (await readFile(path.join(root, 'config/notes.md'), 'utf8')).slice(0, 2000); } catch { return ''; }
}

export async function loadPresetOverrides(root) {
  try { return JSON.parse(await readFile(path.join(root, 'config/presets.json'), 'utf8')); } catch { return {}; }
}
