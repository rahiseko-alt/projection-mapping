// 周りの音を聞いて、光の動きに変える（拍手・声・音楽）。
// 音の大きさ（0〜1）を毎フレーム受け取り、ゆっくり動く「ふだんの大きさ」と比べて、急に大きくなった瞬間（拍手など）を見つける。

export function createListener({ rise = 2.2, floor = 0.04, cooldownMs = 250 } = {}) {
  let base = 0, smooth = 0, lastHit = -Infinity;
  return {
    /** level: 今の音の大きさ（0〜1）、now: ミリ秒。返り値 { energy: 0〜1 の盛り上がり, hit: 急に大きくなったか } */
    push(level, now) {
      const l = Math.max(0, Math.min(1, Number(level) || 0));
      smooth = smooth * 0.8 + l * 0.2;
      const hit = l > floor && l > base * rise && now - lastHit > cooldownMs;
      if (hit) lastHit = now;
      base = base * 0.98 + l * 0.02; // ふだんの大きさ（数秒かけて追いつく）
      return { energy: Math.min(1, smooth * 4), hit };
    },
  };
}

/** 盛り上がりを、粒の速さの倍率に変える（静か 1倍 〜 にぎやか 1.8倍）。 */
export const speedBoost = (energy) => 1 + Math.max(0, Math.min(1, energy)) * 0.8;
