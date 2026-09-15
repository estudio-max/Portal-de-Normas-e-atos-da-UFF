import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Info, ExternalLink, Search, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';
import { RotulosEixo } from '../ui/RotulosEixo';
import * as ds from '../../dataSource';

// Aba "Convênios de Estágio": radar de validade dos convênios que a UFF mantém
// com empresas para receber estagiários. Serve a dois públicos com a mesma
// tela — o aluno, que precisa saber SE a empresa tem convênio, e a Divisão de
// Estágio, que precisa saber QUANDO ele acaba.
//
// ⚠️ NÃO É O REGISTRO OFICIAL, e a tela diz isso em cima, não em nota de
// rodapé. O registro é o da Divisão de Estágio (REGISTRO_OFICIAL abaixo). Aqui
// só entra convênio cuja RATIFICAÇÃO foi publicada no Boletim de Serviço com as
// duas datas no corpo do ato — o que começa em 2022. Omitir esse limite faria a
// tela mentir por ausência: aluno que não achasse a empresa concluiria que não
// há convênio, quando o que não há é ato publicado no recorte que alcançamos.

const REGISTRO_OFICIAL = 'https://estagio.uff.br/convenios-ativos';

const fmtBR = (s: string) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : '—');

// Contagem em PALAVRAS, não só em cor — a mesma regra da aba Prazos.
const contagem = (n: number) =>
  n < 0 ? `venceu há ${-n} dia${n === -1 ? '' : 's'}`
  : n === 0 ? 'vence hoje'
  : n === 1 ? 'vence amanhã'
  : n <= 60 ? `faltam ${n} dias`
  : `faltam ${Math.round(n / 30)} meses`;

// Escada 30/60/90 — a do acompanhamento de vencimento de contrato. O
// vocabulário de cor é o mesmo da aba Prazos de propósito, para quem circula
// entre as duas não reaprender a leitura; as FAIXAS é que são próprias, porque
// aqui o horizonte é de meses e não de dias.
type Urg = 'vencido' | 'd30' | 'd60' | 'd90' | 'adiante';
const urgDe = (d: number): Urg =>
  d < 0 ? 'vencido' : d <= 30 ? 'd30' : d <= 60 ? 'd60' : d <= 90 ? 'd90' : 'adiante';

// VENCIDO é vermelho aqui, e cinza na aba Prazos. Não é inconsistência: lá o
// prazo vencido é história (a inscrição fechou, acabou); aqui é o estado mais
// grave que a tela pode mostrar — convênio fora da validade significa aluno
// eventualmente em campo sem cobertura do acordo. Cor de arquivo morto para
// isso seria esconder exatamente o que a Divisão abriu a aba para ver.
const URG: Record<Urg, { rotulo: string; card: string; ponto: string; texto: string }> = {
  vencido: { rotulo: 'Vencidos',          card: 'border-l-red-500',   ponto: '#d03b3b', texto: 'text-red-700' },
  d30:     { rotulo: 'Vencem em 30 dias', card: 'border-l-amber-500', ponto: '#e0932a', texto: 'text-amber-700' },
  d60:     { rotulo: 'Vencem em 60 dias', card: 'border-l-blue-500',  ponto: '#3266ad', texto: 'text-blue-700' },
  d90:     { rotulo: 'Vencem em 90 dias', card: 'border-l-slate-400', ponto: '#8a93a3', texto: 'text-slate-600' },
  adiante: { rotulo: 'Mais adiante',      card: 'border-l-slate-300', ponto: '#b6bcc7', texto: 'text-slate-500' },
};

const JANELAS = [
  { k: 'vencidos', rot: 'Vencidos' },
  { k: '30', rot: '30 dias' },
  { k: '60', rot: '60 dias' },
  { k: '90', rot: '90 dias' },
  { k: 'todos', rot: 'Todos' },
] as const;

export default function EstagiosApi() {
  const [dados, setDados] = useState<ds.ConveniosEstagioResp | null>(null);
  const [carregando, setCarregando] = useState(true);
  // Padrão "90": é a janela de trabalho de quem renova. Abrir em "todos"
  // mostraria mil e oitocentas linhas em que nada precisa ser feito agora, e o
  // que precisa ficaria perdido no meio.
  const [janela, setJanela] = useState<string>('90');
  const [modalidade, setModalidade] = useState('todas');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    let vivo = true;
    ds.getConveniosEstagio()
      .then(r => { if (vivo) setDados(r); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, []);

  const modalidades = useMemo(() => {
    const s = new Set((dados?.convenios ?? []).map(c => c.modalidade).filter(Boolean));
    return Array.from(s).sort();
  }, [dados]);

  const filtrada = useMemo(() => {
    const lista = dados?.convenios ?? [];
    const q = busca.trim().toLowerCase();
    return lista.filter(c => {
      const d = c.diasRestantes;
      // A faixa do FILTRO é cumulativa (30 dias mostra tudo que vence até lá),
      // ao contrário das do KPI, que são excludentes para somarem o total.
      // Quem filtra quer a lista de trabalho até a data; quem lê o topo quer
      // saber quanto cai em cada mês.
      if (janela === 'vencidos' && d >= 0) return false;
      if (janela === '30' && (d < 0 || d > 30)) return false;
      if (janela === '60' && (d < 0 || d > 60)) return false;
      if (janela === '90' && (d < 0 || d > 90)) return false;
      if (modalidade !== 'todas' && c.modalidade !== modalidade) return false;
      if (q && !c.empresa.toLowerCase().includes(q) && !c.ementa.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [dados, janela, modalidade, busca]);

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-slate-600 p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando convênios…
      </div>
    );
  }

  // Modo estático (sem API): a rota não existe e não há como derivar isto do
  // portal-data.json, que não traz o corpo dos atos. Dizer isso é melhor que
  // mostrar uma tela vazia que parece defeito.
  if (!dados) {
    return (
      <div className="space-y-3">
        <PageHeader titulo="Convênios de Estágio"
          descricao="Acompanhe a validade dos convênios que a UFF mantém com empresas para estágio." />
        <div className="bg-white p-4 rounded-lg border border-slate-200 text-[13px] text-slate-700 leading-relaxed">
          <AlertTriangle className="w-4 h-4 inline mr-1.5 -mt-0.5 text-amber-700" />
          Este painel depende da consulta ao banco e não está disponível no modo estático.
          A lista oficial e completa dos convênios de estágio da UFF fica em{' '}
          <a href={REGISTRO_OFICIAL} target="_blank" rel="noopener noreferrer"
            className="texto-marca font-semibold underline underline-offset-2">
            estagio.uff.br <ExternalLink className="w-3.5 h-3.5 inline -mt-0.5" />
          </a>.
        </div>
      </div>
    );
  }

  const j = dados.janelas;
  // O ano mais antigo sai do DADO, não de constante escrita à mão. Hoje ele é
  // 2022 porque antes disso a resolução não declara vigência no texto — mas se
  // o acervo antigo for reprocessado e passar a declarar, a frase se corrige
  // sozinha em vez de continuar afirmando um recorte que deixou de valer.
  const anoMin = dados.convenios.length ? Math.min(...dados.convenios.map(c => c.ano)) : null;

  return (
    <div id="painel-estagios" className="space-y-3">
      <PageHeader
        titulo="Convênios de Estágio"
        descricao="Acompanhe a validade dos convênios que a UFF mantém com empresas para estágio."
      />

      {/* A declaração de alcance vem ANTES do número, não depois. Um painel de
          convênios que não diz o seu recorte é lido como lista completa. */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
        <p className="text-[13px] text-slate-700 leading-relaxed">
          Convênios de estágio cuja <strong>ratificação foi publicada no Boletim de Serviço</strong> com as
          datas de início e fim no texto do ato — <strong>{dados.total.toLocaleString('pt-BR')}</strong> convênios
          {anoMin && <>, todos de <strong>{anoMin} em diante</strong>. Antes de {anoMin} as resoluções não
            declaram vigência no texto, então o radar não alcança aquele período</>}.
        </p>
        <p className="text-[13px] text-slate-700 leading-relaxed mt-2">
          <strong>Esta não é a lista oficial.</strong> O registro completo, com CNPJ e cidade, é o da
          Divisão de Estágio:{' '}
          <a href={REGISTRO_OFICIAL} target="_blank" rel="noopener noreferrer"
            className="texto-marca font-semibold underline underline-offset-2">
            estagio.uff.br <ExternalLink className="w-3.5 h-3.5 inline -mt-0.5" />
          </a>. Não encontrar uma empresa aqui <strong>não</strong> significa que ela não tenha convênio.
        </p>

        {/* KPIs — o que exige ação primeiro */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-3">
          <Kpi rotulo="Vencidos" valor={j.vencidos} classe="bg-red-50 border-red-100" texto="text-red-700" />
          <Kpi rotulo="Vencem em 30 dias" valor={j.d30} classe="bg-amber-50 border-amber-100" texto="text-amber-700" />
          <Kpi rotulo="Vencem em 60 dias" valor={j.d60} classe="bg-blue-50 border-blue-100" texto="text-blue-700" />
          <Kpi rotulo="Vencem em 90 dias" valor={j.d90} classe="bg-slate-50 border-slate-100" texto="text-slate-700" />
        </div>
      </div>

      <BarrasPorAno serie={dados.serie} />
      <LinhaDoTempo convenios={dados.convenios} />

      {/* Filtros */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex flex-wrap rounded-md border border-slate-200 overflow-hidden">
            {JANELAS.map(w => (
              <button key={w.k} onClick={() => setJanela(w.k)}
                aria-pressed={janela === w.k}
                className={`px-3 py-2 text-[13px] font-bold border-r border-slate-200 last:border-0 ${
                  janela === w.k ? 'bg-[#003366] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {w.rot}
              </button>
            ))}
          </div>
          {modalidades.length > 1 && (
            <select value={modalidade} onChange={e => setModalidade(e.target.value)}
              aria-label="Filtrar por modalidade declarada no ato"
              className="px-3 py-2 text-[13px] rounded-md border border-slate-200 bg-white text-slate-700">
              <option value="todas">Todas as modalidades</option>
              {modalidades.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <div className="relative grow min-w-[200px]">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar empresa…" aria-label="Buscar empresa"
              className="w-full pl-8 pr-3 py-2 text-[13px] rounded-md border border-slate-200 bg-white text-slate-700" />
          </div>
        </div>
        <p className="text-[13px] text-slate-600 mt-2">
          {filtrada.length.toLocaleString('pt-BR')} convênio{filtrada.length === 1 ? '' : 's'} nesta seleção.
        </p>
      </div>

      {filtrada.length === 0 ? (
        <div className="bg-white p-4 rounded-lg border border-slate-200 text-[13px] text-slate-600">
          Nenhum convênio nesta seleção{anoMin ? ` — o radar cobre de ${anoMin} em diante` : ''}. A lista
          completa está em{' '}
          <a href={REGISTRO_OFICIAL} target="_blank" rel="noopener noreferrer"
            className="texto-marca font-semibold underline underline-offset-2">estagio.uff.br</a>.
        </div>
      ) : (
        <ul className="space-y-2">
          {/* O `key` vai no <li>, não no <Cartao>: este projeto não instala
              `@types/react`, então componente de função não conhece `key` e o
              type-check reprova. Embrulhar num <div> como a aba Prazos faz
              resolveria o tipo e quebraria a lista — item de <ul> tem que ser
              <li> para leitor de tela anunciar "lista com N itens". */}
          {filtrada.map(c => (
            <li key={c.id}
              className={`bg-white rounded-lg border border-slate-200 border-l-4 ${URG[urgDe(c.diasRestantes)].card} p-3 shadow-xs`}>
              <Cartao c={c} />
            </li>
          ))}
        </ul>
      )}

      <p className="text-[13px] text-slate-500 px-1 leading-relaxed">
        <Info className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
        As datas são lidas <strong>automaticamente</strong> do texto do ato e a modalidade é a{' '}
        <strong>redação literal</strong> do convênio — o portal não traduz “curricular profissional” para
        “obrigatório”. Um convênio pode ter sido prorrogado ou rescindido por ato posterior que este radar
        não relacione: <strong>confira sempre o ato de origem</strong> antes de decidir.
      </p>
    </div>
  );
}

function Kpi({ rotulo, valor, classe, texto }: { rotulo: string; valor: number; classe: string; texto: string }) {
  return (
    <div className={`border rounded-lg p-2.5 ${classe}`}>
      <div className={`text-[12px] font-bold uppercase tracking-wide ${texto}`}>{rotulo}</div>
      <div className={`text-2xl font-bold mt-0.5 ${texto}`}>{valor.toLocaleString('pt-BR')}</div>
    </div>
  );
}

// ---- Barras: quantos convênios vencem em cada ano -------------------------
// O horizonte inteiro numa olhada. É o gráfico que responde "qual vai ser o
// volume de renovação do ano que vem" — pergunta de planejamento, não de
// urgência, e por isso separada da linha do tempo.
function BarrasPorAno({ serie }: { serie: { ano: number; n: number }[] }) {
  if (!serie.length) return null;
  const anoAtual = new Date().getFullYear();
  const max = Math.max(...serie.map(s => s.n), 1);
  const W = 720, H = 150, base = H - 8, topo = 8;
  const larg = W / serie.length;
  return (
    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs overflow-x-auto">
      <div className="text-[13px] text-slate-600 font-semibold mb-1 px-1">Convênios por ano de vencimento</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img"
        aria-label={`Barras: ${serie.map(s => `${s.n} vencem em ${s.ano}`).join('; ')}.`}>
        {serie.map((s, i) => {
          const h = Math.max(2, ((H - topo - 8) * s.n) / max);
          // Ano passado ou corrente = o que já venceu ou vence agora.
          const cor = s.ano < anoAtual ? URG.vencido.ponto : s.ano === anoAtual ? URG.d30.ponto : URG.adiante.ponto;
          return (
            <rect key={s.ano} x={i * larg + larg * 0.18} y={base - h}
              width={larg * 0.64} height={h} fill={cor} rx="2">
              <title>{`${s.n} convênio(s) vencem em ${s.ano}`}</title>
            </rect>
          );
        })}
      </svg>
      <RotulosEixo itens={serie.map(s => String(s.ano))} largura={W} />
    </div>
  );
}

// ---- Linha do tempo: os próximos 90 dias ---------------------------------
// A janela de ação, na mesma escada 30/60/90 dos números do topo. Mesmo desenho
// da aba Prazos, para quem circula entre as duas não reaprender a leitura. O
// que vence depois de 90 dias não some: está no gráfico de barras por ano, que
// é a vista de planejamento, e na faixa "Todos" do filtro.
function LinhaDoTempo({ convenios }: { convenios: ds.ConvenioEstagio[] }) {
  const proximos = convenios.filter(c => c.diasRestantes >= 0 && c.diasRestantes <= 90);
  if (!proximos.length) return null;
  const span = 90;
  const W = 720, H = 74, PADL = 8, PADR = 8, base = 46;
  const x = (d: number) => PADL + (Math.min(d, span) / span) * (W - PADL - PADR);
  const ticks = [0, 30, 60, 90];
  return (
    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs overflow-x-auto">
      <div className="text-[13px] text-slate-600 font-semibold mb-1 px-1">
        Próximos 90 dias — {proximos.length} convênio{proximos.length === 1 ? '' : 's'} a vencer
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img"
        aria-label={`Linha do tempo com ${proximos.length} convênios vencendo nos próximos 90 dias.`}>
        <line x1={PADL} y1={base} x2={W - PADR} y2={base} stroke="var(--chart-grid)" strokeWidth="1.5" />
        {ticks.map(d => (
          <line key={d} x1={x(d)} y1={base - 3} x2={x(d)} y2={base + 3} stroke="var(--chart-grid)" strokeWidth="1" />
        ))}
        {proximos.map((c, i) => (
          <circle key={c.id} cx={x(c.diasRestantes)} cy={base - 8 - (i % 3) * 7} r={4.5}
            fill={URG[urgDe(c.diasRestantes)].ponto} stroke="#fff" strokeWidth="1.5">
            <title>{`${fmtBR(c.fim)} · ${c.empresa} (${contagem(c.diasRestantes)})`}</title>
          </circle>
        ))}
      </svg>
      {/* Rótulos em HTML: dentro do SVG eles escalariam junto com o viewBox. */}
      <RotulosEixo itens={ticks.map(d => (d === 0 ? 'hoje' : `+${d}d`))} largura={W} />
    </div>
  );
}

// ---- Cartão de um convênio ------------------------------------------------
function Cartao({ c }: { c: ds.ConvenioEstagio }) {
  const u = urgDe(c.diasRestantes);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-slate-800 leading-snug">{c.empresa || '(empresa não identificada na ementa)'}</p>
          <p className="text-[13px] text-slate-600 mt-0.5">
            Vigência: <strong>{fmtBR(c.inicio)}</strong> a <strong>{fmtBR(c.fim)}</strong>
          </p>
        </div>
        <div className={`text-[13px] font-bold shrink-0 ${URG[u].texto}`}>
          {contagem(c.diasRestantes)}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className="text-[12px] px-2 py-1 rounded border bg-slate-100 text-slate-600 border-slate-200">
          {c.modalidade || 'modalidade não declarada no ato'}
        </span>
        <span className="text-[12px] px-2 py-1 rounded border bg-slate-100 text-slate-600 border-slate-200">
          {c.tipo} nº {c.numero}/{c.ano}
        </span>
        {c.processoSei && (
          <span className="text-[12px] px-2 py-1 rounded border bg-slate-100 text-slate-600 border-slate-200">
            SEI {c.processoSei}
          </span>
        )}
        {c.link && (
          <a href={c.link} target="_blank" rel="noopener noreferrer"
            className="text-[12px] px-2 py-1 rounded border texto-marca font-semibold border-slate-200 hover:bg-slate-50">
            Boletim <ExternalLink className="w-3 h-3 inline -mt-0.5" />
          </a>
        )}
      </div>
    </>
  );
}
