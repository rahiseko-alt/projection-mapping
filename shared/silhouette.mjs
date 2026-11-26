// 人の形（体の輪郭）。カメラの映像から読み取った「人がいる確からしさ」（0〜1の並び）を、粗い升目にまとめる。
// 粒は升目を見て、人の中にいれば外へ押し出される（光が人をよけて流れる）。

export const GRID = { w: 64, h: 36 };

/** mask: 長さ mw*mh の 0〜1 の並び。升目ごとの平均を 0〜255 にして返す。 */
export function buildField(mask, mw, mh, gw = GRID.w, gh = GRID.h) {
  const out = new Uint8Array(gw * gh);
  const sx = mw / gw, sy = mh / gh;
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    let sum = 0, n = 0;
    const x0 = Math.floor(gx * sx), x1 = Math.max(x0 + 1, Math.floor((gx + 1) * sx));
    const y0 = Math.floor(gy * sy), y1 = Math.max(y0 + 1, Math.floor((gy + 1) * sy));
    for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { sum += mask[y * mw + x]; n++; }
    out[gy * gw + gx] = Math.round((sum / Math.max(1, n)) * 255);
  }
  return out;
}

/** 画面の位置 (x, y) の、人の濃さ（0〜1）。mirror なら左右を反転（前向きのカメラ）。 */
export function sample(field, x, y, W, H, mirror = true, gw = GRID.w, gh = GRID.h) {
  if (!field) return 0;
  let gx = Math.floor((x / W) * gw), gy = Math.floor((y / H) * gh);
  if (mirror) gx = gw - 1 - gx;
  if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return 0;
  return field[gy * gw + gx] / 255;
}

/**
 * 人の中にいる粒を、人の薄い方へ押す力 { fx, fy }。人の外なら 0。
 * at(x, y): 画面の位置の人の濃さ（0〜1）を返す関数。cw, ch: 升目1つ分の画面での大きさ。
 */
export function pushOut(at, x, y, cw, ch) {
  const v = at(x, y);
  if (v < 0.5) return { fx: 0, fy: 0 };
  let gx = at(x + cw, y) - at(x - cw, y);
  let gy = at(x, y + ch) - at(x, y - ch);
  const len = Math.hypot(gx, gy);
  if (len < 1e-3) { gx = 0; gy = 1; } else { gx /= len; gy /= len; } // 平らな所（体の真ん中）では上へ逃がす
  return { fx: -gx * 1.6 * v, fy: -gy * 1.6 * v };
}
