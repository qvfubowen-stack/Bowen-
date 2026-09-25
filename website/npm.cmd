@chcp 65001 >nul
@echo off
rem 极简 npm 兼容层：让「npm run dev」在本机可用（本机只装了 Node.js，没有全局 npm）
rem 真实 npm 存在时优先使用真实 npm。
where npm >nul 2>nul
if %ERRORLEVEL%==0 (
  npm %*
  exit /b %ERRORLEVEL%
)
node "%~dp0tools\npm-run.mjs" %*
exit /b %ERRORLEVEL%
