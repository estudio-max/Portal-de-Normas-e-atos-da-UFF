import React, { useEffect, useMemo, useState } from 'react';
import { GraduationCap, Loader2, Info, Clock, Globe2, FileText, CheckCircle2,
  XCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import * as ds from '../../dataSource';
import { RecordCard, RecordCardList, DesktopTable } from '../ui/RecordCard';
import { MapaMundi, LegendaTamanho, type PontoMapa } from '../ui/MapaMundi';

// ---------------------------------------------------------------------------
// Revalidação de diploma obtido no exterior.
//
// AGREGADO, sempre. Nenhuma tela aqui identifica quem pediu — e não é filtro de
// exibição: `ato_revalidacao` não tem coluna de pessoa. São pessoas privadas,
// não servidores; um indeferimento enterrado num PDF de 177 páginas é diferente
// de uma lista navegável de negados. O ato individual segue na busca normal.
//
// A quem serve: a) quem pensa em pedir revalidação na UFF e quer saber onde a
// fila anda e o que costuma ser deferido; b) auditoria — o eixo de prazos e a
// publicidade dos atos são justamente o que CGU/TCU cobram (Res. CNE/CES
// 1/2022), e o BS é a fonte primária deles.
// ---------------------------------------------------------------------------

const VIAS = ['Graduação', 'Pós-graduação'] as const;
type Via = typeof VIAS[number];

const pct = (parte: number, todo: number) => Math.round((parte / Math.max(1, todo)) * 100);

/** Taxa só quando a amostra sustenta. Abaixo do mínimo devolve null e a tela
 *  mostra a contagem — 1 indeferimento não pode virar "0% de aprovação" e
 *  afastar quem talvez devesse pedir. O limiar vem da API. */
function taxa(deferidos: number, total: number, minimo: number): number | null {
  return total >= minimo ? pct(deferidos, total) : null;
}

/** Barra deferido/indeferido: UMA cor + trilho neutro, nunca duas cores que o
 *  leitor precise distinguir. O número escrito ao lado carrega o dado; a barra
 *  só dá a proporção de relance. */
function Barra({ deferidos, total }: { deferidos: number; total: number }) {
  const p = pct(deferidos, total);
  return (
    <span className="inline-flex items-center gap-2 w-full">
      <span className="relative h-2 flex-1 min-w-[48px] rounded-full bg-slate-200" aria-hidden="true">
        <span className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${p}%`, background: 'var(--chart-mark)' }} />
      </span>
      <span className="shrink-0 tabular-nums text-[12px] text-slate-600">
        {deferidos}/{total}
      </span>
    </span>
  );
}

/** Tabela textual equivalente ao gráfico — o gráfico é SVG e não é lido por
 *  leitor de tela. Mesmo padrão do TabelaDados do Dashboard. */
function TabelaEquivalente({ titulo, colunas, linhas }: {
  titulo: string; colunas: string[]; linhas: (string | number)[][];
}) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer py-1.5 text-[12px] text-slate-600 hover:underline">
        Ver {titulo} em tabela
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-slate-600">
              {colunas.map(c => <th key={c} className="py-1 pr-3 font-semibold">{c}</th>)}
            </tr>
          </thead>
          <tbody className="tabular-nums text-slate-700">
            {linhas.map((l, i) => (
              <tr key={i} className="border-t border-slate-200">
                {l.map((v, j) => <td key={j} className="py-1 pr-3">{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Colunas verticais. Sem biblioteca: são poucas séries e o desenho precisa
 *  obedecer aos tokens de tema (a skin de fotofobia converte por LISTA de
 *  classes conhecidas, então cor solta some no escuro). */
function Colunas({ dados, rotulo }: {
  dados: { chave: string; total: number; deferidos: number }[];
  rotulo: string;
}) {
  const max = Math.max(1, ...dados.map(d => d.total));
  if (!dados.length) return null;
  // DENSO = mais categorias do que cabe rotular uma a uma. Com 20 anos numa
  // faixa de 230px sobram 11px por coluna: o numero em cima de cada barra nao
  // cabe, e ele nao encolhe -- era ele que empurrava a pagina para o lado.
  // Numero em TODO ponto ja e ruim num grafico largo; num estreito e ilegivel.
  // Fica so o maior, que e o que a barra sozinha nao diz. Os valores exatos
  // continuam inteiros na tabela do <details> e no rotulo lido em voz alta.
  const denso = dados.length > 10;
  return (
    <div>
      <div className={`flex items-end h-28 ${denso ? 'gap-0.5 sm:gap-1.5' : 'gap-1.5'}`} role="img"
        aria-label={`${rotulo}. ${dados.map(d => `${d.chave}: ${d.total}`).join('; ')}.`}>
        {dados.map(d => (
          <div key={d.chave} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
            {(!denso || d.total === max) && (
              <span className="text-[12px] tabular-nums text-slate-600">{d.total}</span>
            )}
            {/* `block` NAO E DECORACAO: <span> nasce inline, e elemento inline
                ignora largura e altura. Sem esta classe a barra existe no DOM,
                tem cor e tem `height` no style, e desenha exatamente nada --
                os dois graficos ficaram com um vazio branco no lugar das
                colunas, e nenhum teste viu porque o elemento estava la. */}
            <span className="block w-full rounded-t"
              style={{ height: `${(d.total / max) * 100}%`, minHeight: 3, background: 'var(--chart-fill)' }}>
              <span className="block w-full rounded-t"
                style={{ height: `${pct(d.deferidos, d.total)}%`, background: 'var(--chart-mark)' }} />
            </span>
          </div>
        ))}
      </div>
      {/* O eixo tem DUAS FORMAS. Um rotulo por coluna enquanto couber; na tela
          estreita, so as pontas. Vinte rotulos truncados em "2…" nao informam
          nada, e a faixa de pontas ao menos diz o periodo que o grafico cobre.
          As colunas ficam de pe nas duas: a forma e a leitura principal. */}
      <div className={`gap-1.5 mt-1 ${denso ? 'hidden sm:flex' : 'flex'}`}>
        {dados.map(d => (
          <span key={d.chave} className="flex-1 min-w-0 text-center text-[12px] text-slate-600 truncate"
            title={d.chave}>{d.chave}</span>
        ))}
      </div>
      {denso && (
        <div className="flex justify-between mt-1 text-[12px] text-slate-600 sm:hidden">
          <span>{dados[0].chave}</span>
          <span>{dados[dados.length - 1].chave}</span>
        </div>
      )}
    </div>
  );
}

/** Escala de eixo: devolve o teto arredondado e os cortes. Um eixo que termina
 *  exatamente no maior valor faz a maior barra encostar na borda e some com a
 *  folga onde o número é escrito. */
function escala(max: number, cortes = 4): { teto: number; ticks: number[] } {
  const bruto = max / cortes;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, bruto))));
  const passo = [1, 2, 2.5, 5, 10].map(m => m * mag).find(v => v >= bruto) ?? mag * 10;
  const teto = passo * cortes;
  return { teto, ticks: Array.from({ length: cortes + 1 }, (_, i) => i * passo) };
}

/** Rosca da taxa de deferimento.
 *  Uma fatia só sobre trilho neutro — não é pizza de várias categorias, é UM
 *  percentual contra o todo, que é a única leitura que a rosca faz bem. O
 *  número grande ao lado carrega o valor; a rosca dá a proporção de relance. */
function Rosca({ pctDeferido }: { pctDeferido: number }) {
  const r = 24, c = 2 * Math.PI * r;
  return (
    <svg width={60} height={60} viewBox="0 0 60 60" aria-hidden="true" className="shrink-0">
      <circle cx={30} cy={30} r={r} fill="none" stroke="var(--chart-grid)" strokeWidth={8} />
      <circle cx={30} cy={30} r={r} fill="none" stroke="var(--chart-mark)" strokeWidth={8}
        strokeDasharray={`${(pctDeferido / 100) * c} ${c}`} strokeLinecap="round"
        transform="rotate(-90 30 30)" />
    </svg>
  );
}

/** Barras HORIZONTAIS, com o rótulo à esquerda e o valor na ponta da barra.
 *
 *  Categoria com nome escrito ("mesmo ano", "3 anos") pede barra horizontal: o
 *  rótulo fica deitado, legível, sem truncar nem girar. Era coluna vertical e
 *  os oito rótulos disputavam 26px cada um. */
function BarrasHorizontais({ dados, rotulo }: {
  dados: { chave: string; total: number }[]; rotulo: string;
}) {
  const max = Math.max(1, ...dados.map(d => d.total));
  const { teto, ticks } = escala(max);
  return (
    <div>
      <div role="img" aria-label={`${rotulo}. ${dados.map(d => `${d.chave}: ${d.total}`).join('; ')}.`}
        className="space-y-1.5">
        {dados.map(d => (
          <div key={d.chave} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-right text-[12px] text-slate-600">{d.chave}</span>
            <span className="flex-1 min-w-0 flex items-center gap-1.5">
              <span className="block h-3.5 rounded-sm shrink-0"
                style={{ width: `${(d.total / teto) * 100}%`, minWidth: 2, background: 'var(--chart-mark)' }} />
              <span className="text-[12px] font-semibold tabular-nums text-slate-700">{d.total}</span>
            </span>
          </div>
        ))}
      </div>
      {/* Eixo. Recessivo por função: quem quer o valor exato lê o número na
          ponta da barra, que está logo ali. */}
      <div className="mt-1.5 flex items-center gap-2">
        <span className="w-16 shrink-0" />
        <span className="flex-1 min-w-0 flex justify-between border-t border-slate-200 pt-1">
          {ticks.map(v => (
            <span key={v} className="text-[11px] tabular-nums" style={{ color: 'var(--chart-axis)' }}>{v}</span>
          ))}
        </span>
      </div>
      <p className="mt-0.5 pl-[72px] text-[11px]" style={{ color: 'var(--chart-axis)' }}>Pedidos</p>
    </div>
  );
}

/** As ondas da série: trechos de anos seguidos acima da média, unindo os que
 *  estiverem separados por um único ano abaixo dela.
 *
 *  Existe porque a maquete marcava duas faixas de destaque na série, e eu não
 *  quis pintá-las à mão: faixa escrita à mão é decoração e envelhece com o
 *  dado — daqui a um ano ela estaria destacando o período errado, sem nada
 *  acusar. Assim ela é DERIVADA, e o rótulo diz quanto do total ela concentra,
 *  que é a informação capaz de justificar destacar alguma coisa. */
function ondas(serie: { ano: number; total: number }[]) {
  if (serie.length < 6) return [];
  const total = serie.reduce((a, x) => a + x.total, 0);
  const media = total / serie.length;
  const acima = serie.map(x => x.total > media);
  const trechos: number[][] = [];
  let atual: number[] = [];
  for (let i = 0; i < serie.length; i++) {
    if (acima[i]) { atual.push(i); continue; }
    // um único ano abaixo da média não corta a onda
    if (atual.length && acima[i + 1]) continue;
    if (atual.length) { trechos.push(atual); atual = []; }
  }
  if (atual.length) trechos.push(atual);
  return trechos
    .map(t => {
      const de = t[0], ate = t[t.length - 1];
      const soma = serie.slice(de, ate + 1).reduce((a, x) => a + x.total, 0);
      return { de, ate, soma, parte: Math.round((soma / total) * 100) };
    })
    .sort((a, b) => b.soma - a.soma)
    .slice(0, 2)
    .sort((a, b) => a.de - b.de);
}

/** Colunas verticais COM EIXO. Série temporal longa: o eixo Y dá a ordem de
 *  grandeza sem precisar de um número em cima de cada coluna, e o X mostra um
 *  ano sim, outro não, que é o que cabe. */
/** Colunas por ano COM A FATIA DEFERIDA dentro.
 *
 *  A coluna mostrava só o total, e foi por isso que ninguém viu: entre 2011 e
 *  2017 o painel publicou 614 decisões com ZERO deferimentos — sete anos
 *  seguidos de zero absoluto, entre 100% em 2006-2009 e 83% em 2025 — e a
 *  série parecia perfeitamente normal, porque só o volume estava desenhado.
 *  Era falha do extrator (dois padrões tinham a palavra "indeferimento"
 *  escrita dentro do regex, sem alternativa para o deferimento), mas o painel
 *  não dava como notar.
 *
 *  Com a fatia dentro da coluna, um trecho inteiro sem verde salta aos olhos
 *  de quem olha o gráfico — inclusive de quem mantém o portal. É a diferença
 *  entre um número errado que passa despercebido e um que se denuncia. */
function ColunasEixo({ serie, rotulo }: {
  serie: { ano: number; total: number; deferidos: number }[]; rotulo: string;
}) {
  const max = Math.max(1, ...serie.map(x => x.total));
  const { teto, ticks } = escala(max);
  const faixas = ondas(serie);
  const ALT = 150;
  return (
    <div>
      <div className="flex gap-1.5">
        <div className="relative shrink-0 w-7" style={{ height: ALT }}>
          {ticks.map(v => (
            <span key={v} className="absolute right-0 translate-y-1/2 text-[11px] tabular-nums"
              style={{ bottom: `${(v / teto) * 100}%`, color: 'var(--chart-axis)' }}>{v}</span>
          ))}
        </div>
        <div className="relative flex-1 min-w-0" style={{ height: ALT }}>
          {ticks.map(v => (
            <span key={v} className="absolute left-0 right-0 border-t" aria-hidden="true"
              style={{ bottom: `${(v / teto) * 100}%`, borderColor: 'var(--chart-grid)' }} />
          ))}
          {faixas.map(f => (
            <span key={f.de} className="absolute inset-y-0 rounded-sm" aria-hidden="true"
              style={{
                left: `${(f.de / serie.length) * 100}%`,
                width: `${((f.ate - f.de + 1) / serie.length) * 100}%`,
                background: 'var(--serie-azul-fraco)',
              }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-0.5" role="img"
            aria-label={`${rotulo}. ${serie.map(x => `${x.ano}: ${x.total}, ${x.deferidos} deferidos`).join('; ')}.`}>
            {serie.map(x => (
              <span key={x.ano} className="relative block flex-1 min-w-0 rounded-t"
                style={{ height: `${(x.total / teto) * 100}%`, minHeight: 2, background: 'var(--serie-azul)' }}>
                {/* A fatia deferida cresce do pé da coluna, que é de onde se
                    lê uma parte do todo. Verde porque nesta aba verde
                    significa deferimento, e só isso. */}
                <span className="absolute bottom-0 left-0 right-0 rounded-t" aria-hidden="true"
                  style={{ height: `${(x.deferidos / Math.max(1, x.total)) * 100}%`, background: 'var(--chart-mark)' }} />
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* EIXO X EM DUAS FORMAS. Um ano sim, outro não enquanto couber; só as
          pontas na tela estreita. Vinte rótulos em 196px dão 9,8px por fatia e
          "02" mede 12 — os rótulos se encavalavam e empurravam o cartão. */}
      <div className="mt-1 hidden sm:flex gap-1.5">
        <span className="w-7 shrink-0" />
        <div className="flex-1 min-w-0 flex gap-0.5">
          {serie.map((x, i) => (
            <span key={x.ano} className="flex-1 min-w-0 text-center text-[11px] tabular-nums"
              style={{ color: 'var(--chart-axis)' }}>
              {i % 2 === 0 || i === serie.length - 1 ? String(x.ano).slice(2) : ''}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-1 flex gap-1.5 sm:hidden">
        <span className="w-7 shrink-0" />
        <div className="flex-1 min-w-0 flex justify-between text-[12px] tabular-nums"
          style={{ color: 'var(--chart-axis)' }}>
          <span>{serie[0].ano}</span>
          <span>{serie[serie.length - 1].ano}</span>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm" aria-hidden="true"
            style={{ background: 'var(--serie-azul)' }} />
          decididos
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-sm" aria-hidden="true"
            style={{ background: 'var(--chart-mark)' }} />
          deferidos
        </span>
      </p>
      {faixas.length > 0 && (
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-600">
          {faixas.map(f => (
            <span key={f.de} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-sm" aria-hidden="true"
                style={{ background: 'var(--serie-azul-fraco)', border: '1px solid var(--chart-grid)' }} />
              {serie[f.de].ano}–{serie[f.ate].ano}: <strong className="tabular-nums">{f.parte}%</strong> das decisões
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/** BANDEIRAS SIMPLIFICADAS.
 *
 *  Emoji de bandeira não tem glifo no Windows — sairia "BO", "CU", "PE" no
 *  lugar do desenho, e é justamente o sistema desta máquina. Então são
 *  desenhadas aqui.
 *
 *  São as bandeiras CIVIS, só as faixas: sem brasão, sem sol, sem estrela.
 *  Reproduzir um brasão de memória é como o portal de uma universidade federal
 *  acaba publicando o símbolo errado de um país. Faixa de cor eu sei conferir;
 *  brasão, não. País fora desta tabela não ganha desenho nenhum — melhor sem
 *  bandeira do que com a bandeira de outro. */
type Bandeira = {
  cores: string[];
  vertical?: boolean;
  pesos?: number[];
  /** Elemento sobre as faixas, para as bandeiras que não são só faixas. */
  extra?: 'cantaoEstrela' | 'trianguloEstrela' | 'cruzNordica' | 'cruzCentral' | 'uniao';
  extraCor?: string;
};

/** BANDEIRAS DESENHADAS, e não emoji.
 *
 *  Emoji de bandeira não tem glifo no Windows — sairia "BO", "CU", "PE" no
 *  lugar do desenho, e é o sistema da máquina de quem mantém o portal.
 *
 *  São as bandeiras CIVIS, sem os elementos que eu não sei reproduzir de
 *  memória com segurança: brasão, sol, folha, águia, roda. Reproduzir um
 *  brasão de cabeça é como o portal de uma universidade federal acaba
 *  publicando o símbolo errado de um país. Faixa, cruz, cantão e estrela eu
 *  sei conferir; brasão, não.
 *
 *  A cauda é longa — 51 países no acervo — e não vai fechar. Quem não está
 *  aqui recebe uma MARCA NEUTRA, não um buraco: espaço vazio na coluna se lê
 *  como ícone que falhou em carregar, e manda o visitante procurar defeito
 *  onde há decisão. */
const BANDEIRAS: Record<string, Bandeira> = {
  'Bolívia': { cores: ['#D52B1E', '#F9E300', '#007934'] },
  'Peru': { cores: ['#D91023', '#FFFFFF', '#D91023'], vertical: true },
  'Colômbia': { cores: ['#FCD116', '#003893', '#CE1126'], pesos: [2, 1, 1] },
  'Equador': { cores: ['#FFDD00', '#0072CE', '#EF3340'], pesos: [2, 1, 1] },
  'Argentina': { cores: ['#74ACDF', '#FFFFFF', '#74ACDF'] },
  'Paraguai': { cores: ['#D52B1E', '#FFFFFF', '#0038A8'] },
  'Venezuela': { cores: ['#FFCC00', '#00247D', '#CF142B'] },
  'Portugal': { cores: ['#006600', '#FF0000'], vertical: true, pesos: [2, 3] },
  'Espanha': { cores: ['#AA151B', '#F1BF00', '#AA151B'], pesos: [1, 2, 1] },
  'México': { cores: ['#006847', '#FFFFFF', '#CE1126'], vertical: true },
  'Itália': { cores: ['#008C45', '#FFFFFF', '#CD212A'], vertical: true },
  'França': { cores: ['#002395', '#FFFFFF', '#ED2939'], vertical: true },
  'Alemanha': { cores: ['#000000', '#DD0000', '#FFCE00'] },
  'Bélgica': { cores: ['#000000', '#FAE042', '#ED2939'], vertical: true },
  'Irlanda': { cores: ['#169B62', '#FFFFFF', '#FF883E'], vertical: true },
  'Romênia': { cores: ['#002B7F', '#FCD116', '#CE1126'], vertical: true },
  'Nigéria': { cores: ['#008751', '#FFFFFF', '#008751'], vertical: true },
  'Rússia': { cores: ['#FFFFFF', '#0039A6', '#D52B1E'] },
  'Países Baixos': { cores: ['#AE1C28', '#FFFFFF', '#21468B'] },
  'Holanda': { cores: ['#AE1C28', '#FFFFFF', '#21468B'] },
  'Áustria': { cores: ['#ED2939', '#FFFFFF', '#ED2939'] },
  'Polônia': { cores: ['#FFFFFF', '#DC143C'] },
  'Indonésia': { cores: ['#CE1126', '#FFFFFF'] },
  'Ucrânia': { cores: ['#0057B7', '#FFD700'] },
  'Bulgária': { cores: ['#FFFFFF', '#00966E', '#D62612'] },
  'Iêmen': { cores: ['#CE1126', '#FFFFFF', '#000000'] },
  'Haiti': { cores: ['#00209F', '#D21034'] },
  // Faixas corretas; sem a águia (Egito) e sem as estrelas (Síria), pela mesma
  // regra que deixa de fora os brasões.
  'Egito': { cores: ['#CE1126', '#FFFFFF', '#000000'] },
  'Síria': { cores: ['#CE1126', '#FFFFFF', '#000000'] },
  // Cinco faixas e o triângulo vermelho com a estrela branca no mastro.
  'Cuba': {
    cores: ['#002A8F', '#FFFFFF', '#002A8F', '#FFFFFF', '#002A8F'],
    extra: 'trianguloEstrela', extraCor: '#CF142B',
  },
  'Porto Rico': {
    cores: ['#EF3340', '#FFFFFF', '#EF3340', '#FFFFFF', '#EF3340'],
    extra: 'trianguloEstrela', extraCor: '#0050F0',
  },
  // Treze faixas e o cantão azul. As cinquenta estrelas ficam de fora: em
  // 20x14 elas não seriam desenho, seriam sujeira — e omitir segue a mesma
  // regra dos brasões.
  'Estados Unidos': {
    cores: ['#B31942', '#FFFFFF', '#B31942', '#FFFFFF', '#B31942', '#FFFFFF',
            '#B31942', '#FFFFFF', '#B31942', '#FFFFFF', '#B31942', '#FFFFFF', '#B31942'],
    extra: 'cantaoEstrela', extraCor: '#0A3161',
  },
  'Chile': { cores: ['#FFFFFF', '#D52B1E'], extra: 'cantaoEstrela', extraCor: '#0039A6' },
  'Reino Unido': { cores: ['#012169'], extra: 'uniao' },
  'Suécia': { cores: ['#006AA7'], extra: 'cruzNordica', extraCor: '#FECC00' },
  'Finlândia': { cores: ['#FFFFFF'], extra: 'cruzNordica', extraCor: '#003580' },
  'Noruega': { cores: ['#BA0C2F'], extra: 'cruzNordica', extraCor: '#FFFFFF' },
  'Dinamarca': { cores: ['#C8102E'], extra: 'cruzNordica', extraCor: '#FFFFFF' },
  'Suíça': { cores: ['#D52B1E'], extra: 'cruzCentral', extraCor: '#FFFFFF' },
};

/** Estrela de cinco pontas, em torno de (cx, cy). */
function estrela(cx: number, cy: number, r: number) {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const raio = i % 2 === 0 ? r : r * 0.382;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    p.push(`${(cx + raio * Math.cos(a)).toFixed(2)},${(cy + raio * Math.sin(a)).toFixed(2)}`);
  }
  return p.join(' ');
}

function Bandeira({ pais }: { pais: string }) {
  const b = BANDEIRAS[pais];
  // MARCA NEUTRA para quem não está na tabela — ver o comentário de BANDEIRAS.
  if (!b) {
    return (
      <svg width={20} height={14} viewBox="0 0 20 14" className="shrink-0" aria-hidden="true">
        <rect x={0.5} y={0.5} width={19} height={13} rx={1.5} fill="none"
          stroke="var(--chart-grid)" strokeWidth={1} strokeDasharray="2 2" />
      </svg>
    );
  }
  const pesos = b.pesos ?? b.cores.map(() => 1);
  const soma = pesos.reduce((a, x) => a + x, 0);
  const eixo = b.vertical ? 20 : 14;
  let acc = 0;
  return (
    <svg width={20} height={14} viewBox="0 0 20 14" className="shrink-0 rounded-[2px]"
      role="img" aria-label={`Bandeira do país: ${pais}`}>
      {b.cores.map((c, i) => {
        const pos = (acc / soma) * eixo;
        const tam = (pesos[i] / soma) * eixo;
        acc += pesos[i];
        return b.vertical
          ? <rect key={i} x={pos} y={0} width={tam} height={14} fill={c} />
          : <rect key={i} x={0} y={pos} width={20} height={tam} fill={c} />;
      })}
      {b.extra === 'trianguloEstrela' && (
        <>
          <polygon points="0,0 8,7 0,14" fill={b.extraCor} />
          <polygon points={estrela(2.9, 7, 2.4)} fill="#FFFFFF" />
        </>
      )}
      {b.extra === 'cantaoEstrela' && (
        <>
          <rect x={0} y={0} width={8} height={7} fill={b.extraCor} />
          {pais === 'Chile' && <polygon points={estrela(4, 3.5, 2.2)} fill="#FFFFFF" />}
        </>
      )}
      {b.extra === 'cruzNordica' && (
        <>
          <rect x={0} y={5.6} width={20} height={2.8} fill={b.extraCor} />
          <rect x={6} y={0} width={2.8} height={14} fill={b.extraCor} />
        </>
      )}
      {b.extra === 'cruzCentral' && (
        <>
          <rect x={8.4} y={3} width={3.2} height={8} fill={b.extraCor} />
          <rect x={6} y={5.4} width={8} height={3.2} fill={b.extraCor} />
        </>
      )}
      {b.extra === 'uniao' && (
        <>
          <path d="M0,0 L20,14 M20,0 L0,14" stroke="#FFFFFF" strokeWidth={3} />
          <path d="M0,0 L20,14 M20,0 L0,14" stroke="#C8102E" strokeWidth={1.4} />
          <rect x={0} y={4.5} width={20} height={5} fill="#FFFFFF" />
          <rect x={7.5} y={0} width={5} height={14} fill="#FFFFFF" />
          <rect x={0} y={5.6} width={20} height={2.8} fill="#C8102E" />
          <rect x={8.6} y={0} width={2.8} height={14} fill="#C8102E" />
        </>
      )}
      <rect x={0.25} y={0.25} width={19.5} height={13.5} fill="none"
        stroke="#00000022" strokeWidth={0.5} rx={1} />
    </svg>
  );
}


export default function RevalidacaoApi() {
  const [dados, setDados] = useState<ds.RevalResp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [via, setVia] = useState<Via>('Graduação');
  // País destacado no mapa. Mora aqui, e não dentro do mapa, porque a
  // seleção também grifa a linha na lista — o mapa mostra ONDE, a lista diz
  // QUANTO, e clicar num lugar tem de acender os dois.
  const [paisSel, setPaisSel] = useState('');
  // Qual recorte da lista de origem esta visivel. 'paises' primeiro porque
  // e o que o mapa acima acabou de mostrar.
  const [recorte, setRecorte] = useState<'paises' | 'cursos' | 'instituicoes'>('paises');

  useEffect(() => {
    let vivo = true;
    ds.getRevalidacao().then(r => { if (vivo) { setDados(r); setCarregando(false); } });
    return () => { vivo = false; };
  }, []);

  const daVia = useMemo(() => {
    if (!dados) return null;
    const filtra = <T extends { via: string }>(xs: T[]) => xs.filter(x => x.via === via);
    return {
      resumo: dados.resumo.find(r => r.via === via) || { via, total: 0, deferidos: 0 },
      serie: filtra(dados.serie),
      niveis: filtra(dados.niveis),
      tramitacao: filtra(dados.tramitacao),
      paises: filtra(dados.paises),
      cursos: filtra(dados.cursos),
      instituicoes: filtra(dados.instituicoes),
    };
  }, [dados, via]);

  if (carregando) {
    return (
      <div className="flex items-center gap-2 p-6 text-slate-600">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        <span className="text-[13px]">Carregando revalidações…</span>
      </div>
    );
  }

  if (!dados || !daVia || !dados.resumo.length) {
    return (
      <div className="p-6">
        <p className="text-[13px] text-slate-700">
          Ainda não há revalidações no acervo.
        </p>
        <p className="mt-2 text-[13px] text-slate-600">
          Os dados aparecem depois que a extração reprocessar os boletins e a
          importação rodar. Se o portal estiver no modo de contingência, esta
          aba fica indisponível — ela depende do banco.
        </p>
      </div>
    );
  }

  const { resumo, serie, niveis, tramitacao, paises, cursos, instituicoes } = daVia;
  const min = dados.minimoParaTaxa;
  const t = taxa(resumo.deferidos, resumo.total, min);
  const noPrazo = tramitacao.find(x => x.anos === 0);

  // Quem tem coordenada vai ao mapa; quem não tem é CONTADO e declarado ao pé
  // dele. O balão traz total e deferidos porque a bolha só carrega um sinal
  // (grandeza) — o segundo número tem de vir escrito.
  const noMapa: PontoMapa[] = paises
    .filter(p => typeof p.lat === 'number' && typeof p.lon === 'number')
    .map(p => ({
      pais: p.pais, valor: p.total, lat: p.lat as number, lon: p.lon as number,
      detalhe: `${p.pais} — ${p.total} pedido(s), ${p.deferidos} deferido(s)`,
    }));
  const foraDoMapa = paises.filter(p => typeof p.lat !== 'number' || typeof p.lon !== 'number');

  // Os seis maiores, que e o que cabe ao lado do mapa sem virar rolagem.
  const topoPaises = [...noMapa].sort((a, b) => b.valor - a.valor).slice(0, 6);

  // O que o cartao sobre o mapa mostra: o pais escolhido, ou o maior enquanto
  // ninguem escolheu. Comeca cheio de proposito -- cartao vazio esperando
  // clique nao ensina que da para clicar.
  const destacado = noMapa.find(x => x.pais === paisSel) ?? topoPaises[0];

  const RECORTES = [
    {
      chave: 'paises' as const, titulo: 'Países de origem', coluna: 'País',
      itens: paises.map(x => ({ chave: x.pais, total: x.total, deferidos: x.deferidos })),
    },
    {
      chave: 'cursos' as const, titulo: 'Cursos', coluna: 'Curso',
      itens: cursos.map(x => ({ chave: x.curso, total: x.total, deferidos: x.deferidos })),
    },
    {
      chave: 'instituicoes' as const, titulo: 'Instituições de origem', coluna: 'Instituição',
      itens: instituicoes.map(x => ({ chave: x.instituicao, total: x.total, deferidos: x.deferidos })),
    },
  ];
  const RECORTE_ATIVO = RECORTES.find(r => r.chave === recorte) ?? RECORTES[0];

  return (
    <div className="p-3 md:p-4 space-y-4">
      {/* CABEÇALHO EM FAIXA, com o selo de privacidade ao lado do título.
          O selo estava só na prosa ("Só números agregados"), onde some na
          leitura rápida. Esta aba trata de pedidos individuais de pessoas que
          NÃO são servidoras — quem chega tem de ver, antes de qualquer número,
          que nada aqui identifica ninguém. */}
      <header className="rounded-lg bg-[#003366] p-4 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10"
              aria-hidden="true">
              <GraduationCap className="h-6 w-6 text-yellow-400" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold">Revalidação de diplomas do exterior</h2>
              <p className="mt-0.5 text-[13px] leading-relaxed text-blue-100">
                O que a UFF decidiu sobre pedidos de revalidação e reconhecimento de
                diplomas obtidos fora do Brasil, a partir dos atos publicados no
                Boletim de Serviço.
              </p>
            </div>
          </div>
          <p className="sm:shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-blue-50">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            Dados agregados · sem identificação de pessoas
          </p>
        </div>
      </header>

      {/* Aviso de consolidação.
          Fica no topo, e não em rodapé, porque o risco que ele cobre é alguém
          citar esses números como total — inclusive em resposta a órgão de
          controle — e eles mudarem depois. Os números aqui são um PISO
          verificado. Sai quando a etapa 8 do plano de reprocessamento fechar. */}
      <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] leading-relaxed text-amber-700">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
        {/* ⚠️ CONTAGEM E TAXA NÃO TÊM A MESMA GARANTIA, e o aviso dizia que
            sim. "Mínimo verificado" vale para uma CONTAGEM, que só pode
            crescer quando o acervo terminar de ser processado. Uma
            PORCENTAGEM não é mínimo de nada: calculada sobre um subconjunto
            enviesado, ela se move para qualquer lado. Em 17/08/2026
            descobriu-se que era exatamente o caso — dois padrões do extrator
            enxergavam o indeferimento e eram cegos ao deferimento escrito do
            mesmo jeito, e a taxa saiu falsa. Escrever "mínimo verificado" ao
            lado de um percentual foi meu erro; ele emprestava ao número uma
            garantia que a contagem tem e ele não. */}
        <span>
          <strong>Série em consolidação.</strong> As <strong>contagens</strong> representam
          os atos já processados, e não o total histórico — o acervo mais antigo ainda
          está sendo incorporado, então trate-as como <strong>mínimo verificado</strong>.
          Já as <strong>taxas de deferimento</strong> não são mínimo de coisa alguma:
          são proporções sobre o que foi lido até aqui, e podem subir ou descer
          conforme o acervo fecha. Para citar em relatório ou resposta oficial, use as
          contagens e confira a taxa no ato.
        </span>
      </p>

      {/* Os dois processos são distintos (normas, colegiados e prazos
          diferentes), então a troca é explícita e nunca somada. */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Escolher o tipo de revalidação">
        {VIAS.map(v => {
          const r = dados.resumo.find(x => x.via === v);
          const ativo = v === via;
          return (
            <button key={v} type="button" onClick={() => setVia(v)} aria-pressed={ativo}
              className={`rounded-lg border px-3 py-2 text-[13px] font-semibold transition
                ${ativo
                  ? 'border-[#003366] bg-[#003366] text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}>
              {v}
              <span className={`ml-2 font-normal tabular-nums ${ativo ? 'text-blue-100' : 'text-slate-600'}`}>
                {r ? r.total : 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* INDICADORES EM CARTÕES, COM COR POR FUNÇÃO.
          Eram quatro cartões brancos com número escuro — a mesma aparência para
          "quantos pediram", "quantos passaram" e "quantos não passaram". O
          leitor tinha de ler os três rótulos para saber qual era qual.

          O VERMELHO NO INDEFERIDO foi decisão do mantenedor, tomada depois de
          eu levantar a objeção de que vermelho, neste portal, significa ato
          revogado. Fica registrado o cuidado que ele exige: a cor NUNCA carrega
          sozinha o sentido — cada cartão traz ícone próprio (documento, visto,
          xis) e rótulo escrito. Verde e vermelho são indistinguíveis sob
          protanopia (ΔE 3,4 medido), então quem não separa as duas cores lê
          exatamente a mesma informação pelo ícone e pela palavra. */}
      <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            chave: 'total', valor: String(resumo.total), rotulo: 'pedidos decididos',
            apoio: via, Icone: FileText,
            cartao: 'border-slate-200 bg-white', numero: 'text-[#003366]',
            bolha: 'bg-blue-50 text-[#003366]',
          },
          {
            chave: 'def', valor: String(resumo.deferidos), rotulo: 'deferidos',
            apoio: 'pedido atendido', Icone: CheckCircle2,
            cartao: 'border-emerald-200 bg-emerald-50', numero: 'text-emerald-700',
            bolha: 'bg-emerald-100 text-emerald-700',
          },
          {
            chave: 'ind', valor: String(resumo.total - resumo.deferidos), rotulo: 'indeferidos',
            apoio: 'pedido não atendido', Icone: XCircle,
            cartao: 'border-red-200 bg-red-50', numero: 'text-red-700',
            bolha: 'bg-red-100 text-red-700',
          },
        ].map(c => (
          <div key={c.chave} className={`flex items-start justify-between gap-2 rounded-lg border p-3 ${c.cartao}`}>
            <div className="min-w-0">
              <dd className={`text-2xl font-bold tabular-nums leading-tight ${c.numero}`}>{c.valor}</dd>
              <dt className="mt-0.5 text-[13px] font-semibold text-slate-700">{c.rotulo}</dt>
              <p className="text-[12px] leading-snug text-slate-500">{c.apoio}</p>
            </div>
            <span className={`hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${c.bolha}`}
              aria-hidden="true">
              <c.Icone className="h-5 w-5" />
            </span>
          </div>
        ))}

        {/* A TAXA GANHA ROSCA. O número sozinho ("21%") não diz contra o quê;
            a rosca mostra a fatia e o resto na mesma figura, e a legenda ao
            lado escreve os dois — cor nenhuma precisa ser interpretada. */}
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <div className="min-w-0">
            <dd className="text-2xl font-bold tabular-nums leading-tight text-slate-900">
              {t === null ? '—' : `${t}%`}
            </dd>
            <dt className="mt-0.5 text-[13px] font-semibold text-slate-700">taxa de deferimento</dt>
            <p className="text-[12px] leading-snug text-slate-500">
              {t === null ? `amostra menor que ${min}` : `de ${resumo.total} pedidos`}
            </p>
          </div>
          {t !== null && (
            <div className="ml-auto flex items-center gap-2">
              <Rosca pctDeferido={t} />
              <ul className="hidden xl:block text-[12px] leading-tight text-slate-600">
                <li className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" aria-hidden="true"
                    style={{ background: 'var(--chart-mark)' }} />
                  {t}% deferidos
                </li>
                <li className="mt-1 flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full" aria-hidden="true"
                    style={{ background: 'var(--chart-grid)' }} />
                  {100 - t}% indeferidos
                </li>
              </ul>
            </div>
          )}
        </div>
      </dl>

      {/* OS DOIS GRÁFICOS RESPONDEM PERGUNTAS DE FORMATO DIFERENTE, e por isso
          não têm mais a mesma forma nem a mesma cor.

          "Quanto tempo" é categoria com NOME ESCRITO — barra horizontal, que
          deixa o rótulo deitado e legível. "Decisões por ano" é série temporal
          — coluna vertical com eixo, que é como se lê o tempo. Antes os dois
          eram a mesma coluna verde sem eixo, e o leitor tinha de descobrir pela
          legenda que estava olhando coisas distintas. */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {tramitacao.length > 0 && (
          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
            <h3 className="flex items-center gap-2 text-[13px] font-bold text-slate-900">
              <Clock className="w-4 h-4 text-slate-600" aria-hidden="true" />
              Quanto tempo entre abrir o processo e decidir
            </h3>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <BarrasHorizontais rotulo={`Pedidos por tempo até a decisão, ${via}`}
                  dados={tramitacao.map(x => ({
                    chave: x.anos === 0 ? 'mesmo ano' : x.anos === 1 ? '1 ano' : `${x.anos} anos`,
                    total: x.total,
                  }))} />
              </div>
              {/* O NÚMERO QUE RESUME O GRÁFICO sai do parágrafo e vira cartão ao
                  lado dele, como na maquete: é a leitura que o gráfico entrega,
                  e ela estava em corpo de texto abaixo de tudo. */}
              {noPrazo && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 sm:w-40 sm:shrink-0">
                  <p className="text-2xl font-bold tabular-nums leading-tight text-emerald-700">
                    {pct(noPrazo.total, resumo.total)}%
                  </p>
                  <p className="text-[12px] leading-snug text-slate-700">
                    decididos no mesmo ano em que o processo foi aberto
                  </p>
                </div>
              )}
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed text-slate-600">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                <strong>Aproximação.</strong> O Boletim de Serviço publica a
                decisão, não a data em que o pedido foi protocolado. O que se
                mede aqui é a diferença entre o <strong>ano do processo</strong> e
                o ano da decisão — serve para ver a fila, não para aferir o prazo
                de 60 ou 180 dias da Resolução CNE/CES nº 1/2022.
              </span>
            </p>
            <TabelaEquivalente titulo="o tempo até a decisão"
              colunas={['Tempo', 'Pedidos', 'Deferidos']}
              linhas={tramitacao.map(x => [
                x.anos === 0 ? 'mesmo ano' : x.anos === 1 ? '1 ano' : `${x.anos} anos`,
                x.total, x.deferidos])} />
          </section>
        )}

        {serie.length > 0 && (
          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
            <h3 className="text-[13px] font-bold text-slate-900">Decisões por ano</h3>
            <div className="mt-3">
              <ColunasEixo rotulo={`Decisões por ano, ${via}`}
                serie={serie.map(x => ({ ano: x.ano, total: x.total, deferidos: x.deferidos }))} />
            </div>
            <TabelaEquivalente titulo="as decisões por ano"
              colunas={['Ano', 'Decididos', 'Deferidos']}
              linhas={serie.map(x => [x.ano, x.total, x.deferidos])} />
          </section>
        )}
      </div>

      {niveis.length > 1 && (
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-[13px] font-bold text-slate-900">Por nível do título</h3>
          <ul className="mt-2 space-y-2">
            {niveis.map(n => (
              <li key={n.nivel} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-[13px] text-slate-700">{n.nivel}</span>
                <Barra deferidos={n.deferidos} total={n.total} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* MAPA — a âncora visual da aba.
          O assunto é "diploma obtido FORA do Brasil", e até aqui isso era só
          uma coluna de nomes de país. O mapa responde de relance a pergunta que
          a lista responde só depois de lida: de onde vem o acervo.
          A bolha mede GRANDEZA (área ∝ pedidos), não taxa de deferimento —
          uma marca, um sinal. A taxa continua na lista logo abaixo, onde o
          número exato pode ser lido. */}
      {noMapa.length > 0 && (
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="flex items-center gap-2 text-[13px] font-bold text-slate-900">
            <Globe2 className="w-4 h-4 text-slate-600" aria-hidden="true" />
            De onde vêm os diplomas — {via}
          </h3>

          {/* MAPA E RANKING LADO A LADO DE VERDADE. O mapa ficava sozinho numa
              linha inteira com 400px de branco à direita, e o ranking descia
              para baixo dele. São a mesma pergunta: onde, e quanto. */}
          <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px_auto] lg:items-start">
            <div className="min-w-0">
              <div className="relative">
                <MapaMundi
                  pontos={noMapa}
                  selecionado={paisSel}
                  aoSelecionar={setPaisSel}
                  unidade="pedido"
                  cor="var(--serie-azul)"
                  corSelecionada="var(--chart-mark)"
                  rotulo={`Mapa-múndi com ${noMapa.length} países de origem dos diplomas, `
                    + `bolhas proporcionais ao número de pedidos de ${via.toLowerCase()}. `
                    + `A lista ao lado traz os mesmos números.`}
                />
                {/* O DESTAQUE VIRA CARTÃO SOBRE O MAPA. A bolha maior não diz
                    quanto vale; este cartão diz, e muda quando se escolhe outro
                    país — é o par que faz o clique valer a pena. */}
                {destacado && (
                  <div className="pointer-events-none absolute bottom-2 left-2 rounded-lg border border-slate-200 bg-[var(--sup-cartao)] px-3 py-2 shadow-sm">
                    <p className="text-xl font-bold tabular-nums leading-tight"
                      style={{ color: 'var(--chart-mark)' }}>{destacado.valor}</p>
                    <p className="text-[12px] leading-snug text-slate-600">
                      pedidos<br />
                      <strong className="text-slate-800">{destacado.pais}</strong>
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-end gap-4">
                <LegendaTamanho max={Math.max(...noMapa.map(p => p.valor))} unidade="pedido"
                  cor="var(--serie-azul)" />
                <p className="min-w-[200px] flex-1 text-[12px] leading-relaxed text-slate-600">
                  A área da bolha é proporcional ao número de pedidos. Clique num país
                  para destacá-lo — a bolha fica <strong style={{ color: 'var(--chart-mark)' }}>verde</strong> e
                  a linha acende na lista.
                </p>
              </div>
            </div>

            {/* O RANKING É LISTA, não tabela: cinco campos por linha não cabem
                em 300px, e lista funciona igual em qualquer largura. */}
            <ol className="min-w-0 space-y-1">
              {topoPaises.map((pt, i) => {
                const sel = paisSel === pt.pais;
                return (
                  <li key={pt.pais}>
                    <button type="button" onClick={() => setPaisSel(sel ? '' : pt.pais)}
                      aria-pressed={sel}
                      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition
                        ${sel ? 'border-[var(--destaque-borda)] bg-[var(--destaque-fundo)]'
                              : 'border-transparent hover:bg-slate-50'}`}>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#003366] text-[11px] font-bold tabular-nums text-white"
                        aria-hidden="true">{i + 1}</span>
                      <Bandeira pais={pt.pais} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-800">
                        {pt.pais}
                      </span>
                      <span className="h-2.5 w-16 shrink-0 rounded-full bg-slate-200" aria-hidden="true">
                        <span className="block h-full rounded-full"
                          style={{
                            width: `${Math.max(4, (pt.valor / topoPaises[0].valor) * 100)}%`,
                            background: sel ? 'var(--chart-mark)' : 'var(--serie-azul)',
                          }} />
                      </span>
                      <span className="w-10 shrink-0 text-right text-[13px] font-bold tabular-nums text-slate-800">
                        {pt.valor}
                      </span>
                    </button>
                  </li>
                );
              })}
              <li className="pt-1 text-[12px] text-slate-500">
                Os {topoPaises.length} maiores. Os {RECORTES[0].itens.length} países estão na lista abaixo.
              </li>
            </ol>

            {/* A LACUNA COMO CARTÃO, e não como frase no fim de um parágrafo.
                São pedidos que existem e não aparecem no mapa; escondê-los faria
                a soma dos círculos não fechar com o total do topo. */}
            {foraDoMapa.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 lg:w-44">
                <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
                <p className="mt-1 text-2xl font-bold tabular-nums text-amber-700">
                  {foraDoMapa.reduce((s, x) => s + x.total, 0)}
                </p>
                <p className="text-[12px] leading-snug text-amber-800">
                  pedidos sem país reconhecido ou sem coordenada no mapa. Continuam
                  contados no total e na lista completa.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* AS TRÊS LISTAS VIRAM ABAS.
          Empilhadas, somavam três tabelas longas e o visitante rolava por
          centenas de linhas até o rodapé. São a MESMA pergunta ("de onde vêm
          os pedidos") vista por três recortes, então cabem no mesmo lugar com
          um seletor — que é o que a maquete de 17/08/2026 propôs.

          `role="tablist"` de verdade, com `aria-selected` e painel ligado por
          `aria-controls`: um seletor que só muda a cor do botão deixa quem usa
          leitor de tela sem saber o que mudou na página. */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-2" role="tablist"
          aria-label="Recorte da lista de origem">
          {RECORTES.map(r => {
            const ativo = r.chave === recorte;
            return (
              <button key={r.chave} type="button" role="tab" id={`aba-${r.chave}`}
                aria-selected={ativo} aria-controls={`painel-${r.chave}`}
                onClick={() => setRecorte(r.chave)}
                className={`-mb-px border-b-2 px-3 py-2.5 text-[13px] font-semibold transition ${ativo
                  ? 'border-[#003366] text-[#003366]'
                  : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
                {r.titulo}
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${ativo
                  ? 'bg-[#003366] text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {r.itens.length}
                </span>
              </button>
            );
          })}
        </div>
        <div id={`painel-${recorte}`} role="tabpanel" aria-labelledby={`aba-${recorte}`}>
          <ListaAgrupada titulo={RECORTE_ATIVO.titulo} rotuloColuna={RECORTE_ATIVO.coluna}
            itens={RECORTE_ATIVO.itens} minimo={min}
            destaque={recorte === 'paises' ? paisSel : ''} />
        </div>
      </section>

      {/* RODAPÉ: UM CARTÃO SÓ, a procedência.
          A maquete trazia também um cartão "Achou um ato errado ou faltando?"
          com botão de enviar correção. Ele SAIU: o rodapé do próprio portal já
          faz esse convite em toda página, e ele aparece poucos pixels abaixo
          deste bloco. Duas chamadas iguais na mesma tela não convidam o dobro —
          leem-se como descuido, e é a mesma tela que pede confiança no dado.
          Quem projetou a maquete não via o rodapé global; o mantenedor viu. */}
      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[#003366]"
          aria-hidden="true">
          <Info className="h-4 w-4" />
        </span>
        <p className="text-[12px] leading-relaxed text-slate-600">
          <strong>Fonte:</strong> atos publicados no Boletim de Serviço da UFF. Cada pedido é
          decidido por um ato próprio, acessível pela busca do portal. Uma taxa de
          deferimento baixa costuma refletir a documentação apresentada em cada
          processo, e não a qualidade da instituição de origem — por isso a taxa
          só aparece a partir de {min} pedidos.
        </p>
      </div>
    </div>
  );
}

/** Lista país/curso/instituição: cartões no mobile, tabela no desktop — o par
 *  que a trava de regressão do redesign exige (test_redesign_integrity.mjs). */
function ListaAgrupada({ titulo, rotuloColuna, itens, minimo, destaque = '' }: {
  titulo: string; rotuloColuna: string; minimo: number; destaque?: string;
  itens: { chave: string; total: number; deferidos: number }[];
}) {
  const [tudo, setTudo] = useState(false);
  if (!itens.length) return null;
  // O destacado vem PRIMEIRO. Sem isso, clicar num país pequeno no mapa não
  // mostraria nada: a lista corta em 10 e ele ficaria escondido atrás do
  // "ver todos", que é o oposto do que o clique promete.
  const ordenados = destaque
    ? [...itens].sort((a, b) => Number(b.chave === destaque) - Number(a.chave === destaque))
    : itens;
  const mostrar = tudo ? ordenados : ordenados.slice(0, 10);

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <h3 className="px-3 pt-3 text-[13px] font-bold text-slate-900">{titulo}</h3>

      <RecordCardList className="p-3">
        {mostrar.map(i => {
          const t = taxa(i.deferidos, i.total, minimo);
          return (
            <RecordCard key={i.chave} titulo={i.chave}
              campos={[
                { rotulo: 'Pedidos', valor: String(i.total) },
                { rotulo: 'Deferidos', valor: String(i.deferidos) },
                { rotulo: 'Taxa', valor: t === null ? `amostra < ${minimo}` : `${t}%` },
              ]} />
          );
        })}
      </RecordCardList>

      <DesktopTable className="px-3 pb-3">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-slate-600">
              <th className="py-1.5 pr-3 font-semibold">{rotuloColuna}</th>
              <th className="py-1.5 pr-3 font-semibold text-right">Pedidos</th>
              <th className="py-1.5 pr-3 font-semibold text-right">Deferidos</th>
              <th className="py-1.5 font-semibold w-40">Proporção</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {mostrar.map(i => {
              const t = taxa(i.deferidos, i.total, minimo);
              return (
                <tr key={i.chave}
                  className={`border-t border-slate-200 ${i.chave === destaque ? 'bg-[var(--destaque-fundo)]' : ''}`}>
                  <td className="py-1.5 pr-3">
                    {i.chave === destaque && <span className="sr-only">Selecionado no mapa: </span>}
                    {i.chave}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{i.total}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {i.deferidos}
                    {t !== null && <span className="ml-1 text-slate-600">({t}%)</span>}
                    {t === null && <span className="ml-1 text-slate-600">(amostra &lt; {minimo})</span>}
                  </td>
                  <td className="py-1.5"><Barra deferidos={i.deferidos} total={i.total} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DesktopTable>

      {itens.length > 10 && (
        <div className="px-3 pb-3">
          <button type="button" onClick={() => setTudo(v => !v)} aria-expanded={tudo}
            className="rounded border border-slate-200 px-2 py-1 text-[12px] font-semibold text-slate-700 hover:border-slate-400">
            {tudo ? 'Mostrar só os 10 primeiros' : `Ver todos os ${itens.length}`}
          </button>
        </div>
      )}
    </section>
  );
}
