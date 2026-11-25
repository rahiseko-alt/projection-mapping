@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo 今日の展示を振り返っています（1分ほど）...
call npm run review
pause
