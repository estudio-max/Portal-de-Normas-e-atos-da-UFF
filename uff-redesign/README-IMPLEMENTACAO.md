# Guia de Implementação — Redesign Portal de Normas UFF

> **Compatível com:** React 19 + Vite + Tailwind v4 + HostGator shared (deploy estático)
> **Não requer:** Node.js no servidor, SSR, banco de dados novo, endpoints PHP novos

---

## 📁 Arquivos gerados

```
uff-redesign/
├── App.tsx                          ← Substitui o App.tsx atual
├── styles/
│   └── index.css                    ← Substitui o index.css atual
├── lib/
│   └── utils.ts                     ← Novo: helper cn() para Tailwind
├── hooks/
│   ├── useDebounce.ts               ← Novo: debounce de input
│   └── useMediaQuery.ts             ← Novo: breakpoints responsivos
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx             ← Novo: shell com sidebar + topbar
│   │   ├── Sidebar.tsx              ← Novo: navegação lateral (Navegar/Pessoal/Institucional)
│   │   └── TopBar.tsx               ← Novo: busca global persistente + status API
│   ├── ui/
│   │   ├── Badge.tsx                ← Novo: badges de status coloridos
│   │   ├── Card.tsx                 ← Novo: card base com sombra
│   │   └── Skeleton.tsx             ← Novo: estado de carregamento
│   ├── dashboard/
│   │   ├── Dashboard.tsx            ← NOVA PÁGINA INICIAL
│   │   └── StatCard.tsx             ← Novo: card de estatística
│   ├── acts/
│   │   └── ActCard.tsx              ← Novo: card de ato (substitui tabela em algumas views)
│   └── panels/                      ← Mover os componentes atuais para cá
```

---

## 🚀 Passo a passo de instalação

### 1. Instalar dependências novas

```bash
cd Portal-de-Normas-e-atos-da-UFF
npm install clsx tailwind-merge lucide-react
```

> **Nota:** `lucide-react` já deve estar no `package.json`. Se não estiver, instale.

### 2. Atualizar `src/styles/index.css`

Substitua o conteúdo do `src/index.css` atual (que tem apenas 375 bytes) pelo arquivo `styles/index.css` gerado.

Isso adiciona:
- Variáveis CSS da UFF (`--color-uff-green`, `--color-uff-gold`)
- Cores semânticas de status
- Fontes (Inter, JetBrains Mono)
- Scrollbar styling
- Focus visible acessível

### 3. Criar estrutura de pastas

```bash
mkdir -p src/components/layout src/components/ui src/components/dashboard src/components/acts src/hooks src/lib src/styles
```

### 4. Copiar os arquivos gerados

Copie cada arquivo `.ts`/`.tsx` para o local correspondente em `src/`.

### 5. Mover componentes existentes para `src/components/panels/`

```bash
mkdir -p src/components/panels
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

> **Importante:** Adicione `export default` em cada componente movido se ainda não tiver.

### 6. Substituir `src/App.tsx`

Substitua pelo `App.tsx` gerado. Ele:
- Usa `AppShell` com sidebar + topbar
- Mantém hash routing (`/#/aba`)
- Usa `React.lazy()` para code splitting
- Carrega `Dashboard` como página inicial (não mais planilha)
- Passa `apiMode` para o `TopBar`

### 7. Ajustar `vite.config.ts` (se necessário)

Mantenha:
```ts
export default defineConfig({
  base: './',
  // ... resto
});
```

### 8. Build e deploy

```bash
npm run build
```

Suba a pasta `dist/` pelo Gerenciador de Arquivos da HostGator (igual sempre fez).

---

## ⚠️ Pontos de atenção

### Hash routing
O redesign mantém hash routing. NÃO use `BrowserRouter` do React Router — ele exigiria rewrite `.htaccess` que pode quebrar a API PHP.

### Componentes lazy-loaded
Os painéis antigos são carregados sob demanda via `React.lazy()`. Isso reduz o bundle inicial. Se algum painel não tiver `export default`, o lazy load vai falhar.

### Tipos do `types.ts`
O `ActCard` e `Dashboard` usam os tipos reais do projeto (`UffAct`, `UffStatistics`). Se você renomeou ou alterou esses tipos, ajuste os componentes.

### Busca global
A busca no `TopBar` está funcional mas básica. Ela:
- Captura `Ctrl+K` / `⌘K`
- Faz debounce de 300ms
- Dispara `onSearch` passado pelo `AppShell`
- Você pode conectar ao `dataSource.atos({ q: query })` para preencher o dropdown

### Modo estático (fallback)
Se a API cair, o `apiMode` fica `false` e o `Dashboard` mostra "Modo offline". Os painéis antigos continuam funcionando com seus próprios fallbacks.

---

## 🎨 Personalização

### Cores
Edite `src/styles/index.css` na seção `@theme`:
```css
--color-uff-green: #006400;      /* verde UFF */
--color-uff-gold: #C9A227;       /* dourado UFF */
```

### Logo
No `Sidebar.tsx`, altere o bloco do logo:
```tsx
<div className="w-9 h-9 bg-[#006400] rounded-lg flex items-center justify-center shrink-0">
  {/* Substitua por <img src="/logo-uff.svg" /> se tiver */}
  <span className="text-white font-bold text-sm">U</span>
</div>
```

### Navegação
Adicione/remova itens no array `NAV_SECTIONS` em `Sidebar.tsx`.

---

## ✅ Checklist de teste antes do deploy

- [ ] `npm run build` executa sem erros
- [ ] Abrir `dist/index.html` localmente mostra o Dashboard
- [ ] Clicar em "Atos e Normas" carrega a planilha antiga
- [ ] Busca global (`Ctrl+K`) foca o input
- [ ] Redimensionar para < 1024px colapsa a sidebar
- [ ] Status da API aparece "Online" quando `/api/atos` responde
- [ ] Status da API aparece "Offline" quando a API cai
- [ ] Nenhum emoji aparece na navegação (só ícones Lucide)
- [ ] Cores da UFF estão presentes (verde #006400)

---

*Gerado em 29/07/2026. Compatível com o repositório em https://github.com/estudio-max/Portal-de-Normas-e-atos-da-UFF*
