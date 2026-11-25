// 演出の司令塔: いつエージェントに尋ねるか、答えが来なければどうするかを決める。
// 素早い反応（手の動き）は映像の本体が自分で行うので、ここは「ゆっくりした判断」だけ。
import { sanitizeScene, pickByKeyword, idleScene, wouldRepeatThrice } from '../shared/scene.mjs';

export const IDLE_MS = 120000; // 人がいない状態が2分続いたら呼び込みの場面へ
export const BRAIN_TIMEOUT_MS = 10000;

export function createDirector({ brain, log, broadcast, presets = undefined, now = () => Date.now(), timeoutMs = BRAIN_TIMEOUT_MS, idleMs = IDLE_MS }) {
  const state = { audience: { people: 0, hands: 0, fists: 0 }, history: [], emptySince: now(), idleShown: false, busy: false, shown: 0 };

  async function show(scene, source, extra = {}) {
    let { scene: clean, errors } = sanitizeScene(scene);
    if (clean.form && wouldRepeatThrice(state.history, clean.form)) {
      // 場面だけでなく、色・返事も差し替え先の場面のものにする（返事と場面が食い違わないように）
      const { label, keys, ...alt } = pickByKeyword('', state.history, presets);
      clean = sanitizeScene(alt).scene;
      errors = [...errors, '同じ場面が3回続くため差し替えた'];
    }
    state.shown++;
    if (clean.form) { state.history.push(clean.form); if (state.history.length > 10) state.history.shift(); }
    broadcast({ type: 'scene', scene: clean, source });
    await log.write({ type: 'scene', scene: clean, source, errors, ...extra });
    return clean;
  }

  async function ask(context) {
    if (!brain) return null;
    let timer;
    const abort = new AbortController(); // 時間切れのときは、頭脳の作業も止める（利用枠を使い続けないように）
    try {
      return await Promise.race([
        brain.decide({ ...context, audience: state.audience, history: [...state.history] }, { signal: abort.signal }),
        new Promise((_, rej) => { timer = setTimeout(() => { abort.abort(); rej(new Error('timeout')); }, timeoutMs); }),
      ]);
    } catch (e) {
      await log.write({ type: 'brain_error', message: String(e?.message || e) });
      return null;
    } finally { clearTimeout(timer); }
  }

  return {
    state,
    async onSpeech(text) {
      await log.write({ type: 'speech', text });
      if (state.busy) return show(pickByKeyword(text, state.history, presets), 'keyword', { reason: 'busy' });
      state.busy = true;
      const before = state.shown;
      try {
        const scene = await ask({ trigger: 'speech', text });
        // 考えている間に別の場面が出ていたら、古い言葉への答えは捨てる
        if (scene && state.shown !== before) { await log.write({ type: 'stale', text }); return null; }
        if (scene) return show(scene, 'agent', { text });
        return show(pickByKeyword(text, state.history, presets), 'keyword', { text });
      } finally { state.busy = false; }
    },
    async onAudience(a) {
      state.audience = { people: a.people ?? 0, hands: a.hands ?? 0, fists: a.fists ?? 0 };
      await log.write({ type: 'audience', ...state.audience });
      const t = now();
      if (state.audience.people > 0 || state.audience.hands > 0) { state.emptySince = t; state.idleShown = false; return; }
      if (!state.idleShown && t - state.emptySince >= idleMs) {
        state.idleShown = true;
        return show(idleScene(state.history, presets), 'idle');
      }
    },
    async onGesture(g) { await log.write({ type: 'gesture', kind: g.kind }); },
    show,
  };
}
