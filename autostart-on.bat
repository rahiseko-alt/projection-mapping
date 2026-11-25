@echo off
chcp 65001 > nul
cd /d "%~dp0"
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath(Startup)+\ishi-no-hikari.lnk); $s.TargetPath=%~dp0show.bat; $s.WorkingDirectory=%~dp0; $s.Save()"
if errorlevel 1 ( echo 設定できませんでした。 ) else ( echo パソコンにサインインしたら、展示が自動で始まるようにしました。やめるときは autostart-off.bat を開いてください。 )
pause
