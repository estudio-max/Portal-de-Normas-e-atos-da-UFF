# Proposta de Redesign — Portal de Normas e Atos da UFF

> **Projeto:** Portal de Normas e Atos da UFF  
> **URL atual:** https://inteligencia.fanara.com.br/  
> **Repositório:** https://github.com/estudio-max/Portal-de-Normas-e-atos-da-UFF  
> **Data da proposta:** 29 de julho de 2026

---

## 1. Diagnóstico do Estado Atual

### 1.1 O que funciona bem
- **Arquitetura de dados robusta:** modelo em estrela, schema v2 normalizado, cache em disco, extração Python sofisticada.
- **Resiliência:** fallback automático para modo estático quando a API cai.
- **Cobertura funcional ampla:** 14 abas cobrindo desde busca normativa até ODS e cooperação internacional.
- **Performance:** cache de painéis estáticos (~0,005s), paginação no servidor.
- **Acessibilidade LGPD:** aba de privacidade documentada, dossiê aberto por decisão fundamentada.

### 1.2 Problemas de UX/UI identificados

| # | Problema | Impacto |
|---|----------|---------|
| 1 | **14 abas em barra horizontal** — scroll ou quebra de linha em telas médias | Navegação confusa, descoberta ruim |
| 2 | **Emojis como ícones de navegação principal** (`📊`, `🕸️`, `👥`) | Aparencia amadora para portal institucional |
| 3 | **Header monolítico** — título + stats + navegação + modo API tudo junto | Sobrecarga cognitiva, falta de hierarquia |
| 4 | **Ausência de identidade visual da UFF** — nenhuma cor institucional, nenhum branding | Não transmite pertencimento institucional |
| 5 | **Página inicial é apenas a planilha** — sem overview, sem dashboard | Usuário cai direto em busca sem contexto |
| 6 | **Falta de agrupamento semântico** — "Chefias", "Mandatos", "Prazos", "Jornada" são todos sobre pessoal, mas dispersos | Dificuldade de encontrar funcionalidades |
| 7 | **Modo estático/API sem transição visual** — usuário não sabe em qual modo está | Falta de feedback de estado |
| 8 | **Tabela como única visualização** — sem cards, sem timeline, sem grafo interativo | Experiência de exploração limitada |
| 9 | **Responsividade básica** — tabelas horizontais em mobile são intratáveis | Inacessível em smartphones |
| 10 | **Sem busca global persistente** — a busca só existe na aba planilha | Friction para consultas rápidas |

---

## 2. Princípios de Design

1. **Institucionalidade primeiro** — o portal deve parecer da UFF, não de um projeto pessoal.
2. **Tarefa sobre ferramenta** — agrupar por objetivo do usuário, não por técnica de extração.
3. **Progressive disclosure** — mostrar o essencial, revelar o avançado sob demanda.
4. **Mobile-first** — 60%+ do tráfego governamental é mobile; tabelas viram cards, filtros viram drawers.
5. **Estado sempre visível** — o usuário sempre sabe onde está, o que está carregando e de onde vêm os dados.
6. **Acessibilidade nativa** — WCAG 2.1 AA, contraste, foco visível, leitores de tela.

---

## 3. Sistema de Design Proposto

### 3.1 Cores (baseadas na identidade visual da UFF)

```
Primária:    #006400  (verde UFF)     → ações principais, header, links
Secundária:  #C9A227  (dourado UFF)   → destaques, badges, ícones de status
Terciária:   #1A3A1A  (verde escuro)  → textos sobre fundos coloridos

Neutros:
  Fundo:     #FAFBFC  (quase branco, quente)
  Superfície:#FFFFFF  (cards, modais)
  Borda:     #E2E8F0  (separadores sutis)
  Texto:     #1A202C  (primário)
  Texto 2:   #4A5568  (secundário)
  Texto 3:   #A0AEC0  (desabilitado, metadados)

Semânticos:
  Sucesso:   #38A169  (vigente, ativo)
  Aviso:     #D69E2E  (alterado, pendente)
  Perigo:    #E53E3E  (revogado, vencido)
  Info:      #3182CE  (link, processo SEI)
```

### 3.2 Tipografia

```
Display:   Inter 600 — títulos de página, números grandes
Título:    Inter 500 — seções, cards
Corpo:     Inter 400 — texto corrido, descrições
Mono:      JetBrains Mono 400 — números de processo, SIAPE, datas

Escala:
  32px / 40px  — Hero (total de atos no dashboard)
  24px / 32px  — H1 (título de página)
  18px / 28px  — H2 (seção)
  16px / 24px  — Corpo
  14px / 20px  — Pequeno (metadados, legenda)
  12px / 16px  — Micro (tags, timestamps)
```

### 3.3 Espaçamento e Forma

```
Raio:   8px  (inputs, botões)
        12px (cards)
        16px (painéis, drawers)
        999px (pills, badges)

Sombra: 0 1px 3px rgba(0,0,0,0.08)   — cards
        0 4px 12px rgba(0,0,0,0.12)  — modais, dropdowns
        0 8px 24px rgba(0,0,0,0.16)  — drawers mobile

Grid:   8px base (todos os espaçamentos múltiplos de 8)
```

### 3.4 Ícones

Substituir todos os emojis por ícones do **Lucide React** (já está no projeto):

| Aba atual | Emoji | Ícone proposto |
|-----------|-------|----------------|
| Atos e Normas | 📊 | `FileSearch` |
| Mapa de Relações | 🕸️ | `GitBranch` |
| Chefias | 👥 | `Users` |
| Meu SIAPE | 🗂️ | `IdCard` |
| Mandatos | ⏳ | `CalendarClock` |
| Prazos | 📅 | `Timer` |
| Jornada | 🕒 | `Clock` |
| Cooperação | 🤝 | `Globe` |
| Comissões | 👥 | `Landmark` |
| ODS | 🎯 | `Target` |
| Insights | 📈 | `BarChart3` |
| Ajuda | ❓ | `HelpCircle` |
| Privacidade | 🛡️ | `Shield` |
| Sobre | ℹ️ | `Info` |

---

## 4. Arquitetura de Informação Reorganizada

### 4.1 Novo agrupamento (de 14 abas para 5 seções + utilitários)

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Busca Global (sempre visível no topo)                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📋 NAVEGAR         │  👤 PESSOAL        │  🏛️ INSTITUCIONAL │
│  ─────────────────  │  ────────────────  │  ─────────────────│
│  • Atos e Normas    │  • Meu SIAPE       │  • Comissões      │
│  • Mapa de Relações │  • Chefias         │  • Cooperação     │
│  • Insights         │  • Mandatos        │  • ODS            │
│                     │  • Prazos          │                   │
│                     │  • Jornada         │                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ❓ Ajuda  │  🛡️ Privacidade  │  ℹ️ Sobre  │  ⚡ API status  │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Nova página inicial (Dashboard)

Em vez de cair direto na planilha, o usuário vê um **dashboard executivo**:

```
┌────────────────────────────────────────────────────────────┐
│  Portal de Normas e Atos da UFF          [UFF Logo]        │
│  Gestão Integrada de Legislação                            │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  89.432  │ │  71.205  │ │  12.891  │ │  5.336   │      │
│  │  Total   │ │ Vigentes │ │Revogados │ │ Alterados│      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                            │
│  ┌────────────────────┐  ┌────────────────────────────┐     │
│  │  Últimos atos      │  │  Acesso rápido            │     │
│  │  ───────────────── │  │  ────────────────────────   │     │
│  │  • Portaria 64.814 │  │  🔍 Buscar por número     │     │
│  │  • Resolução 394   │  │  👤 Consultar meu SIAPE   │     │
│  │  • Decisão 41/2010 │  │  📅 Prazos vencendo       │     │
│  │  • ...             │  │  🏛️ Comissões permanentes  │     │
│  └────────────────────┘  └────────────────────────────┘     │
│                                                            │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Tendências (gráfico de atos por ano/órgão)       │     │
│  └────────────────────────────────────────────────────┘     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 5. Componentes Propostos

### 5.1 Layout: App Shell

```tsx
// Estrutura de layout proposta
<AppShell>
  <TopBar>
    <Logo />
    <GlobalSearch />          {/* busca persistente */}
    <ApiStatusBadge />        {/* indicador de modo API/estático */}
    <ThemeToggle />           {/* opcional: dark mode */}
  </TopBar>

  <SidebarNavigation>         {/* navegação lateral em desktop */}
    <NavSection title="Navegar">
      <NavItem icon={FileSearch} label="Atos e Normas" />
      <NavItem icon={GitBranch} label="Mapa de Relações" />
      <NavItem icon={BarChart3} label="Insights" />
    </NavSection>
    <NavSection title="Pessoal">
      <NavItem icon={IdCard} label="Meu SIAPE" />
      <NavItem icon={Users} label="Chefias" />
      <NavItem icon={CalendarClock} label="Mandatos" />
      <NavItem icon={Timer} label="Prazos" />
      <NavItem icon={Clock} label="Jornada" />
    </NavSection>
    <NavSection title="Institucional">
      <NavItem icon={Landmark} label="Comissões" />
      <NavItem icon={Globe} label="Cooperação" />
      <NavItem icon={Target} label="ODS" />
    </NavSection>
  </SidebarNavigation>

  <MainContent>
    <Breadcrumb />            {/* rastro de navegação */}
    <PageHeader />
    <Content />
  </MainContent>

  <BottomNav>                 {/* navegação inferior em mobile */}
    {/* 5 itens principais + menu "Mais" */}
  </BottomNav>
</AppShell>
```

### 5.2 Componente: Busca Global

```tsx
<GlobalSearch>
  <SearchInput 
    placeholder="Buscar por número, ementa, processo SEI, nome ou SIAPE..."
    shortcuts={['Ctrl+K', '⌘K']}
  />
  <SearchDropdown>
    <RecentSearches />
    <FilterChips 
      options={['Todos', 'Portarias', 'Resoluções', 'Decisões', 'Pessoas', 'Processos']}
    />
    <QuickResults />
  </SearchDropdown>
</GlobalSearch>
```

### 5.3 Componente: Ficha do Ato (redesign)

```tsx
<ActCard>
  <ActHeader>
    <ActTypeBadge type="portaria" />     {/* Portaria, Resolução, etc. */}
    <ActNumber>64.814/2019</ActNumber>
    <ActStatus status="vigente" />        {/* badge colorido */}
  </ActHeader>

  <ActBody>
    <Ementa truncate={3} />
    <MetadataGrid>
      <MetaItem icon={Building} label="Órgão" value="Reitoria" />
      <MetaItem icon={FileText} label="Boletim" value="134-2019" />
      <MetaItem icon={Hash} label="Processo" value="23069.154690" />
      <MetaItem icon={Calendar} label="Publicação" value="15/08/2019" />
    </MetadataGrid>
  </ActBody>

  <ActFooter>
    <RelationPreview count={3} />          {/* "3 relações: 1 revogação, 2 alterações" */}
    <ActionButtons>
      <Button variant="ghost" icon={Eye}>Ver texto</Button>
      <Button variant="ghost" icon={Download}>PDF</Button>
      <Button variant="ghost" icon={Share2}>Compartilhar</Button>
    </ActionButtons>
  </ActFooter>
</ActCard>
```

### 5.4 Componente: Visualização de Relações (grafo)

Substituir a lista linear por um **grafo interativo de força** (D3 ou vis-network):
- Nós = atos (cor por tipo, tamanho por "impacto")
- Arestas = relações (cor por tipo: revogação=vermelho, alteração=amarelo, complementação=azul)
- Zoom, pan, clique para detalhes
- Filtro por órgão, ano, tipo de relação

### 5.5 Componente: Timeline de Mandatos/Prazos

```tsx
<Timeline>
  <TimelineItem 
    date="2019-08-15"
    title="Nomeação"
    orgao="Reitoria"
    status="active"
  />
  <TimelineItem 
    date="2022-08-15"
    title="Renovação"
    orgao="Reitoria"
    status="active"
  />
  <TimelineItem 
    date="2025-08-15"
    title="Término do mandato"
    orgao="Reitoria"
    status="pending"
    countdown={true}
  />
</Timeline>
```

---

## 6. Mudanças Técnicas Recomendadas

### 6.1 Estrutura de arquivos (atual → proposta)

```
src/
├── main.tsx                    # (inalterado)
├── App.tsx                     # simplificado — só roteamento + layout
├── config.ts                   # (inalterado)
├── dataSource.ts               # (inalterado)
├── types.ts                    # (inalterado)
│
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx        # NOVO — shell com sidebar + topbar
│   │   ├── TopBar.tsx          # NOVO — busca global, logo, status
│   │   ├── Sidebar.tsx         # NOVO — navegação lateral
│   │   ├── BottomNav.tsx       # NOVO — navegação mobile
│   │   └── Breadcrumb.tsx      # NOVO — rastro de navegação
│   │
│   ├── ui/                     # NOVO — design system local
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Modal.tsx
│   │   ├── Drawer.tsx
│   │   ├── Tabs.tsx
│   │   ├── Table.tsx
│   │   ├── Skeleton.tsx
│   │   └── Tooltip.tsx
│   │
│   ├── search/
│   │   ├── GlobalSearch.tsx    # NOVO — busca persistente
│   │   ├── SearchFilters.tsx   # NOVO — filtros avançados
│   │   └── SearchResults.tsx   # NOVO — resultados em cards
│   │
│   ├── acts/
│   │   ├── ActCard.tsx         # NOVO — card de ato
│   │   ├── ActDetail.tsx       # NOVO — ficha completa
│   │   ├── ActRelationsGraph.tsx # NOVO — grafo de relações
│   │   └── ActTimeline.tsx     # NOVO — timeline do ato
│   │
│   ├── dashboard/
│   │   ├── Dashboard.tsx       # NOVO — página inicial
│   │   ├── StatCard.tsx        # NOVO — card de estatística
│   │   ├── RecentActs.tsx      # NOVO — últimos atos
│   │   └── TrendChart.tsx      # NOVO — gráfico de tendências
│   │
│   └── panels/                 # (migrar os componentes atuais)
│       ├── ActSpreadsheet.tsx
│       ├── ActRelationships.tsx
│       ├── ChefiasApi.tsx
│       ├── DossieApi.tsx
│       ├── MandatosApi.tsx
│       ├── PrazosApi.tsx
│       ├── JornadaApi.tsx
│       ├── CooperacaoApi.tsx
│       ├── ComissoesApi.tsx
│       ├── OdsApi.tsx
│       ├── InsightsApi.tsx
│       ├── HelpGuide.tsx
│       ├── PrivacidadeLGPD.tsx
│       └── Sobre.tsx
│
├── hooks/
│   ├── useSearch.ts            # NOVO — lógica de busca
│   ├── useDebounce.ts          # NOVO — debounce de input
│   ├── useMediaQuery.ts        # NOVO — breakpoints
│   └── useLocalStorage.ts      # NOVO — preferências do usuário
│
├── lib/
│   ├── utils.ts                # NOVO — cn() para Tailwind
│   └── constants.ts            # NOVO — cores, breakpoints, etc.
│
└── styles/
    └── index.css               # (atualizar com variáveis CSS)
```

### 6.2 Dependências a adicionar

```json
{
  "dependencies": {
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "lucide-react": "^0.546.0",
    "motion": "^12.23.24",
    "clsx": "^2.1.1",           // NOVO — classes condicionais
    "tailwind-merge": "^3.0.0", // NOVO — merge de classes Tailwind
    "@radix-ui/react-dialog": "^1.1.0",      // NOVO — acessível
    "@radix-ui/react-dropdown-menu": "^2.1.0", // NOVO — menus
    "@radix-ui/react-tooltip": "^1.1.0",     // NOVO — tooltips
    "@radix-ui/react-tabs": "^1.1.0",        // NOVO — tabs acessíveis
    "@radix-ui/react-select": "^2.1.0",      // NOVO — selects acessíveis
    "recharts": "^2.15.0",       // NOVO — gráficos (leve, React-native)
    "d3": "^7.9.0"               // OPCIONAL — grafo de relações
  }
}
```

### 6.3 Configuração Tailwind v4

```css
/* src/styles/index.css */
@import "tailwindcss";

@theme {
  --color-uff-green: #006400;
  --color-uff-gold: #C9A227;
  --color-uff-dark: #1A3A1A;
  --color-uff-light: #F0F7F0;

  --color-status-active: #38A169;
  --color-status-revoked: #E53E3E;
  --color-status-altered: #D69E2E;

  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}
```

### 6.4 Roteamento

Manter o hash routing (requisito de deploy), mas melhorar a estrutura:

```
/#/                     → Dashboard (NOVO)
/#/atos                 → Atos e Normas (antiga planilha)
/#/atos/:uid            → Ficha do ato (NOVO)
/#/relacoes             → Mapa de Relações
/#/relacoes/:uid        → Grafo centrado no ato (NOVO)
/#/pessoal/siape        → Meu SIAPE
/#/pessoal/chefias      → Chefias
/#/pessoal/mandatos     → Mandatos
/#/pessoal/prazos       → Prazos
/#/pessoal/jornada      → Jornada
/#/institucional/comissoes  → Comissões
/#/institucional/cooperacao → Cooperação
/#/institucional/ods        → ODS
/#/insights             → Insights
/#/ajuda                → Ajuda
/#/privacidade          → Privacidade
/#/sobre                → Sobre
```

---

## 7. Roadmap de Implementação

### Fase 1 — Fundação (2 semanas)
- [ ] Criar `components/ui/` com design system básico (Button, Card, Badge, Input)
- [ ] Configurar variáveis CSS da UFF no Tailwind
- [ ] Criar `AppShell` com TopBar + Sidebar + BottomNav
- [ ] Implementar busca global persistente
- [ ] Adicionar ícones Lucide em toda a navegação (remover emojis)
- [ ] **Entregável:** Layout novo funcionando, todas as abas migradas para nova estrutura

### Fase 2 — Dashboard (1 semana)
- [ ] Criar página inicial `/` com dashboard
- [ ] Componentes `StatCard`, `RecentActs`, `TrendChart`
- [ ] Conectar com endpoint `/api/stats`
- [ ] **Entregável:** Usuário cai no dashboard ao invés da planilha

### Fase 3 — Experiência de Busca (2 semanas)
- [ ] Redesenhar `ActSpreadsheet` → `ActSearch` com cards
- [ ] Filtros avançados em drawer lateral
- [ ] Visualização toggle: cards ↔ tabela ↔ timeline
- [ ] Busca global com dropdown de resultados rápidos
- [ ] **Entregável:** Busca moderna, responsiva, com múltiplas visualizações

### Fase 4 — Ficha do Ato (1 semana)
- [ ] Criar rota `/#/atos/:uid`
- [ ] Componente `ActDetail` com layout de ficha
- [ ] Timeline de relações dentro da ficha
- [ ] Ações: ver texto, download PDF, compartilhar link
- [ ] **Entregável:** Cada ato tem sua própria URL compartilhável

### Fase 5 — Visualizações Avançadas (2 semanas)
- [ ] Grafo interativo de relações (D3 force-directed)
- [ ] Timeline de mandatos/prazos
- [ ] Mapa de cooperação (mapa mundi com pins)
- [ ] **Entregável:** Visualizações ricas para dados complexos

### Fase 6 — Polish (1 semana)
- [ ] Dark mode (opcional)
- [ ] Animações de transição entre páginas (Motion)
- [ ] Skeleton screens para estados de carregamento
- [ ] Testes de acessibilidade (axe, lighthouse)
- [ ] Otimização de performance (code splitting, lazy loading)
- [ ] **Entregável:** Portal polido, acessível, performático

**Total estimado: 9 semanas** (1 desenvolvedor full-time)

---

## 8. Considerações Especiais

### 8.1 Compatibilidade com deploy atual
- Manter `base: './'` no Vite
- Manter hash routing (`/#/aba`)
- Manter fallback para modo estático
- `dist/` continua sendo upload manual para HostGator

### 8.2 Performance
- Code splitting por rota (`React.lazy` + `Suspense`)
- Lazy loading de componentes pesados (grafo D3, gráficos)
- Virtualização de listas longas (`react-window`)
- Cache de imagens e dados no `localStorage`

### 8.3 Acessibilidade
- Todos os componentes Radix UI já são acessíveis
- Foco visível em todos os elementos interativos
- `aria-label` em ícones sem texto
- Skip link para conteúdo principal
- Contraste mínimo 4.5:1 em todos os textos

### 8.4 SEO (modo estático)
- Gerar `index.html` com meta tags dinâmicas no build
- Sitemap.xml com todas as rotas
- Open Graph tags para compartilhamento de atos

---

## 9. Anexos

### Anexo A: Paleta de cores completa

| Token | Hex | Uso |
|-------|-----|-----|
| `--uff-green` | `#006400` | Primária, header, botões principais |
| `--uff-gold` | `#C9A227` | Destaques, badges, hover states |
| `--uff-dark` | `#1A3A1A` | Texto sobre fundos coloridos |
| `--uff-light` | `#F0F7F0` | Fundos alternativos, hover suave |
| `--status-active` | `#38A169` | Vigente, ativo, sucesso |
| `--status-revoked` | `#E53E3E` | Revogado, perigo, erro |
| `--status-altered` | `#D69E2E` | Alterado, aviso, pendente |
| `--status-info` | `#3182CE` | Links, processos SEI, informação |

### Anexo B: Breakpoints

| Nome | Largura | Layout |
|------|---------|--------|
| Mobile | < 640px | BottomNav, cards empilhados, drawers |
| Tablet | 640–1024px | Sidebar colapsada, cards em grid 2 col |
| Desktop | > 1024px | Sidebar expandida, grid 3-4 col |

### Anexo C: Estados de carregamento

```
[████████░░] Carregando atos...        → Skeleton cards
[●○○○○] Buscando...                    → Inline spinner
⚡ Modo offline — dados de 22/07/2026   → Banner amarelo
🟢 Conectado à base                     → Badge verde sutil
```

---

*Proposta elaborada com base na análise do código-fonte, documentação (CLAUDE.md, docs/) e acesso ao site em produção.*
