# Guia de Instalação - Windows

## 📁 Seu repositório está em:
```
C:\Users\estud\OneDrive\Imagens\RAW\portal-normas-uff\repo
```

## 📦 Arquivos que você precisa baixar

1. **uff-redesign-v1.zip** — componentes do redesign
2. **build-and-package.ps1** — script PowerShell (principal)
3. **build-and-package.bat** — script batch (alternativa mais simples)

Coloque os 3 arquivos na pasta do repo:
```
C:\Users\estud\OneDrive\Imagens\RAW\portal-normas-uff\repo\
  ├── package.json
  ├── src/
  ├── uff-redesign-v1.zip          <-- COLOQUE AQUI
  ├── build-and-package.ps1        <-- COLOQUE AQUI
  └── build-and-package.bat        <-- COLOQUE AQUI
```

## 🚀 Método 1: Script Batch (mais fácil)

1. Abra o Explorador de Arquivos
2. Navegue até: `C:\Users\estud\OneDrive\Imagens\RAW\portal-normas-uff\repo`
3. **Clique duplo** em `build-and-package.bat`
4. Aguarde (pode levar 1-2 minutos)
5. O script vai gerar `deploy-to-hostgator.zip` na mesma pasta

## 🚀 Método 2: PowerShell (se o batch não funcionar)

1. Pressione `Win + X` → "Windows PowerShell" ou "Terminal"
2. Navegue até a pasta:
```powershell
cd "C:\Users\estud\OneDrive\Imagens\RAW\portal-normas-uff\repo"
```
3. Execute:
```powershell
.\build-and-package.ps1
```

Se der erro de política de execução, rode primeiro:
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\build-and-package.ps1
```

## 📤 Upload no cPanel

Após o script rodar, você terá:
```
C:\Users\estud\OneDrive\Imagens\RAW\portal-normas-uff\repo\deploy-to-hostgator.zip
```

Siga o **GUIA-UPLOAD-CPANEL.md** para subir no servidor.

## 🔄 Se der erro (rollback)

O script cria uma pasta de backup tipo:
```
.backup-original-20260729-184500\
```

Para reverter, copie de volta:
```powershell
cd "C:\Users\estud\OneDrive\Imagens\RAW\portal-normas-uff\repo"
Copy-Item ".backup-original-20260729-184500\App.tsx" "src\App.tsx" -Force
Copy-Item ".backup-original-20260729-184500\index.css" "src\index.css" -Force
```
