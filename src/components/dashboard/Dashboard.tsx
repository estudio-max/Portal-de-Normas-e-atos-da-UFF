import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { TaskCard } from './TaskCard';
import { AreaPorAno, ComposicaoDoBoletim, OrgaosDoBoletim } from './Graficos';
import { Search, IdCard, CalendarClock, Share2, ArrowRight, ChevronRight } from 'lucide-react';
import { ANO_INICIO_ACERVO } from '../../config';
import type { UffAct, UffStatistics } from '../../types';

interface DashboardProps {
  stats: UffStatistics | null;
  recentActs: UffAct[];
  latestBulletin: { numero: string; ano: number } | null | undefined;
  apiMode: boolean;
  onNavigate: (path: string) => void;
}

const STATUS_ROTULO: Record<string, { texto: string; classe: string }> = {
  Ativo: { texto: 'Vigente', classe: 'bg-green-100 text-green-700 border-green-200' },
  Revogado: { texto: 'Revogado', classe: 'bg-red-100 text-red-700 border-red-200' },
  Alterado: { texto: 'Alterado', classe: 'bg-amber-100 text-amber-700 border-amber-200' },
};

export const Dashboard: React.FC<DashboardProps> = ({ stats, recentActs, latestBulletin, apiMode, onNavigate }) => {
  const [loading, setLoading] = useState(!stats);
  const [mostrarTudo, setMostrarTudo] = useState(false);

  useEffect(() => {
    if (stats) setLoading(false);
  }, [stats]);

  // A home começa pelas TAREFAS, não pelos indicadores do acervo: quem chega
  // aqui quer resolver algo ("achar a portaria", "provar que participei de uma
  // comissão"), e o total de atos não responde nenhuma dessas perguntas. Os
  // números continuam na página, um degrau abaixo.
  const tarefas = [
    {
      titulo: 'Encontrar um ato',
      descricao: 'Busque portarias, editais, resoluções e outros atos.',
      icon: <Search size={24} />, path: 'atos', foco: true,
    },
    {
      titulo: 'Consultar meu SIAPE',
      descricao: 'Veja os atos do Boletim que citam a sua matrícula.',
      icon: <IdCard size={24} />, path: 'pessoal/siape',
    },
    {
      titulo: 'Acompanhar prazos',
      descricao: 'Datas e vigências encontradas no texto dos atos.',
      icon: <CalendarClock size={24} />, path: 'pessoal/prazos',
    },
    {
      titulo: 'Explorar relações',
      descricao: 'Veja o que cada ato revoga, altera ou complementa.',
      icon: <Share2 size={24} />, path: 'relacoes',
    },
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

  // A lista abre curta e cresce POR AÇÃO, com o número de atos restantes
  // escrito no botão. O boletim inteiro continua alcançável — já houve versão
  // que mostrava 5 atos e escondia o resto sem dizer, e é o que a trava de
  // integridade proíbe. Esconder em silêncio é o defeito; oferecer uma prévia
  // e nomear o que falta, não.
  const PREVIA = 6;
  const visiveis = mostrarTudo ? recentActs : recentActs.slice(0, PREVIA);
  const resumo = [
    { rotulo: 'Total de atos', valor: total },
    { rotulo: 'Atos vigentes', valor: vigentes },
    { rotulo: 'Revogados', valor: revogados },
    { rotulo: 'Alterados', valor: alterados },
  ];

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-[22px] font-semibold text-[#1A202C] leading-tight">O que você quer fazer?</h1>
        {!apiMode && (
          <p className="text-[13px] text-[#D69E2E] mt-1">
            Modo offline — respondendo pelo índice estático de contingência.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {tarefas.map(t => (
          <TaskCard
            key={t.path}
            titulo={t.titulo}
            descricao={t.descricao}
            icon={t.icon}
            foco={t.foco}
            onClick={() => onNavigate(t.path)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Atualizações recentes */}
        <Card>
          <CardHeader className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Atualizações recentes</CardTitle>
              {latestBulletin && (
                <p className="text-[12px] text-[#4A5568] mt-0.5">
                  Boletim de Serviço nº {latestBulletin.numero}/{latestBulletin.ano} · {recentActs.length} atos
                </p>
              )}
            </div>
            <button
              onClick={() => onNavigate('atos')}
              className="shrink-0 text-[12px] text-[#3182CE] font-medium hover:underline flex items-center gap-1"
            >
              Ver todas <ArrowRight size={12} />
            </button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-[56px]" />
                <Skeleton className="h-[56px]" />
                <Skeleton className="h-[56px]" />
              </div>
            ) : recentActs.length === 0 ? (
              <p className="text-[13px] text-[#4A5568] py-6 text-center">
                Nenhum ato recente disponível.
              </p>
            ) : (
              <>
                <ul className="divide-y divide-[#E2E8F0]">
                  {visiveis.map(act => {
                    const s = STATUS_ROTULO[act.status]
                      || { texto: act.status, classe: 'bg-slate-100 text-slate-700 border-slate-200' };
                    return (
                      <li key={act.id}>
                        <button
                          onClick={() => onNavigate('atos')}
                          className="w-full py-3 text-left flex items-start gap-3 hover:bg-[#F0F7F0]/50 rounded-lg px-2 -mx-2 transition-colors"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14px] font-semibold text-[#1A202C]">
                              {act.tipoAto} nº {act.numero}/{act.ano}
                            </span>
                            {/* Sem `block` aqui: `line-clamp-2` já define o
                                display (`-webkit-box`), e as duas classes
                                brigam — `block` vencia e a ementa de um edital
                                ocupava doze linhas, empurrando o resto da
                                lista para fora da tela. */}
                            <span className="text-[12px] text-[#4A5568] mt-0.5 line-clamp-2 leading-relaxed">
                              {act.ementa || 'Sem ementa disponível'}
                            </span>
                          </span>
                          <span className="shrink-0 flex flex-col items-end gap-1">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.classe}`}>
                              {s.texto}
                            </span>
                            <span className="text-[12px] text-[#64748B] tabular-nums">
                              {(act.dataAssinatura || '').split('-').reverse().join('/')}
                            </span>
                            {act.orgaoEmissor && (
                              <span className="text-[12px] font-medium text-[#4A5568] uppercase">{act.orgaoEmissor}</span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {recentActs.length > PREVIA && (
                  <button
                    onClick={() => setMostrarTudo(v => !v)}
                    aria-expanded={mostrarTudo}
                    className="mt-3 w-full rounded-lg border border-[#E2E8F0] py-2 text-[12px] font-medium text-[#3182CE] hover:bg-[#F0F7F0]/50 transition-colors"
                  >
                    {mostrarTudo
                      ? 'Mostrar menos'
                      : `Ver os outros ${recentActs.length - PREVIA} atos deste boletim`}
                  </button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Resumo do acervo */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Resumo do acervo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {resumo.map(item => (
                  <div key={item.rotulo}>
                    <dd className="text-[26px] font-semibold text-[#1A3A1A] tabular-nums leading-tight">
                      {loading ? '—' : item.valor.toLocaleString('pt-BR')}
                    </dd>
                    <dt className="text-[12px] text-[#4A5568] mt-0.5">{item.rotulo}</dt>
                  </div>
                ))}
              </dl>

              <div className="border-t border-[#E2E8F0] pt-4">
                {/* O rótulo diz ANO porque o dado é anual: `stats.porAno` é o
                    que a API devolve. O mockup rotulava esta série como uma
                    janela de doze meses; a série não é isso, e o portal não
                    pode afirmar um recorte que ninguém calculou. A trava de
                    integridade reprova o rótulo errado. */}
                <p className="text-[13px] font-semibold text-[#1A202C] mb-2">Atos publicados por ano</p>
                {loading ? <Skeleton className="h-[150px]" /> : <AreaPorAno dados={serieAnos} />}
              </div>

              <button
                onClick={() => onNavigate('insights')}
                className="flex items-center gap-1 text-[12px] font-medium text-[#3182CE] hover:underline"
              >
                Ver mais dados do acervo <ChevronRight size={13} />
              </button>
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
