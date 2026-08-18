import React from 'react';

// ============================================================================
//  RÓTULOS DE EIXO EM HTML — nunca <text> dentro de um SVG que escala.
//
//  O DEFEITO QUE ISTO CORRIGE (18/08/2026)
//  Os gráficos do portal usam `viewBox` com `width="100%"`: tudo dentro deles é
//  multiplicado pela razão entre a largura real e a do viewBox. Num card largo
//  (~1.550px) contra um viewBox de 340, o fator é ~4,5 — e `fontSize="11"`
//  virava ~50px na tela. Os anos apareciam gigantes por cima do gráfico, e foi
//  assim que o mantenedor viu ("os números dos anos estão desproporcionais").
//
//  ⚠️ ESCALAR JUNTO É O COMPORTAMENTO CERTO PARA AS BARRAS e errado para o
//  texto. E nenhum valor fixo de `fontSize` resolve, porque o MESMO componente
//  é renderizado a 375px no celular e a 1.550px no desktop: o que acerta num
//  tamanho erra no outro. Não adianta procurar o número mágico — o texto tem
//  de sair do sistema de coordenadas que escala.
//
//  Fora do SVG, 11–12px são 11–12px em qualquer largura, e o rótulo respeita o
//  piso tipográfico que o projeto adotou para leitura em tela pequena.
//
//  ⚠️ AO CRIAR GRÁFICO NOVO: se ele tem `viewBox` + `width="100%"`, o eixo vem
//  daqui. Texto dentro do SVG só é seguro quando o SVG tem largura fixa em px
//  (é o caso do heatmap, que por isso continua com <text> e está correto).
// ============================================================================

// 12px, e não 11: é o piso de corpo de texto que o projeto adotou para
// leitura em tela pequena, e aqui o rótulo é a única âncora do eixo.
const CLASSE = 'text-[12px] leading-tight text-slate-500 tabular-nums';

/** Rótulos DISTRIBUÍDOS: um por item, em frações iguais da largura.
 *  Para gráficos de barra, onde cada categoria ocupa uma coluna igual.
 *  `padL`/`largura` reproduzem em porcentagem o recuo esquerdo do viewBox. */
export function RotulosEixo({ itens, padL = 0, largura }: {
  itens: string[]; padL?: number; largura: number;
}) {
  return (
    <div className="flex" style={{ paddingLeft: `${(padL / largura) * 100}%` }} aria-hidden="true">
      {itens.map((t, i) => (
        <span key={i} className={`flex-1 text-center ${CLASSE}`}>{t}</span>
      ))}
    </div>
  );
}

/** Rótulos POSICIONADOS: cada um numa coordenada x própria do viewBox.
 *  Para eixos de escala contínua (linha do tempo), onde as marcas não ficam a
 *  distâncias iguais. `altura` reserva o espaço, já que os filhos são
 *  absolutos e não empurram o fluxo. */
export function RotulosEixoPosicionado({ marcas, largura, altura = 18 }: {
  marcas: { x: number; texto: string }[]; largura: number; altura?: number;
}) {
  return (
    <div className="relative" style={{ height: altura }} aria-hidden="true">
      {marcas.map((m, i) => (
        <span
          key={i}
          className={`absolute -translate-x-1/2 whitespace-nowrap ${CLASSE}`}
          style={{ left: `${(m.x / largura) * 100}%` }}
        >
          {m.texto}
        </span>
      ))}
    </div>
  );
}
