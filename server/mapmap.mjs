// MapMap（動画の投影ソフト）への合図。MAPMAP_PORT を設定したときだけ送る（MapMap の初期値は 12345）。
// 場面が変わったら、その場面の名前に合う MapMap の層だけを見せる（opacity 1、ほかは 0）。
// 層の名前を場面の名前（flow・bloom・swarm・rain・orbit）で始めておけば、設定は要らない。
// 命令の書き方は MapMap の版で2通りある（config/mapmap.json の style で選ぶ）:
//   legacy（配布中の版の説明書）: /mapmap/mapping/opacity ,sf "<名前>*" <値>
//   dev（1.0 開発版）          : /mapmap/layer/opacity   ,sf "<名前>*" <値>
import OSC from 'osc-js';
import { readFileSync } from 'node:fs';
import { FORMS } from '../shared/scene.mjs';

export function addressFor(style) {
  return style === 'dev' ? '/mapmap/layer/opacity' : '/mapmap/mapping/opacity';
}

export function messagesFor(form, { style = 'legacy', patterns = {} } = {}) {
  const address = addressFor(style);
  return Object.keys(FORMS).map((f) => ({ address, args: [patterns[f] || `${f}*`, f === form ? 1.0 : 0.0] }));
}

export function createMapmap({ port = Number(process.env.MAPMAP_PORT || 0), host = '127.0.0.1', configPath = new URL('../config/mapmap.json', import.meta.url) } = {}) {
  if (!port) return { onScene() {} };
  let cfg = {};
  try { cfg = JSON.parse(readFileSync(configPath, 'utf8')); } catch {}
  const osc = new OSC({ plugin: new OSC.DatagramPlugin({ send: { host, port } }) });
  osc.open({ port: 0 });
  return {
    onScene(scene) {
      if (!scene.form) return;
      for (const m of messagesFor(scene.form, cfg)) {
        const msg = new OSC.Message(m.address, m.args[0], m.args[1]);
        msg.types = 'sf';
        osc.send(msg, { host, port });
      }
    },
  };
}
