// 演出の命令（場面・色・速さ・粒の数・返事）の決まりを一か所に集める。
// ブラウザ（映像の本体）とNode（受付役・エージェント）の両方から読み込む。

export const FORMS = {
  flow: '流れる川',
  bloom: '咲く花',
  swarm: '漂う群れ',
  rain: '降る雨',
  orbit: '巡る星',
};

export const LIMITS = { speed: [0.3, 2.5], count: [150, 1000], reply: 30 };

export const PRESETS = [
  { label: '静かな海', keys: ['海', '静', '落ち着', '眠', '青'], form: 'flow', colors: ['#0b6e99', '#4fc3d9', '#d8f6ff'], speed: 0.6, count: 600, reply: '波の音を、ここに置いておきます' },
  { label: '燃える森', keys: ['熱', '燃', '怒', '火', '赤', '元気', 'もっと'], form: 'swarm', colors: ['#ff4a1c', '#ffb020', '#fff1c1'], speed: 1.6, count: 700, reply: '熱い。あなたの手に集まってしまう' },
  { label: '夜の宇宙', keys: ['宇宙', '星', '夜', '寂', '孤独'], form: 'orbit', colors: ['#6b5cff', '#b9b3ff', '#ffffff'], speed: 0.8, count: 800, reply: 'あなたを中心に、星が回りはじめます' },
  { label: '春の庭', keys: ['花', '春', '好き', '嬉', '楽し', 'ピンク'], form: 'bloom', colors: ['#ff7aa8', '#ffd0e0', '#a8e66b'], speed: 1, count: 500, reply: '指先から、花がひらきます' },
  { label: '雨の日', keys: ['雨', '悲し', '泣', '疲', 'つら'], form: 'rain', colors: ['#7d8fa6', '#b8c7da', '#e8eef6'], speed: 1.2, count: 700, reply: 'あなたの手だけ、雨が避けていく' },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * 命令を決まりの範囲に収める。範囲外の項目は捨て、使えた項目だけを返す。
 * 返り値の errors に、捨てた理由が入る。
 */
export function sanitizeScene(input) {
  const out = {};
  const errors = [];
  const o = input && typeof input === 'object' ? input : {};
  if (o.form !== undefined) {
    if (Object.hasOwn(FORMS, o.form)) out.form = o.form;
    else errors.push(`form は ${Object.keys(FORMS).join('/')} のどれか`);
  }
  if (o.colors !== undefined) {
    if (Array.isArray(o.colors) && o.colors.length >= 3 && o.colors.slice(0, 3).every((c) => HEX.test(c))) out.colors = o.colors.slice(0, 3);
    else errors.push('colors は #rrggbb を3つ');
  }
  for (const k of ['speed', 'count']) {
    if (o[k] === undefined) continue;
    const n = Number(o[k]);
    const [lo, hi] = LIMITS[k];
    if (Number.isFinite(n) && n >= lo && n <= hi) out[k] = k === 'count' ? Math.round(n) : n;
    else errors.push(`${k} は ${lo}〜${hi}`);
  }
  if (o.reply !== undefined && o.reply !== null && o.reply !== '') {
    const r = String(o.reply);
    if ([...r].length <= LIMITS.reply) out.reply = r;
    else { out.reply = [...r].slice(0, LIMITS.reply).join(''); errors.push(`reply は ${LIMITS.reply}字以内（切り詰めた）`); }
  }
  return { scene: out, errors };
}

/** 直近の場面の並び（新しいものが最後）で、同じ場面が3回続くかどうか。 */
export function wouldRepeatThrice(history, form) {
  const n = history.length;
  return n >= 2 && history[n - 1] === form && history[n - 2] === form;
}

/**
 * エージェントにつながらないときの代わり: 言葉のキーワードで場面を選ぶ。
 * 合うものが無ければ、直前と違う場面を順番に選ぶ。
 */
export function pickByKeyword(text, history = []) {
  const t = String(text || '');
  const hit = PRESETS.find((p) => p.keys.some((k) => t.includes(k)));
  if (hit && !wouldRepeatThrice(history, hit.form)) return { ...hit };
  const last = history[history.length - 1];
  const i = PRESETS.findIndex((p) => p.form === last);
  return { ...PRESETS[(i + 1) % PRESETS.length] };
}

/** 人のいない静かな場面（呼び込み）。返事は出さない。 */
export function idleScene(history = []) {
  const calm = PRESETS.filter((p) => p.form === 'flow' || p.form === 'bloom');
  const last = history[history.length - 1];
  const p = calm.find((c) => c.form !== last) || calm[0];
  const { reply, ...rest } = p;
  return { ...rest };
}
