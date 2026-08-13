import React, { useEffect, useMemo, useState } from 'react';
import { Megaphone, Loader2, Info, ExternalLink, X } from 'lucide-react';
import { PageHeader } from '../ui/PageHeader';
import * as ds from '../../dataSource';

// Aba "Mudanças": o que mudou no acervo, e por que aquilo importa.
//
// Duas decisões definem esta aba, e as duas vieram de medição:
//
// 1. NENHUM TEXTO GERADO. Cada item mostra a ementa do próprio ato. O projeto
//    pede resumo em linguagem simples, revisado por humano antes de publicar —
//    enquanto essa revisão não existir, escrever prosa automática sobre atos
//    que afetam pessoas seria inventar.
//
// 2. O FEED EXIGE VÍNCULO INSTITUCIONAL, em vez de excluir o individual. 64%
//    dos atos recentes são de efeito individual, e o filtro óbvio (excluir quem
//    cita SIAPE) vaza: só 30–70% dos atos registram matrícula, e um ato como
//    "Designa os servidores <nome>" passaria com o nome da pessoa. Exigir laço
//    apurado — política, colegiado ou mudança de vigência — fecha isso.

const fmtData = (s: string | null) =>
  s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : '—';

const JANELAS = [30, 90, 180, 365] as const;

function StatusChip({ status }: { status: string }) {
  const cor = status === 'Revogado' ? 'bg-rose-50 text-rose-700 border-rose-200'
    : status === 'Alterado' ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${cor}`}>{status}</span>;
}

// A relevância nunca aparece como número solto. Cada ponto tem um motivo
// nomeável, e é o motivo que a interface mostra — o número sozinho pediria
// confiança que ele não merece.
function Motivos({ item }: { item: ds.MudancaItem }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {item.politicas.map(p => (
        <span key={p} className="text-[11px] font-bold px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
          política: {p}
        </span>
      ))}
      {item.comissoes.map(c => (
        <span key={c} className="text-[11px] font-bold px-1.5 py-0.5 rounded border bg-violet-50 text-violet-700 border-violet-200">
          colegiado: {c}
        </span>
      ))}
      {item.mudaVigencia && (
        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200"
          title="Este ato revoga ou altera outra norma — o que valia antes mudou.">
          muda vigência
        </span>
      )}
      {item.prazo && (
        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border bg-rose-50 text-rose-700 border-rose-200"
          title="Há data-limite em aberto neste ato.">
          prazo até {fmtData(item.prazo)}
        </span>
      )}
      {item.publico && (
        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200">
          {item.publico}
        </span>
      )}
    </div>
  );
}

export default function MudancasApi() {
  const apiMode = ds.modo() === 'api';
  const [r, setR] = useState<ds.MudancasResp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [dias, setDias] = useState<number>(180);
  const [publico, setPublico] = useState('');

  useEffect(() => {
    if (!apiMode) { setCarregando(false); return; }
    setCarregando(true);
    ds.getMudancas(dias).then(setR).finally(() => setCarregando(false));
  }, [apiMode, dias]);

  const itens = useMemo(
    () => (r?.itens ?? []).filter(i => !publico || i.publico === publico),
    [r, publico]);

  // Agrupa por mês: um feed cronológico sem cabeçalho vira parede de texto.
  const porMes = useMemo(() => {
    const m = new Map<string, ds.MudancaItem[]>();
    for (const i of itens) {
      const k = (i.data ?? '').slice(0, 7) || 'sem data';
      (m.get(k) ?? m.set(k, []).get(k)!).push(i);
    }
    return [...m.entries()];
  }, [itens]);

  if (!apiMode) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800" role="alert">
        A aba Mudanças depende da consulta ao banco. No modo de contingência
        (índice estático), ela fica indisponível.
      </div>
    );
  }
  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando mudanças…
      </div>
    );
  }
  if (r?.indisponivel) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800" role="alert">
        O feed de mudanças ainda não está disponível neste servidor.
        {r.motivo ? <> ({r.motivo})</> : null}
      </div>
    );
  }
  if (!r) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800" role="alert">
        Não foi possível consultar as mudanças agora.
      </div>
    );
  }

  return (
    <div id="painel-mudancas" className="space-y-3">
      <PageHeader
        titulo="O que mudou"
        descricao="Acompanhe alterações recentes no acervo e nos atos da UFF."
      />
      <p className="text-[13px] leading-relaxed text-slate-700">
        Traz os atos recentes com alcance institucional — os que tocam uma política, um
        colegiado permanente, ou mudam o que estava em vigor. Do mais novo para o mais antigo.
      </p>

      {r.avisos?.length > 0 && (
        <div className="flex items-start gap-2 text-[12px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
          <ul className="space-y-0.5">{r.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-bold text-slate-400 uppercase tracking-wide">Últimos</span>
        {JANELAS.map(d => (
          <button key={d} onClick={() => setDias(d)}
            className={`px-2.5 py-1 rounded text-[12px] font-bold border transition ${dias === d
              ? 'bg-[#003366] text-white border-[#003366]'
              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
            {d === 365 ? '1 ano' : `${d} dias`}
          </button>
        ))}
        {r.publicos.length > 0 && (
          <>
            <span className="text-slate-300">|</span>
            {publico ? (
              <button onClick={() => setPublico('')}
                className="px-2.5 py-1 rounded text-[12px] font-bold border bg-[#003366] text-white border-[#003366] inline-flex items-center gap-1">
                {publico} <X className="w-3 h-3" />
              </button>
            ) : (
              <select value={publico} onChange={e => setPublico(e.target.value)}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-[12px] font-bold text-slate-600">
                <option value="">Todos os públicos</option>
                {r.publicos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
          </>
        )}
        <span className="text-[12px] text-slate-400">
          {itens.length} de {r.total} no período
        </span>
      </div>

      {porMes.map(([mes, lista]) => (
        <div key={mes}>
          <h3 className="text-[12px] font-bold text-slate-400 uppercase tracking-wide mt-4 mb-1.5">
            {mes === 'sem data' ? 'Sem data' : mes.split('-').reverse().join('/')} ({lista.length})
          </h3>
          <div className="space-y-2">
            {lista.map(i => (
              <div key={`${i.id}-${i.data}`} className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <span className="font-bold text-[13px] text-[#003366]">
                      {i.tipo} nº {i.numero}/{i.ano}
                    </span>
                    <span className="text-[12px] text-slate-400 ml-2">
                      {i.sigla} · {fmtData(i.data)}
                    </span>
                  </div>
                  <StatusChip status={i.status} />
                </div>
                <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">{i.ementa}</p>
                <Motivos item={i} />
                {i.link && (
                  <a href={i.link} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 underline mt-2">
                    Abrir no Boletim <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {itens.length === 0 && (
        <div className="text-center text-slate-400 text-sm py-8">
          Nenhuma mudança com vínculo institucional neste período.
        </div>
      )}
    </div>
  );
}
