import React from 'react';
import { cn } from '../../lib/utils';

interface TaskCardProps {
  titulo: string;
  descricao: string;
  icon: React.ReactNode;
  /** Marca a tarefa de entrada. Aparece como TEXTO ("Comece aqui"), não só
   *  como anel: cor sozinha não diz o que a distingue, e é a regra que a
   *  proposta fixa para todo estado desta interface. */
  foco?: boolean;
  onClick: () => void;
}

/**
 * Cartão de tarefa da home. É <button> nativo, e não uma div fingindo de botão
 * pelo atributo de papel: o conteúdo é só rótulo e uma frase, então cabe dentro
 * de um botão sem HTML inválido — e assim o foco, o Enter, o Espaço e o nome
 * acessível vêm de graça do navegador, sem handler de teclado escrito à mão,
 * que é justamente onde esse tipo de componente costuma quebrar.
 *
 * (O `Card` de uso geral faz o contrário, e com razão: lá dentro cabem título e
 * parágrafo, que não podem morar dentro de um <button>.)
 *
 * As cores saem de `--marca-*` (declaradas nos dois temas em index.css), pela
 * mesma razão do `.nav-destaque`: o verde institucional não está na lista de
 * conversão do modo fotofobia e ficaria verde-escuro sobre fundo escuro.
 */
export const TaskCard: React.FC<TaskCardProps> = ({ titulo, descricao, icon, foco, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    data-foco={foco ? '1' : undefined}
    className={cn(
      'card-tarefa group relative w-full rounded-2xl p-5 text-center',
      'flex flex-col items-center gap-3 min-h-[168px] justify-center'
    )}
  >
    {foco && (
      <span className="absolute right-3 top-3 rounded-md bg-[#006400] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
        Comece aqui
      </span>
    )}
    <span className="selo-marca flex h-14 w-14 shrink-0 items-center justify-center rounded-full">
      {icon}
    </span>
    <span className="text-[15px] font-semibold text-[#1A3A1A]">{titulo}</span>
    <span className="text-[12px] leading-relaxed text-[#4A5568]">{descricao}</span>
  </button>
);
