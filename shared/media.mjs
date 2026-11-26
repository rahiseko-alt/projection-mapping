// 場面に使う背景の素材を1つ選ぶ（同じ場面が続くときは順番に替える）。専用の素材が無ければ all、何も無ければ null。
export function pickMedia(list, form, n = 0) {
  const items = (list && (list[form] || list.all)) || [];
  return items.length ? items[n % items.length] : null;
}
