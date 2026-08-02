import React, { useEffect, useState } from 'react';
import { StatCard } from './StatCard';
import { Card, CardHeader, CardContent, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { ActCard } from '../acts/ActCard';
import { FileText, CheckCircle2, XCircle, AlertTriangle, TrendingUp, ArrowRight } from 'lucide-react';
import type { UffAct, UffStatistics } from '../../types';

interface DashboardProps {
  stats: UffStatistics | null;
  recentActs: UffAct[];
  apiMode: boolean;
  onNavigate: (path: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, recentActs, apiMode, onNavigate }) => {
  const [loading, setLoading] = useState(!stats);

  useEffect(() => {
    if (stats) setLoading(false);
  }, [stats]);

  const quickAccess = [
    { label: 'Buscar por número', desc: 'Digite o número do ato', path: 'atos', icon: <FileText size={16} /> },
    { label: 'Consultar meu SIAPE', desc: 'Matrícula ou nome do servidor', path: 'pessoal/siape', icon: <FileText size={16} /> },
    { label: 'Prazos vencendo', desc: 'Acompanhamento de prazos', path: 'pessoal/prazos', icon: <AlertTriangle size={16} /> },
    { label: 'Comissões permanentes', desc: '26 colegiados cadastrados', path: 'institucional/comissoes', icon: <FileText size={16} /> },
  ];

  const total = stats?.total || 0;
  const vigentes = stats?.ativoCount || 0;
  const revogados = stats?.revogadoCount || 0;
  const alterados = stats?.alteradoCount || 0;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-[22px] font-semibold text-[#1A202C]">Dashboard</h1>
        <p className="text-[13px] text-[#A0AEC0] mt-0.5">
          Visão geral do acervo normativo da UFF
          {!apiMode && <span className="text-[#D69E2E] ml-2">• Modo offline (dados estáticos)</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <Skeleton className="h-[100px]" />
            <Skeleton className="h-[100px]" />
            <Skeleton className="h-[100px]" />
            <Skeleton className="h-[100px]" />
          </>
        ) : (
          <>
            <StatCard
              label="Total de atos"
              value={total.toLocaleString('pt-BR')}
              icon={<FileText size={18} />}
              color="green"
            />
            <StatCard
              label="Atos vigentes"
              value={vigentes.toLocaleString('pt-BR')}
              trend={`${total ? Math.round((vigentes / total) * 100) : 0}% do acervo`}
              trendUp={true}
              icon={<CheckCircle2 size={18} />}
              color="green"
            />
            <StatCard
              label="Revogados"
              value={revogados.toLocaleString('pt-BR')}
              trend={`${total ? Math.round((revogados / total) * 100) : 0}% do acervo`}
              trendUp={false}
              icon={<XCircle size={18} />}
              color="red"
            />
            <StatCard
              label="Alterados"
              value={alterados.toLocaleString('pt-BR')}
              trend={`${total ? Math.round((alterados / total) * 100) : 0}% do acervo`}
              trendUp={false}
              icon={<AlertTriangle size={18} />}
              color="yellow"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Últimos atos publicados</CardTitle>
              <button
                onClick={() => onNavigate('atos')}
                className="text-[12px] text-[#3182CE] font-medium hover:underline flex items-center gap-1"
              >
                Ver todos <ArrowRight size={12} />
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <>
                  <Skeleton className="h-[72px]" />
                  <Skeleton className="h-[72px]" />
                  <Skeleton className="h-[72px]" />
                  <Skeleton className="h-[72px]" />
                </>
              ) : recentActs.length === 0 ? (
                <p className="text-[13px] text-[#A0AEC0] py-4 text-center">Nenhum ato recente disponível</p>
              ) : (
                recentActs.slice(0, 5).map(act => (
                  <ActCard
                    key={act.id}
                    act={act}
                    onClick={() => onNavigate('atos')}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Acesso rápido</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickAccess.map(item => (
                <button
                  key={item.path}
                  onClick={() => onNavigate(item.path)}
                  className="flex flex-col items-start gap-1 p-3 rounded-xl border border-[#E2E8F0] hover:border-[#006400]/30 hover:bg-[#F0F7F0]/50 transition-colors text-left"
                >
                  <span className="text-[#006400]">{item.icon}</span>
                  <span className="text-[12px] font-medium text-[#1A202C]">{item.label}</span>
                  <span className="text-[11px] text-[#A0AEC0]">{item.desc}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Atos por ano</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1.5 h-[120px]">
                {stats?.porAno ? (
                  Object.entries(stats.porAno)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .slice(-15)
                    .map(([ano, count], i, arr) => {
                      const max = Math.max(...arr.map(([, c]) => c as number));
                      const h = max ? ((count as number) / max) * 100 : 0;
                      return (
                        <div
                          key={ano}
                          className="flex-1 bg-[#006400] rounded-t transition-all hover:opacity-80"
                          style={{ height: `${h}%`, opacity: 0.3 + (i / arr.length) * 0.7 }}
                          title={`${ano}: ${count} atos`}
                        />
                      );
                    })
                ) : (
                  [35, 48, 42, 58, 51, 67, 63, 74, 70, 82, 76, 90, 84, 96, 88].map((height, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-[#006400] rounded-t"
                      style={{ height: `${height}%`, opacity: 0.3 + (i / 15) * 0.7 }}
                    />
                  ))
                )}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-[#A0AEC0]">
                <span>{stats?.porAno ? Object.keys(stats.porAno).sort((a, b) => Number(a) - Number(b))[0] : '2010'}</span>
                <span>{stats?.porAno ? Object.keys(stats.porAno).sort((a, b) => Number(a) - Number(b)).pop() : '2025'}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
