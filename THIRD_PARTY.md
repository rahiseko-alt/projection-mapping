# 使っている部品

| 部品 | 役目 | ライセンス | 入れ方 |
| --- | --- | --- | --- |
| [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js) 1.2.3 | 手と体の読み取り（CPU） | Apache-2.0 | ブラウザが CDN から読む |
| [Maptastic](https://github.com/glowbox/maptasticjs) 3.3.1 | 四隅の補正 | MIT | npm |
| [ws](https://github.com/websockets/ws) | 映像の本体と受付役のつながり | MIT | npm |
| [osc-js](https://github.com/adzialocha/osc-js) | MapMap への合図 | MIT | npm |
| [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk/overview) | エージェント | Anthropic の利用規約（オープンソースではない） | npm |
| [zod](https://github.com/colinhacks/zod) | 道具の入力の形 | MIT | npm |
| [MapMap](https://mapmapteam.github.io/) | 動画の投影（使うときだけ） | GPL（同梱せず、外から合図を送るだけ） | 利用者が別に入れる |
