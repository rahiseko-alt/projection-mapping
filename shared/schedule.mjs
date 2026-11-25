// 展示の時間割（config/show.json）。開いている時間だけ映像と音を出し、閉まったら自動で振り返る。
//   { "days": [1,2,3,4,5,6,7], "open": "10:00", "close": "18:00" }  days は 1=月 … 7=日
// open と close が同じ、または show.json が無いときは、いつでも開いている（手で起動して手で止める使い方）。

const HM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const toMin = (s) => { if (typeof s === 'number') return Number.isInteger(s) && s >= 0 && s < 1440 ? s : null; const m = HM.exec(String(s || '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

export function sanitizeSchedule(s = {}) {
  const o = s && typeof s === 'object' ? s : {};
  const days = Array.isArray(o.days) ? [...new Set(o.days.map(Number).filter((d) => d >= 1 && d <= 7))].sort() : [1, 2, 3, 4, 5, 6, 7];
  const open = toMin(o.open), close = toMin(o.close);
  return { days: days.length ? days : [1, 2, 3, 4, 5, 6, 7], open, close, always: open === null || close === null || open === close };
}

/** その時刻に展示が開いているか。閉まる時刻が開く時刻より早ければ、夜をまたぐ時間割として扱う。 */
export function isOpen(schedule, date = new Date()) {
  const s = sanitizeSchedule(schedule);
  if (s.always) return true;
  const day = ((date.getDay() + 6) % 7) + 1; // 1=月
  const min = date.getHours() * 60 + date.getMinutes();
  if (s.open < s.close) return s.days.includes(day) && min >= s.open && min < s.close;
  // 夜をまたぐ: 開いた日の open 以降、または前の日に開いて翌日の close まで
  const prevDay = day === 1 ? 7 : day - 1;
  return (s.days.includes(day) && min >= s.open) || (s.days.includes(prevDay) && min < s.close);
}

/** 開いている → 閉まった、に変わったか（自動の振り返りの合図）。 */
export function justClosed(wasOpen, nowOpen) { return wasOpen === true && nowOpen === false; }
