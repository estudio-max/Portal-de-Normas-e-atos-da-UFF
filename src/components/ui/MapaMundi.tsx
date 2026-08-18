import React from 'react';
import { TERRAS } from './mapaTerras';

// Mapa-múndi de símbolos proporcionais, sem biblioteca.
//
// POR QUE ELE MORA AQUI, e não dentro de um painel: desde 17/08/2026 duas abas
// plotam países — Cooperação (acordos) e Revalidação (pedidos de diploma). Duas
// cópias do mesmo mapa divergiriam em silêncio, e a que ficasse para trás
// mostraria um mundo diferente da outra na mesma tela do mesmo portal.
//
// Projeção equiretangular (x = lon, y = lat), a mais simples que permite plotar
// um ponto a partir de lat/lon sem dependência.
//
// A silhueta vem do Natural Earth 110m (ver `mapaTerras.ts`), simplificada.
// Até 17/08/2026 ela era desenhada à mão e o mundo saía irreconhecível — o
// mantenedor apontou, e estava certo: num portal institucional, mapa infiel
// corrói a confiança no resto da página.
//
// ⚠️ POR QUE BOLHA, E NÃO PAÍS PINTADO (coroplético): pintar exigiria a
// fronteira real de cada país — dezenas de KB de geometria no pacote que o
// visitante baixa — e, pior, faria a ÁREA do país virar sinal visual. A Bolívia
// com 461 pedidos e a Rússia com 3 ficariam com manchas de tamanho parecido,
// invertendo a leitura. Com bolha, o tamanho É o dado.
//
// ⚠️ A ÁREA da bolha é proporcional ao valor (raio ∝ √valor), não o raio. Raio
// proporcional exagera: dobrar o valor quadruplicaria a mancha, e o leitor lê
// área, não raio.

export interface PontoMapa {
  pais: string;
  valor: number;
  /** Rótulo do balão. Se ausente, mostra "país — valor". */
  detalhe?: string;
  lat: number;
  lon: number;
}

const W = 760, H = 380;
const px = (lon: number) => ((lon + 180) / 360) * W;
const py = (lat: number) => ((90 - lat) / 180) * H;

export interface MapaMundiProps {
  pontos: PontoMapa[];
  selecionado?: string;
  aoSelecionar?: (pais: string) => void;
  /** Cor da bolha. Uma só: o mapa mede GRANDEZA, e grandeza é uma matiz.
   *  Recebe TOKEN (`var(--chart-mark)`), não hex: o modo fotofobia converte a
   *  interface por lista de classes do Tailwind, que não alcança `fill` dentro
   *  de SVG — hex literal aqui vira verde-escuro sobre fundo escuro, sem erro
   *  nenhum no console. É a armadilha registrada no CLAUDE.md. */
  cor?: string;
  corSelecionada?: string;
  rotulo: string;
  /** Nome da coisa contada, no SINGULAR: "acordo", "pedido". Quem imprime
   *  flexiona — ver `conta()`. */
  unidade?: string;
}

/** "1 pedido", "468 pedidos". Só o `+s` porque as duas palavras que passam
 *  por aqui são regulares; se um dia entrar uma irregular, ela vira parâmetro
 *  e não exceção escondida dentro desta função. */
function conta(n: number, unidade: string) {
  if (!unidade) return String(n);
  return `${n} ${n === 1 ? unidade : unidade + 's'}`;
}

export function MapaMundi({
  pontos, selecionado = '', aoSelecionar, cor = 'var(--chart-mark)',
  corSelecionada = 'var(--chart-mark-2)', rotulo, unidade = '',
}: MapaMundiProps) {
  const max = Math.max(1, ...pontos.map(p => p.valor));
  const raio = (n: number) => 4 + Math.sqrt(n / max) * 16;
  const clicavel = typeof aoSelecionar === 'function';

  // Maior bolha por último: sem isso a Bolívia (461) cobriria os vizinhos
  // pequenos, e clicar neles ficaria impossível.
  const ordenados = [...pontos].sort((a, b) => b.valor - a.valor);

  /* O MAPA ESCALA, NAO ROLA. Com largura fixa de 760px ele ficava dentro de
   *  uma faixa rolavel: no celular apareciam 30% do desenho, e o visitante
   *  precisava arrastar de lado para descobrir que existia mundo fora do
   *  pedaco que via -- sem nada na tela dizendo isso. Com `viewBox` o mapa
   *  inteiro cabe sempre, menor. As bolhas encolhem junto e no celular ficam
   *  pequenas demais para acertar o toque; quem carrega o numero exato e o
   *  alvo de clique e o ranking ao lado, que e a divisao de trabalho que
   *  esta tela ja assume. Mapa inteiro pequeno informa mais que 30% grande.
   *  O teto de 760px preserva o tamanho de antes no desktop. */
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={rotulo}
        className="w-full h-auto max-w-[760px]">
        <rect x={0} y={0} width={W} height={H} fill="var(--mapa-oceano)" rx={6} />
        {[-120, -60, 0, 60, 120].map(l => (
          <line key={`v${l}`} x1={px(l)} y1={0} x2={px(l)} y2={H} stroke="var(--chart-grid)" strokeWidth={1} />
        ))}
        {[-60, -30, 0, 30, 60].map(l => (
          <line key={`h${l}`} x1={0} y1={py(l)} x2={W} y2={py(l)}
            stroke="var(--chart-grid)" strokeWidth={l === 0 ? 1.2 : 1} />
        ))}
        {TERRAS.map((poly, i) => (
          <polygon key={i} fill="var(--mapa-terra)" stroke="var(--mapa-borda)" strokeWidth={0.5}
            points={poly.map(([lon, lat]) => `${px(lon)},${py(lat)}`).join(' ')} />
        ))}
        {ordenados.map(p => {
          const ativo = !selecionado || selecionado === p.pais;
          const eSel = selecionado === p.pais;
          return (
            <g key={p.pais}
              onClick={clicavel ? () => aoSelecionar!(eSel ? '' : p.pais) : undefined}
              style={clicavel ? { cursor: 'pointer' } : undefined}>
              <circle cx={px(p.lon)} cy={py(p.lat)} r={raio(p.valor)}
                fill={eSel ? corSelecionada : cor}
                fillOpacity={ativo ? 0.75 : 0.18}
                stroke="var(--sup-cartao)" strokeWidth={1.2} />
              <title>{p.detalhe ?? `${p.pais} — ${conta(p.valor, unidade)}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Legenda de TAMANHO. Símbolo proporcional sem ela é decoração: o leitor vê que
 * uma bolha é maior, e não tem como saber quanto maior. Três círculos
 * concêntricos ancorados na base, que é a forma canônica.
 */
export function LegendaTamanho({ max, unidade = '', cor = 'var(--chart-mark)' }: {
  max: number; unidade?: string; cor?: string;
}) {
  const passos = [max, Math.round(max / 4), 1].filter((v, i, a) => v > 0 && a.indexOf(v) === i);
  const raio = (n: number) => 4 + Math.sqrt(n / Math.max(1, max)) * 16;
  const rMax = raio(max);
  const larg = rMax * 2 + 8;
  const alt = rMax * 2 + 18;
  return (
    <div className="flex items-end gap-3">
      <svg width={larg} height={alt} role="img"
        aria-label={`Escala do mapa: a maior bolha vale ${conta(max, unidade)}.`}>
        {passos.map(v => {
          const r = raio(v);
          return (
            <circle key={v} cx={larg / 2} cy={alt - 14 - r} r={r}
              fill="none" stroke={cor} strokeWidth={1} opacity={0.75} />
          );
        })}
      </svg>
      <ul className="text-[12px] leading-tight text-slate-600 tabular-nums">
        {passos.map(v => <li key={v}>{conta(v, unidade)}</li>)}
      </ul>
    </div>
  );
}
