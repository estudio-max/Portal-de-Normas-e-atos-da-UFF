import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, ShieldCheck, ShieldAlert, GitBranch, ArrowUpRight, ArrowDownLeft,
  Eye, ArrowRight, FileText, AlertTriangle, Loader2
} from 'lucide-react';
import * as ds from '../dataSource';
import { UffAct } from '../types';

// Mapa de Relações no modo API: lista lateral via busca server-side, ficha
// (relações + referenciadoPor) via /atos/{id}. Mesma utilidade da versão
// estática, mas sem carregar a base inteira.
export default function ActRelationsApi() {
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<ds.AtoLista[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [sel, setSel] = useState<UffAct | null>(null);

  const buscar = useCallback(async () => {
    setCarregandoLista(true);
    const r = await ds.listAtos({ busca, com_relacoes: true, por_pagina: 80, ordenar: 'data_ato', dir: 'desc' });
    setLista(r.atos);
    setCarregandoLista(false);
  }, [busca]);

  const t = useRef<any>(null);
  useEffect(() => { clearTimeout(t.current); t.current = setTimeout(buscar, 300); return () => clearTimeout(t.current); }, [buscar]);

  const selecionar = (id: string) => ds.getAto(id).then(a => { if (a) setSel(a); });
  useEffect(() => { if (!sel && lista.length) selecionar(lista[0].id); /* seleciona o 1º */ }, [lista]);

  const corStatus = (s?: string) => s === 'Ativo' ? 'bg-green-100 text-green-700 border-green-200'
    : s === 'Revogado' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200';
  const corRel = (tp: string) => tp === 'Revoga' ? 'bg-rose-100 text-rose-800' : tp === 'Altera' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800';
  const rotuloInverso = (r: string) => r === 'Revoga' ? 'Revogado por' : r === 'Altera' ? 'Alterado por' : 'Referenciado por';

  // veredito de vigência a partir do referenciadoPor da ficha
  const auditoria = (() => {
    if (!sel) return null;
    const refs = sel.referenciadoPor || [];
    const rev = refs.find(r => r.relacao === 'Revoga');
    const alt = refs.filter(r => r.relacao === 'Altera');
    if (rev) return { cor: 'rose', icone: <ShieldAlert className="w-4 h-4 text-red-600" />, titulo: 'Documento Revogado e Inativo', desc: `Este ato foi REVOGADO por ${rev.porLabel}. Suas regras não estão mais em vigor.`, causa: rev };
    if (alt.length) return { cor: 'amber', icone: <GitBranch className="w-4 h-4 text-blue-600" />, titulo: 'Vigência com Alterações Parciais', desc: `Este ato foi ALTERADO por ${alt.length} ato(s) posterior(es). Leia em conjunto com eles.`, causa: alt[0] };
    if (sel.status === 'Revogado') return { cor: 'rose', icone: <ShieldAlert className="w-4 h-4 text-red-600" />, titulo: 'Revogado', desc: 'Classificado como revogado nos registros do portal.' };
    return { cor: 'emerald', icone: <ShieldCheck className="w-4 h-4 text-emerald-600" />, titulo: 'Vigência Plena (Vigente)', desc: 'Nenhuma revogação ou alteração registrada. Presume-se ativo.' };
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* lista */}
      <div className="lg:col-span-4 bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col h-[650px]">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Selecione o ato para auditoria</h4>
        <div className="relative mb-2.5">
          <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar ato (nº, ementa, órgão)…"
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-400" />
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {carregandoLista ? <p className="text-xs text-slate-400 text-center py-8"><Loader2 className="w-4 h-4 animate-spin inline" /> carregando…</p>
            : lista.length === 0 ? <p className="text-xs text-slate-400 italic text-center py-8">Nenhum ato com relações encontrado.</p>
            : lista.map(a => (
              <button key={a.id} onClick={() => selecionar(a.id)}
                className={`w-full text-left p-2 rounded-md border transition-all flex flex-col gap-0.5 ${sel?.id === a.id ? 'bg-blue-50 border-blue-200' : 'bg-slate-50/50 hover:bg-slate-50 border-slate-150'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">{a.tipo} nº {a.numero}/{a.ano}</span>
                  <span className={`text-[9px] px-1.5 rounded font-bold uppercase border ${corStatus(a.status)}`}>{a.status === 'Ativo' ? 'Vigente' : a.status}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-500 uppercase">{a.sigla}</span>
                <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">"{a.ementa}"</p>
              </button>
            ))}
        </div>
      </div>

      {/* detalhe */}
      <div className="lg:col-span-8 space-y-4">
        {!sel ? (
          <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
            <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" /><p>Selecione um ato.</p>
          </div>
        ) : (
          <>
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-150 pb-3 mb-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded uppercase border border-yellow-200">Órgão: {sel.orgaoEmissor}</span>
                    {sel.processoSei && <span className="text-[10px] font-mono text-slate-400">Processo SEI: {sel.processoSei}</span>}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">{sel.tipoAto} nº {sel.numero}/{sel.ano}</h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">Assinado em: {(sel.dataAssinatura || '').split('-').reverse().join('/')}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${corStatus(sel.status)}`}>{sel.status === 'Ativo' ? 'Vigente' : sel.status}</span>
              </div>

              {auditoria && (
                <div className={`p-3 rounded-lg border flex items-start gap-3 ${auditoria.cor === 'emerald' ? 'bg-emerald-50 border-emerald-200' : auditoria.cor === 'amber' ? 'bg-blue-50 border-blue-200' : 'bg-rose-50 border-rose-200'}`}>
                  <div className="mt-0.5 p-1.5 rounded bg-white/80 shadow-xs">{auditoria.icone}</div>
                  <div className="space-y-0.5">
                    <h5 className="font-bold text-xs uppercase">{auditoria.titulo}</h5>
                    <p className="text-[11px] leading-relaxed text-slate-700 font-medium">{auditoria.desc}</p>
                    {auditoria.causa && (
                      <button onClick={() => selecionar(auditoria.causa!.porId)} className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline flex items-center gap-1 mt-0.5">
                        Ir para o ato {auditoria.cor === 'rose' ? 'revogador' : 'modificador'} ({auditoria.causa.porLabel}) <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-3 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Ementa</span>
                <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-md border border-slate-100 leading-relaxed">{sel.ementa}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* saída */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                <div className="flex items-center gap-1.5 text-[#003366] border-b border-slate-150 pb-2 mb-2.5">
                  <ArrowUpRight className="w-4 h-4 text-indigo-500" /><h4 className="font-bold text-[10px] uppercase">Modificações originadas por este ato</h4>
                </div>
                {(sel.relacoes || []).length === 0 ? <p className="py-6 text-center text-slate-400 text-xs italic">Não menciona alteração/revogação de outras normas.</p>
                  : (sel.relacoes || []).map((r: any, i: number) => (
                    <div key={i} className="bg-slate-50 p-2.5 rounded border border-slate-150/70 text-xs flex flex-col gap-1 mb-2">
                      <div className="flex items-center justify-between">
                        <span className={`px-1.5 rounded text-[9px] font-extrabold uppercase ${corRel(r.tipoRelacao)}`}>{r.tipoRelacao}</span>
                        {r.atoDestinoId ? <button onClick={() => selecionar(r.atoDestinoId)} className="text-[10px] font-bold text-teal-600 hover:underline flex items-center gap-1">Ver vínculo <Eye className="w-3 h-3" /></button>
                          : <span className="text-[9px] text-slate-400 italic">Ato externo</span>}
                      </div>
                      <div className="font-bold text-slate-800 text-[11px]">{r.atoDestino}</div>
                    </div>
                  ))}
              </div>
              {/* entrada */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                <div className="flex items-center gap-1.5 text-[#003366] border-b border-slate-150 pb-2 mb-2.5">
                  <ArrowDownLeft className="w-4 h-4 text-teal-500" /><h4 className="font-bold text-[10px] uppercase">Atos mais recentes que afetam este ato</h4>
                </div>
                {(sel.referenciadoPor || []).length === 0 ? <p className="py-6 text-center text-slate-400 text-xs italic">Íntegro. Nenhuma norma posterior o alterou ou revogou.</p>
                  : (sel.referenciadoPor || []).map((rev: any, i: number) => (
                    <div key={i} className="bg-slate-50 p-2.5 rounded border border-slate-150/70 text-xs flex flex-col gap-1 mb-2">
                      <div className="flex items-center justify-between">
                        <span className={`px-1.5 rounded text-[9px] font-extrabold uppercase border ${corRel(rev.relacao)}`}>{rotuloInverso(rev.relacao)}</span>
                        <button onClick={() => selecionar(rev.porId)} className="text-[10px] font-bold text-teal-600 hover:underline flex items-center gap-1">Ir para origem <Eye className="w-3 h-3" /></button>
                      </div>
                      <div className="font-bold text-slate-800 text-[11px]">{rev.porLabel}</div>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
