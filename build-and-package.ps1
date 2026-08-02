# Script minimalista para aplicar redesign e gerar pacote HostGator
# Salve este arquivo como UTF-8 BOM se possivel

param([string]$RepoPath = "C:\Users\estud\OneDrive\Imagens\RAW\portal-normas-uff\repo")

$ErrorActionPreference = "Stop"

function Msg($m) { Write-Host $m }
function Ok($m) { Write-Host ("OK: " + $m) -ForegroundColor Green }
function Err($m) { Write-Host ("ERRO: " + $m) -ForegroundColor Red }

Msg ""
Msg "========================================"
Msg "  BUILD and PACKAGE - Portal UFF v1"
Msg "========================================"
Msg ""

# Verificacoes
Msg "Verificando ambiente..."

if (-not (Test-Path $RepoPath)) {
    Err "Pasta do repositorio nao encontrada: $RepoPath"
    Err "Ajuste o caminho no script."
    exit 1
}

$ZipFile = Join-Path $RepoPath "uff-redesign-v1.zip"
if (-not (Test-Path $ZipFile)) {
    Err "uff-redesign-v1.zip nao encontrado em: $ZipFile"
    Err "Baixe o arquivo e coloque na pasta do repo."
    exit 1
}

$PackageJson = Join-Path $RepoPath "package.json"
if (-not (Test-Path $PackageJson)) {
    Err "package.json nao encontrado. Verifique o caminho."
    exit 1
}

try {
    $nodeVersion = node --version 2>$null
    Ok "Node.js encontrado: $nodeVersion"
} catch {
    Err "Node.js nao encontrado. Instale em https://nodejs.org"
    exit 1
}

Ok "Ambiente OK"

Set-Location $RepoPath

# Backup
$BackupDir = ".backup-original-" + (Get-Date -Format "yyyyMMdd-HHmmss")
Msg ("Criando backup em " + $BackupDir + "...")
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
Copy-Item "src\App.tsx" "$BackupDir\App.tsx" -ErrorAction SilentlyContinue
Copy-Item "src\index.css" "$BackupDir\index.css" -ErrorAction SilentlyContinue
Ok "Backup criado"

# Instalar dependencias
Msg "Instalando dependencias..."
npm install clsx tailwind-merge --save
if ($LASTEXITCODE -ne 0) {
    Err "Falha ao instalar dependencias."
    exit 1
}
Ok "Dependencias instaladas"

# Aplicar redesign
Msg "Aplicando redesign..."

Expand-Archive -Path "uff-redesign-v1.zip" -DestinationPath "." -Force

# Criar pastas
$dirs = @("src\lib", "src\hooks", "src\components\layout", "src\components\ui",
          "src\components\dashboard", "src\components\acts", "src\components\panels")
foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

# Copiar novos arquivos
Copy-Item "uff-redesign\lib\utils.ts" "src\lib\utils.ts" -Force
Copy-Item "uff-redesign\hooks\*.ts" "src\hooks\" -Force
Copy-Item "uff-redesign\components\layout\*.tsx" "src\components\layout\" -Force
Copy-Item "uff-redesign\components\ui\*.tsx" "src\components\ui\" -Force
Copy-Item "uff-redesign\components\dashboard\*.tsx" "src\components\dashboard\" -Force
Copy-Item "uff-redesign\components\acts\*.tsx" "src\components\acts\" -Force

# Substituir existentes
Copy-Item "uff-redesign\App.tsx" "src\App.tsx" -Force
Copy-Item "uff-redesign\styles\index.css" "src\index.css" -Force

# Mover paineis antigos
$painels = @("ActSpreadsheet", "ActRelationships", "InsightsApi", "DossieApi",
             "ChefiasApi", "MandatosApi", "PrazosApi", "JornadaApi",
             "ComissoesApi", "CooperacaoApi", "OdsApi",
             "HelpGuide", "PrivacidadeLGPD", "Sobre")

foreach ($p in $painels) {
    $src = "src\components\" + $p + ".tsx"
    $dst = "src\components\panels\" + $p + ".tsx"
    if (Test-Path $src) {
        Move-Item $src $dst -Force
        $content = Get-Content $dst -Raw
        # Verifica se ja tem export default
        if ($content -notmatch "export\s+default") {
            # Detecta nome do componente
            $pattern = "function\s+([A-Za-z0-9_]+)"
            $match = [regex]::Match($content, $pattern)
            $compName = if ($match.Success) { $match.Groups[1].Value } else { $p }
            Add-Content $dst ("`r`nexport default " + $compName + ";")
        }
    }
}

# Mover PortalHeader para backup
if (Test-Path "src\components\PortalHeader.tsx") {
    Move-Item "src\components\PortalHeader.tsx" "$BackupDir\PortalHeader.tsx" -Force
}

Ok "Redesign aplicado"

# Build
Msg "Executando build..."
Msg "   (isso pode levar 30-60 segundos)"
Msg ""

npm run build
if ($LASTEXITCODE -ne 0) {
    Msg ""
    Err "BUILD FALHOU!"
    Msg ""
    Msg "Para reverter:"
    Msg ("  Copy-Item '" + $BackupDir + "\App.tsx' 'src\App.tsx' -Force")
    Msg ("  Copy-Item '" + $BackupDir + "\index.css' 'src\index.css' -Force")
    exit 1
}

Msg ""
Ok "Build concluido com sucesso!"

# Verificar dist
Msg "Verificando build..."
if (-not (Test-Path "dist\index.html")) {
    Err "dist\index.html nao encontrado apos o build."
    exit 1
}
Ok "Build verificado"

# Gerar ZIP para HostGator
Msg "Gerando pacote para upload..."

$DeployZip = "deploy-to-hostgator.zip"
if (Test-Path $DeployZip) { Remove-Item $DeployZip -Force }

Compress-Archive -Path "dist\*" -DestinationPath $DeployZip -Force

$ZipSize = (Get-Item $DeployZip).Length
$ZipSizeMB = [math]::Round($ZipSize / 1MB, 2)

Msg ""
Msg "========================================"
Msg "  PACOTE PRONTO PARA UPLOAD!"
Msg "========================================"
Msg ""
Msg ("Arquivo: " + $DeployZip)
Msg ("Tamanho: " + $ZipSizeMB + " MB")
Msg ("Local: " + (Join-Path $RepoPath $DeployZip))
Msg ""
Msg "INSTRUCOES DE UPLOAD NO CPANEL:"
Msg ""
Msg "  1. Acesse o cPanel File Manager"
Msg "  2. Navegue ate: public_html/inteligencia.fanara.com.br/"
Msg "  3. Selecione TUDO (index.html, assets/, etc.)"
Msg "  4. Clique em Compactar para backup do atual"
Msg "  5. Exclua index.html e a pasta assets/ antiga"
Msg "  6. Clique em Carregar e envie: deploy-to-hostgator.zip"
Msg "  7. Clique com botao direito no ZIP - Extrair"
Msg "  8. Pronto! Acesse https://inteligencia.fanara.com.br/"
Msg ""
Msg "IMPORTANTE - NAO EXCLUA:"
Msg "  - pasta api/      (seu backend PHP)"
Msg "  - portal-data.json (fallback estatico)"
Msg "  - atos.csv        (dados de importacao)"
Msg "  - figuras/        (imagens do portal)"
Msg "  - .htaccess       (regras do Apache)"
Msg ""
Msg ("Backup do codigo-fonte original: " + $BackupDir)
Msg ""
