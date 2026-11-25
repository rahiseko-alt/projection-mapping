@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo 意思を持つ光 を起動します。この画面は閉じないでください（閉じると止まります）。
where node > nul 2>&1
if errorlevel 1 (
  echo Node.js が入っていません。https://nodejs.org/ja から LTS を入れてから、もう一度開いてください。
  pause
  exit /b 1
)
if not exist node_modules (
  echo 初回の準備をしています（1〜2分）...
  call npm install
)
set ISHI_OPEN=1
call npm start
pause
