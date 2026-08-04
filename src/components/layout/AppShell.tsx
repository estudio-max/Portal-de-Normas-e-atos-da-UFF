import React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import type { Stats } from '../../dataSource';

interface AppShellProps {
  children: React.ReactNode;
  activePath: string;
  onNavigate: (path: string) => void;
  apiMode: boolean;
  onSearch?: (query: string) => void;
  onThemeToggle: () => void;
  fotofobia: boolean;
  portalStats: Stats | null;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activePath,
  onNavigate,
  apiMode,
  onSearch,
  onThemeToggle,
  fotofobia,
  portalStats,
}) => {
  const isMobile = useMediaQuery('(max-width: 1024px)');

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Sidebar */}
      <Sidebar
        activePath={activePath}
        onNavigate={onNavigate}
        collapsed={isMobile}
      />

      {/* Coluna de conteúdo. O recuo compensa a sidebar, que é fixed; o TopBar
          é sticky DENTRO desta coluna, então herda a largura certa sozinho —
          não repete o recuo nem obriga o <main> a compensar altura à mão. */}
      <div className={isMobile ? 'ml-16' : 'ml-56'}>
        <TopBar apiMode={apiMode} onSearch={onSearch} onThemeToggle={onThemeToggle} fotofobia={fotofobia} portalStats={portalStats} activePath={activePath} onNavigate={onNavigate} />
        <main className="p-4 sm:p-6 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
};
