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

      {/* Main content area */}
      <div className={isMobile ? 'ml-16' : 'ml-56'}>
        <TopBar apiMode={apiMode} compact={isMobile} onSearch={onSearch} onThemeToggle={onThemeToggle} fotofobia={fotofobia} portalStats={portalStats} />
        <main className="pt-32 p-6 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
};
