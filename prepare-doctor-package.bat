@echo off
setlocal EnableDelayedExpansion
title MediSmart - Prepare Doctor Package
chcp 65001 >nul

echo.
echo ================================================================
echo   MediSmart Pro - Prepare Doctor Deployment Package
echo ================================================================
echo.

set "PKG=MediSmart-Doctor-Package"

:: --- Clean previous package ---
if exist "%PKG%" (
    echo [INFO] Removing previous package...
    rmdir /s /q "%PKG%"
)
mkdir "%PKG%"

:: --- Step 1: Verify backend exe exists ---
if not exist "src-tauri\binaries\cardio-backend\cardio-backend.exe" (
    echo [WARNING] cardio-backend.exe not found.
    echo           Run build-installer.bat first to compile the backend.
    echo           Continuing with portable Python mode instead.
    set "PORTABLE_MODE=python"
) else (
    set "PORTABLE_MODE=exe"
)

:: --- Step 2: Verify real database ---
if not exist "data\cardiologie.sqlite3" (
    echo [ERROR] Real database missing at data\cardiologie.sqlite3
    pause & exit /b 1
)
for %%A in (data\cardiologie.sqlite3) do set DB_SIZE=%%~zA
echo [OK] Real database found: !DB_SIZE! bytes
if !DB_SIZE! LSS 5000000 (
    echo [ERROR] Database too small - missing patient data.
    pause & exit /b 1
)

:: --- Step 3: Build frontend ---
echo [INFO] Building frontend...
call npm run build >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Frontend build failed.
    pause & exit /b 1
)
echo [OK] Frontend built.

:: --- Step 4: Try Tauri installer build ---
echo [INFO] Building Tauri NSIS installer...
call npm run desktop:build
if errorlevel 1 (
    echo [WARNING] Tauri build failed - falling back to portable package.
    set "USE_INSTALLER=no"
) else (
    set "USE_INSTALLER=yes"
)

if "%USE_INSTALLER%"=="yes" (
    :: --- Copy NSIS installer ---
    for /r "src-tauri\target\release\bundle\nsis" %%F in (*.exe) do (
        copy "%%F" "%PKG%\MediSmart-Setup.exe" >nul
        echo [OK] Installer copied to %PKG%\MediSmart-Setup.exe
        goto :installer_done
    )
    :installer_done
) else (
    :: --- Portable folder fallback ---
    echo [INFO] Creating portable package...
    mkdir "%PKG%\app"
    mkdir "%PKG%\app\backend"
    mkdir "%PKG%\app\data"
    mkdir "%PKG%\app\dist"
    mkdir "%PKG%\app\bin"

    xcopy /E /I /Q backend "%PKG%\app\backend" >nul
    xcopy /E /I /Q dist "%PKG%\app\dist" >nul
    copy "data\cardiologie.sqlite3" "%PKG%\app\data\cardiologie.sqlite3" >nul
    if exist "bin\cloudflared.exe" copy "bin\cloudflared.exe" "%PKG%\app\bin\cloudflared.exe" >nul
    if exist "src-tauri\binaries\cardio-backend\cardio-backend.exe" (
        mkdir "%PKG%\app\backend-exe"
        xcopy /E /I /Q "src-tauri\binaries\cardio-backend" "%PKG%\app\backend-exe" >nul
    )

    :: --- Create launcher ---
    > "%PKG%\Start-MediSmart.bat" (
        echo @echo off
        echo title MediSmart Pro
        echo cd /d "%%~dp0app"
        echo if exist "backend-exe\cardio-backend.exe" ^(
        echo     start "" /min "backend-exe\cardio-backend.exe"
        echo ^) else ^(
        echo     where python ^>nul 2^>^&1
        echo     if errorlevel 1 ^(
        echo         echo Python not installed. Install Python 3.11+ from python.org and retry.
        echo         pause
        echo         exit /b 1
        echo     ^)
        echo     start "" /min cmd /c python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
        echo ^)
        echo timeout /t 3 /nobreak ^>nul
        echo start "" "http://127.0.0.1:8000/" 2^>nul
        echo cd dist
        echo start "" /min cmd /c python -m http.server 5173
        echo timeout /t 2 /nobreak ^>nul
        echo start "" "http://127.0.0.1:5173/"
    )
)

:: --- Step 5: Create README ---
> "%PKG%\README.txt" (
    echo ================================================================
    echo   MediSmart Pro - Installation pour cabinet médical
    echo ================================================================
    echo.
    if "%USE_INSTALLER%"=="yes" (
        echo INSTALLATION:
        echo   1. Double-cliquez sur MediSmart-Setup.exe
        echo   2. Suivez l'assistant d'installation
        echo   3. Lancez "MediSmart" depuis le menu Démarrer
        echo.
        echo La base de données 10 000+ patients est incluse automatiquement.
    ) else (
        echo INSTALLATION ^(mode portable^):
        echo   1. Copiez ce dossier complet sur le PC du médecin
        echo   2. Double-cliquez sur Start-MediSmart.bat
        echo   3. L'application s'ouvre automatiquement dans le navigateur
        echo.
        echo PRÉREQUIS:
        echo   - Windows 10/11
        echo   - Python 3.11+ ^(si pas de cardio-backend.exe^)
    )
    echo.
    echo CONTENU:
    echo   - Backend MediSmart ^(serveur médical local^)
    echo   - Base de données complète ^(10 411 patients, 34 274 visites^)
    echo   - Interface React ^(frontend^)
    echo   - Cloudflare tunnel pour upload mobile
    echo   - Modèle IA: ContactDoctor/Bio-Medical-MultiModal-Llama-3-8B-V1
    echo.
    echo PREMIÈRE CONNEXION:
    echo   Utilisateur: admin
    echo   Mot de passe: admin123
    echo   ^(à changer dans Paramètres après la 1ère connexion^)
    echo.
    echo SUPPORT:
    echo   Pour activer l'IA, configurez votre clé HuggingFace dans
    echo   Paramètres ^> AI ^> HuggingFace API Key
    echo.
    echo ================================================================
)

echo.
echo ================================================================
echo   PACKAGE READY
echo ================================================================
echo.
echo   Folder: %PKG%\
echo.
if "%USE_INSTALLER%"=="yes" (
    echo   Send the entire folder to the doctor's PC.
    echo   He will run MediSmart-Setup.exe to install.
) else (
    echo   Send the entire folder to the doctor's PC.
    echo   He will double-click Start-MediSmart.bat to run.
)
echo.
echo   Real database included: !DB_SIZE! bytes
echo.
pause
