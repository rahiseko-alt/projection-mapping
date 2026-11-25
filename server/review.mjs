// 展示の後の振り返り（自分で直す仕組み）。npm run review [日付]
// 1. その日のログから、場面ごとの効き目を測る
// 2. config/learned.json を書き換える（次の展示で頭脳が参考にする）
// 3. docs/agent/改善記録/<日付>.md に、何を測り、何を変えたかを残す
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLog } from './log.mjs';
import { measureEffect, summarizeByForm } from './effect.mjs';
import { FORMS } from '../shared/scene.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const log = createLog(path.join(root, 'logs'));
const date = process.argv[2] || (await log.days()).at(-1);
if (!date) { console.log('ログがまだありません'); process.exit(0); }

const events = await log.read(date);
const results = measureEffect(events);
const byForm = summarizeByForm(results);
const before = await readFile(path.join(root, 'config/learned.json'), 'utf8').then(JSON.parse).catch(() => ({ byForm: [] }));
const speech = events.filter((e) => e.type === 'speech').length;
const fromAgent = results.filter((r) => r.source === 'agent').length;
const errors = events.filter((e) => e.type === 'brain_error').length;

const learned = { updatedAt: date, byForm };
await writeFile(path.join(root, 'config/learned.json'), JSON.stringify(learned, null, 2) + '\n');

const best = byForm[0], worst = byForm.at(-1);
const lines = [
  `# 改善記録 ${date}`,
  '',
  '## 測ったこと',
  `- 場面を出した回数 ${results.length}（うち頭脳 ${fromAgent}）、言葉 ${speech} 件、頭脳の失敗 ${errors} 件`,
  ...byForm.map((s) => `- ${FORMS[s.form] || s.form}: ${s.shown} 回、人の増え方 平均 ${s.avgGained}、握った手 平均 ${s.avgFists}`),
  '',
  '## 変えたこと',
  `- config/learned.json を更新（前回 ${before.updatedAt || 'なし'} → ${date}）。次の展示では、効いた順「${byForm.map((s) => FORMS[s.form] || s.form).join(' > ')}」を頭脳が参考にする`,
  '',
  '## 次に試すこと',
  best && best.avgGained + best.avgFists > 0 ? `- よく効いた「${FORMS[best.form] || best.form}」を、人が少ないときの呼び込みにも使ってみる` : '- 記録が少ないので、次の展示でもう一度測る',
  worst && worst !== best ? `- 効きの弱い「${FORMS[worst.form] || worst.form}」は、色か速さを変えて試す` : null,
  errors > 0 ? `- 頭脳の失敗が ${errors} 件。ログの brain_error を見て原因を直す` : null,
].filter((l) => l !== null);
const dir = path.join(root, 'docs/agent/改善記録');
await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, `${date}.md`), lines.join('\n') + '\n');
console.log(lines.join('\n'));
