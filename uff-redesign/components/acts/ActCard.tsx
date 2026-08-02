import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import { FileText, Building2, Hash, Calendar, ArrowRight } from 'lucide-react';
import type { UffAct } from '../../types';

interface ActCardProps {
  act: UffAct;
  onClick?: () => void;
}

const statusMap: Record<string, { variant: 'active' | 'revoked' | 'altered'; label: string }> = {
  Ativo: { variant: 'active', label: 'Vigente' },
  Revogado: { variant: 'revoked', label: 'Revogado' },
  Alterado: { variant: 'altered', label: 'Alterado' },
};

const typeColorMap: Record<string, string> = {
  Portaria: 'bg-[#006400]',
  Resolução: 'bg-[#C9A227]',
  Decisão: 'bg-[#3182CE]',
  'Instrução Normativa': 'bg-[#A0AEC0]',
  'Determinação de Serviço': 'bg-[#805AD5]',
  'Norma de Serviço': 'bg-[#DD6B20]',
  'Ordem de Serviço': 'bg-[#38A169]',
  'Instrução de Serviço': 'bg-[#319795]',
  Deliberação: 'bg-[#D53F8C]',
  Comunicado: 'bg-[#718096]',
  Edital: 'bg-[#2B6CB0]',
  'Resumo de Despachos': 'bg-[#744210]',
  Outro: 'bg-[#A0AEC0]',
};

export const ActCard: React.FC<ActCardProps> = ({ act, onClick }) => {
  const status = statusMap[act.status] || { variant: 'active' as const, label: act.status };
  const typeColor = typeColorMap[act.tipoAto] || 'bg-[#006400]';
  const relCount = (act.relacoes?.length || 0) + (act.referenciadoPor?.length || 0);

  return (
    <Card hover className="overflow-hidden" onClick={onClick}>
      <div className="flex">
        <div className={cn('w-1.5 shrink-0', typeColor)} />
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <h3 className="text-[15px] font-semibold text-[#1A202C] leading-snug truncate">
                {act.tipoAto} nº {act.numero}/{act.ano}
              </h3>
              <p className="text-[13px] text-[#4A5568] mt-1 line-clamp-2 leading-relaxed">
                {act.ementa || 'Sem ementa disponível'}
                {act.ementaInferida && (
                  <span className="text-[11px] text-[#D69E2E] ml-1">(inferida)</span>
                )}
              </p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#E2E8F0] flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-[#A0AEC0]">
            {act.orgaoEmissor && (
              <span className="flex items-center gap-1">
                <Building2 size={12} />
                {act.orgaoEmissor}
              </span>
            )}
            {act.boletimNumero && (
              <span className="flex items-center gap-1">
                <FileText size={12} />
                {act.boletimNumero}
              </span>
            )}
            {act.processoSei && (
              <span className="flex items-center gap-1 text-[#3182CE]">
                <Hash size={12} />
                {act.processoSei}
              </span>
            )}
            {act.dataAssinatura && (
              <span className="flex items-center gap-1">
                <Calendar size={12} />
                {new Date(act.dataAssinatura).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>

          {relCount > 0 && (
            <div className="mt-2 flex items-center gap-1 text-[11px] text-[#A0AEC0]">
              <ArrowRight size={11} />
              {relCount} relação{relCount > 1 ? 'ões' : ''}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
