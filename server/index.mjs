// 受付役: 映像の本体（ブラウザ）を配り、WebSocket で様子と言葉を受け取り、司令塔へ渡す。
// 起動: npm start → Chrome で http://localhost:8787 を開く。
import http from 'node:http';
import { exec, execFile } from 'node:child_process';
import { isOpen, justClosed, sanitizeSchedule } from '../shared/schedule.mjs';
import { launchShow } from './launch.mjs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import { createPhoneGate, lanAddress, isLoopback } from './phone.mjs';
import { sanitizeLayout, surfaceCount } from '../shared/layout.mjs';
import { writeFile } from 'node:fs/promises';
import { createLog } from './log.mjs';
import { createDirector } from './director.mjs';
import { createBrain } from './brain.mjs';
import { loadLearned, loadNotes, loadPresetOverrides, loadCustomForms } from './learned.mjs';
import { mergePresets } from '../shared/scene.mjs';
import { createMapmap } from './mapmap.mjs';
import { listMedia, MEDIA_TYPES } from './media.mjs';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8787);
const mediaDir = path.join(root, 'media');
const ROUTES = [
  ['/shared/', path.join(root, 'shared')],
  ['/vendor/maptastic/', path.join(root, 'node_modules/maptastic/src')],
  ['/vendor/acorn/', path.join(root, 'node_modules/acorn/dist')],
  ['/', path.join(root, 'stage')],
];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const show = await readFile(path.join(root, 'config/show.json'), 'utf8').then(JSON.parse).catch(() => ({}));
// スマホから参加: show.json の "phone": true か ISHI_PHONE=1 のときだけ、同じ Wi-Fi に開く
const PHONE = show.phone === true || process.env.ISHI_PHONE === '1';
const LAN = PHONE ? lanAddress() : null;
const phoneUrl = LAN ? `http://${LAN}:${PORT}/phone` : null;
const PHONE_FILES = new Set(['/phone', '/phone.html']);

const customForms = await loadCustomForms(root);
for (const s of customForms.skipped) console.log(`新しい場面を読み込めませんでした: ${s.file}（${s.errors.join(' / ')}）`);

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => { console.error(e); if (!res.headersSent) res.writeHead(500); res.end(); });
});
async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
  // ほかの機械（スマホ）から見られるのは、スマホ用のページだけ
  if (!isLoopback(req.socket.remoteAddress)) { if (!PHONE || !PHONE_FILES.has(p)) { res.writeHead(403).end(); return; } }
  if (p === '/phone') p = '/phone.html';
  if (p === '/api/layout') {
    const file = path.join(root, 'config/layout.json');
    if (req.method === 'PUT') {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 65536) { res.writeHead(413).end(); return; } }
      let layout; try { layout = sanitizeLayout(JSON.parse(body)); } catch { res.writeHead(400).end(); return; }
      await writeFile(file, JSON.stringify(layout, null, 2) + '\n');
      res.writeHead(204).end(); return;
    }
    const layout = sanitizeLayout(await readFile(file, 'utf8').then(JSON.parse).catch(() => ({})));
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ count: surfaceCount(show), ...layout })); return;
  }
  if (p === '/api/phone') {
    const body = phoneUrl ? { url: phoneUrl, svg: await QRCode.toString(phoneUrl, { type: 'svg', margin: 1, color: { dark: '#000000', light: '#ffffff' } }) } : { url: null };
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(body)); return;
  }
  if (p === '/api/media') { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(await listMedia(mediaDir))); return; }
  if (p.startsWith('/media/')) { await sendMedia(req, res, p); return; }
  if (p === '/api/forms') { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(customForms.loaded)); return; }
  if (p === '/') p = '/index.html';
  const hit = ROUTES.find(([prefix]) => p.startsWith(prefix));
  const file = path.join(hit[1], p.slice(hit[0].length));
  if (!(file === hit[1] || file.startsWith(hit[1] + path.sep))) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
}

// 動画は少しずつ送る（ブラウザが繰り返し再生や頭出しをするため）
async function sendMedia(req, res, p) {
  const file = path.join(mediaDir, p.slice('/media/'.length));
  const type = MEDIA_TYPES[path.extname(file).toLowerCase()];
  if (!file.startsWith(mediaDir + path.sep) || !type) { res.writeHead(403).end(); return; }
  const st = await stat(file).catch(() => null);
  if (!st?.isFile()) { res.writeHead(404).end(); return; }
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m) {
    const start = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
    if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }).end(); return; }
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
    createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': st.size });
    createReadStream(file).on('error', () => res.destroy()).pipe(res);
  }
}

// このパソコンで開いた映像の本体だけをつなぐ（ほかのサイトのページからはつながせない）
const wss = new WebSocketServer({ noServer: true });
const phones = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const origin = req.headers.origin;
  const local = isLoopback(req.socket.remoteAddress);
  if (pathname === '/ws' && local && [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`].includes(origin)) return wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  if (pathname === '/phone-ws' && PHONE && origin === `http://${LAN}:${PORT}`) return phones.handleUpgrade(req, socket, head, (ws) => phones.emit('connection', ws, req));
  socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n'); socket.destroy();
});
phones.on('connection', (ws) => {
  const gate = createPhoneGate();
  broadcast({ type: 'phones', count: phones.clients.size });
  ws.on('close', () => broadcast({ type: 'phones', count: phones.clients.size }));
  ws.on('message', async (data) => {
    const m = gate.accept(String(data));
    if (!m || !open) return;
    try {
      if (m.type === 'speech') { ws.send(JSON.stringify({ type: 'ok' })); await director.onSpeech(m.text); }
      else { broadcast({ type: 'touch', x: m.x, y: m.y, tap: m.tap }); if (m.tap) await director.onGesture({ kind: 'phone' }); }
    } catch (e) { console.error(e); }
  });
});
const broadcast = (msg) => { const s = JSON.stringify(msg); for (const c of wss.clients) if (c.readyState === 1) c.send(s); };
const log = createLog(path.join(root, 'logs'));
// 頭脳は、このパソコンの Claude Code のログイン（または ANTHROPIC_API_KEY）で動く。ISHI_BRAIN=off で止める。
const brain = process.env.ISHI_BRAIN === 'off'
  ? null
  : createBrain({ getLearned: () => loadLearned(root), getNotes: () => loadNotes(root) });
const mapmap = createMapmap();
const presets = mergePresets(await loadPresetOverrides(root));
const director = createDirector({ brain, log, presets, broadcast: (m) => { broadcast(m); if (m.type === 'scene') mapmap.onScene(m.scene); } });

// ---- 展示の時間割（config/show.json）。閉まると映像と音を止め、自動で振り返る ----
const schedule = sanitizeSchedule(show);
let open = isOpen(schedule);
function checkSchedule() {
  const now = isOpen(schedule);
  if (now === open) return;
  const closed = justClosed(open, now);
  open = now;
  director.setOpen(open);
  broadcast({ type: 'power', open });
  log.write({ type: 'power', open });
  console.log(open ? '展示の時間になりました' : '展示の時間が終わりました');
  if (closed && show.autoReview !== false) {
    console.log('振り返りをしています…');
    execFile(process.execPath, [path.join(root, 'server/review.mjs')], { cwd: root }, (e, out) => console.log(e ? `振り返りに失敗: ${e.message}` : '振り返りが終わりました（docs/agent/改善記録/）'));
  }
}
director.setOpen(open);
if (!schedule.always) setInterval(checkSchedule, 30000);

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'power', open }));
  ws.on('message', async (data) => {
    let m; try { m = JSON.parse(data); } catch { return; }
    try {
      if (m.type === 'speech') await director.onSpeech(String(m.text || '').slice(0, 200));
      else if (m.type === 'audience') await director.onAudience(m);
      else if (m.type === 'gesture') await director.onGesture(m);
    } catch (e) { console.error(e); }
  });
});

server.listen(PORT, PHONE ? '0.0.0.0' : '127.0.0.1', () => {
  if (PHONE) console.log(phoneUrl ? `スマホから参加: 同じ Wi-Fi で ${phoneUrl} （画面の Q で QR コードを出す）` : 'スマホから参加: Wi-Fi の住所が見つかりません');
  console.log(`意思を持つ光: http://localhost:${PORT} を Chrome で開いてください`);
  if (!schedule.always) console.log(`展示の時間割: ${show.open}〜${show.close}（いまは${open ? '開いています' : '閉まっています'}）`);
  // show.bat から起動したときは、展示用の Chrome を全画面で開く
  // 画面がつながっていなければ開く。受付役が起動し直したときは、開いたままの画面が数秒でつなぎ直すので開かない。
  // 展示用の Chrome が落ちたときは、1分つながらなければ開き直す。
  if (process.env.ISHI_SHOW === '1') {
    let lastSeen = 0;
    const openShow = () => { const r = launchShow({ url: `http://localhost:${PORT}`, root, show }); console.log(r.ok ? '展示用の Chrome を開きました（止めるときは Alt+F4、そのあと黒い画面も閉じる）' : r.reason); lastSeen = Date.now(); };
    setTimeout(() => { if (wss.clients.size === 0) openShow(); }, 8000);
    setInterval(() => { if (wss.clients.size > 0) lastSeen = Date.now(); else if (Date.now() - lastSeen > 60000) openShow(); }, 10000);
  }
  // start.bat から起動したときは、Chrome（無ければふだんのブラウザ）で自動で開く
  else if (process.env.ISHI_OPEN === '1' && process.platform === 'win32') {
    const url = `http://localhost:${PORT}`;
    exec(`start "" chrome --new-window ${url}`, (e) => { if (e) exec(`start "" ${url}`); });
  }
  if (customForms.loaded.length) console.log(`新しい場面: ${customForms.loaded.map((f) => f.name).join('・')}`);
  console.log(brain ? '頭脳: Claude（準備中…）' : '頭脳: なし（キーワードで反応）');
  // 最初の1回は立ち上がりに時間がかかるので、来場者の前に一度だけ試しておく
  if (brain) brain.decide({ trigger: 'warmup', audience: { people: 0 }, history: [] })
    .then(() => console.log('頭脳: Claude（準備できました）'))
    .catch((e) => console.log(`頭脳: Claude につながりません（${e.message}）。キーワードで反応します。Claude Code にログインしているか確かめてください`));
});
