@echo off
setlocal EnableDelayedExpansion
title MediSmart - Build Installer

echo.
echo ============================================================
echo   MediSmart Pro - Build Installer
echo ============================================================
echo.

:: --- Step 1: Check Python ---
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.11+ and retry.
    pause & exit /b 1
)
echo [OK] Python found.

:: --- Step 2: Install Python requirements ---
echo [INFO] Installing Python requirements...
python -m pip install -r backend\requirements.txt --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install Python requirements.
    pause & exit /b 1
)
echo [OK] Python requirements installed.

:: --- Step 3: Install PyInstaller ---
echo [INFO] Installing PyInstaller...
python -m pip install pyinstaller --quiet
if errorlevel 1 (
    echo [ERROR] Failed to install PyInstaller.
    pause & exit /b 1
)
echo [OK] PyInstaller ready.

:: --- Step 4: Build backend executable ---
echo [INFO] Building backend executable (this may take 2-3 minutes)...
python -m PyInstaller build\pyinstaller\cardio-backend.spec --distpath src-tauri\binaries --workpath build\pyinstaller\work --noconfirm
if errorlevel 1 (
    echo [ERROR] PyInstaller build failed.
    pause & exit /b 1
)
echo [OK] Backend executable built.

:: --- Step 5: Verify backend exe ---
if not exist "src-tauri\binaries\cardio-backend\cardio-backend.exe" (
    echo [ERROR] Backend exe not found after build.
    pause & exit /b 1
)
echo [OK] Backend exe verified.

:: --- Step 6: Verify real database ---
if not exist "data\cardiologie.sqlite3" (
    echo [ERROR] Real database not found at data\cardiologie.sqlite3
    pause & exit /b 1
)
for %%A in (data\cardiologie.sqlite3) do set DB_SIZE=%%~zA
if !DB_SIZE! LSS 1000000 (
    echo [WARNING] Database is smaller than 1MB - might be empty or demo data.
) else (
    echo [OK] Real database found ^(!DB_SIZE! bytes^).
)

:: --- Step 7: Install Node deps ---
echo [INFO] Installing Node.js dependencies...
npm install --silent
if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause & exit /b 1
)
echo [OK] Node dependencies installed.

:: --- Step 8: Build Tauri installer ---
echo [INFO] Building Tauri desktop installer (this may take 5-10 minutes)...
npm run desktop:build
if errorlevel 1 (
    echo [ERROR] Tauri build failed.
    pause & exit /b 1
)

echo.
echo ============================================================
echo   BUILD COMPLETE
echo ============================================================
echo.
echo   Installer location:
echo   src-tauri\target\release\bundle\nsis\
echo.
echo   The installer includes:
echo   - MediSmart frontend (React)
echo   - Backend server (auto-starts on launch)
echo   - Real patient database (10k patients)
echo   - All data migrated automatically
echo.
pause
