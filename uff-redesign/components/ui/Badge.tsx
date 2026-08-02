import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'active' | 'revoked' | 'altered' | 'warning' | 'info';
  className?: string;
}

const variants = {
  default: 'bg-gray-100 text-gray-700 border-gray-200',
  active: 'bg-[#F0FFF4] text-[#38A169] border-[#38A169]/20',
  revoked: 'bg-[#FFF5F5] text-[#E53E3E] border-[#E53E3E]/20',
  altered: 'bg-[#FFFBEB] text-[#D69E2E] border-[#D69E2E]/20',
  warning: 'bg-[#FFFBEB] text-[#D69E2E] border-[#D69E2E]/20',
  info: 'bg-[#EBF8FF] text-[#3182CE] border-[#3182CE]/20',
};

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
