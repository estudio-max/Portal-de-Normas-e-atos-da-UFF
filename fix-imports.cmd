@echo off
REM Corrige imports relativos em paineis movidos para src/components/panels/

echo Corrigindo imports relativos...

powershell -Command "
$panelsDir = 'src/components/panels'
$files = Get-ChildItem -Path $panelsDir -Filter '*.tsx' -File
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $original = $content
    $content = $content -replace '\"\.\.\\/dataSource\"', '\"../../dataSource\"'
    $content = $content -replace '\'\.\.\\/dataSource\'', '\'../../dataSource\''
    $content = $content -replace '\"\.\.\\/types\"', '\"../../types\"'
    $content = $content -replace '\'\.\.\\/types\'', '\'../../types\''
    $content = $content -replace '\"\.\.\\/config\"', '\"../../config\"'
    $content = $content -replace '\'\.\.\\/config\'', '\'../../config\''
    $content = $content -replace '\"\.\.\\/components\\/', '\"../../components/'
    $content = $content -replace '\'\.\.\\/components\\/', '\'../../components/'
    $content = $content -replace '\"\.\.\\/hooks\\/', '\"../../hooks/'
    $content = $content -replace '\'\.\.\\/hooks\\/', '\'../../hooks/'
    $content = $content -replace '\"\.\.\\/lib\\/', '\"../../lib/'
    $content = $content -replace '\'\.\.\\/lib\\/', '\'../../lib/'
    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host ('Corrigido: ' + $file.Name)
    }
}
Write-Host 'Correcao de imports concluida.'
"

echo OK: Imports corrigidos.
