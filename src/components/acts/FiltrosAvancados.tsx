import React, { useEffect, useRef } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';

export interface CampoAvancado {
  emissor: string;
  nome: string;
  siape: string;
  processo: string;
  soRel: boolean;
  soSei: boolean;
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  orgaos: string[];
  valores: CampoAvancado;
  onChange: <K extends keyof CampoAvancado>(campo: K, valor: CampoAvancado[K]) => void;
  onLimpar: () => void;
}

const rotulo = 'block text-[12px] font-medium text-[#1A202C] mb-1';
const campo =
  'w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-[13px] text-[#1A202C] ' +
  'focus:border-[#006400] focus:outline-none';

/**
 * Painel de filtros secundários. Emissor, nome, SIAPE, processo e os dois
 * recortes booleanos moram aqui porque a primeira interação não precisa deles —
 * a barra principal fica com busca, tipo, ano e status.
 *
 * É painel lateral, não modal: quem filtra quer VER a lista mudar. Um modal
 * cobriria justamente o resultado que a pessoa está tentando ajustar. Em tela
 * estreita ele ocupa a largura toda, porque aí não sobra lista para ver.
 */
export const FiltrosAvancados: React.FC<Props> = ({
  aberto, onFechar, orgaos, valores, onChange, onLimpar,
}) => {
  const painel = useRef<HTMLDivElement>(null);
  const primeiro = useRef<HTMLSelectElement>(null);

  // Foco entra no painel ao abrir e Esc fecha. Sem isso o painel é alcançável
  // só pelo mouse — e a proposta pede teclado desde o início.
  useEffect(() => {
    if (!aberto) return;
    primeiro.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <>
      {/* Véu só no mobile: no desktop o painel divide a tela com a lista e
          escurecer o resto sugeriria que a lista está inativa, quando ela
          continua reagindo a cada filtro. */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
        onClick={onFechar}
        aria-hidden="true"
      />
      <div
        ref={painel}
        role="dialog"
        aria-modal="false"
        aria-label="Filtros avançados"
        className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-[320px] flex-col overflow-y-auto border-l border-[#E2E8F0] bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-4 py-3">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold text-[#1A202C]">
            <SlidersHorizontal size={16} /> Filtros avançados
          </h2>
          <button
            onClick={onFechar}
            aria-label="Fechar filtros avançados"
            className="rounded-lg p-1.5 text-[#4A5568] hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-4 px-4 py-4">
          <div>
            <label className={rotulo} htmlFor="filtro-emissor">Órgão emissor</label>
            <select
              id="filtro-emissor"
              ref={primeiro}
              value={valores.emissor}
              onChange={e => onChange('emissor', e.target.value)}
              className={campo}
            >
              <option value="todos">Todos</option>
              {orgaos.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <label className={rotulo} htmlFor="filtro-nome">Nome do servidor</label>
            <input
              id="filtro-nome"
              value={valores.nome}
              onChange={e => onChange('nome', e.target.value)}
              className={campo}
              aria-describedby="ajuda-nome"
            />
            <p id="ajuda-nome" className="mt-1 text-[11px] leading-relaxed text-[#4A5568]">
              Procura no corpo do ato, inclusive em tabelas. Atende a quem não tem
              matrícula registrada no texto.
            </p>
          </div>

          <div>
            <label className={rotulo} htmlFor="filtro-siape">Matrícula SIAPE</label>
            <input
              id="filtro-siape"
              value={valores.siape}
              onChange={e => onChange('siape', e.target.value)}
              inputMode="numeric"
              className={`${campo} font-mono`}
              aria-describedby="ajuda-siape"
            />
            <p id="ajuda-siape" className="mt-1 text-[11px] leading-relaxed text-[#4A5568]">
              Zeros à esquerda não importam.
            </p>
          </div>

          <div>
            <label className={rotulo} htmlFor="filtro-processo">Processo</label>
            <input
              id="filtro-processo"
              value={valores.processo}
              onChange={e => onChange('processo', e.target.value)}
              className={`${campo} font-mono`}
              aria-describedby="ajuda-processo"
            />
            <p id="ajuda-processo" className="mt-1 text-[11px] leading-relaxed text-[#4A5568]">
              Aceita com ou sem pontuação, e aceita só um pedaço do número.
            </p>
          </div>

          <fieldset className="space-y-2 border-t border-[#E2E8F0] pt-4">
            <legend className="text-[12px] font-medium text-[#1A202C]">Recortes</legend>
            <label className="flex items-start gap-2 text-[13px] text-[#1A202C]">
              <input
                type="checkbox"
                checked={valores.soRel}
                onChange={e => onChange('soRel', e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#006400]"
              />
              Só atos com relações
            </label>
            <label className="flex items-start gap-2 text-[13px] text-[#1A202C]">
              <input
                type="checkbox"
                checked={valores.soSei}
                onChange={e => onChange('soSei', e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#006400]"
              />
              Só atos com processo vinculado
            </label>
          </fieldset>
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-[#E2E8F0] bg-white px-4 py-3">
          <button
            onClick={onLimpar}
            className="flex-1 rounded-lg border border-[#E2E8F0] py-2 text-[13px] font-medium text-[#4A5568] hover:bg-gray-50"
          >
            Limpar
          </button>
          {/* "Concluir", não "Aplicar": os filtros JÁ estão aplicados — a lista
              muda a cada campo. Um botão "Aplicar" prometeria que nada valeu
              até clicar nele, e quem fechasse pelo X acharia ter perdido o
              que digitou. */}
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
