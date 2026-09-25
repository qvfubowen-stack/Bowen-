@echo off
rem ---------------------------------------------------------------------------
rem Minimal npm compatibility shim for "npm run <script>".
rem
rem Why this file exists: this development machine has Node.js but no global npm.
rem It lets the documented "npm run dev" / "npm run build" work as written.
rem
rem It does NOT implement install/publish/other npm subcommands. To install
rem dependencies use a real npm or pnpm (see delivery/05_how-to-run.md).
rem
rem Do not add a "where npm" check here: cmd.exe resolves "npm" to this very
rem file, which recurses until "Maximum setlocal recursion level reached".
rem To use a real npm instead, call it by full path or run it from a directory
rem that is not the parent of this shim.
rem
rem Keep this file ASCII-only: cmd.exe parses .cmd files using the OEM code
rem page, so non-ASCII characters cause parsing errors.
rem ---------------------------------------------------------------------------

node "%~dp0tools\npm-run.mjs" %*
exit /b %ERRORLEVEL%
