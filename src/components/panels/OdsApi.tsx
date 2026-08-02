import React, { useEffect, useMemo, useState } from 'react';
import { Target, Loader2, Info, ExternalLink, ChevronRight, ArrowLeft } from 'lucide-react';
import * as ds from '../../dataSource';

// Aba "ODS": os atos normativos da UFF lidos pela lente dos 17 Objetivos de
// Desenvolvimento Sustentável (Agenda 2030/ONU) — o formato de evidência que
// rankings internacionais (THE Impact Rankings) e órgãos de controle pedem.
//
// A classificação NÃO acontece aqui: vive na tabela-fato ato_ods, preenchida
// offline por método híbrido (IA lê o dispositivo do ato + curadoria humana),
// ancorado em metas nomeáveis (THE/IPEA). Método: docs/METODOLOGIA-ODS.md.
//
// O painel separa QUATRO vínculos — somá-los num número único enganaria:
//   proposta  = ato fundador de política/programa (a evidência de verdade)
//   execução  = staffing/operação de política existente (contexto)
//   pesquisa  = ato que viabiliza pesquisa no tema
//   ensino    = oferta acadêmica sobre o tema (curso/currículo)

const fmtData = (s: string | null) =>
  s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : '—';

const VINCULO_ROTULO: Record<string, string> = {
  proposta: 'Proposta', execucao: 'Execução', pesquisa: 'Pesquisa', ensino: 'Ensino',
};
const VINCULO_TIP: Record<string, string> = {
  proposta: 'Ato fundador: institui/aprova política, programa, plano ou estrutura',
  execucao: 'Operação de política já existente (designações, composições)',
  pesquisa: 'Viabiliza projeto de pesquisa relacionado ao tema',
  ensino: 'Oferta acadêmica sobre o tema (curso, currículo, disciplina)',
};

function VinculoChip({ v }: { v: string }) {
  const cor = v === 'proposta' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : v === 'pesquisa' ? 'bg-sky-50 text-sky-700 border-sky-200'
      : v === 'ensino' ? 'bg-violet-50 text-violet-700 border-violet-200'
        : 'bg-slate-50 text-slate-500 border-slate-200';
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cor}`}
      title={VINCULO_TIP[v] ?? ''}>{VINCULO_ROTULO[v] ?? v}</span>
  );
}

function ConfiancaDot({ c }: { c: string }) {
  const cor = c === 'alta' ? 'bg-emerald-500' : c === 'media' ? 'bg-amber-400' : 'bg-slate-300';
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-slate-400"
      title={`Confiança ${c} da classificação`}>
      <span className={`w-2 h-2 rounded-full ${cor}`}></span>{c}
    </span>
  );
}

// ---- detalhe de uma ODS: seus atos, propostas primeiro ---------------------
function Detalhe({ n, onVoltar }: { n: number; onVoltar: () => void }) {
  const [d, setD] = useState<ds.OdsDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [vincF, setVincF] = useState('');   // '' | proposta | execucao | pesquisa | ensino

  useEffect(() => {
    setCarregando(true);
    ds.getOdsAtos(n).then(setD).finally(() => setCarregando(false));
  }, [n]);

  const atos = useMemo(
    () => (d?.atos ?? []).filter(a => !vincF || a.vinculo === vincF),
    [d, vincF]);
  const porVinculo = useMemo(() => {
    const c: Record<string, number> = { proposta: 0, execucao: 0, pesquisa: 0, ensino: 0 };
    for (const a of d?.atos ?? []) c[a.vinculo] = (c[a.vinculo] ?? 0) + 1;
    return c;
  }, [d]);

  return (
    <div>
      <button onClick={onVoltar}
        className="flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline mb-3">
        <ArrowLeft className="w-3.5 h-3.5" /> Todas as ODS
      </button>
      {carregando && (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando atos…
        </div>
      )}
      {!carregando && d && (
        <>
          <div className="text-white rounded-lg p-4 mb-3" style={{ backgroundColor: d.ods.cor }}>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl font-black tabular-nums leading-none">{d.ods.n}</span>
              <h3 className="text-base font-bold">{d.ods.nome}</h3>
            </div>
            <p className="text-[12px] mt-1 opacity-90">
              {d.atos.length} ato(s) normativos ligados a esta ODS —{' '}
              {porVinculo.proposta} proposta(s), {porVinculo.execucao} de execução,{' '}
              {porVinculo.pesquisa} de pesquisa, {porVinculo.ensino} de ensino.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            {([['', `Todos (${d.atos.length})`],
               ['proposta', `Propostas (${porVinculo.proposta})`],
               ['execucao', `Execução (${porVinculo.execucao})`],
               ['pesquisa', `Pesquisa (${porVinculo.pesquisa})`],
               ['ensino', `Ensino (${porVinculo.ensino})`]] as const).map(([k, rot]) => (
              <button key={k} onClick={() => setVincF(k)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold border transition ${vincF === k
                  ? 'bg-[#003366] text-white border-[#003366]'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>{rot}</button>
            ))}
          </div>

          <div className="space-y-2">
            {atos.map(a => (
              <div key={`${a.id}-${a.vinculo}`}
                className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {a.link
                    ? <a href={a.link} target="_blank" rel="noopener noreferrer"
                        className="text-[12px] font-bold text-blue-700 hover:underline inline-flex items-center gap-1">
                        {a.sigla} nº {a.numero}/{a.ano} <ExternalLink className="w-3 h-3" />
                      </a>
                    : <span className="text-[12px] font-bold text-slate-700">{a.sigla} nº {a.numero}/{a.ano}</span>}
                  <span className="text-[11px] text-slate-400">{fmtData(a.data)}</span>
                  <VinculoChip v={a.vinculo} />
                  <ConfiancaDot c={a.confianca} />
                  {a.metodo === 'curadoria' && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200"
                      title="Classificação revisada por curadoria humana">revisado</span>
                  )}
                </div>
                <p className="text-[12px] text-slate-600 mt-1.5 leading-snug">{a.ementa}</p>
                {(a.justificativa || a.meta) && (
                  <p className="text-[11px] text-slate-400 mt-1.5 border-t border-dashed border-slate-100 pt-1.5">
                    {a.justificativa}{a.meta && <span className="font-mono"> · {a.meta}</span>}
                  </p>
                )}
              </div>
            ))}
            {atos.length === 0 && (
              <div className="text-center text-slate-400 text-sm py-8">
                Nenhum ato com este vínculo nesta ODS.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---- lista: as 17 ODS, com contagens por vínculo ---------------------------
export default function OdsApi() {
  const apiMode = ds.modo() === 'api';
  const [r, setR] = useState<ds.OdsResp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    if (!apiMode) { setCarregando(false); return; }
    ds.getOds().then(setR).finally(() => setCarregando(false));
  }, [apiMode]);

  if (!apiMode) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800" role="alert">
        A aba ODS depende da consulta ao banco. No modo de contingência (índice
        estático), ela fica indisponível.
      </div>
    );
  }
  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando ODS…
      </div>
    );
  }
  if (!r || r.indisponivel) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800" role="alert">
        O dossiê ODS ainda não foi carregado neste servidor.
        {r?.motivo && <> ({r.motivo})</>}
      </div>
    );
  }
  if (sel !== null) return <div id="painel-ods"><Detalhe n={sel} onVoltar={() => setSel(null)} /></div>;

  const comEvidencia = r.lista.filter(o => o.total > 0).length;

  return (
    <div id="painel-ods" className="space-y-3">
      <div className="bg-[#003366] text-white rounded-lg p-5">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Target className="w-5 h-5 text-yellow-400" /> Atos da UFF × Objetivos de Desenvolvimento Sustentável
        </h2>
        <p className="text-[13px] text-blue-100 mt-1 leading-relaxed">
          Dossiê de evidência: os atos normativos que documentam o que a UFF{' '}
          <strong>propôs e institucionalizou</strong> em cada uma das 17 ODS da Agenda 2030.{' '}
          {r.atosDistintos} atos, {r.linhas} ligações, {comEvidencia} ODS com evidência.
        </p>
      </div>

      <div className="flex items-start gap-2 text-[12px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
        <span>
          Classificação <strong>assistida por IA com curadoria humana</strong>, ancorada nas
          métricas de política do <strong>THE Impact Rankings</strong> e nas metas nacionais
          do <strong>IPEA/ODS-Brasil</strong> — cada ligação carrega justificativa e meta.
          O número forte é o de <strong>propostas</strong> (atos fundadores); execução, pesquisa
          e ensino aparecem separados, de propósito. A distribuição é desigual porque a
          produção normativa real é desigual — ODS sem evidência ficam visivelmente vazias,
          não infladas. Não é um relatório oficial da UFF.
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {r.lista.map(o => (
          <button key={o.n} onClick={() => o.total > 0 && setSel(o.n)}
            disabled={o.total === 0}
            className={`text-left bg-white border border-slate-200 rounded-lg overflow-hidden transition flex items-stretch group ${
              o.total > 0 ? 'hover:shadow-sm cursor-pointer hover:border-slate-300' : 'opacity-55 cursor-default'}`}>
            <div className="w-11 shrink-0 flex flex-col items-center justify-center text-white font-black"
              style={{ backgroundColor: o.cor }}>
              <span className="text-lg leading-none tabular-nums">{o.n}</span>
            </div>
            <div className="flex-1 p-2.5 min-w-0">
              <div className="font-bold text-[12px] text-slate-700 leading-tight">{o.nome}</div>
              <div className="text-[11px] text-slate-500 mt-1">
                {o.total > 0 ? (
                  <>
                    <strong className="text-emerald-700">{o.proposta} proposta(s)</strong>
                    {o.execucao > 0 && <> · {o.execucao} exec.</>}
                    {o.pesquisa > 0 && <> · {o.pesquisa} pesq.</>}
                    {o.ensino > 0 && <> · {o.ensino} ens.</>}
                    {o.anoMin && <span className="text-slate-400"> · {o.anoMin}–{o.anoMax}</span>}
                  </>
                ) : (
                  <span className="italic text-slate-400">sem evidência normativa localizada</span>
                )}
              </div>
            </div>
            {o.total > 0 && (
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#003366] shrink-0 self-center mr-2" />
            )}
          </button>
        ))}
      </div>

      <p className="text-[11px] text-slate-400">
        Método completo (âncoras, armadilhas medidas, taxonomia dos vínculos):{' '}
        <span className="font-mono">docs/METODOLOGIA-ODS.md</span> no repositório do portal.
        {r.curados > 0 && <> · {r.curados} ligação(ões) já revisada(s) por curadoria.</>}
      </p>
    </div>
  );
}
