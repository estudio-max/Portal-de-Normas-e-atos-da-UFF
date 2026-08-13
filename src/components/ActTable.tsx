import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, SlidersHorizontal, X, AlertCircle, ChevronLeft, ChevronRight,
  ArrowUpDown, Loader2, Link as LinkIcon, Trash2, FileText,
} from 'lucide-react';
import * as ds from '../dataSource';
import { UffAct } from '../types';
import { ActListCard } from './acts/ActListCard';
import { PageHeader } from './ui/PageHeader';
import { FiltrosAvancados, type CampoAvancado } from './acts/FiltrosAvancados';

const ORDENACOES = [
  { valor: 'data_ato', rotulo: 'Data' },
  { valor: 'tipo', rotulo: 'Tipo e número' },
  { valor: 'sigla', rotulo: 'Órgão emissor' },
  { valor: 'status', rotulo: 'Status' },
];

// Tabela com paginação/busca/filtros NO SERVIDOR (modo API). Read-only.
export default function ActTable({ buscaGlobal = '' }: { buscaGlobal?: string }) {
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('todos');
  const [orgao, setOrgao] = useState('todos');
  const [ano, setAno] = useState('todos');
  const [status, setStatus] = useState('todos');
  const [nome, setNome] = useState('');
  const [siape, setSiape] = useState('');
  const [processo, setProcesso] = useState('');
  const [soRel, setSoRel] = useState(false);
  const [soSei, setSoSei] = useState(false);
  const [ordenar, setOrdenar] = useState('data_ato');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [pagina, setPagina] = useState(1);
  const [painelAberto, setPainelAberto] = useState(false);

  const [resp, setResp] = useState<ds.ListaResp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<{ tipos: string[]; orgaos: string[]; anos: number[] }>({ tipos: [], orgaos: [], anos: [] });
  const [ficha, setFicha] = useState<UffAct | null>(null);

  const POR = 50;
  useEffect(() => { ds.getFiltros().then(setFiltros); }, []);
  useEffect(() => { setBusca(buscaGlobal); setPagina(1); }, [buscaGlobal]);

  const buscar = useCallback(async () => {
    setCarregando(true);
    const r = await ds.listAtos({
      busca, tipo, orgao, ano, status, nome, siape, processo,
      com_relacoes: soRel, com_sei: soSei, ordenar, dir, pagina, por_pagina: POR,
    });
    setResp(r); setCarregando(false);
  }, [busca, tipo, orgao, ano, status, nome, siape, processo, soRel, soSei, ordenar, dir, pagina]);

  // debounce nas digitações; imediato nos selects/paginação
  const t = useRef<any>(null);
  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(buscar, 300);
    return () => clearTimeout(t.current);
  }, [buscar]);

  // volta para a página 1 quando muda um filtro
  useEffect(() => { setPagina(1); }, [busca, tipo, orgao, ano, status, nome, siape, processo, soRel, soSei]);

  const limpar = () => {
    setBusca(''); setTipo('todos'); setOrgao('todos'); setAno('todos'); setStatus('todos');
    setNome(''); setSiape(''); setProcesso(''); setSoRel(false); setSoSei(false);
  };

  // Cada filtro ativo vira um chip que se lê sozinho: leva o NOME DO CAMPO
  // junto do valor ("Órgão: PROGEPE"), porque "PROGEPE" solto não diz de onde
  // veio, e leva a própria ação de remover. Sem isto, a única forma de desfazer
  // um filtro era achá-lo de volta dentro do painel.
  const chips = useMemo(() => {
    const lista: { chave: string; rotulo: string; limpar: () => void }[] = [];
    if (busca) lista.push({ chave: 'busca', rotulo: `Busca: ${busca}`, limpar: () => setBusca('') });
    if (tipo !== 'todos') lista.push({ chave: 'tipo', rotulo: `Tipo: ${tipo}`, limpar: () => setTipo('todos') });
    if (ano !== 'todos') lista.push({ chave: 'ano', rotulo: `Ano: ${ano}`, limpar: () => setAno('todos') });
    if (status !== 'todos') lista.push({
      chave: 'status',
      rotulo: `Status: ${status === 'Ativo' ? 'Vigente' : status}`,
      limpar: () => setStatus('todos'),
    });
    if (orgao !== 'todos') lista.push({ chave: 'orgao', rotulo: `Órgão: ${orgao}`, limpar: () => setOrgao('todos') });
    if (nome) lista.push({ chave: 'nome', rotulo: `Nome: ${nome}`, limpar: () => setNome('') });
    if (siape) lista.push({ chave: 'siape', rotulo: `SIAPE: ${siape}`, limpar: () => setSiape('') });
    if (processo) lista.push({ chave: 'processo', rotulo: `Processo: ${processo}`, limpar: () => setProcesso('') });
    if (soRel) lista.push({ chave: 'soRel', rotulo: 'Só com relações', limpar: () => setSoRel(false) });
    if (soSei) lista.push({ chave: 'soSei', rotulo: 'Só com processo', limpar: () => setSoSei(false) });
    return lista;
  }, [busca, tipo, ano, status, orgao, nome, siape, processo, soRel, soSei]);

  const avancadosAtivos = [orgao !== 'todos', !!nome, !!siape, !!processo, soRel, soSei].filter(Boolean).length;

  const corRel = (tp: string) => tp === 'Revoga' ? 'bg-rose-100 text-rose-800 border-rose-200'
    : tp === 'Altera' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-indigo-100 text-indigo-800 border-indigo-200';
  const corStatus = (s: string) => s === 'Ativo' ? 'bg-green-100 text-green-700 border-green-200'
    : s === 'Revogado' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200';

  const total = resp?.total ?? 0;
  const paginas = resp?.paginas ?? 1;
  const vazio = !carregando && resp !== null && resp.atos.length === 0;
  // A PRIMEIRA carga não tem número nenhum para mostrar — e mostrar "0 atos
  // encontrados" enquanto a consulta ainda corre afirma um resultado que não
  // existe. É a regra 3 da proposta: carregando, vazio e erro são estados
  // visuais diferentes.
  const semResultadoAinda = carregando && resp === null;

  const valoresAvancados: CampoAvancado = { emissor: orgao, nome, siape, processo, soRel, soSei };
  const trocaAvancado = <K extends keyof CampoAvancado>(campoNome: K, valor: CampoAvancado[K]) => {
    if (campoNome === 'emissor') setOrgao(valor as string);
    if (campoNome === 'nome') setNome(valor as string);
    if (campoNome === 'siape') setSiape(valor as string);
    if (campoNome === 'processo') setProcesso(valor as string);
    if (campoNome === 'soRel') setSoRel(valor as boolean);
    if (campoNome === 'soSei') setSoSei(valor as boolean);
  };

  const rotuloCampo = 'block text-[12px] font-medium text-[#1A202C] mb-1';
  const selectCampo =
    'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[13px] text-[#1A202C] focus:border-[#006400] focus:outline-none';

  return (
    <div className="space-y-5 max-w-[1400px]">
      <PageHeader
        titulo="Atos e Normas"
        descricao="Encontre portarias, editais, resoluções e outros atos da UFF."
      />

      {/* Busca e filtros essenciais */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 space-y-4">
        <div>
          <label htmlFor="busca-atos" className="sr-only">Buscar atos</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input
              id="busca-atos"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por número, ementa, processo ou pessoa"
              aria-describedby="ajuda-busca-atos"
              className="w-full rounded-xl border border-[#E2E8F0] bg-white py-3 pl-11 pr-10 text-[14px] text-[#1A202C] placeholder:text-[#64748B] focus:border-[#006400] focus:outline-none"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                aria-label="Limpar a busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#64748B] hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <p id="ajuda-busca-atos" className="mt-1.5 text-[12px] text-[#4A5568]">
            Aceita número do ato, palavras da ementa, número de processo e nome de pessoa.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={rotuloCampo} htmlFor="filtro-tipo">Tipo</label>
            <select id="filtro-tipo" value={tipo} onChange={e => setTipo(e.target.value)} className={selectCampo}>
              <option value="todos">Todos</option>
              {filtros.tipos.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div>
            <label className={rotuloCampo} htmlFor="filtro-ano">Ano</label>
            <select id="filtro-ano" value={ano} onChange={e => setAno(e.target.value)} className={selectCampo}>
              <option value="todos">Todos</option>
              {filtros.anos.map(a => <option key={a} value={String(a)}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className={rotuloCampo} htmlFor="filtro-status">Status</label>
            <select id="filtro-status" value={status} onChange={e => setStatus(e.target.value)} className={selectCampo}>
              <option value="todos">Todos</option>
              <option value="Ativo">Vigentes</option>
              <option value="Revogado">Revogados</option>
              <option value="Alterado">Alterados</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setPainelAberto(true)}
              aria-expanded={painelAberto}
              aria-controls="painel-filtros-avancados"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] px-3 py-2 text-[13px] font-medium text-[#1A202C] hover:bg-[#F0F7F0]/60"
            >
              <SlidersHorizontal size={15} />
              Mais filtros
              {avancadosAtivos > 0 && (
                <span className="rounded-full bg-[#006400] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {avancadosAtivos}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Chips de filtro ativo */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map(c => (
            <button
              key={c.chave}
              onClick={c.limpar}
              aria-label={`Remover o filtro ${c.rotulo}`}
              className="chip-filtro inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium"
            >
              {c.rotulo}
              <X size={12} aria-hidden="true" />
            </button>
          ))}
          <button
            onClick={limpar}
            className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-medium text-[#4A5568] hover:text-[#1A202C]"
          >
            <Trash2 size={13} /> Limpar filtros
          </button>
        </div>
      )}

      {/* Contagem + ordenação */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] font-semibold text-[#1A202C]" aria-live="polite">
          {semResultadoAinda ? (
            <span className="inline-flex items-center gap-2 font-medium text-[#4A5568]">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando atos…
            </span>
          ) : (
            <>
              {total.toLocaleString('pt-BR')} {total === 1 ? 'ato encontrado' : 'atos encontrados'}
              {carregando && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-[#4A5568]" />}
            </>
          )}
        </p>

        <div className="flex items-center gap-2">
          <label htmlFor="ordenar-por" className="text-[12px] font-medium text-[#4A5568]">Ordenar por</label>
          <select
            id="ordenar-por"
            value={ordenar}
            onChange={e => setOrdenar(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[13px] text-[#1A202C] focus:border-[#006400] focus:outline-none"
          >
            {ORDENACOES.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
          <button
            onClick={() => setDir(d => d === 'asc' ? 'desc' : 'asc')}
            aria-label={dir === 'desc' ? 'Ordenar do menor para o maior' : 'Ordenar do maior para o menor'}
            title={dir === 'desc' ? 'Maior primeiro' : 'Menor primeiro'}
            className="rounded-lg border border-[#E2E8F0] bg-white p-2 text-[#4A5568] hover:bg-gray-50"
          >
            <ArrowUpDown size={14} />
          </button>
        </div>
      </div>

      {/* Resultados */}
      <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
        <div className="space-y-2 p-2 md:hidden">
          {semResultadoAinda ? (
            <p className="py-10 text-center text-[13px] text-[#4A5568]">Buscando atos…</p>
          ) : vazio ? (
            <EstadoVazio temFiltro={chips.length > 0} onLimpar={limpar} />
          ) : (
            resp?.atos.map(a => <ActListCard key={a.id} act={a} onOpen={abrir} />)
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <caption className="sr-only">
              Atos e normas encontrados, com tipo, ementa, órgão emissor, data e situação de vigência.
            </caption>
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F7FAFC] text-[12px] font-semibold uppercase tracking-wide text-[#4A5568]">
                <th scope="col" className="px-4 py-3">Tipo e número</th>
                <th scope="col" className="px-4 py-3">Ementa</th>
                <th scope="col" className="w-28 px-4 py-3">Órgão</th>
                <th scope="col" className="w-28 px-4 py-3">Data</th>
                <th scope="col" className="w-36 px-4 py-3">Relações</th>
                <th scope="col" className="w-28 px-4 py-3">Status</th>
                <th scope="col" className="w-28 px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] text-[13px] text-[#1A202C]">
              {semResultadoAinda ? (
                <tr><td colSpan={7} className="py-14 text-center text-[13px] text-[#4A5568]">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Buscando atos…
                </td></tr>
              ) : vazio ? (
                <tr><td colSpan={7} className="py-4"><EstadoVazio temFiltro={chips.length > 0} onLimpar={limpar} /></td></tr>
              ) : resp?.atos.map(a => (
                <tr key={a.id} className="hover:bg-[#F0F7F0]/50">
                  <td className="px-4 py-3.5 align-top">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F0F7F0] text-[#1A3A1A]">
                        <FileText size={15} />
                      </span>
                      <span className="font-semibold leading-snug">
                        {a.tipo} nº {a.numero}/{a.ano}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <p className="line-clamp-2 leading-relaxed text-[#4A5568]" title={a.ementa}>{a.ementa}</p>
                    {a.processoSei && (
                      <p className="mt-1 font-mono text-[12px] text-[#3182CE]">{a.processoSei}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 align-top text-[12px] font-semibold uppercase text-[#4A5568]">{a.sigla}</td>
                  <td className="px-4 py-3.5 align-top whitespace-nowrap text-[12px] tabular-nums text-[#4A5568]">
                    {(a.dataAssinatura || '').split('-').reverse().join('/')}
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    {a.relTipos.length === 0 && a.refCount === 0
                      ? <span className="text-[12px] text-[#64748B]">—</span>
                      : (
                        <span className="flex flex-wrap items-center gap-1">
                          {a.relTipos.map((tp, i) => (
                            <span key={i} className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase ${corRel(tp)}`}>{tp}</span>
                          ))}
                          {a.refCount > 0 && (
                            <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                              ↩ {a.refCount}
                            </span>
                          )}
                        </span>
                      )}
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${corStatus(a.status)}`}>
                      {a.status === 'Ativo' ? 'Vigente' : a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 align-top text-right">
                    {/* Ação TEXTUAL, não um ícone de olho: "Ver ato" diz o que
                        acontece, e o alvo cresce para além dos 24 px do ícone. */}
                    <button
                      onClick={() => abrir(a.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[13px] font-medium text-[#3182CE] hover:bg-[#F0F7F0] hover:underline"
                    >
                      Ver ato <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paginas > 1 && (
          <div className="border-t border-[#E2E8F0] px-4 py-3">
            <Paginacao pagina={pagina} paginas={paginas} setPagina={setPagina} />
          </div>
        )}
      </div>

      <div id="painel-filtros-avancados">
        <FiltrosAvancados
          aberto={painelAberto}
          onFechar={() => setPainelAberto(false)}
          orgaos={filtros.orgaos}
          valores={valoresAvancados}
          onChange={trocaAvancado}
          onLimpar={() => {
            setOrgao('todos'); setNome(''); setSiape(''); setProcesso('');
            setSoRel(false); setSoSei(false);
          }}
        />
      </div>

      {ficha && <Ficha ato={ficha} abrir={abrir} fechar={() => setFicha(null)} corRel={corRel} corStatus={corStatus} setSiape={(s) => { setFicha(null); setNome(''); setSiape(s); }} />}
    </div>
  );

  function abrir(id: string) { ds.getAto(id).then(a => { if (a) setFicha(a); }); }
}

/** Estado vazio: explica o que aconteceu e oferece a saída. Um "Nenhum
 *  resultado" seco deixa a pessoa sem saber se errou o termo ou se o acervo
 *  não tem aquilo. */
function EstadoVazio({ temFiltro, onLimpar }: { temFiltro: boolean; onLimpar: () => void }) {
  return (
    <div className="px-4 py-12 text-center">
      <AlertCircle className="mx-auto mb-3 h-7 w-7 text-[#64748B]" />
      <p className="text-[15px] font-semibold text-[#1A202C]">Nenhum ato corresponde a esta consulta.</p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-[#4A5568]">
        {temFiltro
          ? 'Tente remover um dos filtros ativos, ampliar o intervalo de anos ou usar menos palavras na busca.'
          : 'Tente usar menos palavras, ou buscar pelo número do ato em vez da ementa.'}
      </p>
      {temFiltro && (
        <button
          onClick={onLimpar}
          className="mt-4 rounded-lg border border-[#E2E8F0] px-4 py-2 text-[13px] font-medium text-[#1A202C] hover:bg-[#F0F7F0]/60"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}

function Paginacao({ pagina, paginas, setPagina }: { pagina: number; paginas: number; setPagina: (n: number) => void }) {
  if (paginas <= 1) return null;

  // Janela de páginas em torno da atual, com primeira e última sempre à mão.
  const janela: (number | '…')[] = [];
  const perto = (n: number) => Math.abs(n - pagina) <= 1;
  for (let n = 1; n <= paginas; n++) {
    if (n === 1 || n === paginas || perto(n)) janela.push(n);
    else if (janela[janela.length - 1] !== '…') janela.push('…');
  }

  const botao = 'min-w-[36px] rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors';

  return (
    <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Paginação dos resultados">
      <button
        disabled={pagina <= 1}
        onClick={() => setPagina(pagina - 1)}
        className={`${botao} inline-flex items-center gap-1 border-[#E2E8F0] bg-white text-[#4A5568] disabled:opacity-40 hover:enabled:bg-gray-50`}
      >
        <ChevronLeft className="h-4 w-4" /> Anterior
      </button>

      {janela.map((n, i) => n === '…' ? (
        <span key={`gap-${i}`} className="px-1 text-[13px] text-[#64748B]" aria-hidden="true">…</span>
      ) : (
        <button
          key={n}
          onClick={() => setPagina(n)}
          aria-current={n === pagina ? 'page' : undefined}
          aria-label={`Página ${n}`}
          className={`${botao} ${n === pagina
            ? 'border-[#006400] bg-[#006400] text-white'
            : 'border-[#E2E8F0] bg-white text-[#4A5568] hover:bg-gray-50'}`}
        >
          {n}
        </button>
      ))}

      <button
        disabled={pagina >= paginas}
        onClick={() => setPagina(pagina + 1)}
        className={`${botao} inline-flex items-center gap-1 border-[#E2E8F0] bg-white text-[#4A5568] disabled:opacity-40 hover:enabled:bg-gray-50`}
      >
        Próxima <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}

// ----- Ficha (modal) -------------------------------------------------------
function Ficha({ ato, abrir, fechar, corRel, corStatus, setSiape }: any) {
  const data = (ato.dataAssinatura || '').split('-').reverse().join('/');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs" onClick={fechar}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between rounded-t-2xl bg-[#0A2540] p-5 text-white">
          <div>
            <span className="text-[12px] font-semibold uppercase tracking-widest text-[#7fd39b]">Ficha do ato indexado</span>
            <h3 className="mt-1 text-lg font-semibold">{ato.tipoAto} nº {ato.numero}/{ato.ano}</h3>
          </div>
          <button onClick={fechar} aria-label="Fechar a ficha" className="rounded-lg bg-slate-800 p-1.5 hover:bg-slate-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-5 p-6 text-[13px] text-slate-700">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Box t="Órgão emissor" v={ato.orgaoEmissor} />
            <Box t="Data de assinatura" v={data} mono />
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="text-[12px] font-semibold uppercase text-slate-600">Processo / documento SEI</div>
              <div className="mt-0.5 font-mono font-bold">{ato.processoSei || <span className="font-normal italic text-slate-500">Não vinculado</span>}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ato.linkSeiProcesso && <a href={ato.linkSeiProcesso} target="_blank" rel="noopener noreferrer" className="rounded bg-[#003366] px-2 py-1 text-[12px] font-semibold text-white no-underline">Abrir processo no SEI</a>}
                {ato.linkSeiDocumento && <a href={ato.linkSeiDocumento} target="_blank" rel="noopener noreferrer" className="rounded bg-blue-700 px-2 py-1 text-[12px] font-semibold text-white no-underline">Documento {ato.seiDocumento || ''}</a>}
              </div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="text-[12px] font-semibold uppercase text-slate-600">Status da vigência</div>
              <div className="mt-0.5"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[12px] font-semibold ${corStatus(ato.status)}`}>{ato.status}</span></div>
            </div>
          </div>

          {(ato.pessoas?.length || ato.siapes?.length || 0) > 0 && (
            <div className="space-y-1">
              <span className="block text-[12px] font-semibold uppercase text-slate-600">Pessoas citadas ({ato.pessoas?.length || ato.siapes?.length})</span>
              <div className="flex flex-wrap gap-1.5">
                {ato.pessoas?.length
                  ? ato.pessoas.map((p: any, i: number) => (
                      <button key={i} onClick={() => setSiape(p.siape)} title="Filtrar pelos atos desta matrícula"
                        className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[12px] hover:bg-blue-100">
                        {p.nome && <span className="font-medium text-slate-700">{p.nome} · </span>}
                        <span className="font-mono text-slate-600">{p.siape}</span>
                      </button>
                    ))
                  : ato.siapes!.map((s: string, i: number) => (
                      <button key={i} onClick={() => setSiape(s)}
                        className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[12px] hover:bg-blue-100">{s}</button>
                    ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            {ato.ementaInferida ? (
              <span className="block text-[12px] font-semibold uppercase text-amber-700">
                Resumo automático
                <span className="ml-2 text-[12px] font-normal normal-case text-amber-700">gerado do texto do ato — não é a ementa oficial</span>
              </span>
            ) : (
              <span className="block text-[12px] font-semibold uppercase text-slate-600">Ementa oficial</span>
            )}
            <div className={`rounded-xl border p-4 text-[13px] italic leading-relaxed ${ato.ementaInferida ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-100 bg-slate-50'}`}>“{ato.ementa}”</div>
          </div>

          <div className="space-y-2">
            <span className="block text-[12px] font-semibold uppercase text-slate-600">Este ato refere-se a ({(ato.relacoes || []).length})</span>
            {(ato.relacoes || []).length === 0 ? <p className="text-[12px] italic text-slate-600">Nenhuma referência a outros atos.</p> :
              (ato.relacoes).map((r: any, i: number) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-[12px]">
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${corRel(r.tipoRelacao)}`}>{r.tipoRelacao}</span>
                  {r.atoDestinoId ? <button onClick={() => abrir(r.atoDestinoId)} className="text-left font-semibold text-blue-800 underline decoration-dotted hover:text-blue-950">{r.atoDestino}</button>
                    : <span className="font-semibold text-slate-900">{r.atoDestino} <span className="font-normal italic text-slate-600">(ato externo)</span></span>}
                </div>
              ))}
          </div>

          <div className="space-y-2">
            <span className="block text-[12px] font-semibold uppercase text-slate-600">Referenciado por ({(ato.referenciadoPor || []).length})</span>
            {(ato.referenciadoPor || []).length === 0 ? <p className="text-[12px] italic text-slate-600">Nenhum ato posterior altera ou revoga este.</p> :
              (ato.referenciadoPor).map((rev: any, i: number) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-[12px]">
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${corRel(rev.relacao)}`}>{rev.relacao === 'Revoga' ? 'Revogado por' : rev.relacao === 'Altera' ? 'Alterado por' : 'Referenciado por'}</span>
                  <button onClick={() => abrir(rev.porId)} className="text-left font-semibold text-blue-800 underline decoration-dotted hover:text-blue-950">{rev.porLabel}</button>
                </div>
              ))}
          </div>

          {/* A fonte oficial fica sempre à mão — princípio 5 da proposta. */}
          {ato.linkBoletim && (
            <div className="border-t border-slate-100 pt-3 text-[12px] text-slate-600">
              <strong className="font-semibold">Fonte oficial:</strong>{' '}
              <a href={ato.linkBoletim} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-teal-700 hover:underline">
                Acessar a publicação no Boletim de Serviço (PDF) <LinkIcon className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Box({ t, v, mono }: { t: string; v: any; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="text-[12px] font-semibold uppercase text-slate-600">{t}</div>
      <div className={`mt-0.5 font-bold text-slate-900 ${mono ? 'font-mono' : ''}`}>{v || '—'}</div>
    </div>
  );
}
