// 来場者のスマホから参加する（同じ Wi-Fi の中だけ）。画面の QR コードを読むと /phone が開き、
// 言葉を送る・画面をなでて光を動かす、ができる。送れるのはこの2つだけで、回数にも上限がある。
import os from 'node:os';

export const PHONE_LIMITS = { textChars: 40, speechEveryMs: 5000, touchesPerSec: 15 };

/** このパソコンの、同じ Wi-Fi から届く住所（IPv4）を選ぶ。無ければ null。 */
export function lanAddress(ifaces = os.networkInterfaces()) {
  const all = Object.values(ifaces).flat().filter((i) => i && (i.family === 'IPv4' || i.family === 4) && !i.internal);
  const priv = all.find((i) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(i.address));
  return (priv || all[0])?.address || null;
}

/** 1台のスマホから届く合図を、決まりの範囲と回数に収める。 */
export function createPhoneGate({ now = () => Date.now() } = {}) {
  let lastSpeech = -Infinity, windowStart = 0, touches = 0;
  return {
    accept(raw) {
      let m; try { m = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
      if (!m || typeof m !== 'object') return null;
      const t = now();
      if (m.type === 'speech') {
        const text = String(m.text || '').replace(/[\u0000-\u001f]/g, ' ').trim();
        if (!text || t - lastSpeech < PHONE_LIMITS.speechEveryMs) return null;
        lastSpeech = t;
        return { type: 'speech', text: [...text].slice(0, PHONE_LIMITS.textChars).join('') };
      }
      if (m.type === 'touch') {
        const x = Number(m.x), y = Number(m.y);
        if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return null;
        if (t - windowStart >= 1000) { windowStart = t; touches = 0; }
        if (++touches > PHONE_LIMITS.touchesPerSec) return null;
        return { type: 'touch', x: +x.toFixed(4), y: +y.toFixed(4), tap: !!m.tap };
      }
      return null;
    },
  };
}

/** そのつながりが、このパソコン自身からか。 */
export const isLoopback = (addr = '') => addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
