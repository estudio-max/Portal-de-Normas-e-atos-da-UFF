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

// ---------- modo ESTÁTICO (mesma lógica do mock/PHP, em TS) ----------------
function filtraEstatico(p: ListaParams): UffAct[] {
  const busca = (p.busca || '').toLowerCase().trim();
  const nome = (p.nome || '').toLowerCase().trim();
  const siape = (p.siape || '').replace(/\D/g, '');
  return CACHE.filter(a => {
    if (busca) {
      const blob = `${a.numero} ${(a as any).identificador || ''} ${a.ementa} ${a.processoSei || ''} ${a.conteudoResumido || ''}`.toLowerCase();
      if (!blob.includes(busca)) return false;
    }
    if (p.tipo && p.tipo !== 'todos' && a.tipoAto !== p.tipo) return false;
    if (p.orgao && p.orgao !== 'todos' && a.orgaoEmissor !== p.orgao) return false;
    if (p.ano && p.ano !== 'todos' && String(a.ano) !== String(p.ano)) return false;
    if (p.status && p.status !== 'todos' && a.status !== p.status) return false;
    if (nome) {
      const ok = (a.textoBusca || '').includes(nome) || a.ementa.toLowerCase().includes(nome)
        || (a.orgaoEmissor || '').toLowerCase().includes(nome);
      if (!ok) return false;
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
  return { total: CACHE.length, vigentes: c.Ativo || 0, revogados: c.Revogado || 0, alterados: c.Alterado || 0, orgaos: orgs.size, comSei: sei, boletins: bols.size };
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
  const chefias: Chefia[] = Object.values(porPos)
    .filter(e => e.acao === 'designar')
    .map(e => ({
      cargo: e.cargo, unidade: e.unidade, nome: e.nome || null, siape: e.siape || null,
      desde: e.data, atoId: e.atoId, atoLabel: e.atoLabel, linkBoletim: e.link,
    }))
    .sort((a, b) => a.unidade.localeCompare(b.unidade) || a.cargo.localeCompare(b.cargo));
  return { total: chefias.length, atualizadoEm: new Date().toISOString().slice(0, 10), chefias };
}

export async function getFiltros(): Promise<{ tipos: string[]; orgaos: string[]; anos: number[] }> {
  if (MODO === 'api') return (await fetch(`${API_BASE}/filtros`)).json();
  const tipos = new Set<string>(); const orgaos = new Set<string>(); const anos = new Set<number>();
  for (const a of CACHE) { tipos.add(a.tipoAto); if (a.orgaoEmissor) orgaos.add(a.orgaoEmissor); if (a.ano) anos.add(a.ano); }
  return { tipos: [...tipos].sort(), orgaos: [...orgaos].sort(), anos: [...anos].sort((x, y) => y - x) };
}
