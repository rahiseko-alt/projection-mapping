# 意思を持つ光

人の動きと言葉に反応するプロジェクションマッピングと、それを操作するエージェントです。
Windows のパソコン（CPUだけ）と、Webカメラ・プロジェクターで動きます。

## しくみ

1. **映像の本体**（`stage/`）: Chrome を全画面にしてプロジェクターへ映す。人の手と体を MediaPipe で読み取り、手を握ると光がはじける。四隅の補正は Maptastic で行う。素早い反応は、ここだけで完結する
2. **受付役**（`server/index.mjs`）: パソコンの中で動く小さな仲介役。映像の本体から様子と言葉を受け取り、司令塔へ渡す。動画を映すときは MapMap へ合図（OSC）を送る
3. **エージェント**（`server/brain.mjs`）: Claude Agent SDK で、言葉と様子から次の場面（5種類・色・速さ・粒の数・30字以内の返事）を決める。使える道具は「場面を出す」だけ。10秒で答えが来なければ、言葉のキーワードで代わりに切り替える
4. **振り返り役のエージェント**（`server/reviewer.mjs`）: 展示の後に `npm run review` を打つと、場面ごとに「人が増えたか・手を握ったか」を測り、エージェントがその数字と来場者の言葉を読んで、場面の色・速さ・キーワードを自分で直す（1回5か所まで、根拠つき）。展示中の頭脳への改善メモも書く。何を・なぜ変えたか（前→後）は `docs/agent/改善記録/` に自動で残る

## 使い方（Windows）

手順は [docs/run-windows.md](docs/run-windows.md) にあります。要点だけ:

```
npm install
npm start
```

そのあと Chrome で `http://localhost:8787` を開き、「カメラを起動して始める」を押します。
Claude Code にご自分の契約でログインしておけば、Claude が場面を選びます（API の鍵は要りません。つながらないときはキーワードで動きます）。

## 送るデータ

カメラの映像はパソコンの外に出ません。Claude へ送るのは、言葉の文字と、人数・手の数・直近の場面だけです。
詳しくは [PRIVACY.md](PRIVACY.md) を見てください。

## 検査

```
npm test
```

## 開発の進め方

この置き場所は、Claude Code で開発を進めるためのひな型から作りました。

## 覚えるのはこの3つだけ

| 打つもの | 何が起きるか |
| --- | --- |
| `s` | 前回の続き・いまの状態・最初の一手を報告します（開始時は自動でも出ます） |
| `f` | 環境を破棄しても大丈夫な状態まで片づけ、終了して良いかを報告します |
| `/next-step` | いまどこにいて、次に何を打てばいいかを1つだけ提示します |

コマンドを覚える必要はありません。「〇〇を作りたい」と伝えるだけでも、実装前に自動で案内が入ります。

## 入っているもの

- `.claude/skills/` に [mattpocock/skills](https://github.com/mattpocock/skills) を 12 個インストール
  （`npx skills add mattpocock/skills`、`skills-lock.json` でバージョン固定）
  - ユーザー起動（このうち案内で使うもの）: `grill-with-docs` / `to-spec` / `to-tickets` / `implement` / `improve-codebase-architecture` / `setup-matt-pocock-skills`
  - モデル起動: `grilling` / `domain-modeling` / `codebase-design` / `tdd` / `code-review`
- `.claude/skills/s/`, `.claude/skills/f/`, `.claude/skills/next-step/`: この置き場所独自の案内役と儀式
- `.claude/skills/conduct/`: 指揮の案内役。相談の後の全段階を、役割表に従って3社の道具に振り分けて進める
- `.claude/router/`: 振り分け役（`route.sh`）と役割表（`roles.txt`）。モデルの乗り換えは役割表の書き換えだけで行う
- `.claude/hooks/template-cleanup.sh`: 片づけ役。複製先の最初の会話で、ひな型の作業日誌を片づける
- `.template/`: ひな型自身の記録（用語集・決めた理由など）。複製先では自動で消える
- `tests/`: 振り分け役と片づけ役の検査。直したときに `sh tests/route.test.sh` と `sh tests/template-cleanup.test.sh` を流す
- `docs/setup-windows.md`: Windows での初回準備の手引き
- `.claude/settings.json`: 会話開始時に `docs/agents/flow-map.md` を読み込む仕組み
- `docs/agents/flow-map.md`: 進め方と、説明の書き方のルール
- `docs/agents/handover.md`: 会話をまたぐ引き継ぎメモ。区切りごとに自動で追記されます
- `AGENTS.md`: 開発フローの全体像
- `docs/agents/issue-tracker.md`: 作業指示書の置き場所は GitHub Issues
- `docs/agents/domain.md`: 用語集は `CONTEXT.md`、判断の記録は `docs/adr/`

## フロー全体

- 新規開発・機能追加: `/grill-with-docs` → `/conduct`（あとは途中確認と最終確認で GO / NG を返すだけ）
- 手で1段ずつ進める場合: `/grill-with-docs` → 必要に応じて `/to-spec` → `/to-tickets` → `/implement`
- 設計改善: `/improve-codebase-architecture` → 候補を選択 → `/grill-with-docs` または `/codebase-design` → 以下同じ

`/implement` は `/tdd` で RED → GREEN を繰り返し、最後に `/code-review` を実行します。
詳細は [AGENTS.md](./AGENTS.md) の「Development flow」を参照してください。

## スキルの更新

```bash
npx skills update
```

スキル本体は本家のまま使う方針のため、ローカルで書き換えないでください。
