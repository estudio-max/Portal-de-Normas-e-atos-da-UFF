import React from 'react';

// "Uma linha de tabela vira um cartão" — o formato que as listas do portal
// assumem abaixo de 768 px. Fica aqui, e não copiado em cada painel, para que
// título, selo, grade de metadados e ações tenham o mesmo desenho em todas as
// abas: quem aprendeu a ler o cartão de Chefias lê o de Cooperação sem pensar.
//
// O painel renderiza a MESMA coleção duas vezes: esta lista com `md:hidden` e
// a tabela existente com `hidden md:block`. A tabela do desktop não muda, e as
// tabelas de impressão (window.print) não são tocadas.

export interface RecordField {
  rotulo: string;
  valor: React.ReactNode;
  /** Ocupa a largura inteira em vez de meia coluna. */
  largo?: boolean;
}

interface RecordCardProps {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  /** Chip de status/categoria, alinhado à direita do título. */
  selo?: React.ReactNode;
  campos?: RecordField[];
  /** Texto longo (ementa, trecho de origem): ganha linha própria. */
  texto?: React.ReactNode;
  /** Links e botões da linha. */
  acoes?: React.ReactNode;
  className?: string;
}

export const RecordCard: React.FC<RecordCardProps> = ({
  titulo, subtitulo, selo, campos, texto, acoes, className,
}) => (
  <article className={`rounded-lg border border-slate-200 bg-white p-3 space-y-2 shadow-xs ${className || ''}`}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight text-slate-900 break-words">{titulo}</p>
        {subtitulo && <p className="text-[11px] leading-tight text-slate-500 break-words">{subtitulo}</p>}
      </div>
      {selo && <div className="shrink-0">{selo}</div>}
    </div>

    {campos && campos.length > 0 && (
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        {campos.map((c, i) => (
          <div key={c.rotulo + i} className={c.largo ? 'col-span-2 min-w-0' : 'min-w-0'}>
            <dt className="uppercase tracking-wide text-slate-400">{c.rotulo}</dt>
            <dd className="text-slate-700 break-words">{c.valor || '—'}</dd>
          </div>
        ))}
      </dl>
    )}

    {texto && <p className="text-xs leading-relaxed text-slate-700 break-words">{texto}</p>}
    {acoes && <div className="flex flex-wrap items-center gap-2 pt-0.5">{acoes}</div>}
  </article>
);

/** Envoltório da lista de cartões: só aparece abaixo de 768 px. */
export const RecordCardList: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`md:hidden space-y-2 ${className || ''}`}>{children}</div>
);

/** Envoltório da tabela existente: some abaixo de 768 px. */
export const DesktopTable: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`hidden md:block overflow-x-auto ${className || ''}`}>{children}</div>
);
