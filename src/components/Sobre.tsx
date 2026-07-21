import React from 'react';
import { Sparkles, Lightbulb, Code2, Info, Github, BarChart3 } from 'lucide-react';

function Secao({ icon, titulo, children }: { icon: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold text-[#003366] mb-2">
        <span className="p-1 bg-yellow-50 text-yellow-600 rounded">{icon}</span>
        {titulo}
      </h3>
      <div className="text-[13px] text-slate-700 leading-relaxed space-y-2">{children}</div>
    </div>
  );
}

/** Figura explicativa. Os SVG ficam em public/figuras/ e não no bundle: são
 *  48 KB que só fazem sentido nesta aba, e como arquivo estático o navegador
 *  os busca uma vez e guarda em cache.
 *
 *  `alt` não é decorativo aqui — descreve o conteúdo do diagrama, porque é o
 *  que um leitor de tela vai anunciar no lugar da figura. Diagrama sem alt
 *  descritivo é conteúdo que só existe para quem enxerga.
 *
 *  Sobre o modo escuro: o `filter: invert(1)` do index.css é aplicado na
 *  página inteira e alcança estas imagens também. Funciona porque os SVG são
 *  vetor chapado na mesma paleta da interface — invertem junto com o resto,
 *  como se fossem parte do layout. Não vale para foto: se algum dia entrar
 *  uma, ela vai precisar de `filter: invert(1)` próprio para cancelar o da
 *  página. */
function Figura({ arquivo, alt, legenda }: { arquivo: string; alt: string; legenda: string }) {
  return (
    <figure className="pt-1">
      <img
        src={`figuras/${arquivo}`}
        alt={alt}
        loading="lazy"
        className="w-full h-auto rounded-md border border-slate-200 bg-white"
      />
      <figcaption className="text-[11px] text-slate-500 pt-1.5 leading-relaxed">{legenda}</figcaption>
    </figure>
  );
}

export default function Sobre() {
  return (
    <div className="space-y-3 max-w-4xl mx-auto">
      <div className="bg-[#003366] text-white rounded-lg p-5">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Info className="w-5 h-5 text-yellow-400" /> Sobre este projeto
        </h2>
        <p className="text-[13px] text-blue-100 mt-1 leading-relaxed">
          O Portal de Normas e Atos da UFF foi idealizado por João Fanara e é mantido pelo Nidi
          (Núcleo Institucional de Dados Integrados), vinculado ao Gabinete do Reitor da UFF. Esta
          página conta a motivação e como o projeto foi feito.
        </p>
      </div>

      <Secao icon={<Lightbulb className="w-4 h-4" />} titulo="Por que este portal existe">
        <p>
          O Boletim de Serviço da UFF é publicado desde 2001 em PDF, um arquivo por edição, sem
          versão estruturada. Consultar esse acervo significava abrir boletim por boletim — mais de
          quatro mil arquivos — e procurar à mão.
        </p>
        <p>
          A necessidade ficou concreta com o RSC (Reconhecimento de Saberes e Competências, Decreto
          13.048/2026): para pleitear, muitos servidores passaram a procurar seus próprios registros
          no Boletim — designações, participações em comissões, portarias antigas. Folhear décadas
          de PDF atrás disso não é razoável, e o portal ajuda exatamente nesse ponto.
        </p>
        <Figura
          arquivo="7-abas-do-portal.svg"
          alt="Grade com os dez painéis do portal e uma linha explicando o que cada um faz: Planilha, Relações, Chefias, Meu SIAPE, Insights, Mandatos, Prazos, Jornada, Cooperação e Analisar Ato."
          legenda="Cada aba responde uma pergunta diferente sobre o mesmo acervo."
        />
        <p>
          A ideia em si é antiga: nasceu da minha experiência com a primeira versão do Portal de
          Normas do BNDES, lá no começo dos anos 2000. A diferença é que o BNDES tinha um setor
          que centralizava a gestão das suas
          normas, e a UFF nunca teve — sem um órgão para gerir o conteúdo, um sistema assim não se
          sustentava. Só as ferramentas de IA atuais tornaram viável ler milhares de PDFs (vários
          deles fruto de digitalização e OCR de qualidade irregular) com precisão aceitável para
          virar uma ferramenta de consulta.
        </p>
      </Secao>

      <Secao icon={<Code2 className="w-4 h-4" />} titulo="Como foi construído">
        <p>
          O portal é mantido pelo Nidi (Núcleo Institucional de Dados Integrados), vinculado ao
          Gabinete do Reitor da UFF.
        </p>
        <p>
          A extração dos atos publicados nos boletins, a modelagem do banco de dados e boa parte do
          código do site foram feitos com o Claude, o assistente de IA da Anthropic, no que se
          costuma chamar de "vibe coding": conduzir o desenvolvimento em conversa com a IA, testando
          e corrigindo o resultado a cada passo, em vez de escrever cada linha manualmente. Não faz
          sentido esconder isso — foi assim que o projeto foi construído, e é isso que tornou viável
          um trabalho desse tamanho fora de uma equipe grande.
        </p>
        <p>
          O código-fonte é aberto:{' '}
          <a
            href="https://github.com/estudio-max/Portal-de-Normas-e-atos-da-UFF"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-700 underline font-semibold"
          >
            <Github className="w-3.5 h-3.5" /> repositório no GitHub
          </a>{' '}
          — inclui a documentação técnica do extrator dos boletins e da arquitetura do banco de
          dados.
        </p>
        <p>
          A raspagem de 25 anos de PDF não foi trivial: o formato do boletim mudou várias vezes
          nesse período, sem aviso, e 2001 é digitalizado com uma qualidade de OCR ruim o
          suficiente para destruir números e datas. Os desafios encontrados — e como cada um foi
          resolvido — estão documentados no{' '}
          <a
            href="https://github.com/estudio-max/Portal-de-Normas-e-atos-da-UFF/blob/main/docs/GUIA-EXTRACAO-BS.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 underline font-semibold"
          >
            guia de extração do Boletim de Serviço
          </a>.
        </p>
        <Figura
          arquivo="2-jornada-do-ato.svg"
          alt="Fluxo em cinco etapas: a UFF publica o Boletim em PDF, um robô baixa todo dia às 19h10, o texto é recortado em atos, os atos vão para a base com 133 mil registros, e o usuário pesquisa."
          legenda="A etapa do meio é a difícil: o PDF não marca onde um ato termina e o outro começa."
        />
        <Figura
          arquivo="3-anatomia-do-ato.svg"
          alt="Uma folha de documento com cinco chamadas indicando os campos que o portal separa: tipo, número e ano, órgão, ementa e processo SEI."
          legenda="Os campos extraídos de cada ato. Boletim antigo, digitalizado, costuma ter menos."
        />
      </Secao>

      <Secao icon={<BarChart3 className="w-4 h-4" />} titulo="Números do projeto">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 not-italic">
          <div>
            <dt className="text-[11px] text-slate-400 uppercase tracking-wide">Início</dt>
            <dd className="font-bold text-[#003366]">25/06/2026</dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-400 uppercase tracking-wide">Cobertura</dt>
            <dd className="font-bold text-[#003366]">2001–2026 (26 anos)</dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-400 uppercase tracking-wide">Atos indexados</dt>
            <dd className="font-bold text-[#003366]">133.106</dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-400 uppercase tracking-wide">Boletins lidos</dt>
            <dd className="font-bold text-[#003366]">4.921</dd>
          </div>
        </dl>
        <p className="pt-2">
          Extração dos boletins em Python (com OCR via Tesseract nos PDFs digitalizados); banco de
          dados MySQL; backend em PHP; frontend em React e TypeScript.
        </p>
        <Figura
          arquivo="5-mapa-cooperacao.svg"
          alt="Mapa-múndi com círculos proporcionais marcando os países com acordos de cooperação da UFF, e ao lado o ranking dos oito maiores: França 89, Portugal 86, Espanha 67, Itália 47, Alemanha 38, Colômbia 37, Argentina 35 e Estados Unidos 25."
          legenda="1.467 acordos de cooperação em 59 países, extraídos dos atos. São acordos aprovados por ato do Boletim, não necessariamente parcerias ativas hoje: o Boletim não registra o encerramento de um convênio."
        />
      </Secao>

      <Secao icon={<Sparkles className="w-4 h-4" />} titulo="O que este portal é (e o que não é)">
        <p>
          O Portal de Normas e Atos da UFF é uma camada de consulta sobre um acervo público: os
          Boletins de Serviço que a própria universidade já publica oficialmente. Ele não substitui
          o boletim nem cria informação nova. É mantido pelo Nidi, vinculado ao Gabinete do Reitor,
          para facilitar o acesso a algo que já era público, mas difícil de encontrar.
        </p>
        <p>
          Vale registrar: qualquer pessoa poderia ter feito um sistema assim. Os boletins são
          documentos públicos, e o portal não acessa nada que já não estivesse disponível — só
          organiza, num só lugar, o que estava espalhado em milhares de páginas de PDF.
        </p>
        <p>
          O que ele acrescenta é a ligação entre os atos. Um ato não anuncia a própria revogação:
          ela é publicada anos depois, num outro ato, que você não tem como saber que existe. Ler o
          PDF original responde o que aquele documento diz, não se ele ainda vale.
        </p>
        <Figura
          arquivo="4-teia-de-relacoes.svg"
          alt="Cinco atos numa linha do tempo. Dois atos alteram o ato de 2015 e um o revoga em 2024, deixando-o marcado como revogado. Legenda: verde é vigente, amarelo é alterado, vermelho é revogado."
          legenda="É a pergunta que o acervo em PDF não responde e o índice responde."
        />
      </Secao>

      <p className="text-[11px] text-slate-400 text-center pt-2">
        Dúvidas ou sugestões sobre o projeto: <a href="mailto:nidi.gar@id.uff.br" className="underline">nidi.gar@id.uff.br</a>.
      </p>
    </div>
  );
}
