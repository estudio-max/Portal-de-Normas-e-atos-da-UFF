# 📋 Guia de Substituição — Arquivos na Produção

> **Projeto:** Portal de Normas e Atos da UFF
> **Data:** 29/07/2026
> **Versão:** Redesign v1

---

## 🔴 ARQUIVOS PARA SUBSTITUIR (sobrescrever)

Estes arquivos JÁ EXISTEM no seu projeto. Copie os novos por cima.

| Arquivo gerado | Caminho no seu projeto | O que muda |
|---|---|---|
| `App.tsx` | `src/App.tsx` | Layout completo: sidebar + topbar + dashboard como home |
| `styles/index.css` | `src/index.css` | Cores da UFF, fontes, scrollbar, focus visible |

---

## 🟢 ARQUIVOS NOVOS (criar)

Estes arquivos NÃO EXISTEM no seu projeto. Crie as pastas e copie.

| Arquivo gerado | Caminho no seu projeto | Função |
|---|---|---|
| `lib/utils.ts` | `src/lib/utils.ts` | Helper `cn()` para classes Tailwind |
| `hooks/useDebounce.ts` | `src/hooks/useDebounce.ts` | Debounce de input (busca global) |
| `hooks/useMediaQuery.ts` | `src/hooks/useMediaQuery.ts` | Detecta mobile/desktop |
| `components/layout/AppShell.tsx` | `src/components/layout/AppShell.tsx` | Shell com sidebar + topbar |
| `components/layout/Sidebar.tsx` | `src/components/layout/Sidebar.tsx` | Navegação lateral |
| `components/layout/TopBar.tsx` | `src/components/layout/TopBar.tsx` | Busca global + status API |
| `components/ui/Badge.tsx` | `src/components/ui/Badge.tsx` | Badges de status coloridos |
| `components/ui/Card.tsx` | `src/components/ui/Card.tsx` | Card base com sombra |
| `components/ui/Skeleton.tsx` | `src/components/ui/Skeleton.tsx` | Loading states |
| `components/dashboard/Dashboard.tsx` | `src/components/dashboard/Dashboard.tsx` | **Nova página inicial** |
| `components/dashboard/StatCard.tsx` | `src/components/dashboard/StatCard.tsx` | Card de estatística |
| `components/acts/ActCard.tsx` | `src/components/acts/ActCard.tsx` | Card de ato (para grid) |

---

## 🟡 ARQUIVOS PARA MOVER (reorganizar)

Estes arquivos JÁ EXISTEM mas precisam mudar de pasta. O novo `App.tsx` espera que eles estejam em `src/components/panels/`.

| Arquivo atual | Novo caminho | Ação necessária |
|---|---|---|
| `src/components/ActSpreadsheet.tsx` | `src/components/panels/ActSpreadsheet.tsx` | Mover + adicionar `export default` |
| `src/components/ActRelationships.tsx` | `src/components/panels/ActRelationships.tsx` | Mover + adicionar `export default` |
| `src/components/InsightsApi.tsx` | `src/components/panels/InsightsApi.tsx` | Mover + adicionar `export default` |
| `src/components/DossieApi.tsx` | `src/components/panels/DossieApi.tsx` | Mover + adicionar `export default` |
| `src/components/ChefiasApi.tsx` | `src/components/panels/ChefiasApi.tsx` | Mover + adicionar `export default` |
| `src/components/MandatosApi.tsx` | `src/components/panels/MandatosApi.tsx` | Mover + adicionar `export default` |
| `src/components/PrazosApi.tsx` | `src/components/panels/PrazosApi.tsx` | Mover + adicionar `export default` |
| `src/components/JornadaApi.tsx` | `src/components/panels/JornadaApi.tsx` | Mover + adicionar `export default` |
| `src/components/ComissoesApi.tsx` | `src/components/panels/ComissoesApi.tsx` | Mover + adicionar `export default` |
| `src/components/CooperacaoApi.tsx` | `src/components/panels/CooperacaoApi.tsx` | Mover + adicionar `export default` |
| `src/components/OdsApi.tsx` | `src/components/panels/OdsApiApi.tsx` | Mover + adicionar `export default` |
| `src/components/HelpGuide.tsx` | `src/components/panels/HelpGuide.tsx` | Mover + adicionar `export default` |
| `src/components/PrivacidadeLGPD.tsx` | `src/components/panels/PrivacidadeLGPD.tsx` | Mover + adicionar `export default` |
| `src/components/Sobre.tsx` | `src/components/panels/Sobre.tsx` | Mover + adicionar `export default` |

> **IMPORTANTE:** Se algum componente não tiver `export default NomeDoComponente;` no final, adicione. O `App.tsx` novo usa `React.lazy(() => import('./components/panels/Nome'))` que exige `export default`.

---

## 🔵 ARQUIVOS QUE NÃO MEXEM (deixar como estão)

| Arquivo | Motivo |
|---|---|
| `src/main.tsx` | Não precisa mudar |
| `src/config.ts` | Configurações de API permanecem |
| `src/dataSource.ts` | Fonte de dados permanece |
| `src/types.ts` | Tipos já estão corretos |
| `src/components/PortalHeader.tsx` | Pode deletar depois (não é mais usado) |
| `public/` | Assets permanecem |
| `vite.config.ts` | Mantém `base: './'` |
| `package.json` | Só adicionar dependências novas |
| `api/index.php` | Backend PHP intocado |
| `docs/` | Documentação permanece |

---

## 🚀 Comandos para aplicar (copie e cole)

### 1. Criar pastas
```bash
mkdir -p src/lib src/hooks src/components/layout src/components/ui src/components/dashboard src/components/acts src/components/panels
```

### 2. Instalar dependências
```bash
npm install clsx tailwind-merge
```

### 3. Copiar arquivos novos
```bash
cp uff-redesign/lib/utils.ts src/lib/
cp uff-redesign/hooks/*.ts src/hooks/
cp uff-redesign/components/layout/*.tsx src/components/layout/
cp uff-redesign/components/ui/*.tsx src/components/ui/
cp uff-redesign/components/dashboard/*.tsx src/components/dashboard/
cp uff-redesign/components/acts/*.tsx src/components/acts/
```

### 4. Substituir arquivos existentes
```bash
cp uff-redesign/App.tsx src/App.tsx
cp uff-redesign/styles/index.css src/index.css
```

### 5. Mover painéis antigos
```bash
mv src/components/ActSpreadsheet.tsx src/components/panels/
mv src/components/ActRelationships.tsx src/components/panels/
mv src/components/InsightsApi.tsx src/components/panels/
mv src/components/DossieApi.tsx src/components/panels/
mv src/components/ChefiasApi.tsx src/components/panels/
mv src/components/MandatosApi.tsx src/components/panels/
mv src/components/PrazosApi.tsx src/components/panels/
mv src/components/JornadaApi.tsx src/components/panels/
mv src/components/ComissoesApi.tsx src/components/panels/
mv src/components/CooperacaoApi.tsx src/components/panels/
mv src/components/OdsApi.tsx src/components/panels/
mv src/components/HelpGuide.tsx src/components/panels/
mv src/components/PrivacidadeLGPD.tsx src/components/panels/
mv src/components/Sobre.tsx src/components/panels/
```

### 6. Verificar export default
Abra cada arquivo em `src/components/panels/` e certifique-se de que termina com:
```tsx
export default NomeDoComponente;
```

### 7. Build
```bash
npm run build
```

### 8. Deploy
Suba a pasta `dist/` pelo Gerenciador de Arquivos da HostGator.

---

## ✅ Checklist antes do deploy

- [ ] `npm run build` executou sem erros
- [ ] Nenhum erro de TypeScript no console
- [ ] `dist/index.html` existe e tem conteúdo
- [ ] Todos os painéis em `src/components/panels/` têm `export default`
- [ ] `src/App.tsx` importa corretamente de `./components/layout/AppShell`

---

*Gerado em 29/07/2026. Arquivos compatíveis com React 19 + Vite + Tailwind v4 + HostGator shared.*
