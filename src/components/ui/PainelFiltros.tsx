import React, { useEffect, useRef } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';

interface Props {
  aberto: boolean;
  onFechar: () => void;
  onLimpar: () => void;
  /** Os campos do painel. Cada aba passa os seus. */
  children: React.ReactNode;
  titulo?: string;
}

/**
 * Casca do painel de filtros secundários, compartilhada pelas abas.
 *
 * É painel LATERAL, não modal: quem filtra quer VER a lista mudar. Um modal
 * cobriria justamente o resultado que a pessoa está tentando ajustar. Em tela
 * estreita ele ocupa a largura toda, porque aí não sobra lista para ver — e só
 * nesse caso ganha véu, já que no desktop escurecer o resto sugeriria que a
 * lista está inativa quando ela continua reagindo a cada campo.
 *
 * Existe como componente próprio desde 13/08/2026, quando a segunda aba (e
 * depois a terceira) passou a precisar do mesmo comportamento. Sem isto, cada
 * aba reimplementaria foco, Esc e rodapé — e elas divergiriam em silêncio, que
 * é como um "design system" morre.
 */
export const PainelFiltros: React.FC<Props> = ({
  aberto, onFechar, onLimpar, children, titulo = 'Filtros avançados',
}) => {
  const primeiro = useRef<HTMLDivElement>(null);

  // Foco entra no painel ao abrir e Esc fecha. Sem isso o painel é alcançável
  // só pelo mouse — e boa parte do público deste portal não tem prática com
  // sites, então o caminho de teclado não é luxo.
  useEffect(() => {
    if (!aberto) return;
    primeiro.current?.querySelector<HTMLElement>(
      'select, input, textarea, button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
        onClick={onFechar}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="false"
        aria-label={titulo}
        className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[320px] flex-col overflow-y-auto border-l border-[#E2E8F0] bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[#1A202C]">
            <SlidersHorizontal size={16} /> {titulo}
          </h2>
          <button
            onClick={onFechar}
            aria-label={`Fechar ${titulo.toLowerCase()}`}
            className="rounded-lg p-1.5 text-[#4A5568] hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        <div ref={primeiro} className="flex-1 space-y-4 px-4 py-4">{children}</div>

        <div className="sticky bottom-0 flex gap-2 border-t border-[#E2E8F0] bg-white px-4 py-3">
          <button
            onClick={onLimpar}
            className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] font-medium text-[#4A5568] hover:bg-gray-50"
          >
            Limpar
          </button>
          {/* "Concluir", não "Aplicar": os filtros JÁ estão aplicados — a lista
              muda a cada campo. Um "Aplicar" prometeria que nada valeu até
              clicar nele, e quem fechasse pelo X acharia ter perdido o que
              escolheu. */}
          <button
            onClick={onFechar}
            className="flex-1 rounded-lg bg-[#006400] py-2 text-[13px] font-semibold text-white hover:bg-[#004d00]"
          >
            Concluir
          </button>
        </div>
      </div>
    </>
  );
};

/** Rótulo e caixa dos campos do painel, para as abas não divergirem no estilo. */
export const rotuloFiltro = 'block text-[12px] font-medium text-[#1A202C] mb-1';
export const campoFiltro =
  'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[13px] text-[#1A202C] ' +
  'focus:border-[#006400] focus:outline-none';
export const ajudaFiltro = 'mt-1 text-[12px] leading-relaxed text-[#4A5568]';
