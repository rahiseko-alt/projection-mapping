// カメラの認識（手・体）を、光を描く処理とは別の担当で行う。
// 認識は1回数十ミリ秒かかるため、描く処理の中で行うと絵が止まる（カクカクの原因）。
// パソコン内蔵の映像用の部品（GPU）が使えればそれを使い、使えなければ CPU で行う。
import { HandLandmarker, PoseLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3';
import { buildField } from '/shared/silhouette.mjs';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm';
const HAND = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const POSE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// MediaPipe は部品の読み込みに importScripts を使うが、この形の担当（module worker）には無い。
// 同じ働きを用意する（読み込み先は上の WASM の場所だけ）。
if (typeof self.importScripts !== 'function' || !('ModuleFactory' in self)) {
  self.importScripts = (...urls) => {
    for (const u of urls) {
      if (!String(u).startsWith(WASM)) throw new Error('読み込み先が想定外です: ' + u);
      const x = new XMLHttpRequest(); x.open('GET', u, false); x.send();
      if (x.status !== 200) throw new Error('読み込みに失敗しました: ' + u);
      (0, eval)(x.responseText);
    }
  };
}

let hands = null, pose = null;

async function make(Kind, opts) {
  for (const delegate of ['GPU', 'CPU']) {
    try { return { lm: await Kind.createFromOptions(fs, { ...opts, baseOptions: { ...opts.baseOptions, delegate } }), delegate }; }
    catch (e) { if (delegate === 'CPU') throw e; }
  }
}
let fs;

self.onmessage = async ({ data: m }) => {
  if (m.type === 'init') {
    try {
      fs = await FilesetResolver.forVisionTasks(WASM);
      const h = await make(HandLandmarker, { baseOptions: { modelAssetPath: HAND }, runningMode: 'VIDEO', numHands: 2 });
      hands = h.lm;
      const p = await make(PoseLandmarker, { baseOptions: { modelAssetPath: POSE }, runningMode: 'VIDEO', numPoses: 4, outputSegmentationMasks: true }).catch(() => null);
      pose = p && p.lm;
      self.postMessage({ type: 'ready', delegate: h.delegate });
    } catch (e) { self.postMessage({ type: 'error', message: String(e && e.message || e) }); }
    return;
  }
  if (m.type === 'frame') {
    const out = { type: 'result', hands: [], people: null, body: undefined };
    try {
      const r = hands.detectForVideo(m.bitmap, m.ts);
      out.hands = (r.landmarks || []).map((lm) => lm.map((p) => [p.x, p.y]));
      if (pose && m.wantPose) {
        const pr = pose.detectForVideo(m.bitmap, m.ts);
        out.people = (pr.landmarks || []).length;
        const masks = pr.segmentationMasks || [];
        if (m.bodyOn && masks.length) {
          let merged = null;
          for (const mk of masks) {
            const f = buildField(mk.getAsFloat32Array(), mk.width, mk.height);
            if (!merged) merged = f; else for (let i = 0; i < f.length; i++) merged[i] = Math.max(merged[i], f[i]);
            mk.close();
          }
          out.body = merged;
        } else { masks.forEach((mk) => mk.close()); out.body = null; }
      }
    } catch (e) { out.error = String(e && e.message || e); }
    m.bitmap.close();
    self.postMessage(out);
  }
};
