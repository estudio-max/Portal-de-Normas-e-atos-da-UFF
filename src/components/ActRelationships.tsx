import React, { useState, useMemo } from 'react';
import { 
  ArrowRight, Link, Eye, AlertTriangle, ShieldCheck, HelpCircle, 
  Search, ShieldAlert, GitBranch, ArrowUpRight, ArrowDownLeft, FileText
} from 'lucide-react';
import { UffAct } from '../types';

interface ActRelationshipsProps {
  acts: UffAct[];
  onSelectAct?: (act: UffAct) => void;
}

export default function ActRelationships({ acts, onSelectAct }: ActRelationshipsProps) {
  const [selectedActId, setSelectedActId] = useState<string>(acts[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Act full object
  const selectedAct = useMemo(() => {
    return acts.find(a => a.id === selectedActId);
  }, [acts, selectedActId]);

  // Acts list filtered by search query
  const filteredActs = useMemo(() => {
    return acts.filter(a => {
      const label = `${a.tipoAto} nº ${a.numero}/${a.ano}`;
      return label.toLowerCase().includes(searchQuery.toLowerCase()) || 
             a.ementa.toLowerCase().includes(searchQuery.toLowerCase()) ||
             a.orgaoEmissor.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [acts, searchQuery]);

  // Outward relations (what the selected act affects)
  // e.g. Selected Act "Revoga" -> Target Act
  const outwardRelations = useMemo(() => {
    if (!selectedAct) return [];
    return selectedAct.relacoes.map(rel => {
      // Find if target act exists in our database
      const matchedDestAct = acts.find(a => {
        const standardName = `${a.tipoAto} ${a.orgaoEmissor ? a.orgaoEmissor + ' ' : ''}nº ${a.numero}/${a.ano}`;
        const nameWithoutIssuer = `${a.tipoAto} nº ${a.numero}/${a.ano}`;
        
        return rel.atoDestino.toLowerCase().includes(standardName.toLowerCase()) ||
               rel.atoDestino.toLowerCase().includes(nameWithoutIssuer.toLowerCase()) ||
               (rel.atoDestino.toLowerCase().includes(a.numero) && rel.atoDestino.toLowerCase().includes(a.ano.toString()));
      });

      return {
        relation: rel,
        targetActExists: !!matchedDestAct,
        targetActObj: matchedDestAct,
        label: rel.atoDestino,
        type: rel.tipoRelacao,
        details: rel.detalhes
      };
    });
  }, [acts, selectedAct]);

  // Inward relations (what affects the selected act).
  // Usa o índice reverso PRÉ-CALCULADO (referenciadoPor) — rigoroso por
  // sigla+número+tipo — com fallback para a varredura ao vivo.
  const inwardRelations = useMemo(() => {
    if (!selectedAct) return [];
    const byId = new Map(acts.map(a => [a.id, a]));
    const pre = selectedAct.referenciadoPor || [];
    if (pre.length > 0) {
      return pre.map(rev => ({
        originAct: byId.get(rev.porId) || {
          id: rev.porId,
          tipoAto: rev.porLabel.split(' ')[0],
          numero: (rev.porLabel.match(/nº\s*([\d.]+)/i) || [])[1] || '',
          ano: Number((rev.porLabel.match(/\/(\d{4})/) || [])[1]) || '',
          ementa: '', orgaoEmissor: ''
        },
        relationType: rev.relacao,
        details: rev.detalhes
      }));
    }
    const relations: any[] = [];
    acts.forEach(otherAct => {
      if (otherAct.id === selectedAct.id) return;
      otherAct.relacoes.forEach(rel => {
        const d = rel.atoDestino.toLowerCase();
        const num = selectedAct.numero.toLowerCase();
        const tipo = selectedAct.tipoAto.toLowerCase();
        if (d.includes(`${tipo} nº ${num}/${selectedAct.ano}`) ||
            (d.includes(num) && d.includes(selectedAct.ano.toString()) && d.includes(tipo))) {
          relations.push({ originAct: otherAct, relationType: rel.tipoRelacao, details: rel.detalhes });
        }
      });
    });
    return relations;
  }, [acts, selectedAct]);

  // Detect and summarize general status of the selected Act
  const statusAudit = useMemo(() => {
    if (!selectedAct) return null;
    
    // Check if any other act revokes this
    const revokingAct = inwardRelations.find(r => r.relationType === 'Revoga');
    const alteringActs = inwardRelations.filter(r => r.relationType === 'Altera');

    if (revokingAct) {
      return {
        status: 'Revogado',
        color: 'rose',
        title: 'Documento Revogado e Inativo',
        description: `Este ato foi expressamente REVOGADO por outro dispositivo legal mais recente: ${revokingAct.originAct.tipoAto} nº ${revokingAct.originAct.numero}/${revokingAct.originAct.ano}. Suas regras não estão mais em vigor.`,
        causeAct: revokingAct.originAct
      };
    } else if (alteringActs.length > 0) {
      return {
        status: 'Alterado',
        color: 'amber',
        title: 'Vigência com Alterações Parciais',
        description: `Este ato foi ALTERADO por ${alteringActs.length} dispositivo(s) mais recente(s). Algumas partes da redação original foram modificadas e devem ser lidas em conjunto com as novas diretrizes.`,
        alteringActs: alteringActs.map(a => a.originAct)
      };
    } else if (selectedAct.status === 'Revogado') {
      return {
        status: 'Revogado',
        color: 'rose',
        title: 'Revogado (Marcação Manual)',
        description: 'Este ato está classificado como Revogado nos registros manuais do portal, indicando que não possui mais vigência prática.'
      };
    } else {
      return {
        status: 'Ativo',
        color: 'emerald',
        title: 'Vigência Plena (Ativo)',
        description: 'Nenhuma revogação ou alteração foi registrada para este ato na base de dados do Portal. Ele presume-se ativo e com eficácia plena.'
      };
    }
  }, [selectedAct, inwardRelations]);

  return (
    <div id="act-relationships-container" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      
      {/* Left Column: Search & Selector list (4 cols) */}
      <div className="lg:col-span-4 bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col h-[650px]">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Selecione o Ato para Auditoria</h4>
        
        {/* Search Input inside sidebar */}
        <div className="relative mb-2.5">
          <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar atos da lista..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:bg-white text-slate-800"
          />
        </div>

        {/* Scrollable list of acts */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 select-scrollbar">
          {filteredActs.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-8">Nenhum ato coincide.</p>
          ) : (
            filteredActs.map(act => {
              const isSelected = act.id === selectedActId;
              return (
                <button
                  key={act.id}
                  onClick={() => setSelectedActId(act.id)}
                  className={`w-full text-left p-2 rounded-md border transition-all flex flex-col gap-0.5 cursor-pointer ${
                    isSelected 
                      ? 'bg-blue-50 border-blue-200 text-blue-900 shadow-xs' 
                      : 'bg-slate-50/50 hover:bg-slate-50 border-slate-150 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-xs">
                      {act.tipoAto} nº {act.numero}/{act.ano}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                      act.status === 'Ativo' 
                        ? 'bg-green-100 text-green-700 border border-green-200' 
                        : act.status === 'Revogado' 
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : 'bg-blue-100 text-blue-700 border border-blue-200'
                    }`}>
                      {act.status === 'Ativo' ? 'VIGENTE' : act.status === 'Revogado' ? 'REVOGADO' : 'ALTERADO'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{act.orgaoEmissor}</span>
                  <p className="text-[10px] text-slate-400 line-clamp-1 font-medium mt-0.5">"{act.ementa}"</p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Detailed Trace Visualizer (8 cols) */}
      <div className="lg:col-span-8 space-y-4">
        {selectedAct ? (
          <>
            {/* Act header & Auditing badge */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-150 pb-3 mb-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded uppercase tracking-wider border border-yellow-200">
                      Órgão Emissor: {selectedAct.orgaoEmissor}
                    </span>
                    {selectedAct.processoSei && (
                      <span className="text-[10px] font-mono text-slate-400">
                        Processo SEI: {selectedAct.processoSei}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">
                    {selectedAct.tipoAto} UFF nº {selectedAct.numero}/{selectedAct.ano}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    Assinado em: {selectedAct.dataAssinatura.split('-').reverse().join('/')}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Status no Portal:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider uppercase border ${
                    selectedAct.status === 'Ativo' 
                      ? 'bg-green-100 text-green-700 border-green-200' 
                      : selectedAct.status === 'Revogado' 
                      ? 'bg-red-100 text-red-700 border-red-200'
                      : 'bg-blue-100 text-blue-700 border-blue-200'
                  }`}>
                    {selectedAct.status === 'Ativo' ? 'VIGENTE' : selectedAct.status === 'Revogado' ? 'REVOGADO' : 'ALTERADO'}
                  </span>
                </div>
              </div>

              {/* Real-Time Compliance Auditor Panel */}
              {statusAudit && (
                <div className={`p-3 rounded-lg border flex items-start gap-3 ${
                  statusAudit.color === 'emerald' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : statusAudit.color === 'amber'
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <div className="mt-0.5 p-1.5 rounded bg-white/80 shadow-xs flex items-center justify-center">
                    {statusAudit.color === 'emerald' && <ShieldCheck className="w-4 h-4 text-emerald-600" />}
                    {statusAudit.color === 'amber' && <GitBranch className="w-4 h-4 text-blue-600" />}
                    {statusAudit.color === 'rose' && <ShieldAlert className="w-4 h-4 text-red-600" />}
                  </div>
                  <div className="space-y-0.5">
                    <h5 className="font-bold text-xs tracking-tight uppercase">
                      {statusAudit.title === 'Vigência Plena (Ativo)' ? 'Vigência Plena (Vigente)' : statusAudit.title}
                    </h5>
                    <p className="text-[11px] leading-relaxed text-slate-700 font-medium">
                      {statusAudit.description}
                    </p>
                    {statusAudit.causeAct && (
                      <button
                        onClick={() => setSelectedActId(statusAudit.causeAct.id)}
                        className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline flex items-center gap-1 mt-0.5 cursor-pointer"
                      >
                        Ir para o Ato Revogador ({statusAudit.causeAct.tipoAto} nº {statusAudit.causeAct.numero}/{statusAudit.causeAct.ano})
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Brief description of content */}
              <div className="mt-3 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Impacto Prático do Ato (Ementa Simples)</span>
                <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-md border border-slate-100 leading-relaxed font-medium">
                  {selectedAct.conteudoResumido}
                </p>
              </div>
            </div>

            {/* Visual Trace Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              
              {/* CARD A: Outward Relations (What does this act modify/revoke?) */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col">
                <div className="flex items-center gap-1.5 text-[#003366] border-b border-slate-150 pb-2 mb-2.5">
                  <ArrowUpRight className="w-4 h-4 text-indigo-500" />
                  <h4 className="font-bold text-[10px] uppercase tracking-wider">
                    Modificações originadas por este Ato
                  </h4>
                </div>
                
                {outwardRelations.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs italic flex-1 flex flex-col justify-center">
                    <FileText className="w-5 h-5 text-slate-200 mx-auto mb-1" />
                    <span>Este ato não menciona nenhuma alteração ou revogação de outras normas.</span>
                  </div>
                ) : (
                  <div className="space-y-2 flex-1">
                    {outwardRelations.map((out, idx) => (
                      <div key={idx} className="bg-slate-50 p-2.5 rounded border border-slate-150/70 text-xs flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className={`px-1.5 py-0.25 rounded text-[9px] font-extrabold uppercase ${
                            out.type === 'Revoga' 
                              ? 'bg-rose-100 text-rose-800' 
                              : out.type === 'Altera'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {out.type}
                          </span>
                          
                          {out.targetActExists && out.targetActObj ? (
                            <button
                              onClick={() => setSelectedActId(out.targetActObj!.id)}
                              className="text-[10px] font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 cursor-pointer hover:underline"
                              title="Visualizar Auditoria deste ato"
                            >
                              <span>Ver Vínculo</span>
                              <Eye className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-medium italic">Ato externo</span>
                          )}
                        </div>

                        <div>
                          <div className="font-bold text-slate-800 text-[11px]">{out.label}</div>
                          {out.details && (
                            <p className="text-slate-500 font-medium mt-0.5 leading-normal text-[10px]">
                              detalhes: {out.details}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* CARD B: Inward Relations (What other newer acts affect this act?) */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col">
                <div className="flex items-center gap-1.5 text-[#003366] border-b border-slate-150 pb-2 mb-2.5">
                  <ArrowDownLeft className="w-4 h-4 text-teal-500" />
                  <h4 className="font-bold text-[10px] uppercase tracking-wider">
                    Atos mais recentes que afetam este Ato
                  </h4>
                </div>

                {inwardRelations.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs italic flex-1 flex flex-col justify-center">
                    <ShieldCheck className="w-5 h-5 text-emerald-100 mx-auto mb-1" />
                    <span>Este ato permanece íntegro. Nenhuma norma posterior o alterou ou revogou.</span>
                  </div>
                ) : (
                  <div className="space-y-2 flex-1">
                    {inwardRelations.map((inw, idx) => (
                      <div key={idx} className="bg-slate-50 p-2.5 rounded border border-slate-150/70 text-xs flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className={`px-1.5 py-0.25 rounded text-[9px] font-extrabold uppercase ${
                            inw.relationType === 'Revoga' 
                              ? 'bg-rose-50 text-rose-800 font-bold border border-rose-100' 
                              : inw.relationType === 'Altera'
                              ? 'bg-amber-50 text-amber-800 font-bold border border-amber-100'
                              : 'bg-blue-50 text-blue-800 font-bold border border-blue-100'
                          }`}>
                            {inw.relationType === 'Revoga' ? 'Revogado por' : inw.relationType === 'Altera' ? 'Alterado por' : 'Afetado por'}
                          </span>
                          
                          <button
                            onClick={() => setSelectedActId(inw.originAct.id)}
                            className="text-[10px] font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 cursor-pointer hover:underline"
                          >
                            <span>Ir para Origem</span>
                            <Eye className="w-3 h-3" />
                          </button>
                        </div>

                        <div>
                          <div className="font-bold text-slate-800 text-[11px]">
                            {inw.originAct.tipoAto} nº {inw.originAct.numero}/{inw.originAct.ano}
                          </div>
                          <p className="text-[10px] text-slate-400 line-clamp-1 font-medium italic mt-0.5">"{inw.originAct.ementa}"</p>
                          {inw.details && (
                            <p className="text-slate-500 font-medium mt-0.5 leading-normal text-[10px]">
                              justificativa: {inw.details}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Complete original Ementa citation card */}
            <div className="bg-[#00264d] text-slate-100 p-4 rounded-lg border border-blue-900/40 shadow-inner">
              <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400 block mb-1">Transcrição Oficial do Cabeçalho</span>
              <p className="text-xs italic leading-relaxed font-serif">
                "{selectedAct.ementa}"
              </p>
            </div>
          </>
        ) : (
          <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
            <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-medium">Nenhum ato selecionado.</p>
          </div>
        )}
      </div>

    </div>
  );
}
