import { useState, useEffect } from 'react';

export function useMediaQuery(query: string): boolean {
  // Estado inicial lido do próprio matchMedia. Começando em `false`, o primeiro
  // render de um celular desenhava a sidebar larga e só depois colapsava — um
  // quadro de layout errado a cada carga.
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
