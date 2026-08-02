import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Wifi, WifiOff, Moon, Sun, ExternalLink, FileText } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '../../lib/utils';
import type { Stats } from '../../dataSource';

interface TopBarProps {
  apiMode: boolean;
  compact: boolean;
  onSearch?: (query: string) => void;
  onThemeToggle: () => void;
  fotofobia: boolean;
  portalStats: Stats | null;
}

export const TopBar: React.FC<TopBarProps> = ({ apiMode, compact, onSearch, onThemeToggle, fotofobia, portalStats }) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    onSearch?.(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  return (
    <header className={cn(
      'min-h-28 bg-white border-b border-[#E2E8F0] px-4 py-2 fixed top-0 right-0 z-30',
      compact ? 'left-16' : 'left-56'
    )}>
      <div className="flex items-center gap-3">
      <div className="flex-1 max-w-xl relative">
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all',
            isFocused
              ? 'border-[#006400] bg-[#F0F7F0]/50 shadow-sm'
              : 'border-[#E2E8F0] bg-[#F7FAFC]'
          )}
        >
          <Search size={16} className={isFocused ? 'text-[#006400]' : 'text-[#A0AEC0]'} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder="Buscar por número, ementa, processo SEI, nome ou SIAPE..."
            className="flex-1 bg-transparent text-sm text-[#1A202C] placeholder:text-[#A0AEC0] outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="text-[#A0AEC0] hover:text-[#1A202C]">
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono text-[#A0AEC0] bg-[#E2E8F0] rounded">
            ⌘K
          </kbd>
        </div>

        {/* Search dropdown */}
        {isFocused && query.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-[#E2E8F0] shadow-lg z-50 py-2">
            <div className="px-3 py-1.5 text-xs text-[#A0AEC0] uppercase tracking-wider">Buscando...</div>
            {/* Resultados seriam preenchidos pelo dataSource */}
          </div>
        )}
      </div>

      <div className="hidden lg:flex items-center gap-2">
        <a href="https://boletimdeservico.uff.br/boletins/bs-2026/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#003366] px-3 py-2 text-xs font-semibold text-white hover:bg-[#004d00]">
          <FileText size={15} /> Boletim de Serviço 2026 <ExternalLink size={13} />
        </a>
        <a href="https://sei.uff.br/sei/modulos/pesquisa/md_pesq_processo_pesquisar.php?acao_externa=protocolo_pesquisar&acao_origem_externa=protocolo_pesquisar&id_orgao_acesso_externo=0" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-[#006400] px-3 py-2 text-xs font-semibold text-[#006400] hover:bg-[#F0F7F0]">
          Pesquisa Pública SEI <ExternalLink size={13} />
        </a>
      </div>

      {/* API Status */}
      <div className="flex items-center gap-2 text-xs">
        <span className={cn('w-2 h-2 rounded-full', apiMode ? 'bg-[#38A169]' : 'bg-[#D69E2E]')} />
        <span className={apiMode ? 'text-[#38A169] font-medium' : 'text-[#D69E2E] font-medium'}>
          {apiMode ? 'Online' : 'Offline'}
        </span>
        {apiMode ? <Wifi size={14} className="text-[#38A169]" /> : <WifiOff size={14} className="text-[#D69E2E]" />}
      </div>

      <button type="button" onClick={onThemeToggle} aria-pressed={fotofobia}
        aria-label={fotofobia ? 'Desativar modo escuro' : 'Ativar modo escuro'}
        title={fotofobia ? 'Desativar modo escuro' : 'Ativar modo escuro'}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[#4A5568] hover:bg-gray-100 transition-colors">
        {fotofobia ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* User avatar */}
      <div className="w-8 h-8 rounded-full bg-[#006400] flex items-center justify-center text-white text-xs font-semibold">
        UFF
      </div>
      </div>
      <div className="mt-2 flex items-center gap-2 border-t border-[#E2E8F0] pt-2 text-xs text-[#4A5568]">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[#38A169]" />
        {portalStats?.ultimaAtualizacao ? <>Atualização mais recente em <strong>{portalStats.ultimaAtualizacao.slice(0, 10).split('-').reverse().join('/')}</strong></> : 'Atualização mais recente indisponível'}
        {portalStats?.ultimoBoletim && <><span>·</span>{portalStats.ultimoBoletim.link ? <a className="font-semibold underline" href={portalStats.ultimoBoletim.link} target="_blank" rel="noreferrer">BS nº {portalStats.ultimoBoletim.numero}/{portalStats.ultimoBoletim.ano} (PDF)</a> : <strong>BS nº {portalStats.ultimoBoletim.numero}/{portalStats.ultimoBoletim.ano}</strong>}</>}
      </div>
    </header>
  );
};
