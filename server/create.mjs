// 新しい場面を作る。npm run create -- "オーロラみたいにゆらめく光"
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCustomForms } from './learned.mjs';
import { createCreator, recordCreation } from './creator.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const request = process.argv.slice(2).join(' ').trim();
if (!request) { console.log('作りたい光の様子を書いてください。例: npm run create -- "オーロラみたいにゆらめく光"'); process.exit(1); }
await loadCustomForms(root); // いまある場面と id が重ならないように
console.log(`場面を作っています: 「${request}」（1〜2分かかります）`);
try {
  const state = await createCreator({ root }).create(request);
  await recordCreation(root, request, state);
  if (state.saved) console.log(`できました: ${state.saved.name}（${state.saved.id}）。キーワード: ${state.saved.preset.keys.join('・')}\nnpm start し直すと使えます。合わなければ config/forms/${state.saved.id}.json を消してください。`);
  else console.log(`作れませんでした（${state.attempts}回試しました）。頼み方を変えてもう一度どうぞ。理由は docs/agent/場面づくり.md にあります。`);
} catch (e) {
  console.log(`場面づくり役につながりませんでした（${e.message}）。Claude Code にログインしているか確かめてください。`);
  process.exit(1);
}
