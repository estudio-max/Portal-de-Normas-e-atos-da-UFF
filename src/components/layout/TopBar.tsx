import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Wifi, WifiOff, Moon, Sun, ExternalLink, FileText, HelpCircle, Menu } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '../../lib/utils';
import { ajudaDaAba } from '../help/ajudaConteudo';
import { rotuloDaAba } from './Sidebar';
import { AjudaModal } from '../help/AjudaModal';
import type { Stats } from '../../dataSource';

interface TopBarProps {
  apiMode: boolean;
  onSearch?: (query: string) => void;
  onThemeToggle: () => void;
  fotofobia: boolean;
  portalStats: Stats | null;
  /** A aba aberta agora — a ajuda do "?" é a dela. */
  activePath: string;
  onNavigate: (path: string) => void;
  /** Só no celular: abre a gaveta de navegação. Ausente no desktop, onde a
   *  coluna com os nomes já está permanentemente à vista. */
  aoAbrirMenu?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ apiMode, onSearch, onThemeToggle, fotofobia, portalStats, activePath, onNavigate, aoAbrirMenu }) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);
  const ajuda = ajudaDaAba(activePath);

  // Trocar de aba com o modal aberto deixaria na tela a explicação da aba
  // anterior — ajuda descrevendo outra página é pior que ajuda nenhuma.
  useEffect(() => { setAjudaAberta(false); }, [activePath]);

  // O callback fica numa ref para NÃO entrar nas dependências do efeito abaixo.
  // Com ele na lista, um pai que passe função inline redispara a busca a cada
  // render — e como a busca navega, o portal ficava preso na aba de atos.
  const onSearchRef = useRef(onSearch);
  useEffect(() => { onSearchRef.current = onSearch; }, [onSearch]);

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

  // Só o termo dispara a busca. Ver a ref acima.
  useEffect(() => {
    onSearchRef.current?.(debouncedQuery);
  }, [debouncedQuery]);

  return (
    // sticky, não fixed: o cabeçalho mora DENTRO da coluna de conteúdo, então
    // acompanha a largura da coluna sozinho e cresce sem cobrir o conteúdo. Na
    // versão fixed ele repetia o recuo da sidebar à mão e o <main> compensava a
    // altura com um padding chutado: a 320 px o conteúdo do cabeçalho media
    // 371 px numa caixa de 256 px e o botão de modo escuro simplesmente ficava
    // fora da tela, sem rolagem que o alcançasse.
    <header className="sticky top-0 z-30 bg-white border-b border-[#E2E8F0] px-4 py-2">
      {/* ONDE VOCÊ ESTÁ, escrito. No celular a coluna de navegação não fica à
          vista, então o nome da aba precisa estar no cabeçalho: sem ele, as
          abas de dados se parecem entre si na primeira dobra e a pessoa só
          descobre onde caiu depois de ler o conteúdo. */}
      {aoAbrirMenu && (
        <div className="mb-2 flex items-center gap-2">
          <button type="button" onClick={aoAbrirMenu}
            aria-label="Abrir o menu de navegação" aria-haspopup="dialog"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E2E8F0] text-[#4A5568]">
            <Menu size={20} />
          </button>
          <p className="min-w-0 flex-1 truncate text-[15px] font-bold text-[#1A202C]">
            {rotuloDaAba(activePath)}
          </p>
        </div>
      )}
      <div className="flex items-center gap-2 sm:gap-3">
      <div className="flex-1 min-w-0 max-w-xl relative">
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl border transition-all',
            isFocused
              ? 'border-[#006400] bg-[#F0F7F0]/50 shadow-sm'
              : 'border-[#E2E8F0] bg-[#F7FAFC]'
          )}
        >
          <Search size={16} className={isFocused ? 'texto-marca' : 'text-[#64748B]'} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder="Buscar por número, ementa, processo SEI, nome ou SIAPE..."
            className="flex-1 bg-transparent text-sm text-[#1A202C] placeholder:text-[#64748B] outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="text-[#64748B] hover:text-[#1A202C]">
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-mono text-[#64748B] bg-[#E2E8F0] rounded">
            ⌘K
          </kbd>
        </div>

      </div>

      <div className="hidden lg:flex items-center gap-2">
        <a href="https://boletimdeservico.uff.br/boletins/bs-2026/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#003366] px-3 py-2 text-xs font-semibold text-white hover:bg-[#004d00]">
          <FileText size={15} /> Boletim de Serviço 2026 <ExternalLink size={13} />
        </a>
        <a href="https://sei.uff.br/sei/modulos/pesquisa/md_pesq_processo_pesquisar.php?acao_externa=protocolo_pesquisar&acao_origem_externa=protocolo_pesquisar&id_orgao_acesso_externo=0" target="_blank" rel="noreferrer" className="botao-marca inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold">
          Pesquisa Pública SEI <ExternalLink size={13} />
        </a>
      </div>

      {/* Ajuda e Acessibilidade levam à MESMA aba, e de propósito: as duas são
          seções do guia. Um link "Acessibilidade" que não abre nada seria pior
          que a ausência dele — é o tipo de promessa que ensina a desconfiar do
          resto da interface. */}
      <div className="hidden md:flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onNavigate('ajuda')}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#4A5568] hover:bg-gray-100 hover:text-[#1A202C]"
        >
          Ajuda
        </button>
        <button
          type="button"
          onClick={() => onNavigate('ajuda')}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#4A5568] hover:bg-gray-100 hover:text-[#1A202C]"
        >
          Acessibilidade
        </button>
      </div>

      {/* Estado da API. Em tela estreita fica só o ponto + ícone; o rótulo sai
          para caber, mas o title/aria mantêm a informação legível. */}
      <div className="flex shrink-0 items-center gap-1.5 text-xs"
        title={apiMode ? 'Portal online (consultando o banco)' : 'Portal offline (índice estático de contingência)'}>
        <span className={cn('w-2 h-2 rounded-full', apiMode ? 'bg-[#38A169]' : 'bg-[#D69E2E]')} />
        <span className={cn('hidden sm:inline font-medium', apiMode ? 'text-[#38A169]' : 'text-[#D69E2E]')}>
          {apiMode ? 'Online' : 'Offline'}
        </span>
        {apiMode
          ? <Wifi size={14} className="text-[#38A169]" aria-label="Portal online" />
          : <WifiOff size={14} className="text-[#D69E2E]" aria-label="Portal offline" />}
      </div>

      {/* Ajuda da aba atual. Fica ao lado do controle de tema, no canto onde já
          moram os comandos da página — e some quando a aba não tem entrada no
          mapa, em vez de abrir um modal vazio. */}
      {ajuda && (
        <button type="button" onClick={() => setAjudaAberta(true)}
          aria-label={`Ajuda sobre ${ajuda.titulo}`} aria-haspopup="dialog"
          title={`O que é e como usar: ${ajuda.titulo}`}
          className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-[#003366] bg-[#F0F7F0] hover:bg-[#006400] hover:text-white transition-colors">
          <HelpCircle size={16} />
        </button>
      )}

      <button type="button" onClick={onThemeToggle} aria-pressed={fotofobia}
        aria-label={fotofobia ? 'Desativar modo escuro' : 'Ativar modo escuro'}
        title={fotofobia ? 'Desativar modo escuro' : 'Ativar modo escuro'}
        className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-[#4A5568] hover:bg-gray-100 transition-colors">
        {fotofobia ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* Selo institucional — decorativo, primeiro a sair quando falta espaço. */}
      <div className="hidden sm:flex w-8 h-8 shrink-0 rounded-full bg-[#006400] items-center justify-center text-white text-xs font-semibold">
        UFF
      </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[#E2E8F0] pt-2 text-xs text-[#4A5568]">
        {/* A bolinha vira âmbar quando a atualização automática para, mas a cor
            NUNCA é o único sinal: o aviso escrito ao lado é que carrega o
            recado (daltonismo, tela ruim, modo fotofobia). */}
        {/* Hex literal, NÃO `bg-amber-500`: as regras da fotofobia casam por
            SUBSTRING (`[class*="bg-amber-50"]`), e "bg-amber-500" contém
            "bg-amber-50" — a bolinha herdava o fundo marrom de aviso (#372f1c)
            e sumia no escuro. Medido, não deduzido. O verde ao lado usa hex
            pelo mesmo motivo. */}
        <span className={`h-2 w-2 shrink-0 rounded-full ${portalStats?.extracaoAtrasada ? 'bg-[#D97706]' : 'bg-[#38A169]'}`} />
        {portalStats?.ultimaAtualizacao ? <>Atualização mais recente em <strong>{portalStats.ultimaAtualizacao.slice(0, 10).split('-').reverse().join('/')}</strong></> : 'Atualização mais recente indisponível'}
        {portalStats?.extracaoAtrasada && (
          <span role="status" className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">
            ⚠ Atualização automática parada — pode faltar ato recente
          </span>
        )}
        {portalStats?.ultimoBoletim && <><span>·</span>{portalStats.ultimoBoletim.link ? <a className="font-semibold underline" href={portalStats.ultimoBoletim.link} target="_blank" rel="noreferrer">BS nº {portalStats.ultimoBoletim.numero}/{portalStats.ultimoBoletim.ano} (PDF)</a> : <strong>BS nº {portalStats.ultimoBoletim.numero}/{portalStats.ultimoBoletim.ano}</strong>}</>}
      </div>

      {ajuda && (
        <AjudaModal
          aberto={ajudaAberta}
          aba={ajuda}
          onFechar={() => setAjudaAberta(false)}
          onIrParaGuia={() => { setAjudaAberta(false); onNavigate('ajuda'); }}
        />
      )}
    </header>
  );
};
