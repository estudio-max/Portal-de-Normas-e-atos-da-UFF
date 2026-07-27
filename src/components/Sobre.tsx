import React from 'react';
import { Sparkles, Lightbulb, Code2, Info, Github, BarChart3, Eye, Target } from 'lucide-react';

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
function Figura({ arquivo, alt, legenda, w, h }: {
  arquivo: string; alt: string; legenda: string; w: number; h: number;
}) {
  return (
    <figure className="pt-1">
      {/* `width`/`height` são o viewBox do SVG. Sem eles a imagem não tem
          tamanho intrínseco e a caixa colapsa para a altura da borda (2px)
          até o arquivo chegar — declarados, o navegador reserva o espaço na
          proporção certa e a página não dá o pulo de layout.

          SEM `loading="lazy"` de propósito. As cinco figuras somam 48 KB,
          contra 508 KB de JavaScript que a página baixa de qualquer jeito:
          adiar 10% disso não economiza nada de perceptível, e em troca
          depende do observer de viewport disparar. Já falhou em produção uma
          vez (as imagens ficaram esperando numa caixa de 2px que nunca
          entrava em viewport) e, mesmo com a caixa corrigida, não consegui
          confirmar o disparo em todo ambiente de render. Carregar direto
          troca uma otimização irrelevante por um comportamento previsível. */}
      <img
        src={`figuras/${arquivo}`}
        alt={alt}
        width={w}
        height={h}
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
          w={960} h={540}
          alt="Grade com os onze painéis do portal e uma linha explicando o que cada um faz: Planilha, Relações, Chefias, Meu SIAPE, Insights, Mandatos, Prazos, Jornada, Cooperação, Comissões e ODS."
          legenda="Cada aba responde uma pergunta diferente sobre o mesmo acervo."
        />
        <p>
          A ideia em si é antiga: nasceu da experiência de João Fanara com a primeira versão do
          Portal de Normas do BNDES, lá no começo dos anos 2000. A diferença é que o BNDES tinha
          um setor que centralizava a gestão das suas
          normas, e a UFF nunca teve — sem um órgão para gerir o conteúdo, um sistema assim não se
          sustentava. Só as ferramentas de IA atuais tornaram viável ler milhares de PDFs (vários
          deles fruto de digitalização e OCR de qualidade irregular) com precisão aceitável para
          virar uma ferramenta de consulta.
        </p>
      </Secao>

      <Secao icon={<Eye className="w-4 h-4" />} titulo="Transparência ativa: publicar não é o mesmo que dar acesso">
        <p>
          A Lei de Acesso à Informação (Lei 12.527/2011) distingue duas coisas. A{' '}
          <strong>transparência passiva</strong> é responder a quem pergunta. A{' '}
          <strong>transparência ativa</strong> é divulgar por iniciativa própria, sem
          precisar de pedido — e é o que o artigo 8º exige dos órgãos públicos: publicar
          informação de interesse coletivo <em>em local de fácil acesso</em>.
        </p>
        <p>
          A UFF cumpre a parte da publicação desde sempre: o Boletim de Serviço sai
          regularmente e é público. O problema é o <em>fácil acesso</em>. Um acervo de mais de
          quatro mil PDFs, sem índice e sem busca entre arquivos, é público no sentido
          formal e inacessível no sentido prático. Quem procura um ato precisa saber de
          antemão em qual boletim ele saiu — que é justamente o que não se sabe.
        </p>
        <p>
          A mesma lei antecipa esse ponto. O artigo 8º, §3º, pede que os sites permitam{' '}
          <strong>gravar relatórios em formatos abertos</strong> (planilha, texto) para
          facilitar a análise, e o <strong>acesso automatizado por sistemas externos</strong>{' '}
          em formato estruturado e legível por máquina. PDF digitalizado não atende nem a um
          nem a outro. É essa lacuna que o portal fecha: transforma o acervo em dado
          estruturado, pesquisável, exportável em CSV e consultável por API — sem alterar
          uma vírgula do que a universidade já publicava.
        </p>
        <p className="text-slate-500 text-xs">
          Vale a precisão: o portal <strong>não substitui</strong> o canal oficial de
          transparência da UFF nem o próprio Boletim, que continua sendo a fonte primária e o
          documento válido para citação. Ele é uma camada de consulta que torna utilizável
          uma informação que já era pública.
        </p>
      </Secao>

      <Secao icon={<Target className="w-4 h-4" />} titulo="Os atos e os Objetivos de Desenvolvimento Sustentável">
        <p>
          Rankings internacionais e órgãos de controle avaliam a gestão universitária pelos{' '}
          <strong>17 Objetivos de Desenvolvimento Sustentável</strong> (ODS) da Agenda 2030 da
          ONU. A pergunta que a aba <strong>🎯 ODS</strong> responde é: <em>o que esta
          universidade efetivamente propôs e institucionalizou em cada um desses objetivos?</em>
        </p>
        <p>
          A resposta estava dispersa no acervo. A política de qualidade de vida do servidor, o
          plano de logística sustentável, o programa de integridade, as políticas afirmativas,
          o regime de cotutela — cada um é um ato publicado num boletim diferente, ao longo de
          25 anos, sem nada que os reunisse sob um mesmo tema.
        </p>
        <p>
          O critério de classificação não foi inventado aqui. Ele está ancorado em duas
          referências que quem avalia reconhece: as métricas de <em>política e iniciativa</em>{' '}
          do <strong>THE Impact Rankings</strong> — que pedem <strong>evidência documentada</strong>{' '}
          de políticas, com crédito extra quando a evidência é pública — e as{' '}
          <strong>metas nacionais dos ODS adequadas ao Brasil pelo IPEA</strong>, a régua que
          um órgão de controle federal usa. A regra de corte é dura: um ato só entra num ODS
          se casar com <strong>uma meta nomeável</strong>, e a justificativa registrada precisa
          citar qual.
        </p>
        <p>
          A distinção que sustenta o painel é entre <strong>proposta</strong> e{' '}
          <strong>execução</strong>. O ato que <em>institui</em> o Programa Bem Viver é uma
          proposta; os atos que <em>designam membros</em> da comissão que o executa não são.
          Ratificar um convênio com uma universidade estrangeira é executar a política de
          cooperação que já existe, não propor uma nova. Sem essa separação, o acervo exibiria
          1.662 "evidências"; com ela, exibe <strong>205 propostas</strong> — e cada uma se
          defende sozinha diante de quem perguntar.
        </p>
        <p>
          O resultado é um retrato honesto, e desigual de propósito: concentra-se em{' '}
          <strong>redução das desigualdades</strong>, <strong>educação</strong>,{' '}
          <strong>instituições eficazes</strong> e <strong>trabalho decente</strong>, enquanto
          água, energia e cidades aparecem só via ensino e pesquisa. Forçar equilíbrio seria
          fabricar evidência — que é a primeira coisa que um avaliador procura.
        </p>
        <p className="text-slate-500 text-xs">
          A classificação é <strong>assistida por IA com curadoria humana</strong> e{' '}
          <strong>não é posição institucional da UFF</strong>. Cada ligação carrega vínculo,
          confiança, meta e justificativa — e as linhas revisadas por pessoa ficam marcadas e
          não são sobrescritas. A metodologia completa, incluindo o que foi descartado e por
          quê, está no{' '}
          <a
            href="https://github.com/estudio-max/Portal-de-Normas-e-atos-da-UFF/blob/main/docs/METODOLOGIA-ODS.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 underline font-semibold"
          >
            documento de metodologia
          </a>.
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
          w={1000} h={420}
          alt="Fluxo em cinco etapas: a UFF publica o Boletim em PDF, um robô baixa todo dia às 19h10, o texto é recortado em atos, os atos vão para a base com 133 mil registros, e o usuário pesquisa."
          legenda="A etapa do meio é a difícil: o PDF não marca onde um ato termina e o outro começa."
        />
        <Figura
          arquivo="3-anatomia-do-ato.svg"
          w={940} h={520}
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
            <dd className="font-bold text-[#003366]">133.176</dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-400 uppercase tracking-wide">Boletins lidos</dt>
            <dd className="font-bold text-[#003366]">4.922</dd>
          </div>
        </dl>
        <p className="pt-2">
          Extração dos boletins em Python (com OCR via Tesseract nos PDFs digitalizados); banco de
          dados MySQL; backend em PHP; frontend em React e TypeScript.
        </p>
        <Figura
          arquivo="5-mapa-cooperacao.svg"
          w={1000} h={520}
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
          w={960} h={510}
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
