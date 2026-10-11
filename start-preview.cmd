@echo off
REM ===========================================================================
REM  Bowen website - local preview launcher (developer convenience, NOT deploy)
REM ===========================================================================
REM  Usage:
REM    start-preview.cmd          start the local preview on port 3000
REM    start-preview.cmd stop     stop it (kills the process listening on 3000)
REM
REM  What this is:
REM    - Local noindex preview of the built Next.js site. Not a deployment.
REM    - Binds the default Next.js address (127.0.0.1 and LAN).
REM    - RFQ emails use the mock transport: they are written to a local file and
REM      are NEVER sent to any real mailbox.
REM    - RFQ records are stored in a local JSONL file (no Supabase credentials).
REM    - NEXT_PUBLIC_SITE_URL is empty and SITE_INDEXING_ENABLED stays false,
REM      so the site remains noindex and the sitemap stays empty. Expected.
REM
REM  Prerequisites: run `node node_modules\next\dist\bin\next build` in
REM  website\ first if .next is missing or stale.
REM ===========================================================================
setlocal

set "ROOT=%~dp0"
set "SITE=%ROOT%website"
set "TMPDIR=%ROOT%tmp"
set "LOG=%TMPDIR%\preview-server.log"

if /I "%~1"=="stop" goto :stop

if not exist "%SITE%\.next\BUILD_ID" (
  echo [preview] .next not found. Run a build first:
  echo           cd /d "%SITE%" ^&^& pnpm build
  exit /b 1
)

if not exist "%TMPDIR%" mkdir "%TMPDIR%"

echo [preview] starting on http://127.0.0.1:3000  (log: %LOG%)
cd /d "%SITE%"

set RFQ_STORE_DRIVER=json
set RFQ_JSON_STORE_PATH=%TMPDIR%\preview-rfq.jsonl
set RFQ_MAIL_DRIVER=mock
set RFQ_MOCK_OUTBOX_PATH=%TMPDIR%\preview-outbox.jsonl
set RFQ_RECIPIENT_EMAIL=qfbowen@126.com
set RFQ_FROM_EMAIL=
set RFQ_IP_HASH_SECRET=preview-local-only
set RFQ_TRUST_PROXY=true
set NEXT_PUBLIC_SITE_URL=
set SITE_INDEXING_ENABLED=false

start "bowen-preview" /B cmd /c "node node_modules\next\dist\bin\next start -p 3000 > "%LOG%" 2>&1"
echo [preview] started. Open http://127.0.0.1:3000
exit /b 0

:stop
echo [preview] stopping anything listening on port 3000 ...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:"LISTENING" ^| findstr ":3000 "') do (
  echo [preview] killing PID %%p
  taskkill /PID %%p /T /F >nul 2>&1
)
echo [preview] done.
exit /b 0
