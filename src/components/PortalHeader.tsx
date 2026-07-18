import React from 'react';
import { FileText, Search, ExternalLink, Database, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { UffAct } from '../types';

interface PortalHeaderProps {
  acts: UffAct[];
  stats?: {
    total: number; vigentes: number; revogados: number; alterados: number;
    orgaos: number; comSei: number; boletins: number;
    ultimaAtualizacao?: string | null;
    ultimoBoletim?: { arquivo: string; numero: string; ano: number; link: string | null } | null;
  } | null;
  apiMode?: boolean;
  onResetData: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function PortalHeader({ acts, stats, apiMode, onResetData, activeTab, setActiveTab }: PortalHeaderProps) {
  // Usa os totais da camada de dados (API ou estático); fallback p/ o array
  const total = stats?.total ?? acts.length;
  const activeCount = stats?.vigentes ?? acts.filter(a => a.status === 'Ativo').length;
  const revokedCount = stats?.revogados ?? acts.filter(a => a.status === 'Revogado').length;
  const alteradoCount = stats?.alterados ?? acts.filter(a => a.status === 'Alterado').length;
  const uniqueOrgaos = stats?.orgaos ?? new Set(acts.map(a => a.orgaoEmissor)).size;
  const withSei = stats?.comSei ?? acts.filter(a => a.processoSei).length;

  const TABS: { id: string; key: string; emoji?: string; icon?: React.ReactNode; label: string }[] = [
    { id: 'tab-planilha', key: 'planilha', emoji: '📊', label: 'Planilha e Cadastro de Atos' },
    { id: 'tab-relacoes', key: 'relacoes', emoji: '🕸️', label: 'Mapa de Relações e Impacto' },
    { id: 'tab-chefias', key: 'chefias', emoji: '👥', label: 'Chefias da UFF' },
    { id: 'tab-dossie', key: 'dossie', emoji: '🗂️', label: 'Meu SIAPE' },
    { id: 'tab-mandatos', key: 'mandatos', emoji: '⏳', label: 'Mandatos' },
    { id: 'tab-prazos', key: 'prazos', emoji: '📅', label: 'Prazos' },
    { id: 'tab-jornada', key: 'jornada', emoji: '🕒', label: 'Jornada de trabalho' },
    { id: 'tab-insights', key: 'insights', emoji: '📈', label: 'Insights' },
    { id: 'tab-ia-parser', key: 'ia-parser', emoji: '🧠', label: apiMode ? 'Analisar Ato (texto)' : 'Assistente IA de Indexação' },
    { id: 'tab-ajuda', key: 'ajuda', emoji: '❓', label: 'Ajuda' },
    { id: 'tab-privacidade', key: 'privacidade', icon: <ShieldCheck className="w-4 h-4" />, label: 'Privacidade' },
    { id: 'tab-sobre', key: 'sobre', emoji: 'ℹ️', label: 'Sobre' },
  ];

  return (
    <header id="portal-header" className="bg-[#003366] text-white border-b border-blue-900 shadow-sm">
      {/* Upper Navigation & Branding Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-white rounded-md flex items-center justify-center font-extrabold text-[#003366] shadow-sm shrink-0">
              UFF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-700/30">
                  Boletim de Serviço Eletrônico
                </span>
              </div>
              <h1 className="text-lg font-bold tracking-tight text-white mt-0.5">
                Portal de Normas e Atos <span className="font-normal opacity-70 italic text-sm tracking-normal">— Gestão Integrada de Legislação</span>
              </h1>
            </div>
          </div>

          {/* Quick External Links */}
          <div className="flex items-center gap-2 flex-wrap">
            <a
              id="link-boletim-uff"
              href="https://boletimdeservico.uff.br/boletins/bs-2026/"
              target="_blank"
              referrerPolicy="no-referrer"
              className="flex items-center gap-1.5 text-xs font-semibold bg-blue-800/40 hover:bg-blue-800/70 border border-blue-400/30 px-3 py-1.5 rounded-md transition-all text-slate-100"
            >
              <FileText className="w-3.5 h-3.5 text-yellow-400" />
              <span>Boletim de Serviço 2026</span>
              <ExternalLink className="w-3 h-3 text-blue-300" />
            </a>
            
            <a
              id="link-sei-uff"
              href="https://sei.uff.br/sei/modulos/pesquisa/md_pesq_processo_pesquisar.php?acao_externa=protocolo_pesquisar&acao_origem_externa=protocolo_pesquisar&id_orgao_acesso_externo=0"
              target="_blank"
              referrerPolicy="no-referrer"
              className="flex items-center gap-1.5 text-xs font-semibold bg-blue-800/40 hover:bg-blue-800/70 border border-blue-400/30 px-3 py-1.5 rounded-md transition-all text-slate-100"
            >
              <Search className="w-3.5 h-3.5 text-yellow-400" />
              <span>Pesquisa Pública SEI</span>
              <ExternalLink className="w-3 h-3 text-blue-300" />
            </a>

            {!apiMode && (
              <button
                id="btn-restaurar-dados"
                onClick={() => {
                  if(window.confirm("Deseja restaurar os dados de demonstração original? Suas alterações locais (modo estático) serão descartadas.")) {
                    onResetData();
                  }
                }}
                title="Restaurar base de dados de demonstração original"
                className="p-1.5 bg-blue-800/40 hover:bg-red-900/40 border border-blue-400/30 hover:border-red-900 text-slate-200 hover:text-red-100 rounded-md transition-all flex items-center justify-center cursor-pointer h-[30px]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Real-time Dashboard Statistics Banner (High Density Style) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4">
          <div className="bg-[#00264d] border border-blue-800/40 p-2.5 rounded-lg flex flex-col justify-between hover:shadow-xs transition-all">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">Total Indexado</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold tracking-tight text-white">{total}</span>
              <span className="text-[10px] text-slate-400">atos</span>
            </div>
          </div>

          <div className="bg-[#00264d] border border-blue-800/40 p-2.5 rounded-lg flex flex-col justify-between hover:shadow-xs transition-all">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Vigente (Ativo)</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold tracking-tight text-emerald-300">{activeCount}</span>
              <span className="text-[10px] text-emerald-500 font-bold">
                {total > 0 ? `${Math.round((activeCount / total) * 100)}%` : '0%'}
              </span>
            </div>
          </div>

          <div className="bg-[#00264d] border border-blue-800/40 p-2.5 rounded-lg flex flex-col justify-between hover:shadow-xs transition-all">
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Revogado</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold tracking-tight text-red-300">{revokedCount}</span>
              <span className="text-[10px] text-red-400">atos</span>
            </div>
          </div>

          <div className="bg-[#00264d] border border-blue-800/40 p-2.5 rounded-lg flex flex-col justify-between hover:shadow-xs transition-all">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">Alterado</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold tracking-tight text-amber-300">{alteradoCount}</span>
              <span className="text-[10px] text-amber-400">modificações</span>
            </div>
          </div>

          <div className="bg-[#00264d] border border-blue-800/40 p-2.5 rounded-lg flex flex-col justify-between hover:shadow-xs transition-all">
            <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wide">Órgãos Emissores</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold tracking-tight text-teal-300">{uniqueOrgaos}</span>
              <span className="text-[10px] text-teal-400">setores</span>
            </div>
          </div>

          <div className="bg-[#00264d] border border-blue-800/40 p-2.5 rounded-lg flex flex-col justify-between hover:shadow-xs transition-all">
            <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wide">Vínculo SEI</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold tracking-tight text-sky-300">{withSei}</span>
              <span className="text-[10px] text-sky-400">processos</span>
            </div>
          </div>
        </div>

        {/* Última atualização: quando o último ato NOVO entrou no banco + link
            do boletim mais recente indexado. Dá visibilidade imediata de
            atraso na rotina de importação diária. */}
        {stats?.ultimaAtualizacao && (
          <div id="ultima-atualizacao" className="flex justify-end mt-1.5">
            <span className="text-[11px] text-blue-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
              Atualização mais recente em <strong className="text-white font-bold">
                {stats.ultimaAtualizacao.slice(0, 10).split('-').reverse().join('/')}</strong>
              {stats.ultimoBoletim && (
                <>
                  {' · '}
                  {stats.ultimoBoletim.link ? (
                    <a href={stats.ultimoBoletim.link} target="_blank" referrerPolicy="no-referrer"
                       className="underline decoration-blue-400/50 hover:text-yellow-300 font-semibold">
                      BS nº {stats.ultimoBoletim.numero}/{stats.ultimoBoletim.ano} (PDF)
                    </a>
                  ) : (
                    <span className="font-semibold">BS nº {stats.ultimoBoletim.numero}/{stats.ultimoBoletim.ano}</span>
                  )}
                </>
              )}
            </span>
          </div>
        )}

        {/* Navegação por abas. Aparência de aba de verdade (ativa em primeiro
            plano/branca, inativas recuadas) em vez do sublinhado fino de
            antes — e calibrada para quem tem 50+ anos: fonte maior, SEM caixa
            alta (letras minúsculas misturadas se leem mais rápido que
            MAIÚSCULO CONTÍNUO, que força o olho a reconhecer letra por letra
            em vez da forma da palavra), alvo de toque de ~48px (referência de
            acessibilidade é 44px), e quebra de linha em vez de rolagem
            horizontal escondida — rolar a navegação lateralmente é um gesto
            que nem todo usuário sabe que existe; melhor mostrar tudo. */}
        <div className="flex flex-wrap gap-2 mt-5" role="tablist">
          {TABS.map(t => {
            const ativa = activeTab === t.key;
            return (
              <button
                key={t.key}
                id={t.id}
                role="tab"
                aria-selected={ativa}
                onClick={() => setActiveTab(t.key)}
                className={`relative flex items-center gap-2 px-4 py-3.5 rounded-t-lg text-sm font-bold whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${
                  ativa
                    ? 'bg-white text-[#003366] shadow-[0_-4px_10px_rgba(0,0,0,0.18)] z-10'
                    : 'bg-blue-950/40 text-blue-100 hover:bg-blue-900/60 hover:text-white'
                }`}
              >
                {/* faixa de cor no topo da aba ativa: reforça "selecionado"
                    sem depender só da cor de fundo (contraste/daltonismo) */}
                {ativa && <span className="absolute top-0 left-0 right-0 h-[3px] bg-yellow-400 rounded-t-lg" />}
                {t.icon ?? <span aria-hidden>{t.emoji}</span>}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
