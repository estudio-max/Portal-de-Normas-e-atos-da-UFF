@echo off
setlocal EnableDelayedExpansion

echo ========================================
echo   BUILD and PACKAGE - Portal UFF v1
echo ========================================
echo.

set REPO_PATH=C:\Users\estud\OneDrive\Imagens\RAW\portal-normas-uff\repo
set REDESIGN_ZIP=uff-redesign-v1.zip

echo Repositorio: %REPO_PATH%
echo.

REM Verificar package.json
if not exist "%REPO_PATH%\package.json" (
    echo ERRO: package.json nao encontrado em:
    echo   %REPO_PATH%
    echo.
    echo Edite este arquivo .cmd e ajuste REPO_PATH.
    pause
    exit /b 1
)

REM Verificar zip do redesign
if not exist "%REPO_PATH%\%REDESIGN_ZIP%" (
    echo ERRO: %REDESIGN_ZIP% nao encontrado.
    echo Baixe o arquivo e coloque em: %REPO_PATH%
    pause
    exit /b 1
)

REM Verificar Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Node.js nao encontrado.
    echo Instale em https://nodejs.org
    pause
    exit /b 1
)

echo OK: Node.js encontrado
for /f "tokens=*" %%a in ('node --version') do echo   Versao: %%a
echo.

REM Mudar para pasta do repo
cd /d "%REPO_PATH%"
if errorlevel 1 (
    echo ERRO: Nao consegui acessar %REPO_PATH%
    pause
    exit /b 1
)

REM ========================================
REM 1. BACKUP
REM ========================================
echo [1/8] Criando backup...

set BACKUP_DIR=.backup-original-%date:~-4,4%%date:~-10,2%%date:~-7,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_DIR=%BACKUP_DIR: =0%

mkdir "%BACKUP_DIR%" 2>nul
copy "src\App.tsx" "%BACKUP_DIR%\" >nul 2>&1
copy "src\index.css" "%BACKUP_DIR%\" >nul 2>&1

echo OK: Backup criado em %BACKUP_DIR%
echo.

REM ========================================
REM 2. INSTALAR DEPENDENCIAS
REM ========================================
echo [2/8] Instalando dependencias...

call npm install clsx tailwind-merge --save
if errorlevel 1 (
    echo ERRO: Falha ao instalar dependencias.
    pause
    exit /b 1
)

echo OK: Dependencias instaladas
echo.

REM ========================================
REM 3. DESCOMPACTAR REDESIGN
REM ========================================
echo [3/8] Descompactando redesign...

powershell -Command "Expand-Archive -Path '%REDESIGN_ZIP%' -DestinationPath '.' -Force"
if errorlevel 1 (
    echo ERRO: Falha ao descompactar %REDESIGN_ZIP%
    pause
    exit /b 1
)

echo OK: Redesign descompactado
echo.

REM ========================================
REM 4. CRIAR PASTAS
REM ========================================
echo [4/8] Criando estrutura de pastas...

mkdir "src\lib" 2>nul
mkdir "src\hooks" 2>nul
mkdir "src\components\layout" 2>nul
mkdir "src\components\ui" 2>nul
mkdir "src\components\dashboard" 2>nul
mkdir "src\components\acts" 2>nul
mkdir "src\components\panels" 2>nul

echo OK: Pastas criadas
echo.

REM ========================================
REM 5. COPIAR ARQUIVOS NOVOS
REM ========================================
echo [5/8] Copiando arquivos novos...

copy /Y "uff-redesign\lib\utils.ts" "src\lib\" >nul
copy /Y "uff-redesign\hooks\*.ts" "src\hooks\" >nul
copy /Y "uff-redesign\components\layout\*.tsx" "src\components\layout\" >nul
copy /Y "uff-redesign\components\ui\*.tsx" "src\components\ui\" >nul
copy /Y "uff-redesign\components\dashboard\*.tsx" "src\components\dashboard\" >nul
copy /Y "uff-redesign\components\acts\*.tsx" "src\components\acts\" >nul

copy /Y "uff-redesign\App.tsx" "src\App.tsx" >nul
copy /Y "uff-redesign\styles\index.css" "src\index.css" >nul

echo OK: Arquivos novos copiados
echo.

REM ========================================
REM 6. MOVER PAINES ANTIGOS
REM ========================================
echo [6/8] Movendo paineis antigos...

set PANELS=ActSpreadsheet ActRelationships InsightsApi DossieApi ChefiasApi MandatosApi PrazosApi JornadaApi ComissoesApi CooperacaoApi OdsApi HelpGuide PrivacidadeLGPD Sobre

for %%P in (%PANELS%) do (
    if exist "src\components\%%P.tsx" (
        move /Y "src\components\%%P.tsx" "src\components\panels\%%P.tsx" >nul
        echo   Movido: %%P.tsx
    )
)

REM Mover PortalHeader para backup
if exist "src\components\PortalHeader.tsx" (
    move /Y "src\components\PortalHeader.tsx" "%BACKUP_DIR%\PortalHeader.tsx" >nul
    echo   Movido: PortalHeader.tsx (para backup)
)

echo OK: Paineis movidos
echo.

REM ========================================
REM 7. BUILD
REM ========================================
echo [7/8] Executando build...
echo    (isso pode levar 30-60 segundos)
echo.

call npm run build
if errorlevel 1 (
    echo.
    echo ERRO: BUILD FALHOU!
    echo.
    echo Para reverter:
    echo   copy /Y "%BACKUP_DIR%\App.tsx" "src\App.tsx"
    echo   copy /Y "%BACKUP_DIR%\index.css" "src\index.css"
    pause
    exit /b 1
)

echo.
echo OK: Build concluido com sucesso!
echo.

REM ========================================
REM 8. GERAR ZIP PARA HOSTGATOR
REM ========================================
echo [8/8] Gerando pacote para upload...

if exist "deploy-to-hostgator.zip" del /F "deploy-to-hostgator.zip"

powershell -Command "Compress-Archive -Path 'dist\*' -DestinationPath 'deploy-to-hostgator.zip' -Force"
if errorlevel 1 (
    echo ERRO: Falha ao criar ZIP.
    pause
    exit /b 1
)

for %%F in (deploy-to-hostgator.zip) do set ZIP_SIZE=%%~zF

echo.
echo ========================================
echo   PACOTE PRONTO PARA UPLOAD!
echo ========================================
echo.
echo Arquivo: deploy-to-hostgator.zip
echo Tamanho: %ZIP_SIZE% bytes
echo Local: %REPO_PATH%\deploy-to-hostgator.zip
echo.
echo INSTRUCOES DE UPLOAD NO CPANEL:
echo.
echo   1. Acesse o cPanel File Manager
echo   2. Navegue ate: public_html/inteligencia.fanara.com.br/
echo   3. Selecione TUDO (index.html, assets/, etc.)
echo   4. Clique em 'Compactar' para backup do atual
echo   5. Exclua index.html e a pasta assets/ antiga
echo   6. Clique em 'Carregar' e envie: deploy-to-hostgator.zip
echo   7. Clique com botao direito no ZIP - Extrair
echo   8. Pronto! Acesse https://inteligencia.fanara.com.br/
echo.
echo IMPORTANTE - NAO EXCLUA:
echo   - pasta api/      (seu backend PHP)
echo   - portal-data.json (fallback estatico)
echo   - atos.csv        (dados de importacao)
echo   - figuras/        (imagens do portal)
echo   - .htaccess       (regras do Apache)
echo.
echo Backup do codigo-fonte original:
echo   %BACKUP_DIR%\
echo.

pause
Backup do codigo-fonte original:
echo   %BACKUP_DIR%\
echo.

pause
