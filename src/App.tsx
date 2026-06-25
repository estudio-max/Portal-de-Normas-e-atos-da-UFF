import React, { useState, useEffect } from 'react';
import { Database, FileText, Sparkles, HelpCircle, GitBranch, Search, AlertCircle, Info } from 'lucide-react';
import { UffAct } from './types';
import { INITIAL_ACTS } from './data/initialActs';

import PortalHeader from './components/PortalHeader';
import ActSpreadsheet from './components/ActSpreadsheet';
import ActRelationships from './components/ActRelationships';
import ActParser from './components/ActParser';
import SeiIntegration from './components/SeiIntegration';

export default function App() {
  // Primary state: List of registered Acts
  const [acts, setActs] = useState<UffAct[]>([]);
  const [activeTab, setActiveTab] = useState<string>('planilha');

  // Load from local storage or load initial pre-populated dataset
  useEffect(() => {
    const stored = localStorage.getItem('uff_portal_acts');
    if (stored) {
      try {
        setActs(JSON.parse(stored));
      } catch (e) {
        console.error("Erro ao ler dados do localStorage:", e);
        setActs(INITIAL_ACTS);
      }
    } else {
      setActs(INITIAL_ACTS);
      localStorage.setItem('uff_portal_acts', JSON.stringify(INITIAL_ACTS));
    }
  }, []);

  // Sync state to local storage
  const saveActsToStorage = (updatedActs: UffAct[]) => {
    setActs(updatedActs);
    localStorage.setItem('uff_portal_acts', JSON.stringify(updatedActs));
  };

  // Add individual Act
  const handleAddAct = (newAct: UffAct) => {
    const updated = [newAct, ...acts];
    saveActsToStorage(updated);
  };

  // Update individual Act
  const handleUpdateAct = (updatedAct: UffAct) => {
    const updated = acts.map(act => act.id === updatedAct.id ? updatedAct : act);
    saveActsToStorage(updated);
  };

  // Delete individual Act
  const handleDeleteAct = (id: string) => {
    const updated = acts.filter(act => act.id !== id);
    saveActsToStorage(updated);
  };

  // Bulk actions
  const handleBulkDelete = (ids: string[]) => {
    const updated = acts.filter(act => !ids.includes(act.id));
    saveActsToStorage(updated);
  };

  const handleBulkStatusUpdate = (ids: string[], status: 'Ativo' | 'Revogado' | 'Alterado') => {
    const updated = acts.map(act => {
      if (ids.includes(act.id)) {
        return { ...act, status };
      }
      return act;
    });
    saveActsToStorage(updated);
  };

  // Bulk Import
  const handleImportActs = (importedActs: UffAct[]) => {
    // Avoid duplicating exact matches by matching "tipo + numero + ano"
    const merged = [...acts];
    importedActs.forEach(imp => {
      const exists = merged.some(m => 
        m.tipoAto.toLowerCase() === imp.tipoAto.toLowerCase() && 
        m.numero.toLowerCase() === imp.numero.toLowerCase() && 
        m.ano === imp.ano
      );
      if (!exists) {
        merged.unshift(imp);
      }
    });
    saveActsToStorage(merged);
  };

  // Reset database back to default demonstration set
  const handleResetData = () => {
    saveActsToStorage(INITIAL_ACTS);
  };

  return (
    <div id="portal-root" className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
      
      {/* Upper Navigation & Brand Banner */}
      <PortalHeader 
        acts={acts} 
        onResetData={handleResetData}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Screen Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        
        {/* Dynamic Panel Renderer */}
        <div className="animate-fade-in duration-300">
          
          {/* Tab 1: Interactive Spreadsheet & Inline registration */}
          {activeTab === 'planilha' && (
            <div id="painel-planilha" className="space-y-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                <h3 className="text-xs font-bold text-[#003366] flex items-center gap-1.5 uppercase tracking-wider">
                  <Database className="w-4 h-4 text-yellow-500" /> Planilha de Registro e Pesquisa Normativa
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal font-medium">
                  Pesquise leis, resoluções e portarias do boletim utilizando filtros estruturados ou faça o cadastro direto. Use a caixa de seleção à esquerda de cada linha para aplicar alterações ou remoções em lote.
                </p>
              </div>
              
              <ActSpreadsheet 
                acts={acts}
                onAddAct={handleAddAct}
                onUpdateAct={handleUpdateAct}
                onDeleteAct={handleDeleteAct}
                onBulkDelete={handleBulkDelete}
                onBulkStatusUpdate={handleBulkStatusUpdate}
                onImportActs={handleImportActs}
              />
            </div>
          )}

          {/* Tab 2: Intelligent AI Parser Assistant */}
          {activeTab === 'ia-parser' && (
            <div id="painel-ia-parser">
              <ActParser onAddParsedAct={handleAddAct} />
            </div>
          )}

          {/* Tab 3: Relationship Auditor & Dependency Trace Map */}
          {activeTab === 'relacoes' && (
            <div id="painel-relacoes" className="space-y-3">
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                <h3 className="text-xs font-bold text-[#003366] flex items-center gap-1.5 uppercase tracking-wider">
                  <GitBranch className="w-4 h-4 text-blue-600" /> Mapeamento e Auditoria de Revogações e Alterações
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-normal font-medium">
                  Evite ler atos revogados. Selecione qualquer portaria ou resolução da lista para analisar sua validade. O sistema exibirá se o ato foi modificado/revogado por outra lei posterior ou se é ele quem altera resoluções anteriores.
                </p>
              </div>

              <ActRelationships acts={acts} />
            </div>
          )}

          {/* Tab 4: External SEI Search & Guidelines integration */}
          {activeTab === 'sei' && (
            <div id="painel-sei">
              <SeiIntegration />
            </div>
          )}

        </div>

      </main>

      {/* Corporate footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-4 text-center text-xs text-slate-400 font-semibold">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Universidade Federal Fluminense (UFF) — Superintendência de Tecnologia da Informação (STI)</span>
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Portal de Normas Inteligente v1.2.0 • 2026
          </span>
        </div>
      </footer>

    </div>
  );
}
