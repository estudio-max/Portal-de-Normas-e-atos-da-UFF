import React, { useEffect, useMemo, useState } from 'react';
import { GraduationCap, Loader2, Info, Clock } from 'lucide-react';
import * as ds from '../../dataSource';
import { RecordCard, RecordCardList, DesktopTable } from '../ui/RecordCard';

// ---------------------------------------------------------------------------
// Revalidação de diploma obtido no exterior.
//
// AGREGADO, sempre. Nenhuma tela aqui identifica quem pediu — e não é filtro de
// exibição: `ato_revalidacao` não tem coluna de pessoa. São pessoas privadas,
// não servidores; um indeferimento enterrado num PDF de 177 páginas é diferente
// de uma lista navegável de negados. O ato individual segue na busca normal.
//
// A quem serve: a) quem pensa em pedir revalidação na UFF e quer saber onde a
// fila anda e o que costuma ser deferido; b) auditoria — o eixo de prazos e a
// publicidade dos atos são justamente o que CGU/TCU cobram (Res. CNE/CES
// 1/2022), e o BS é a fonte primária deles.
// ---------------------------------------------------------------------------

const VIAS = ['Graduação', 'Pós-graduação'] as const;
type Via = typeof VIAS[number];

const pct = (parte: number, todo: number) => Math.round((parte / Math.max(1, todo)) * 100);

/** Taxa só quando a amostra sustenta. Abaixo do mínimo devolve null e a tela
 *  mostra a contagem — 1 indeferimento não pode virar "0% de aprovação" e
 *  afastar quem talvez devesse pedir. O limiar vem da API. */
function taxa(deferidos: number, total: number, minimo: number): number | null {
  return total >= minimo ? pct(deferidos, total) : null;
}

/** Barra deferido/indeferido: UMA cor + trilho neutro, nunca duas cores que o
 *  leitor precise distinguir. O número escrito ao lado carrega o dado; a barra
 *  só dá a proporção de relance. */
function Barra({ deferidos, total }: { deferidos: number; total: number }) {
  const p = pct(deferidos, total);
  return (
    <span className="inline-flex items-center gap-2 w-full">
      <span className="relative h-2 flex-1 min-w-[48px] rounded-full bg-slate-200" aria-hidden="true">
        <span className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${p}%`, background: 'var(--chart-mark)' }} />
      </span>
      <span className="shrink-0 tabular-nums text-[12px] text-slate-600">
        {deferidos}/{total}
      </span>
    </span>
  );
}

/** Tabela textual equivalente ao gráfico — o gráfico é SVG e não é lido por
 *  leitor de tela. Mesmo padrão do TabelaDados do Dashboard. */
function TabelaEquivalente({ titulo, colunas, linhas }: {
  titulo: string; colunas: string[]; linhas: (string | number)[][];
}) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[12px] text-slate-600 hover:underline">
        Ver {titulo} em tabela
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-slate-600">
              {colunas.map(c => <th key={c} className="py-1 pr-3 font-semibold">{c}</th>)}
            </tr>
          </thead>
          <tbody className="tabular-nums text-slate-700">
            {linhas.map((l, i) => (
              <tr key={i} className="border-t border-slate-200">
                {l.map((v, j) => <td key={j} className="py-1 pr-3">{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Colunas verticais. Sem biblioteca: são poucas séries e o desenho precisa
 *  obedecer aos tokens de tema (a skin de fotofobia converte por LISTA de
 *  classes conhecidas, então cor solta some no escuro). */
function Colunas({ dados, rotulo }: {
  dados: { chave: string; total: number; deferidos: number }[];
  rotulo: string;
}) {
  const max = Math.max(1, ...dados.map(d => d.total));
  if (!dados.length) return null;
  return (
    <div>
      <div className="flex items-end gap-1.5 h-28" role="img"
        aria-label={`${rotulo}. ${dados.map(d => `${d.chave}: ${d.total}`).join('; ')}.`}>
        {dados.map(d => (
          <div key={d.chave} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
            <span className="text-[11px] tabular-nums text-slate-600">{d.total}</span>
            <span className="w-full rounded-t"
              style={{ height: `${(d.total / max) * 100}%`, minHeight: 3, background: 'var(--chart-fill)' }}>
              <span className="block w-full rounded-t"
                style={{ height: `${pct(d.deferidos, d.total)}%`, background: 'var(--chart-mark)' }} />
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1">
        {dados.map(d => (
          <span key={d.chave} className="flex-1 min-w-0 text-center text-[12px] text-slate-600 truncate"
            title={d.chave}>{d.chave}</span>
        ))}
      </div>
    </div>
  );
}

export default function RevalidacaoApi() {
  const [dados, setDados] = useState<ds.RevalResp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [via, setVia] = useState<Via>('Graduação');

  useEffect(() => {
    let vivo = true;
    ds.getRevalidacao().then(r => { if (vivo) { setDados(r); setCarregando(false); } });
    return () => { vivo = false; };
  }, []);

  const daVia = useMemo(() => {
    if (!dados) return null;
    const filtra = <T extends { via: string }>(xs: T[]) => xs.filter(x => x.via === via);
    return {
      resumo: dados.resumo.find(r => r.via === via) || { via, total: 0, deferidos: 0 },
      serie: filtra(dados.serie),
      niveis: filtra(dados.niveis),
      tramitacao: filtra(dados.tramitacao),
      paises: filtra(dados.paises),
      cursos: filtra(dados.cursos),
      instituicoes: filtra(dados.instituicoes),
    };
  }, [dados, via]);

  if (carregando) {
    return (
      <div className="flex items-center gap-2 p-6 text-slate-600">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        <span className="text-[13px]">Carregando revalidações…</span>
      </div>
    );
  }

  if (!dados || !daVia || !dados.resumo.length) {
    return (
      <div className="p-6">
        <p className="text-[13px] text-slate-700">
          Ainda não há revalidações no acervo.
        </p>
        <p className="mt-2 text-[13px] text-slate-600">
          Os dados aparecem depois que a extração reprocessar os boletins e a
          importação rodar. Se o portal estiver no modo de contingência, esta
          aba fica indisponível — ela depende do banco.
        </p>
      </div>
    );
  }

  const { resumo, serie, niveis, tramitacao, paises, cursos, instituicoes } = daVia;
  const min = dados.minimoParaTaxa;
  const t = taxa(resumo.deferidos, resumo.total, min);
  const noPrazo = tramitacao.find(x => x.anos === 0);

  return (
    <div className="p-3 md:p-4 space-y-4">
      <header>
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <GraduationCap className="w-5 h-5 text-[#1B6B3A]" aria-hidden="true" />
          Revalidação de diplomas do exterior
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-700">
          O que a UFF decidiu sobre pedidos de revalidação e reconhecimento de
          diplomas obtidos fora do Brasil, a partir dos atos publicados no
          Boletim de Serviço. <strong>Só números agregados</strong> — esta aba
          não identifica quem pediu.
        </p>
        {/* Aviso de consolidação.
            Fica no cabeçalho, e não em rodapé, porque o risco que ele cobre é
            alguém citar esses números como total — inclusive em resposta a
            órgão de controle — e eles mudarem depois.
            Medido em 17/08/2026: o texto dos atos guardado no banco é cortado
            em 7.000 caracteres, e em 623 atos o dispositivo pode estar depois
            do corte. Os números aqui são um PISO verificado, não um total
            comprovado. Sai quando o acervo for reprocessado a partir dos PDFs. */}
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-[12px] leading-relaxed text-amber-700">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>Série em consolidação.</strong> Os números representam os
            atos já processados, e não o total histórico — o acervo mais antigo
            ainda está sendo incorporado. Para citar em relatório ou resposta
            oficial, trate-os como <strong>mínimo verificado</strong>.
          </span>
        </p>
      </header>

      {/* Os dois processos são distintos (normas, colegiados e prazos
          diferentes), então a troca é explícita e nunca somada. */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Escolher o tipo de revalidação">
        {VIAS.map(v => {
          const r = dados.resumo.find(x => x.via === v);
          const ativo = v === via;
          return (
            <button key={v} type="button" onClick={() => setVia(v)} aria-pressed={ativo}
              className={`rounded-lg border px-3 py-2 text-[13px] font-semibold transition
                ${ativo
                  ? 'border-[#1B6B3A] bg-[#F0F7F0] text-[#1A3A1A]'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>
              {v}
              <span className="ml-2 font-normal tabular-nums text-slate-600">
                {r ? r.total : 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Resumo da via escolhida */}
      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <h3 className="text-[13px] font-bold text-slate-900">Resumo — {via}</h3>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <p className="text-xl font-bold tabular-nums text-slate-900">{resumo.total}</p>
            <p className="text-[12px] text-slate-600">pedidos decididos</p>
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums text-slate-900">{resumo.deferidos}</p>
            <p className="text-[12px] text-slate-600">deferidos</p>
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums text-slate-900">{resumo.total - resumo.deferidos}</p>
            <p className="text-[12px] text-slate-600">indeferidos</p>
          </div>
          <div>
            <p className="text-xl font-bold tabular-nums text-slate-900">{t === null ? '—' : `${t}%`}</p>
            <p className="text-[12px] text-slate-600">
              {t === null ? `amostra menor que ${min}` : 'deferidos'}
            </p>
          </div>
        </div>
      </section>

      {/* Tramitação — o eixo de prazos */}
      {tramitacao.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="flex items-center gap-2 text-[13px] font-bold text-slate-900">
            <Clock className="w-4 h-4 text-slate-600" aria-hidden="true" />
            Quanto tempo entre abrir o processo e decidir
          </h3>
          <p className="mt-1 flex items-start gap-1.5 text-[12px] leading-relaxed text-slate-600">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>Aproximação.</strong> O Boletim de Serviço publica a
              decisão, não a data em que o pedido foi protocolado. O que se
              mede aqui é a diferença entre o <strong>ano do processo</strong> e
              o ano da decisão — serve para ver a fila, não para aferir o prazo
              de 60 ou 180 dias da Resolução CNE/CES nº 1/2022.
            </span>
          </p>
          <div className="mt-3">
            <Colunas rotulo={`Pedidos por tempo até a decisão, ${via}`}
              dados={tramitacao.map(x => ({
                chave: x.anos === 0 ? 'mesmo ano' : x.anos === 1 ? '1 ano' : `${x.anos} anos`,
                total: x.total, deferidos: x.deferidos,
              }))} />
          </div>
          {noPrazo && (
            <p className="mt-2 text-[13px] text-slate-700">
              <strong className="tabular-nums">{pct(noPrazo.total, resumo.total)}%</strong> dos
              pedidos foram decididos no mesmo ano em que o processo foi aberto.
            </p>
          )}
          <TabelaEquivalente titulo="o tempo até a decisão"
            colunas={['Tempo', 'Pedidos', 'Deferidos']}
            linhas={tramitacao.map(x => [
              x.anos === 0 ? 'mesmo ano' : x.anos === 1 ? '1 ano' : `${x.anos} anos`,
              x.total, x.deferidos])} />
        </section>
      )}

      {/* Série anual */}
      {serie.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-[13px] font-bold text-slate-900">Decisões por ano</h3>
          <div className="mt-3">
            <Colunas rotulo={`Decisões por ano, ${via}`}
              dados={serie.map(x => ({ chave: String(x.ano), total: x.total, deferidos: x.deferidos }))} />
          </div>
          <TabelaEquivalente titulo="as decisões por ano"
            colunas={['Ano', 'Decididos', 'Deferidos']}
            linhas={serie.map(x => [x.ano, x.total, x.deferidos])} />
        </section>
      )}

      {niveis.length > 1 && (
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-[13px] font-bold text-slate-900">Por nível do título</h3>
          <ul className="mt-2 space-y-2">
            {niveis.map(n => (
              <li key={n.nivel} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-[13px] text-slate-700">{n.nivel}</span>
                <Barra deferidos={n.deferidos} total={n.total} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <ListaAgrupada titulo="Países de origem do diploma" rotuloColuna="País"
        itens={paises.map(x => ({ chave: x.pais, total: x.total, deferidos: x.deferidos }))}
        minimo={min} />

      <ListaAgrupada titulo="Cursos mais pedidos" rotuloColuna="Curso"
        itens={cursos.map(x => ({ chave: x.curso, total: x.total, deferidos: x.deferidos }))}
        minimo={min} />

      <ListaAgrupada titulo="Instituições de origem" rotuloColuna="Instituição"
        itens={instituicoes.map(x => ({ chave: x.instituicao, total: x.total, deferidos: x.deferidos }))}
        minimo={min} />

      <p className="text-[12px] leading-relaxed text-slate-600">
        Fonte: atos publicados no Boletim de Serviço da UFF. Cada pedido é
        decidido por um ato próprio, acessível pela busca do portal. Uma taxa de
        deferimento baixa costuma refletir a documentação apresentada em cada
        processo, e não a qualidade da instituição de origem — por isso a taxa
        só aparece a partir de {min} pedidos.
      </p>
    </div>
  );
}

/** Lista país/curso/instituição: cartões no mobile, tabela no desktop — o par
 *  que a trava de regressão do redesign exige (test_redesign_integrity.mjs). */
function ListaAgrupada({ titulo, rotuloColuna, itens, minimo }: {
  titulo: string; rotuloColuna: string; minimo: number;
  itens: { chave: string; total: number; deferidos: number }[];
}) {
  const [tudo, setTudo] = useState(false);
  if (!itens.length) return null;
  const mostrar = tudo ? itens : itens.slice(0, 10);

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <h3 className="px-3 pt-3 text-[13px] font-bold text-slate-900">{titulo}</h3>

      <RecordCardList className="p-3">
        {mostrar.map(i => {
          const t = taxa(i.deferidos, i.total, minimo);
          return (
            <RecordCard key={i.chave} titulo={i.chave}
              campos={[
                { rotulo: 'Pedidos', valor: String(i.total) },
                { rotulo: 'Deferidos', valor: String(i.deferidos) },
                { rotulo: 'Taxa', valor: t === null ? `amostra < ${minimo}` : `${t}%` },
              ]} />
          );
        })}
      </RecordCardList>

      <DesktopTable className="px-3 pb-3">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="py-1.5 pr-3 font-semibold">{rotuloColuna}</th>
              <th className="py-1.5 pr-3 font-semibold text-right">Pedidos</th>
              <th className="py-1.5 pr-3 font-semibold text-right">Deferidos</th>
              <th className="py-1.5 font-semibold w-40">Proporção</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {mostrar.map(i => {
              const t = taxa(i.deferidos, i.total, minimo);
              return (
                <tr key={i.chave} className="border-t border-slate-200">
                  <td className="py-1.5 pr-3">{i.chave}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{i.total}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {i.deferidos}
                    {t !== null && <span className="ml-1 text-slate-600">({t}%)</span>}
                    {t === null && <span className="ml-1 text-slate-600">(amostra &lt; {minimo})</span>}
                  </td>
                  <td className="py-1.5"><Barra deferidos={i.deferidos} total={i.total} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DesktopTable>

      {itens.length > 10 && (
        <div className="px-3 pb-3">
          <button type="button" onClick={() => setTudo(v => !v)} aria-expanded={tudo}
            className="rounded border border-slate-200 px-2 py-1 text-[12px] font-semibold text-slate-700 hover:border-slate-400">
            {tudo ? 'Mostrar só os 10 primeiros' : `Ver todos os ${itens.length}`}
          </button>
        </div>
      )}
    </section>
  );
}
