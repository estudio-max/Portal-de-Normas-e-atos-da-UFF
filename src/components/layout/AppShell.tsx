import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ReportarProblema } from '../ui/ReportarProblema';
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
  // A gaveta do celular. O estado mora aqui porque dois filhos precisam dele:
  // o cabeçalho, que a abre, e a própria navegação, que a desenha.
  const [menuAberto, setMenuAberto] = useState(false);

  // Trocar de aba fecha o menu. Ele já fecha ao tocar num item, mas a aba
  // também muda pela busca e pelos cartões da home — e menu aberto sobre a
  // página nova esconde justamente o que a pessoa foi buscar.
  useEffect(() => { setMenuAberto(false); }, [activePath]);

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Sidebar */}
      <Sidebar
        activePath={activePath}
        onNavigate={onNavigate}
        collapsed={isMobile}
        aberto={menuAberto}
        onFechar={() => setMenuAberto(false)}
      />

      {/* Coluna de conteúdo. O recuo compensa a sidebar, que é fixed; o TopBar
          é sticky DENTRO desta coluna, então herda a largura certa sozinho —
          não repete o recuo nem obriga o <main> a compensar altura à mão. */}
      {/* Sem recuo no celular: a trilha de ícones saiu e a tela inteira volta
          para o conteúdo — 64px de volta numa tela de 375, 17% da largura. */}
      <div className={isMobile ? '' : 'ml-56'}>
        <TopBar aoAbrirMenu={isMobile ? () => setMenuAberto(true) : undefined} apiMode={apiMode} onSearch={onSearch} onThemeToggle={onThemeToggle} fotofobia={fotofobia} portalStats={portalStats} activePath={activePath} onNavigate={onNavigate} />
        <main className="p-4 sm:p-6 min-h-screen">
          {children}
          {/* Convite de correção. Fica AQUI, e não dentro de cada painel, por
              dois motivos: cobre toda aba de dados sem repetir código, e nasce
              no fim da página — quem chegou até o rodapé já leu o que veio
              buscar. É o oposto do modal, que interrompe antes de a pessoa ver
              qualquer coisa. */}
          <ReportarProblema activePath={activePath} />
        </main>
      </div>
    </div>
  );
};
