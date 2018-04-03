@echo off
node --version | findstr /c:v8 /c:v9 > nul
if errorlevel 1 goto outdated
call npm install
if errorlevel 1 goto error
call npm run build
echo Installation successful. You can close this window and run start_server.bat
goto eof
:error
echo Installation has an error. Please try again or contact me on Discord: Tarnadas#0582 or https://discord.gg/SPZsgSe
goto eof
:outdated
echo Your Node version is outdated. Please install at least Node v8.x -- https://nodejs.org
:eof
pause > nul