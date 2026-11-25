# プライバシーについて

- **カメラの映像**: パソコンの中（Chrome の中）だけで処理し、保存も送信もしません
- **声**: Chrome の音声認識で文字にします。端末の中で文字にする設定にしてありますが、対応していない Chrome では Google のサーバーへ送られることがあります（https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition ）
- **Claude へ送るもの**: API の鍵を設定したときだけ、言葉の文字・人数・手の数・直近の場面・これまでの効き目を Anthropic へ送ります（https://www.anthropic.com/legal/privacy ）
- **記録**: `logs/` に人数・場面・言葉の文字を残します。顔や映像は残しません。`logs/` はこの置き場所に上げない設定にしてあります
