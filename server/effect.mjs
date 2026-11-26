// 「効いたかどうか」の測り方: 場面を出した前後で、人数と手の動きがどう変わったか。
// 場面を出した時点の値と、その後 windowMs の間の最大値を比べる。
export function measureEffect(events, windowMs = 20000) {
  const results = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type !== 'scene') continue;
    const t0 = Date.parse(e.at);
    const before = lastAudience(events, i);
    let maxPeople = before.people, fists = 0;
    for (let j = i + 1; j < events.length; j++) {
      const f = events[j];
      if (Date.parse(f.at) - t0 > windowMs) break;
      if (f.type === 'audience') maxPeople = Math.max(maxPeople, f.people ?? 0);
      if (f.type === 'gesture') fists++;
    }
    results.push({ at: e.at, form: e.scene?.form, source: e.source, peopleBefore: before.people, peopleAfter: maxPeople, fists, gained: maxPeople - before.people });
  }
  return results;
}

function lastAudience(events, i) {
  for (let j = i - 1; j >= 0; j--) if (events[j].type === 'audience') return { people: events[j].people ?? 0 };
  return { people: 0 };
}

/** 場面ごとの平均の効き目。次の判断の参考としてエージェントに渡す。 */
export function summarizeByForm(results) {
  const by = {};
  for (const r of results) {
    if (!r.form) continue;
    const s = (by[r.form] ||= { form: r.form, shown: 0, gained: 0, fists: 0 });
    s.shown++; s.gained += r.gained; s.fists += r.fists;
  }
  return Object.values(by).map((s) => ({ ...s, avgGained: +(s.gained / s.shown).toFixed(2), avgFists: +(s.fists / s.shown).toFixed(2) }))
    .sort((a, b) => b.avgFists + b.avgGained - (a.avgFists + a.avgGained));
}
