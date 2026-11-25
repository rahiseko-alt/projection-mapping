// 場面ごとの背景の素材（動画・画像）。media/<場面のid>/ に入れたファイルを、その場面の背景として映す。
// media/all/ に入れたものは、専用の素材が無い場面で使う。
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const MEDIA_TYPES = {
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
};
export const MAX_MEDIA_BYTES = 500 * 1024 * 1024;
const FOLDER = /^[a-z][a-z0-9]{1,15}$/;

export const kindOf = (file) => (MEDIA_TYPES[path.extname(file).toLowerCase()] || '').split('/')[0] || null;

/** media/ の中を調べ、{ <場面>: [{ url, kind }] } を返す。使えない名前・種類・大きすぎるファイルは飛ばす。 */
export async function listMedia(dir) {
  const out = {};
  let folders = [];
  try { folders = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const f of folders) {
    if (!f.isDirectory() || !FOLDER.test(f.name)) continue;
    let files = [];
    try { files = (await readdir(path.join(dir, f.name))).sort(); } catch { continue; }
    for (const file of files) {
      const kind = kindOf(file);
      if (!kind || file.startsWith('.')) continue;
      const st = await stat(path.join(dir, f.name, file)).catch(() => null);
      if (!st?.isFile() || st.size > MAX_MEDIA_BYTES) continue;
      (out[f.name] ||= []).push({ url: `/media/${f.name}/${encodeURIComponent(file)}`, kind });
    }
  }
  return out;
}

export { pickMedia } from '../shared/media.mjs';
