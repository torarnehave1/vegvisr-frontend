@echo off
setlocal enabledelayedexpansion

REM Check if VERSION file exists, if not create it
if not exist VERSION (
    echo v1.0.0 > VERSION
)

REM Read current version
set /p current_version=<VERSION

REM Remove 'v' and split into major, minor, patch
set version=%current_version:~1%
for /f "tokens=1-3 delims=." %%a in ("%version%") do (
    set major=%%a
    set minor=%%b
    set patch=%%c
)

REM Bump patch version
set /a patch=patch+1

REM Create new version string
set new_version=v%major%.%minor%.%patch%

REM Update VERSION file
echo %new_version% > VERSION

REM Stage all changes except VERSION file
git add .

REM Use the first argument as the commit message, or a default if none provided
if "%~1"=="" (
    set commit_msg=Automated commit
) else (
    set commit_msg=%~1
)

REM Commit with version and custom message
git commit -m "%new_version%: %commit_msg%"

echo Committed as %new_version%: %commit_msg%