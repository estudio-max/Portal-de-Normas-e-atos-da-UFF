import React, { useEffect, useMemo, useState } from 'react';
import { Users, Printer, Search, ExternalLink, Loader2, Info } from 'lucide-react';
import * as ds from '../dataSource';

// Aba "Chefias da UFF": relação de titulares (Chefe/Coordenador/Diretor...) por
// setor, projetada das DESIGNAÇÕES/DISPENSAS publicadas no Boletim de Serviço.
// Cada linha é rastreável ao ato de origem e mostra a data (auditável).
export default function ChefiasApi() {
  const [lista, setLista] = useState<ds.Chefia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState('');
  const [busca, setBusca] = useState('');
  const [cargo, setCargo] = useState('todos');

  useEffect(() => {
    let vivo = true;
    ds.getChefias()
      .then(r => { if (vivo) { setLista(r.chefias); setAtualizadoEm(r.atualizadoEm); } })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, []);

  // famílias de cargo p/ o filtro (ignora prefixo Vice-/Sub)
  const cargos = useMemo(() => {
    const fam = (c: string) => c.replace(/^(Vice-|Sub)/i, '');
    return Array.from(new Set(lista.map(c => fam(c.cargo)))).sort();
  }, [lista]);

  const filtrada = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return lista.filter(c => {
      if (cargo !== 'todos' && !c.cargo.toLowerCase().includes(cargo.toLowerCase())) return false;
      if (!q) return true;
      return `${c.unidade} ${c.cargo} ${c.nome || ''} ${c.siape || ''}`.toLowerCase().includes(q);
    });
  }, [lista, busca, cargo]);

  const fmtData = (s: string) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : '—');

  const imprimir = () => {
    const esc = (s: string) => (s || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] as string));
    const linhas = filtrada.map(c =>
      `<tr><td>${esc(c.unidade)}</td><td>${esc(c.cargo)}</td><td>${esc(c.nome || '—')}</td>` +
      `<td>${esc(c.siape || '—')}</td><td>${fmtData(c.desde)}</td><td>${esc(c.atoLabel)}</td></tr>`).join('');
    const html =
      `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>Chefias da UFF</title>` +
      `<style>body{font:13px/1.45 Arial,Helvetica,sans-serif;color:#111;margin:24px}` +
      `h1{font-size:18px;margin:0 0 2px}.sub{color:#555;font-size:12px;margin:0 0 16px}` +
      `table{border-collapse:collapse;width:100%}th,td{border:1px solid #c4c9d2;padding:5px 7px;text-align:left;vertical-align:top}` +
      `th{background:#003366;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.04em}` +
      `tr:nth-child(even) td{background:#f3f5f8}@media print{@page{margin:14mm}}</style></head><body>` +
      `<h1>Chefias da UFF — Relação de titulares</h1>` +
      `<p class="sub">Universidade Federal Fluminense &middot; ${filtrada.length} função(ões) &middot; ` +
      `Fonte: designações no Boletim de Serviço &middot; Gerado em ${fmtData(atualizadoEm)}</p>` +
      `<table><thead><tr><th>Setor / Unidade</th><th>Cargo</th><th>Nome</th><th>SIAPE</th>` +
      `<th>Desde</th><th>Portaria</th></tr></thead><tbody>${linhas}</tbody></table>` +
      `<script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    else alert('Permita pop-ups para gerar o PDF, ou use Ctrl+P nesta página.');
  };

  return (
    <div id="painel-chefias" className="space-y-3">
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-xs font-bold text-[#003366] flex items-center gap-1.5 uppercase tracking-wider">
              <Users className="w-4 h-4 text-yellow-500" /> Chefias da UFF — quem chefia cada setor
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-normal font-medium">
              Titulares de Chefia, Coordenação e Direção, projetados das <strong>designações publicadas no Boletim de Serviço</strong>.
              Vale sempre a designação <strong>mais recente</strong> de cada setor; cada linha é rastreável ao ato de origem.
            </p>
          </div>
          <button
            onClick={imprimir}
            disabled={!filtrada.length}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#003366] text-white text-xs font-bold hover:bg-[#00264d] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Printer className="w-4 h-4" /> Exportar / Imprimir PDF
          </button>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por setor, nome, cargo ou SIAPE…"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <select
            value={cargo}
            onChange={e => setCargo(e.target.value)}
            className="px-3 py-2 text-sm rounded-md border border-slate-300 bg-white font-medium text-slate-700"
          >
            <option value="todos">Todos os cargos</option>
            {cargos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando chefias…
        </div>
      ) : !lista.length ? (
        <div className="bg-white p-6 rounded-lg border border-slate-200 text-center">
          <Info className="w-6 h-6 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">Nenhuma chefia indexada ainda.</p>
          <p className="text-xs text-slate-500 mt-1">
            As chefias são carregadas a partir das designações do Boletim. Importe a base de chefias (ato_funcoes) para vê-las aqui.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span>{filtrada.length} de {lista.length} função(ões)</span>
            <span>Atualizado em {fmtData(atualizadoEm)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wider">
                  <th className="text-left font-bold px-3 py-2">Setor / Unidade</th>
                  <th className="text-left font-bold px-3 py-2">Cargo</th>
                  <th className="text-left font-bold px-3 py-2">Nome</th>
                  <th className="text-left font-bold px-3 py-2 whitespace-nowrap">SIAPE</th>
                  <th className="text-left font-bold px-3 py-2 whitespace-nowrap">Desde</th>
                  <th className="text-left font-bold px-3 py-2">Portaria</th>
                </tr>
              </thead>
              <tbody>
                {filtrada.map((c, i) => (
                  <tr key={c.atoId + c.cargo + c.unidade + i} className="border-t border-slate-100 hover:bg-slate-50 align-top">
                    <td className="px-3 py-2 text-slate-800 font-medium">{c.unidade}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-bold">{c.cargo}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-800">{c.nome || <span className="text-slate-400 italic">não identificado</span>}</td>
                    <td className="px-3 py-2 text-slate-500 font-mono text-xs whitespace-nowrap">{c.siape || '—'}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{fmtData(c.desde)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {c.linkBoletim ? (
                        <a href={c.linkBoletim} target="_blank" referrerPolicy="no-referrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs font-semibold">
                          {c.atoLabel} <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : <span className="text-xs text-slate-500">{c.atoLabel}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-400 px-1 leading-relaxed">
        <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
        A lista cobre os setores com designação registrada no período indexado. Posições cuja última movimentação foi uma
        <strong> dispensa</strong> (sem sucessor publicado) não aparecem. Sempre confira a <strong>data</strong> e a <strong>portaria</strong> de origem.
      </p>
    </div>
  );
}
