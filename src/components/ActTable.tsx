import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, Filter, X, Eye, Clipboard, AlertCircle, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, Loader2, Link as LinkIcon
} from 'lucide-react';
import * as ds from '../dataSource';
import { UffAct } from '../types';

// Tabela com paginação/busca/filtros NO SERVIDOR (modo API). Read-only.
export default function ActTable() {
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [orgao, setOrgao] = useState('todos');
  const [ano, setAno] = useState('todos');
  const [status, setStatus] = useState('todos');
  const [nome, setNome] = useState('');
  const [siape, setSiape] = useState('');
  const [soRel, setSoRel] = useState(false);
  const [soSei, setSoSei] = useState(false);
  const [ordenar, setOrdenar] = useState('data_ato');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [pagina, setPagina] = useState(1);

  const [resp, setResp] = useState<ds.ListaResp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<{ tipos: string[]; orgaos: string[]; anos: number[] }>({ tipos: [], orgaos: [], anos: [] });
  const [ficha, setFicha] = useState<UffAct | null>(null);

  const POR = 50;
  useEffect(() => { ds.getFiltros().then(setFiltros); }, []);

  const buscar = useCallback(async () => {
    setCarregando(true);
    const r = await ds.listAtos({
      busca, tipo, orgao, ano, status, nome, siape,
      com_relacoes: soRel, com_sei: soSei, ordenar, dir, pagina, por_pagina: POR,
    });
    setResp(r); setCarregando(false);
  }, [busca, tipo, orgao, ano, status, nome, siape, soRel, soSei, ordenar, dir, pagina]);

  // debounce nas digitações; imediato nos selects/paginação
  const t = useRef<any>(null);
  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(buscar, 300);
    return () => clearTimeout(t.current);
  }, [buscar]);

  // volta para a página 1 quando muda um filtro
  useEffect(() => { setPagina(1); }, [busca, tipo, orgao, ano, status, nome, siape, soRel, soSei]);

  const ordenarPor = (campo: string) => {
    if (ordenar === campo) setDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setOrdenar(campo); setDir('desc'); }
  };
  const seta = (campo: string) => ordenar !== campo ? null : (dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />);
  const limpar = () => { setBusca(''); setTipo('todos'); setOrgao('todos'); setAno('todos'); setStatus('todos'); setNome(''); setSiape(''); setSoRel(false); setSoSei(false); };
  const temFiltro = busca || tipo !== 'todos' || orgao !== 'todos' || ano !== 'todos' || status !== 'todos' || nome || siape || soRel || soSei;

  const corRel = (tp: string) => tp === 'Revoga' ? 'bg-rose-100 text-rose-800 border-rose-200'
    : tp === 'Altera' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-indigo-100 text-indigo-800 border-indigo-200';
  const corStatus = (s: string) => s === 'Ativo' ? 'bg-green-100 text-green-700 border-green-200'
    : s === 'Revogado' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200';

  const total = resp?.total ?? 0;
  const paginas = resp?.paginas ?? 1;

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por número, ementa, processo SEI…"
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:bg-white" />
          {busca && <button onClick={() => setBusca('')} className="absolute right-2.5 top-1.5 p-0.5 hover:bg-slate-200 rounded-full text-slate-400"><X className="w-3 h-3" /></button>}
        </div>
        <div className="flex items-center gap-2.5 flex-wrap bg-slate-50 p-2 rounded-md border border-slate-100 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" /><span className="font-bold text-slate-500">FILTROS:</span>
          <select value={tipo} onChange={e => setTipo(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold">
            <option value="todos">Tipo: Todos</option>{filtros.tipos.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={orgao} onChange={e => setOrgao(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold">
            <option value="todos">Emissor: Todos</option>{filtros.orgaos.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold">
            <option value="todos">Ano: Todos</option>{filtros.anos.map(a => <option key={a} value={String(a)}>{a}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold">
            <option value="todos">Status: Todos</option><option value="Ativo">Vigentes</option><option value="Revogado">Revogados</option><option value="Alterado">Alterados</option>
          </select>
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do servidor…" title="Atos que citam este nome (busca no corpo, inclusive tabelas)"
            className="w-40 bg-white border border-slate-200 rounded px-2 py-1 text-xs" />
          <input value={siape} onChange={e => setSiape(e.target.value)} placeholder="SIAPE…" inputMode="numeric"
            className="w-28 bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono" />
          <button onClick={() => setSoRel(v => !v)} className={`px-2 py-1 rounded text-[11px] font-bold border ${soRel ? 'bg-[#003366] text-white border-[#003366]' : 'bg-white text-slate-600 border-slate-200'}`}>só c/ relações</button>
          <button onClick={() => setSoSei(v => !v)} className={`px-2 py-1 rounded text-[11px] font-bold border ${soSei ? 'bg-[#003366] text-white border-[#003366]' : 'bg-white text-slate-600 border-slate-200'}`}>só c/ SEI</button>
          {temFiltro && <button onClick={limpar} className="ml-auto flex items-center gap-1 text-yellow-600 font-bold text-xs uppercase"><X className="w-3.5 h-3.5" />Limpar</button>}
        </div>
      </div>

      {/* Contagem + paginação topo */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
        <span><strong className="text-slate-700">{total.toLocaleString('pt-BR')}</strong> ato(s){carregando && <Loader2 className="w-3 h-3 inline ml-1 animate-spin" />}</span>
        <Paginacao pagina={pagina} paginas={paginas} setPagina={setPagina} />
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase">
                <th className="py-2 px-2.5 cursor-pointer hover:bg-slate-100" onClick={() => ordenarPor('tipo')}><div className="flex items-center gap-1">Ato / Número {seta('tipo')}</div></th>
                <th className="py-2 px-2.5 w-24 cursor-pointer hover:bg-slate-100" onClick={() => ordenarPor('data_ato')}><div className="flex items-center gap-1">Data {seta('data_ato')}</div></th>
                <th className="py-2 px-2.5 w-28 cursor-pointer hover:bg-slate-100" onClick={() => ordenarPor('sigla')}><div className="flex items-center gap-1">Emissor {seta('sigla')}</div></th>
                <th className="py-2 px-2.5">Ementa</th>
                <th className="py-2 px-2.5 w-36">Relações</th>
                <th className="py-2 px-2.5 w-44">Processo SEI</th>
                <th className="py-2 px-2.5 w-24 text-center cursor-pointer hover:bg-slate-100" onClick={() => ordenarPor('status')}><div className="flex items-center justify-center gap-1">Status {seta('status')}</div></th>
                <th className="py-2 px-2.5 w-14 text-center">Ver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {!resp || resp.atos.length === 0 ? (
                <tr><td colSpan={8} className="py-8 text-center text-slate-400">
                  <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                  <p className="font-semibold text-slate-500">{carregando ? 'Carregando…' : 'Nenhum ato encontrado.'}</p>
                </td></tr>
              ) : resp.atos.map(a => (
                <tr key={a.id} className={`hover:bg-blue-50/40 ${a.status === 'Revogado' ? 'text-slate-400' : ''}`}>
                  <td className="py-1.5 px-2.5">
                    <div className="font-bold text-slate-900 leading-tight">{a.tipo}</div>
                    <div className="text-[10px] font-mono font-bold text-blue-800 bg-blue-50 px-1 rounded border border-blue-100 inline-block mt-0.5">nº {a.numero}/{a.ano}</div>
                  </td>
                  <td className="py-1.5 px-2.5 whitespace-nowrap text-[11px] font-mono text-slate-600">{(a.dataAssinatura || '').split('-').reverse().join('/')}</td>
                  <td className="py-1.5 px-2.5 font-bold text-slate-700 text-[11px] uppercase">{a.sigla}</td>
                  <td className="py-1.5 px-2.5"><div className="line-clamp-2 text-[11px] leading-normal" title={a.ementa}>{a.ementa}</div></td>
                  <td className="py-1.5 px-2.5">
                    {a.relTipos.length === 0 && a.refCount === 0 ? <span className="text-slate-300 text-[11px]">—</span> : (
                      <button onClick={() => abrir(a.id)} className="flex flex-wrap items-center gap-1 cursor-pointer hover:opacity-70 text-left">
                        {a.relTipos.map((tp, i) => <span key={i} className={`px-1.5 rounded text-[9px] font-extrabold uppercase border ${corRel(tp)}`}>{tp}</span>)}
                        {a.refCount > 0 && <span className="px-1.5 rounded text-[9px] font-extrabold border bg-slate-100 text-slate-600 border-slate-200">↩ {a.refCount}</span>}
                      </button>
                    )}
                  </td>
                  <td className="py-1.5 px-2.5 text-[11px] font-mono">
                    {a.processoSei ? <span className="font-bold text-blue-950 bg-blue-50/50 border border-blue-100 px-1.5 py-0.5 rounded">{a.processoSei}</span> : <span className="text-slate-400 italic text-[10px]">Não vinculado</span>}
                  </td>
                  <td className="py-1.5 px-2.5 text-center"><span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${corStatus(a.status)}`}>{a.status === 'Ativo' ? 'Vigente' : a.status}</span></td>
                  <td className="py-1.5 px-2.5 text-center"><button onClick={() => abrir(a.id)} className="p-1 bg-slate-50 hover:bg-blue-100 text-[#003366] rounded border border-slate-200"><Eye className="w-3 h-3" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end"><Paginacao pagina={pagina} paginas={paginas} setPagina={setPagina} /></div>

      {ficha && <Ficha ato={ficha} abrir={abrir} fechar={() => setFicha(null)} corRel={corRel} corStatus={corStatus} setSiape={(s) => { setFicha(null); setNome(''); setSiape(s); }} />}
    </div>
  );

  function abrir(id: string) { ds.getAto(id).then(a => { if (a) setFicha(a); }); }
}

function Paginacao({ pagina, paginas, setPagina }: { pagina: number; paginas: number; setPagina: (n: number) => void }) {
  if (paginas <= 1) return null;
  return (
    <div className="flex items-center gap-1.5">
      <button disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)} className="p-1 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"><ChevronLeft className="w-3.5 h-3.5" /></button>
      <span className="font-semibold text-slate-600">pág. {pagina} / {paginas}</span>
      <button disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)} className="p-1 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50"><ChevronRight className="w-3.5 h-3.5" /></button>
    </div>
  );
}

// ----- Ficha (modal) -------------------------------------------------------
function Ficha({ ato, abrir, fechar, corRel, corStatus, setSiape }: any) {
  const data = (ato.dataAssinatura || '').split('-').reverse().join('/');
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" onClick={fechar}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-[#0A2540] text-white p-5 rounded-t-2xl flex items-center justify-between">
          <div><span className="text-xs font-bold uppercase tracking-widest text-[#009485]">Ficha do Ato Indexado</span>
            <h3 className="text-lg font-semibold mt-1">{ato.tipoAto} nº {ato.numero}/{ato.ano}</h3></div>
          <button onClick={fechar} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-5 text-sm text-slate-700">
          <div className="grid grid-cols-2 gap-4">
            <Box t="Órgão Emissor" v={ato.orgaoEmissor} />
            <Box t="Data de Assinatura" v={data} mono />
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="text-xs text-slate-400 font-medium uppercase">Processo / Documento SEI</div>
              <div className="font-mono font-bold mt-0.5">{ato.processoSei || <span className="text-slate-400 italic font-normal">Não vinculado</span>}</div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {ato.linkSeiProcesso && <a href={ato.linkSeiProcesso} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold bg-[#003366] text-white px-2 py-1 rounded no-underline">🔎 Abrir processo no SEI</a>}
                {ato.linkSeiDocumento && <a href={ato.linkSeiDocumento} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold bg-blue-700 text-white px-2 py-1 rounded no-underline">📄 Documento {ato.seiDocumento || ''}</a>}
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="text-xs text-slate-400 font-medium uppercase">Status da Vigência</div>
              <div className="mt-0.5"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold border ${corStatus(ato.status)}`}>{ato.status}</span></div>
            </div>
          </div>

          {(ato.pessoas?.length || ato.siapes?.length || 0) > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-slate-400 font-semibold uppercase block">Pessoas citadas ({ato.pessoas?.length || ato.siapes?.length})</span>
              <div className="flex flex-wrap gap-1.5">
                {ato.pessoas?.length
                  ? ato.pessoas.map((p, i) => (
                      <button key={i} onClick={() => setSiape(p.siape)} title="Filtrar pelos atos desta matrícula"
                        className="text-[11px] bg-slate-100 hover:bg-blue-100 border border-slate-200 px-2 py-0.5 rounded">
                        {p.nome && <span className="font-medium text-slate-700">{p.nome} · </span>}
                        <span className="font-mono text-slate-500">{p.siape}</span>
                      </button>
                    ))
                  : ato.siapes!.map((s: string, i: number) => (
                      <button key={i} onClick={() => setSiape(s)}
                        className="font-mono text-[11px] bg-slate-100 hover:bg-blue-100 border border-slate-200 px-2 py-0.5 rounded">{s}</button>
                    ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            {ato.ementaInferida ? (
              <span className="text-xs font-semibold uppercase block text-amber-600">
                Resumo automático
                <span className="ml-2 normal-case font-normal text-[10px] text-amber-500">gerado do texto do ato — não é a ementa oficial</span>
              </span>
            ) : (
              <span className="text-xs text-slate-400 font-semibold uppercase block">Ementa Oficial</span>
            )}
            <div className={`p-4 rounded-xl border text-xs italic leading-relaxed ${ato.ementaInferida ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-100'}`}>"{ato.ementa}"</div>
          </div>

          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-semibold uppercase block">Este ato refere-se a → ({(ato.relacoes || []).length})</span>
            {(ato.relacoes || []).length === 0 ? <p className="text-xs text-slate-400 italic">Nenhuma referência a outros atos.</p> :
              (ato.relacoes).map((r: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${corRel(r.tipoRelacao)}`}>{r.tipoRelacao}</span>
                  {r.atoDestinoId ? <button onClick={() => abrir(r.atoDestinoId)} className="font-semibold text-blue-800 hover:text-blue-950 underline decoration-dotted text-left">{r.atoDestino}</button>
                    : <span className="font-semibold text-slate-900">{r.atoDestino} <span className="text-slate-400 italic font-normal">(ato externo)</span></span>}
                </div>
              ))}
          </div>

          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-semibold uppercase block">← Referenciado por ({(ato.referenciadoPor || []).length})</span>
            {(ato.referenciadoPor || []).length === 0 ? <p className="text-xs text-slate-400 italic">Nenhum ato posterior altera ou revoga este.</p> :
              (ato.referenciadoPor).map((rev: any, i: number) => (
                <div key={i} className="flex items-start gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${corRel(rev.relacao)}`}>{rev.relacao === 'Revoga' ? 'Revogado por' : rev.relacao === 'Altera' ? 'Alterado por' : 'Referenciado por'}</span>
                  <button onClick={() => abrir(rev.porId)} className="font-semibold text-blue-800 hover:text-blue-950 underline decoration-dotted text-left">{rev.porLabel}</button>
                </div>
              ))}
          </div>

          {ato.linkBoletim && <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">Publicado em: <strong>{ato.numero ? `BS` : ''}</strong> <a href={ato.linkBoletim} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline inline-flex items-center gap-0.5">Acessar Boletim (PDF) <LinkIcon className="w-2.5 h-2.5" /></a></div>}
        </div>
      </div>
    </div>
  );
}
function Box({ t, v, mono }: { t: string; v: any; mono?: boolean }) {
  return <div className="bg-slate-50 p-3 rounded-lg border border-slate-100"><div className="text-xs text-slate-400 font-medium uppercase">{t}</div><div className={`font-bold text-slate-900 mt-0.5 ${mono ? 'font-mono' : ''}`}>{v || '—'}</div></div>;
}
