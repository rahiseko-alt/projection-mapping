// 受付役: 映像の本体（ブラウザ）を配り、WebSocket で様子と言葉を受け取り、司令塔へ渡す。
// 起動: npm start → Chrome で http://localhost:8787 を開く。
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createLog } from './log.mjs';
import { createDirector } from './director.mjs';
import { createBrain } from './brain.mjs';
import { loadLearned, loadNotes } from './learned.mjs';
import { createMapmap } from './mapmap.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8787);
const ROUTES = [
  ['/shared/', path.join(root, 'shared')],
  ['/vendor/maptastic/', path.join(root, 'node_modules/maptastic/src')],
  ['/', path.join(root, 'stage')],
];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const hit = ROUTES.find(([prefix]) => p.startsWith(prefix));
  const file = path.join(hit[1], p.slice(hit[0].length));
  if (!file.startsWith(hit[1])) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});

const wss = new WebSocketServer({ server, path: '/ws' });
const broadcast = (msg) => { const s = JSON.stringify(msg); for (const c of wss.clients) if (c.readyState === 1) c.send(s); };
const log = createLog(path.join(root, 'logs'));
const brain = process.env.ANTHROPIC_API_KEY
  ? createBrain({ getLearned: () => loadLearned(root), getNotes: () => loadNotes(root) })
  : null;
const mapmap = createMapmap();
const director = createDirector({ brain, log, broadcast: (m) => { broadcast(m); if (m.type === 'scene') mapmap.onScene(m.scene); } });

wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    let m; try { m = JSON.parse(data); } catch { return; }
    try {
      if (m.type === 'speech') await director.onSpeech(String(m.text || '').slice(0, 200));
      else if (m.type === 'audience') await director.onAudience(m);
      else if (m.type === 'gesture') await director.onGesture(m);
    } catch (e) { console.error(e); }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`意思を持つ光: http://localhost:${PORT} を Chrome で開いてください`);
  console.log(brain ? '頭脳: Claude（ANTHROPIC_API_KEY あり）' : '頭脳: なし（キーワードで反応。ANTHROPIC_API_KEY を設定すると Claude が判断します）');
});
