// 展示の後の振り返り（自分で直す仕組み）。npm run review [日付]
// 1. その日のログから、場面ごとの効き目を測る（決まった計算）→ config/learned.json（展示中の頭脳が参考にする）
// 2. 振り返り役のエージェントが記録を読み、場面の設定を直す → config/presets.json、頭脳への改善メモ → config/notes.md
// 3. docs/agent/改善記録/<日付>.md に、測ったこと・直したこと（前→後と理由）を残す
// エージェントにつながらないときは、1 と 3（測ったことだけ）を行う。
import { writeFile, mkdir, readFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLog } from './log.mjs';
import { measureEffect, summarizeByForm } from './effect.mjs';
import { loadNotes, loadPresetOverrides } from './learned.mjs';
import { createReviewer } from './reviewer.mjs';
import { FORMS } from '../shared/scene.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const log = createLog(path.join(root, 'logs'));
const date = process.argv[2] || (await log.days()).at(-1);
if (!date) { console.log('ログがまだありません'); process.exit(0); }

const events = await log.read(date);
const results = measureEffect(events);
const byForm = summarizeByForm(results);
const speeches = events.filter((e) => e.type === 'speech').map((e) => e.text);
const errors = events.filter((e) => e.type === 'brain_error');
const name = (f) => FORMS[f] || f;

await writeFile(path.join(root, 'config/learned.json'), JSON.stringify({ updatedAt: date, byForm }, null, 2) + '\n');

const measured = [
  '## 測ったこと（自動の記録）',
  `- 場面を出した回数 ${results.length}（うち頭脳 ${results.filter((r) => r.source === 'agent').length}）、言葉 ${speeches.length} 件、頭脳の失敗 ${errors.length} 件`,
  ...byForm.map((s) => `- ${name(s.form)}: ${s.shown} 回、人の増え方 平均 ${s.avgGained}、握った手 平均 ${s.avgFists}`),
];

let body, changed = [];
if (process.env.ISHI_BRAIN === 'off') {
  body = ['## 振り返り', '- 振り返り役は止めてあります（ISHI_BRAIN=off）。測った数字だけを残しました'];
} else {
  try {
    const overrides = await loadPresetOverrides(root);
    const r = await createReviewer().review({ date, byForm, results, speeches, errors, overrides, notes: await loadNotes(root) });
    if (r.diffs.length) await writeFile(path.join(root, 'config/presets.json'), JSON.stringify(r.overrides, null, 2) + '\n');
    for (const n of r.notes) await appendFile(path.join(root, 'config/notes.md'), `- ${date}: ${n.replace(/\n/g, ' ')}\n`);
    changed = r.diffs;
    body = [
      r.report.trim(),
      '',
      '## 変えたこと（自動の記録）',
      ...(r.diffs.length ? r.diffs.map((d) => `- ${name(d.form)} の ${d.field}: ${JSON.stringify(d.before)} → ${JSON.stringify(d.after)}（理由: ${d.reason || 'なし'}）`) : ['- 設定は変えていません']),
      ...r.notes.map((n) => `- 頭脳への改善メモを追加: ${n}`),
      ...r.rejected.map((x) => `- 断った直し: ${name(x.form)}（${x.why}）`),
    ];
  } catch (e) {
    body = ['## 振り返り', `- 振り返り役につながりませんでした（${e.message}）。測った数字だけを残しました。Claude Code にログインしているか確かめてください`];
  }
}

const text = [`# 改善記録 ${date}`, '', ...measured, '', ...body].join('\n') + '\n';
const dir = path.join(root, 'docs/agent/改善記録');
await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, `${date}.md`), text);
console.log(text);
console.log(changed.length ? `設定を ${changed.length} か所直しました。次の npm start から使われます。` : '設定は変えていません。');
