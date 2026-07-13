import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Printer, Search, Loader2, Info, AlertTriangle, ExternalLink, Clock, Users, Scale } from 'lucide-react';
import * as ds from '../dataSource';

// Aba "Prazos": radar de datas-limite extraídas do texto dos atos (inscrições,
// recursos, entregas, prazos de contrato, validades). Heurística assistiva —
// cada prazo mostra o TRECHO que o originou e um "confira o ato". A extração
// vive no dataSource (mesma lógica no modo banco e estático).

const HOJE = new Date().toISOString().slice(0, 10);
const diasAte = (dl: string) => Math.round((new Date(dl + 'T00:00:00Z').getTime() - new Date(HOJE + 'T00:00:00Z').getTime()) / 86400000);
const fmtBR = (s: string) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : '—');
const contagem = (n: number) => n < 0 ? `venceu há ${-n} dia${n === -1 ? '' : 's'}` : n === 0 ? 'vence hoje' : n === 1 ? 'vence amanhã' : `faltam ${n} dias`;

// urgência (cor + rótulo, nunca só cor)
type Urg = 'vencido' | 'semana' | 'mes' | 'trimestre' | 'adiante';
const urgDe = (d: number): Urg => d < 0 ? 'vencido' : d <= 7 ? 'semana' : d <= 30 ? 'mes' : d <= 90 ? 'trimestre' : 'adiante';
const URG: Record<Urg, { rotulo: string; card: string; ponto: string; texto: string }> = {
  semana:    { rotulo: 'Esta semana',      card: 'border-l-red-500',    ponto: '#d03b3b', texto: 'text-red-700' },
  mes:       { rotulo: 'Próximos 30 dias', card: 'border-l-amber-500',  ponto: '#e0932a', texto: 'text-amber-700' },
  trimestre: { rotulo: 'Próximos 90 dias', card: 'border-l-blue-500',   ponto: '#3266ad', texto: 'text-blue-700' },
  adiante:   { rotulo: 'Mais adiante',     card: 'border-l-slate-400',  ponto: '#8a93a3', texto: 'text-slate-600' },
  vencido:   { rotulo: 'Vencidos',         card: 'border-l-slate-300',  ponto: '#b6bcc7', texto: 'text-slate-500' },
};
// prazos disciplinares (PAD/Sindicância Investigativa): categoria de ALTA
// confiança, extração estruturada por lei — distinta dos prazos heurísticos.
const ehPadSinve = (p: ds.Prazo) => p.base === 'PAD_SINVE';
// rótulo legível do tipo (o banco guarda códigos: PAD, PAD_SUMARIO, SINVE)
const rotuloTipo = (t: string) =>
  t === 'PAD_SUMARIO' ? 'PAD Sumário'
  : t === 'SINVE' ? 'Sindicância Investigativa'
  : t;
const corTipo = (t: string) =>
  /^(PAD|SINVE)/.test(t) ? 'bg-rose-50 text-rose-700 border-rose-200'
  : /inscri/.test(t) ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
  : /recurso/.test(t) ? 'bg-purple-50 text-purple-700 border-purple-200'
  : /entrega/.test(t) ? 'bg-teal-50 text-teal-700 border-teal-200'
  : /vigência/.test(t) ? 'bg-amber-50 text-amber-700 border-amber-200'
  : 'bg-slate-100 text-slate-600 border-slate-200';
// cor do chip de PÚBLICO (para quem serve o prazo)
const corPublico = (p: string) =>
  /comiss/i.test(p) ? 'bg-rose-100 text-rose-800 border-rose-200'
  : /candidat/i.test(p) ? 'bg-blue-100 text-blue-800 border-blue-200'
  : /discente/i.test(p) ? 'bg-teal-100 text-teal-800 border-teal-200'
  : /docente/i.test(p) ? 'bg-purple-100 text-purple-800 border-purple-200'
  : /fornecedor/i.test(p) ? 'bg-amber-100 text-amber-800 border-amber-200'
  : /eleição/i.test(p) ? 'bg-rose-100 text-rose-800 border-rose-200'
  : /servidor/i.test(p) ? 'bg-slate-200 text-slate-700 border-slate-300'
  : 'bg-slate-100 text-slate-600 border-slate-200';
const ementaLimpa = (e: string) => {
  const t = (e || '').trim();
  return !t || /^\(sem ementa/i.test(t) ? '' : t;
};

const JANELAS = [
  { k: '7', rot: 'Esta semana' }, { k: '30', rot: '30 dias' }, { k: '90', rot: '90 dias' },
  { k: 'fut', rot: 'Todos os futuros' }, { k: 'all', rot: 'Incluir vencidos' },
] as const;

export default function PrazosApi() {
  const [lista, setLista] = useState<ds.Prazo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [janela, setJanela] = useState<string>('fut');   // padrão: todos os futuros (não esconder prazos > 90 dias)
  const [cat, setCat] = useState<'todos' | 'padsinve' | 'gerais'>('todos');
  const [tipo, setTipo] = useState('todos');
  const [pub, setPub] = useState('todos');
  const [soAlta, setSoAlta] = useState(false);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    let vivo = true;
    ds.getPrazos().then(r => { if (vivo) setLista(r); }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, []);

  const tipos = useMemo(() => Array.from(new Set(lista.map(p => p.tipo.replace(/\s*\(.*/, '')))).sort(), [lista]);
  // públicos disponíveis, agrupados pela família (antes do "·") p/ o filtro
  const publicos = useMemo(() => Array.from(new Set(lista.map(p => p.publico.split(' · ')[0]))).sort(), [lista]);
  const temPadSinve = useMemo(() => lista.some(ehPadSinve), [lista]);

  const filtrada = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return lista.filter(p => {
      const d = diasAte(p.dataLimite);
      if (janela === '7' && (d < 0 || d > 7)) return false;
      if (janela === '30' && (d < 0 || d > 30)) return false;
      if (janela === '90' && (d < 0 || d > 90)) return false;
      if (janela === 'fut' && d < 0) return false;
      // 'all' = tudo
      if (cat === 'padsinve' && !ehPadSinve(p)) return false;
      if (cat === 'gerais' && ehPadSinve(p)) return false;
      if (tipo !== 'todos' && !p.tipo.startsWith(tipo)) return false;
      if (pub !== 'todos' && !p.publico.startsWith(pub)) return false;
      if (soAlta && (p.conf || '').toLowerCase() !== 'alta') return false;
      if (q && !`${p.atoLabel} ${p.sigla} ${p.textoOrigem} ${p.tipo} ${p.publico} ${p.ementa}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lista, janela, cat, tipo, pub, soAlta, busca]);

  // agrupa por urgência, na ordem
  const grupos = useMemo(() => {
    const ordem: Urg[] = ['semana', 'mes', 'trimestre', 'adiante', 'vencido'];
    const g: Record<Urg, ds.Prazo[]> = { semana: [], mes: [], trimestre: [], adiante: [], vencido: [] };
    for (const p of filtrada) g[urgDe(diasAte(p.dataLimite))].push(p);
    return ordem.map(u => ({ u, itens: g[u] })).filter(x => x.itens.length);
  }, [filtrada]);

  const kpis = useMemo(() => {
    const fut = lista.filter(p => diasAte(p.dataLimite) >= 0);
    return {
      semana: fut.filter(p => diasAte(p.dataLimite) <= 7).length,
      mes: fut.filter(p => { const d = diasAte(p.dataLimite); return d >= 0 && d <= 30; }).length,
      futuros: fut.length,
    };
  }, [lista]);

  const imprimir = () => {
    const esc = (s: string) => (s || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] as string));
    const secoes = grupos.map(({ u, itens }) => {
      const linhas = itens.map(p => {
        const d = diasAte(p.dataLimite);
        const em = ementaLimpa(p.ementa);
        return `<tr><td class="dt">${fmtBR(p.dataLimite)}</td><td>${esc(contagem(d))}</td>` +
          `<td><b>${esc(p.publico)}</b></td><td>${esc(rotuloTipo(p.tipo))}</td>` +
          `<td>${esc(p.atoLabel)} <span class="sig">${esc(p.sigla)}</span>${p.mexidoDepois ? ' <b>[revisado depois — confira]</b>' : ''}` +
          `${em ? `<div class="em">${esc(em)}</div>` : ''}</td>` +
          `<td class="org">${esc(p.textoOrigem)}</td></tr>`;
      }).join('');
      return `<h2>${esc(URG[u].rotulo)} (${itens.length})</h2><table><thead><tr><th>Data</th><th>Contagem</th><th>Para quem</th><th>Tipo</th><th>Ato / assunto</th><th>Trecho de origem</th></tr></thead><tbody>${linhas}</tbody></table>`;
    }).join('');
    const html =
      `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>Prazos e Datas-Limite — UFF</title>` +
      `<style>body{font:12px/1.45 Arial,Helvetica,sans-serif;color:#111;margin:22px}` +
      `h1{font-size:17px;margin:0 0 2px}.sub{color:#555;font-size:11px;margin:0 0 14px}` +
      `h2{font-size:13px;margin:16px 0 5px;border-bottom:2px solid #003366;padding-bottom:2px;color:#003366}` +
      `table{border-collapse:collapse;width:100%;margin-bottom:6px}th,td{border:1px solid #c4c9d2;padding:4px 6px;text-align:left;vertical-align:top}` +
      `th{background:#003366;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.03em}` +
      `td.dt{white-space:nowrap;font-weight:bold}td.org{color:#444;font-size:10px}.sig{color:#666}.em{color:#333;font-size:10px;margin-top:2px}` +
      `tr:nth-child(even) td{background:#f3f5f8}@media print{@page{margin:12mm}}</style></head><body>` +
      `<h1>Prazos e Datas-Limite — UFF</h1>` +
      `<p class="sub">Radar assistivo · extraído automaticamente do texto dos atos · ${filtrada.length} prazo(s) · ` +
      `gerado em ${fmtBR(HOJE)}. Sempre confira o ato de origem — datas podem ter sido alteradas por ato posterior.</p>` +
      secoes + `<script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    else alert('Permita pop-ups para gerar o PDF, ou use Ctrl+P nesta página.');
  };

  return (
    <div id="painel-prazos" className="space-y-3">
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-xs font-bold text-[#003366] flex items-center gap-1.5 uppercase tracking-wider">
              <CalendarClock className="w-4 h-4 text-yellow-500" /> Prazos e datas-limite
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-normal font-medium">
              Radar de prazos de <strong>comissões disciplinares (PAD e Sindicância Investigativa)</strong> e de
              <strong> inscrições, recursos, entregas, contratos e validades</strong> detectados no texto dos atos —
              cada prazo mostra <strong>para quem serve</strong>, o assunto e o trecho que o gerou. É um <strong>apoio</strong>: <strong>sempre confira o ato de origem</strong>.
            </p>
          </div>
          <button onClick={imprimir} disabled={!filtrada.length}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#003366] text-white text-xs font-bold hover:bg-[#00264d] disabled:opacity-40 whitespace-nowrap">
            <Printer className="w-4 h-4" /> Imprimir / PDF
          </button>
        </div>

        {/* KPIs de urgência */}
        <div className="grid grid-cols-3 gap-2.5 mt-3">
          <div className="bg-red-50 border border-red-100 rounded-lg p-2.5">
            <div className="text-[10px] font-bold text-red-700 uppercase tracking-wide">Vencem esta semana</div>
            <div className="text-2xl font-bold text-red-700 mt-0.5">{kpis.semana}</div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-2.5">
            <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Próximos 30 dias</div>
            <div className="text-2xl font-bold text-amber-700 mt-0.5">{kpis.mes}</div>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Total de futuros</div>
            <div className="text-2xl font-bold text-slate-800 mt-0.5">{kpis.futuros}</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="flex rounded-md border border-slate-200 overflow-hidden">
            {JANELAS.map(j => (
              <button key={j.k} onClick={() => setJanela(j.k)}
                className={`px-2.5 py-1.5 text-[11px] font-bold border-r border-slate-200 last:border-0 ${janela === j.k ? 'bg-[#003366] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {j.rot}
              </button>
            ))}
          </div>
          {temPadSinve && (
            <div className="flex rounded-md border border-slate-200 overflow-hidden" title="Categoria do prazo">
              {([['todos', 'Todos'], ['padsinve', '⚖ PAD/Sindicância'], ['gerais', 'Gerais']] as const).map(([k, rot]) => (
                <button key={k} onClick={() => setCat(k)}
                  className={`px-2.5 py-1.5 text-[11px] font-bold border-r border-slate-200 last:border-0 ${cat === k ? (k === 'padsinve' ? 'bg-rose-700 text-white' : 'bg-[#003366] text-white') : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {rot}
                </button>
              ))}
            </div>
          )}
          <select value={pub} onChange={e => setPub(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 bg-white font-medium text-slate-700" title="Para quem serve o prazo">
            <option value="todos">Qualquer público</option>
            {publicos.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={tipo} onChange={e => setTipo(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 bg-white font-medium text-slate-700">
            <option value="todos">Todos os tipos</option>
            {tipos.map(t => <option key={t} value={t}>{rotuloTipo(t)}</option>)}
          </select>
          <button onClick={() => setSoAlta(v => !v)}
            className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold border ${soAlta ? 'bg-[#003366] text-white border-[#003366]' : 'bg-white text-slate-600 border-slate-200'}`}>
            só alta confiança
          </button>
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar ato, órgão, trecho…"
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lendo os atos e detectando prazos…
        </div>
      ) : !lista.length ? (
        <Vazio texto="Nenhum prazo detectado no período indexado." />
      ) : (
        <>
          <Linha filtrada={filtrada} janela={janela} />
          {!filtrada.length ? (
            <Vazio texto="Nenhum prazo neste filtro. Tente ampliar a janela (ex.: 90 dias ou Todos os futuros)." />
          ) : (
            <div className="space-y-3">
              {grupos.map(({ u, itens }) => (
                <div key={u}>
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: URG[u].ponto }} />
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{URG[u].rotulo}</h4>
                    <span className="text-[11px] text-slate-400">{itens.length}</span>
                  </div>
                  <div className="space-y-2">
                    {itens.map((p, i) => <div key={p.atoId + p.dataLimite + i}><PrazoCard p={p} /></div>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-slate-400 px-1 leading-relaxed">
        <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
        Detecção <strong>automática</strong> a partir do texto — pode falhar ou classificar errado; use como lembrete, não como fonte oficial.
        Prazos relativos (“a contar da assinatura”) usam a <strong>data do ato</strong> como âncora. O selo{' '}
        <span className="text-amber-700 font-semibold">revisado depois</span> marca atos alterados/revogados por outro posterior — nesses, o prazo pode ter mudado.
      </p>
    </div>
  );
}

// ---- Linha do tempo (próximos N dias) -------------------------------------
function Linha({ filtrada, janela }: { filtrada: ds.Prazo[]; janela: string }) {
  const futuros = filtrada.filter(p => diasAte(p.dataLimite) >= 0);
  if (!futuros.length) return null;
  const span = janela === '7' ? 7 : janela === '30' ? 30 : janela === '90' ? 90 : Math.min(180, Math.max(30, ...futuros.map(p => diasAte(p.dataLimite))));
  const W = 720, H = 74, PADL = 8, PADR = 8, base = 46;
  const x = (d: number) => PADL + (Math.min(d, span) / span) * (W - PADL - PADR);
  const eixo = '#d8dbe1';
  const txt = '#8a93a3';
  // marcas de semana/mês
  const ticks: number[] = [];
  const step = span <= 30 ? 7 : span <= 90 ? 15 : 30;
  for (let d = 0; d <= span; d += step) ticks.push(d);
  return (
    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs overflow-x-auto">
      <div className="text-[11px] text-slate-500 font-semibold mb-1 px-1">Linha do tempo — próximos {span} dias ({futuros.length} prazo{futuros.length === 1 ? '' : 's'})</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img"
        aria-label={`Linha do tempo com ${futuros.length} prazos nos próximos ${span} dias.`}>
        <line x1={PADL} y1={base} x2={W - PADR} y2={base} stroke={eixo} strokeWidth="1.5" />
        {ticks.map((d, i) => (
          <g key={i}>
            <line x1={x(d)} y1={base - 3} x2={x(d)} y2={base + 3} stroke={eixo} strokeWidth="1" />
            <text x={x(d)} y={base + 16} fontSize="9" textAnchor="middle" fill={txt}>{d === 0 ? 'hoje' : `+${d}d`}</text>
          </g>
        ))}
        {futuros.map((p, i) => {
          const d = diasAte(p.dataLimite);
          const u = urgDe(d);
          const jitter = (i % 3) * 7;                     // evita sobreposição vertical
          return (
            <circle key={i} cx={x(d)} cy={base - 8 - jitter} r={4.5} fill={URG[u].ponto} stroke="#fff" strokeWidth="1.5">
              <title>{`${fmtBR(p.dataLimite)} · ${p.publico} · ${p.atoLabel} (${contagem(d)})`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}

// ---- Card de um prazo -----------------------------------------------------
function PrazoCard({ p }: { p: ds.Prazo }) {
  const d = diasAte(p.dataLimite);
  const u = urgDe(d);
  return (
    <div className={`bg-white rounded-lg border border-slate-200 border-l-4 ${URG[u].card} shadow-xs p-3`}>
      <div className="flex items-start gap-3 flex-wrap">
        <div className="text-center shrink-0 w-16">
          <div className="text-lg font-bold text-slate-800 leading-none">{fmtBR(p.dataLimite).slice(0, 5)}</div>
          <div className="text-[10px] text-slate-400">{p.dataLimite.slice(0, 4)}</div>
          <div className={`text-[10px] font-bold mt-1 ${URG[u].texto}`}>{contagem(d)}</div>
        </div>
        <div className="flex-1 min-w-[180px]">
          <div className="flex items-center gap-2 flex-wrap">
            {ehPadSinve(p) && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-rose-600 text-white border-rose-700" title="Prazo de comissão disciplinar — extração estruturada por lei (alta confiança)">
                <Scale className="w-3 h-3" /> Prazo legal
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${corPublico(p.publico)}`}>
              <Users className="w-3 h-3" /> {p.publico}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${corTipo(p.tipo)}`}>{rotuloTipo(p.tipo)}</span>
            {(p.conf || '').toLowerCase() === 'média' && <span className="text-[10px] text-slate-400 italic">confiança média</span>}
            {p.mexidoDepois && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200">
                <AlertTriangle className="w-3 h-3" /> revisado depois
              </span>
            )}
          </div>
          <div className="mt-1 text-sm">
            {p.linkBoletim ? (
              <a href={p.linkBoletim} target="_blank" referrerPolicy="no-referrer" className="text-blue-700 hover:underline font-semibold inline-flex items-center gap-0.5">
                {p.atoLabel} <ExternalLink className="w-3 h-3" />
              </a>
            ) : <span className="font-semibold text-slate-800">{p.atoLabel}</span>}
            <span className="text-slate-400 text-xs"> · {p.sigla}</span>
          </div>
          {ementaLimpa(p.ementa) && (
            <div className="mt-0.5 text-[12px] text-slate-600 leading-snug line-clamp-2" title={p.ementa}>{ementaLimpa(p.ementa)}</div>
          )}
          <div className="mt-1 text-[11px] text-slate-400 leading-snug flex items-start gap-1">
            <Clock className="w-3 h-3 mt-0.5 shrink-0 text-slate-300" />
            <span className="italic">{p.textoOrigem}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="bg-white p-6 rounded-lg border border-slate-200 text-center">
      <Info className="w-6 h-6 text-slate-400 mx-auto mb-2" />
      <p className="text-sm font-semibold text-slate-700">{texto}</p>
    </div>
  );
}
