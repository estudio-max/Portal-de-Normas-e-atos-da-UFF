
# ============================================
# GUIA DE UPLOAD NO CPANEL - PASSO A PASSO
# ============================================

## ANTES DE COMEÇAR

1. Faça backup do site atual pelo cPanel:
   - File Manager → inteligencia.fanara.com.br/
   - Selecione TUDO (Ctrl+A)
   - Clique em "Compactar" → escolha ZIP
   - Salve como "backup-antes-redesign.zip"

2. Tenha em mãos:
   - deploy-to-hostgator.zip (gerado pelo build-and-package.sh)
   - Acesso ao cPanel File Manager

## PASSO A PASSO

### Passo 1: Entrar no diretório
- cPanel → File Manager
- Navegue até: /home1/fanara87/public_html/inteligencia.fanara.com.br/
- Você verá: index.html, assets/, api/, figuras/, portal-data.json, etc.

### Passo 2: Fazer backup do atual (OPCIONAL mas RECOMENDADO)
- Selecione: index.html + pasta assets/
- Clique em "Compactar"
- Nome: backup-v1.zip
- Clique em "Compress File(s)"

### Passo 3: Remover arquivos antigos do React
- Selecione: index.html
- Clique em "Excluir" (Delete)
- Selecione: pasta assets/
- Clique em "Excluir" (Delete)

### Passo 4: NÃO MEXER nestes arquivos/pastas
- api/          ← seu backend PHP
- figuras/      ← imagens do portal
- portal-data.json  ← fallback estático
- atos.csv      ← dados de importação
- .htaccess     ← regras do Apache
- robots.txt    ← SEO

### Passo 5: Enviar o novo pacote
- Clique em "Carregar" (Upload)
- Arraste ou selecione: deploy-to-hostgator.zip
- Aguarde o upload completar

### Passo 6: Extrair
- Clique com botão direito em deploy-to-hostgator.zip
- Clique em "Extrair" (Extract)
- Confirme a extração na pasta atual
- Aguarde

### Passo 7: Verificar
- Acesse: https://inteligencia.fanara.com.br/
- Você deve ver o novo Dashboard com sidebar verde

### Passo 8: Limpar (opcional)
- Exclua o deploy-to-hostgator.zip do servidor
- Mantenha o backup-v1.zip por precaução

## SE ALGO DER ERRADO (ROLLBACK)

### Opção A: Restaurar pelo backup
- File Manager → inteligencia.fanara.com.br/
- Exclua index.html e assets/ novos
- Selecione backup-v1.zip
- Clique com direito → "Extrair"

### Opção B: Restaurar pelo GitHub
- No seu computador: git checkout main (ou branch original)
- npm run build
- Suba a dist/ antiga novamente

## DÚVIDAS FREQUENTES

Q: E se eu excluir a pasta api/ por engano?
A: Restaure pelo backup-v1.zip. A API PHP é essencial.

Q: O portal-data.json precisa ser atualizado?
A: Não. Ele é usado como fallback quando a API cai.
   O novo App.tsx continua usando-o automaticamente.

Q: Preciso atualizar o .htaccess?
A: Não. O hash routing do React não precisa de rewrite.

Q: E o Google Analytics / tags de rastreamento?
A: Se houver no index.html antigo, copie-as para o novo.
   Verifique no index.html do backup.
