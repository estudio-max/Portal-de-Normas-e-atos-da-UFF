import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  /** Quando presente, o cartão vira botão de verdade: clicável e alcançável
   *  pelo teclado. Antes o `onClick` era passado pelo ActCard e simplesmente
   *  descartado aqui — o cartão exibia `cursor-pointer` e não fazia nada. */
  onClick?: () => void;
  /** Rótulo acessível do cartão clicável (vai no `aria-label` do botão). */
  ariaLabel?: string;
}

export const Card: React.FC<CardProps> = ({ children, className, hover = false, onClick, ariaLabel }) => {
  const base = cn(
    'bg-white rounded-xl border border-[#E2E8F0] shadow-sm',
    (hover || onClick) && 'transition-shadow hover:shadow-md cursor-pointer',
    className
  );

  // role/tabIndex em vez de <button>: o conteúdo do cartão tem título e
  // parágrafo, que não podem morar dentro de um <button> sem HTML inválido.
  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={onClick}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
        }}
        className={base}
      >
        {children}
      </div>
    );
  }

  return <div className={base}>{children}</div>;
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('px-5 pt-5', className)}>{children}</div>
);

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cn('px-5 pb-5', className)}>{children}</div>
);

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <h3 className={cn('text-[15px] font-semibold text-[#1A202C]', className)}>{children}</h3>
);
