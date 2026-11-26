// 場面の動き。どの場面も同じ形の関数 move(p, f, t, sp, W, H, dx, dy, d) で、粒 p の速さ（p.vx, p.vy）を変える。
//   p: 粒 { x, y, vx, vy, a（0〜6.28の固有の角度）, k（0.5〜1.5の固有の重さ） }
//   f: 粒が向かう点（手の位置。手が無いときはゆっくり動く点） { x, y }
//   t: 秒、sp: 速さ（0.3〜2.5）、W, H: 画面の幅と高さ、dx, dy, d: 粒から f への差と距離
// 位置の更新（p.x += p.vx）と画面の端の処理は、呼ぶ側が edge に従って行う。
//   edge: 'wrap'（反対側から出る）/ 'fall'（下に落ちたら上から）
//   draw: 'dot'（丸い点）/ 'streak'（縦の線）

export const BUILTIN_FORMS = [
  { id: 'swarm', name: '漂う群れ', edge: 'wrap', draw: 'dot', move(p, f, t, sp, W, H, dx, dy, d) { p.vx += dx / d * .12 * p.k * sp + Math.cos(p.a + t) * .08; p.vy += dy / d * .12 * p.k * sp + Math.sin(p.a + t) * .08; p.vx *= .96; p.vy *= .96; } },
  { id: 'flow', name: '流れる川', edge: 'wrap', draw: 'dot', move(p, f, t, sp, W, H, dx, dy, d) { const ang = Math.sin(p.y * .008 + t * .6) * 1.2 + Math.cos(p.x * .006) * .8; p.vx = p.vx * .9 + Math.cos(ang) * .6 * sp; p.vy = p.vy * .9 + Math.sin(ang) * .35 * sp; if (d < 140) { p.vx -= dx / d * 1.4; p.vy -= dy / d * 1.4; } } },
  { id: 'bloom', name: '咲く花', edge: 'wrap', draw: 'dot', move(p, f, t, sp, W, H) { const R = 40 + Math.abs(Math.sin((p.a + t * .2 * sp) * 3)) * Math.min(W, H) * .28 * p.k, ang = p.a + t * .25 * sp; p.vx = p.vx * .85 + (f.x + Math.cos(ang) * R - p.x) * .012 * sp; p.vy = p.vy * .85 + (f.y + Math.sin(ang) * R - p.y) * .012 * sp; } },
  { id: 'rain', name: '降る雨', edge: 'fall', draw: 'streak', move(p, f, t, sp, W, H, dx, dy, d) { p.vy = p.vy * .9 + (.47 + .2 * p.k) * sp; p.vx *= .9; if (d < 120) { p.vx -= dx / d * 2.2; p.vy -= dy / d * .8; } } },
  { id: 'orbit', name: '巡る星', edge: 'wrap', draw: 'dot', move(p, f, t, sp, W, H) { const R = 30 + p.k * Math.min(W, H) * .32, ang = p.a + t * (.5 / p.k) * sp; p.vx = p.vx * .88 + (f.x + Math.cos(ang) * R - p.x) * .01; p.vy = p.vy * .88 + (f.y + Math.sin(ang) * R * .6 - p.y) * .01; } },
];

import { parse } from 'acorn';

export const CODE_LIMIT = 1200;
export const ID_PATTERN = /^[a-z][a-z0-9]{1,15}$/;

// 新しい場面の動きに使ってよいものだけを、書き方の木（構文木）で確かめる（使ってよいものの一覧方式）。
// 文字の見た目ではなく解釈した結果で確かめるので、\u0070rocess のような書き換えも通らない。
// 繰り返し・関数・配列・文字列が無いので、1歩の計算は必ずすぐ終わる。
const ARGS = new Set(['p', 'f', 't', 'sp', 'W', 'H', 'dx', 'dy', 'd']);
const READ = { p: new Set(['x', 'y', 'vx', 'vy', 'a', 'k', 'r']), f: new Set(['x', 'y']) };
const WRITE = { p: new Set(['vx', 'vy']) };
export const MATH = new Set(['abs', 'sin', 'cos', 'tan', 'atan2', 'sqrt', 'hypot', 'min', 'max', 'floor', 'ceil', 'round', 'exp', 'log', 'pow', 'sign', 'random', 'PI', 'E']);
const BIN = new Set(['+', '-', '*', '/', '%', '**', '<', '>', '<=', '>=', '===', '!==', '==', '!=']);
const ASSIGN = new Set(['=', '+=', '-=', '*=', '/=']);

export function checkFormCode(code) {
  const c = String(code || '');
  if (!c.trim()) return ['動きの中身が空'];
  if (c.length > CODE_LIMIT) return [`動きの中身は${CODE_LIMIT}字以内`];
  let ast;
  try { ast = parse(c, { ecmaVersion: 2022, sourceType: 'script' }); } catch (e) { return [`書き方の誤り: ${e.message}`]; }
  const errors = [];
  const locals = new Set();
  const bad = (what) => { if (errors.length < 5) errors.push(`使えない書き方: ${what}（Math と、引数 p f t sp W H dx dy d、const・let・if、四則演算だけで書く）`); };
  const isMember = (n, obj, props) => n.type === 'MemberExpression' && !n.computed && n.object.type === 'Identifier' && n.object.name === obj && n.property.type === 'Identifier' && props.has(n.property.name);
  function expr(n) {
    switch (n.type) {
      case 'Literal': if (typeof n.value !== 'number' && typeof n.value !== 'boolean') bad('文字列などの値'); return;
      case 'Identifier': if (!ARGS.has(n.name) && !locals.has(n.name)) bad(n.name); return;
      case 'MemberExpression':
        if (isMember(n, 'p', READ.p) || isMember(n, 'f', READ.f) || isMember(n, 'Math', MATH)) return;
        return bad(n.computed ? '[ ]' : `${n.object.name || '?'}.${n.property.name || '?'}`);
      case 'CallExpression':
        if (!isMember(n.callee, 'Math', MATH)) return bad('Math 以外の呼び出し');
        return n.arguments.forEach(expr);
      case 'BinaryExpression': if (!BIN.has(n.operator)) bad(n.operator); expr(n.left); expr(n.right); return;
      case 'LogicalExpression': expr(n.left); expr(n.right); return;
      case 'UnaryExpression': if (!['-', '+', '!'].includes(n.operator)) bad(n.operator); expr(n.argument); return;
      case 'ConditionalExpression': expr(n.test); expr(n.consequent); expr(n.alternate); return;
      case 'AssignmentExpression': target(n.left); if (!ASSIGN.has(n.operator)) bad(n.operator); expr(n.right); return;
      case 'UpdateExpression': target(n.argument); return;
      case 'SequenceExpression': n.expressions.forEach(expr); return;
      default: bad(n.type);
    }
  }
  function target(n) {
    if (n.type === 'Identifier' && locals.has(n.name)) return;
    if (isMember(n, 'p', WRITE.p)) return;
    bad('p.vx・p.vy と自分で作った変数のほかへの書き込み');
  }
  function stmt(n) {
    switch (n.type) {
      case 'ExpressionStatement': return expr(n.expression);
      case 'VariableDeclaration':
        if (n.kind === 'var') bad('var');
        for (const d of n.declarations) {
          if (d.id.type !== 'Identifier' || ARGS.has(d.id.name) || d.id.name === 'Math') { bad('引数と同じ名前の変数'); continue; }
          if (d.init) expr(d.init);
          locals.add(d.id.name);
        }
        return;
      case 'IfStatement': expr(n.test); stmt(n.consequent); if (n.alternate) stmt(n.alternate); return;
      case 'BlockStatement': return n.body.forEach(stmt);
      case 'EmptyStatement': return;
      default: bad(n.type);
    }
  }
  ast.body.forEach(stmt);
  return errors;
}

/** 関数の中身の文字列から move 関数を作る。checkFormCode を通ったものだけを渡す。 */
export function compileMove(code) {
  // eslint-disable-next-line no-new-func
  return new Function('p', 'f', 't', 'sp', 'W', 'H', 'dx', 'dy', 'd', 'Math', `"use strict";\n${code}`);
}

/** 粒の位置を1歩進め、端を処理する（映像の本体と、試し動かしの両方で使う）。 */
export function advance(p, form, W, H) {
  p.x += p.vx; p.y += p.vy;
  if (form.edge === 'fall') { if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; } }
  else { if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20; if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20; }
}

/**
 * 試し動かし: 粒200個を、手がある時・無い時の両方で600歩動かす。
 * 例外が出ない・値が壊れない（NaN・無限）・時間内に終わる・最後に粒の3割以上が画面に見えている、を確かめる。
 */
export function trialRun(move, form, { W = 1280, H = 720, steps = 600, n = 200, budgetMs = 1500 } = {}) {
  const errors = [];
  const parts = Array.from({ length: n }, (_, i) => ({ x: (i * 37) % W, y: (i * 53) % H, vx: 0, vy: 0, a: (i * 0.618) % 6.28, k: 0.5 + (i % 10) / 10 }));
  const start = Date.now();
  for (let s = 0; s < steps; s++) {
    const t = s / 60;
    const f = s < steps / 2 ? { x: W * 0.3, y: H * 0.5 } : { x: W / 2 + Math.cos(t) * W * 0.3, y: H * 0.42 + Math.sin(t) * H * 0.22 };
    for (const p of parts) {
      const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy) + .01;
      try { move(p, f, t, 1, W, H, dx, dy, d, Math); } catch (e) { errors.push(`動かすと止まる: ${e.message}`); return { ok: false, errors }; }
      if (![p.x, p.y, p.vx, p.vy].every(Number.isFinite)) { errors.push('値が壊れる（NaN や無限になる）'); return { ok: false, errors }; }
      advance(p, form, W, H);
    }
    if (Date.now() - start > budgetMs) { errors.push(`重すぎる（${steps}歩が${budgetMs}ミリ秒で終わらない）`); return { ok: false, errors }; }
  }
  const visible = parts.filter((p) => p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H).length / n;
  if (visible < 0.3) errors.push(`粒が画面からほとんど消える（見えているのは${Math.round(visible * 100)}%）`);
  const spread = Math.hypot(...['x', 'y'].map((k) => { const v = parts.map((p) => p[k]); return Math.max(...v) - Math.min(...v); }));
  if (spread < 40) errors.push('粒が1点に固まって形にならない');
  return { ok: errors.length === 0, errors, visible: +visible.toFixed(2), ms: Date.now() - start };
}

/** 保存された新しい場面（config/forms/<id>.json の中身）を確かめ、使える形にする。 */
export function loadCustomForm(def) {
  const errors = [];
  if (!ID_PATTERN.test(def?.id || '')) errors.push('id は英小文字で始まる2〜16字（英小文字と数字）');
  if (BUILTIN_FORMS.some((f) => f.id === def?.id)) errors.push('元からある場面と同じ id');
  const name = String(def?.name || '').trim();
  if (!name || [...name].length > 8) errors.push('name は1〜8字');
  if (!['wrap', 'fall'].includes(def?.edge)) errors.push("edge は 'wrap' か 'fall'");
  if (!['dot', 'streak'].includes(def?.draw)) errors.push("draw は 'dot' か 'streak'");
  errors.push(...checkFormCode(def?.code));
  if (errors.length) return { errors };
  let move;
  try { move = compileMove(def.code); } catch (e) { return { errors: [`書き方の誤り: ${e.message}`] }; }
  const form = { id: def.id, name, edge: def.edge, draw: def.draw, move };
  const r = trialRun(move, form);
  if (!r.ok) return { errors: r.errors };
  return { form, errors: [] };
}
