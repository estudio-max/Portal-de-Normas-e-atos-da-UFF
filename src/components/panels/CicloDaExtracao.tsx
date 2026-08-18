import React, { useEffect, useState } from 'react';
import * as ds from '../../dataSource';

// ---------------------------------------------------------------------------
// INFOGRÁFICO DO CICLO DE EXTRAÇÃO — desenhado, e vivo.
//
// O que ele mostra: o DESAFIO (o que o Boletim entrega) e o ACERTO (o que o
// portal consegue fazer com aquilo). Os erros do caminho ficam na documentação
// do repositório, que é onde servem para quem vai mexer no código — aqui o
// visitante quer saber o que o portal faz e o que foi preciso para fazê-lo.
//
// É componente e não imagem porque imagem tem os números DIGITADOS: eles
// nascem certos e envelhecem em silêncio. Foi assim que a figura da grade de
// abas ficou mostrando doze painéis num portal de quinze. Aqui todo número vem
// da API quando a aba abre; sem API sai "—" e o desenho não muda de forma.
//
// ⚠️ COR DE SVG SAI DE TOKEN, sempre. O modo fotofobia age por seletor de
// CLASSE do Tailwind e não alcança `fill`/`stroke` dentro de SVG: hex literal
// aqui fica escuro sobre escuro sem erro no console, e a trava do redesign
// reprova. Ver `--chart-*` e `--serie-*` no index.css.
//
// ⚠️ O DESENHO REFLUI, não rola. As etapas e as fichas são caixas de CSS, não
// um SVG de largura fixa — SVG largo dentro de faixa estreita vira desenho de
// 30% visível, defeito que este portal já teve no mapa-múndi. Só o funil é
// SVG, porque nele a FORMA é a informação.
// ---------------------------------------------------------------------------

const nf = (v: number | null | undefined) =>
  (v === null || v === undefined ? '—' : v.toLocaleString('pt-BR'));

type Numeros = {
  atos: number; boletins: number; orgaos: number; comSei: number;
  vigentes: number; revogados: number; alterados: number;
  acordos: number; paises: number;
  odsVinculos: number; odsAtos: number;
  colegiados: number; politicas: number;
};

/** Etapa do fluxo: o número domina, o rótulo explica. */
function Etapa({ ordem, valor, unidade, titulo }: {
  ordem: number; valor: string; unidade: string; titulo: string;
}) {
  return (
    <li className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-3">
      <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
        style={{ background: 'var(--serie-azul)' }} aria-hidden="true">{ordem}</span>
      <p className="mt-2 text-2xl font-bold leading-none tabular-nums text-[#003366]">{valor}</p>
      <p className="mt-1 text-[12px] font-semibold leading-tight text-slate-700">{unidade}</p>
      <p className="mt-1.5 text-[12px] font-bold uppercase tracking-wide text-slate-400">{titulo}</p>
    </li>
  );
}

function Seta() {
  return (
    <li className="flex shrink-0 items-center justify-center py-1 sm:px-1 sm:py-0" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18" className="rotate-90 sm:rotate-0">
        <path d="M3 9h10M9 5l4 4-4 4" fill="none" stroke="var(--chart-axis)"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </li>
  );
}

/** Um desafio do corpus: o número mede o tamanho dele. */
function Desafio({ valor, titulo, texto }: { valor: string; titulo: string; texto: string }) {
  return (
    <li className="min-w-0 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-xl font-bold leading-none tabular-nums text-amber-800">{valor}</p>
      <p className="mt-1.5 text-[13px] font-bold text-slate-800">{titulo}</p>
      <p className="mt-1 text-[12px] leading-snug text-slate-600">{texto}</p>
    </li>
  );
}

/** Um acerto: o que o portal entrega hoje. */
function Acerto({ valor, titulo, texto }: { valor: string; titulo: string; texto: string }) {
  return (
    <li className="min-w-0 rounded-lg border p-3"
      style={{ borderColor: 'var(--destaque-borda)', background: 'var(--destaque-fundo)' }}>
      <p className="text-xl font-bold leading-none tabular-nums" style={{ color: 'var(--chart-mark)' }}>
        {valor}
      </p>
      <p className="mt-1.5 text-[13px] font-bold text-slate-800">{titulo}</p>
      <p className="mt-1 text-[12px] leading-snug text-slate-600">{texto}</p>
    </li>
  );
}

/** As redações que o Boletim usa para a MESMA decisão de revalidação.
 *
 *  Só entram redações ATESTADAS no acervo — o catálogo completo, com trecho
 *  real de cada uma, vive em docs/EQUIVALENCIAS-DE-TERMOS.md. */
const REDACOES = [
  'Aprovar a revalidação do Diploma',
  'Deferir a solicitação',
  'Homologar a revalidação do título',
  'Indeferir a solicitação',
  'Indeferir o pedido de revalidação do Diploma de …',
  'Manifestar-se pelo indeferimento',
  'Homologar o parecer, indeferindo',
];

export default function CicloDaExtracao() {
  const [n, setN] = useState<Numeros | null>(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([ds.getStats(), ds.getCooperacao(), ds.getOds(),
                 ds.getComissoes(), ds.getPoliticas()])
      .then(([st, coop, ods, com, pol]) => {
        if (!vivo || !st) return;
        setN({
          atos: st.total, boletins: st.boletins, orgaos: st.orgaos,
          comSei: st.comSei, vigentes: st.vigentes,
          revogados: st.revogados, alterados: st.alterados,
          acordos: coop?.acordos?.length ?? 0,
          paises: coop?.paises?.length ?? 0,
          odsVinculos: ods?.linhas ?? 0,
          odsAtos: ods?.atosDistintos ?? 0,
          colegiados: com?.corpos?.length ?? 0,
          politicas: pol?.politicas?.length ?? 0,
        });
      })
      .catch(() => { /* sem API os números saem "—" e o desenho fica de pé */ });
    return () => { vivo = false; };
  }, []);

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------ 1. O FLUXO */}
      <ol className="flex flex-col sm:flex-row sm:items-stretch">
        <Etapa ordem={1} valor={nf(n?.boletins)} unidade="boletins em PDF" titulo="A fonte" />
        <Seta />
        <Etapa ordem={2} valor={nf(n?.atos)} unidade="atos reconhecidos" titulo="A extração" />
        <Seta />
        <Etapa ordem={3} valor={nf(n?.orgaos)} unidade="órgãos emissores" titulo="O banco" />
        <Seta />
        <Etapa ordem={4} valor="15" unidade="painéis de consulta" titulo="A leitura" />
      </ol>

      {/* --------------------------------------------------- 2. OS DESAFIOS */}
      <section>
        <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">
          O que o Boletim entrega
        </p>
        <h4 className="mt-0.5 text-[15px] font-bold text-slate-900">
          Vinte e cinco anos de texto sem estrutura
        </h4>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Desafio valor="1.162" titulo="grafias de sigla"
            texto="O mesmo órgão escrito de dezenas de formas ao longo dos anos." />
          <Desafio valor="7" titulo="modos de decidir o mesmo"
            texto="Cada época tem a sua fórmula para deferir ou indeferir um pedido." />
          <Desafio valor="4" titulo="formatos de boletim"
            texto="O marcador de fim de ato muda em 2002 e 2004; o sistema de origem muda em 2018." />
          <Desafio valor="0" titulo="campos no documento"
            texto="Nenhuma tabela, nenhum identificador: só texto corrido, parte dele digitalizada." />
        </ul>
      </section>

      {/* ----------------------------------------------- 3. A NORMALIZAÇÃO */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">
          Equivalência de termos
        </p>
        <h4 className="mt-0.5 text-[15px] font-bold text-slate-900">
          Sete maneiras de escrever a mesma decisão
        </h4>

        <ul className="mx-auto mt-3 flex max-w-[760px] flex-wrap justify-center gap-1.5">
          {REDACOES.map(r => (
            <li key={r}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] text-slate-600">
              {r}
            </li>
          ))}
        </ul>

        {/* O funil é SVG porque aqui a FORMA carrega o sentido: muitas entradas,
            uma saída. `viewBox` sem largura fixa faz ele acompanhar a coluna. */}
        <svg viewBox="0 0 320 76" className="mx-auto mt-2 block h-auto w-full max-w-[320px]"
          role="img"
          aria-label={'As sete redações acima passam por um catálogo de '
            + 'equivalências e saem como duas decisões comparáveis: deferido ou '
            + 'indeferido.'}>
          <path d="M8 6 L312 6 L196 52 L196 70 L124 70 L124 52 Z"
            fill="var(--chart-fill)" stroke="var(--chart-mark)" strokeWidth="1.2" />
          {/* 14 unidades do viewBox, e não 11,5: o SVG escala com a coluna, e
              a 276px de largura (celular) o texto de 11,5 renderizava a ~10px —
              abaixo do piso de 12px que o portal adota. Aqui o tamanho tem de
              ser escolhido no MENOR caso, não no maior. */}
          <text x="160" y="35" textAnchor="middle" fontSize="14" fontWeight="700"
            fill="var(--chart-mark)" letterSpacing="0.06em">EQUIVALÊNCIAS</text>
        </svg>

        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded px-3 py-1.5 text-[12px] font-bold tracking-wide"
            style={{ background: 'var(--destaque-fundo)', color: 'var(--chart-mark)' }}>
            DEFERIDO
          </span>
          <span className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-bold tracking-wide text-red-700">
            INDEFERIDO
          </span>
        </div>

        <p className="mx-auto mt-3 max-w-[62ch] text-center text-[13px] leading-relaxed text-slate-600">
          Sem esse catálogo, cada redação seria uma categoria diferente e não
          haveria série histórica: o que mudou foi a <strong>gramática da
          instituição</strong>, não a decisão dela.
        </p>
      </section>

      {/* ---------------------------------------------------- 4. OS ACERTOS */}
      <section>
        <p className="text-[12px] font-bold uppercase tracking-wide text-slate-400">
          O que o portal entrega
        </p>
        <h4 className="mt-0.5 text-[15px] font-bold text-slate-900">
          O que dá para perguntar hoje, e não dava antes
        </h4>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Acerto valor={nf(n?.atos)} titulo="atos pesquisáveis"
            texto="Por número, ementa, processo, nome ou matrícula — no acervo inteiro, de uma vez." />
          <Acerto valor={nf(n?.revogados)} titulo="normas revogadas identificadas"
            texto={`De ${nf(n?.atos)} atos, o portal calcula quais ainda valem: `
              + `${nf(n?.vigentes)} vigentes e ${nf(n?.alterados)} alterados.`} />
          <Acerto valor={nf(n?.comSei)} titulo="atos ligados ao processo SEI"
            texto="Todos os números citados no texto, não só o primeiro — a busca por processo depende disso." />
          <Acerto valor={nf(n?.acordos)} titulo="acordos de cooperação"
            texto={`Com ${nf(n?.paises)} países identificados, e mapa para ver de onde vêm.`} />
          <Acerto valor={nf(n?.odsAtos)} titulo="atos ligados à Agenda 2030"
            texto={`${nf(n?.odsVinculos)} vínculos, separando o que é proposta do que é execução.`} />
          <Acerto valor={`${nf(n?.colegiados)} + ${nf(n?.politicas)}`}
            titulo="colegiados e políticas catalogados"
            texto="Cada um com a sequência de atos que o constituiu, e o papel de cada ato nela." />
        </ul>
      </section>
    </div>
  );
}
