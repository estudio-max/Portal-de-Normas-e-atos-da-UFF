import React, { useEffect, useMemo, useState } from 'react';
import { CalendarX2, Printer, Search, Loader2, Info, AlertTriangle, ExternalLink, HelpCircle } from 'lucide-react';
import * as ds from '../../dataSource';

// Aba "Mandatos": setores SEM CHEFIA formalmente constituída, e há quanto tempo.
//
// Por que esta aba existe: a designação de chefia é autolimitada — ela traz a
// própria validade ("com mandato de 04 (quatro) anos"). Cumprir o mandato
// inteiro não gera ato nenhum; a dispensa só aparece quando alguém sai ANTES
// da hora (83% delas saem >90 dias antes do fim). Ou seja, o Boletim não
// publica revogação ao fim do mandato porque ela seria redundante — e o fim do
// mandato NÃO existe como ato. Só existe se for projetado, que é o que se faz
// aqui.
//
// O que a aba afirma e o que NÃO afirma: ela afirma que a POSIÇÃO está sem
// designação vigente — uma afirmação sobre o setor e sobre a ausência de um
// ato, que é o que a base sabe provar. Ela NÃO afirma que alguém está
// irregular: o titular pode ter saído sem ato, o subchefe pode ter assumido
// por regimento (automático, invisível ao BS), e a nomeação do sucessor pode
// estar a caminho. Assistiva, como a aba Prazos: sempre "confira o ato".

const HOJE = new Date().toISOString().slice(0, 10);
const fmtBR = (s: string) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : '—');
const haQuanto = (d: number) => {
  if (d < 30) return `há ${d} dia${d === 1 ? '' : 's'}`;
  if (d < 365) return `há ${Math.floor(d / 30)} ${Math.floor(d / 30) === 1 ? 'mês' : 'meses'}`;
  const a = d / 365.25;
  return `há ${a < 2 ? '1 ano e ' + Math.floor((d - 365) / 30) + ' meses' : Math.floor(a) + ' anos'}`;
};

// Gravidade pelo TEMPO vago — cor nunca sozinha, sempre com rótulo.
type Grav = 'recente' | 'meses' | 'ano' | 'anos';
const gravDe = (d: number): Grav => d <= 90 ? 'recente' : d <= 365 ? 'meses' : d <= 730 ? 'ano' : 'anos';
const GRAV: Record<Grav, { rotulo: string; card: string; texto: string; chip: string }> = {
  anos:    { rotulo: 'Há mais de 2 anos', card: 'border-l-red-600',   texto: 'text-red-700',   chip: 'bg-red-50 text-red-700 border-red-200' },
  ano:     { rotulo: 'Há mais de 1 ano',  card: 'border-l-orange-500', texto: 'text-orange-700', chip: 'bg-orange-50 text-orange-700 border-orange-200' },
  meses:   { rotulo: 'Há meses',          card: 'border-l-amber-500', texto: 'text-amber-700', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  recente: { rotulo: 'Vencido há pouco',  card: 'border-l-blue-500',  texto: 'text-blue-700',  chip: 'bg-blue-50 text-blue-700 border-blue-200' },
};

export default function MandatosApi() {
  const [r, setR] = useState<ds.MandatosResp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [cargo, setCargo] = useState('todos');
  const [origem, setOrigem] = useState('todas');

  useEffect(() => {
    let vivo = true;
    ds.getMandatos()
      .then(x => { if (vivo) setR(x); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, []);

  const vagos = useMemo(() => (r?.setores || []).filter(s => s.situacao === 'sem_chefia'), [r]);
  const cargos = useMemo(() => Array.from(new Set(vagos.map(s => s.cargo))).sort(), [vagos]);

  // Ordem: MENOR tempo vago primeiro. Não é só preferência de leitura — o
  // vencido há pouco é o caso mais crível e mais acionável; quanto mais antiga
  // a vacância, maior a chance de ser resíduo de projeção (unidade renomeada,
  // saída sem ato registrado) e não um setor de fato acéfalo.
  const filtrada = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return vagos.filter(s => {
      if (cargo !== 'todos' && s.cargo !== cargo) return false;
      if (origem !== 'todas' && s.prazoOrigem !== origem) return false;
      if (!q) return true;
      return `${s.unidade} ${s.cargo} ${s.nome || ''} ${s.siape || ''}`.toLowerCase().includes(q);
    }).sort((a, b) => a.diasVago - b.diasVago);
  }, [vagos, busca, cargo, origem]);

  const kpis = useMemo(() => ({
    total: vagos.length,
    anos: vagos.filter(s => s.diasVago > 730).length,
    ano: vagos.filter(s => s.diasVago > 365 && s.diasVago <= 730).length,
    recente: vagos.filter(s => s.diasVago <= 90).length,
    presumido: vagos.filter(s => s.prazoOrigem === 'presumido_cargo').length,
  }), [vagos]);

  const semCobertura = r?.resumo.semCobertura ?? 0;
  const anosRuins = (r?.cobertura || []).filter(c => !c.confiavel);

  const imprimir = () => {
    const esc = (s: string) => (s || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] as string));
    const linhas = filtrada.map(s =>
      `<tr><td>${esc(s.unidade)}</td><td>${esc(s.cargo)}</td><td>${fmtBR(s.fim)}</td>` +
      `<td>${haQuanto(s.diasVago)}</td><td>${esc(s.nome || '—')}</td>` +
      `<td>${s.prazoMeses / 12} anos${s.prazoOrigem === 'presumido_cargo' ? ' (presumido)' : ''}</td>` +
      `<td>${esc(s.atoLabel)}</td></tr>`).join('');
    const html =
      `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>Setores sem chefia — UFF</title>` +
      `<style>body{font:12px/1.45 Arial,Helvetica,sans-serif;color:#111;margin:22px}` +
      `h1{font-size:17px;margin:0 0 2px}.sub{color:#555;font-size:11px;margin:0 0 6px}` +
      `.nota{border:1px solid #999;padding:6px 8px;font-size:10px;margin:0 0 14px;line-height:1.5}` +
      `table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top}` +
      `th{background:#eee;font-size:10px;text-transform:uppercase;letter-spacing:.04em}` +
      `tr:nth-child(even) td{background:#f6f6f6}@media print{@page{margin:13mm}}</style></head><body>` +
      `<h1>Setores sem chefia formalmente constituída</h1>` +
      `<p class="sub">Universidade Federal Fluminense &middot; ${filtrada.length} posição(ões) &middot; Gerado em ${fmtBR(HOJE)}</p>` +
      `<p class="nota"><strong>Como ler:</strong> a designação de chefia traz a própria validade, e o Boletim não publica ` +
      `ato de encerramento ao fim do mandato — ele seria redundante. As posições abaixo tiveram o mandato vencido ` +
      `<strong>segundo o próprio ato de designação</strong> e não têm sucessor publicado. Isto <strong>não</strong> afirma que ` +
      `alguém esteja irregular: o titular pode ter saído sem ato, o subchefe pode ter assumido por regimento, ou a ` +
      `designação do sucessor pode estar em curso. Confira sempre o ato de origem.` +
      (semCobertura ? ` <strong>${semCobertura}</strong> posição(ões) ficaram de fora por falta de cobertura do BS no período.` : '') +
      `</p>` +
      `<table><thead><tr><th>Setor / Unidade</th><th>Cargo</th><th>Vago desde</th><th>Há quanto tempo</th>` +
      `<th>Último designado</th><th>Mandato</th><th>Ato de origem</th></tr></thead><tbody>${linhas}</tbody></table>` +
      `<script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    else alert('Permita pop-ups para gerar o PDF, ou use Ctrl+P nesta página.');
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Calculando mandatos…
      </div>
    );
  }

  return (
    <div id="painel-mandatos" className="space-y-3">
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="max-w-3xl">
            <h3 className="text-xs font-bold text-[#003366] flex items-center gap-1.5 uppercase tracking-wider">
              <CalendarX2 className="w-4 h-4 text-yellow-500" /> Mandatos — setores sem chefia formalmente constituída
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-normal font-medium">
              A designação de chefia <strong>traz a própria validade</strong> ("com mandato de 4 anos"), então o Boletim
              não publica ato de encerramento quando o prazo acaba — ele seria redundante. As posições abaixo tiveram o
              mandato vencido <strong>segundo o próprio ato de designação</strong> e não têm sucessor publicado.
            </p>
          </div>
          <button
            onClick={imprimir}
            disabled={!filtrada.length}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#003366] text-white text-xs font-bold hover:bg-[#00264d] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Printer className="w-4 h-4" /> Exportar / Imprimir PDF
          </button>
        </div>

        {/* O que a aba NÃO afirma. Fica no topo de propósito: é a diferença
            entre um relatório que aguenta conferência e uma acusação. */}
        <div className="mt-2.5 flex gap-2 items-start bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2">
          <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-900 leading-relaxed">
            Isto <strong>não</strong> afirma que alguém esteja irregular. A posição está sem designação vigente — mas o
            titular pode ter saído sem ato, o <strong>subchefe pode ter assumido por regimento</strong> (automático, e
            invisível ao Boletim), ou a designação do sucessor pode estar em curso. Use como ponto de partida:{' '}
            <strong>confira o ato de origem</strong>.
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <div className="border border-slate-200 rounded-md p-2">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sem chefia</div>
            <div className="text-2xl font-bold text-slate-800 mt-0.5">{kpis.total}</div>
          </div>
          <div className="border border-slate-200 rounded-md p-2">
            <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Há mais de 2 anos</div>
            <div className="text-2xl font-bold text-red-700 mt-0.5">{kpis.anos}</div>
          </div>
          <div className="border border-slate-200 rounded-md p-2">
            <div className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Há mais de 1 ano</div>
            <div className="text-2xl font-bold text-orange-700 mt-0.5">{kpis.ano}</div>
          </div>
          <div className="border border-slate-200 rounded-md p-2">
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Vencidos há pouco</div>
            <div className="text-2xl font-bold text-blue-700 mt-0.5">{kpis.recente}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por setor, cargo, nome ou SIAPE…"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <select value={cargo} onChange={e => setCargo(e.target.value)}
            className="w-full sm:w-auto max-w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white font-medium text-slate-700">
            <option value="todos">Todos os cargos</option>
            {cargos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={origem} onChange={e => setOrigem(e.target.value)}
            className="w-full sm:w-auto max-w-full px-3 py-2 text-sm rounded-md border border-slate-300 bg-white font-medium text-slate-700">
            <option value="todas">Prazo: declarado e presumido</option>
            <option value="declarado">Só o que o ato declarou</option>
            <option value="presumido_cargo">Só o presumido pela regra</option>
          </select>
        </div>
      </div>

      {/* Cobertura: o painel diz o que ele NÃO consegue afirmar. */}
      {(semCobertura > 0 || anosRuins.length > 0) && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs px-3 py-2.5 flex gap-2 items-start">
          <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-600 leading-relaxed">
            <strong>{semCobertura} posição(ões) fora da conta</strong> — o mandato venceu num período em que a base não
            cobre o Boletim inteiro, e aí um ano mal carregado é indistinguível de um ano sem designação nenhuma. Preferimos
            não afirmar.
            {anosRuins.length > 0 && (
              <> Anos incompletos:{' '}
                {anosRuins.map(c => `${c.ano} (${c.pct}%)`).join(', ')}.
              </>
            )}
          </p>
        </div>
      )}

      {!filtrada.length ? (
        <div className="bg-white p-6 rounded-lg border border-slate-200 text-center">
          <Info className="w-6 h-6 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">Nenhum setor sem chefia com os filtros atuais.</p>
          <p className="text-xs text-slate-500 mt-1">
            {r?.total ? `${r.total} posições analisadas.` : 'Importe a base de chefias (ato_funcoes) para ver este painel.'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtrada.map((s, i) => {
            const g = GRAV[gravDe(s.diasVago)];
            return (
              <div key={s.atoId + s.cargo + i}
                className={`bg-white rounded-lg border border-slate-200 border-l-4 ${g.card} shadow-xs px-3 py-2.5`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[11px] font-bold">
                        {s.cargo}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">{s.unidade}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Mandato de <strong>{s.prazoMeses / 12} anos</strong> iniciado em <strong>{fmtBR(s.inicio)}</strong>
                      {s.inicioOrigem === 'tampao' && ' (completando mandato do antecessor)'}
                      {' '}· último designado: <strong>{s.nome || 'não identificado'}</strong>
                      {s.siape && <span className="font-mono"> ({s.siape})</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {s.linkBoletim ? (
                        <a href={s.linkBoletim} target="_blank" referrerPolicy="no-referrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline text-[11px] font-semibold">
                          {s.atoLabel} <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : <span className="text-[11px] text-slate-500 font-semibold">{s.atoLabel}</span>}
                      {/* Lei x dedução, na linha. Sem isto o gabinete lê uma
                          data e não sabe qual das duas está olhando. */}
                      {s.prazoOrigem === 'presumido_cargo' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-300 bg-slate-50 text-slate-600 text-[10px] font-semibold">
                          <AlertTriangle className="w-2.5 h-2.5" /> prazo presumido pela regra do cargo
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                          prazo declarado no ato
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold ${g.texto}`}>{haQuanto(s.diasVago)}</div>
                    <div className="text-[11px] text-slate-500">vago desde {fmtBR(s.fim)}</div>
                    <div className={`inline-block mt-1 px-1.5 py-0.5 rounded border text-[10px] font-bold ${g.chip}`}>
                      {g.rotulo}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-slate-400 px-1 leading-relaxed">
        <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
        Regra de mandato confirmada em 5.555 designações do Boletim: <strong>Departamento (Chefe, Subchefe) = 2 anos</strong>;{' '}
        <strong>Curso/Programa e Unidade (Coordenador, Vice-Coordenador, Diretor, Vice-Diretor) = 4 anos</strong>.
        Pró-Reitor, Superintendente e Gerente não entram: servem a gestão, não a mandato fixo (181 designações, nenhuma com prazo).
        {kpis.presumido > 0 && <> {kpis.presumido} das posições acima usam prazo <strong>presumido pela regra</strong> porque o ato não o declarou.</>}
      </p>
    </div>
  );
}
