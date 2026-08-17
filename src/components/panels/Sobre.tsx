import React from 'react';
import { Sparkles, Lightbulb, Code2, Info, Github, BarChart3, Eye, Target, BookMarked, MessageSquare, Scale } from 'lucide-react';
import * as ds from '../../dataSource';
import { linksEmail } from '../ui/linksEmail';

// Relato do que a pessoa NÃO conseguiu fazer. O assunto sai fixo para que essas
// mensagens se separem sozinhas das dúvidas gerais na caixa de entrada, e o
// corpo já vem com o roteiro — pergunta aberta sem roteiro devolve "está bom",
// que não decide nada. Dois caminhos de envio pelo motivo explicado em
// `linksEmail.ts`: o e-mail institucional daqui é lido pelo Gmail.
const LINK_RELATO = linksEmail(
  'Inteligência UFF — não consegui fazer',
  [
    'O QUE EU VIM PROCURAR:',
    '',
    '',
    'O QUE ACONTECEU (ou o que faltou):',
    '',
    '',
    'Se for sobre um ato específico, qual? (tipo, número e ano)',
    '',
    '',
    '---',
    'Mensagem escrita e enviada por você. O portal não coletou nada.',
  ].join('\n'),
);

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
      <figcaption className="text-[12px] text-slate-500 pt-1.5 leading-relaxed">{legenda}</figcaption>
    </figure>
  );
}

const fmt = (v: number) => v.toLocaleString('pt-BR');

/** Os números desta página vêm da API, não do texto.
 *
 *  Esta aba já carregou duas vezes um número envelhecido: a contagem de
 *  vínculos ODS ficou parada em 1.662/205 depois de uma recarga, e a legenda da
 *  figura dizia "onze painéis" quando eram dez. Número escrito à mão numa
 *  página estática não envelhece com aviso — ele só passa a mentir.
 *
 *  As duas rotas usadas já são cacheadas em disco no servidor, então o custo é
 *  o de dois GET que quase nunca tocam o banco.
 *
 *  Quando a API não responde (modo de contingência, ou build estático), a
 *  frase é escrita SEM o número em vez de cair num valor fixo — dizer menos é
 *  melhor que dizer errado. */
interface Numeros {
  atos: number;          // atos indexados (era escrito à mão, e envelheceu)
  boletins: number;      // boletins lidos (idem)
  vinculos: number;      // linhas em ato_ods
  propostas: number;     // as que são ato fundador de política
  politicas: number;     // políticas no catálogo
  atosPolitica: number;  // vínculos ato↔política
  assedioLocais: number; // comissões locais no dossiê de assédio
}

function useNumeros(): Numeros | null {
  const [n, setN] = React.useState<Numeros | null>(null);
  React.useEffect(() => {
    let vivo = true;
    Promise.all([ds.getOds(), ds.getPoliticas(), ds.getStats()]).then(([ods, pol, st]) => {
      if (!vivo || !ods || !pol?.politicas) return;
      const assedio = pol.politicas.find(p => p.slug === 'assedio');
      setN({
        atos: st?.total ?? 0,
        boletins: st?.boletins ?? 0,
        vinculos: ods.linhas,
        propostas: ods.lista.reduce((s, o) => s + o.proposta, 0),
        politicas: pol.politicas.length,
        atosPolitica: pol.total,
        assedioLocais: assedio?.papeis.governanca ?? 0,
      });
    }).catch(() => { /* sem números: as frases saem sem eles */ });
    return () => { vivo = false; };
  }, []);
  return n;
}

export default function Sobre() {
  const n = useNumeros();
  return (
    <div className="space-y-3 max-w-4xl mx-auto">
      <div className="bg-[#003366] text-white rounded-lg p-5">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Info className="w-5 h-5 text-yellow-400" /> Sobre este projeto
        </h2>
        <p className="text-[13px] text-blue-100 mt-1 leading-relaxed">
          O Inteligência UFF foi idealizado por João Fanara e é mantido pelo Nidi
          (Núcleo Institucional de Dados Integrados), vinculado ao Gabinete do Reitor da UFF. Esta
          página conta a motivação e como o projeto foi feito.
        </p>
      </div>

      <Secao icon={<Lightbulb className="w-4 h-4" />} titulo="Por que este portal existe">
        <p>
          O Boletim de Serviço da UFF é publicado desde 2001 em PDF, um arquivo por edição, sem
          versão estruturada. Consultar esse acervo significava abrir boletim por boletim
          {n?.boletins ? <> — {fmt(n.boletins)} arquivos — </> : ' '}e procurar à mão.
        </p>
        <p>
          A necessidade ficou concreta com o RSC (Reconhecimento de Saberes e Competências, Decreto
          13.048/2026): para pleitear, muitos servidores passaram a procurar seus próprios registros
          no Boletim — designações, participações em comissões, portarias antigas. Folhear décadas
          de PDF atrás disso não é razoável, e o portal ajuda exatamente nesse ponto.
        </p>
        {/* w/h = o viewBox do SVG, e a altura acompanha o número de abas: com 15
            painéis são 5 fileiras. O valor antigo (606, de quando eram 12)
            reservava uma caixa menor que a imagem. Regerar a figura sem ajustar
            aqui volta a desalinhar — `tools/gerar_figuras_doc.py` imprime o
            tamanho de cada uma ao gerar. */}
        <Figura
          arquivo="7-abas-do-portal.svg"
          w={960} h={658}
          alt="Grade com um cartão por painel do portal — Dashboard, Atos e Normas, Mapa de Relações, Insights, Meu SIAPE, Chefias, Mandatos, Prazos, Jornada, Comissões, Políticas, Cooperação, Revalidação, ODS e O que mudou — cada um com uma linha explicando a que pergunta ele responde."
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
          regularmente e é público. O problema é o <em>fácil acesso</em>. Um acervo de
          {n?.boletins ? <> {fmt(n.boletins)} </> : ' milhares de '}PDFs, sem índice e sem busca
          entre arquivos, é público no sentido formal e inacessível no sentido prático. Quem procura um ato precisa saber de
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
          cooperação que já existe, não propor uma nova. Sem essa separação, o acervo exibiria{' '}
          {n ? <><strong>{fmt(n.vinculos)}</strong> "evidências"; com ela, exibe{' '}
          <strong>{fmt(n.propostas)} propostas</strong></> : <>todas as ligações como
          equivalentes; com ela, exibe só as propostas</>} — e cada uma se
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

      <Secao icon={<BookMarked className="w-4 h-4" />} titulo="De atos avulsos a políticas com história">
        <p>
          A classificação por ODS deixou um subproduto que ninguém tinha pedido: ao separar{' '}
          <em>proposta</em> de <em>execução</em>, ela identificou, um a um, os{' '}
          <strong>atos fundadores</strong> do acervo — os que instituem uma política, um plano,
          um programa{n ? <>. São <strong>{fmt(n.propostas)}</strong>, espalhados por 25 anos</> : null}.
          Eles viraram a semente da aba <strong>🏛️ Políticas</strong>.
        </p>
        <p>
          A pergunta desta aba é diferente das outras. A busca responde “que atos falam de
          assédio?”. Esta responde <em>“como a UFF construiu essa política ao longo do
          tempo?”</em> — e para isso não basta agrupar por tema: é preciso saber o{' '}
          <strong>papel</strong> de cada ato. Instituir uma política, regulamentá-la, montar a
          comissão que cuida dela e efetivamente executá-la são coisas distintas, e tratá-las
          como equivalentes produz uma leitura falsa. Uma política com dez designações e
          nenhuma entrega pareceria a mais ativa de todas.
        </p>
        <p>
          O caso que melhor mostra para que serve a aba é o do <strong>assédio</strong>. Há um
          único ato central — o Plano de Enfrentamento aprovado pelo Comitê de Governança em{' '}
          <strong>2025</strong>. Antes dele, o que existe são{' '}
          <strong>{n?.assedioLocais ? `${n.assedioLocais} comissões locais` : 'comissões locais'}</strong>,
          criadas por unidades isoladas entre 2018 e 2026: uma faculdade aqui, um instituto
          ali, cada um resolvendo por conta própria. A resposta institucional ao assédio foi
          descentralizada por sete anos antes de haver política central. Isso estava inteiro no
          acervo, e não era visível em lugar nenhum.
        </p>
        <p>
          A aba mostra também o que <strong>não</strong> encontrou. Cada política tem uma faixa
          de etapas — instituição, regulamentação, governança, execução, monitoramento,
          avaliação — e a etapa sem ato aparece apagada, dizendo{' '}
          <em>“sem evidência localizada no Boletim”</em>. Essa formulação é deliberada e é o
          ponto mais delicado do painel: <strong>lacuna de cobertura documental não é omissão
          institucional</strong>. O Boletim registra o que foi publicado nele; muita coisa
          acontece fora. Um portal que confundisse as duas coisas estaria produzindo acusação a
          partir de silêncio.
        </p>
        <p className="text-slate-500 text-xs">
          São <strong>{n ? `${n.politicas} políticas` : 'poucas políticas'} de um piloto</strong>
          {n ? <>, com {fmt(n.atosPolitica)} vínculos ato↔política,</> : null} e não o conjunto
          das políticas da UFF —
          o catálogo é curado e cresce aos poucos. Os vínculos foram propostos por regra (frase
          estrita na ementa, ou o órgão emissor quando a ementa não nomeia a política) e
          carregam o selo <strong>catálogo em revisão</strong> enquanto não passam por revisão
          humana. Como em todo o resto do portal, o ato de origem prevalece.
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
          alt="Fluxo em cinco etapas: a UFF publica o Boletim em PDF, um robô baixa todo dia às 19h10, o texto é recortado em atos, os atos vão para a base, e o usuário pesquisa por palavra, número, órgão, ano ou nome."
          legenda="A etapa do meio é a difícil: o PDF não marca onde um ato termina e o outro começa."
        />
        <Figura
          arquivo="3-anatomia-do-ato.svg"
          w={940} h={520}
          alt="Uma folha de documento com cinco chamadas indicando os campos que o portal separa: tipo, número e ano, órgão, ementa e processo SEI."
          legenda="Os campos extraídos de cada ato. Boletim antigo, digitalizado, costuma ter menos."
        />
      </Secao>

      {/* O QUE ESTA SEÇÃO É, E O QUE ELA NÃO PODE SER.
          O pedido foi mostrar o esforço que o portal representa. A tentação
          seria adjetivo — "trabalho minucioso", "milhares de horas" — e isso
          não se verifica, então não vale nada aqui. O que sustenta a
          afirmação é a MEDIÇÃO: cada exemplo abaixo é um número que existe
          porque alguém conferiu contra o acervo, e vários deles REPROVARAM a
          ideia que os motivou. É esse o esforço, e é ele que dá para provar. */}
      <Secao icon={<Scale className="w-4 h-4" />} titulo="O que custou chegar a estes números">
        <p>
          A parte cara deste projeto não é ler os boletins — a máquina faz isso em minutos. É
          decidir <strong>o que se pode afirmar</strong> a partir do que está escrito neles. Cada
          coluna deste portal é uma regra, e cada regra foi conferida contra o acervo real antes de
          virar número na tela.
        </p>
        <p>
          Isso significa que boa parte do trabalho foi <em>descartar</em>. Alguns exemplos, com o
          que a medição mostrou:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            Guardar só o <strong>primeiro</strong> número de processo de cada ato parecia
            suficiente. Medido: descartava <strong>44%</strong> das menções — justamente as que
            ligam um ato ao processo de outro.
          </li>
          <li>
            Para ligar um ato a uma comissão, bastaria procurar o nome dela. Medido no acervo
            inteiro: o nome solto acertava <strong>60%</strong> das vezes, porque cada unidade tem
            a sua comissão com o mesmo nome. Com as regras de exclusão, o mesmo colegiado fecha em{' '}
            <strong>71 atos e nenhum falso positivo</strong>.
          </li>
          <li>
            Classificar os atos por ODS lendo o <em>corpo</em> inteiro, e não só a ementa, renderia
            mais vínculos. Medido: 37 vínculos novos com <strong>~3% de precisão</strong> — o termo
            estava no nome da vaga, na unidade do anexo. A ideia foi reprovada e não entrou.
          </li>
          <li>
            37 setores apareciam como jornada flexibilizada <strong>ativa</strong> para sempre,
            porque a portaria que os encerrou é de 2019 e nem está no acervo. Hoje o encerramento é
            lido do próprio ato de revogação.
          </li>
        </ul>
        <p>
          O acervo também não é confiável só por ser oficial. O OCR de 2001 troca letras; o mesmo
          órgão aparece grafado de três formas; um boletim publica ato de dezembro do ano anterior.
          Cada uma dessas coisas foi descoberta errando primeiro — e cada correção virou um teste
          automático, para que ela não volte silenciosamente. Hoje são <strong>21</strong>{' '}
          verificações que rodam a cada alteração do código, e nenhuma delas testa a ferramenta
          contra a imaginação de quem a escreveu: os casos são trechos reais do acervo, incluindo
          os que <em>não podem</em> ser reconhecidos.
        </p>
        <p>
          É por isso que o portal diz <em>“sem evidência localizada no Boletim”</em> em vez de{' '}
          <em>“não existe”</em>, e mostra <em>“(não informado)”</em> em vez de adivinhar um rótulo.
          A diferença entre as duas frases é todo o trabalho.
        </p>
      </Secao>

      <Secao icon={<BarChart3 className="w-4 h-4" />} titulo="Números do projeto">
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 not-italic">
          <div>
            <dt className="text-[12px] text-slate-400 uppercase tracking-wide">Início</dt>
            <dd className="font-bold text-[#003366]">25/06/2026</dd>
          </div>
          <div>
            <dt className="text-[12px] text-slate-400 uppercase tracking-wide">Cobertura</dt>
            <dd className="font-bold text-[#003366]">2001–2026 (26 anos)</dd>
          </div>
          {/* ⚠️ Estes dois vinham ESCRITOS À MÃO, contra a regra que esta
              própria página declara algumas linhas acima — e envelheceram:
              diziam 133.176 atos e 4.922 boletins quando o acervo já estava em
              134.512 e 4.931. Número fixo em página estática não avisa quando
              passa a mentir. Sem API, o campo mostra "—", que é honesto. */}
          <div>
            <dt className="text-[12px] text-slate-400 uppercase tracking-wide">Atos indexados</dt>
            <dd className="font-bold text-[#003366]">{n?.atos ? fmt(n.atos) : '—'}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-slate-400 uppercase tracking-wide">Boletins lidos</dt>
            <dd className="font-bold text-[#003366]">{n?.boletins ? fmt(n.boletins) : '—'}</dd>
          </div>
        </dl>
        <p className="pt-2">
          Extração dos boletins em Python (com OCR via Tesseract nos PDFs digitalizados); banco de
          dados MySQL; backend em PHP; frontend em React e TypeScript.
        </p>
        <Figura
          arquivo="5-mapa-cooperacao.svg"
          w={1000} h={520}
          alt="Mapa-múndi com círculos proporcionais sobre os países onde a UFF tem acordos de cooperação, maiores na Europa e na América do Sul, e ao lado o ranking dos oito com mais acordos, encabeçado por França e Portugal."
          legenda="Acordos de cooperação extraídos dos atos, com os números no próprio gráfico — a aba Cooperação traz a lista completa e o filtro por país. São acordos aprovados por ato do Boletim, não necessariamente parcerias ativas hoje: o Boletim não registra o encerramento de um convênio."
        />
      </Secao>

      <Secao icon={<Sparkles className="w-4 h-4" />} titulo="O que este portal é (e o que não é)">
        <p>
          O Inteligência UFF é uma camada de consulta sobre um acervo público: os
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
        {/* Cobertura e limite, com a data da medição junto.
            Número de cobertura envelhece — e envelhecer COM data é honesto,
            enquanto envelhecer sem data vira afirmação falsa. Foi o que
            aconteceu com "133.176 atos" logo acima nesta mesma página.
            O dado dos 8 indisponíveis é o tipo de limite que só aparece quando
            alguém confere item a item; declarar é o que separa "não foi
            publicado" de "não está acessível". */}
        <p>
          <strong>Até onde o acervo alcança.</strong> Em agosto de 2026 o portal foi reprocessado
          de ponta a ponta: todos os boletins publicados desde 2001 foram lidos de novo, com as
          mesmas regras de extração — antes, cada ato carregava a versão do programa que o
          importou, e o acervo era uma colcha de safras diferentes.
        </p>
        <p>
          Da conferência ficou um limite que vale declarar: dos <strong>5.213</strong> boletins que
          a UFF lista como publicados, <strong>8 não são entregues pelo servidor dela</strong> —
          estão na lista e o arquivo responde erro. São de 2002, 2004 e 2014. O portal cobre os
          outros <strong>5.205</strong>. É diferença entre <em>não foi publicado</em> e{' '}
          <em>não está acessível</em>, e as duas coisas não podem virar a mesma no relatório de
          ninguém. Medido em 17/08/2026; link quebrado na origem pode voltar.
        </p>
        <Figura
          arquivo="4-teia-de-relacoes.svg"
          w={960} h={510}
          alt="Cinco atos numa linha do tempo. Dois atos alteram o ato de 2015 e um o revoga em 2024, deixando-o marcado como revogado. Legenda: verde é vigente, amarelo é alterado, vermelho é revogado."
          legenda="É a pergunta que o acervo em PDF não responde e o índice responde."
        />
      </Secao>

      {/* Uma pergunta só, e ABERTA. "Nota de 0 a 10" com poucas respostas não
          decide nada — vira média sem dono. Já "o que você tentou fazer e não
          conseguiu" devolve o que falta construir, com as palavras de quem
          precisava. Fica na aba Sobre, e não num modal: quem chegou até aqui
          está disposto a falar do projeto, e ninguém foi interrompido no meio
          de uma consulta para responder. */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#003366]">
          <MessageSquare className="h-4 w-4 text-yellow-500" /> Ajude a decidir o que vem depois
        </h3>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
          Se você veio procurar alguma coisa aqui e <strong>não conseguiu</strong> — porque a
          informação não existe, porque está errada, ou porque você não achou onde fica —{' '}
          <strong>essa é a informação mais útil que existe para este projeto</strong>. Ela diz o
          que construir em seguida melhor do que qualquer nota de satisfação.
        </p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-slate-700">
          Conte o que você tentou fazer e não conseguiu — duas linhas bastam:{' '}
          <a
            href={LINK_RELATO.gmail}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-700 underline decoration-dotted underline-offset-2"
          >
            escrever pelo Gmail
          </a>{' '}
          ou{' '}
          <a
            href={LINK_RELATO.mailto}
            className="font-semibold text-blue-700 underline decoration-dotted underline-offset-2"
          >
            pelo seu programa de e-mail
          </a>.
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
          {/* A frase dizia "o portal não registra nem esta visita". Não era
              verdade: o site roda Google Analytics, que conta a visita. O que
              é verdade — e é o que importa aqui — é que a mensagem não sai
              sozinha e o texto dela não passa pelo portal. Numa página sobre
              confiança, a frase generosa demais custa mais caro que a exata. */}
          Qualquer um dos dois abre a mensagem já começada, para você completar. Nada é enviado
          automaticamente, e o portal não recebe nem guarda o que você escrever — o texto vai do seu
          e-mail para o nosso. A medição de audiência do site está descrita na aba{' '}
          <strong>Privacidade</strong>. Se preferir, o endereço é{' '}
          <span className="font-mono text-slate-600">{LINK_RELATO.destino}</span>.
        </p>
      </div>

      <p className="text-[12px] text-slate-400 text-center pt-2">
        Dúvidas ou sugestões sobre o projeto: <a href="mailto:nidi.gar@id.uff.br" className="underline">nidi.gar@id.uff.br</a>.
      </p>
    </div>
  );
}
