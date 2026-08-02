import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Wifi, WifiOff, Moon, Sun } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '../../lib/utils';

interface TopBarProps {
  apiMode: boolean;
  onSearch?: (query: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ apiMode, onSearch }) => {
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
    if (debouncedQuery.length >= 2 && onSearch) {
      onSearch(debouncedQuery);
    }
  }, [debouncedQuery, onSearch]);

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center px-6 gap-4 fixed top-0 right-0 left-56 z-30">
      {/* Global Search */}
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

      {/* Spacer */}
      <div className="flex-1" />

      {/* API Status */}
      <div className="flex items-center gap-2 text-xs">
        <span className={cn('w-2 h-2 rounded-full', apiMode ? 'bg-[#38A169]' : 'bg-[#D69E2E]')} />
        <span className={apiMode ? 'text-[#38A169] font-medium' : 'text-[#D69E2E] font-medium'}>
          {apiMode ? 'Online' : 'Offline'}
        </span>
        {apiMode ? <Wifi size={14} className="text-[#38A169]" /> : <WifiOff size={14} className="text-[#D69E2E]" />}
      </div>

      {/* Theme toggle (placeholder) */}
      <button className="w-8 h-8 rounded-lg flex items-center justify-center text-[#A0AEC0] hover:bg-gray-50 hover:text-[#4A5568] transition-colors">
        <Moon size={16} />
      </button>

      {/* User avatar */}
      <div className="w-8 h-8 rounded-full bg-[#006400] flex items-center justify-center text-white text-xs font-semibold">
        UFF
      </div>
    </header>
  );
};
