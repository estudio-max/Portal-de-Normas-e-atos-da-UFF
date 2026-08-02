import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './components/dashboard/Dashboard';
import { Skeleton } from './components/ui/Skeleton';
import { dataSource } from './dataSource';
import type { UffAct } from './types';

// Lazy load heavy panels to keep initial bundle small
const ActSpreadsheet = lazy(() => import('./components/panels/ActSpreadsheet'));
const ActRelationships = lazy(() => import('./components/panels/ActRelationships'));
const InsightsApi = lazy(() => import('./components/panels/InsightsApi'));
const DossieApi = lazy(() => import('./components/panels/DossieApi'));
const ChefiasApi = lazy(() => import('./components/panels/ChefiasApi'));
const MandatosApi = lazy(() => import('./components/panels/MandatosApi'));
const PrazosApi = lazy(() => import('./components/panels/PrazosApi'));
const JornadaApi = lazy(() => import('./components/panels/JornadaApi'));
const ComissoesApi = lazy(() => import('./components/panels/ComissoesApi'));
const CooperacaoApi = lazy(() => import('./components/panels/CooperacaoApi'));
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

function abaDoHash(): string {
  const raw = window.location.hash;
  if (!raw || raw === '#') return '';
  const path = raw.replace(/^#\//, '').replace(/\/$/, '');
  return path;
}

const ABAS_VALIDAS = [
  '', 'atos', 'relacoes', 'insights',
  'pessoal/siape', 'pessoal/chefias', 'pessoal/mandatos', 'pessoal/prazos', 'pessoal/jornada',
  'institucional/comissoes', 'institucional/cooperacao', 'institucional/ods',
  'ajuda', 'privacidade', 'sobre',
];

export default function App() {
  const [aba, setAba] = useState<string>(abaDoHash());
  const [apiMode, setApiMode] = useState<boolean>(false);
  const [stats, setStats] = useState<any>(null);
  const [recentActs, setRecentActs] = useState<UffAct[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  // Detect API mode
  useEffect(() => {
    const checkApi = async () => {
      try {
        const res = await fetch('./api/atos?limit=1', { method: 'HEAD' });
        setApiMode(res.ok);
      } catch {
        setApiMode(false);
      }
    };
    checkApi();
  }, []);

  // Load stats + recent acts for dashboard
  useEffect(() => {
    if (!apiMode) return;
    const load = async () => {
      try {
        const s = await dataSource.stats();
        setStats(s);
        const acts = await dataSource.atos({ limit: 5, sort: 'dataPublicacao', order: 'desc' });
        setRecentActs(acts.data || []);
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, [apiMode]);

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

  const navigate = (path: string) => {
    window.location.hash = path ? `#/${path}` : '#';
  };

  const renderContent = () => {
    // Dashboard (default)
    if (aba === '') {
      return <Dashboard stats={stats} recentActs={recentActs} apiMode={apiMode} onNavigate={navigate} />;
    }

    // Navegar
    if (aba === 'atos') return <Suspense fallback={<PanelFallback />}><ActSpreadsheet /></Suspense>;
    if (aba === 'relacoes') return <Suspense fallback={<PanelFallback />}><ActRelationships /></Suspense>;
    if (aba === 'insights') return <Suspense fallback={<PanelFallback />}><InsightsApi /></Suspense>;

    // Pessoal
    if (aba === 'pessoal/siape') return <Suspense fallback={<PanelFallback />}><DossieApi /></Suspense>;
    if (aba === 'pessoal/chefias') return <Suspense fallback={<PanelFallback />}><ChefiasApi /></Suspense>;
    if (aba === 'pessoal/mandatos') return <Suspense fallback={<PanelFallback />}><MandatosApi /></Suspense>;
    if (aba === 'pessoal/prazos') return <Suspense fallback={<PanelFallback />}><PrazosApi /></Suspense>;
    if (aba === 'pessoal/jornada') return <Suspense fallback={<PanelFallback />}><JornadaApi /></Suspense>;

    // Institucional
    if (aba === 'institucional/comissoes') return <Suspense fallback={<PanelFallback />}><ComissoesApi /></Suspense>;
    if (aba === 'institucional/cooperacao') return <Suspense fallback={<PanelFallback />}><CooperacaoApi /></Suspense>;
    if (aba === 'institucional/ods') return <Suspense fallback={<PanelFallback />}><OdsApi /></Suspense>;

    // Utilitários
    if (aba === 'ajuda') return <Suspense fallback={<PanelFallback />}><HelpGuide /></Suspense>;
    if (aba === 'privacidade') return <Suspense fallback={<PanelFallback />}><PrivacidadeLGPD /></Suspense>;
    if (aba === 'sobre') return <Suspense fallback={<PanelFallback />}><Sobre /></Suspense>;

    return <Dashboard stats={stats} recentActs={recentActs} apiMode={apiMode} onNavigate={navigate} />;
  };

  return (
    <AppShell activePath={aba} onNavigate={navigate} apiMode={apiMode}>
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
