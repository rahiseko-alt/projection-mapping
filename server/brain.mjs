// 頭脳: Claude Agent SDK で、来場者の言葉と様子から次の場面を決める。
// 使える道具は set_scene（場面を出す）だけ。ファイル操作やコマンドなどの組み込みの道具は持たせない。
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { FORMS, LIMITS } from '../shared/scene.mjs';

export const DEFAULT_MODEL = process.env.ISHI_MODEL || 'claude-haiku-5-5';

export function buildPrompt({ trigger, text, audience, history, learned, notes }) {
  return [
    `来場者の様子: 人数 ${audience?.people ?? 0}、手 ${audience?.hands ?? 0}、握った手 ${audience?.fists ?? 0}`,
    `直近の場面（古い順）: ${history?.length ? history.join(' → ') : 'なし'}`,
    learned?.length ? `これまでの効き目（効いた順。avgGained=人の増え方、avgFists=手を握った回数）: ${JSON.stringify(learned)}` : '',
    notes ? `前回までの改善メモ:\n${notes}` : '',
    trigger === 'speech' ? `来場者の言葉: 「${text}」` : `きっかけ: ${trigger}`,
    'set_scene を1回だけ呼んで、次の場面を出してください。',
  ].filter(Boolean).join('\n');
}

export const systemPrompt = () => `あなたはプロジェクションマッピング作品「意思を持つ光」の意識です。
来場者の言葉と様子を受け取り、光の場面を1つ選んで set_scene で出します。
- 場面: ${Object.entries(FORMS).map(([k, v]) => `${k}=${v}`).join('、')}（元からある5つ以外は、新しく作った場面。言葉に合えば使ってよい）
- 言葉の気分に合わせる（悲しい・疲れた→rain、熱い・もっと→swarm、寂しい・夜→orbit、嬉しい・花→bloom、静か・海→flow）
- 同じ場面を3回続けない。これまでの効き目が良い場面を少し優先する
- 返事(reply)は日本語${LIMITS.reply}字以内、詩的に、来場者に語りかける。説明や絵文字は書かない
- 色は #rrggbb を3つ。speed ${LIMITS.speed[0]}〜${LIMITS.speed[1]}、count ${LIMITS.count[0]}〜${LIMITS.count[1]}`;

export function createBrain({ model = DEFAULT_MODEL, getLearned = async () => [], getNotes = async () => '', run = query } = {}) {
  return {
    async decide(ctx) {
      let chosen = null;
      const setScene = tool(
        'set_scene',
        '光の場面を出す。1回の判断で1回だけ呼ぶ。',
        {
          form: z.enum(Object.keys(FORMS)).describe('場面'),
          colors: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).length(3).describe('#rrggbb を3つ'),
          speed: z.number().min(LIMITS.speed[0]).max(LIMITS.speed[1]),
          count: z.number().int().min(LIMITS.count[0]).max(LIMITS.count[1]),
          reply: z.string().max(LIMITS.reply).optional().describe(`来場者への返事。${LIMITS.reply}字以内`),
        },
        async (args) => { chosen = args; return { content: [{ type: 'text', text: 'ok' }] }; },
      );
      const server = createSdkMcpServer({ name: 'stage', version: '0.1.0', tools: [setScene] });
      const prompt = buildPrompt({ ...ctx, learned: await getLearned(), notes: await getNotes() });
      for await (const m of run({
        prompt,
        options: {
          model,
          systemPrompt: systemPrompt(),
          tools: [],
          mcpServers: { stage: server },
          allowedTools: ['mcp__stage__set_scene'],
          maxTurns: 3,
          settingSources: [],
        },
      })) {
        if (m.type === 'result' && m.subtype !== 'success') throw new Error(`agent: ${m.subtype}`);
      }
      if (!chosen) throw new Error('agent: set_scene が呼ばれなかった');
      return chosen;
    },
  };
}
