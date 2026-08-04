import React, { useEffect, useMemo, useState } from 'react';
import { Landmark, Loader2, Info, ExternalLink, Search, X, ChevronRight, ArrowLeft } from 'lucide-react';
import * as ds from '../../dataSource';
import { RecordCard, RecordCardList, DesktopTable } from '../ui/RecordCard';

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
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${COR_PAPEL[papel] ?? COR_PAPEL.referencia}`}>
      {ROTULO_PAPEL[papel] ?? papel}
    </span>
  );
}

// Confiança da inferência. 'alta' = a frase da política está na ementa;
// 'media' = veio do órgão emissor, sem a frase. O usuário precisa distinguir.
function ConfiancaChip({ c, justificativa }: { c: string; justificativa: string | null }) {
  if (c === 'alta') return null;   // o padrão não precisa de selo
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200"
      title={justificativa ? `Vínculo inferido — ${justificativa}` : 'Vínculo inferido, confiança média'}>
      ⚠ confiança {c}
    </span>
  );
}

function EstagioChip({ estagio }: { estagio: string }) {
  if (estagio === 'publicada') return null;
  if (estagio === 'arquivada') return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-slate-100 text-slate-500 border-slate-200">
      arquivada</span>);
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-slate-50 text-slate-500 border-slate-200"
      title="O catálogo desta política ainda está em curadoria: os vínculos foram propostos por regra e não passaram por revisão humana.">
      catálogo em revisão</span>);
}

function StatusChip({ status }: { status: string }) {
  const cor = status === 'Revogado' ? 'bg-rose-50 text-rose-700 border-rose-200'
    : status === 'Alterado' ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cor}`}>{status}</span>;
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
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${n > 0
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
      <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
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
          <p className="text-[11px] text-slate-500">
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
              {d.politica.categoria && (
                <span className="text-[11px] font-mono bg-blue-800 px-1.5 py-0.5 rounded">{d.politica.categoria}</span>
              )}
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
                className={`px-2.5 py-1 rounded text-[11px] font-bold border transition ${!papelF
                  ? 'bg-[#003366] text-white border-[#003366]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                Todos ({d.atos.length})
              </button>
              {papeisPresentes.map(p => (
                <button key={p} onClick={() => setPapelF(p)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold border transition ${papelF === p
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
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
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
                        <div className="text-[10px] font-normal text-slate-400">
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

  useEffect(() => {
    if (!apiMode) { setCarregando(false); return; }
    ds.getPoliticas().then(setR).finally(() => setCarregando(false));
  }, [apiMode]);

  const grupos = useMemo(() => {
    if (!r?.politicas) return [];
    const q = busca.trim().toLowerCase();
    const porCat = new Map<string, ds.PoliticaResumo[]>();
    for (const p of r.politicas) {
      if (q && !p.nome.toLowerCase().includes(q) && !(p.descricao ?? '').toLowerCase().includes(q)) continue;
      const cat = p.categoria || 'Outras';
      const arr = porCat.get(cat) ?? [];
      arr.push(p);
      porCat.set(cat, arr);
    }
    for (const arr of porCat.values()) arr.sort((a, b) => b.atos - a.atos);
    return [...porCat.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [r, busca]);

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

      <div className="relative max-w-xs">
        <Search className="w-4 h-4 absolute left-2.5 top-2 text-slate-400" />
        <input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Filtrar políticas…"
          className="w-full bg-white border border-slate-200 rounded pl-8 pr-7 py-1.5 text-xs" />
        {busca && <button onClick={() => setBusca('')} className="absolute right-2 top-1.5 p-0.5 hover:bg-slate-200 rounded-full text-slate-400"><X className="w-3 h-3" /></button>}
      </div>

      {grupos.map(([cat, pols]) => (
        <div key={cat}>
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mt-4 mb-1.5">
            {cat} ({pols.length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {pols.map(p => (
              <button key={p.slug} onClick={() => setSel(p.slug)}
                className="text-left bg-white border border-slate-200 rounded-lg p-3 hover:border-[#003366] hover:shadow-sm transition group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-1.5">
                      <span className="font-bold text-[13px] text-[#003366]">{p.nome}</span>
                      <EstagioChip estagio={p.estagio} />
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {p.atos > 0
                        ? <>{p.atos} ato(s){p.anoMin ? ` · ${p.anoMin}–${p.anoMax}` : ''}</>
                        : <span className="text-slate-400 italic">sem atos localizados ainda</span>}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {p.fundador
                        ? <>Instituída por <strong className="text-slate-600">{p.fundador.label}</strong></>
                        : <span className="text-slate-400 italic">ato instituidor não localizado no acervo</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#003366] shrink-0 mt-0.5" />
                </div>
                <Ciclo papeis={p.papeis} />
              </button>
            ))}
          </div>
        </div>
      ))}

      {grupos.length === 0 && (
        <div className="text-center text-slate-400 text-sm py-8">
          {busca ? <>Nenhuma política bate com "{busca}".</> : <>Nenhuma política no catálogo ainda.</>}
        </div>
      )}
    </div>
  );
}
