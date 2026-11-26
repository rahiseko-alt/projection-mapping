import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReviewTools, buildReviewPrompt, MAX_CHANGES } from '../../server/reviewer.mjs';
import { mergePresets, pickByKeyword } from '../../shared/scene.mjs';

test('振り返りで直した中身と理由が、道具の側で記録される', () => {
  const t = createReviewTools();
  const msg = t.setPreset({ form: 'rain', reason: '人の増え方 -1.2', speed: 0.8, colors: ['#334455', '#667788', '#99aabb'] });
  assert.match(msg, /直しました/);
  assert.deepEqual(t.state.diffs.map((d) => d.field).sort(), ['colors', 'speed']);
  assert.equal(t.state.diffs[0].reason, '人の増え方 -1.2');
  assert.equal(t.state.overrides.rain.speed, 0.8);
});

test('決まりの外の値は直さず、断った理由を残す', () => {
  const t = createReviewTools();
  t.setPreset({ form: 'rain', reason: 'x', speed: 9 });
  t.setPreset({ form: 'fire', reason: 'x', speed: 1 });
  assert.equal(t.state.diffs.length, 0);
  assert.equal(t.state.rejected.length, 2);
});

test(`1回の振り返りで直すのは${MAX_CHANGES}か所まで`, () => {
  const t = createReviewTools();
  const speeds = [0.4, 0.5, 0.6, 0.7, 0.9, 1.1, 1.3];
  for (const s of speeds) t.setPreset({ form: 'flow', reason: 'x', speed: s });
  assert.equal(t.state.diffs.length, MAX_CHANGES);
  assert.ok(t.state.rejected.length >= 1);
});

test('足したキーワードで、次の展示から場面が切り替わる', () => {
  const t = createReviewTools();
  t.setPreset({ form: 'orbit', reason: '「さみしい」がどこにも合わなかった', keys: ['宇宙', '星', '夜', '寂', '孤独', 'さみしい'] });
  const presets = mergePresets(t.state.overrides);
  assert.equal(pickByKeyword('なんかさみしい', [], presets).form, 'orbit');
});

test('振り返り役への指示に、効き目・言葉・いまの設定が入る', () => {
  const p = buildReviewPrompt({ date: '2026-11-25', byForm: [{ form: 'swarm', avgGained: 1 }], results: [{ source: 'agent' }], speeches: ['さみしい'], errors: [], overrides: {} });
  for (const k of ['2026-11-25', 'swarm', 'さみしい', '頭脳 1', 'keys']) assert.ok(p.includes(k), k);
});

test('改善記録の題名は自動で付けるので、エージェントが書いた題名は外す', () => {
  const t = createReviewTools();
  t.writeReport({ markdown: '# 改善記録 2026-11-24\n\n## 直したこと\n- なし' });
  assert.equal(t.state.report.startsWith('## 直したこと'), true);
});
