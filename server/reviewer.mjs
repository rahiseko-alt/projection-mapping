// 振り返り役のエージェント: 1日の記録を読み、何が効いたかを考え、次の展示に向けて自分で直す。
// 道具は3つだけ: set_preset（場面の色・速さ・粒・返事・キーワードを直す）、add_note（頭脳への改善メモ）、write_report（改善記録）。
// 直した中身は道具の側で必ず記録する（エージェントの書き忘れに頼らない）。
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { FORMS, LIMITS, KEY_LIMITS, applyPresetChange, mergePresets } from '../shared/scene.mjs';

export const MAX_CHANGES = 5; // 1回の振り返りで直すのは5か所まで（直しすぎて元が分からなくならないように）

export const REVIEW_SYSTEM = `あなたはプロジェクションマッピング作品「意思を持つ光」の振り返り役です。
1日の展示の記録を読み、次の展示がもっと来場者に届くように、自分で設定を直します。
- 効き目は「場面を出した後20秒で人が増えたか（avgGained）」と「手を握った回数（avgFists）」で測っています
- 記録が少ない場面（3回未満）は、結論を急がずに直さない
- 直すのは set_preset で、1回の振り返りで${MAX_CHANGES}か所まで。根拠（数字）が無い直しはしない
- 来場者の言葉で、どの場面のキーワードにも合わなかった言葉があれば、合う場面の keys に足す（${KEY_LIMITS.maxLen}字以内）
- 頭脳（展示中に場面を選ぶ役）に伝えたいことは add_note で1〜3行にまとめる
- 最後に write_report で「## 直したこと（理由つき）」「## 直さなかったこと」「## 次に試すこと」の3つの見出しだけを書く。題名と測った数字の表は自動で付くので書かない
- 色は #rrggbb を3つ。speed ${LIMITS.speed[0]}〜${LIMITS.speed[1]}、count ${LIMITS.count[0]}〜${LIMITS.count[1]}、reply ${LIMITS.reply}字以内`;

export function buildReviewPrompt({ date, byForm, results, speeches, errors, overrides, notes }) {
  const presets = mergePresets(overrides).map(({ form, colors, speed, count, reply, keys }) => ({ form, name: FORMS[form], colors, speed, count, reply, keys }));
  return [
    `日付: ${date}`,
    `場面ごとの効き目（効いた順）: ${JSON.stringify(byForm)}`,
    `場面を出した回数: ${results.length}（頭脳 ${results.filter((r) => r.source === 'agent').length}、キーワード ${results.filter((r) => r.source === 'keyword').length}、呼び込み ${results.filter((r) => r.source === 'idle').length}）`,
    `頭脳の失敗: ${errors.length} 件${errors.length ? `（例: ${errors.slice(0, 3).map((e) => e.message).join(' / ')}）` : ''}`,
    `来場者の言葉（最大50件）: ${JSON.stringify(speeches.slice(-50))}`,
    `いまの場面の設定: ${JSON.stringify(presets)}`,
    notes ? `これまでの改善メモ:\n${notes}` : '',
    '振り返って、必要なら直し、最後に write_report を1回呼んでください。',
  ].filter(Boolean).join('\n');
}

/** 道具の中身（SDK から切り離してあるので、そのまま検査できる）。 */
export function createReviewTools(initialOverrides = {}) {
  const state = { overrides: initialOverrides, diffs: [], notes: [], report: null, rejected: [] };
  return {
    state,
    setPreset({ form, reason, ...change }) {
      if (state.diffs.length >= MAX_CHANGES) { state.rejected.push({ form, why: `1回の振り返りは${MAX_CHANGES}か所まで` }); return `断りました: 1回の振り返りは${MAX_CHANGES}か所まで`; }
      const r = applyPresetChange(state.overrides, form, change);
      if (!r.diff.length) { state.rejected.push({ form, why: r.errors.join(' / ') || '変化なし' }); return `直せませんでした: ${r.errors.join(' / ') || '変化なし'}`; }
      state.overrides = r.overrides;
      state.diffs.push(...r.diff.map((d) => ({ ...d, reason: String(reason || '').slice(0, 200) })));
      return `直しました: ${r.diff.map((d) => d.field).join(', ')}${r.errors.length ? `（捨てた項目: ${r.errors.join(' / ')}）` : ''}`;
    },
    addNote({ text }) { const t = String(text || '').trim().slice(0, 300); if (t) state.notes.push(t); return 'メモしました'; },
    writeReport({ markdown }) {
      // 題名（# 行）は自動で付けるので、書かれていたら外す
      state.report = String(markdown || '').replace(/^#\s[^\n]*\n+/, '').slice(0, 8000);
      return '記録しました';
    },
  };
}

export function createReviewer({ model = process.env.ISHI_REVIEW_MODEL || 'claude-sonnet-5-5', run = query } = {}) {
  return {
    async review(input) {
      const t = createReviewTools(input.overrides);
      const text = (s) => ({ content: [{ type: 'text', text: s }] });
      const server = createSdkMcpServer({
        name: 'review', version: '0.1.0', tools: [
          tool('set_preset', '場面の設定を直す。変えたい項目だけ渡す。reason に根拠（数字）を書く。', {
            form: z.enum(Object.keys(FORMS)),
            reason: z.string().describe('直す根拠。記録の数字を入れる'),
            colors: z.array(z.string()).optional(),
            speed: z.number().optional(),
            count: z.number().optional(),
            reply: z.string().optional(),
            keys: z.array(z.string()).optional().describe('この場面に切り替えるキーワード（全部を渡す）'),
          }, async (a) => text(t.setPreset(a))),
          tool('add_note', '展示中に場面を選ぶ頭脳への改善メモを1件足す。', { text: z.string() }, async (a) => text(t.addNote(a))),
          tool('write_report', '改善記録を Markdown で書く。最後に1回だけ呼ぶ。', { markdown: z.string() }, async (a) => text(t.writeReport(a))),
        ],
      });
      for await (const m of run({
        prompt: buildReviewPrompt(input),
        options: { model, systemPrompt: REVIEW_SYSTEM, tools: [], mcpServers: { review: server }, allowedTools: ['mcp__review__*'], maxTurns: 12, settingSources: [] },
      })) {
        if (m.type === 'result' && m.subtype !== 'success') throw new Error(`reviewer: ${m.subtype}`);
      }
      if (!t.state.report) throw new Error('reviewer: write_report が呼ばれなかった');
      return t.state;
    },
  };
}
