import React, { useEffect, useState } from 'react';
import { Clock, Loader2, Info, ExternalLink, Building2, Users, FileText, LogOut } from 'lucide-react';
import * as ds from '../dataSource';

// Aba "Jornada de trabalho": os dois modelos recentes de organização da
// jornada na UFF, ambos registrados no BS —
//   FLEXIBILIZAÇÃO DA JORNADA (30h/turnos contínuos), onda a partir de 2019;
//   PROGRAMA DE GESTÃO / PGD (teletrabalho, IN 65/2020), explode em 2022.
// A história que o gráfico conta: grande adesão à flexibilização no início e,
// com a chegada do PGD, a migração de quase todos os setores para ele.
//
// OS DOIS LADOS SÃO MEDIDOS DIFERENTE, DE PROPÓSITO:
//   FLEX usa status real (Ativo/Revogado) e o grafo de relações REVOGA — cada
//   portaria de flexibilização (entrada) é ligada à portaria que a revogou
//   (saída), se houver. Validado em 17/07/2026 contra planilha independente
//   de RH: 24 de 24 pares corretos (100%, zero divergência) — dá pra confiar
//   nisso pra mostrar adesão × saída de verdade, não só menção.
//   PGD continua por MENÇÃO no texto (busca full-text): o modelo funciona por
//   edital/ciclo recorrente, não por 1-portaria-por-setor-revogada — o padrão
//   de entrada/saída da flexibilização não se aplica. "Servidores" aqui é
//   piso (ato_pessoa é menção; 30-70% dos atos não trazem SIAPE), não censo.

const fmtData = (s: string | null) =>
  s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : '—';

const COR_FLEX = '#f59e0b';   // âmbar — flexibilização
const COR_PGD = '#0b66c3';    // azul — Programa de Gestão

// Combo: barras = setores com ato de PGD por ano; linha = setores ATIVOS na
// flexibilização, acumulado até aquele ano. É o gráfico que conta a história:
// a linha sobe, estabiliza, e cai conforme as barras azuis crescem.
function GraficoJornada({ flex, pgd }: { flex: ds.JornadaLinhaFlex[]; pgd: ds.JornadaLinha[] }) {
  const anos = [...new Set([...flex.map(l => l.ano), ...pgd.map(l => l.ano)])].sort((a, b) => a - b);
  if (!anos.length) return null;
  const vFlexAtivos = new Map(flex.map(l => [l.ano, l.ativos]));
  const vPgd = new Map(pgd.map(l => [l.ano, l.setores]));
  const maxBarra = Math.max(1, ...anos.map(a => vPgd.get(a) || 0));
  const maxLinha = Math.max(1, ...anos.map(a => vFlexAtivos.get(a) || 0));

  const H = 200, PAD_B = 24, PAD_T = 16, PAD_L = 6;
  const passo = 46, barraW = 20;
  const W = anos.length * passo + PAD_L + 10;
  const altBarra = (v: number) => Math.round((v / maxBarra) * (H - PAD_B - PAD_T));
  const yLinha = (v: number) => H - PAD_B - Math.round((v / maxLinha) * (H - PAD_B - PAD_T));

  const pontos = anos.map((ano, i) => {
    const x = PAD_L + i * passo + passo / 2;
    return [x, yLinha(vFlexAtivos.get(ano) || 0)] as const;
  });
  const pathLinha = pontos.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} role="img"
        aria-label="Setores com Programa de Gestão por ano (barras) e setores ativos na flexibilização acumulados (linha)">
        {anos.map((ano, i) => {
          const x0 = PAD_L + i * passo;
          const h = altBarra(vPgd.get(ano) || 0);
          return (
            <g key={ano}>
              {h > 0 && (
                <rect x={x0 + (passo - barraW) / 2} y={H - PAD_B - h} width={barraW} height={h} rx={2} fill={COR_PGD} opacity={0.85}>
                  <title>{`${ano} — Programa de Gestão: ${vPgd.get(ano)} setor(es) com ato`}</title>
                </rect>
              )}
              <text x={x0 + passo / 2} y={H - 7} textAnchor="middle" fontSize={10}
                fill="#64748b" fontWeight={600}>{String(ano).slice(2)}</text>
            </g>
          );
        })}
        <path d={pathLinha} fill="none" stroke={COR_FLEX} strokeWidth={2.5} />
        {pontos.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3.5} fill={COR_FLEX}>
            <title>{`${anos[i]} — Flexibilização ativa em ${vFlexAtivos.get(anos[i])} setor(es)`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

function CartaoFlex({ dados }: { dados: ds.JornadaModeloFlex }) {
  const ativos = dados.setores.filter(s => s.status === 'Ativo').length;
  const saidos = dados.setores.filter(s => s.status !== 'Ativo').length;
  const anos = dados.serie.map(l => l.ano);
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3 flex-1 min-w-[240px]">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COR_FLEX }} />
        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Flexibilização da jornada</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2 text-center">
        <div>
          <div className="text-lg font-bold text-emerald-600">{ativos}</div>
          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><Building2 className="w-3 h-3" /> ativos hoje</div>
        </div>
        <div>
          <div className="text-lg font-bold text-slate-500">{saidos}</div>
          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><LogOut className="w-3 h-3" /> já saíram</div>
        </div>
        <div>
          <div className="text-lg font-bold text-[#003366]">{dados.setores.length}</div>
          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><FileText className="w-3 h-3" /> histórico</div>
        </div>
      </div>
      {!!anos.length && (
        <p className="text-[10px] text-slate-400 text-center mt-1.5">{anos[0]}–{anos[anos.length - 1]}</p>
      )}
    </div>
  );
}

function CartaoPgd({ dados }: { dados: ds.JornadaModelo }) {
  const atos = dados.setores.reduce((s, x) => s + x.atos, 0);
  const servidores = Math.max(...dados.serie.map(l => l.servidores), 0);
  const anos = dados.serie.filter(l => l.atos > 0).map(l => l.ano);
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3 flex-1 min-w-[240px]">
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COR_PGD }} />
        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Programa de Gestão (teletrabalho)</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2 text-center">
        <div>
          <div className="text-lg font-bold text-[#003366]">{dados.setores.length}</div>
          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><Building2 className="w-3 h-3" /> setores</div>
        </div>
        <div>
          <div className="text-lg font-bold text-[#003366]">{atos}</div>
          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><FileText className="w-3 h-3" /> atos</div>
        </div>
        <div>
          <div className="text-lg font-bold text-[#003366]">{servidores}</div>
          <div className="text-[10px] text-slate-500 flex items-center justify-center gap-1"><Users className="w-3 h-3" /> servidores*</div>
        </div>
      </div>
      {!!anos.length && (
        <p className="text-[10px] text-slate-400 text-center mt-1.5">{anos[0]}–{anos[anos.length - 1]}</p>
      )}
    </div>
  );
}

function TabelaFlex({ setores }: { setores: ds.JornadaSetorFlex[] }) {
  const [todos, setTodos] = useState(false);
  const lista = todos ? setores : setores.slice(0, 15);
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden flex-1 min-w-[300px]">
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COR_FLEX }} />
        <span className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">
          Flexibilização — setores ({setores.length})
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wider">
              <th className="text-left font-bold px-3 py-1.5">Setor</th>
              <th className="text-left font-bold px-3 py-1.5 whitespace-nowrap">Portaria</th>
              <th className="text-left font-bold px-3 py-1.5">Status</th>
              <th className="text-left font-bold px-3 py-1.5 whitespace-nowrap">Entrada</th>
              <th className="text-left font-bold px-3 py-1.5 whitespace-nowrap">Saída</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((s, i) => (
              <tr key={s.setor + s.numero + i} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-1.5 font-semibold text-slate-700 text-xs max-w-[220px]">{s.setor}</td>
                <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                  {s.link ? (
                    <a href={s.link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold">
                      {s.numero}/{s.ano} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : <span>{s.numero}/{s.ano}</span>}
                </td>
                <td className="px-3 py-1.5 text-xs">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    s.status === 'Ativo'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}>
                    {s.status === 'Ativo' ? 'Ativo' : 'Revogado'}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-slate-500 text-[11px] whitespace-nowrap">{fmtData(s.entrada)}</td>
                <td className="px-3 py-1.5 text-slate-500 text-[11px] whitespace-nowrap">{fmtData(s.saida)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {setores.length > 15 && (
        <button onClick={() => setTodos(v => !v)}
          className="w-full py-1.5 text-[11px] font-bold text-blue-700 hover:bg-slate-50 border-t border-slate-100">
          {todos ? 'Mostrar menos' : `Mostrar todos os ${setores.length} setores`}
        </button>
      )}
    </div>
  );
}

function TabelaPgd({ setores }: { setores: ds.JornadaSetor[] }) {
  const [todos, setTodos] = useState(false);
  const lista = todos ? setores : setores.slice(0, 15);
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden flex-1 min-w-[300px]">
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COR_PGD }} />
        <span className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">
          Programa de Gestão — setores ({setores.length})
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wider">
              <th className="text-left font-bold px-3 py-1.5">Setor</th>
              <th className="text-right font-bold px-3 py-1.5">Atos</th>
              <th className="text-left font-bold px-3 py-1.5 whitespace-nowrap">Primeiro ato</th>
              <th className="text-left font-bold px-3 py-1.5 whitespace-nowrap">Último ato</th>
            </tr>
          </thead>
          <tbody>
            {lista.map(s => (
              <tr key={s.sigla} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-1.5 font-semibold text-slate-700 text-xs">{s.sigla}</td>
                <td className="px-3 py-1.5 text-right text-slate-600 text-xs">{s.atos}</td>
                <td className="px-3 py-1.5 text-slate-500 text-[11px] whitespace-nowrap">{fmtData(s.primeiro)}</td>
                <td className="px-3 py-1.5 text-slate-500 text-[11px] whitespace-nowrap">{fmtData(s.ultimo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {setores.length > 15 && (
        <button onClick={() => setTodos(v => !v)}
          className="w-full py-1.5 text-[11px] font-bold text-blue-700 hover:bg-slate-50 border-t border-slate-100">
          {todos ? 'Mostrar menos' : `Mostrar todos os ${setores.length} setores`}
        </button>
      )}
    </div>
  );
}

export default function JornadaApi() {
  const [r, setR] = useState<ds.JornadaResp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const apiMode = ds.modo() === 'api';

  useEffect(() => {
    if (!apiMode) { setCarregando(false); return; }
    ds.getJornada().then(setR).finally(() => setCarregando(false));
  }, [apiMode]);

  if (!apiMode) {
    return (
      <div className="bg-white p-6 rounded-lg border border-slate-200 text-center">
        <Info className="w-6 h-6 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700">Disponível apenas no modo banco de dados.</p>
        <p className="text-xs text-slate-500 mt-1">
          Este painel agrega o texto completo dos atos no servidor; o modo estático não reproduz essa consulta.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
        <h3 className="text-xs font-bold text-[#003366] flex items-center gap-1.5 uppercase tracking-wider">
          <Clock className="w-4 h-4 text-yellow-500" /> Jornada de trabalho — Flexibilização × Programa de Gestão
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-normal font-medium">
          A UFF adotou dois modelos recentes de organização da jornada, os dois registrados no Boletim: a{' '}
          <a href="https://www.uff.br/progepe/flexibilizacao-da-jornada-de-trabalho/" target="_blank"
            rel="noopener noreferrer" className="text-blue-700 underline font-semibold inline-flex items-center gap-0.5">
            flexibilização da jornada <ExternalLink className="w-3 h-3" />
          </a>{' '}
          (30 horas, turnos contínuos) e o{' '}
          <a href="https://www.uff.br/04-07-2022/voce-tem-duvidas-sobre-o-teletrabalho-e-o-programa-de-gestao-relembre-questoes-importantes/"
            target="_blank" rel="noopener noreferrer" className="text-blue-700 underline font-semibold inline-flex items-center gap-0.5">
            Programa de Gestão / teletrabalho <ExternalLink className="w-3 h-3" />
          </a>. A flexibilização teve grande adesão a partir de 2019; com a chegada do PGD, em 2022,
          boa parte dos setores migrou. O gráfico abaixo mostra esse movimento: barras azuis são setores
          com ato de PGD naquele ano; a linha âmbar é quantos setores estavam com a flexibilização
          ativa (já descontando quem saiu).
        </p>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Agregando atos…
        </div>
      ) : !r ? (
        <div className="bg-white p-6 rounded-lg border border-slate-200 text-center">
          <Info className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">Não foi possível consultar agora.</p>
          <p className="text-xs text-slate-500 mt-1">
            O painel precisa da versão mais recente da API no servidor. Tente novamente em instantes.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-3 flex-wrap">
            <CartaoFlex dados={r.flex} />
            <CartaoPgd dados={r.pgd} />
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">
                Adesão e saída, por ano
              </span>
              <span className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-0.5 inline-block" style={{ background: COR_FLEX }} /> flexibilização ativa (acumulado)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COR_PGD }} /> setores c/ PGD
                </span>
              </span>
            </div>
            <div className="mt-2">
              <GraficoJornada flex={r.flex.serie} pgd={r.pgd.serie} />
            </div>
          </div>

          <div className="flex gap-3 flex-wrap items-start">
            <TabelaFlex setores={r.flex.setores} />
            <TabelaPgd setores={r.pgd.setores} />
          </div>
        </>
      )}

      <p className="text-[11px] text-slate-400 px-1 leading-relaxed">
        <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
        <strong>Como este painel conta.</strong> <strong>Flexibilização</strong>: cada portaria de adesão é ligada, pelo
        grafo de relações do portal, à portaria que a revogou (se houver) — Ativo/Revogado é o status real do ato, não
        estimativa (validado contra planilha independente de RH, 24/24 casos corretos). <strong>Programa de Gestão</strong>:
        por <strong>menção no texto</strong> (busca no corpo completo) — um ato que cita o modelo entra na conta mesmo
        sendo retificação ou desligamento; o modelo funciona por edital recorrente, não por portaria única revogável.
        *"Servidores" do PGD são pessoas citadas nos atos; como parte dos atos do Boletim não registra SIAPE, é um piso,
        não um censo. A fonte oficial é sempre o <strong>Boletim de Serviço da UFF</strong>.
      </p>
    </div>
  );
}
