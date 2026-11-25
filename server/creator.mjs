// 場面づくり役のエージェント: 「オーロラみたいな光」のような頼みから、新しい場面の動きを作って足す。
// 道具は save_form の1つだけ。保存の前に、決まりの確認と試し動かし（shared/forms.mjs の trialRun）を必ず通す。
// 通らなければ理由をエージェントに返し、直させる。
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { writeFile, mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { BUILTIN_FORMS, CODE_LIMIT, loadCustomForm } from '../shared/forms.mjs';
import { FORMS, LIMITS, sanitizeScene, cleanKeys } from '../shared/scene.mjs';
import { sanitizeSound, WAVES, SCALES, SOUND_LIMITS } from '../shared/sound.mjs';

export const MAX_ATTEMPTS = 5;

const examples = BUILTIN_FORMS.map((f) => `- ${f.id}（${f.name}、edge=${f.edge}、draw=${f.draw}）:\n  ${f.move.toString().replace(/^move\([^)]*\)\s*\{\s*/, '').replace(/\s*\}$/, '')}`).join('\n');

export const CREATOR_SYSTEM = `あなたはプロジェクションマッピング作品「意思を持つ光」の場面づくり役です。
頼まれた光の様子を、粒の動きとして書き、save_form で保存します。
動きは JavaScript の関数の中身だけを書きます。引数は p f t sp W H dx dy d と Math です。
- p: 粒 { x, y, vx, vy, a（0〜6.28の固有の角度）, k（0.5〜1.5の固有の重さ） }。p.vx と p.vy を変える（位置は呼ぶ側が動かす）
- f: 粒が向かう点（来場者の手。いなければゆっくり動く点）。dx, dy, d は粒から f への差と距離
- t: 秒、sp: 速さ（0.3〜2.5）、W, H: 画面の幅と高さ
- 手に反応させる（近づく・避ける・回るなど）と作品らしくなる
- 使えるのは Math と引数と const/let/if だけ。for・while・関数・[ ]・文字列・new・this は使えない。${CODE_LIMIT}字以内
- 保存のときに試し動かしをして、止まる・値が壊れる・重い・粒が画面から消える・1点に固まる と断られる。断られたら理由を読んで直し、もう一度 save_form を呼ぶ（${MAX_ATTEMPTS}回まで）
- id は英小文字で始まる2〜16字、name は日本語8字以内。色は #rrggbb を3つ、speed ${LIMITS.speed[0]}〜${LIMITS.speed[1]}、count ${LIMITS.count[0]}〜${LIMITS.count[1]}、reply ${LIMITS.reply}字以内、keys はこの場面に切り替える言葉
- sound で場面の音も決める: base 低音の高さ ${SOUND_LIMITS.base[0]}〜${SOUND_LIMITS.base[1]}Hz、wave ${WAVES.join('/')}、bright 明るさ 0〜1、pulse 揺れ 0〜4回/秒、scale 手を握ったときの鈴 ${Object.keys(SCALES).join('/')}（calm 穏やか、bright 明るい、dark 切ない）
元からある場面の動き（見本）:
${examples}`;

/** 保存の中身（SDK から切り離してあるので、そのまま検査できる）。 */
export function createCreatorTools({ root, writeFn = writeFile, mkdirFn = mkdir }) {
  const state = { attempts: 0, saved: null, failures: [] };
  return {
    state,
    async saveForm({ id, name, edge, draw, code, colors, speed, count, keys, reply, sound }) {
      if (state.saved) return `もう保存しました（${state.saved.id}）。終わってください`;
      if (state.attempts >= MAX_ATTEMPTS) return `試せるのは${MAX_ATTEMPTS}回まで。終わってください`;
      state.attempts++;
      const errors = [];
      if (Object.hasOwn(FORMS, id)) errors.push(`id「${id}」はもう使われている`);
      const r = loadCustomForm({ id, name, edge, draw, code });
      errors.push(...r.errors);
      const { scene, errors: presetErrors } = sanitizeScene({ colors, speed, count, reply });
      errors.push(...presetErrors);
      const k = cleanKeys(keys);
      if (!k) errors.push('keys を1つ以上');
      if (errors.length) { state.failures.push({ attempt: state.attempts, errors }); return `保存できませんでした（${state.attempts}回目）: ${errors.join(' / ')}`; }
      const def = { id, name: r.form.name, edge, draw, code, preset: { ...scene, keys: k }, sound: sanitizeSound(sound), createdAt: new Date().toISOString() };
      await mkdirFn(path.join(root, 'config/forms'), { recursive: true });
      await writeFn(path.join(root, 'config/forms', `${id}.json`), JSON.stringify(def, null, 2) + '\n');
      state.saved = def;
      return `保存しました: ${id}（${r.form.name}）。次の npm start から使われます`;
    },
  };
}

export function createCreator({ root, model = process.env.ISHI_CREATE_MODEL || 'claude-sonnet-5-5', run = query } = {}) {
  return {
    async create(request) {
      const t = createCreatorTools({ root });
      const server = createSdkMcpServer({
        name: 'create', version: '0.1.0', tools: [
          tool('save_form', '新しい場面を確かめて保存する。断られたら理由を読んで直し、もう一度呼ぶ。', {
            id: z.string(), name: z.string(),
            edge: z.enum(['wrap', 'fall']).describe("'wrap' 端から反対側へ / 'fall' 下に落ちたら上から"),
            draw: z.enum(['dot', 'streak']).describe("'dot' 丸い点 / 'streak' 縦の線"),
            code: z.string().describe('動きの関数の中身'),
            colors: z.array(z.string()), speed: z.number(), count: z.number(),
            keys: z.array(z.string()), reply: z.string().optional(),
            sound: z.object({ base: z.number(), wave: z.enum(WAVES), bright: z.number(), pulse: z.number(), scale: z.enum(Object.keys(SCALES)) }).optional().describe('場面の音'),
          }, async (a) => ({ content: [{ type: 'text', text: await t.saveForm(a) }] })),
        ],
      });
      const prompt = `頼まれた場面: 「${String(request).slice(0, 200)}」\nいまある場面: ${Object.entries(FORMS).map(([k, v]) => `${k}=${v}`).join('、')}\n新しい場面を1つ作って save_form で保存してください。`;
      for await (const m of run({ prompt, options: { model, systemPrompt: CREATOR_SYSTEM, tools: [], mcpServers: { create: server }, allowedTools: ['mcp__create__save_form'], maxTurns: MAX_ATTEMPTS * 2 + 2, settingSources: [] } })) {
        if (m.type === 'result' && m.subtype !== 'success' && !t.state.saved) throw new Error(`creator: ${m.subtype}`);
      }
      return t.state;
    },
  };
}

/** 作った記録を残す（docs/agent/場面づくり.md）。 */
export async function recordCreation(root, request, state) {
  const dir = path.join(root, 'docs/agent');
  await mkdir(dir, { recursive: true });
  const lines = [
    `## ${new Date().toISOString().slice(0, 10)} 「${request}」`,
    state.saved ? `- 作った場面: ${state.saved.name}（${state.saved.id}）、キーワード: ${state.saved.preset.keys.join('・')}` : '- 作れませんでした',
    `- 試した回数: ${state.attempts}`,
    ...state.failures.map((f) => `- ${f.attempt}回目に断られた理由: ${f.errors.join(' / ')}`),
    '',
  ];
  await appendFile(path.join(dir, '場面づくり.md'), lines.join('\n') + '\n');
}
