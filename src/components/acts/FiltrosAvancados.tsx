import React from 'react';
import { PainelFiltros, rotuloFiltro, campoFiltro, ajudaFiltro } from '../ui/PainelFiltros';

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

/**
 * Filtros secundários de Atos e Normas. Emissor, nome, SIAPE, processo e os
 * dois recortes booleanos moram aqui porque a primeira interação não precisa
 * deles — a barra principal fica com busca, tipo, ano e status.
 *
 * O comportamento do painel (foco, Esc, rodapé) vem do `PainelFiltros`, que
 * Comissões e Políticas também usam.
 */
export const FiltrosAvancados: React.FC<Props> = ({
  aberto, onFechar, orgaos, valores, onChange, onLimpar,
}) => (
  <PainelFiltros aberto={aberto} onFechar={onFechar} onLimpar={onLimpar}>
    <div>
      <label className={rotuloFiltro} htmlFor="filtro-emissor">Órgão emissor</label>
      <select
        id="filtro-emissor"
        value={valores.emissor}
        onChange={e => onChange('emissor', e.target.value)}
        className={campoFiltro}
      >
        <option value="todos">Todos</option>
        {orgaos.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>

    <div>
      <label className={rotuloFiltro} htmlFor="filtro-nome">Nome do servidor</label>
      <input
        id="filtro-nome"
        value={valores.nome}
        onChange={e => onChange('nome', e.target.value)}
        className={campoFiltro}
        aria-describedby="ajuda-nome"
      />
      <p id="ajuda-nome" className={ajudaFiltro}>
        Procura no corpo do ato, inclusive em tabelas. Atende a quem não tem
        matrícula registrada no texto.
      </p>
    </div>

    <div>
      <label className={rotuloFiltro} htmlFor="filtro-siape">Matrícula SIAPE</label>
      <input
        id="filtro-siape"
        value={valores.siape}
        onChange={e => onChange('siape', e.target.value)}
        inputMode="numeric"
        className={`${campoFiltro} font-mono`}
        aria-describedby="ajuda-siape"
      />
      <p id="ajuda-siape" className={ajudaFiltro}>Zeros à esquerda não importam.</p>
    </div>

    <div>
      <label className={rotuloFiltro} htmlFor="filtro-processo">Processo</label>
      <input
        id="filtro-processo"
        value={valores.processo}
        onChange={e => onChange('processo', e.target.value)}
        className={`${campoFiltro} font-mono`}
        aria-describedby="ajuda-processo"
      />
      <p id="ajuda-processo" className={ajudaFiltro}>
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
  </PainelFiltros>
);
