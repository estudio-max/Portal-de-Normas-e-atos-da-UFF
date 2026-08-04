import React, { useEffect, useState } from 'react';
import { StatCard } from './StatCard';
import { Card, CardHeader, CardContent, CardTitle } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { ActCard } from '../acts/ActCard';
import { AreaPorAno, ComposicaoDoBoletim, OrgaosDoBoletim } from './Graficos';
import { FileText, CheckCircle2, XCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { ANO_INICIO_ACERVO } from '../../config';
import type { UffAct, UffStatistics } from '../../types';

interface DashboardProps {
  stats: UffStatistics | null;
  recentActs: UffAct[];
  latestBulletin: { numero: string; ano: number } | null | undefined;
  apiMode: boolean;
  onNavigate: (path: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, recentActs, latestBulletin, apiMode, onNavigate }) => {
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
  // A faixa vem do DADO, não de uma constante local: a camada de dados (API ou
  // modo estático) já decide o intervalo, e aqui só se preenchem os buracos
  // para que anos sem ato apareçam como barra zerada em vez de sumirem.
  // Enquanto o fim era fixo (2026), em 01/01/2027 o gráfico pararia de crescer
  // com o total ainda subindo — gráfico e KPI discordando sem aviso.
  const anosComDado = Object.keys(stats?.porAno || {})
    .map(Number)
    .filter(n => Number.isFinite(n) && n >= ANO_INICIO_ACERVO);
  const anoFim = anosComDado.length ? Math.max(...anosComDado) : new Date().getFullYear();
  const annualEntries = Array.from(
    { length: Math.max(0, anoFim - ANO_INICIO_ACERVO + 1) },
    (_, index) => {
      const ano = ANO_INICIO_ACERVO + index;
      return [ano, Number(stats?.porAno?.[ano] || 0)] as const;
    });
  const serieAnos = annualEntries.map(([ano, count]) => [ano, count] as [number, number]);

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
              nota={`${total ? Math.round((vigentes / total) * 100) : 0}% do acervo`}
              icon={<CheckCircle2 size={18} />}
              color="green"
            />
            <StatCard
              label="Revogados"
              value={revogados.toLocaleString('pt-BR')}
              nota={`${total ? Math.round((revogados / total) * 100) : 0}% do acervo`}
              icon={<XCircle size={18} />}
              color="red"
            />
            <StatCard
              label="Alterados"
              value={alterados.toLocaleString('pt-BR')}
              nota={`${total ? Math.round((alterados / total) * 100) : 0}% do acervo`}
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
              <CardTitle>
                {latestBulletin
                  ? `Boletim de Serviço nº ${latestBulletin.numero}/${latestBulletin.ano} · ${recentActs.length} atos`
                  : 'Últimos atos publicados'}
              </CardTitle>
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
                recentActs.map(act => (
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
              <CardTitle>Atos publicados por ano</CardTitle>
            </CardHeader>
            <CardContent>
              <AreaPorAno dados={serieAnos} />
            </CardContent>
          </Card>

          {/* Os dois painéis abaixo falam do MESMO boletim que a coluna da
              esquerda lista. A home é sobre a edição mais recente; somar os
              atos dela por tipo e por unidade responde "o que veio hoje?" sem
              obrigar a percorrer a lista inteira. */}
          <Card>
            <CardHeader>
              <CardTitle>
                {latestBulletin ? `O que veio no BS nº ${latestBulletin.numero}/${latestBulletin.ano}` : 'O que veio neste boletim'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-[150px]" /> : <ComposicaoDoBoletim atos={recentActs} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quem publicou</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-[150px]" /> : <OrgaosDoBoletim atos={recentActs} />}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
