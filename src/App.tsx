import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './components/dashboard/Dashboard';
import { Skeleton } from './components/ui/Skeleton';
import ActTable from './components/ActTable';
import ActRelationsApi from './components/ActRelationsApi';
import * as ds from './dataSource';
import type { UffAct, UffStatistics } from './types';

// Lazy load heavy panels to keep initial bundle small
const ActRelationships = lazy(() => import('./components/panels/ActRelationships'));
const InsightsApi = lazy(() => import('./components/panels/InsightsApi'));
const DossieApi = lazy(() => import('./components/panels/DossieApi'));
const ChefiasApi = lazy(() => import('./components/panels/ChefiasApi'));
const MandatosApi = lazy(() => import('./components/panels/MandatosApi'));
const PrazosApi = lazy(() => import('./components/panels/PrazosApi'));
const JornadaApi = lazy(() => import('./components/panels/JornadaApi'));
const ComissoesApi = lazy(() => import('./components/panels/ComissoesApi'));
const PoliticasApi = lazy(() => import('./components/panels/PoliticasApi'));
const MudancasApi = lazy(() => import('./components/panels/MudancasApi'));
const CooperacaoApi = lazy(() => import('./components/panels/CooperacaoApi'));
const RevalidacaoApi = lazy(() => import('./components/panels/RevalidacaoApi'));
const OdsApi = lazy(() => import('./components/panels/OdsApi'));
const HelpGuide = lazy(() => import('./components/panels/HelpGuide'));
const PrivacidadeLGPD = lazy(() => import('./components/panels/PrivacidadeLGPD'));
const Sobre = lazy(() => import('./components/panels/Sobre'));

// Fallback for lazy-loaded panels
const PanelFallback = () => (
  <div className="space-y-4 max-w-[1400px]">
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-4 w-96" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Skeleton className="h-[180px]" />
      <Skeleton className="h-[180px]" />
      <Skeleton className="h-[180px]" />
    </div>
  </div>
);

// A forma canônica é `#/aba` — é o que `window.location.hash = ...` grava, e o
// que sai quando alguém copia a URL da barra. Mas a BARRA É OPCIONAL na leitura:
// quem digita `#atos` à mão está pedindo a mesma aba, e até 06/08/2026 recebia
// uma tela de "Aba inválida" com o `#` colado no nome ("#atos"), porque o
// `replace` exigia `#/`. Numa aba cujo propósito declarado é "colar o hash abre
// a aba", recusar a forma mais natural de digitar é o defeito mais caro possível.
// A barra final também é tolerada (`#/atos/`).
function abaDoHash(): string {
  const raw = window.location.hash;
  if (!raw || raw === '#') return '';
  return raw.replace(/^#\/?/, '').replace(/\/$/, '');
}

const ABAS_VALIDAS = [
  '', 'atos', 'relacoes', 'insights',
  'pessoal/siape', 'pessoal/chefias', 'pessoal/mandatos', 'pessoal/prazos', 'pessoal/jornada',
  'institucional/comissoes', 'institucional/politicas',
  'institucional/cooperacao', 'institucional/revalidacao', 'institucional/ods',
  'mudancas',
  'ajuda', 'privacidade', 'sobre',
];

// Mapeia Stats do dataSource para UffStatistics do Dashboard
function mapStats(s: ds.Stats | null): UffStatistics | null {
  if (!s) return null;
  return {
    total: s.total,
    ativoCount: s.vigentes,
    revogadoCount: s.revogados,
    alteradoCount: s.alterados,
    porTipo: {} as Record<import('./types').ActType, number>,
    porOrgao: {},
    porAno: s.porAno,
  };
}

function mapDashboardAct(a: ds.DashboardAct): UffAct {
  return {
    id: a.id,
    tipoAto: a.tipo as import('./types').ActType,
    numero: a.numero,
    ano: a.ano,
    dataAssinatura: a.dataAssinatura,
    orgaoEmissor: a.sigla || '',
    ementa: a.ementa,
    status: a.status as 'Ativo' | 'Revogado' | 'Alterado',
    processoSei: a.processoSei,
    relacoes: [],
    tags: [],
    conteudoResumido: '',
    linkBoletim: a.linkBoletim || undefined,
  };
}

export default function App() {
  const [aba, setAba] = useState<string>(abaDoHash());
  const [apiMode, setApiMode] = useState<boolean>(false);
  const [stats, setStats] = useState<UffStatistics | null>(null);
  const [portalStats, setPortalStats] = useState<ds.Stats | null>(null);
  const [recentActs, setRecentActs] = useState<UffAct[]>([]);
  const [latestBulletin, setLatestBulletin] = useState<ds.Stats['ultimoBoletim']>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [buscaGlobal, setBuscaGlobal] = useState('');
  const [fotofobia, setFotofobia] = useState(() => {
    try { return localStorage.getItem('tema-fotofobia') === '1'; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('fotofobia', fotofobia);
    try { localStorage.setItem('tema-fotofobia', fotofobia ? '1' : '0'); } catch { /* armazenamento indisponível */ }
  }, [fotofobia]);

  // Inicializa dataSource (igual ao App antigo)
  useEffect(() => {
    const init = async () => {
      const modo = await ds.init();
      const isApi = modo === 'api';
      setApiMode(isApi);
      setCarregando(false);

      // Carrega stats
      try {
        const s = await ds.getStats();
        setStats(mapStats(s));
        setPortalStats(s);
        setLatestBulletin(s.ultimoBoletim || null);
        setRecentActs((s.ultimoBoletim?.atos || []).map(mapDashboardAct));
      } catch (e) {
        console.error('Erro ao carregar stats:', e);
      }

    };
    init();
  }, []);

  // Hash change listener
  useEffect(() => {
    const onHashChange = () => {
      const nova = abaDoHash();
      if (ABAS_VALIDAS.includes(nova)) {
        setAba(nova);
        setErro(null);
      } else {
        setErro(`Aba inválida: "${nova}". Use: ${ABAS_VALIDAS.filter(Boolean).join(', ')}`);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    onHashChange();
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((path: string) => {
    window.location.hash = path ? `#/${path}` : '#';
  }, []);

  // Identidade ESTÁVEL, e isto não é detalhe de performance: o TopBar chama
  // onSearch dentro de um efeito. Enquanto esta função era recriada a cada
  // render, o efeito redisparava a cada render e reexecutava navigate('atos') —
  // com termo na caixa, TODO destino da sidebar voltava sozinho para #/atos e
  // o portal ficava preso numa aba só até alguém limpar a busca.
  const handleGlobalSearch = useCallback((query: string) => {
    setBuscaGlobal(query);
    if (query.trim().length >= 2) navigate('atos');
  }, [navigate]);

  const alternarTema = useCallback(() => setFotofobia(ativo => !ativo), []);

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC]">
        <div className="flex items-center gap-2 text-[#64748B]">
          <div className="w-5 h-5 border-2 border-[#006400] border-t-transparent rounded-full animate-spin" />
          Carregando o portal…
        </div>
      </div>
    );
  }

  const renderContent = () => {
    // Dashboard (default)
    if (aba === '') {
      return <Dashboard stats={stats} recentActs={recentActs} latestBulletin={latestBulletin} apiMode={apiMode} onNavigate={navigate} />;
    }

    // Navegar
    if (aba === 'atos') return <ActTable buscaGlobal={buscaGlobal} />;
    if (aba === 'relacoes') return apiMode ? <ActRelationsApi /> : <Suspense fallback={<PanelFallback />}><ActRelationships acts={ds.todosAtos()} /></Suspense>;
    if (aba === 'insights') return <Suspense fallback={<PanelFallback />}><InsightsApi /></Suspense>;

    // Pessoal
    if (aba === 'pessoal/siape') return <Suspense fallback={<PanelFallback />}><DossieApi /></Suspense>;
    if (aba === 'pessoal/chefias') return <Suspense fallback={<PanelFallback />}><ChefiasApi /></Suspense>;
    if (aba === 'pessoal/mandatos') return <Suspense fallback={<PanelFallback />}><MandatosApi /></Suspense>;
    if (aba === 'pessoal/prazos') return <Suspense fallback={<PanelFallback />}><PrazosApi /></Suspense>;
    if (aba === 'pessoal/jornada') return <Suspense fallback={<PanelFallback />}><JornadaApi /></Suspense>;

    // Institucional
    if (aba === 'institucional/comissoes') return <Suspense fallback={<PanelFallback />}><ComissoesApi /></Suspense>;
    if (aba === 'institucional/politicas') return <Suspense fallback={<PanelFallback />}><PoliticasApi /></Suspense>;
    if (aba === 'mudancas') return <Suspense fallback={<PanelFallback />}><MudancasApi /></Suspense>;
    if (aba === 'institucional/cooperacao') return <Suspense fallback={<PanelFallback />}><CooperacaoApi /></Suspense>;
    if (aba === 'institucional/revalidacao') return <Suspense fallback={<PanelFallback />}><RevalidacaoApi /></Suspense>;
    if (aba === 'institucional/ods') return <Suspense fallback={<PanelFallback />}><OdsApi /></Suspense>;

    // Utilitários
    if (aba === 'ajuda') return <Suspense fallback={<PanelFallback />}><HelpGuide /></Suspense>;
    if (aba === 'privacidade') return <Suspense fallback={<PanelFallback />}><PrivacidadeLGPD /></Suspense>;
    if (aba === 'sobre') return <Suspense fallback={<PanelFallback />}><Sobre /></Suspense>;

    return <Dashboard stats={stats} recentActs={recentActs} latestBulletin={latestBulletin} apiMode={apiMode} onNavigate={navigate} />;
  };

  return (
    <AppShell activePath={aba} onNavigate={navigate} apiMode={apiMode}
      onSearch={handleGlobalSearch} onThemeToggle={alternarTema} fotofobia={fotofobia} portalStats={portalStats}>
      {erro ? (
        <div className="max-w-[1400px] p-6 bg-[#FFF5F5] border border-[#E53E3E]/20 rounded-xl text-[#E53E3E] text-sm">
          {erro}
        </div>
      ) : (
        renderContent()
      )}
    </AppShell>
  );
}
