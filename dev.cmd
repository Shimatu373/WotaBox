@echo off
chcp 65001 >nul
rem 免权限备用启动器：临时把 nodejs 提到 PATH 最前面，绕开损坏的 dotnet 条目
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
call npm run dev