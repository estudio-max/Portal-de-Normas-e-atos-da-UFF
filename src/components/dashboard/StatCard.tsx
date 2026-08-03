import React from 'react';
import { Card, CardContent } from '../ui/Card';
import { cn } from '../../lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  /** Linha de apoio sob o número. É PARTICIPAÇÃO no acervo, não série
   *  temporal: nada aqui foi comparado com período anterior. Por isso não
   *  leva seta — "↓ 1% do acervo" se lia como queda de 1%, que ninguém mediu. */
  nota?: string;
  icon?: React.ReactNode;
  color?: 'green' | 'blue' | 'red' | 'yellow' | 'gray';
}

const colorMap = {
  green: { bg: 'bg-[#F0FFF4]', text: 'text-[#38A169]', iconBg: 'bg-[#F0FFF4]' },
  blue: { bg: 'bg-[#EBF8FF]', text: 'text-[#3182CE]', iconBg: 'bg-[#EBF8FF]' },
  red: { bg: 'bg-[#FFF5F5]', text: 'text-[#E53E3E]', iconBg: 'bg-[#FFF5F5]' },
  yellow: { bg: 'bg-[#FFFBEB]', text: 'text-[#D69E2E]', iconBg: 'bg-[#FFFBEB]' },
  gray: { bg: 'bg-gray-50', text: 'text-gray-600', iconBg: 'bg-gray-100' },
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  nota,
  icon,
  color = 'green',
}) => {
  const c = colorMap[color];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[13px] text-[#A0AEC0]">{label}</p>
          <p className="text-[28px] font-semibold text-[#1A202C] tabular-nums leading-tight">{value}</p>
          {nota && <p className="text-[11px] font-medium text-[#A0AEC0]">{nota}</p>}
        </div>
        {icon && (
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', c.iconBg)}>
            <span className={c.text}>{icon}</span>
          </div>
        )}
      </div>
    </Card>
  );
};
