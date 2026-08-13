import { Eye } from 'lucide-react';
import type { AtoLista } from '../../dataSource';

export function ActListCard({ act, onOpen }: { key?: string; act: AtoLista; onOpen: (id: string) => void }) {
  const status = act.status === 'Ativo' ? 'Vigente' : act.status;
  const statusClass = act.status === 'Ativo' ? 'bg-green-100 text-green-700 border-green-200'
    : act.status === 'Revogado' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-100 text-blue-700 border-blue-200';
  return (
    <article className="md:hidden bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div><p className="font-bold text-slate-900 text-sm leading-tight">{act.tipo}</p><p className="font-mono text-xs font-bold text-blue-800">nº {act.numero}/{act.ano}</p></div>
        <span className={`shrink-0 px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${statusClass}`}>{status}</span>
      </div>
      {/* min-w-0 + break-words: sigla longa (DACQ/CPD/PROGEPE) estourava a
          coluna da grade e, com ela, a largura do cartão. */}
      <div className="grid grid-cols-2 gap-2 text-[12px] text-slate-600">
        <span className="min-w-0">{(act.dataAssinatura || '').split('-').reverse().join('/')}</span>
        <span className="min-w-0 break-words font-bold uppercase text-right">{act.sigla}</span>
      </div>
      <p className="text-xs leading-relaxed text-slate-700 break-words">{act.ementa || 'Sem ementa formal no boletim.'}</p>
      {act.processoSei && <p className="font-mono text-[12px] text-slate-600 break-words">Processo: {act.processoSei}</p>}
      <button onClick={() => onOpen(act.id)} className="w-full inline-flex justify-center items-center gap-1.5 py-2 rounded-md border border-blue-200 text-[#003366] text-xs font-bold hover:bg-blue-50"><Eye className="w-3.5 h-3.5" />Ver ficha</button>
    </article>
  );
}
