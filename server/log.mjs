// 展示ログ: 1日1ファイル、1行1件（JSON Lines）。カメラ映像は残さない。人数・場面・言葉の文字だけ。
import { appendFile, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export function createLog(dir) {
  const day = (d = new Date()) => d.toISOString().slice(0, 10);
  return {
    dir,
    async write(event) {
      await mkdir(dir, { recursive: true });
      const line = JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n';
      await appendFile(path.join(dir, `${day()}.jsonl`), line, 'utf8');
    },
    async read(date = day()) {
      try {
        const text = await readFile(path.join(dir, `${date}.jsonl`), 'utf8');
        return text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
      } catch { return []; }
    },
    async days() {
      try { return (await readdir(dir)).filter((f) => f.endsWith('.jsonl')).map((f) => f.slice(0, 10)).sort(); } catch { return []; }
    },
  };
}
