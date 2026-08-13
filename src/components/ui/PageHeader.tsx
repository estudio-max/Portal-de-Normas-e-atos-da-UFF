import React from 'react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  titulo: string;
  /** Frase curta de finalidade. Uma linha, no infinitivo ou no imperativo:
   *  diz o que a tela SERVE PARA, não o que ela contém. */
  descricao: string;
  /** Ação principal da tela, quando houver. Fica à direita do título e some
   *  para baixo do rótulo em tela estreita. */
  acao?: React.ReactNode;
  /** Aviso de estado da tela (ex.: modo offline). Sai depois da descrição
   *  porque qualifica a página inteira, não uma linha do resultado. */
  aviso?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho de página. Existe para que toda aba responda "o que é isto?" antes
 * de mostrar dado — a regra de consistência da proposta visual — sem que cada
 * painel escreva o seu próprio par de <h1>/<p> com tamanho e cor diferentes.
 *
 * O <h1> é único por tela e o primeiro elemento do <main>: é por ele que quem
 * navega por cabeçalhos descobre onde chegou.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({ titulo, descricao, acao, aviso, className }) => (
  <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
    <div className="min-w-0">
      <h1 className="text-[22px] font-semibold text-[#1A202C] leading-tight">{titulo}</h1>
      <p className="text-[13px] text-[#4A5568] mt-1 leading-relaxed">{descricao}</p>
      {aviso}
    </div>
    {acao}
  </div>
);
