import React, { useEffect, useMemo, useState } from 'react';
import { Users, Shield, Loader2, Info, ExternalLink, Search, X, ChevronRight, ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';
import * as ds from '../../dataSource';
import { RecordCard, RecordCardList, DesktopTable } from '../ui/RecordCard';
import { CartaoGrade, GradeCartoes } from '../ui/CartaoGrade';
import { PainelFiltros, rotuloFiltro, campoFiltro, ajudaFiltro } from '../ui/PainelFiltros';

// Aba "Comissões": centraliza os COLEGIADOS PERMANENTES de alcance institucional
// da UFF — comitês e comissões estáveis (CPA, CPPD, CEUA, Governança, ...). A
// lista é CURADA no servidor (comissoes_registro no index_v2.php) e cada corpo
// se liga aos seus atos por uma tabela-fato (ato_comissao), casada por FRASE.
//
// NÃO é o universo de comissões: em 25 anos a UFF constituiu mais de 14 mil,
// a imensa maioria temporária (bancas, eleitorais, sindicâncias). Estes são os
// permanentes, assinados pelo reitor — o núcleo institucional.

const fmtData = (s: string | null) =>
  s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : '—';

// Selo de obrigatoriedade: por lei (âmbar) ou por órgão de controle (índigo).
function ObrigChip({ obrig }: { obrig: string }) {
  if (obrig === 'lei') return (
    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200"
      title="Comissão obrigatória por lei">⚖ Por lei</span>);
  if (obrig === 'controle') return (
    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200"
      title="Exigida por órgão de controle (CGU, TCU...)">🛡 Órgão de controle</span>);
  return null;
}

// Estado DOCUMENTAL. O rótulo nunca afirma inatividade: "sem evidência recente
// localizada" é o teto do que o acervo sustenta. Uma comissão que trabalha e
// não publica é idêntica, no Boletim, a uma esquecida.
const ESTADO: Record<ds.ComissaoEstado, { rot: string; cor: string; ajuda: string }> = {
  recente: {
    rot: 'Com evidência recente', cor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ajuda: 'Há ato publicado dentro da janela escolhida.',
  },
  recomposicao: {
    rot: 'Recomposição possivelmente necessária', cor: 'bg-amber-50 text-amber-800 border-amber-200',
    ajuda: 'O mandato tem fim previsto já transcorrido e não há ato posterior localizado. Pode ter havido recomposição sem publicação.',
  },
  sem_recente: {
    rot: 'Sem evidência recente localizada', cor: 'bg-slate-100 text-slate-600 border-slate-300',
    ajuda: 'Nenhum ato na janela escolhida. NÃO significa que o colegiado esteja inativo — atividade pode ocorrer fora do Boletim.',
  },
  insuficiente: {
    rot: 'Dados insuficientes', cor: 'bg-slate-50 text-slate-400 border-slate-200',
    ajuda: 'Um ato ou nenhum: não há série documental para ler.',
  },
};

function EstadoChip({ estado }: { estado: ds.ComissaoEstado }) {
  const e = ESTADO[estado] ?? ESTADO.insuficiente;
  return (
    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${e.cor}`} title={e.ajuda}>
      {e.rot}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const cor = status === 'Revogado' ? 'bg-rose-50 text-rose-700 border-rose-200'
    : status === 'Alterado' ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${cor}`}>{status}</span>;
}

// ---- detalhe de um corpo: seus atos, do mais novo ao mais antigo -----------
function Detalhe({ slug, onVoltar }: { slug: string; onVoltar: () => void }) {
  const [d, setD] = useState<ds.ComissaoDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    setCarregando(true);
    ds.getComissaoAtos(slug).then(setD).finally(() => setCarregando(false));
  }, [slug]);

  return (
    <div>
      <button onClick={onVoltar}
        className="flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline mb-3">
        <ArrowLeft className="w-3.5 h-3.5" /> Todas as comissões
      </button>
      {carregando && (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando atos…
        </div>
      )}
      {!carregando && d && (
        <>
          <div className="bg-[#003366] text-white rounded-lg p-4 mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold">{d.corpo.nome}</h3>
              {d.corpo.sigla && <span className="text-[12px] font-mono bg-blue-800 px-1.5 py-0.5 rounded">{d.corpo.sigla}</span>}
              <ObrigChip obrig={d.corpo.obrig} />
            </div>
            <p className="text-[12px] text-blue-100 mt-1">
              {d.corpo.tipo} · {d.atos.length} ato(s) no Boletim que mencionam este colegiado
              {d.ultimaData ? <> · última evidência em {fmtData(d.ultimaData)}</> : null}.
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <EstadoChip estado={d.estado} />
              <span className="text-[11px] text-blue-200">
                {d.eventos.m12} ato(s) em 12 meses · {d.eventos.m24} em 24 · {d.eventos.m36} em 36
              </span>
            </div>
          </div>

          {d.mandatos.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-3 mb-3">
              <h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Mandatos com fim previsto ({d.mandatos.length})
              </h4>
              <ul className="space-y-1 text-[12px] text-slate-600">
                {d.mandatos.slice(0, 6).map((m, i) => (
                  <li key={`${m.atoId}-${i}`} className="flex flex-wrap items-baseline gap-1.5">
                    {/* Período declarado exibe o PERÍODO; só a data explícita do
                        ato exibe data. O `fim` do período é 31/12 arredondado
                        por nós — mostrá-lo como "até 31/12/2025" seria atribuir
                        ao ato uma precisão que ele não tem. */}
                    <strong className={new Date(m.fim) < new Date() ? 'text-amber-700' : 'text-slate-700'}>
                      {m.origem === 'periodo' && m.periodo
                        ? <>período {m.periodo}</>
                        : <>até {fmtData(m.fim)}</>}
                    </strong>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">{m.atoId}</span>
                    {m.conf && m.conf !== 'alta' && (
                      <span className="text-[11px] font-bold px-1 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200"
                        title={m.trecho ?? 'Data inferida do texto do ato'}>⚠ conf. {m.conf}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {d.avisos.length > 0 && (
            <div className="flex items-start gap-2 text-[12px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
              <ul className="space-y-0.5">{d.avisos.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </div>
          )}
          <RecordCardList>
            {d.atos.length === 0
              ? <p className="py-6 text-center text-sm text-slate-400">Nenhum ato encontrado para este colegiado.</p>
              : d.atos.map(a => (
                <RecordCard
                  key={a.id}
                  titulo={`${a.sigla} nº ${a.numero}/${a.ano}`}
                  selo={<StatusChip status={a.status} />}
                  campos={[
                    { rotulo: 'Data', valor: fmtData(a.data) },
                    { rotulo: 'Processo SEI', valor: a.processoSei
                      ? (a.linkSeiProcesso
                          ? <a href={a.linkSeiProcesso} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{a.processoSei}</a>
                          : a.processoSei)
                      : '—' },
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
                  <th className="text-left px-3 py-2">Situação</th>
                  <th className="text-left px-3 py-2 w-1/2">Ementa</th>
                </tr>
              </thead>
              <tbody>
                {d.atos.map(a => (
                  <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50 align-top">
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
                    <td className="px-3 py-1.5"><StatusChip status={a.status} /></td>
                    <td className="px-3 py-1.5 text-slate-600">{a.ementa}</td>
                  </tr>
                ))}
                {d.atos.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                    Nenhum ato encontrado para este colegiado.
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

// ---- lista: os corpos, agrupados por tipo ----------------------------------
export default function ComissoesApi() {
  const apiMode = ds.modo() === 'api';
  const [r, setR] = useState<ds.ComissoesResp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [obrigF, setObrigF] = useState('');   // '' | 'lei' | 'controle'
  const [estadoF, setEstadoF] = useState('');
  const [janela, setJanela] = useState(24);   // 12 | 24 | 36 meses
  const [sel, setSel] = useState<string | null>(null);
  const [painelAberto, setPainelAberto] = useState(false);
  const avancadosAtivos = [obrigF !== '', janela !== 24].filter(Boolean).length;

  useEffect(() => {
    if (!apiMode) { setCarregando(false); return; }
    setCarregando(true);
    ds.getComissoes(janela).then(setR).finally(() => setCarregando(false));
  }, [apiMode, janela]);

  const contagem = useMemo(() => {
    const c = { lei: 0, controle: 0 };
    for (const x of r?.corpos ?? []) if (x.obrig === 'lei') c.lei++; else if (x.obrig === 'controle') c.controle++;
    return c;
  }, [r]);

  const grupos = useMemo(() => {
    if (!r) return [];
    const q = busca.trim().toLowerCase();
    const filtra = (c: ds.ComissaoCorpo) =>
      (!q || c.nome.toLowerCase().includes(q) || c.sigla.toLowerCase().includes(q)) &&
      (!obrigF || c.obrig === obrigF) &&
      (!estadoF || c.estado === estadoF);
    const porTipo = new Map<string, ds.ComissaoCorpo[]>();
    for (const c of r.corpos) {
      if (!filtra(c)) continue;
      (porTipo.get(c.tipo) ?? porTipo.set(c.tipo, []).get(c.tipo)!).push(c);
    }
    // dentro de cada tipo, mais atos primeiro
    for (const arr of porTipo.values()) arr.sort((a, b) => b.atos - a.atos);
    return [...porTipo.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [r, busca, obrigF, estadoF]);

  const visiveis = useMemo(
    () => grupos.reduce((n, [, corpos]) => n + corpos.length, 0), [grupos]);

  if (!apiMode) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800" role="alert">
        A aba Comissões depende da consulta ao banco. No modo de contingência (índice
        estático), ela fica indisponível.
      </div>
    );
  }
  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando comissões…
      </div>
    );
  }
  if (!r) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800" role="alert">
        Não foi possível consultar as comissões agora.
      </div>
    );
  }
  if (sel) return <div id="painel-comissoes"><Detalhe slug={sel} onVoltar={() => setSel(null)} /></div>;

  return (
    <div id="painel-comissoes" className="space-y-3">
      <PageHeader
        titulo="Comissões"
        descricao="Consulte comissões permanentes, órgãos e atos relacionados."
      />
      <p className="text-[13px] leading-relaxed text-slate-700">
        Os colegiados permanentes de alcance institucional da UFF, reunidos num só lugar.
        Clique num corpo para ver todos os atos do Boletim que o mencionam, do mais recente ao mais antigo.
      </p>

      <div className="flex items-start gap-2 text-[12px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
        <span>
          É uma <strong>seleção curada</strong>, não o universo: em 25 anos a UFF constituiu
          mais de <strong>14 mil</strong> comissões, a maioria temporária (bancas, eleitorais,
          sindicâncias). Aqui estão os <strong>permanentes</strong>. O selo <strong>⚖ Por lei</strong>
          marca as obrigatórias por lei; <strong>🛡 Órgão de controle</strong>, as exigidas por
          órgãos de controle (CGU, TCU).
        </span>
      </div>

      {r.avisos?.length > 0 && (
        <div className="flex items-start gap-2 text-[12px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
          <ul className="space-y-0.5">{r.avisos.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      )}

      {/* Busca + o filtro essencial. O resto vai para o painel lateral: a
          primeira interação não precisa de cinco controles abertos. */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div>
            <label htmlFor="busca-comissoes" className="sr-only">Buscar comissão</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                id="busca-comissoes"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar comissão por nome ou sigla"
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
            <label className={rotuloFiltro} htmlFor="filtro-situacao">Situação</label>
            <select id="filtro-situacao" value={estadoF} onChange={e => setEstadoF(e.target.value as any)} className={campoFiltro}>
              <option value="">Todas</option>
              {(['recente', 'sem_recente', 'recomposicao', 'insuficiente'] as const).map(k => {
                const n = (r.corpos ?? []).filter(c => c.estado === k).length;
                return n ? <option key={k} value={k}>{ESTADO[k].rot} ({n})</option> : null;
              })}
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

      {/* A régua da vigência fica ESCRITA junto do resultado, e não só dentro do
          painel: o `estado` de cada corpo depende dela — um colegiado que se
          reúne a cada dois anos é "sem evidência recente" em 12 meses e "com
          evidência recente" em 36. Ler o selo sem saber a régua é ler um
          veredito sem o critério. */}
      <p className="text-[13px] text-[#4A5568]" aria-live="polite">
        <strong className="font-semibold text-[#1A202C]">{visiveis} de {r.corpos?.length ?? 0}</strong>{' '}
        {visiveis === 1 ? 'colegiado' : 'colegiados'} · evidência recente = últimos{' '}
        <strong className="font-semibold text-[#1A202C]">{janela} meses</strong>
      </p>

      {grupos.map(([tipo, corpos]) => (
        <div key={tipo}>
          <h3 className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-wide text-[#4A5568]">
            {tipo === 'Comitê' ? 'Comitês' : tipo === 'Comissão' ? 'Comissões' : tipo} ({corpos.length})
          </h3>
          <GradeCartoes>
            {corpos.map(c => (
              <CartaoGrade
                key={c.slug}
                icone={c.tipo === 'Comitê' ? <Shield size={20} /> : <Users size={20} />}
                titulo={c.nome}
                etiquetas={<>
                  {c.sigla && (
                    <span className="rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                      {c.sigla}
                    </span>
                  )}
                  <ObrigChip obrig={c.obrig} />
                </>}
                destaque={{
                  rotulo: 'Período com atos no Boletim',
                  valor: c.anoMin
                    ? <>{c.anoMin}–{c.anoMax}{c.ultimaData ? <span className="text-[#4A5568]"> · última em {fmtData(c.ultimaData)}</span> : null}</>
                    : <span className="italic text-[#4A5568]">sem atos localizados ainda</span>,
                }}
                campos={[
                  { rotulo: 'Atos', valor: c.atos },
                  { rotulo: 'Situação', valor: <EstadoChip estado={c.estado} /> },
                ]}
                rodape={c.mandato ? (
                  c.mandato.origem === 'periodo' && c.mandato.periodo
                    ? <>Mandato declarado para o período {c.mandato.periodo}.</>
                    : <>Mandato com fim previsto em {fmtData(c.mandato.fim)}.</>
                ) : undefined}
                acao="Ver comissão"
                onClick={() => setSel(c.slug)}
              />
            ))}
          </GradeCartoes>
        </div>
      ))}

      {grupos.length === 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-12 text-center">
          <Info className="mx-auto mb-3 h-7 w-7 text-[#64748B]" />
          <p className="text-[15px] font-semibold text-[#1A202C]">Nenhum colegiado corresponde a esta consulta.</p>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-[#4A5568]">
            {r.corpos?.length
              ? <>São {r.corpos.length} colegiados permanentes ao todo. Tente remover um filtro, ou buscar
                 pela sigla em vez do nome.</>
              : <>Tente remover um filtro, ou buscar pela sigla em vez do nome.</>}
          </p>
        </div>
      )}

      <PainelFiltros
        aberto={painelAberto}
        onFechar={() => setPainelAberto(false)}
        onLimpar={() => { setObrigF(''); setJanela(24); }}
      >
        <div>
          <label className={rotuloFiltro} htmlFor="filtro-obrig">Obrigatoriedade</label>
          <select id="filtro-obrig" value={obrigF} onChange={e => setObrigF(e.target.value)} className={campoFiltro}
            aria-describedby="ajuda-obrig">
            <option value="">Todas</option>
            <option value="lei">Por lei ({contagem.lei})</option>
            <option value="controle">Por órgão de controle ({contagem.controle})</option>
          </select>
          <p id="ajuda-obrig" className={ajudaFiltro}>
            Curadoria do mantenedor, não inferência do texto: obrigatória por lei,
            exigida por órgão de controle (CGU, TCU), ou nenhuma das duas.
          </p>
        </div>

        <div>
          <label className={rotuloFiltro} htmlFor="filtro-janela">Régua de “evidência recente”</label>
          <select id="filtro-janela" value={janela} onChange={e => setJanela(Number(e.target.value))} className={campoFiltro}
            aria-describedby="ajuda-janela">
            {[12, 24, 36].map(m => <option key={m} value={m}>Últimos {m} meses</option>)}
          </select>
          <p id="ajuda-janela" className={ajudaFiltro}>
            Muda a <strong>situação</strong> de cada colegiado, não só a contagem. Um corpo
            que se reúne a cada dois anos aparece como “sem evidência recente” em 12
            meses e “com evidência recente” em 36. A régua escolhida fica escrita
            acima da lista.
          </p>
        </div>
      </PainelFiltros>
    </div>
  );
}
