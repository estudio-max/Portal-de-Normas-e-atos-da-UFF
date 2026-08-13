import React, { useEffect, useRef } from 'react';
import { X, HelpCircle, Lightbulb, AlertTriangle, ArrowRight } from 'lucide-react';
import type { AjudaAba } from './ajudaConteudo';

// O modal da ajuda contextual.
//
// É um <dialog> nativo, e não uma <div> com posição fixa, por três coisas que
// vêm prontas e que eu teria de reimplementar (mal) à mão:
//   1. armadilha de foco — o Tab não escapa para a página atrás;
//   2. Esc fecha, sem listener de teclado nosso;
//   3. camada superior própria, então ele não disputa z-index com o cabeçalho
//      sticky nem com a sidebar fixa.
// O preço é um só: clicar no fundo escuro não fecha sozinho, porque o fundo faz
// parte da caixa do próprio <dialog>. Daí o teste de alvo no onClick abaixo.

interface Props {
  aberto: boolean;
  aba: AjudaAba;
  onFechar: () => void;
  onIrParaGuia: () => void;
}

export const AjudaModal: React.FC<Props> = ({ aberto, aba, onFechar, onIrParaGuia }) => {
  const ref = useRef<HTMLDialogElement>(null);

  // O <dialog> é imperativo: abrir por atributo (`open`) NÃO ativa o modo modal
  // — não trava o foco, não escurece o fundo, não fecha no Esc. Só showModal()
  // faz isso, então o estado do React tem que virar chamada de método.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      onClose={onFechar}
      onClick={e => { if (e.target === ref.current) onFechar(); }}
      aria-labelledby="ajuda-titulo"
      className="ajuda-dialog w-[min(92vw,40rem)] max-h-[85vh] p-0 rounded-xl border border-slate-200 bg-white shadow-2xl"
    >
      {aberto && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
            <h2 id="ajuda-titulo" className="flex items-center gap-2 text-sm font-bold text-[#003366]">
              <HelpCircle className="h-4 w-4 shrink-0 text-yellow-500" />
              {aba.titulo}
            </h2>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar ajuda"
              className="-mr-1 -mt-0.5 shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4 text-[13px] leading-relaxed text-slate-700">
            {/* O resumo tem peso próprio: é a frase que a pessoa leva embora se
                fechar o modal agora. */}
            <p className="text-[14px] text-slate-800">{aba.resumo}</p>

            {/* Por que a aba existe. Vem ANTES dos passos de propósito: quem
                abriu o "?" quer saber se vale a pena, e só depois como opera. */}
            <h3 className="mt-4 mb-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-500">
              Por que esta aba existe
            </h3>
            <div className="space-y-2 border-l-2 border-slate-200 pl-3">
              {aba.porQue.map((p, i) => <p key={i}>{p}</p>)}
            </div>

            <h3 className="mt-4 mb-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-500">
              Como usar
            </h3>
            <ol className="ml-5 list-decimal space-y-1.5">
              {aba.passos.map((p, i) => <li key={i}>{p}</li>)}
            </ol>

            {aba.destaque && (
              <div className="mt-4 flex gap-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
                <p className="text-xs text-blue-800">{aba.destaque}</p>
              </div>
            )}

            {aba.cuidado && (
              <div className="mt-3 flex gap-2 rounded-lg border border-amber-100 bg-amber-50 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <p className="text-xs text-amber-800">
                  <strong>Como ler com cautela:</strong> {aba.cuidado}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-2.5">
            <button
              type="button"
              onClick={onIrParaGuia}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#003366] hover:underline"
            >
              Ver o guia completo <ArrowRight className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onFechar}
              className="rounded-md bg-[#003366] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#00264d]"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
};
