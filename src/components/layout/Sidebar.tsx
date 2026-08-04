import React from 'react';
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
  Globe,
  Target,
  HelpCircle,
  Shield,
  Info,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  section?: string;
}

const NAV_SECTIONS = [
  {
    title: 'Navegar',
    items: [
      { id: '', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
      { id: 'atos', label: 'Atos e Normas', icon: <FileSearch size={18} /> },
      { id: 'relacoes', label: 'Mapa de Relações', icon: <GitBranch size={18} /> },
      { id: 'insights', label: 'Insights', icon: <BarChart3 size={18} /> },
    ],
  },
  {
    title: 'Pessoal',
    items: [
      { id: 'pessoal/siape', label: 'Meu SIAPE', icon: <IdCard size={18} /> },
      { id: 'pessoal/chefias', label: 'Chefias', icon: <Users size={18} /> },
      { id: 'pessoal/mandatos', label: 'Mandatos', icon: <CalendarClock size={18} /> },
      { id: 'pessoal/prazos', label: 'Prazos', icon: <Timer size={18} /> },
      { id: 'pessoal/jornada', label: 'Jornada', icon: <Clock size={18} /> },
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
];

const FOOTER_ITEMS = [
  { id: 'ajuda', label: 'Ajuda', icon: <HelpCircle size={18} /> },
  { id: 'privacidade', label: 'Privacidade', icon: <Shield size={18} /> },
  { id: 'sobre', label: 'Sobre', icon: <Info size={18} /> },
];

const compactItems = [...NAV_SECTIONS.flatMap(section => section.items), ...FOOTER_ITEMS];

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

  if (collapsed) {
    return (
      <aside className="w-16 h-screen bg-white border-r border-[#E2E8F0] flex flex-col items-center py-4 fixed left-0 top-0 z-40">
        <div className="w-10 h-10 bg-[#006400] rounded-lg flex items-center justify-center mb-6">
          <span className="text-white font-bold text-sm">U</span>
        </div>
        <nav className="flex-1 flex flex-col gap-1 w-full px-2">
          {compactItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                isActive(item.id)
                  ? 'bg-[#F0F7F0] text-[#006400]'
                  : 'text-[#A0AEC0] hover:bg-gray-50 hover:text-[#4A5568]'
              )}
              title={item.label}
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
          <p className="text-[13px] font-semibold text-[#1A202C] leading-tight truncate">Portal de Normas</p>
          <p className="text-[11px] text-[#A0AEC0] leading-tight truncate">Universidade Federal Fluminense</p>
        </div>
      </div>

      {/* Nav Sections */}
      <nav className="flex-1 px-3 py-2 space-y-5">
        {NAV_SECTIONS.map(section => (
          <div key={section.title}>
            <p className="px-3 text-[10px] font-semibold text-[#A0AEC0] uppercase tracking-wider mb-1">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors text-left',
                    isActive(item.id)
                      ? 'bg-[#F0F7F0] text-[#006400] font-medium'
                      : 'text-[#4A5568] hover:bg-gray-50'
                  )}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-[#E2E8F0] space-y-0.5">
        {FOOTER_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors text-left',
              isActive(item.id)
                ? 'bg-[#F0F7F0] text-[#006400] font-medium'
                : 'text-[#A0AEC0] hover:bg-gray-50 hover:text-[#4A5568]'
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
