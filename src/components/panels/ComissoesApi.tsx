import React, { useEffect, useMemo, useState } from 'react';
import { Users, Loader2, Info, ExternalLink, Search, X, ChevronRight, ArrowLeft } from 'lucide-react';
import * as ds from '../../dataSource';
import { RecordCard, RecordCardList, DesktopTable } from '../ui/RecordCard';

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
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200"
      title="Comissão obrigatória por lei">⚖ Por lei</span>);
  if (obrig === 'controle') return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200"
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
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${e.cor}`} title={e.ajuda}>
      {e.rot}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const cor = status === 'Revogado' ? 'bg-rose-50 text-rose-700 border-rose-200'
    : status === 'Alterado' ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cor}`}>{status}</span>;
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
              {d.corpo.sigla && <span className="text-[11px] font-mono bg-blue-800 px-1.5 py-0.5 rounded">{d.corpo.sigla}</span>}
              <ObrigChip obrig={d.corpo.obrig} />
            </div>
            <p className="text-[12px] text-blue-100 mt-1">
              {d.corpo.tipo} · {d.atos.length} ato(s) no Boletim que mencionam este colegiado
              {d.ultimaData ? <> · última evidência em {fmtData(d.ultimaData)}</> : null}.
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <EstadoChip estado={d.estado} />
              <span className="text-[10px] text-blue-200">
                {d.eventos.m12} ato(s) em 12 meses · {d.eventos.m24} em 24 · {d.eventos.m36} em 36
              </span>
            </div>
          </div>

          {d.mandatos.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-3 mb-3">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
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
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200"
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
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px]">
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
                        <div className="text-[10px] font-normal text-slate-400">
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
      <div className="bg-[#003366] text-white rounded-lg p-5">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-yellow-400" /> Comissões e comitês permanentes
        </h2>
        <p className="text-[13px] text-blue-100 mt-1 leading-relaxed">
          Os colegiados permanentes de alcance institucional da UFF, reunidos num só lugar.
          Clique num corpo para ver todos os atos do Boletim que o mencionam, do mais recente ao mais antigo.
        </p>
      </div>

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

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs w-full sm:w-auto sm:flex-1 sm:min-w-[180px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2 text-slate-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Filtrar por nome ou sigla…"
            className="w-full bg-white border border-slate-200 rounded pl-8 pr-7 py-1.5 text-xs" />
          {busca && <button onClick={() => setBusca('')} className="absolute right-2 top-1.5 p-0.5 hover:bg-slate-200 rounded-full text-slate-400"><X className="w-3 h-3" /></button>}
        </div>
        {([['', 'Todas'], ['lei', `⚖ Por lei (${contagem.lei})`], ['controle', `🛡 Órgão de controle (${contagem.controle})`]] as const).map(([k, rot]) => (
          <button key={k} onClick={() => setObrigF(k)}
            className={`px-2.5 py-1 rounded text-[11px] font-bold border transition ${obrigF === k
              ? 'bg-[#003366] text-white border-[#003366]'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>{rot}</button>
        ))}
      </div>

      {/* A janela muda o ESTADO de cada corpo, não só a contagem: um colegiado
          que se reúne a cada dois anos é "sem evidência recente" em 12 meses e
          "com evidência recente" em 36. Deixar a régua na mão de quem lê é mais
          honesto que fixar uma e não dizer qual. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
          Evidência recente =
        </span>
        {([12, 24, 36] as const).map(m => (
          <button key={m} onClick={() => setJanela(m)}
            className={`px-2.5 py-1 rounded text-[11px] font-bold border transition ${janela === m
              ? 'bg-[#003366] text-white border-[#003366]'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
            {m} meses
          </button>
        ))}
        <span className="text-slate-300">|</span>
        {(['', 'recente', 'sem_recente', 'recomposicao', 'insuficiente'] as const).map(k => {
          const n = k ? (r.corpos ?? []).filter(c => c.estado === k).length : (r.corpos ?? []).length;
          if (k && n === 0) return null;
          return (
            <button key={k || 'todos'} onClick={() => setEstadoF(k)}
              className={`px-2.5 py-1 rounded text-[11px] font-bold border transition ${estadoF === k
                ? 'bg-[#003366] text-white border-[#003366]'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
              {k ? ESTADO[k].rot : 'Todos'} ({n})
            </button>
          );
        })}
      </div>

      {grupos.map(([tipo, corpos]) => (
        <div key={tipo}>
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mt-4 mb-1.5">
            {tipo === 'Comitê' ? 'Comitês' : tipo === 'Comissão' ? 'Comissões' : tipo} ({corpos.length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {corpos.map(c => (
              <button key={c.slug} onClick={() => setSel(c.slug)}
                className="text-left bg-white border border-slate-200 rounded-lg p-3 hover:border-[#003366] hover:shadow-sm transition flex items-start justify-between gap-2 group">
                <div>
                  <div className="flex items-center flex-wrap gap-1.5">
                    <span className="font-bold text-[13px] text-[#003366]">{c.nome}</span>
                    {c.sigla && <span className="text-[10px] font-mono text-slate-400 border border-slate-200 rounded px-1">{c.sigla}</span>}
                    <ObrigChip obrig={c.obrig} />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {c.atos > 0
                      ? <>{c.atos} ato(s){c.anoMin ? ` · ${c.anoMin}–${c.anoMax}` : ''}</>
                      : <span className="text-slate-400 italic">sem atos localizados ainda</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <EstadoChip estado={c.estado} />
                    {c.ultimaData && (
                      <span className="text-[10px] text-slate-400">
                        última em {fmtData(c.ultimaData)}
                      </span>
                    )}
                  </div>
                  {c.mandato && (
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {c.mandato.origem === 'periodo' && c.mandato.periodo
                        ? <>mandato declarado para o período {c.mandato.periodo}</>
                        : <>mandato com fim previsto em {fmtData(c.mandato.fim)}</>}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#003366] shrink-0 mt-0.5" />
              </button>
            ))}
          </div>
        </div>
      ))}

      {grupos.length === 0 && (
        <div className="text-center text-slate-400 text-sm py-8">Nenhuma comissão bate com "{busca}".</div>
      )}
    </div>
  );
}
