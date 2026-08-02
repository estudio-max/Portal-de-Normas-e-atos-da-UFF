import React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface AppShellProps {
  children: React.ReactNode;
  activePath: string;
  onNavigate: (path: string) => void;
  apiMode: boolean;
  onSearch?: (query: string) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activePath,
  onNavigate,
  apiMode,
  onSearch,
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
        <TopBar apiMode={apiMode} onSearch={onSearch} />
        <main className="pt-16 p-6 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
};
