import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

// Injeta no <head> do index.html gerado o conteúdo de `head.local.html`, um
// arquivo que NÃO vai para o repositório (está no .gitignore).
//
// Existe por causa de uma armadilha concreta: o Google Analytics foi colado à
// mão no index.html DO SERVIDOR, e o `index.html` faz parte de todo pacote de
// deploy (ele muda a cada build, porque carrega o hash dos assets). Ou seja, o
// próximo upload apagaria o gtag sem avisar, e o rastreamento morreria em
// silêncio — o pior tipo de defeito, porque só se descobre semanas depois,
// olhando um relatório vazio.
//
// Com isto o trecho volta a entrar no build automaticamente, sem nunca ser
// versionado. Se o arquivo não existir (outra máquina, CI, clone novo), o build
// segue normalmente e o HTML sai limpo — nada quebra.
function injetarHeadLocal(): Plugin {
  const arquivo = path.resolve(__dirname, 'head.local.html');
  return {
    name: 'injetar-head-local',
    apply: 'build',
    transformIndexHtml(html) {
      if (!fs.existsSync(arquivo)) return html;
      const trecho = fs.readFileSync(arquivo, 'utf-8').trim();
      if (!trecho) return html;
      return html.replace('</head>', `${trecho}\n  </head>`);
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), injetarHeadLocal()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // DISABLE_HMR=true desliga o hot-reload e o file watching juntos. Serve
      // para editar em lote sem o Vite recarregando a cada gravacao e sem
      // gastar CPU vigiando arquivos. Fora disso, deixe ligado.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
