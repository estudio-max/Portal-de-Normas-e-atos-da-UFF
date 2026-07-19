import React, { useEffect, useMemo, useState } from 'react';
import { Handshake, Loader2, Info, ExternalLink, Globe2, Search, X } from 'lucide-react';
import * as ds from '../dataSource';

// Aba "Cooperação": acordos, protocolos e cotutelas que a UFF celebra com
// outras instituições. Tudo vem da EMENTA, que nesses atos é muito estruturada:
//   "Dispõe sobre a aprovação do Acordo de Cooperação Internacional celebrado
//    entre a UFF - UFF e a Oslo New University College (Noruega)."
// O servidor já entrega categoria, instituição, país e lat/lon — aqui só filtra
// e desenha.
//
// "Internacional" não é categoria paralela às outras: é qualificador, e muito
// acordo internacional está registrado como "Cooperação Acadêmica … (Espanha)".
// Por isso o mapa usa o PAÍS reconhecido, não a palavra "Internacional".

const fmtData = (s: string | null) =>
  s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : '—';

// Paleta por categoria — estável (indexada pelo nome), pra cor não dançar entre
// renders quando o filtro muda a ordem.
const CORES = ['#0b66c3', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#14b8a6',
               '#f97316', '#6366f1', '#84cc16', '#ec4899', '#06b6d4', '#a3620b',
               '#7c3aed', '#059669', '#dc2626', '#2563eb', '#ca8a04'];
const corDe = (cat: string, todas: string[]) => CORES[Math.max(0, todas.indexOf(cat)) % CORES.length];

// ---- Mapa-múndi ------------------------------------------------------------
// Projeção equiretangular (x = lon, y = lat), a mais simples que permite plotar
// um ponto a partir de lat/lon sem biblioteca. A silhueta dos continentes é
// ESQUEMÁTICA (poucos vértices, feita à mão) — serve para orientar o olho; o
// que é preciso são as bolhas, posicionadas pelo centroide real do país.
const CONTINENTES: [number, number][][] = [
  // [lon, lat]
  [[-168,65],[-160,71],[-140,70],[-125,70],[-110,68],[-95,70],[-85,70],[-75,68],[-60,58],
   [-55,50],[-65,45],[-70,42],[-75,35],[-81,25],[-90,29],[-97,26],[-105,20],[-115,30],
   [-125,40],[-125,48],[-135,58],[-150,60]],                                     // Am. do Norte
  [[-92,17],[-84,15],[-78,9],[-77,8],[-83,9],[-88,15]],                          // Am. Central
  [[-81,-4],[-75,10],[-60,12],[-52,5],[-35,-5],[-38,-13],[-48,-25],[-58,-34],[-62,-40],
   [-65,-45],[-68,-53],[-75,-50],[-73,-40],[-71,-30],[-70,-18],[-77,-12]],       // Am. do Sul
  [[-17,15],[-10,28],[0,35],[10,37],[25,32],[35,31],[43,12],[51,12],[42,-2],[40,-15],
   [35,-25],[25,-34],[18,-34],[12,-18],[9,4],[-8,5]],                            // África
  [[-10,36],[-9,44],[-2,49],[2,51],[8,54],[12,55],[18,55],[30,60],[30,70],[20,70],
   [10,63],[5,58],[-5,50],[-10,43]],                                             // Europa
  [[30,70],[60,72],[100,77],[140,72],[160,68],[170,60],[145,45],[135,35],[122,30],
   [120,22],[105,10],[95,5],[80,8],[70,20],[60,25],[50,28],[45,40],[40,42],[30,45],[28,55]], // Ásia
  [[113,-22],[130,-12],[142,-11],[150,-25],[153,-28],[147,-38],[140,-38],[135,-35],
   [125,-33],[115,-34]],                                                          // Oceania
];

function MapaMundi({ paises, selecionado, aoSelecionar }: {
  paises: ds.CoopPais[]; selecionado: string; aoSelecionar: (p: string) => void;
}) {
  const W = 760, H = 380;
  const px = (lon: number) => ((lon + 180) / 360) * W;
  const py = (lat: number) => ((90 - lat) / 180) * H;
  const max = Math.max(1, ...paises.map(p => p.n));
  const raio = (n: number) => 4 + Math.sqrt(n / max) * 16;

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} role="img"
        aria-label={`Mapa-múndi com ${paises.length} países parceiros da UFF.`}
        className="min-w-[560px]">
        <rect x={0} y={0} width={W} height={H} fill="#f1f5f9" rx={6} />
        {/* graticule discreto */}
        {[-120, -60, 0, 60, 120].map(l => (
          <line key={`v${l}`} x1={px(l)} y1={0} x2={px(l)} y2={H} stroke="#e2e8f0" strokeWidth={1} />
        ))}
        {[-60, -30, 0, 30, 60].map(l => (
          <line key={`h${l}`} x1={0} y1={py(l)} x2={W} y2={py(l)}
            stroke={l === 0 ? '#cbd5e1' : '#e2e8f0'} strokeWidth={l === 0 ? 1.2 : 1} />
        ))}
        {CONTINENTES.map((poly, i) => (
          <polygon key={i} fill="#cfd8e3" stroke="#b6c2d1" strokeWidth={0.8}
            points={poly.map(([lon, lat]) => `${px(lon)},${py(lat)}`).join(' ')} />
        ))}
        {paises.map(p => {
          const ativo = !selecionado || selecionado === p.pais;
          return (
            <g key={p.pais} onClick={() => aoSelecionar(selecionado === p.pais ? '' : p.pais)}
              style={{ cursor: 'pointer' }}>
              <circle cx={px(p.lon)} cy={py(p.lat)} r={raio(p.n)}
                fill={selecionado === p.pais ? '#b45309' : '#f59e0b'}
                fillOpacity={ativo ? 0.75 : 0.18}
                stroke="#fff" strokeWidth={1.2} />
              <title>{`${p.pais} — ${p.n} acordo(s)`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---- Gráfico: acordos por ano, empilhado por categoria ----------------------
function GraficoCategorias({ serie, cats }: { serie: ds.CoopSerieAno[]; cats: string[] }) {
  if (!serie.length) return null;
  const H = 220, PAD_B = 26, PAD_T = 12, PAD_L = 6;
  const passo = Math.max(22, Math.min(46, Math.floor(900 / serie.length)));
  const barraW = Math.max(8, passo - 10);
  const W = serie.length * passo + PAD_L + 10;
  const max = Math.max(1, ...serie.map(l => l.total));
  const alt = (v: number) => Math.round((v / max) * (H - PAD_B - PAD_T));

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} role="img"
        aria-label="Acordos de cooperação por ano, empilhados por categoria.">
        {serie.map((l, i) => {
          const x0 = PAD_L + i * passo;
          let acc = 0;
          return (
            <g key={l.ano}>
              {cats.filter(c => l.categorias[c]).map(c => {
                const h = alt(l.categorias[c]);
                const y = H - PAD_B - acc - h;
                acc += h;
                return (
                  <rect key={c} x={x0 + (passo - barraW) / 2} y={y} width={barraW} height={h}
                    fill={corDe(c, cats)} opacity={0.9}>
                    <title>{`${l.ano} — ${c}: ${l.categorias[c]}`}</title>
                  </rect>
                );
              })}
              <text x={x0 + passo / 2} y={H - 9} textAnchor="middle" fontSize={10}
                fill="#64748b" fontWeight={600}>{String(l.ano).slice(2)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function CooperacaoApi() {
  const [r, setR] = useState<ds.CoopResp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [cat, setCat] = useState('');
  const [pais, setPais] = useState('');
  const [busca, setBusca] = useState('');
  const [ano, setAno] = useState('');
  const [todos, setTodos] = useState(false);
  const apiMode = ds.modo() === 'api';

  useEffect(() => {
    if (!apiMode) { setCarregando(false); return; }
    ds.getCooperacao().then(setR).finally(() => setCarregando(false));
  }, [apiMode]);

  const cats = useMemo(() => (r?.categorias ?? []).map(c => c.categoria), [r]);
  const anos = useMemo<number[]>(
    () => Array.from(new Set<number>((r?.acordos ?? []).map(a => a.ano))).sort((a, b) => b - a), [r]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return (r?.acordos ?? []).filter(a => {
      if (cat && a.categoria !== cat) return false;
      if (pais && a.pais !== pais) return false;
      if (ano && String(a.ano) !== ano) return false;
      if (q && !`${a.instituicao} ${a.pais} ${a.ementa} ${a.numero}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [r, cat, pais, ano, busca]);

  // O mapa reflete os filtros ativos (menos o próprio país), pra clicar num país
  // não esvaziar o mapa.
  const paisesFiltrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    const conta = new Map<string, number>();
    for (const a of (r?.acordos ?? [])) {
      if (!a.pais || a.lat === null || a.lon === null) continue;
      if (cat && a.categoria !== cat) continue;
      if (ano && String(a.ano) !== ano) continue;
      if (q && !`${a.instituicao} ${a.pais} ${a.ementa} ${a.numero}`.toLowerCase().includes(q)) continue;
      conta.set(a.pais, (conta.get(a.pais) ?? 0) + 1);
    }
    return (r?.paises ?? []).filter(p => conta.has(p.pais))
      .map(p => ({ ...p, n: conta.get(p.pais) as number }));
  }, [r, cat, ano, busca]);

  const internacionais = useMemo(() => filtrados.filter(a => a.pais).length, [filtrados]);
  const limpar = () => { setCat(''); setPais(''); setBusca(''); setAno(''); };
  const temFiltro = !!(cat || pais || busca || ano);

  if (!apiMode) {
    return (
      <div className="bg-white p-6 rounded-lg border border-slate-200 text-center">
        <Info className="w-6 h-6 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700">Disponível apenas no modo banco de dados.</p>
        <p className="text-xs text-slate-500 mt-1">
          Este painel agrega as ementas no servidor; o modo estático não reproduz essa consulta.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
        <h3 className="text-xs font-bold text-[#003366] flex items-center gap-1.5 uppercase tracking-wider">
          <Handshake className="w-4 h-4 text-yellow-500" /> Cooperação — acordos, protocolos e cotutelas
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-normal font-medium">
          Acordos que a UFF celebra com outras instituições, extraídos da ementa do ato: a{' '}
          <strong>categoria</strong> do acordo, a <strong>instituição parceira</strong> e, quando
          internacional, o <strong>país</strong>. Os acordos acadêmicos passam por um conselho
          (normalmente <strong>CEPEx</strong> ou <strong>CUV</strong>), que os aprova ou ratifica.
        </p>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Lendo as ementas dos acordos…
        </div>
      ) : !r ? (
        <div className="bg-white p-6 rounded-lg border border-slate-200 text-center">
          <Info className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">Não foi possível consultar agora.</p>
          <p className="text-xs text-slate-500 mt-1">
            O painel precisa da versão mais recente da API no servidor.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <Cartao valor={r.acordos.length} rotulo="acordos indexados" cor="text-[#003366]" />
            <Cartao valor={r.categorias.length} rotulo="categorias" cor="text-[#003366]" />
            <Cartao valor={r.paises.length} rotulo="países parceiros" cor="text-amber-600" />
            <Cartao valor={filtrados.length} rotulo="no filtro atual" cor="text-emerald-600" />
          </div>

          {/* Filtros */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar instituição, país, nº do ato…"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <select value={cat} onChange={e => setCat(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 bg-white font-medium text-slate-700">
              <option value="">Todas as categorias</option>
              {r.categorias.map(c => <option key={c.categoria} value={c.categoria}>{c.categoria} ({c.n})</option>)}
            </select>
            <select value={pais} onChange={e => setPais(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 bg-white font-medium text-slate-700">
              <option value="">Todos os países</option>
              {r.paises.map(p => <option key={p.pais} value={p.pais}>{p.pais} ({p.n})</option>)}
            </select>
            <select value={ano} onChange={e => setAno(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 bg-white font-medium text-slate-700">
              <option value="">Todos os anos</option>
              {anos.map(a => <option key={a} value={String(a)}>{a}</option>)}
            </select>
            {temFiltro && (
              <button onClick={limpar}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold border bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200">
                <X className="w-3.5 h-3.5" /> limpar
              </button>
            )}
          </div>

          {/* Mapa */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <span className="text-[11px] text-slate-600 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Globe2 className="w-4 h-4 text-amber-500" /> Onde estão as instituições parceiras
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {internacionais} acordo(s) com país identificado · clique numa bolha para filtrar
              </span>
            </div>
            <MapaMundi paises={paisesFiltrados} selecionado={pais} aoSelecionar={setPais} />
            <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">
              A silhueta dos continentes é <strong>esquemática</strong> (serve para orientar o olho);
              as bolhas usam o centroide real do país e o tamanho é proporcional ao nº de acordos.
            </p>
          </div>

          {/* Gráfico por ano/categoria */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3">
            <span className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">
              Acordos por ano, por categoria
            </span>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 mb-1">
              {cats.map(c => (
                <span key={c} className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: corDe(c, cats) }} />
                  {c}
                </span>
              ))}
            </div>
            <GraficoCategorias serie={r.serie} cats={cats} />
          </div>

          {/* Tabela */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
              <span className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">
                Acordos ({filtrados.length})
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wider">
                    <th className="text-left font-bold px-3 py-1.5">Instituição</th>
                    <th className="text-left font-bold px-3 py-1.5">País</th>
                    <th className="text-left font-bold px-3 py-1.5">Categoria</th>
                    <th className="text-left font-bold px-3 py-1.5 whitespace-nowrap">Ato</th>
                    <th className="text-left font-bold px-3 py-1.5 whitespace-nowrap">Ano</th>
                  </tr>
                </thead>
                <tbody>
                  {(todos ? filtrados : filtrados.slice(0, 40)).map((a, i) => (
                    <tr key={a.id + i} className="border-t border-slate-100 hover:bg-slate-50 align-top">
                      <td className="px-3 py-1.5 text-xs font-semibold text-slate-700 max-w-[300px]">
                        {a.instituicao || <span className="text-slate-400 font-normal">(não identificada)</span>}
                        <div className="text-[10px] text-slate-400 font-normal line-clamp-1" title={a.ementa}>{a.ementa}</div>
                      </td>
                      <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                        {a.pais ? <span className="text-slate-600">{a.pais}</span>
                                : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-1.5 text-xs">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                          style={{ background: corDe(a.categoria, cats) }}>{a.categoria}</span>
                      </td>
                      <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                        {a.link ? (
                          <a href={a.link} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold">
                            {a.numero} <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : <span className="font-semibold">{a.numero}</span>}
                        <div className="text-[10px] text-slate-400">{a.sigla}</div>
                      </td>
                      <td className="px-3 py-1.5 text-slate-500 text-[11px] whitespace-nowrap">
                        {a.ano}<div className="text-[10px] text-slate-400">{fmtData(a.data)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtrados.length > 40 && (
              <button onClick={() => setTodos(v => !v)}
                className="w-full py-1.5 text-[11px] font-bold text-blue-700 hover:bg-slate-50 border-t border-slate-100">
                {todos ? 'Mostrar menos' : `Mostrar todos os ${filtrados.length} acordos`}
              </button>
            )}
          </div>
        </>
      )}

      <p className="text-[11px] text-slate-400 px-1 leading-relaxed">
        <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
        <strong>Como este painel conta.</strong> Categoria, instituição e país são extraídos da{' '}
        <strong>ementa</strong> do ato — que nesses acordos é padronizada. Um acordo só entra se a
        ementa casar uma categoria conhecida (menção solta a "cooperação" fica de fora). O país só é
        aceito se for um país reconhecido, o que descarta sigla entre parênteses. Acordo sem país
        identificado é, em geral, <strong>nacional</strong> — mas pode ser falha de extração.
        A fonte oficial é sempre o <strong>Boletim de Serviço da UFF</strong>.
      </p>
    </div>
  );
}

function Cartao({ valor, rotulo, cor }: { valor: number; rotulo: string; cor: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-2.5 text-center">
      <div className={`text-2xl font-bold ${cor}`}>{valor}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide font-bold">{rotulo}</div>
    </div>
  );
}
