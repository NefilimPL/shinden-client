@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "ROOT=%~dp0"
set "LOG_DIR=%ROOT%logs"
set "LOG_FILE=%LOG_DIR%\build-exe.log"
set "SHINDEN_API_GIT_URL=https://github.com/NefilimPL/shinden-pl-api-rs.git"
set "FORCE_BOOTSTRAP=0"
set "HAS_BACKEND_BRANCH_ARG=0"
if /I "%~1"=="--force-bootstrap" (
    set "FORCE_BOOTSTRAP=1"
    shift
)
set "BUILD_ARGS=%*"
if "%BUILD_ARGS%"=="" set "BUILD_ARGS=--clean"
call :scan_backend_branch_arg %BUILD_ARGS%

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

call :log "Starting generator_exe launcher"
call :refresh_path

call :ensure_python
if "%ERRORLEVEL%"=="10" exit /b 0
if errorlevel 1 goto fail

call :run_python scripts\build_exe.py --preflight
set "PREFLIGHT_EXIT=%ERRORLEVEL%"
call :log "Preflight exit code: %PREFLIGHT_EXIT%"
if not "%PREFLIGHT_EXIT%"=="0" call :log_tool_lookup

set "NEED_BOOTSTRAP=0"
if not "%PREFLIGHT_EXIT%"=="0" set "NEED_BOOTSTRAP=1"
if "%FORCE_BOOTSTRAP%"=="1" (
    call :log "Bootstrap was forced by --force-bootstrap"
    set "NEED_BOOTSTRAP=1"
)

if "%NEED_BOOTSTRAP%"=="1" (
    call :log "Installing or checking build requirements with winget"
    where winget >nul 2>nul
    if errorlevel 1 (
        set "BOOTSTRAP_UNAVAILABLE=1"
        call :log "winget was not found. Cannot install Node.js/Rust automatically on this machine."
    ) else (
        call :run_python scripts\build_exe.py --bootstrap --yes
        if errorlevel 1 goto fail
        call :refresh_path
    )
)

if defined BOOTSTRAP_UNAVAILABLE goto fail

call :run_python scripts\build_exe.py --preflight
if errorlevel 1 (
    if not defined GENERATOR_EXE_RESTARTED (
        call :log "Build tools are still not visible in PATH. Opening a refreshed launcher window."
        set "GENERATOR_EXE_RESTARTED=1"
        start "Shinden EXE Generator" cmd /k "cd /d ""%ROOT%"" && set GENERATOR_EXE_RESTARTED=1 && ""%~f0"" %BUILD_ARGS%"
        exit /b 0
    )
    goto fail
)

call :select_backend_branch
if errorlevel 1 goto fail

call :log "Generating EXE"
call :run_python scripts\build_exe.py %BUILD_ARGS%
if errorlevel 1 goto fail

call :log "EXE generation finished"
if /I "!BUILD_ARGS:--dry-run=!"=="!BUILD_ARGS!" if exist "%ROOT%dist-exe" start "" "%ROOT%dist-exe"
goto done

:ensure_python
call :has_py3
if not errorlevel 1 exit /b 0

call :has_python
if not errorlevel 1 exit /b 0

where winget >nul 2>nul
if errorlevel 1 (
    call :log "Python and winget were not found. Install Python 3 manually, then run generator_exe.bat again."
    exit /b 1
)

call :log "Python was not found. Installing Python 3.12 with winget."
winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements
if errorlevel 1 exit /b %ERRORLEVEL%

call :refresh_path
call :has_py3
if not errorlevel 1 exit /b 0

call :has_python
if not errorlevel 1 exit /b 0

call :log "Python was installed, but this shell cannot see it yet. Opening a refreshed launcher window."
start "Shinden EXE Generator" cmd /k "cd /d ""%ROOT%"" && set GENERATOR_EXE_RESTARTED=1 && ""%~f0"" %BUILD_ARGS%"
exit /b 10

:select_backend_branch
if "%HAS_BACKEND_BRANCH_ARG%"=="1" (
    call :log "Backend branch already provided in build arguments"
    exit /b 0
)

set "BACKEND_BRANCH_COUNT=0"
where git >nul 2>nul
if errorlevel 1 (
    call :log "Git was not found while detecting backend branches. Using fallback branch choices."
    goto backend_branch_fallback
)

for /f "tokens=2" %%B in ('git ls-remote --heads "%SHINDEN_API_GIT_URL%" 2^>nul') do (
    set "BACKEND_BRANCH_REF=%%B"
    set "BACKEND_BRANCH_REF=!BACKEND_BRANCH_REF:refs/heads/=!"
    if not "!BACKEND_BRANCH_REF!"=="" (
        set /a BACKEND_BRANCH_COUNT+=1
        set "BACKEND_BRANCH_!BACKEND_BRANCH_COUNT!=!BACKEND_BRANCH_REF!"
        set "BACKEND_BRANCH_VALUE_!BACKEND_BRANCH_COUNT!=!BACKEND_BRANCH_REF!"
    )
)

if "!BACKEND_BRANCH_COUNT!"=="0" (
    call :log "No backend branches detected from remote. Using fallback branch choices."
    goto backend_branch_fallback
)
goto backend_branch_choose

:backend_branch_fallback
set "BACKEND_BRANCH_COUNT=2"
set "BACKEND_BRANCH_1=Main"
set "BACKEND_BRANCH_VALUE_1=Main"
set "BACKEND_BRANCH_2=dev"
set "BACKEND_BRANCH_VALUE_2=dev"

:backend_branch_choose
echo.
echo Wybierz branch backendu do budowy EXE:
for /L %%I in (1,1,!BACKEND_BRANCH_COUNT!) do echo   %%I. !BACKEND_BRANCH_%%I!
set /p "BACKEND_BRANCH_INDEX=Numer branchu [1]: "
if "!BACKEND_BRANCH_INDEX!"=="" set "BACKEND_BRANCH_INDEX=1"

set "BACKEND_BRANCH_SELECTED="
set "BACKEND_BRANCH_SELECTED_VALUE="
for /L %%I in (1,1,!BACKEND_BRANCH_COUNT!) do (
    if "%%I"=="!BACKEND_BRANCH_INDEX!" (
        set "BACKEND_BRANCH_SELECTED=!BACKEND_BRANCH_%%I!"
        set "BACKEND_BRANCH_SELECTED_VALUE=!BACKEND_BRANCH_VALUE_%%I!"
    )
)

if "!BACKEND_BRANCH_SELECTED!"=="" (
    call :log "Invalid backend branch choice '!BACKEND_BRANCH_INDEX!'. Using first option."
    set "BACKEND_BRANCH_SELECTED=!BACKEND_BRANCH_1!"
    set "BACKEND_BRANCH_SELECTED_VALUE=!BACKEND_BRANCH_VALUE_1!"
)

if "!BACKEND_BRANCH_SELECTED_VALUE!"=="" set "BACKEND_BRANCH_SELECTED_VALUE=!BACKEND_BRANCH_SELECTED!"
set "BUILD_ARGS=%BUILD_ARGS% --backend-branch !BACKEND_BRANCH_SELECTED_VALUE!"
call :log "Backend branch selected: !BACKEND_BRANCH_SELECTED! (!BACKEND_BRANCH_SELECTED_VALUE!)"
set "HAS_BACKEND_BRANCH_ARG=1"
exit /b 0

:scan_backend_branch_arg
if "%~1"=="" exit /b 0
set "BACKEND_BRANCH_ARG=%~1"
if /I "%~1"=="--backend-branch" set "HAS_BACKEND_BRANCH_ARG=1"
if /I "!BACKEND_BRANCH_ARG:~0,17!"=="--backend-branch=" set "HAS_BACKEND_BRANCH_ARG=1"
shift
goto scan_backend_branch_arg

:run_python
call :has_py3
if not errorlevel 1 (
    py -3 %*
    exit /b !ERRORLEVEL!
)

call :has_python
if not errorlevel 1 (
    python %*
    exit /b !ERRORLEVEL!
)

exit /b 1

:has_py3
where py >nul 2>nul
if errorlevel 1 exit /b 1
py -3 --version >nul 2>nul
exit /b %ERRORLEVEL%

:has_python
where python >nul 2>nul
if errorlevel 1 exit /b 1
python --version >nul 2>nul
exit /b %ERRORLEVEL%

:refresh_path
for /f "usebackq delims=" %%P in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$machine=[Environment]::GetEnvironmentVariable('Path','Machine'); $user=[Environment]::GetEnvironmentVariable('Path','User'); Write-Output ($machine + ';' + $user)" 2^>nul`) do set "PATH=%%P;%PATH%"
set "PATH=%PATH%;%ProgramFiles%\nodejs;%USERPROFILE%\.cargo\bin;%LOCALAPPDATA%\Microsoft\WindowsApps;%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts"
exit /b 0

:log_tool_lookup
call :log "Launcher user: %USERNAME%; USERPROFILE=%USERPROFILE%"
call :log "PATHEXT=%PATHEXT%"
call :log_where python
call :log_where py
call :log_where node
call :log_where npm
call :log_where npm.cmd
call :log_where cargo
call :log_where rustc
call :log_where winget
exit /b 0

:log_where
where "%~1" >nul 2>nul
if errorlevel 1 (
    call :log "where %~1: not found"
    exit /b 0
)
for /f "delims=" %%P in ('where "%~1" 2^>nul') do call :log "where %~1: %%P"
exit /b 0

:log
echo [%DATE% %TIME%] %~1
>> "%LOG_FILE%" echo [%DATE% %TIME%] %~1
exit /b 0

:fail
call :log "Generator failed. Opening build log."
if exist "%LOG_FILE%" start "" notepad "%LOG_FILE%"
exit /b 1

:done
call :log "Done"
if /I "!BUILD_ARGS:--dry-run=!"=="!BUILD_ARGS!" pause
exit /b 0
