import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  FileSearch,
  GitBranch,
  BarChart3,
  IdCard,
  Users,
  CalendarClock,
  Timer,
  Clock,
  Landmark,
  BookMarked,
  Megaphone,
  Globe,
  Target,
  HelpCircle,
  Shield,
  Info,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  destaque?: boolean;
}

// As rotas de maior frequência. O critério é o uso previsto, não a importância
// do painel: Meu SIAPE é a aba que o servidor abre para instruir RSC, Atos e
// Normas é o núcleo da consulta, Prazos é a que se revisita. Todo o resto
// continua alcançável — por "Mais", pelos cartões de tarefa da home e pelo
// hash próprio de cada aba, que não mudou.
const NAV_PRIMARIO: NavItem[] = [
  { id: '', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'atos', label: 'Atos e Normas', icon: <FileSearch size={18} /> },
  // `destaque` só existe aqui, e de propósito: é a única aba em que a pessoa
  // procura um dado SEU. Destacar duas já dissolveria o destaque. Ver
  // `itemClasse` para o tratamento visual.
  { id: 'pessoal/siape', label: 'Meu SIAPE', icon: <IdCard size={18} />, destaque: true },
  { id: 'pessoal/prazos', label: 'Prazos', icon: <Timer size={18} /> },
];

// O que fica sob "Mais", agrupado. Os grupos sobreviveram à redução porque doze
// itens numa lista corrida não se leem: o que saiu foi a exigência de olhar
// para os doze o tempo todo, não a hierarquia entre eles.
const NAV_MAIS = [
  {
    title: 'Acompanhar',
    items: [
      { id: 'mudancas', label: 'O que mudou', icon: <Megaphone size={18} /> },
      { id: 'relacoes', label: 'Mapa de Relações', icon: <GitBranch size={18} /> },
      { id: 'insights', label: 'Insights', icon: <BarChart3 size={18} /> },
    ],
  },
  {
    title: 'Institucional',
    items: [
      { id: 'institucional/comissoes', label: 'Comissões', icon: <Landmark size={18} /> },
      { id: 'institucional/politicas', label: 'Políticas', icon: <BookMarked size={18} /> },
      { id: 'institucional/cooperacao', label: 'Cooperação', icon: <Globe size={18} /> },
      { id: 'institucional/ods', label: 'ODS', icon: <Target size={18} /> },
    ],
  },
  {
    title: 'Pessoal',
    items: [
      { id: 'pessoal/chefias', label: 'Chefias', icon: <Users size={18} /> },
      { id: 'pessoal/mandatos', label: 'Mandatos', icon: <CalendarClock size={18} /> },
      { id: 'pessoal/jornada', label: 'Jornada', icon: <Clock size={18} /> },
    ],
  },
];

const FOOTER_ITEMS: NavItem[] = [
  { id: 'ajuda', label: 'Ajuda', icon: <HelpCircle size={18} /> },
  { id: 'privacidade', label: 'Privacidade', icon: <Shield size={18} /> },
  { id: 'sobre', label: 'Sobre', icon: <Info size={18} /> },
];

const ITENS_MAIS: NavItem[] = NAV_MAIS.flatMap(grupo => grupo.items);

// A trilha compacta (rail de 64 px) NÃO esconde nada atrás de disclosure: ali
// não há rótulo para ler, então um "Mais" fechado seria um beco sem saída. Ela
// lista TODO destino — as primárias, as de "Mais" e as do rodapé —, que é o que
// a trava de integridade exige e o motivo pelo qual ela existe.
const compactItems: NavItem[] = [...NAV_PRIMARIO, ...ITENS_MAIS, ...FOOTER_ITEMS];

interface SidebarProps {
  activePath: string;
  onNavigate: (path: string) => void;
  collapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePath, onNavigate, collapsed = false }) => {
  const isActive = (id: string) => {
    if (id === '' && activePath === '') return true;
    return activePath.startsWith(id) && id !== '';
  };

  const ativaEmMais = ITENS_MAIS.some(item => isActive(item.id));
  const [maisAberto, setMaisAberto] = useState(ativaEmMais);

  // Abrir sozinho quando a aba corrente mora sob "Mais" — chegar em Comissões
  // por link ou pelo cartão de tarefa e ver a navegação sem NADA selecionado é
  // perder a própria posição. Só abre; nunca fecha por conta própria, senão
  // fecharia na cara de quem acabou de abrir para procurar outra coisa.
  useEffect(() => {
    if (ativaEmMais) setMaisAberto(true);
  }, [ativaEmMais]);

  // Classe do item de navegação. O item em `destaque` continua sendo um item da
  // lista — não vira botão de ação: ele ganha peso (fundo, borda e ícone na cor
  // institucional) sem sair da hierarquia da seção, senão a coluna passa a ter
  // dois níveis de "ativo" e o estado real de navegação fica ambíguo.
  //
  // As cores saem de `--destaque-*`, definidas nos DOIS temas no index.css. Não
  // use `text-[#006400]` aqui: esse hex não está na lista de conversão do modo
  // fotofobia, então ficaria verde-escuro sobre fundo escuro.
  const itemClasse = (item: { id: string; destaque?: boolean }) => {
    const ativo = isActive(item.id);
    if (ativo) return 'bg-[#F0F7F0] text-[#1A3A1A] font-medium';
    if (item.destaque) return 'nav-destaque font-semibold';
    return 'text-[#4A5568] hover:bg-gray-50';
  };

  // Altura de toque de 40 px: o alvo anterior media 34 px, abaixo do mínimo
  // confortável, e a proposta pede área clicável ampla.
  const linhaBase =
    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-colors text-left';

  if (collapsed) {
    return (
      <aside className="w-16 h-screen bg-white border-r border-[#E2E8F0] flex flex-col items-center py-4 fixed left-0 top-0 z-40 overflow-y-auto">
        <div className="w-10 h-10 bg-[#006400] rounded-lg flex items-center justify-center mb-6 shrink-0">
          <span className="text-white font-bold text-sm">U</span>
        </div>
        <nav className="flex-1 flex flex-col gap-1 w-full px-2" aria-label="Navegação principal">
          {compactItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={isActive(item.id) ? 'page' : undefined}
              className={cn(
                'w-10 h-10 shrink-0 rounded-lg flex items-center justify-center transition-colors',
                isActive(item.id)
                  ? 'bg-[#F0F7F0] text-[#1A3A1A]'
                  : item.destaque
                    ? 'nav-destaque'
                    : 'text-[#64748B] hover:bg-gray-50 hover:text-[#4A5568]'
              )}
              title={item.label}
              aria-label={item.label}
            >
              {item.icon}
            </button>
          ))}
        </nav>
      </aside>
    );
  }

  return (
    <aside className="w-56 h-screen bg-white border-r border-[#E2E8F0] flex flex-col fixed left-0 top-0 z-40 overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-[#006400] rounded-lg flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">U</span>
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[#1A202C] leading-tight truncate">Inteligência UFF</p>
          <p className="text-[12px] text-[#64748B] leading-tight truncate">Universidade Federal Fluminense</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-2" aria-label="Navegação principal">
        <div className="space-y-0.5">
          {NAV_PRIMARIO.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={isActive(item.id) ? 'page' : undefined}
              className={cn(linhaBase, itemClasse(item))}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>

        {/* "Mais" é disclosure, não submenu que voa: o painel abre NA COLUNA,
            empurrando o rodapé, então não some ao mover o mouse e não disputa
            camada com o cabeçalho sticky. */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setMaisAberto(aberto => !aberto)}
            aria-expanded={maisAberto}
            aria-controls="nav-mais"
            className={cn(
              linhaBase,
              'text-[#4A5568] hover:bg-gray-50',
              ativaEmMais && !maisAberto && 'font-medium'
            )}
          >
            <MoreHorizontal size={18} />
            <span className="truncate flex-1">Mais</span>
            <ChevronDown
              size={14}
              className={cn('shrink-0 transition-transform', maisAberto && 'rotate-180')}
              aria-hidden="true"
            />
          </button>

          {maisAberto && (
            <div id="nav-mais" className="mt-1 space-y-4">
              {NAV_MAIS.map(grupo => (
                <div key={grupo.title}>
                  <p className="px-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">
                    {grupo.title}
                  </p>
                  <div className="space-y-0.5">
                    {grupo.items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => onNavigate(item.id)}
                        aria-current={isActive(item.id) ? 'page' : undefined}
                        className={cn(linhaBase, itemClasse(item))}
                      >
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-[#E2E8F0] space-y-0.5">
        {FOOTER_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            aria-current={isActive(item.id) ? 'page' : undefined}
            className={cn(
              linhaBase,
              isActive(item.id)
                ? 'bg-[#F0F7F0] texto-marca font-medium'
                : 'text-[#64748B] hover:bg-gray-50 hover:text-[#4A5568]'
            )}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
};
