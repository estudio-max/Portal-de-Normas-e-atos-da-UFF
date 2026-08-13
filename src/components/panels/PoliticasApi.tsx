import React, { useEffect, useMemo, useState } from 'react';
import { Landmark, BookMarked, Loader2, Info, ExternalLink, Search, X, ChevronRight, ArrowLeft, SlidersHorizontal } from 'lucide-react';
import * as ds from '../../dataSource';
import { RecordCard, RecordCardList, DesktopTable } from '../ui/RecordCard';
import { CartaoGrade, GradeCartoes } from '../ui/CartaoGrade';
import { PainelFiltros, rotuloFiltro, campoFiltro, ajudaFiltro } from '../ui/PainelFiltros';

// Aba "Políticas": o dossiê temático. Em vez de atos soltos numa busca, o
// assunto institucional e a sequência de atos que o construíram.
//
// O que esta aba tem e as outras não é o PAPEL: o que o ato FAZ pela política
// (institui, regulamenta, dá governança, executa, monitora). Sem isso,
// "designa comissão" contaria como execução, e política com muitas designações
// pareceria em andamento. É a mesma separação que o `vinculo` faz nas ODS.
//
// O catálogo é CURADO (tools/gerar_seed_politicas.py) e nasce em rascunho. O
// selo de curadoria fica visível: o portal já mostra método e confiança em toda
// inferência, e "catálogo em revisão" é a mesma categoria de informação.

const fmtData = (s: string | null) =>
  s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : '—';

// O ciclo de vida documental de uma política, na ordem em que costuma ocorrer.
// A aba mostra as etapas SEM evidência como lacuna — que é diferente de
// afirmar que a etapa não aconteceu. Ela pode ter acontecido fora do Boletim.
const CICLO: { papel: ds.PoliticaPapel; rotulo: string }[] = [
  { papel: 'fundador', rotulo: 'Instituição' },
  { papel: 'regulamentacao', rotulo: 'Regulamentação' },
  { papel: 'governanca', rotulo: 'Governança' },
  { papel: 'execucao', rotulo: 'Execução' },
  { papel: 'monitoramento', rotulo: 'Monitoramento' },
  { papel: 'avaliacao', rotulo: 'Avaliação' },
];

const COR_PAPEL: Record<string, string> = {
  fundador: 'bg-[#003366] text-white border-[#003366]',
  regulamentacao: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  governanca: 'bg-violet-50 text-violet-700 border-violet-200',
  execucao: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  monitoramento: 'bg-sky-50 text-sky-700 border-sky-200',
  avaliacao: 'bg-teal-50 text-teal-700 border-teal-200',
  alteracao: 'bg-amber-50 text-amber-700 border-amber-200',
  revogacao: 'bg-rose-50 text-rose-700 border-rose-200',
  referencia: 'bg-slate-50 text-slate-600 border-slate-200',
};

const ROTULO_PAPEL: Record<string, string> = {
  fundador: 'Institui', regulamentacao: 'Regulamenta', governanca: 'Governança',
  execucao: 'Executa', monitoramento: 'Monitora', avaliacao: 'Avalia',
  alteracao: 'Altera', revogacao: 'Revoga', referencia: 'Menciona',
};

function PapelChip({ papel }: { papel: string }) {
  return (
    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${COR_PAPEL[papel] ?? COR_PAPEL.referencia}`}>
      {ROTULO_PAPEL[papel] ?? papel}
    </span>
  );
}

// Confiança da inferência. 'alta' = a frase da política está na ementa;
// 'media' = veio do órgão emissor, sem a frase. O usuário precisa distinguir.
function ConfiancaChip({ c, justificativa }: { c: string; justificativa: string | null }) {
  if (c === 'alta') return null;   // o padrão não precisa de selo
  return (
    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200"
      title={justificativa ? `Vínculo inferido — ${justificativa}` : 'Vínculo inferido, confiança média'}>
      ⚠ confiança {c}
    </span>
  );
}

function EstagioChip({ estagio }: { estagio: string }) {
  if (estagio === 'publicada') return null;
  if (estagio === 'arquivada') return (
    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border bg-slate-100 text-slate-500 border-slate-200">
      arquivada</span>);
  return (
    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border bg-slate-50 text-slate-500 border-slate-200"
      title="O catálogo desta política ainda está em curadoria: os vínculos foram propostos por regra e não passaram por revisão humana.">
      catálogo em revisão</span>);
}

// A CATEGORIA VEM DO PDI DA UFF, e o selo diz em que base o encaixe foi feito.
//
// Como o ConfiancaChip acima, o caso PADRÃO não ganha marca: quando o PDI tem
// um subtema com aquele nome, não há o que ressalvar. Marca-se só o que exige
// ressalva — senão o selo vira ruído e ninguém lê o que importa.
const PDI_BASE: Record<string, { marca: string; explica: string }> = {
  conteudo: {
    marca: 'por conteúdo',
    explica: 'O PDI não usa esta palavra, mas o subtema descreve o tema: prevê protocolo '
      + 'de atendimento a situações de violência de gênero e encaminhamento de denúncias '
      + 'de discriminação, sob a CPEG e a AFIDE.',
  },
  afinidade: {
    marca: 'por afinidade',
    explica: 'Atribuição do portal, não do PDI: o plano não trata deste tema em subtema '
      + 'nenhum. É o destino mais próximo — o órgão que emite os atos é o comitê de '
      + 'governança, integridade, riscos e controles.',
  },
};

function SubtemaPdi({ pdi, escuro = false }: { pdi: ds.PoliticaPdi; escuro?: boolean }) {
  const nota = PDI_BASE[pdi.base];
  const titulo = `PDI ${pdi.versao ?? ''} · eixo ${pdi.eixo}`
    + (nota ? ` — ${nota.explica}` : ' — o PDI nomeia este subtema.');
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border ${escuro
      ? 'bg-blue-800 text-blue-50 border-blue-700'
      : 'bg-slate-50 text-slate-600 border-slate-200'}`} title={titulo}>
      {pdi.subtema}
      {nota && (
        <span className={escuro ? 'text-amber-200' : 'text-amber-700'}>· {nota.marca}</span>
      )}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const cor = status === 'Revogado' ? 'bg-rose-50 text-rose-700 border-rose-200'
    : status === 'Alterado' ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${cor}`}>{status}</span>;
}

// Faixa do ciclo: etapa com evidência acende; sem evidência fica apagada e diz
// "sem evidência localizada" — nunca "não fez".
function Ciclo({ papeis }: { papeis: Partial<Record<ds.PoliticaPapel, number>> }) {
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {CICLO.map(({ papel, rotulo }) => {
        const n = papeis[papel] ?? 0;
        return (
          <span key={papel}
            title={n > 0 ? `${n} ato(s) de ${rotulo.toLowerCase()}` : `${rotulo}: sem evidência localizada no Boletim`}
            className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${n > 0
              ? COR_PAPEL[papel]
              : 'bg-white text-slate-300 border-dashed border-slate-200'}`}>
            {rotulo}{n > 0 ? ` ${n}` : ''}
          </span>
        );
      })}
    </div>
  );
}

// ---- as etapas do ciclo, e quando cada uma apareceu ------------------------
//
// Este bloco existe no lugar de uma NOTA. A pontuação prevista no projeto foi
// simulada sobre os dados reais e reprovada: cinco das sete políticas
// empatavam, a assistência estudantil (38 atos) empatava com a acessibilidade
// (8), e o assédio — a única com plano central — aparecia como a menos madura.
// Contagem e data são fato; nota exigiria arbitrar pesos que o projeto não
// define, e o número apareceria na tela como se fosse medida.
function EtapasDaPolitica({ etapas, historico }: {
  etapas: Partial<Record<ds.PoliticaPapel, ds.PoliticaEtapa>>;
  historico: ds.PoliticaSnapshot[];
}) {
  // "Ganhou monitoramento em março" só se sabe comparando um snapshot com o
  // anterior. A série vem do mais novo para o mais antigo, e só ganha ponto
  // quando o vetor muda — então cada par consecutivo é uma mudança real.
  const ganhos = useMemo(() => {
    const out: { etapa: ds.PoliticaPapel; em: string }[] = [];
    for (let i = 0; i < historico.length - 1; i++) {
      const novo = historico[i].etapas, velho = historico[i + 1].etapas;
      for (const { papel } of CICLO) {
        if ((novo[papel] ?? 0) > 0 && (velho[papel] ?? 0) === 0) {
          out.push({ etapa: papel, em: historico[i].em });
        }
      }
    }
    return out;
  }, [historico]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 mb-3">
      <h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-2">
        Etapas do ciclo — quando cada uma apareceu
      </h4>
      <ul className="space-y-1.5">
        {CICLO.map(({ papel, rotulo }) => {
          const e = etapas[papel];
          return (
            <li key={papel} className="flex flex-wrap items-baseline gap-2 text-[12px]">
              <span className="w-32 shrink-0">
                <PapelChip papel={papel} />
              </span>
              {e ? (
                <span className="text-slate-600">
                  <strong>{e.n}</strong> ato(s) ·{' '}
                  {e.primeira === e.ultima
                    ? <>em {fmtData(e.primeira)}</>
                    : <>de {fmtData(e.primeira)} a {fmtData(e.ultima)}</>}
                </span>
              ) : (
                <span className="text-slate-400 italic">
                  sem evidência localizada no Boletim
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {ganhos.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-100">
          <p className="text-[12px] text-slate-500">
            {ganhos.map((g, i) => (
              <span key={`${g.etapa}-${i}`}>
                {i > 0 && ' · '}
                {/* o rótulo do CICLO é substantivo ("Monitoramento"); o de
                    ROTULO_PAPEL é verbo ("Monitora") e não cabe depois de
                    "ganhou". */}
                ganhou <strong>{(CICLO.find(c => c.papel === g.etapa)?.rotulo ?? g.etapa).toLowerCase()}</strong> em{' '}
                {fmtData(g.em.slice(0, 10))}
              </span>
            ))}
          </p>
        </div>
      )}
    </div>
  );
}

// ---- detalhe: a linha do tempo de uma política ----------------------------
function Detalhe({ slug, onVoltar }: { slug: string; onVoltar: () => void }) {
  const [d, setD] = useState<ds.PoliticaDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [papelF, setPapelF] = useState('');

  useEffect(() => {
    setCarregando(true);
    ds.getPoliticaAtos(slug).then(setD).finally(() => setCarregando(false));
  }, [slug]);

  const atos = useMemo(
    () => (d?.atos ?? []).filter(a => !papelF || a.papel === papelF), [d, papelF]);
  const papeisPresentes = useMemo(() => {
    const s = new Set<string>();
    for (const a of d?.atos ?? []) s.add(a.papel);
    return [...s];
  }, [d]);

  return (
    <div>
      <button onClick={onVoltar}
        className="flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline mb-3">
        <ArrowLeft className="w-3.5 h-3.5" /> Todas as políticas
      </button>
      {carregando && (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando a linha do tempo…
        </div>
      )}
      {!carregando && !d && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800" role="alert">
          Não foi possível carregar esta política agora.
        </div>
      )}
      {!carregando && d && (
        <>
          <div className="bg-[#003366] text-white rounded-lg p-4 mb-3">
            <div className="flex items-center flex-wrap gap-2">
              <h3 className="text-base font-bold">{d.politica.nome}</h3>
              {d.politica.pdi && <SubtemaPdi pdi={d.politica.pdi} escuro />}
              <EstagioChip estagio={d.politica.estagio} />
            </div>
            {d.politica.descricao && (
              <p className="text-[12px] text-blue-100 mt-1 leading-relaxed">{d.politica.descricao}</p>
            )}
            <p className="text-[12px] text-blue-100 mt-1">
              {d.atos.length} ato(s) localizados no Boletim de Serviço.
            </p>
          </div>

          {d.avisos.length > 0 && (
            <div className="flex items-start gap-2 text-[12px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
              <ul className="space-y-0.5">
                {d.avisos.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          <EtapasDaPolitica etapas={d.etapas} historico={d.historico} />

          {papeisPresentes.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <button onClick={() => setPapelF('')}
                className={`px-2.5 py-1 rounded text-[12px] font-bold border transition ${!papelF
                  ? 'bg-[#003366] text-white border-[#003366]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                Todos ({d.atos.length})
              </button>
              {papeisPresentes.map(p => (
                <button key={p} onClick={() => setPapelF(p)}
                  className={`px-2.5 py-1 rounded text-[12px] font-bold border transition ${papelF === p
                    ? 'bg-[#003366] text-white border-[#003366]'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                  {ROTULO_PAPEL[p] ?? p} ({d.atos.filter(a => a.papel === p).length})
                </button>
              ))}
            </div>
          )}

          <RecordCardList>
            {atos.length === 0
              ? <p className="py-6 text-center text-sm text-slate-400">Nenhum ato nesta seleção.</p>
              : atos.map(a => (
                <RecordCard
                  key={`${a.id}-${a.papel}`}
                  titulo={`${a.sigla} nº ${a.numero}/${a.ano}`}
                  selo={<span className="flex items-center gap-1"><PapelChip papel={a.papel} /><StatusChip status={a.status} /></span>}
                  campos={[
                    { rotulo: 'Data', valor: fmtData(a.data) },
                    { rotulo: 'Tipo', valor: a.tipo },
                    { rotulo: 'Vínculo', valor: a.justificativa ?? '—' },
                  ]}
                  texto={a.ementa}
                  acoes={a.link && (
                    <a href={a.link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 underline">
                      Abrir no Boletim <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                />
              ))}
          </RecordCardList>

          <DesktopTable>
            <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[11px]">
                <tr>
                  <th className="text-left px-3 py-2">Ato</th>
                  <th className="text-left px-3 py-2">Data</th>
                  <th className="text-left px-3 py-2">Papel</th>
                  <th className="text-left px-3 py-2">Situação</th>
                  <th className="text-left px-3 py-2 w-1/2">Ementa</th>
                </tr>
              </thead>
              <tbody>
                {atos.map(a => (
                  <tr key={`${a.id}-${a.papel}`} className="border-t border-slate-100 hover:bg-slate-50 align-top">
                    <td className="px-3 py-1.5 whitespace-nowrap font-semibold text-slate-700">
                      {a.link
                        ? <a href={a.link} target="_blank" rel="noopener noreferrer"
                            className="text-blue-700 hover:underline inline-flex items-center gap-1">
                            {a.sigla} nº {a.numero}/{a.ano} <ExternalLink className="w-3 h-3" />
                          </a>
                        : <>{a.sigla} nº {a.numero}/{a.ano}</>}
                      {a.processoSei && (
                        <div className="text-[11px] font-normal text-slate-400">
                          {a.linkSeiProcesso
                            ? <a href={a.linkSeiProcesso} target="_blank" rel="noopener noreferrer" className="hover:underline">SEI {a.processoSei}</a>
                            : <>SEI {a.processoSei}</>}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-slate-500">{fmtData(a.data)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <PapelChip papel={a.papel} />
                        <ConfiancaChip c={a.confianca} justificativa={a.justificativa} />
                      </span>
                    </td>
                    <td className="px-3 py-1.5"><StatusChip status={a.status} /></td>
                    <td className="px-3 py-1.5 text-slate-600">{a.ementa}</td>
                  </tr>
                ))}
                {atos.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                    Nenhum ato nesta seleção.
                  </td></tr>
                )}
              </tbody>
            </table>
          </DesktopTable>
        </>
      )}
    </div>
  );
}

// ---- lista: o catálogo, agrupado por categoria ----------------------------
export default function PoliticasApi() {
  const apiMode = ds.modo() === 'api';
  const [r, setR] = useState<ds.PoliticasResp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [eixoF, setEixoF] = useState('');
  const [estagioF, setEstagioF] = useState('');
  const [comFundador, setComFundador] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false);
  const avancadosAtivos = [estagioF !== '', comFundador].filter(Boolean).length;

  useEffect(() => {
    if (!apiMode) { setCarregando(false); return; }
    ds.getPoliticas().then(setR).finally(() => setCarregando(false));
  }, [apiMode]);

  // Agrupa pelo EIXO do PDI, não pelo subtema: agrupar por subtema daria
  // prateleiras de um item só (é o defeito que a categoria antiga tinha). A
  // busca também alcança o subtema — quem procura "equidade" espera achar as
  // políticas que o PDI põe ali.
  const grupos = useMemo(() => {
    if (!r?.politicas) return [];
    const q = busca.trim().toLowerCase();
    const porEixo = new Map<string, ds.PoliticaResumo[]>();
    for (const p of r.politicas) {
      const alvo = `${p.nome} ${p.descricao ?? ''} ${p.pdi?.subtema ?? ''} ${p.pdi?.eixo ?? ''}`.toLowerCase();
      if (q && !alvo.includes(q)) continue;
      const eixo = p.pdi?.eixo || p.categoria || 'Sem eixo do PDI';
      if (eixoF && eixo !== eixoF) continue;
      if (estagioF && p.estagio !== estagioF) continue;
      if (comFundador && !p.fundador) continue;
      const arr = porEixo.get(eixo) ?? [];
      arr.push(p);
      porEixo.set(eixo, arr);
    }
    for (const arr of porEixo.values()) arr.sort((a, b) => b.atos - a.atos);
    return [...porEixo.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [r, busca, eixoF, estagioF, comFundador]);

  const visiveis = useMemo(
    () => grupos.reduce((n, [, pols]) => n + pols.length, 0), [grupos]);

  // Os eixos do seletor saem do catálogo inteiro, não do resultado filtrado —
  // senão escolher um eixo apagaria os outros da lista e não haveria como voltar.
  const eixos = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of r?.politicas ?? []) {
      const e = p.pdi?.eixo || p.categoria || 'Sem eixo do PDI';
      m.set(e, (m.get(e) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [r]);

  // A edição do PDI sai do próprio dado. Banco não migrado devolve `pdi` nulo,
  // e aí a nota explicativa não aparece — em vez de anunciar uma âncora que a
  // tela não está mostrando.
  const versaoPdi = useMemo(
    () => r?.politicas?.find(p => p.pdi?.versao)?.pdi?.versao ?? null,
    [r]);

  if (!apiMode) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800" role="alert">
        A aba Políticas depende da consulta ao banco. No modo de contingência (índice
        estático), ela fica indisponível.
      </div>
    );
  }
  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando políticas…
      </div>
    );
  }
  if (r?.indisponivel) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800" role="alert">
        O catálogo de políticas ainda não foi carregado neste servidor.
        {r.motivo ? <> ({r.motivo})</> : null}
      </div>
    );
  }
  if (!r) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800" role="alert">
        Não foi possível consultar as políticas agora.
      </div>
    );
  }
  if (sel) return <div id="painel-politicas"><Detalhe slug={sel} onVoltar={() => setSel(null)} /></div>;

  return (
    <div id="painel-politicas" className="space-y-3">
      <div className="bg-[#003366] text-white rounded-lg p-5">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Landmark className="w-5 h-5 text-yellow-400" /> Políticas institucionais
        </h2>
        <p className="text-[13px] text-blue-100 mt-1 leading-relaxed">
          Cada política reúne os atos que a construíram ao longo do tempo — do que a
          instituiu ao que a executa hoje. Clique para ver a sequência completa.
        </p>
      </div>

      <div className="flex items-start gap-2 text-[12px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
        <span>
          A faixa de etapas mostra o <strong>papel</strong> de cada ato: instituir,
          regulamentar, dar governança, executar, monitorar. Etapa <strong>apagada</strong> significa
          que <strong>nenhuma evidência foi localizada no Boletim</strong> — não que ela
          não tenha ocorrido. Atividade pode acontecer fora do Boletim de Serviço.
        </span>
      </div>

      {/* Sem esta nota, "· por afinidade" seria um enigma no cartão. E a nota
          precisa ser lida como ressalva, não como erro: o encaixe não literal
          continua sendo o melhor disponível — só não é o PDI quem o afirma. */}
      {versaoPdi && (
        <div className="flex items-start gap-2 text-[12px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <Landmark className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
          <span>
            Os grupos e as etiquetas de tema são os <strong>eixos e subtemas do PDI {versaoPdi}</strong> da
            UFF — o plano institucional da universidade, não uma classificação do portal.
            Quando o encaixe não é literal, a etiqueta diz por quê:{' '}
            <strong>por conteúdo</strong> (o PDI descreve o tema sem usar a palavra) ou{' '}
            <strong>por afinidade</strong> (o PDI não cobre o tema; a aproximação é nossa).
            Passe o mouse na etiqueta para ver a justificativa.
          </span>
        </div>
      )}

      {/* Mesma barra de Comissões: busca em destaque, um filtro essencial
          visível, o resto no painel lateral compartilhado. */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <label htmlFor="busca-politicas" className="sr-only">Buscar política</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                id="busca-politicas"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar política por nome, tema ou eixo do PDI"
                className="w-full rounded-xl border border-[#E2E8F0] bg-white py-2.5 pl-11 pr-10 text-[14px] text-[#1A202C] placeholder:text-[#64748B] focus:border-[#006400] focus:outline-none"
              />
              {busca && (
                <button onClick={() => setBusca('')} aria-label="Limpar a busca"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#64748B] hover:bg-gray-100">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="sm:w-52">
            <label className={rotuloFiltro} htmlFor="filtro-eixo">Eixo do PDI</label>
            <select id="filtro-eixo" value={eixoF} onChange={e => setEixoF(e.target.value)} className={campoFiltro}>
              <option value="">Todos</option>
              {eixos.map(([e, n]) => <option key={e} value={e}>{e} ({n})</option>)}
            </select>
          </div>

          <button
            onClick={() => setPainelAberto(true)}
            aria-expanded={painelAberto}
            className="flex items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] px-4 py-2 text-[13px] font-medium text-[#1A202C] hover:bg-[#F0F7F0]/60"
          >
            <SlidersHorizontal size={15} /> Mais filtros
            {avancadosAtivos > 0 && (
              <span className="rounded-full bg-[#006400] px-1.5 py-0.5 text-[11px] font-semibold text-white">{avancadosAtivos}</span>
            )}
          </button>
        </div>
      </div>

      <p className="text-[13px] text-[#4A5568]" aria-live="polite">
        <strong className="font-semibold text-[#1A202C]">{visiveis} de {r.politicas?.length ?? 0}</strong>{' '}
        {visiveis === 1 ? 'política' : 'políticas'} no catálogo curado
      </p>

      {grupos.map(([eixo, pols]) => (
        <div key={eixo}>
          <h3 className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-wide text-[#4A5568]">
            {eixo} ({pols.length})
          </h3>
          <GradeCartoes>
            {pols.map(p => (
              <CartaoGrade
                key={p.slug}
                icone={<BookMarked size={20} />}
                titulo={p.nome}
                etiquetas={<EstagioChip estagio={p.estagio} />}
                destaque={{
                  rotulo: 'Subtema do PDI',
                  valor: p.pdi
                    ? <SubtemaPdi pdi={p.pdi} />
                    : <span className="italic text-[#4A5568]">sem encaixe no PDI</span>,
                }}
                campos={[
                  { rotulo: 'Atos', valor: p.atos },
                  {
                    rotulo: 'Período',
                    valor: p.anoMin
                      ? <span className="text-[13px]">{p.anoMin}–{p.anoMax}</span>
                      : <span className="text-[13px] font-normal italic text-[#4A5568]">sem atos</span>,
                  },
                ]}
                rodape={<>
                  {p.fundador
                    ? <>Instituída por <strong className="font-semibold text-[#1A202C]">{p.fundador.label}</strong>.</>
                    : <span className="italic">Ato instituidor não localizado no acervo.</span>}
                  <Ciclo papeis={p.papeis} />
                </>}
                acao="Ver política"
                onClick={() => setSel(p.slug)}
              />
            ))}
          </GradeCartoes>
        </div>
      ))}

      {grupos.length === 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-12 text-center">
          <Info className="mx-auto mb-3 h-7 w-7 text-[#64748B]" />
          <p className="text-[15px] font-semibold text-[#1A202C]">
            {busca ? 'Nenhuma política corresponde a esta consulta.' : 'Nenhuma política no catálogo ainda.'}
          </p>
          {busca && (
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-[#4A5568]">
              O catálogo curado tem {r.politicas?.length ?? 0} políticas. A busca também
              alcança o subtema e o eixo do PDI — tente por tema, não só pelo nome.
            </p>
          )}
        </div>
      )}

      <PainelFiltros
        aberto={painelAberto}
        onFechar={() => setPainelAberto(false)}
        onLimpar={() => { setEstagioF(''); setComFundador(false); }}
      >
        <div>
          <label className={rotuloFiltro} htmlFor="filtro-estagio">Estágio de curadoria</label>
          <select id="filtro-estagio" value={estagioF} onChange={e => setEstagioF(e.target.value)} className={campoFiltro}
            aria-describedby="ajuda-estagio">
            <option value="">Todos</option>
            <option value="publicada">Publicada</option>
            <option value="arquivada">Arquivada</option>
          </select>
          <p id="ajuda-estagio" className={ajudaFiltro}>
            “Publicada” afirma que a <strong>lista de políticas</strong> foi conferida — não
            que cada vínculo entre ato e política tenha sido, o que continua marcado
            ato a ato dentro do dossiê.
          </p>
        </div>

        <fieldset className="space-y-2 border-t border-[#E2E8F0] pt-4">
          <legend className="text-[12px] font-medium text-[#1A202C]">Recortes</legend>
          <label className="flex items-start gap-2 text-[13px] text-[#1A202C]">
            <input type="checkbox" checked={comFundador}
              onChange={e => setComFundador(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#006400]" />
            Só com ato instituidor localizado
          </label>
          <p className={ajudaFiltro}>
            Duas políticas do catálogo não têm o ato fundador localizado no acervo.
            Isso não significa que ele não exista — o Boletim cobre o que foi
            publicado nele.
          </p>
        </fieldset>
      </PainelFiltros>
    </div>
  );
}
