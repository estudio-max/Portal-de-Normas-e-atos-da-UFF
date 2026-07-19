// Camada de acesso a dados. Esconde dos componentes a diferença entre:
//   - modo 'api'      : consulta a API PHP (paginação/busca no servidor)
//   - modo 'estatico' : lê o portal-data.json inteiro e filtra no navegador
// As duas implementações devolvem EXATAMENTE o mesmo formato.
import { API_BASE, JSON_FALLBACK } from './config';
import { UffAct } from './types';

export interface ListaParams {
  busca?: string; tipo?: string; orgao?: string; ano?: string; status?: string;
  nome?: string; siape?: string; com_relacoes?: boolean; com_sei?: boolean;
  ordenar?: string; dir?: 'asc' | 'desc'; pagina?: number; por_pagina?: number;
}
export interface AtoLista {
  id: string; tipo: string; sigla: string; numero: string; ano: number;
  dataAssinatura: string; ementa: string; status: string;
  processoSei: string | null; relTipos: string[]; refCount: number;
}
export interface ListaResp {
  total: number; pagina: number; por_pagina: number; paginas: number; atos: AtoLista[];
}
export interface Stats {
  total: number; vigentes: number; revogados: number; alterados: number;
  orgaos: number; comSei: number; boletins: number;
  ultimaAtualizacao?: string | null;                       // yyyy-mm-dd
  ultimoBoletim?: { arquivo: string; numero: string; ano: number; link: string | null } | null;
}

let MODO: 'api' | 'estatico' = 'estatico';
let CACHE: UffAct[] = [];                 // usado só no modo estático
let DEST: Record<string, string> = {};   // (porId|relacao) -> destId (modo estático)

export function modo() { return MODO; }
export function todosAtos(): UffAct[] { return CACHE; }   // só no modo estático

async function tentaApi(): Promise<boolean> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 4000);
    const r = await fetch(`${API_BASE}/stats`, { signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}

export async function init(): Promise<'api' | 'estatico'> {
  if (await tentaApi()) { MODO = 'api'; return MODO; }
  MODO = 'estatico';
  // carrega o JSON e prepara o índice reverso de destinos
  let dados: UffAct[] = [];
  try {
    const r = await fetch(`${JSON_FALLBACK}?t=${Date.now()}`, { cache: 'no-store' });
    if (r.ok) dados = await r.json();
  } catch { /* sem rede */ }
  if (!dados.length) {
    try { const r = await fetch('./portal-data.json'); if (r.ok) dados = await r.json(); } catch {}
  }
  CACHE = dados;
  DEST = {};
  for (const a of CACHE) for (const ref of (a.referenciadoPor || []))
    DEST[`${ref.porId}|${ref.relacao}`] = a.id;
  return MODO;
}

// Sintaxe de busca aceita na caixa principal (espelha booleanize() do PHP —
// os dois têm que concordar, senão modo API e modo estático dão resultados
// diferentes pra mesma busca):
//   "frase exata"  -> tem que aparecer como SUBSTRING LITERAL, adjacente, na
//                      ordem digitada (é o que difere de digitar as mesmas
//                      palavras soltas, que casam em qualquer ordem/posição).
//   +palavra / palavra -> as duas formas são obrigatórias (E lógico). O "+"
//                      é aceito como sintaxe explícita mas não muda o
//                      resultado: toda palavra solta já é obrigatória por
//                      padrão hoje, e assim continua.
// Sem índice FULLTEXT no navegador (é um filtro em memória), então cada
// palavra solta casa por SUBSTRING (equivalente ao "*" de sufixo do MySQL
// boolean mode), não por token exato.
export function buscaCasa(blob: string, busca: string): boolean {
  const q = busca.trim();
  if (!q) return true;
  const b = blob.toLowerCase();
  const frases: string[] = [];
  const semAspas = q.replace(/"([^"]+)"/g, (_, f) => { frases.push(f.trim().toLowerCase()); return ' '; });
  const frasesOk = frases.filter(f => f.length > 0);
  const palavras = semAspas.split(/\s+/)
    .map(t => t.replace(/[+\-><()~*"@]/g, ''))
    .filter(t => t.length >= 3);
  // nada sobrou (só palavras curtas, ex.: "ab", ou aspas vazias) -- mesmo
  // fallback do PHP quando booleanize() devolve vazio: substring literal da
  // busca crua, em vez de "não exige nada" (que casaria com qualquer ato).
  if (!frasesOk.length && !palavras.length) return b.includes(q.toLowerCase());
  for (const f of frasesOk) if (!b.includes(f)) return false;
  for (const t of palavras) if (!b.includes(t.toLowerCase())) return false;
  return true;
}

// ---------- modo ESTÁTICO (mesma lógica do mock/PHP, em TS) ----------------
function filtraEstatico(p: ListaParams): UffAct[] {
  const busca = (p.busca || '').trim();
  const nome = (p.nome || '').toLowerCase().trim();
  const siape = (p.siape || '').replace(/\D/g, '');
  return CACHE.filter(a => {
    if (busca) {
      const blob = `${a.numero} ${(a as any).identificador || ''} ${a.ementa} ${a.processoSei || ''} ${a.conteudoResumido || ''}`;
      if (!buscaCasa(blob, busca)) return false;
    }
    if (p.tipo && p.tipo !== 'todos' && a.tipoAto !== p.tipo) return false;
    if (p.orgao && p.orgao !== 'todos' && a.orgaoEmissor !== p.orgao) return false;
    if (p.ano && p.ano !== 'todos' && String(a.ano) !== String(p.ano)) return false;
    if (p.status && p.status !== 'todos' && a.status !== p.status) return false;
    // Mesma sintaxe da busca principal: o PHP já passa este campo por
    // booleanize(), então sem buscaCasa() aqui os dois modos discordariam —
    // "frase exata" funcionaria no banco e não no estático, e palavra solta
    // casaria em qualquer ordem no banco e só adjacente aqui.
    if (nome) {
      const blobNome = `${a.textoBusca || ''} ${a.ementa} ${a.orgaoEmissor || ''}`;
      if (!buscaCasa(blobNome, nome)) return false;
    }
    if (siape) {
      const ok = (a.siapes || []).some(s => s.includes(siape)) || (a.textoBusca || '').includes(siape);
      if (!ok) return false;
    }
    if (p.com_sei && !a.processoSei) return false;
    if (p.com_relacoes && !((a.relacoes && a.relacoes.length) || (a.referenciadoPor && a.referenciadoPor.length))) return false;
    return true;
  });
}

export async function listAtos(p: ListaParams): Promise<ListaResp> {
  if (MODO === 'api') {
    const qs = new URLSearchParams();
    Object.entries(p).forEach(([k, v]) => {
      if (v === undefined || v === '' || v === false) return;
      qs.set(k, v === true ? '1' : String(v));
    });
    const r = await fetch(`${API_BASE}/atos?${qs.toString()}`);
    return r.json();
  }
  let res = filtraEstatico(p);
  const chaveMap: Record<string, string> = { data_ato: 'dataAssinatura', ano: 'ano', tipo: 'tipoAto', sigla: 'orgaoEmissor', numero: 'numero', status: 'status' };
  const chave = chaveMap[p.ordenar || 'data_ato'] || 'dataAssinatura';
  const dir = (p.dir || 'desc') === 'asc' ? 1 : -1;
  res = [...res].sort((a: any, b: any) => {
    const x = a[chave] ?? '', y = b[chave] ?? '';
    return x < y ? -dir : x > y ? dir : 0;
  });
  const por = Math.min(Math.max(p.por_pagina || 50, 1), 200);
  const pag = Math.max(p.pagina || 1, 1);
  const total = res.length;
  const janela = res.slice((pag - 1) * por, (pag - 1) * por + por);
  return {
    total, pagina: pag, por_pagina: por, paginas: Math.ceil(total / por) || 1,
    atos: janela.map(a => ({
      id: a.id, tipo: a.tipoAto, sigla: a.orgaoEmissor || '', numero: a.numero,
      ano: a.ano, dataAssinatura: a.dataAssinatura, ementa: a.ementa, status: a.status,
      processoSei: a.processoSei || null,
      relTipos: Array.from(new Set((a.relacoes || []).map(r => r.tipoRelacao))),
      refCount: (a.referenciadoPor || []).length,
    })),
  };
}

export async function getAto(id: string): Promise<UffAct | null> {
  if (MODO === 'api') {
    const r = await fetch(`${API_BASE}/atos/${encodeURIComponent(id)}`);
    if (!r.ok) return null;
    return r.json();
  }
  const a = CACHE.find(x => x.id === id);
  if (!a) return null;
  // resolve o destino das relações de saída (igual ao backend)
  const relacoes = (a.relacoes || []).map(r => ({
    ...r, atoDestinoId: DEST[`${a.id}|${r.tipoRelacao}`] || null,
  }));
  return { ...a, relacoes } as any;
}

export async function getStats(): Promise<Stats> {
  if (MODO === 'api') return (await fetch(`${API_BASE}/stats`)).json();
  const c = { Ativo: 0, Revogado: 0, Alterado: 0 } as any;
  const orgs = new Set<string>(); const bols = new Set<string>(); let sei = 0;
  for (const a of CACHE) {
    c[a.status] = (c[a.status] || 0) + 1;
    orgs.add(a.orgaoEmissor || ''); bols.add((a as any).arquivo || '');
    if (a.processoSei) sei++;
  }
  // Último boletim indexado (maior numeração "NN-AA.pdf") e a data mais
  // recente de assinatura dentro dele — aproximação da última atualização.
  const chaveBol = (arq: string) => {
    const m = /^(\d+)-(\d+)/.exec(arq || '');
    return m ? parseInt(m[2], 10) * 1000 + parseInt(m[1], 10) : -1;
  };
  let ultArq = ''; let ultLink: string | null = null; let ultData = '';
  for (const a of CACHE as any[]) {
    const arq = a.arquivo || '';
    if (chaveBol(arq) > chaveBol(ultArq)) { ultArq = arq; ultLink = a.linkBoletim || null; ultData = a.dataAssinatura || ''; }
    else if (arq === ultArq && (a.dataAssinatura || '') > ultData) ultData = a.dataAssinatura;
  }
  const m = /^(\d+)-(\d+)/.exec(ultArq);
  return {
    total: CACHE.length, vigentes: c.Ativo || 0, revogados: c.Revogado || 0,
    alterados: c.Alterado || 0, orgaos: orgs.size, comSei: sei, boletins: bols.size,
    ultimaAtualizacao: ultData || null,
    ultimoBoletim: ultArq ? { arquivo: ultArq, numero: m ? m[1] : ultArq, ano: m ? 2000 + parseInt(m[2], 10) : 0, link: ultLink } : null,
  };
}

// ---------- CHEFIAS (titular atual por unidade + cargo) -------------------
export interface Chefia {
  cargo: string; unidade: string; nome: string | null; siape: string | null;
  desde: string; atoId: string; atoLabel: string; linkBoletim: string | null;
}
export interface ChefiasResp { total: number; atualizadoEm: string; chefias: Chefia[]; }

export async function getChefias(): Promise<ChefiasResp> {
  if (MODO === 'api') {
    try {
      const r = await fetch(`${API_BASE}/chefias`);
      if (r.ok) {
        const j = await r.json();
        // só aceita se vier no formato esperado (API antiga cai p/ vazio, sem quebrar)
        if (j && Array.isArray(j.chefias))
          return { total: j.total ?? j.chefias.length, atualizadoEm: j.atualizadoEm ?? '', chefias: j.chefias };
      }
    } catch { /* cai p/ estático */ }
    return { total: 0, atualizadoEm: '', chefias: [] };
  }
  // Estático: projeta do CACHE. Cada ato traz .funcoes + dataAssinatura.
  // Regra (igual ao SQL): por (unidade_chave|cargo) vale o evento de MAIOR
  // data; só conta como titular se esse evento for 'designar'.
  type Ev = {
    acao: string; cargo: string; unidade: string; chave: string;
    nome: string; siape: string; data: string; atoId: string; atoLabel: string; link: string | null;
  };
  const porPos: Record<string, Ev> = {};
  for (const a of CACHE as any[]) {
    for (const f of (a.funcoes || [])) {
      const chave = f.unidade_chave || f.unidadeChave || '';
      const data = a.dataAssinatura || '';
      if (!chave || !data) continue;
      let nome = f.nome || '';
      if (!nome && f.siape) nome = ((a.pessoas || []).find((x: any) => x.siape === f.siape)?.nome) || '';
      const e: Ev = {
        acao: f.acao, cargo: f.cargo, unidade: f.unidade, chave, nome, siape: f.siape || '',
        data, atoId: a.id, atoLabel: `${a.tipoAto} nº ${a.numero}/${a.ano}`, link: a.linkBoletim || null,
      };
      const k = `${chave}|${(f.cargo || '').toLowerCase()}`;
      const cur = porPos[k];
      if (!cur || e.data > cur.data || (e.data === cur.data && e.atoId > cur.atoId)) porPos[k] = e;
    }
  }
  // Corte de mandato (igual ao PHP): sem nenhum ato novo há mais de 4 anos, é
  // mais provável que a chave da unidade tenha mudado de grafia entre
  // boletins do que a pessoa seguir de fato no posto há tantos anos.
  const limiteMandato = new Date();
  limiteMandato.setFullYear(limiteMandato.getFullYear() - 4);
  const limiteStr = limiteMandato.toISOString().slice(0, 10);
  // Reitor é nomeado por ato externo (decreto presidencial no DOU), nunca
  // pelo Boletim de Serviço — nunca vamos captar essa designação, então não
  // faz sentido exibir o cargo (ficaria sempre errado ou vazio). Vice-Reitor
  // e Pró-Reitor continuam, pois são designados por ato interno no boletim.
  const chefias: Chefia[] = Object.values(porPos)
    .filter(e => e.acao === 'designar' && e.data >= limiteStr && e.cargo.trim().toLowerCase() !== 'reitor')
    .map(e => ({
      cargo: e.cargo, unidade: e.unidade, nome: e.nome || null, siape: e.siape || null,
      desde: e.data, atoId: e.atoId, atoLabel: e.atoLabel, linkBoletim: e.link,
    }))
    .sort((a, b) => a.unidade.localeCompare(b.unidade) || a.cargo.localeCompare(b.cargo));
  return { total: chefias.length, atualizadoEm: new Date().toISOString().slice(0, 10), chefias };
}

// ---------- MANDATOS (setores sem chefia formalmente constituída) ---------
export type SituacaoMandato = 'sem_chefia' | 'em_dia' | 'sem_cobertura';
export interface Mandato {
  unidade: string; cargo: string; nome: string | null; siape: string | null;
  inicio: string; inicioOrigem: string;
  prazoMeses: number; prazoOrigem: 'declarado' | 'presumido_cargo';
  fim: string; diasVago: number; situacao: SituacaoMandato;
  atoId: string; atoLabel: string; linkBoletim: string | null;
}
export interface CoberturaAno {
  ano: number; carregados: number; publicados: number; pct: number; confiavel: boolean;
}
export interface MandatosResp {
  total: number; atualizadoEm: string;
  resumo: { semChefia: number; emDia: number; semCobertura: number };
  cobertura: CoberturaAno[]; setores: Mandato[];
}

// Regra de mandato da UFF, confirmada no corpus (5.555 designações, 2001-2026):
// o CARGO decide o prazo. Onde o ato declara, a pureza é 100% (Chefe 898/898
// em 2 anos; Coordenador 897/897 em 4) e em 128 mil atos não existe um único
// mandato que não seja 2 ou 4 anos. Pró-Reitor/Superintendente/Gerente ficam
// fora de propósito: 181 designações, ZERO com prazo — servem a gestão, não a
// mandato fixo. Espelha REGRA_MANDATO do index.php.
const REGRA_MANDATO: Record<string, number> = {
  'chefe': 24, 'subchefe': 24,
  'coordenador': 48, 'vice-coordenador': 48,
  'diretor': 48, 'vice-diretor': 48,
};

function somaMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, d));
  // 29/02 + N anos cai em 01/03 no ano comum; volta p/ o último dia de fev,
  // que é o fim de mandato que a UFF de fato conta.
  if (alvo.getUTCDate() !== d) alvo.setUTCDate(0);
  return alvo.toISOString().slice(0, 10);
}

export async function getMandatos(): Promise<MandatosResp> {
  const vazio: MandatosResp = {
    total: 0, atualizadoEm: '', resumo: { semChefia: 0, emDia: 0, semCobertura: 0 },
    cobertura: [], setores: [],
  };
  if (MODO === 'api') {
    try {
      const r = await fetch(`${API_BASE}/mandatos`);
      if (r.ok) {
        const j = await r.json();
        if (j && Array.isArray(j.setores)) return j as MandatosResp;
      }
    } catch { /* API antiga/fora: cai p/ vazio sem quebrar a aba */ }
    return vazio;
  }

  // ---- Estático: projeta do CACHE, mesma regra do SQL.
  const hoje = new Date().toISOString().slice(0, 10);

  // Cobertura: a numeração do BS é sequencial no ano, então o MAIOR número do
  // ano diz quantos boletins existiram — auto-calibra, sem constante mágica.
  // Sem este guarda o painel acusaria de acefalia setores que só estão mal
  // indexados: da beirada de dentro, ano mal carregado é indistinguível de ano
  // sem designação nenhuma.
  const bol: Record<number, { arq: Set<string>; ult: number }> = {};
  for (const a of CACHE as any[]) {
    const m = /(\d{1,3})\s*\/\s*(\d{4})/.exec(a.boletimNumero || '');
    if (!m) continue;
    const ano = +m[2], num = +m[1];
    if (ano < 2001 || ano > new Date().getFullYear() || num < 1 || num > 300) continue;
    (bol[ano] ||= { arq: new Set(), ult: 0 });
    bol[ano].arq.add(a.arquivo || String(num));
    bol[ano].ult = Math.max(bol[ano].ult, num);
  }
  const cobertura: CoberturaAno[] = Object.entries(bol).map(([ano, v]) => ({
    ano: +ano, carregados: v.arq.size, publicados: v.ult,
    pct: v.ult ? Math.round(100 * v.arq.size / v.ult) : 0,
    // Ano corrente ainda está sendo publicado: o último número é o de agora,
    // não o do fim do ano — nunca marcar de incompleto por isso.
    confiavel: (v.ult >= 100 || +ano >= new Date().getFullYear()) && v.arq.size >= 0.9 * v.ult,
  })).sort((x, y) => x.ano - y.ano);
  const okAno: Record<number, boolean> = {};
  for (const c of cobertura) okAno[c.ano] = c.confiavel;
  const janelaCoberta = (desde: string) => {
    for (let a = +desde.slice(0, 4); a <= new Date().getFullYear(); a++) if (!okAno[a]) return false;
    return true;
  };

  type Ev = {
    acao: string; cargo: string; unidade: string; chave: string; nome: string; siape: string;
    data: string; prazo: number | null; inicio: string; org: string;
    atoId: string; atoLabel: string; link: string | null;
  };
  const todos: Ev[] = [];
  for (const a of CACHE as any[]) {
    const data = a.dataAssinatura || '';
    if (!data) continue;
    for (const f of (a.funcoes || [])) {
      const chave = f.unidade_chave || f.unidadeChave || '';
      if (!chave) continue;
      let nome = f.nome || '';
      if (!nome && f.siape) nome = ((a.pessoas || []).find((x: any) => x.siape === f.siape)?.nome) || '';
      todos.push({
        acao: f.acao, cargo: (f.cargo || '').trim(), unidade: f.unidade, chave, nome,
        siape: (f.siape || '').trim(), data, prazo: f.prazo_meses ?? null,
        inicio: f.data_inicio || data, org: f.inicio_origem || 'data_ato',
        atoId: a.id, atoLabel: `${a.tipoAto} nº ${a.numero}/${a.ano}`, link: a.linkBoletim || null,
      });
    }
  }

  // Vale a designação MAIS RECENTE de cada (unidade_chave, cargo). Sem o corte
  // de 4 anos da aba Chefias: lá ele evita mostrar titular fantasma, aqui a
  // posição vencida é justamente o que se procura — cortá-la esconderia o achado.
  const porPos: Record<string, Ev> = {};
  for (const e of todos) {
    if (e.acao !== 'designar') continue;
    if (!(e.cargo.toLowerCase() in REGRA_MANDATO)) continue;
    const k = `${e.chave}|${e.cargo.toLowerCase()}`;
    const c = porPos[k];
    if (!c || e.data > c.data || (e.data === c.data && e.atoId > c.atoId)) porPos[k] = e;
  }
  // Situação atual da PESSOA: só permanece se o último evento dela for
  // exatamente esta designação. Resolve unidade renomeada e quem mudou de cargo.
  const ult: Record<string, Ev> = {};
  for (const e of todos) {
    if (!e.siape) continue;
    const m = ult[e.siape];
    if (!m || e.data > m.data || (e.data === m.data && e.acao === 'designar')) ult[e.siape] = e;
  }

  const setores: Mandato[] = [];
  for (const [k, e] of Object.entries(porPos)) {
    const u = e.siape ? ult[e.siape] : null;
    if (u && (u.acao !== 'designar' || `${u.chave}|${u.cargo.toLowerCase()}` !== k)) continue;
    const declarado = e.prazo || 0;
    const prazo = declarado || REGRA_MANDATO[e.cargo.toLowerCase()];
    if (!prazo) continue;
    const fim = somaMeses(e.inicio, prazo);
    const situacao: SituacaoMandato =
      fim >= hoje ? 'em_dia' : !janelaCoberta(fim) ? 'sem_cobertura' : 'sem_chefia';
    setores.push({
      unidade: e.unidade, cargo: e.cargo, nome: e.nome || null, siape: e.siape || null,
      inicio: e.inicio, inicioOrigem: e.org, prazoMeses: prazo,
      // O gabinete tem que ver, na linha, se o prazo é o que o ato disse ou o
      // que a regra do cargo deduziu — senão lê uma data sem saber se é lei.
      prazoOrigem: declarado ? 'declarado' : 'presumido_cargo',
      fim, situacao,
      diasVago: situacao === 'sem_chefia'
        ? Math.floor((Date.parse(hoje) - Date.parse(fim)) / 86400000) : 0,
      atoId: e.atoId, atoLabel: e.atoLabel, linkBoletim: e.link,
    });
  }
  setores.sort((a, b) => a.fim.localeCompare(b.fim));
  return {
    total: setores.length, atualizadoEm: hoje,
    resumo: {
      semChefia: setores.filter(s => s.situacao === 'sem_chefia').length,
      emDia: setores.filter(s => s.situacao === 'em_dia').length,
      semCobertura: setores.filter(s => s.situacao === 'sem_cobertura').length,
    },
    cobertura, setores,
  };
}

// ---------- INSIGHTS (agregações para a aba de painéis) -------------------
export interface OrgaoStat { sigla: string; n: number; comSei: number; }
export interface Insights {
  ano: number | null;
  anos: number[];
  kpis: {
    total: number; comSei: number; revogados: number; alterados: number;
    vigentes: number; orgaos: number; relacoes: number;
    dataMin: string | null; dataMax: string | null;
  };
  porDia: { d: string; n: number }[];
  porMes: { ym: string; n: number }[];
  porOrgao: OrgaoStat[];
  porTipo: { tipo: string; n: number }[];
}

export async function getInsights(ano?: string | number): Promise<Insights> {
  const recorte = ano !== undefined && ano !== '' && ano !== 'todos';
  if (MODO === 'api') {
    const qs = recorte ? `?ano=${encodeURIComponent(String(ano))}` : '';
    return (await fetch(`${API_BASE}/insights${qs}`)).json();
  }
  // ESTÁTICO: computa do CACHE (mesmo formato do endpoint).
  const anoSel = recorte ? Number(ano) : null;
  const base = anoSel ? CACHE.filter(a => a.ano === anoSel) : CACHE;
  const temSei = (a: UffAct) => !!(a.processoSei && a.processoSei !== '');

  let comSei = 0, revogados = 0, alterados = 0, relacoes = 0;
  let dataMin: string | null = null, dataMax: string | null = null;
  const orgaos = new Set<string>();
  const porDiaM = new Map<string, number>();
  const porMesM = new Map<string, number>();
  const porOrgaoM = new Map<string, { n: number; comSei: number }>();
  const porTipoM = new Map<string, number>();

  for (const a of base) {
    if (temSei(a)) comSei++;
    if (a.status === 'Revogado') revogados++;
    else if (a.status === 'Alterado') alterados++;
    relacoes += (a.relacoes || []).length;
    if (a.orgaoEmissor) orgaos.add(a.orgaoEmissor);
    porTipoM.set(a.tipoAto, (porTipoM.get(a.tipoAto) || 0) + 1);
    const d = a.dataAssinatura;
    if (d && /^\d{4}-\d{2}-\d{2}/.test(d)) {
      const dia = d.slice(0, 10);
      porDiaM.set(dia, (porDiaM.get(dia) || 0) + 1);
      const ym = dia.slice(0, 7);
      porMesM.set(ym, (porMesM.get(ym) || 0) + 1);
      if (!dataMin || dia < dataMin) dataMin = dia;
      if (!dataMax || dia > dataMax) dataMax = dia;
    }
    if (a.orgaoEmissor) {
      const o = porOrgaoM.get(a.orgaoEmissor) || { n: 0, comSei: 0 };
      o.n++; if (temSei(a)) o.comSei++;
      porOrgaoM.set(a.orgaoEmissor, o);
    }
  }

  const anos = Array.from(new Set(CACHE.map(a => a.ano).filter(Boolean))).sort((x, y) => y - x);
  const total = base.length;
  return {
    ano: anoSel,
    anos,
    kpis: {
      total, comSei, revogados, alterados,
      vigentes: total - revogados - alterados,
      orgaos: orgaos.size, relacoes, dataMin, dataMax,
    },
    porDia: [...porDiaM.entries()].map(([d, n]) => ({ d, n })).sort((a, b) => a.d < b.d ? -1 : 1),
    porMes: [...porMesM.entries()].map(([ym, n]) => ({ ym, n })).sort((a, b) => a.ym < b.ym ? -1 : 1),
    porOrgao: [...porOrgaoM.entries()].map(([sigla, o]) => ({ sigla, n: o.n, comSei: o.comSei }))
      .sort((a, b) => b.n - a.n).slice(0, 12),
    porTipo: [...porTipoM.entries()].map(([tipo, n]) => ({ tipo, n })).sort((a, b) => b.n - a.n),
  };
}

// ---------- ANALÍTICO / FASE 2 (rotatividade + zumbis) --------------------
export interface Cadeira { unidade: string; cargo: string; titulares: number; permMedia: number; }
// Uma "citação defasada": um ato que referencia uma norma DEPOIS da revogação
// dela. Pivota no ato citante (citX) — o item acionável; a norma revogada (alvo)
// é o contexto.
export interface Zumbi {
  citLabel: string; citSigla: string; citData: string | null; citLink: string | null;
  relacao: string;                       // como o citante referencia (Altera/Complementa/…)
  alvoLabel: string; alvoSigla: string;  // a norma já revogada
  revogadoEm: string | null;             // data da revogação (YYYY-MM-DD)
}
// Série anual de RH: aposentadorias concedidas (voluntária/compulsória/
// invalidez/indefinida — classificadas na EXTRAÇÃO pelo dispositivo, campo
// UffAct.aposentadoria) e vacâncias por posse em outro cargo inacumulável
// (art. 33, VIII da Lei 8.112/90 — servidor que passou em outro concurso,
// ainda detectado por regex no fallback). Conta o que foi PUBLICADO no BS.
export interface SerieRh { ano: number; vol: number; comp: number; inval: number; indef: number; vac8: number; }
// Deslocamento de servidor (classificado na extração, campo UffAct.deslocamento).
// serie = remoção (interna) × redistribuição entrada/saída por ano; motivos e
// setores são só da remoção (a redistribuição de saída é sub-registrada no BS).
// setores vem CRU e POR ANO (setor como está no ato, sem dedup): o painel
// agrega no cliente via setorCanonico() e filtra pelo intervalo de anos.
export interface SerieDesl { ano: number; remocao: number; redEntra: number; redSaida: number; }
export interface SetorAno { setor: string; ano: number; n: number; }
export interface Deslocamento {
  serie: SerieDesl[];
  motivos: { motivo: string; n: number }[];
  setores: SetorAno[];
}
export interface Analitico {
  rotatividade: {
    posicoesComTroca: number | null; totalEventos: number;
    permanenciasMedidas: number; medianaMeses: number | null; cadeiras: Cadeira[];
  };
  zumbis: Zumbi[];
  mortalidade: { total: number; mexidos: number };
  seriesRh: SerieRh[];
  deslocamento: Deslocamento;
}

// ---- Nome canônico de setor (destino de remoção) ---------------------------
// O texto dos atos ora traz a SIGLA, ora o NOME por extenso (e o extrator corta
// nomes longos em 45 chars) — sem isto, a mesma unidade vira 2-3 barras no
// ranking (ex.: "HUAP" ≠ "Hospital Universitário Antônio Pedro"). Só entram
// pares comprovados no corpus e inequívocos; o resto passa intacto.
const SETOR_ALIAS: Record<string, string> = (() => {
  const grupos: [string, string[]][] = [
    ['Hospital Universitário Antônio Pedro', ['huap', 'hospital universitario antonio pedro']],
    ['Pró-Reitoria De Administração', ['proad', 'pro-reitoria de administracao', 'pro-reitoria de administracao (proad)']],
    ['Pró-Reitoria De Graduação', ['prograd', 'pro-reitoria de graduacao']],
    ['Pró-Reitoria De Extensão', ['proex', 'pro-reitoria de extensao']],
    ['Pró-Reitoria De Assuntos Estudantis', ['proaes', 'pro-reitoria de assuntos estudantis']],
    ['Pró-Reitoria De Gestão De Pessoas', ['progepe', 'pro-reitoria de gestao de pessoas']],
    ['Pró-Reitoria De Planejamento', ['proplan', 'pro-reitoria de planejamento']],
    // PROPPI absorve o nome antigo da mesma unidade (Pesquisa e Pós-Graduação)
    // e as formas truncadas — é a mesma pró-reitoria renomeada.
    ['Pró-Reitoria De Pesquisa, Pós-Graduação E Inovação', [
      'proppi', 'pro-reitoria de pesquisa, pos-graduacao e inovacao',
      'pro-reitoria de pesquisa, pos-graduacao e ino', 'pro-reitoria de pesquisa, pos-graduacao e in',
      'pro-reitoria de pesquisa e pos-graduacao', 'pro-reitoria de pesquisa e pos graduacao',
    ]],
    ['Instituto De Arte E Comunicação Social', ['iacs', 'instituto de arte e comunicacao social']],
    ['Departamento De Desenvolvimento De Recursos Humanos', [
      'departamento de desenvolvimento de recursos humanos', 'departamento de desenvolvimento de recursos h',
    ]],
    ['Núcleo De Comunicação Social', [
      'nucleo de comunicacao social', 'nucleo de comunicacao social do gabinete do r',
      'nucleo de comunicacao social, vinculado ao ga',
    ]],
  ];
  const m: Record<string, string> = {};
  for (const [canon, chaves] of grupos) for (const k of chaves) m[k] = canon;
  return m;
})();

// dobra p/ comparação: minúsculas, sem acento, hífen sem espaços em volta
const dobraSetor = (s: string) => s
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').trim();

export function setorCanonico(setor: string): string {
  return SETOR_ALIAS[dobraSetor(setor)] || setor;
}

const mesesEntre = (a: string, b: string) =>
  Math.round(((new Date(b).getTime() - new Date(a).getTime()) / (86400000 * 30.44)) * 10) / 10;

export async function getAnalitico(): Promise<Analitico> {
  if (MODO === 'api') return (await fetch(`${API_BASE}/analitico`)).json();

  // ESTÁTICO: computa do CACHE (fino — na produção o banco tem muito mais).
  const pos: Record<string, { cargo: string; unidade: string; ev: { acao: string; data: string; ident: string }[] }> = {};
  let totalEventos = 0;
  for (const a of CACHE as any[]) {
    for (const f of (a.funcoes || [])) {
      const chave = f.unidade_chave || f.unidadeChave || '';
      const data = a.dataAssinatura || '';
      if (!chave || !data) continue;
      totalEventos++;
      let nome = (f.nome || '').toLowerCase();
      if (!nome && f.siape) nome = ((a.pessoas || []).find((x: any) => x.siape === f.siape)?.nome || '').toLowerCase();
      const k = `${chave}|${(f.cargo || '').toLowerCase()}`;
      (pos[k] = pos[k] || { cargo: f.cargo, unidade: f.unidade, ev: [] }).ev.push({
        acao: f.acao, data, ident: f.siape || nome,
      });
    }
  }
  const permanencias: number[] = [];
  let cadeiras: Cadeira[] = [];
  for (const k of Object.keys(pos)) {
    const p = pos[k];
    p.ev.sort((a, b) => a.data < b.data ? -1 : 1);
    const titulares: { ident: string; inicio: string }[] = [];
    for (const e of p.ev) {
      if (e.acao !== 'designar') continue;
      const ult = titulares[titulares.length - 1];
      if (!ult || e.ident !== ult.ident) titulares.push({ ident: e.ident, inicio: e.data });
    }
    if (titulares.length < 2) continue;
    const durs: number[] = [];
    for (let i = 0; i < titulares.length - 1; i++) {
      const m = mesesEntre(titulares[i].inicio, titulares[i + 1].inicio);
      durs.push(m); permanencias.push(m);
    }
    cadeiras.push({
      unidade: p.unidade, cargo: p.cargo, titulares: titulares.length,
      permMedia: Math.round(durs.reduce((a, b) => a + b, 0) / durs.length * 10) / 10,
    });
  }
  permanencias.sort((a, b) => a - b);
  const mediana = permanencias.length ? Math.round(permanencias[Math.floor(permanencias.length / 2)] * 10) / 10 : null;
  const nCad = cadeiras.length;
  cadeiras.sort((a, b) => b.titulares - a.titulares || a.permMedia - b.permMedia);
  cadeiras = cadeiras.slice(0, 15);

  // Citações defasadas: só normas REVOGADAS referenciadas por atos DATADOS
  // DEPOIS da revogação. A data de revogação = data do ato que a revogou (a
  // mais antiga). Exclui a própria relação 'Revoga'. Pivota no citante.
  const porId = new Map((CACHE as any[]).map(a => [a.id, a]));
  const zumbis: Zumbi[] = [];
  for (const alvo of CACHE as any[]) {
    if (alvo.status !== 'Revogado') continue;
    const refs = alvo.referenciadoPor || [];
    const datasRev = refs
      .filter((r: any) => r.relacao === 'Revoga')
      .map((r: any) => porId.get(r.porId)?.dataAssinatura)
      .filter(Boolean)
      .sort();
    const revogadoEm = datasRev[0] || null;
    if (!revogadoEm) continue;                       // sem data de revogação, não dá p/ comparar
    const alvoLabel = `${alvo.tipoAto} nº ${alvo.numero}/${alvo.ano}`;
    for (const ref of refs) {
      if (ref.relacao === 'Revoga') continue;        // não conta a própria revogação
      const cit = porId.get(ref.porId);
      if (!cit || !cit.dataAssinatura || cit.id === alvo.id) continue;
      if (cit.dataAssinatura <= revogadoEm) continue; // só citações POSTERIORES à revogação
      zumbis.push({
        citLabel: `${cit.tipoAto} nº ${cit.numero}/${cit.ano}`, citSigla: cit.orgaoEmissor || '',
        citData: cit.dataAssinatura || null, citLink: cit.linkBoletim || null,
        relacao: ref.relacao || '', alvoLabel, alvoSigla: alvo.orgaoEmissor || '', revogadoEm,
      });
    }
  }
  zumbis.sort((a, b) => (a.citData! < b.citData! ? 1 : -1));
  zumbis.splice(60);

  // Série RH — aposentadoria lê o campo ESTRUTURADO (a.aposentadoria, já
  // classificado na extração por extrai_aposentadoria(); ver extrair_boletim.py).
  // Só popula depois que o portal-data.json for regenerado pela extração com
  // esse campo — até lá esta série fica em 0, igual a qualquer painel que
  // depende de dado ainda não reprocessado (mesmo espírito da meia-vida/
  // rotatividade, que "ativam sozinhos" conforme a base cresce).
  // Vacância art. 33 VIII segue por regex (fraseado estável, sem esse problema).
  const reVago = /declara\w*\s+(?:vago|(?:a\s+)?vac[aâ]ncia)/;
  const reCausa8 = /inciso viii,? do artigo 33|posse em outro cargo inacumul|tendo em vista a posse/;
  const vazioRh = { vol: 0, comp: 0, inval: 0, indef: 0, vac8: 0 };
  const rhAno = new Map<number, typeof vazioRh>();
  for (const a of CACHE as any[]) {
    const ano = Number(a.ano);
    if (!ano || ano < 1990 || ano > 2100) continue;
    const tipoApos: string | undefined = a.aposentadoria?.tipo;
    const t = `${a.ementa || ''} ${a.conteudoResumido || ''} ${a.textoBusca || ''}`.toLowerCase();
    const vac8 = reVago.test(t) && reCausa8.test(t);
    if (!tipoApos && !vac8) continue;
    const s = rhAno.get(ano) || { ...vazioRh };
    if (tipoApos === 'Voluntária') s.vol++;
    else if (tipoApos === 'Compulsória') s.comp++;
    else if (tipoApos === 'Invalidez') s.inval++;
    else if (tipoApos === 'Indefinida') s.indef++;
    if (vac8) s.vac8++;
    rhAno.set(ano, s);
  }
  const seriesRh: SerieRh[] = [...rhAno.entries()]
    .map(([ano, s]) => ({ ano, ...s }))
    .sort((a, b) => a.ano - b.ano);

  // Deslocamento (campo estruturado a.deslocamento, classificado na extração).
  const dAno = new Map<number, { remocao: number; redEntra: number; redSaida: number }>();
  const motMap = new Map<string, number>();
  const setMap = new Map<string, SetorAno>();  // chave setor|ano — cru; painel agrega
  for (const a of CACHE as any[]) {
    const d = a.deslocamento;
    if (!d) continue;
    const ano = Number(a.ano);
    if (ano && ano >= 1990 && ano <= 2100) {
      const s = dAno.get(ano) || { remocao: 0, redEntra: 0, redSaida: 0 };
      if (d.tipo === 'Remoção') s.remocao++;
      else if (d.tipo === 'Redistribuição' && d.direcao === 'Entrada') s.redEntra++;
      else if (d.tipo === 'Redistribuição' && d.direcao === 'Saída') s.redSaida++;
      dAno.set(ano, s);
    }
    if (d.tipo === 'Remoção') {
      const mot = d.motivo || 'Não especificado';
      motMap.set(mot, (motMap.get(mot) || 0) + 1);
      if (d.setor && ano) {
        const k = `${d.setor}|${ano}`;
        const r = setMap.get(k) || { setor: d.setor, ano, n: 0 };
        r.n++;
        setMap.set(k, r);
      }
    }
  }
  const deslocamento: Deslocamento = {
    serie: [...dAno.entries()].map(([ano, s]) => ({ ano, ...s })).sort((a, b) => a.ano - b.ano),
    motivos: [...motMap.entries()].map(([motivo, n]) => ({ motivo, n })).sort((a, b) => b.n - a.n),
    setores: [...setMap.values()],
  };

  return {
    rotatividade: {
      posicoesComTroca: nCad < 15 ? nCad : null, totalEventos,
      permanenciasMedidas: permanencias.length, medianaMeses: mediana, cadeiras,
    },
    zumbis,
    mortalidade: { total: CACHE.length, mexidos: (CACHE as any[]).filter(a => a.status !== 'Ativo').length },
    seriesRh,
    deslocamento,
  };
}

// ---------- RADAR DE PRAZOS (datas-limite extraídas do texto) -------------
export interface Prazo {
  atoId: string; atoLabel: string; sigla: string; tipo: string;
  dataLimite: string; conf: 'alta' | 'média'; base: string;
  textoOrigem: string; linkBoletim: string | null; dataAto: string | null;
  mexidoDepois: boolean; status: string; ementa: string; publico: string;
  processoSei?: string; cadeiaTotal?: number;   // PAD/SINVE: nº de atos do mesmo processo
}

// Um nó da cadeia PAD/SINVE (instauração -> prorrogações/reconduções).
export interface PadCadeiaAto {
  id: string; atoLabel: string; sigla: string; tipo: string; papel: string;
  dataAto: string | null; dataLimite: string; ementa: string; status: string;
  textoOrigem: string; linkBoletim: string | null; vigente: boolean;
}
export interface PadCadeia { processo: string; total: number; atos: PadCadeiaAto[]; }

// Busca a cadeia completa (todos os atos PAD/SINVE do mesmo processo SEI).
// Só existe no modo API (os prazos PAD/SINVE são materializados no servidor).
export async function getPadCadeia(processo: string): Promise<PadCadeia | null> {
  if (MODO !== 'api' || !processo) return null;
  try {
    const r = await fetch(`${API_BASE}/pad_cadeia?processo=${encodeURIComponent(processo)}`);
    if (!r.ok) return null;
    return await r.json() as PadCadeia;
  } catch { return null; }
}

// ---- Dossiê do servidor (por SIAPE) --------------------------------------
// Um ato do dossiê. Traz a referência do BS (número/ano/seção/página) porque o
// uso final é instruir processo: o servidor precisa CITAR onde o ato saiu.
export interface DossieAto {
  id: string; tipo: string; numero: string; ano: number; sigla: string;
  dataAto: string | null; ementa: string; status: string;
  secao: string; pagina: string;
  bsNumero: number | null; bsAno: number | null; linkBoletim: string | null;
}
// Designação/dispensa de chefia. Dado ESTRUTURADO (mesma fonte de Chefias e
// Mandatos): o extrator leu cargo/unidade/mandato do dispositivo do ato.
export interface DossieFuncao {
  acao: 'designar' | 'dispensar'; cargo: string; unidade: string;
  prazoMeses: number | null; dataInicio: string | null; inicioOrigem: string | null;
  atoId: string; atoLabel: string; sigla: string;
  dataAto: string | null; status: string; linkBoletim: string | null;
}
export interface DossieResp {
  siape: string; chave: string;
  pessoas: { siape: string; nome: string }[];   // linhas cruas da base
  nomes: string[];             // p/ exibir: deduplicados sem acento/caixa
  nomesDistintos: number;      // >1 = cross-link do extrator; a aba avisa
  linhasPessoa: number;        // >1 = SIAPE fragmentado por zero à esquerda
  totalAtos: number;
  funcoes: DossieFuncao[];
  atos: DossieAto[];
  porNome: { termo: string; total: number; atos: DossieAto[] } | null;
}

// Resultado do Meu SIAPE. Forma achatada de propósito: o tsconfig deste
// projeto não liga `strict`, e sem strictNullChecks a união discriminada
// ({ok:true}|{ok:false}) não estreita no `else` — o tsc reclama de `motivo`
// não existir. Um objeto só, com `motivo` sempre presente, dispensa narrowing.
// O valor 'senha' sobrou da época em que a aba era fechada: hoje só aparece se
// a API ainda for a versão antiga (deploy pela metade), que responde 401.
export interface DossieRet {
  motivo: 'ok' | 'senha' | 'falha' | 'estatico';
  dados: DossieResp | null;
}

// Busca os atos de um SIAPE ("Meu SIAPE"). Só existe no modo API (análise
// materializada no servidor, como getPadCadeia). A rota é aberta desde
// 18/07/2026 — com o RSC, o público é o próprio servidor consultando os seus
// registros, não só a Gestão de Pessoal.
export async function getDossie(siape: string, nome: string): Promise<DossieRet> {
  if (MODO !== 'api') return { motivo: 'estatico', dados: null };
  if (!siape) return { motivo: 'falha', dados: null };
  try {
    const qs = new URLSearchParams({ siape });
    if (nome && nome.trim()) qs.set('nome', nome.trim());
    const r = await fetch(`${API_BASE}/dossie?${qs}`);
    // 401 = API antiga ainda no ar (exigia senha). O painel avisa para tentar
    // mais tarde em vez de fingir que a pessoa não tem atos.
    if (r.status === 401) return { motivo: 'senha', dados: null };
    if (!r.ok) return { motivo: 'falha', dados: null };
    const j = await r.json();
    // `atos` não distingue: a resposta de listar() (para onde a API antiga
    // manda esta rota) também tem `atos`. `pessoas` e `chave` só existem aqui —
    // sem isso o painel aceitaria o payload errado e quebraria ao ler r.nomes.
    if (!j || !Array.isArray(j.atos) || !Array.isArray(j.pessoas) || typeof j.chave !== 'string') {
      return { motivo: 'falha', dados: null };   // API antiga: rota ainda não existe
    }
    return { motivo: 'ok', dados: j as DossieResp };
  } catch { return { motivo: 'falha', dados: null }; }
}
// ---- Jornada de trabalho (Flexibilização × Programa de Gestão) -------------
// Flex usa status real (entrada/saída pelo grafo de relações REVOGA — validado
// contra planilha independente de RH, 17/07/2026, 24/24 pares corretos); PGD
// continua por menção no texto (o modelo não segue o mesmo padrão 1
// portaria-por-setor-revogada). Por isso as formas são diferentes.
export interface JornadaLinhaFlex { ano: number; entradas: number; saidas: number; ativos: number }
export interface JornadaPortariaRef { numero: string; ano: number; data: string; link: string | null }
export interface JornadaAlteracao extends JornadaPortariaRef { tipo: string }   // 'Manutenção' | 'Retificação'
export interface JornadaSetorFlex {
  setor: string; status: string; entrada: string; saida: string | null;
  aprovacao: JornadaPortariaRef;
  alteracoes: JornadaAlteracao[];
  revogacao: JornadaPortariaRef | null;
}
export interface JornadaModeloFlex { serie: JornadaLinhaFlex[]; setores: JornadaSetorFlex[] }

export interface JornadaLinha { ano: number; atos: number; setores: number; servidores: number }
export interface JornadaSetor { sigla: string; atos: number; primeiro: string | null; ultimo: string | null; servidores: number }
export interface JornadaModelo { serie: JornadaLinha[]; setores: JornadaSetor[] }

export interface JornadaResp { flex: JornadaModeloFlex; pgd: JornadaModelo }

// Agregado calculado no servidor (FULLTEXT sobre ato_texto) — só no modo API.
export async function getJornada(): Promise<JornadaResp | null> {
  if (MODO !== 'api') return null;
  try {
    const r = await fetch(`${API_BASE}/jornada`);
    if (!r.ok) return null;
    const j = await r.json();
    // API antiga cai no default listar() e devolve outra forma — valida a shape.
    if (!j || !j.flex || !Array.isArray(j.flex.serie) || !j.pgd) return null;
    return j as JornadaResp;
  } catch { return null; }
}

// ---- Cooperação (acordos, protocolos, cotutelas) ---------------------------
// Categoria, instituição parceira e país saem da EMENTA (muito estruturada
// nesses atos) — o servidor já entrega normalizado, com lat/lon quando o país
// é reconhecido, para o mapa não precisar de tabela própria.
export interface CoopSerieAno { ano: number; total: number; categorias: Record<string, number> }
export interface CoopCategoria { categoria: string; n: number }
export interface CoopPais { pais: string; n: number; lat: number; lon: number }
export interface CoopAcordo {
  id: string; numero: string; ano: number; data: string | null; link: string | null;
  sigla: string; categoria: string; instituicao: string; pais: string;
  lat: number | null; lon: number | null; ementa: string;
}
export interface CoopResp {
  serie: CoopSerieAno[]; categorias: CoopCategoria[];
  paises: CoopPais[]; acordos: CoopAcordo[];
}

export async function getCooperacao(): Promise<CoopResp | null> {
  if (MODO !== 'api') return null;
  try {
    const r = await fetch(`${API_BASE}/cooperacao`);
    if (!r.ok) return null;
    const j = await r.json();
    // API antiga cai no default listar() e devolve outra forma — valida a shape.
    if (!j || !Array.isArray(j.acordos) || !Array.isArray(j.serie)) return null;
    return j as CoopResp;
  } catch { return null; }
}

interface PrazoBruto { dataLimite: string; tipo: string; conf: 'alta' | 'média'; base: string; origem: string; ctx: string; }

// Infere PARA QUEM serve o prazo (o público que precisa agir), a partir de
// texto FOCADO (ementa + contexto ao redor da data) — nunca do corpo inteiro,
// que gera ruído. Devolve UM rótulo claro, com qualificador de domínio.
export function inferirPublico(ementa: string, contexto: string): string {
  const f = `${ementa || ''} ${contexto || ''}`.toLowerCase();
  const has = (re: RegExp) => re.test(f);
  if (has(/licitaç|pregão|contrataç|fornecedor|termo de referência|dispensa de licit|cotaç.o de preç|chamamento públic/)) return 'Fornecedores';
  if (has(/eleiç|consulta eleitoral|\bchapa|votaç|urna|escrutín|diretório acadêmic/)) return 'Comunidade (eleição)';
  const dom =
    has(/monitoria/) ? 'monitoria' :
    has(/mestrad|doutorad|pós-?gradua|\bppg|stricto sensu|lato sensu|resid.ncia médic|especializaç/) ? 'pós-graduação' :
    has(/docente|professor|magistério|magisterio|processo seletivo simplificado|\bpss\b|concurso públic/) ? 'seleção docente' :
    has(/pibic|pibid|iniciaç.o cient|\bbolsa/) ? 'bolsa' :
    has(/estági/) ? 'estágio' :
    has(/graduaç|graduand|discente|\balun[oa]s?\b|estudante/) ? 'graduação' : null;
  const selec = has(/inscriç|processo seletivo|seleç.o|candidat|concurso|\bedital|\bprova\b|classificaç/);
  if (selec) return dom ? `Candidatos · ${dom}` : 'Candidatos';
  if (dom) return dom === 'seleção docente' ? 'Docentes' : `Discentes · ${dom}`;
  if (has(/servidor|técnico-?administrativ|\btae\b/)) return 'Servidores';
  return 'Comunidade acadêmica';
}

const _MES: Record<string, number> = { janeiro:1,fevereiro:2,'março':3,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12 };
const _iso = (y: number, m: number, dd: number) => `${y}-${String(m).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
const _addDias = (b: string, n: number) => { const t = new Date(b + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0,10); };
const _addMeses = (b: string, n: number) => { const t = new Date(b + 'T00:00:00Z'); t.setUTCMonth(t.getUTCMonth() + n); return t.toISOString().slice(0,10); };
const _y4 = (y: string) => { const n = +y; return n < 100 ? 2000 + n : n; };
const _validaData = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && +s.slice(0,4) >= 2015 && +s.slice(0,4) <= 2035;

const _EXCLUI = /(período\s+aquisitivo|aquisitivo|ônus\s+limitad|afastament|licença|capacitaç|suspens|penalidade|advertência|retroativ|\bfaltas?\b|ausência|puniç|apenad|designaç|designad|exercício\s+financeiro|mandato)/;
const _INSCR = /(inscriç|matrícul|requeriment|candidatur)/;
const _RECURSO = /(recurso|impugnaç|interpos|contestaç)/;
const _ENTREGA = /(entrega|envio|encaminh|apresentaç|protocol|submet|remess|preenchiment|manifestaç)/;
const _VIGENCIA = /(comissã|banca|edital|credenciament|cadastr|chapa|portaria)/;

// Extrai datas-limite de um texto. Espelha proto validado no corpus real.
// Bias em PRECISÃO: só extrai data perto de uma intenção de prazo.
export function extrairPrazos(texto: string, dataAto: string | null): PrazoBruto[] {
  if (!texto) return [];
  const t = texto.toLowerCase();
  const out: PrazoBruto[] = [];
  const jaTem = (dl: string) => out.some(o => o.dataLimite === dl);
  const win = (i: number, w = 95) => t.slice(Math.max(0, i - w), i + w);
  const snip = (i: number) => '…' + t.slice(Math.max(0, i - 48), i + 55).replace(/\s+/g, ' ').trim() + '…';
  const push = (dl: string, tipo: string, conf: 'alta' | 'média', base: string, i: number) => {
    if (_validaData(dl) && !jaTem(dl)) out.push({ dataLimite: dl, tipo, conf, base, origem: snip(i), ctx: t.slice(Math.max(0, i - 170), i + 170) });
  };
  let m: RegExpExecArray | null;

  // 1) janela "de X a Y" — só com intenção de inscrição/recurso
  const reJan = /de\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s+a\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g;
  while ((m = reJan.exec(t))) { const c = win(m.index, 110); if (_EXCLUI.test(c)) continue;
    const intent = _INSCR.test(c) ? 'inscrição' : _RECURSO.test(c) ? 'recurso' : null; if (!intent) continue;
    push(_iso(_y4(m[6]), +m[5], +m[4]), intent, 'alta', 'data no texto', m.index);
  }
  // 2) "até DD/MM/AAAA" com intenção
  const reAteN = /até\s+(?:o\s+dia\s+|as?\s+\d{1,2}h?\s+de\s+)?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/g;
  while ((m = reAteN.exec(t))) { const c = win(m.index); if (_EXCLUI.test(c)) continue;
    const intent = _INSCR.test(c) ? 'inscrição' : _RECURSO.test(c) ? 'recurso' : _ENTREGA.test(c) ? 'entrega/requerimento' : _VIGENCIA.test(c) ? 'vigência/validade' : null;
    if (!intent) continue; push(_iso(_y4(m[3]), +m[2], +m[1]), intent, intent === 'vigência/validade' ? 'média' : 'alta', 'data no texto', m.index);
  }
  // 3) "até DD de MÊS (de AAAA)?" com intenção
  const reAteE = /até\s+(?:o\s+dia\s+)?(\d{1,2})\s+de\s+([a-zç]+)(?:\s+de\s+(\d{4}))?/g;
  while ((m = reAteE.exec(t))) { if (!_MES[m[2]]) continue; const c = win(m.index); if (_EXCLUI.test(c)) continue;
    const intent = _INSCR.test(c) ? 'inscrição' : _RECURSO.test(c) ? 'recurso' : _ENTREGA.test(c) ? 'entrega/requerimento' : null; if (!intent) continue;
    const ano = m[3] ? +m[3] : (dataAto ? +dataAto.slice(0, 4) : NaN); if (!ano) continue;
    push(_iso(ano, _MES[m[2]], +m[1]), intent, 'alta', 'data no texto', m.index);
  }
  // 4) relativo em DIAS "N dias ... a contar/partir da (publicação|assinatura|...)"
  const reDias = /(\d{1,3})\s*(?:\([^)]*\)\s*)?dias?\s+(?:úteis\s+)?(?:,?\s*)?(?:a\s+contar|contad[oa]s?|a\s+partir)\s+d[ae]\s+(?:sua\s+)?(public|assinatura|data|receb|notific|ciênc)/g;
  while ((m = reDias.exec(t))) { const c = win(m.index); if (_EXCLUI.test(c)) continue;
    if (dataAto) push(_addDias(dataAto, +m[1]), `prazo (${m[1]} dias)`, 'média', 'assinatura+N', m.index);
  }
  // 5) relativo MESES/ANOS "N (meses|anos) a contar/partir da (assinatura|...)"
  const reMes = /(\d{1,2})\s*(?:\([^)]*\)\s*)?(mês|meses|anos?)\s+(?:a\s+contar|a\s+partir)\s+d[ae]\s+(?:sua\s+)?(assinatura|data|public)/g;
  while ((m = reMes.exec(t))) { const c = win(m.index); if (_EXCLUI.test(c)) continue;
    const mult = /ano/.test(m[2]) ? 12 : 1; if (dataAto) push(_addMeses(dataAto, +m[1] * mult), `prazo (${m[1]} ${m[2]})`, 'média', 'assinatura+N', m.index);
  }
  return out;
}

function _montaPrazos(meta: { id: string; label: string; sigla: string; ementa: string; texto: string; dataAto: string | null; link: string | null; mexido: boolean; status: string }): Prazo[] {
  return extrairPrazos(meta.texto, meta.dataAto).map(p => ({
    atoId: meta.id, atoLabel: meta.label, sigla: meta.sigla, tipo: p.tipo,
    dataLimite: p.dataLimite, conf: p.conf, base: p.base, textoOrigem: p.origem,
    linkBoletim: meta.link, dataAto: meta.dataAto, mexidoDepois: meta.mexido, status: meta.status,
    ementa: meta.ementa, publico: inferirPublico(meta.ementa, p.ctx),
  }));
}

export async function getPrazos(): Promise<Prazo[]> {
  let prazos: Prazo[] = [];
  if (MODO === 'api') {
    // v2: a API já entrega os prazos EXTRAÍDOS (tabela `prazo`), no formato Prazo —
    // sem extração no cliente, sem baixar texto cru, sem ponto cego de janela.
    const r = await fetch(`${API_BASE}/prazos`);
    const j = await r.json();
    prazos = (j.prazos as Prazo[]) || [];
  } else {
    for (const a of CACHE as any[]) {
      const mexido = (a.referenciadoPor || []).some((x: any) => x.relacao === 'Altera' || x.relacao === 'Revoga');
      prazos.push(..._montaPrazos({
        id: a.id, label: `${a.tipoAto} nº ${a.numero}/${a.ano}`, sigla: a.orgaoEmissor || '', ementa: a.ementa || '',
        texto: `${a.ementa || ''} . ${a.conteudoResumido || ''} . ${a.textoBusca || ''}`,
        dataAto: a.dataAssinatura || null, link: a.linkBoletim || null, mexido, status: a.status || 'Ativo',
      }));
    }
  }
  prazos.sort((a, b) => a.dataLimite < b.dataLimite ? -1 : a.dataLimite > b.dataLimite ? 1 : 0);
  return prazos;
}

export async function getFiltros(): Promise<{ tipos: string[]; orgaos: string[]; anos: number[] }> {
  if (MODO === 'api') return (await fetch(`${API_BASE}/filtros`)).json();
  const tipos = new Set<string>(); const orgaos = new Set<string>(); const anos = new Set<number>();
  for (const a of CACHE) { tipos.add(a.tipoAto); if (a.orgaoEmissor) orgaos.add(a.orgaoEmissor); if (a.ano) anos.add(a.ano); }
  return { tipos: [...tipos].sort(), orgaos: [...orgaos].sort(), anos: [...anos].sort((x, y) => y - x) };
}
