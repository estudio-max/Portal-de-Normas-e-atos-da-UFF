import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface CampoCartao {
  rotulo: string;
  valor: React.ReactNode;
}

interface Props {
  icone: React.ReactNode;
  titulo: string;
  /** Selos ao lado do título (sigla, obrigatoriedade legal, estágio…). */
  etiquetas?: React.ReactNode;
  /** Bloco rotulado logo abaixo do título — o "ÓRGÃO / …" do desenho. */
  destaque?: CampoCartao;
  /** A linha de dados do pé do cartão, em duas colunas. */
  campos: CampoCartao[];
  /** Linha extra, para o que não cabe em rótulo curto. */
  rodape?: React.ReactNode;
  /** Texto da ação. Escrito, nunca só uma seta — "Ver comissão", "Ver política". */
  acao: string;
  onClick: () => void;
}

/**
 * Cartão de registro em grade, compartilhado por Comissões e Políticas.
 *
 * O DESENHO É UM SÓ e o conteúdo é que muda — é isso que faz as duas abas
 * terem a mesma estética de verdade, em vez de parecidas por coincidência até
 * alguém mexer numa delas.
 *
 * É <button> nativo: o conteúdo é rótulo e valores curtos, cabe dentro de um
 * botão sem HTML inválido, e assim foco, Enter, Espaço e nome acessível vêm do
 * navegador. (O `Card` de uso geral faz o contrário, e com razão: lá dentro
 * cabem título e parágrafo, que não podem morar num <button>.)
 *
 * A superfície e a marca saem dos tokens `--sup-cartao` / `--marca-*`, pela
 * razão de sempre neste projeto: o modo fotofobia converte cor por lista de
 * CLASSES, e o verde institucional não está nessa lista — usá-lo direto daria
 * verde-escuro sobre fundo escuro, sem erro nenhum no console.
 */
export const CartaoGrade: React.FC<Props> = ({
  icone, titulo, etiquetas, destaque, campos, rodape, acao, onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className="cartao-grade group flex w-full flex-col rounded-xl p-4 text-left"
  >
    <div className="flex items-start gap-3">
      <span className="selo-marca flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="texto-marca block text-[15px] font-semibold leading-snug">{titulo}</span>
        {etiquetas && <span className="mt-1.5 flex flex-wrap items-center gap-1.5">{etiquetas}</span>}
      </span>
    </div>

    {destaque && (
      <div className="mt-3 border-t border-[#E2E8F0] pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4A5568]">
          {destaque.rotulo}
        </p>
        <div className="mt-0.5 text-[13px] text-[#1A202C]">{destaque.valor}</div>
      </div>
    )}

    <div className="mt-3 flex flex-wrap gap-x-8 gap-y-3 border-t border-[#E2E8F0] pt-3">
      {campos.map(c => (
        <div key={c.rotulo}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#4A5568]">{c.rotulo}</p>
          <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-[#1A202C]">{c.valor}</div>
        </div>
      ))}
    </div>

    {rodape && <div className="mt-3 text-[12px] leading-relaxed text-[#4A5568]">{rodape}</div>}

    <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-[#3182CE] group-hover:underline">
      {acao} <ChevronRight size={14} aria-hidden="true" />
    </span>
  </button>
);

/** Grade responsiva padrão para os cartões. */
export const GradeCartoes: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
);
