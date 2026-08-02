@echo off
echo ========================================
echo   BUILD and PACKAGE - Portal UFF v1
echo ========================================
echo.

set REPO_PATH=C:\Users\estud\OneDrive\Imagens\RAW\portal-normas-uff\repo

echo Repositorio: %REPO_PATH%
echo.

if not exist "%REPO_PATH%\package.json" (
    echo ERRO: package.json nao encontrado em:
    echo   %REPO_PATH%
    echo.
    echo Edite este arquivo .bat e ajuste REPO_PATH.
    pause
    exit /b 1
)

if not exist "%REPO_PATH%\uff-redesign-v1.zip" (
    echo ERRO: uff-redesign-v1.zip nao encontrado.
    echo Baixe o arquivo e coloque em: %REPO_PATH%
    pause
    exit /b 1
)

echo Executando PowerShell...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0build-and-package.ps1" -RepoPath "%REPO_PATH%"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERRO na execucao. Veja mensagens acima.
    pause
    exit /b 1
)

echo.
echo CONCLUIDO! O arquivo deploy-to-hostgator.zip foi gerado.
echo.
pause
