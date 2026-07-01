import React, { useState, useEffect } from 'react';
import { Database, GitBranch, Loader2, Moon, Sun } from 'lucide-react';
import { UffAct } from './types';
import { INITIAL_ACTS } from './data/initialActs';
import * as ds from './dataSource';

import PortalHeader from './components/PortalHeader';
import ActSpreadsheet from './components/ActSpreadsheet';
import ActTable from './components/ActTable';
import ActRelationships from './components/ActRelationships';
import ActRelationsApi from './components/ActRelationsApi';
import ChefiasApi from './components/ChefiasApi';
import ActParser from './components/ActParser';
import SeiIntegration from './components/SeiIntegration';
import HelpGuide from './components/HelpGuide';

export default function App() {
  const [acts, setActs] = useState<UffAct[]>([]);
  const [activeTab, setActiveTab] = useState<string>('planilha');
  const [modo, setModo] = useState<'api' | 'estatico' | 'carregando'>('carregando');
  const [stats, setStats] = useState<ds.Stats | null>(null);

  // Tema escuro p/ fotofobia: classe .fotofobia em <html>, persistida em
  // localStorage. O index.html já aplica antes de renderizar (evita flash);
  // aqui o estado nasce do que já está no <html> e o botão alterna.
  const [fotofobia, setFotofobia] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('fotofobia')
  );
  useEffect(() => {
    document.documentElement.classList.toggle('fotofobia', fotofobia);
    try { localStorage.setItem('tema-fotofobia', fotofobia ? '1' : '0'); } catch { /* ignore */ }
  }, [fotofobia]);

  // Inicializa a camada de dados: usa a API (banco) se disponível, senão o
  // JSON estático. No modo estático carrega tudo em memória (protótipo);
  // no modo API as consultas são paginadas no servidor.
  const inicializar = async () => {
    const m = await ds.init();
    if (m === 'estatico') {
      const todos = ds.todosAtos();
      setActs(todos.length ? todos : INITIAL_ACTS);
    }
    setStats(await ds.getStats());
    setModo(m);
  };
  useEffect(() => { inicializar(); }, []);

  // Handlers de curadoria (válidos só no modo estático/protótipo)
  const handleAddAct = (a: UffAct) => setActs(p => [a, ...p]);
  const handleUpdateAct = (a: UffAct) => setActs(p => p.map(x => x.id === a.id ? a : x));
  const handleDeleteAct = (id: string) => setActs(p => p.filter(x => x.id !== id));
  const handleBulkDelete = (ids: string[]) => setActs(p => p.filter(x => !ids.includes(x.id)));
  const handleBulkStatusUpdate = (ids: string[], status: 'Ativo' | 'Revogado' | 'Alterado') =>
    setActs(p => p.map(x => ids.includes(x.id) ? { ...x, status } : x));
  const handleImportActs = (imp: UffAct[]) => setActs(p => {
    const m = [...p];
    imp.forEach(i => { if (!m.some(x => x.tipoAto === i.tipoAto && x.numero === i.numero && x.ano === i.ano)) m.unshift(i); });
    return m;
  });
  const handleResetData = () => inicializar();

  const apiMode = modo === 'api';

  if (modo === 'carregando') {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando o portal…
    </div>;
  }

  return (
    <div id="portal-root" className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
      <PortalHeader
        acts={acts} stats={stats} apiMode={apiMode}
        onResetData={handleResetData}
        activeTab={activeTab} setActiveTab={setActiveTab}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="animate-fade-in duration-300">

          {activeTab === 'planilha' && (
            <div id="painel-planilha" className="space-y-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                <h3 className="text-xs font-bold text-[#003366] flex items-center gap-1.5 uppercase tracking-wider">
                  <Database className="w-4 h-4 text-yellow-500" /> Planilha de Pesquisa Normativa
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal font-medium">
                  Pesquise leis, resoluções e portarias por número, ementa, processo SEI, nome do servidor ou matrícula SIAPE.
                  {apiMode && ' Consulta direta no banco de dados (paginação no servidor).'}
                </p>
              </div>

              {apiMode ? (
                <ActTable />
              ) : (
                <ActSpreadsheet
                  acts={acts}
                  onAddAct={handleAddAct} onUpdateAct={handleUpdateAct} onDeleteAct={handleDeleteAct}
                  onBulkDelete={handleBulkDelete} onBulkStatusUpdate={handleBulkStatusUpdate} onImportActs={handleImportActs}
                />
              )}
            </div>
          )}

          {activeTab === 'ia-parser' && (
            <div id="painel-ia-parser"><ActParser onAddParsedAct={handleAddAct} somentePreview={apiMode} /></div>
          )}

          {activeTab === 'relacoes' && (
            <div id="painel-relacoes" className="space-y-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                <h3 className="text-xs font-bold text-[#003366] flex items-center gap-1.5 uppercase tracking-wider">
                  <GitBranch className="w-4 h-4 text-blue-600" /> Mapeamento e Auditoria de Revogações e Alterações
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal font-medium">
                  Evite ler atos revogados. Selecione um ato para ver se foi modificado/revogado por outro posterior.
                </p>
              </div>
              {apiMode ? <ActRelationsApi /> : <ActRelationships acts={acts} />}
            </div>
          )}

          {activeTab === 'chefias' && <div id="painel-chefias"><ChefiasApi /></div>}

          {activeTab === 'sei' && <div id="painel-sei"><SeiIntegration /></div>}
          {activeTab === 'ajuda' && <div id="painel-ajuda"><HelpGuide /></div>}

        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 mt-auto py-4 text-center text-xs text-slate-400 font-semibold">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Universidade Federal Fluminense (UFF) - Criado por João Fanara - joafanara@id.uff.br</span>
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Portal de Normas e Atos • {apiMode ? 'banco de dados' : 'modo estático'} • 2026
          </span>
        </div>
      </footer>

      <button
        onClick={() => setFotofobia(v => !v)}
        aria-pressed={fotofobia}
        aria-label={fotofobia ? 'Desativar modo escuro' : 'Ativar modo escuro (conforto para fotofobia)'}
        title={fotofobia ? 'Voltar ao modo claro' : 'Modo escuro (fotofobia)'}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full shadow-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-100"
      >
        {fotofobia ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-[#003366]" />}
        <span className="hidden sm:inline">{fotofobia ? 'Modo claro' : 'Modo escuro'}</span>
      </button>
    </div>
  );
}
