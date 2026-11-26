// 自分で直すための記録: 効き目（learned.json）と改善メモ（notes.md）を読む。
import { readFile, readdir } from 'node:fs/promises';
import { loadCustomForm } from '../shared/forms.mjs';
import { registerForm } from '../shared/scene.mjs';
import { sanitizeSound } from '../shared/sound.mjs';
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

/** config/forms/*.json の新しい場面を確かめて登録する。通らないものは理由つきで飛ばす。 */
export async function loadCustomForms(root) {
  const dir = path.join(root, 'config/forms');
  const loaded = [], skipped = [];
  let files = [];
  try { files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort(); } catch { return { loaded, skipped }; }
  for (const f of files) {
    let def;
    try { def = JSON.parse(await readFile(path.join(dir, f), 'utf8')); } catch (e) { skipped.push({ file: f, errors: ['JSON が読めない'] }); continue; }
    const r = loadCustomForm(def);
    if (r.errors.length) { skipped.push({ file: f, errors: r.errors }); continue; }
    registerForm({ id: def.id, name: r.form.name, preset: def.preset });
    loaded.push({ id: def.id, name: r.form.name, edge: def.edge, draw: def.draw, code: def.code, ...(def.sound ? { sound: sanitizeSound(def.sound) } : {}) });
  }
  return { loaded, skipped };
}
