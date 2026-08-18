import React, { useEffect, useMemo, useState } from 'react';
import { GraduationCap, Loader2, Info, Clock, Globe2 } from 'lucide-react';
import * as ds from '../../dataSource';
import { RecordCard, RecordCardList, DesktopTable } from '../ui/RecordCard';
import { MapaMundi, LegendaTamanho, type PontoMapa } from '../ui/MapaMundi';

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
  // País destacado no mapa. Mora aqui, e não dentro do mapa, porque a
  // seleção também grifa a linha na lista — o mapa mostra ONDE, a lista diz
  // QUANTO, e clicar num lugar tem de acender os dois.
  const [paisSel, setPaisSel] = useState('');
  // Qual recorte da lista de origem esta visivel. 'paises' primeiro porque
  // e o que o mapa acima acabou de mostrar.
  const [recorte, setRecorte] = useState<'paises' | 'cursos' | 'instituicoes'>('paises');

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

  // Quem tem coordenada vai ao mapa; quem não tem é CONTADO e declarado ao pé
  // dele. O balão traz total e deferidos porque a bolha só carrega um sinal
  // (grandeza) — o segundo número tem de vir escrito.
  const noMapa: PontoMapa[] = paises
    .filter(p => typeof p.lat === 'number' && typeof p.lon === 'number')
    .map(p => ({
      pais: p.pais, valor: p.total, lat: p.lat as number, lon: p.lon as number,
      detalhe: `${p.pais} — ${p.total} pedido(s), ${p.deferidos} deferido(s)`,
    }));
  const foraDoMapa = paises.filter(p => typeof p.lat !== 'number' || typeof p.lon !== 'number');

  // Os seis maiores, que e o que cabe ao lado do mapa sem virar rolagem.
  const topoPaises = [...noMapa].sort((a, b) => b.valor - a.valor).slice(0, 6);

  const RECORTES = [
    {
      chave: 'paises' as const, titulo: 'Países de origem', coluna: 'País',
      itens: paises.map(x => ({ chave: x.pais, total: x.total, deferidos: x.deferidos })),
    },
    {
      chave: 'cursos' as const, titulo: 'Cursos', coluna: 'Curso',
      itens: cursos.map(x => ({ chave: x.curso, total: x.total, deferidos: x.deferidos })),
    },
    {
      chave: 'instituicoes' as const, titulo: 'Instituições de origem', coluna: 'Instituição',
      itens: instituicoes.map(x => ({ chave: x.instituicao, total: x.total, deferidos: x.deferidos })),
    },
  ];
  const RECORTE_ATIVO = RECORTES.find(r => r.chave === recorte) ?? RECORTES[0];

  return (
    <div className="p-3 md:p-4 space-y-4">
      {/* CABEÇALHO EM FAIXA, com o selo de privacidade ao lado do título.
          O selo estava só na prosa ("Só números agregados"), onde some na
          leitura rápida. Esta aba trata de pedidos individuais de pessoas que
          NÃO são servidoras — quem chega tem de ver, antes de qualquer número,
          que nada aqui identifica ninguém. */}
      <header className="rounded-lg bg-[#003366] p-4 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <GraduationCap className="w-5 h-5 text-yellow-400" aria-hidden="true" />
              Revalidação de diplomas do exterior
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-blue-100">
              O que a UFF decidiu sobre pedidos de revalidação e reconhecimento de
              diplomas obtidos fora do Brasil, a partir dos atos publicados no
              Boletim de Serviço.
            </p>
          </div>
          <p className="shrink-0 rounded-md bg-white/10 px-2.5 py-1.5 text-[12px] font-semibold text-blue-50">
            Dados agregados · sem identificação de pessoas
          </p>
        </div>
      </header>

      {/* Aviso de consolidação.
          Fica no topo, e não em rodapé, porque o risco que ele cobre é alguém
          citar esses números como total — inclusive em resposta a órgão de
          controle — e eles mudarem depois. Os números aqui são um PISO
          verificado. Sai quando a etapa 8 do plano de reprocessamento fechar. */}
      <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] leading-relaxed text-amber-700">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          <strong>Série em consolidação.</strong> Os números representam os
          atos já processados, e não o total histórico — o acervo mais antigo
          ainda está sendo incorporado. Para citar em relatório ou resposta
          oficial, trate-os como <strong>mínimo verificado</strong>.
        </span>
      </p>

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
      {/* INDICADORES EM CARTÕES.
          Eram quatro números soltos dentro de um cartão só; agora cada um tem
          o seu, com o valor em corpo grande — a maquete de 17/08/2026 tinha
          razão em dar peso ao número, que é o que se lê primeiro.

          ⚠️ INDEFERIDO NÃO É ERRO, e por isso NÃO leva vermelho.
          A maquete propunha um X vermelho ali. Vermelho neste portal significa
          ato revogado, e aplicá-lo a um indeferimento carimba como falha a
          decisão de um colegiado sobre o pedido de uma pessoa. Deferido leva a
          cor da marca; indeferido fica neutro. A informação é a mesma; o juízo
          embutido, não. */}
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { valor: String(resumo.total), rotulo: 'pedidos decididos', apoio: via, destaque: false },
          { valor: String(resumo.deferidos), rotulo: 'deferidos', apoio: 'pedido atendido', destaque: true },
          { valor: String(resumo.total - resumo.deferidos), rotulo: 'indeferidos', apoio: 'pedido não atendido', destaque: false },
          {
            valor: t === null ? '—' : `${t}%`,
            rotulo: 'taxa de deferimento',
            apoio: t === null ? `amostra menor que ${min}` : `de ${resumo.total} pedidos`,
            destaque: false,
          },
        ].map(c => (
          <div key={c.rotulo}
            className={`rounded-lg border p-3 ${c.destaque
              ? 'border-[#1B6B3A]/30 bg-[#F0F7F0]'
              : 'border-slate-200 bg-white'}`}>
            <dd className={`text-2xl font-bold tabular-nums leading-tight ${c.destaque
              ? 'text-[#1A3A1A]' : 'text-slate-900'}`}>
              {c.valor}
            </dd>
            <dt className="text-[13px] font-semibold text-slate-700 mt-0.5">{c.rotulo}</dt>
            <p className="text-[12px] text-slate-500 leading-snug">{c.apoio}</p>
          </div>
        ))}
      </dl>

      {/* Tramitação — o eixo de prazos */}
      {/* DUAS COLUNAS: os dois gráficos respondem perguntas de eixos
          diferentes — quanto tempo leva, e quanto acontece por ano — e ficavam
          empilhados, forçando rolagem entre eles. Lado a lado no desktop,
          empilhados no celular (`lg:`), que é a regra de sempre: gráfico
          horizontal vira cartão empilhado na tela estreita. */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
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
      </div>

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

      {/* MAPA — a âncora visual da aba.
          O assunto é "diploma obtido FORA do Brasil", e até aqui isso era só
          uma coluna de nomes de país. O mapa responde de relance a pergunta que
          a lista responde só depois de lida: de onde vem o acervo.
          A bolha mede GRANDEZA (área ∝ pedidos), não taxa de deferimento —
          uma marca, um sinal. A taxa continua na lista logo abaixo, onde o
          número exato pode ser lido. */}
      {noMapa.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="flex items-center gap-2 text-[13px] font-bold text-slate-900">
            <Globe2 className="w-4 h-4 text-slate-600" aria-hidden="true" />
            De onde vêm os diplomas — {via}
          </h3>
          <div className="mt-3">
            <MapaMundi
              pontos={noMapa}
              selecionado={paisSel}
              aoSelecionar={setPaisSel}
              unidade="pedido(s)"
              rotulo={`Mapa-múndi com ${noMapa.length} países de origem dos diplomas, `
                + `bolhas proporcionais ao número de pedidos de ${via.toLowerCase()}. `
                + `A tabela logo abaixo traz os mesmos números.`}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-end gap-4">
            <LegendaTamanho max={Math.max(...noMapa.map(p => p.valor))} unidade="pedidos" />
            <p className="text-[12px] leading-relaxed text-slate-600 flex-1 min-w-[200px]">
              Clique num país para destacá-lo, na lista e no mapa. A área da bolha é
              proporcional ao número de pedidos.
            </p>
          </div>

          {/* RANKING AO LADO DO MAPA.
              O mapa responde ONDE; ele não responde QUANTO — círculo não se
              lê em número, e os cinco maiores se sobrepõem na América do Sul.
              A lista ao lado carrega o valor exato, e é ela que funciona no
              celular, onde o mapa vira faixa estreita. É a mesma divisão de
              trabalho da aba Cooperação. */}
          <div className="mt-4 grid lg:grid-cols-[1fr_auto] gap-4 items-start">
            <div>
              <RecordCardList className="space-y-2">
                {topoPaises.map((pt, i) => {
                  const def = paises.find(x => x.pais === pt.pais)?.deferidos ?? 0;
                  return (
                    <RecordCard key={pt.pais} titulo={`${i + 1}. ${pt.pais}`}
                      campos={[
                        { rotulo: 'Pedidos', valor: String(pt.valor) },
                        { rotulo: 'Deferidos', valor: String(def) },
                      ]}
                      acoes={
                        <button type="button"
                          onClick={() => setPaisSel(paisSel === pt.pais ? '' : pt.pais)}
                          className="text-[12px] font-semibold text-blue-700 underline">
                          {paisSel === pt.pais ? 'Tirar destaque' : 'Destacar no mapa'}
                        </button>
                      } />
                  );
                })}
              </RecordCardList>

              <DesktopTable>
                <table className="w-full text-[13px]">
                  <caption className="sr-only">
                    Países de origem com mais pedidos de {via.toLowerCase()}, com deferimentos.
                  </caption>
                  <thead>
                    <tr className="text-left text-slate-600 border-b border-slate-200">
                      <th scope="col" className="py-1.5 pr-3 font-semibold">Origem</th>
                      <th scope="col" className="py-1.5 pr-3 font-semibold text-right">Pedidos</th>
                      <th scope="col" className="py-1.5 pr-3 font-semibold text-right">Deferidos</th>
                      <th scope="col" className="py-1.5 font-semibold w-32">Proporção</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700">
                    {topoPaises.map((pt, i) => {
                      const def = paises.find(x => x.pais === pt.pais)?.deferidos ?? 0;
                      const sel = paisSel === pt.pais;
                      return (
                        <tr key={pt.pais}
                          className={`border-b border-slate-100 ${sel ? 'bg-[var(--destaque-fundo)]' : ''}`}>
                          <td className="py-1.5 pr-3">
                            <span className="inline-block w-5 text-slate-400 tabular-nums">{i + 1}</span>
                            <button type="button" onClick={() => setPaisSel(sel ? '' : pt.pais)}
                              className="underline decoration-dotted underline-offset-2 hover:text-[#1B6B3A]">
                              {pt.pais}
                            </button>
                          </td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{pt.valor}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums">{def}</td>
                          <td className="py-1.5"><Barra deferidos={def} total={pt.valor} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </DesktopTable>
            </div>

            {/* A LACUNA COMO CARTÃO, e não como frase no fim de um parágrafo.
                São pedidos que existem e não aparecem no mapa; escondê-los faria
                a soma dos círculos não fechar com o total do topo. */}
            {foraDoMapa.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 lg:w-52">
                <p className="text-xl font-bold tabular-nums text-amber-700">
                  {foraDoMapa.reduce((s, x) => s + x.total, 0)}
                </p>
                <p className="text-[12px] leading-snug text-amber-700">
                  pedidos fora do mapa: o ato não nomeia o país, ou o país ainda não
                  tem coordenada cadastrada. Eles continuam contados no total e na
                  lista completa.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* AS TRÊS LISTAS VIRAM ABAS.
          Empilhadas, somavam três tabelas longas e o visitante rolava por
          centenas de linhas até o rodapé. São a MESMA pergunta ("de onde vêm
          os pedidos") vista por três recortes, então cabem no mesmo lugar com
          um seletor — que é o que a maquete de 17/08/2026 propôs.

          `role="tablist"` de verdade, com `aria-selected` e painel ligado por
          `aria-controls`: um seletor que só muda a cor do botão deixa quem usa
          leitor de tela sem saber o que mudou na página. */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-1 border-b border-slate-200 p-2" role="tablist"
          aria-label="Recorte da lista de origem">
          {RECORTES.map(r => {
            const ativo = r.chave === recorte;
            return (
              <button key={r.chave} type="button" role="tab" id={`aba-${r.chave}`}
                aria-selected={ativo} aria-controls={`painel-${r.chave}`}
                onClick={() => setRecorte(r.chave)}
                className={`rounded-md px-3 py-1.5 text-[13px] font-semibold transition ${ativo
                  ? 'bg-[#1B6B3A] text-white'
                  : 'text-slate-700 hover:bg-slate-100'}`}>
                {r.titulo}
                <span className={`ml-1.5 font-normal tabular-nums ${ativo ? 'text-white/80' : 'text-slate-500'}`}>
                  {r.itens.length}
                </span>
              </button>
            );
          })}
        </div>
        <div id={`painel-${recorte}`} role="tabpanel" aria-labelledby={`aba-${recorte}`}>
          <ListaAgrupada titulo={RECORTE_ATIVO.titulo} rotuloColuna={RECORTE_ATIVO.coluna}
            itens={RECORTE_ATIVO.itens} minimo={min}
            destaque={recorte === 'paises' ? paisSel : ''} />
        </div>
      </section>

      <div className="grid sm:grid-cols-2 gap-3">
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-600">
          <strong>Fonte:</strong> atos publicados no Boletim de Serviço da UFF. Cada pedido é
          decidido por um ato próprio, acessível pela busca do portal. Uma taxa de
          deferimento baixa costuma refletir a documentação apresentada em cada
          processo, e não a qualidade da instituição de origem — por isso a taxa
          só aparece a partir de {min} pedidos.
        </p>
        {/* O convite à correção fica NA ABA, e não só na página Sobre: quem
            encontra um erro aqui está olhando para ele agora, e é aqui que a
            informação de que ele existe tem mais valor. */}
        <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-600">
          <strong>Achou um ato errado ou faltando?</strong> O acervo é reprocessado
          periodicamente e cada correção apontada entra na próxima rodada. Escreva para{' '}
          <a href="mailto:nidi.gar@id.uff.br" className="font-semibold text-blue-700 underline">
            nidi.gar@id.uff.br
          </a>{' '}
          dizendo o tipo, número e ano do ato.
        </p>
      </div>
    </div>
  );
}

/** Lista país/curso/instituição: cartões no mobile, tabela no desktop — o par
 *  que a trava de regressão do redesign exige (test_redesign_integrity.mjs). */
function ListaAgrupada({ titulo, rotuloColuna, itens, minimo, destaque = '' }: {
  titulo: string; rotuloColuna: string; minimo: number; destaque?: string;
  itens: { chave: string; total: number; deferidos: number }[];
}) {
  const [tudo, setTudo] = useState(false);
  if (!itens.length) return null;
  // O destacado vem PRIMEIRO. Sem isso, clicar num país pequeno no mapa não
  // mostraria nada: a lista corta em 10 e ele ficaria escondido atrás do
  // "ver todos", que é o oposto do que o clique promete.
  const ordenados = destaque
    ? [...itens].sort((a, b) => Number(b.chave === destaque) - Number(a.chave === destaque))
    : itens;
  const mostrar = tudo ? ordenados : ordenados.slice(0, 10);

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
                <tr key={i.chave}
                  className={`border-t border-slate-200 ${i.chave === destaque ? 'bg-[var(--destaque-fundo)]' : ''}`}>
                  <td className="py-1.5 pr-3">
                    {i.chave === destaque && <span className="sr-only">Selecionado no mapa: </span>}
                    {i.chave}
                  </td>
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
