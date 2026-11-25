// 場面ごとの音。ブラウザに元から備わっている音の機能（Web Audio）だけで鳴らす。素材のファイルは要らない。
// 1つの場面の音は { base, wave, bright, pulse, scale } の5つで決まる。
//   base: 低音の高さ（60〜400Hz）、wave: 音色（sine/triangle/sawtooth/square）、bright: 明るさ（0〜1）
//   pulse: 揺れの速さ（0〜4回/秒）、scale: 手を握ったときの鈴の音階（calm/bright/dark）

export const SOUND_LIMITS = { base: [60, 400], bright: [0, 1], pulse: [0, 4] };
export const WAVES = ['sine', 'triangle', 'sawtooth', 'square'];
export const SCALES = {
  calm: [0, 2, 4, 7, 9],     // 長調の5音
  bright: [0, 4, 7, 11, 14], // 明るく広い
  dark: [0, 3, 5, 7, 10],    // 短調の5音
};

export const BUILTIN_SOUNDS = {
  flow: { base: 110, wave: 'sine', bright: 0.35, pulse: 0.15, scale: 'calm' },
  bloom: { base: 196, wave: 'triangle', bright: 0.6, pulse: 0.4, scale: 'bright' },
  swarm: { base: 82, wave: 'sawtooth', bright: 0.75, pulse: 2.2, scale: 'bright' },
  rain: { base: 98, wave: 'sine', bright: 0.2, pulse: 0.6, scale: 'dark' },
  orbit: { base: 73, wave: 'triangle', bright: 0.45, pulse: 0.08, scale: 'dark' },
};

const clamp = (n, [lo, hi], d) => (Number.isFinite(Number(n)) ? Math.min(hi, Math.max(lo, Number(n))) : d);

/** 決まりの範囲に収める。足りない項目は穏やかな音で埋める。 */
export function sanitizeSound(s = {}) {
  const o = s && typeof s === 'object' ? s : {};
  return {
    base: clamp(o.base, SOUND_LIMITS.base, 110),
    wave: WAVES.includes(o.wave) ? o.wave : 'sine',
    bright: clamp(o.bright, SOUND_LIMITS.bright, 0.4),
    pulse: clamp(o.pulse, SOUND_LIMITS.pulse, 0.3),
    scale: Object.hasOwn(SCALES, o.scale) ? o.scale : 'calm',
  };
}

/** 場面の音を決める。元の5つは決まった音、新しい場面は保存された音（無ければ id から決める）。 */
export function soundFor(form, custom = {}) {
  if (BUILTIN_SOUNDS[form]) return { ...BUILTIN_SOUNDS[form] };
  if (custom[form]) return sanitizeSound(custom[form]);
  let h = 0; for (const c of String(form)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return sanitizeSound({ base: 70 + (h % 160), wave: WAVES[h % 2], bright: 0.3 + (h % 40) / 100, pulse: (h % 30) / 10, scale: Object.keys(SCALES)[h % 3] });
}

/** 手を握ったときの鈴の高さ（Hz）。n 回目ごとに音階を巡る。 */
export function chimeFreq(sound, n) {
  const steps = SCALES[sound.scale] || SCALES.calm;
  const semis = steps[n % steps.length] + 12 * (2 + Math.floor(n / steps.length) % 2);
  return +(sound.base * 2 ** (semis / 12)).toFixed(2);
}
