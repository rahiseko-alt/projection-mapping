@echo off
chcp 65001 > nul
cd /d "%~dp0"
rem 場所の名前に空白や記号があっても壊れないよう、PowerShell には環境変数で渡す
set "ISHI_TARGET=%~dp0show.bat"
set "ISHI_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$l = Join-Path ([Environment]::GetFolderPath('Startup')) 'ishi-no-hikari.lnk'; $s = (New-Object -ComObject WScript.Shell).CreateShortcut($l); $s.TargetPath = $env:ISHI_TARGET; $s.WorkingDirectory = $env:ISHI_DIR; $s.Save()"
if errorlevel 1 (
  echo 設定できませんでした。
) else (
  echo パソコンにサインインしたら、展示が自動で始まるようにしました。やめるときは autostart-off.bat を開いてください。
)
pause
