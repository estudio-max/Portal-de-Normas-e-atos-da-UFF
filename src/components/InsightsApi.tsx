import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Loader2, Info, TrendingUp, Sparkles, Building2, CalendarDays, Link2, Users, AlertTriangle, Hourglass, ExternalLink } from 'lucide-react';
import * as ds from '../dataSource';

// Aba "Insights": painéis analíticos sobre o acervo indexado do Boletim de
// Serviço. Tudo é agregação do que já está no banco (nada inventado): ritmo de
// publicação, órgãos mais ativos, cobertura SEI, composição por tipo e vigência.
// Gráficos em SVG/CSS puro (sem dependência). Cores só de modo claro: o modo
// escuro do portal inverte a página inteira (html.fotofobia), então NÃO trocamos
// paleta aqui — deixamos a inversão global cuidar disso (igual aos outros comps).

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function paleta() {
  return {
    bar: '#3266ad', barSei: '#0c447c',
    heat: ['#cde2fb', '#86b6ef', '#3987e5', '#104281'],
    track: '#eceef2',
    tipo: '#1d9e75',
    vig: { ativo: '#1d9e75', alterado: '#2a6fc4', revogado: '#c0392b' },
    col: '#3266ad',
    axis: '#8a93a3', grid: '#e6e8ee',
  };
}

const fmtN = (n: number) => (n ?? 0).toLocaleString('pt-BR');
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
// rótulo de %: evita "0%" enganoso quando há alguns atos (ex.: 11 de 3.000)
const pctTxt = (a: number, b: number) => {
  const p = b > 0 ? (a / b) * 100 : 0;
  return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`;
};
const nomeMes = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${MESES_LONGOS[Number(m) - 1] || m} de ${y}`;
};

export default function InsightsApi() {
  const [data, setData] = useState<ds.Insights | null>(null);
  const [anos, setAnos] = useState<number[]>([]);
  const [ano, setAno] = useState<string>('');       // '' = todos os anos
  const [carregando, setCarregando] = useState(true);
  const [an, setAn] = useState<ds.Analitico | null>(null);   // Fase 2 (cross-ano)
  const autoSel = useRef(false);
  const P = paleta();

  useEffect(() => { ds.getAnalitico().then(setAn).catch(() => setAn(null)); }, []);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    ds.getInsights(ano || undefined)
      .then(r => {
        if (!vivo) return;
        setData(r);
        if (r.anos?.length && !anos.length) setAnos(r.anos);
        // primeira carga: foca no ano mais recente (heatmap de 1 ano é mais legível)
        if (!autoSel.current && !ano && r.anos?.length) {
          autoSel.current = true;
          setAno(String(r.anos[0]));
        }
      })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano]);

  const k = data?.kpis;
  const rotuloPeriodo = ano ? `em ${ano}` : 'no acervo';

  // ---- narrativa automática (frases derivadas por regra dos próprios dados) --
  const narrativa = useMemo(() => {
    if (!data || !k || !k.total) return [];
    const fr: string[] = [];
    const top = data.porOrgao[0];
    if (top) fr.push(`A **${top.sigla}** é o órgão mais ativo ${rotuloPeriodo}: ${fmtN(top.n)} atos (${pct(top.n, k.total)}% do total).`);
    if (data.porMes.length) {
      const pico = data.porMes.reduce((a, b) => (b.n > a.n ? b : a));
      fr.push(`O pico de atividade foi em **${nomeMes(pico.ym)}**, com ${fmtN(pico.n)} atos.`);
    }
    fr.push(`**${pct(k.comSei, k.total)}%** dos atos têm processo SEI vinculado, e **${pct(k.vigentes, k.total)}%** seguem vigentes.`);
    return fr;
  }, [data, k, rotuloPeriodo]);

  return (
    <div id="painel-insights" className="space-y-3">
      {/* Cabeçalho + seletor de ano */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-xs font-bold text-[#003366] flex items-center gap-1.5 uppercase tracking-wider">
              <BarChart3 className="w-4 h-4 text-yellow-500" /> Insights — o acervo normativo em números
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-normal font-medium">
              Panorama analítico do que está indexado: <strong>ritmo de publicação</strong>, <strong>órgãos mais ativos</strong>,
              <strong> cobertura SEI</strong>, composição por tipo e situação de vigência. Todos os números vêm direto da base.
            </p>
          </div>
          <select
            value={ano}
            onChange={e => setAno(e.target.value)}
            className="px-3 py-2 text-sm rounded-md border border-slate-300 bg-white font-medium text-slate-700"
            aria-label="Filtrar por ano"
          >
            <option value="">Todos os anos</option>
            {(anos.length ? anos : data?.anos || []).map(a => <option key={a} value={String(a)}>{a}</option>)}
          </select>
        </div>
      </div>

      {carregando && !data ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Calculando insights…
        </div>
      ) : !k || !k.total ? (
        <div className="bg-white p-6 rounded-lg border border-slate-200 text-center">
          <Info className="w-6 h-6 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">Sem dados para o período selecionado.</p>
        </div>
      ) : (
        <>
          {/* Narrativa automática */}
          {narrativa.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-[12px] leading-relaxed text-blue-900 space-y-0.5">
                {narrativa.map((f, i) => <p key={i} dangerouslySetInnerHTML={{ __html: destaca(f) }} />)}
              </div>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <Kpi rotulo={`Atos ${rotuloPeriodo}`} valor={fmtN(k.total)} sub={k.dataMin ? `desde ${brData(k.dataMin)}` : ''} />
            <Kpi rotulo="Vigentes" valor={`${pct(k.vigentes, k.total)}%`} sub={`${fmtN(k.vigentes)} de ${fmtN(k.total)}`} cor="emerald" />
            <Kpi rotulo="Com processo SEI" valor={`${pct(k.comSei, k.total)}%`} sub={`${fmtN(k.comSei)} vinculados`} cor="sky" />
            <Kpi rotulo="Órgãos emissores" valor={fmtN(k.orgaos)} sub={`${fmtN(k.relacoes)} relações mapeadas`} cor="teal" />
          </div>

          {/* Heatmap de atividade */}
          <Card titulo="Atividade normativa por dia" icone={<CalendarDays className="w-4 h-4 text-yellow-500" />}
            sub="Cada quadrado é um dia; quanto mais escuro, mais atos assinados. Passe o mouse para ver a data.">
            <Heatmap porDia={data.porDia} ano={ano ? Number(ano) : null} dataMin={k.dataMin} dataMax={k.dataMax} P={P} />
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Ranking de órgãos + cobertura SEI */}
            <Card titulo="Quem mais publica" icone={<Building2 className="w-4 h-4 text-yellow-500" />}
              sub="Atos por órgão emissor. A parte escura da barra tem processo SEI vinculado.">
              <div className="flex items-center gap-4 mb-2 text-[11px] text-slate-500 font-medium">
                <Legenda cor={P.barSei} texto="com SEI" />
                <Legenda cor={P.bar} texto="sem SEI" />
              </div>
              <RankingOrgaos dados={data.porOrgao} P={P} />
            </Card>

            {/* Volume por mês */}
            <Card titulo="Volume por mês" icone={<TrendingUp className="w-4 h-4 text-yellow-500" />}
              sub="Distribuição temporal dos atos assinados no período.">
              <Colunas porMes={data.porMes} P={P} />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Composição por tipo */}
            <Card titulo="Composição por tipo de ato" icone={<BarChart3 className="w-4 h-4 text-yellow-500" />}
              sub="Que instrumentos normativos a UFF mais usa.">
              <BarrasSimples dados={data.porTipo.slice(0, 8).map(t => ({ rotulo: t.tipo, n: t.n }))} cor={P.tipo} total={k.total} />
            </Card>

            {/* Vigência */}
            <Card titulo="Situação de vigência" icone={<Link2 className="w-4 h-4 text-yellow-500" />}
              sub="Proporção do acervo ainda em vigor, alterado ou revogado.">
              <Vigencia vigentes={k.vigentes} alterados={k.alterados} revogados={k.revogados} total={k.total} P={P} />
            </Card>
          </div>

          {/* ---- Fase 2: análises que dependem do tempo/histórico ---- */}
          <div className="flex items-center gap-2 pt-2 pb-0.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Análises avançadas</span>
            <span className="flex-1 h-px bg-slate-200" />
            <span className="text-[10px] text-slate-400">todo o período · ignora o filtro de ano</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card titulo="Cadeiras que mais giram" icone={<Users className="w-4 h-4 text-yellow-500" />}
              sub="Rotatividade de chefias: nº de titulares por posição e permanência média entre eles.">
              <Rotatividade rot={an?.rotatividade} P={P} />
            </Card>

            <Card titulo="Citações a normas já revogadas" icone={<AlertTriangle className="w-4 h-4 text-yellow-500" />}
              sub="Auditoria: atos que referenciam uma norma DEPOIS de ela ter sido revogada — possível citação a norma sem efeito. Confira o ato.">
              <Zumbis lista={an?.zumbis} />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card titulo="Aposentadorias concedidas por ano" icone={<Users className="w-4 h-4 text-yellow-500" />}
              sub="Concessões publicadas no Boletim, detectadas pelo dispositivo do ato (“Concede aposentadoria…”): voluntárias × compulsórias.">
              <div className="flex items-center gap-4 mb-2 text-[11px] text-slate-500 font-medium">
                <Legenda cor={P.bar} texto="voluntária" />
                <Legenda cor={P.vig.revogado} texto="compulsória" />
              </div>
              <SerieAnual dados={(an?.seriesRh || []).map(s => ({ ano: s.ano, a: s.vol, b: s.comp }))}
                corA={P.bar} corB={P.vig.revogado} rotuloA="voluntárias" rotuloB="compulsórias" P={P} />
            </Card>

            <Card titulo="Saídas para outro cargo público" icone={<TrendingUp className="w-4 h-4 text-yellow-500" />}
              sub="Vacâncias declaradas por posse em outro cargo inacumulável (art. 33, VIII da Lei 8.112/90) — servidores que passaram em outro concurso.">
              <SerieAnual dados={(an?.seriesRh || []).map(s => ({ ano: s.ano, a: s.vac8 }))}
                corA={P.tipo} rotuloA="vacâncias art. 33, VIII" P={P} />
            </Card>
          </div>

          {/* Meia-vida: adiada até haver revogações suficientes (backfill) */}
          {an?.mortalidade && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-start gap-2.5">
              <Hourglass className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div className="text-[12px] leading-relaxed text-slate-600">
                <strong className="text-slate-700">Meia-vida das normas — em preparação.</strong> Só{' '}
                <strong>{fmtN(an.mortalidade.mexidos)}</strong> de {fmtN(an.mortalidade.total)} atos{' '}
                ({pctTxt(an.mortalidade.mexidos, an.mortalidade.total)}) foram revogados ou alterados até agora —
                poucos “eventos” para uma curva de sobrevivência confiável. Este painel <strong>ativa sozinho</strong> conforme
                o legado (anos anteriores) entra na base e as revogações se acumulam.
              </div>
            </div>
          )}

          <p className="text-[11px] text-slate-400 px-1 leading-relaxed">
            <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
            A “atividade por dia” usa a <strong>data de assinatura</strong> do ato (não a de publicação no boletim). Os recortes
            refletem apenas o período <strong>já indexado</strong>; a série cresce conforme novos boletins (e o legado) entram na base.
            A rotatividade conta só permanências <strong>concluídas</strong> (o titular atual, ainda no cargo, não entra na média).
            Nem toda “citação a norma revogada” é erro — pode ser menção histórica, regra de transição ou o ato reger fato
            anterior à revogação (<em>tempus regit actum</em>); por isso é um <strong>alerta para conferência</strong>, não um veredito.
            As séries de aposentadorias e vacâncias são detectadas pelo <strong>texto do dispositivo</strong> e contam o que foi
            <strong> publicado no Boletim</strong> — em alguns períodos parte das concessões saiu apenas no DOU, e o ano de 2020
            quase não trouxe atos de pessoal; quedas bruscas podem refletir a prática de publicação, não o fato em si.
          </p>
        </>
      )}
    </div>
  );
}

// ---- destaque de **negrito** simples na narrativa -------------------------
function destaca(s: string) {
  const esc = s.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] as string));
  return esc.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
const brData = (s: string) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : '');

// ---- KPI card -------------------------------------------------------------
function Kpi({ rotulo, valor, sub, cor = 'slate' }: { rotulo: string; valor: string; sub?: string; cor?: string }) {
  const corTxt: Record<string, string> = {
    slate: 'text-slate-900', emerald: 'text-emerald-600', sky: 'text-sky-600', teal: 'text-teal-600',
  };
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide leading-tight">{rotulo}</div>
      <div className={`text-2xl font-bold tracking-tight mt-1 ${corTxt[cor] || corTxt.slate}`}>{valor}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function Card({ titulo, sub, icone, children }: { titulo: string; sub?: string; icone?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
      <h4 className="text-xs font-bold text-[#003366] flex items-center gap-1.5 uppercase tracking-wider">{icone} {titulo}</h4>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5 mb-3 leading-normal font-medium">{sub}</p>}
      {children}
    </div>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: cor }} /> {texto}
    </span>
  );
}

// ---- Heatmap (calendário estilo GitHub) -----------------------------------
function Heatmap({ porDia, ano, dataMin, dataMax, P }:
  { porDia: { d: string; n: number }[]; ano: number | null; dataMin: string | null; dataMax: string | null; P: ReturnType<typeof paleta> }) {

  const { semanas, rotulosMes, nivelDe, maxN } = useMemo(() => {
    const counts = new Map(porDia.map(x => [x.d, x.n]));
    let ini: Date, fim: Date;
    if (ano) { ini = new Date(Date.UTC(ano, 0, 1)); fim = new Date(Date.UTC(ano, 11, 31)); }
    else if (dataMin && dataMax) { ini = new Date(dataMin + 'T00:00:00Z'); fim = new Date(dataMax + 'T00:00:00Z'); }
    else { const h = new Date(); ini = new Date(Date.UTC(h.getUTCFullYear(), 0, 1)); fim = h; }

    // quartis das contagens não-nulas -> 4 níveis
    const vals = porDia.map(x => x.n).filter(n => n > 0).sort((a, b) => a - b);
    const q = (p: number) => (vals.length ? vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] : 0);
    const t1 = q(0.25), t2 = q(0.5), t3 = q(0.75);
    const nivelDe = (n: number) => (n <= 0 ? -1 : n <= t1 ? 0 : n <= t2 ? 1 : n <= t3 ? 2 : 3);
    const maxN = vals.length ? vals[vals.length - 1] : 0;

    // recua o início até o domingo anterior
    const s = new Date(ini);
    s.setUTCDate(s.getUTCDate() - s.getUTCDay());
    const semanas: { iso: string; n: number; dentro: boolean }[][] = [];
    const rotulosMes: { col: number; texto: string }[] = [];
    let cur = new Date(s), col = 0, ultimoMes = -1;
    while (cur <= fim) {
      const semana: { iso: string; n: number; dentro: boolean }[] = [];
      for (let i = 0; i < 7; i++) {
        const iso = cur.toISOString().slice(0, 10);
        const dentro = cur >= ini && cur <= fim;
        if (dentro && cur.getUTCMonth() !== ultimoMes) {
          ultimoMes = cur.getUTCMonth();
          rotulosMes.push({ col, texto: MESES[ultimoMes] });
        }
        semana.push({ iso, n: counts.get(iso) || 0, dentro });
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      semanas.push(semana);
      col++;
    }
    return { semanas, rotulosMes, nivelDe, maxN };
  }, [porDia, ano, dataMin, dataMax]);

  const CELL = 12, GAP = 3, TOPO = 16, ESQ = 22;
  const W = ESQ + semanas.length * (CELL + GAP);
  const H = TOPO + 7 * (CELL + GAP);
  const cor = (n: number, dentro: boolean) => {
    if (!dentro) return 'transparent';
    const nv = nivelDe(n);
    return nv < 0 ? P.track : P.heat[nv];
  };
  const diasSemana = [['S', 1], ['T', 3], ['S', 5]] as [string, number][];

  return (
    <div>
      <div className="overflow-x-auto">
        <svg width={W} height={H} role="img"
          aria-label={`Calendário de atividade: cada quadrado é um dia, colorido pela quantidade de atos (máximo ${maxN} num único dia).`}>
          {rotulosMes.map((r, i) => (
            <text key={i} x={ESQ + r.col * (CELL + GAP)} y={11} fontSize="10" fill={P.axis}>{r.texto}</text>
          ))}
          {diasSemana.map(([lb, row], i) => (
            <text key={i} x={0} y={TOPO + row * (CELL + GAP) + CELL - 2} fontSize="9" fill={P.axis}>{lb}</text>
          ))}
          {semanas.map((sem, ci) => sem.map((dia, ri) => (
            <rect key={`${ci}-${ri}`} x={ESQ + ci * (CELL + GAP)} y={TOPO + ri * (CELL + GAP)}
              width={CELL} height={CELL} rx={2.5} fill={cor(dia.n, dia.dentro)}>
              {dia.dentro && <title>{`${brData(dia.iso)}: ${dia.n} ato(s)`}</title>}
            </rect>
          )))}
        </svg>
      </div>
      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400">
        <span>menos</span>
        <span className="w-3 h-3 rounded-sm inline-block" style={{ background: P.track }} />
        {P.heat.map((c, i) => <span key={i} className="w-3 h-3 rounded-sm inline-block" style={{ background: c }} />)}
        <span>mais</span>
      </div>
    </div>
  );
}

// ---- Ranking de órgãos (barra empilhada com SEI / sem SEI) -----------------
function RankingOrgaos({ dados, P }: { dados: ds.OrgaoStat[]; P: ReturnType<typeof paleta> }) {
  const max = Math.max(1, ...dados.map(d => d.n));
  return (
    <div className="space-y-1.5">
      {dados.map((d, i) => {
        const wSei = (d.comSei / max) * 100;
        const wResto = ((d.n - d.comSei) / max) * 100;
        return (
          <div key={i} className="flex items-center gap-2 text-[11px]" title={`${d.sigla}: ${d.n} atos · ${d.comSei} com SEI (${pct(d.comSei, d.n)}%)`}>
            <span className="w-20 text-right text-slate-600 font-semibold truncate shrink-0">{d.sigla}</span>
            <div className="flex-1 h-3.5 rounded-sm overflow-hidden flex" style={{ background: P.track }}>
              <div style={{ width: `${wSei}%`, background: P.barSei }} />
              <div style={{ width: `${wResto}%`, background: P.bar }} />
            </div>
            <span className="w-9 text-right font-bold text-slate-700 shrink-0">{fmtN(d.n)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---- Colunas (volume por mês) ---------------------------------------------
function Colunas({ porMes, P }: { porMes: { ym: string; n: number }[]; P: ReturnType<typeof paleta> }) {
  if (!porMes.length) return <p className="text-xs text-slate-400 italic">Sem dados de data.</p>;
  const max = Math.max(1, ...porMes.map(m => m.n));
  const W = 320, H = 150, PADB = 22, PADL = 4, PADT = 8;
  const bw = (W - PADL) / porMes.length;
  return (
    <div className="overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img"
        aria-label="Colunas de volume de atos por mês.">
        <line x1={PADL} y1={H - PADB} x2={W} y2={H - PADB} stroke={P.grid} strokeWidth="1" />
        {porMes.map((m, i) => {
          const h = ((H - PADB - PADT) * m.n) / max;
          const x = PADL + i * bw;
          const mn = Number(m.ym.split('-')[1]) - 1;
          return (
            <g key={i}>
              <rect x={x + bw * 0.15} y={H - PADB - h} width={bw * 0.7} height={h} rx={2} fill={P.col}>
                <title>{`${nomeMes(m.ym)}: ${m.n} atos`}</title>
              </rect>
              <text x={x + bw / 2} y={H - PADB + 12} fontSize="9" textAnchor="middle" fill={P.axis}>{MESES[mn]}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---- Barras horizontais simples (composição por tipo) ---------------------
function BarrasSimples({ dados, cor, total }: { dados: { rotulo: string; n: number }[]; cor: string; total: number }) {
  const max = Math.max(1, ...dados.map(d => d.n));
  return (
    <div className="space-y-1.5">
      {dados.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-[11px]" title={`${d.rotulo}: ${d.n} (${pct(d.n, total)}%)`}>
          <span className="w-32 text-right text-slate-600 font-semibold truncate shrink-0">{d.rotulo}</span>
          <div className="flex-1 h-3.5 rounded-sm" style={{ background: 'transparent' }}>
            <div className="h-full rounded-sm" style={{ width: `${(d.n / max) * 100}%`, background: cor }} />
          </div>
          <span className="w-9 text-right font-bold text-slate-700 shrink-0">{fmtN(d.n)}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Rotatividade de chefias ----------------------------------------------
function Rotatividade({ rot, P }: { rot?: ds.Analitico['rotatividade']; P: ReturnType<typeof paleta> }) {
  if (!rot) return <p className="text-xs text-slate-400 italic">Carregando…</p>;
  if (!rot.cadeiras.length) {
    return (
      <p className="text-xs text-slate-500 leading-relaxed">
        Histórico de chefias ainda curto para medir rotatividade
        {rot.totalEventos ? ` (${fmtN(rot.totalEventos)} eventos até agora)` : ''}. Ganha densidade conforme
        mais designações e mais anos entram na base.
      </p>
    );
  }
  const max = Math.max(...rot.cadeiras.map(c => c.titulares));
  return (
    <div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3 text-[11px]">
        {rot.medianaMeses != null && (
          <span className="text-slate-500">Permanência mediana: <strong className="text-slate-800">{rot.medianaMeses} meses</strong></span>
        )}
        <span className="text-slate-500">Posições com troca: <strong className="text-slate-800">{fmtN(rot.permanenciasMedidas ? rot.cadeiras.length : 0)}+</strong></span>
      </div>
      <div className="space-y-1.5">
        {rot.cadeiras.map((c, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]" title={`${c.cargo} — ${c.unidade}: ${c.titulares} titulares, permanência média ${c.permMedia} meses`}>
            <span className="w-40 text-right text-slate-600 truncate shrink-0">
              <span className="font-semibold text-slate-700">{c.cargo}</span> · {c.unidade}
            </span>
            <div className="flex-1 h-3.5 rounded-sm" style={{ background: 'transparent' }}>
              <div className="h-full rounded-sm" style={{ width: `${(c.titulares / max) * 100}%`, background: P.tipo }} />
            </div>
            <span className="w-24 text-left text-slate-500 shrink-0 whitespace-nowrap">
              <strong className="text-slate-700">{c.titulares}</strong> tit. · {c.permMedia}m
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Citações defasadas (ato cita norma já revogada) ----------------------
// Pivota no ATO CITANTE (o item acionável). Linha 1 = o ato que cita; linha 2 =
// a norma revogada apontada e quando morreu. Borda vermelha = sinal de alarme.
function Zumbis({ lista }: { lista?: ds.Zumbi[] }) {
  if (!lista) return <p className="text-xs text-slate-400 italic">Carregando…</p>;
  if (!lista.length) {
    return (
      <p className="text-xs text-slate-500 leading-relaxed">
        Nenhum ato referencia uma norma <strong>depois</strong> de ela ter sido revogada, no período
        indexado — o resultado esperado. Este radar acende conforme o legado entra na base e surgem
        citações a normas já sem efeito.
      </p>
    );
  }
  const normas = new Set(lista.map(z => z.alvoLabel)).size;
  return (
    <div>
      <p className="text-[11px] text-slate-500 mb-2">
        <strong className="text-red-600">{fmtN(lista.length)}</strong> referência(s) a <strong>{fmtN(normas)}</strong> norma(s)
        já revogada(s){lista.length >= 60 ? ' — mostrando as 60 mais recentes' : ''}.
      </p>
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {lista.map((z, i) => (
          <div key={i} className="text-[11px] py-1 pl-2 border-l-2 border-red-300">
            <div className="flex items-baseline gap-2">
              <span className="flex-1 min-w-0 truncate">
                {z.citLink ? (
                  <a href={z.citLink} target="_blank" referrerPolicy="no-referrer" className="text-blue-700 hover:underline font-semibold inline-flex items-center gap-0.5">
                    {z.citLabel} <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : <span className="font-semibold text-slate-700">{z.citLabel}</span>}
                <span className="text-slate-400"> · {z.citSigla}</span>
              </span>
              {z.citData && <span className="text-slate-400 shrink-0 whitespace-nowrap">{brData(z.citData)}</span>}
            </div>
            <div className="text-slate-500 mt-0.5">
              <span className="lowercase">{z.relacao || 'refere'}</span>{' '}
              <strong className="text-slate-700">{z.alvoLabel}</strong>
              <span className="text-slate-400"> · {z.alvoSigla}</span>
              {z.revogadoEm && <span className="text-red-600 font-medium"> — revogada em {brData(z.revogadoEm)}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Série anual (1 ou 2 séries de colunas por ano) ------------------------
// Usada pelos painéis de RH. Duas séries = colunas lado a lado por ano.
function SerieAnual({ dados, corA, corB, rotuloA, rotuloB, P }: {
  dados: { ano: number; a: number; b?: number }[];
  corA: string; corB?: string; rotuloA: string; rotuloB?: string; P: ReturnType<typeof paleta>;
}) {
  const uteis = dados.filter(d => d.a > 0 || (d.b || 0) > 0);
  if (!uteis.length) {
    return (
      <p className="text-xs text-slate-500 leading-relaxed">
        Nenhum ato desse tipo detectado no período indexado. A série ganha corpo
        conforme o legado entra na base (no banco completo ela cobre décadas).
      </p>
    );
  }
  const max = Math.max(1, ...uteis.map(d => Math.max(d.a, d.b || 0)));
  const W = 340, H = 160, PADB = 24, PADL = 6, PADT = 14;
  const gw = (W - PADL) / uteis.length;                    // largura do grupo/ano
  const duas = corB != null;
  const bw = duas ? gw * 0.36 : gw * 0.62;                 // largura de cada coluna
  const alt = (n: number) => ((H - PADB - PADT) * n) / max;
  const total = (k: 'a' | 'b') => uteis.reduce((s, d) => s + (d[k] || 0), 0);
  return (
    <div>
      <div className="overflow-x-auto">
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img"
          aria-label={`Série anual: ${rotuloA}${rotuloB ? ' e ' + rotuloB : ''}, máximo ${max} num ano.`}>
          <line x1={PADL} y1={H - PADB} x2={W} y2={H - PADB} stroke={P.grid} strokeWidth="1" />
          {uteis.map((d, i) => {
            const x0 = PADL + i * gw;
            const rot = uteis.length > 14 ? String(d.ano).slice(2) : String(d.ano);
            return (
              <g key={d.ano}>
                <rect x={x0 + (duas ? gw * 0.10 : gw * 0.19)} y={H - PADB - alt(d.a)} width={bw} height={alt(d.a)} rx={1.5} fill={corA}>
                  <title>{`${d.ano}: ${fmtN(d.a)} ${rotuloA}`}</title>
                </rect>
                {duas && (
                  <rect x={x0 + gw * 0.52} y={H - PADB - alt(d.b || 0)} width={bw} height={alt(d.b || 0)} rx={1.5} fill={corB}>
                    <title>{`${d.ano}: ${fmtN(d.b || 0)} ${rotuloB || ''}`}</title>
                  </rect>
                )}
                <text x={x0 + gw / 2} y={H - PADB + 12} fontSize="8.5" textAnchor="middle" fill={P.axis}>{rot}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-[11px] text-slate-500 mt-1.5">
        Total no período indexado: <strong className="text-slate-700">{fmtN(total('a'))}</strong> {rotuloA}
        {duas && <> · <strong className="text-slate-700">{fmtN(total('b'))}</strong> {rotuloB}</>}.
      </p>
    </div>
  );
}

// ---- Vigência (barra empilhada única + legenda) ---------------------------
function Vigencia({ vigentes, alterados, revogados, total, P }:
  { vigentes: number; alterados: number; revogados: number; total: number; P: ReturnType<typeof paleta> }) {
  const seg = [
    { rot: 'Vigentes', n: vigentes, cor: P.vig.ativo },
    { rot: 'Alterados', n: alterados, cor: P.vig.alterado },
    { rot: 'Revogados', n: revogados, cor: P.vig.revogado },
  ];
  return (
    <div>
      <div className="flex h-8 rounded-md overflow-hidden" style={{ background: P.track }}>
        {seg.map((s, i) => s.n > 0 && (
          <div key={i} style={{ width: `${(s.n / total) * 100}%`, background: s.cor }}
            title={`${s.rot}: ${fmtN(s.n)} (${pct(s.n, total)}%)`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        {seg.map((s, i) => (
          <div key={i} className="text-center">
            <div className="text-lg font-bold text-slate-800">{pctTxt(s.n, total)}</div>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: s.cor }} /> {s.rot}
            </div>
            <div className="text-[10px] text-slate-400">{fmtN(s.n)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
