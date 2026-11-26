// 投影の合わせ方（config/layout.json）。四隅の補正（面ごと）と、黒く塗る区域（扉・窓など映したくない所）。
//   { surfaces: [{ id, targetPoints: [[x,y]×4], sourcePoints: [[x,y]×4] }], masks: [[[x,y], ...], ...] }
// masks の点は画面の幅と高さを 1 とした割合（画面の大きさが変わってもずれない）。

export const LAYOUT_LIMITS = { surfaces: 4, masks: 20, points: 40 };
const finite = (n) => Number.isFinite(Number(n));
const pt = (p) => Array.isArray(p) && p.length >= 2 && finite(p[0]) && finite(p[1]);

export function sanitizeLayout(raw = {}) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const surfaces = (Array.isArray(o.surfaces) ? o.surfaces : [])
    .filter((s) => s && /^surface\d?$/.test(s.id) && [s.targetPoints, s.sourcePoints].every((ps) => Array.isArray(ps) && ps.length === 4 && ps.every(pt)))
    .slice(0, LAYOUT_LIMITS.surfaces)
    .map((s) => ({ id: s.id, targetPoints: s.targetPoints.map(([x, y]) => [+x, +y]), sourcePoints: s.sourcePoints.map(([x, y]) => [+x, +y]) }));
  const masks = (Array.isArray(o.masks) ? o.masks : [])
    .filter((m) => Array.isArray(m) && m.length >= 3 && m.every(pt))
    .slice(0, LAYOUT_LIMITS.masks)
    .map((m) => m.slice(0, LAYOUT_LIMITS.points).map(([x, y]) => [Math.min(1, Math.max(0, +x)), Math.min(1, Math.max(0, +y))]));
  return { surfaces, masks };
}

/** 投影面の数（config/show.json の surfaces、1〜4）。 */
export const surfaceCount = (show = {}) => Math.min(LAYOUT_LIMITS.surfaces, Math.max(1, Math.round(Number(show.surfaces) || 1)));
export const surfaceIds = (n) => Array.from({ length: n }, (_, i) => (i === 0 ? 'surface' : `surface${i + 1}`));
