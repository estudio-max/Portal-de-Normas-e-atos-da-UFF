import React from 'react';
import {
  Search, GitBranch, Sparkles, Link as LinkIcon, Database, ShieldCheck,
  ShieldAlert, GitBranch as Branch, FileText, Filter, User, Info, CheckCircle2,
  ArrowRight, MousePointerClick, RefreshCw, Users, BarChart3, CalendarClock, AlertTriangle, Scale,
  Target
} from 'lucide-react';

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

function Badge({ cor, children }: { cor: string; children: React.ReactNode }) {
  return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${cor}`}>{children}</span>;
}

export default function HelpGuide() {
  return (
    <div className="space-y-3 max-w-4xl mx-auto">
      {/* Capa */}
      <div className="bg-[#003366] text-white rounded-lg p-5">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Info className="w-5 h-5 text-yellow-400" /> Como usar o Portal de Normas e Atos
        </h2>
        <p className="text-[13px] text-blue-100 mt-1 leading-relaxed">
          Este portal é uma <strong>camada de consulta</strong> construída sobre um acervo de
          arquivos <strong>PDF</strong>: os <strong>Boletins de Serviço da UFF</strong>, que são a
          <strong> fonte primária</strong> de tudo o que aparece aqui. O sistema lê esses PDFs,
          identifica cada ato (portarias, DTS, resoluções…) e organiza tudo numa planilha
          pesquisável — mas o documento oficial continua sendo o boletim, e cada ato traz o
          link para o PDF de origem.
        </p>
      </div>

      {/* Início rápido */}
      <Secao icon={<Search className="w-4 h-4" />} titulo="Começando em 30 segundos">
        <ol className="list-decimal ml-5 space-y-1">
          <li>Na aba <strong>📊 Atos e Normas</strong>, digite na caixa de busca o que procura
            (número da portaria, assunto, processo SEI…).</li>
          <li>Use os <strong>filtros</strong> (tipo, órgão, ano, status) para estreitar.</li>
          <li>Clique no <strong>olho 👁</strong> de uma linha para abrir a <strong>Ficha do Ato</strong> com todos os detalhes.</li>
        </ol>
      </Secao>

      {/* Filtro por servidor */}
      <Secao icon={<User className="w-4 h-4" />} titulo="“Quero ver só os atos que falam de mim”">
        <p>
          Use os campos <strong>Nome do servidor</strong> e <strong>SIAPE</strong> na linha de filtros.
          O portal procura o nome ou a matrícula <em>dentro do corpo</em> de cada ato — inclusive
          em tabelas e listas de designação — e mostra só os atos que citam aquela pessoa.
        </p>
        <p className="text-slate-500 text-xs">
          Dica: a matrícula SIAPE é a busca mais precisa (é um número único). Pelo nome, experimente
          partes do nome se não achar de primeira (ex.: só o sobrenome).
        </p>
      </Secao>

      {/* Status */}
      <Secao icon={<ShieldCheck className="w-4 h-4" />} titulo="O que significam as cores de Status">
        <p>Cada ato tem um selo dizendo se ele ainda vale:</p>
        <ul className="space-y-1.5 mt-1">
          <li><Badge cor="bg-green-100 text-green-700 border-green-200">Vigente</Badge> — está em vigor, pode confiar.</li>
          <li><Badge cor="bg-blue-100 text-blue-700 border-blue-200">Alterado</Badge> — ainda vale, mas um ato mais novo mudou parte dele. Leia os dois juntos.</li>
          <li><Badge cor="bg-red-100 text-red-700 border-red-200">Revogado</Badge> — <strong>não vale mais</strong>. Foi cancelado por um ato posterior. Evite usar.</li>
        </ul>
        <p className="text-slate-500 text-xs">Use o filtro <strong>Status</strong> para ver, por exemplo, só os vigentes.</p>
      </Secao>

      {/* Relações */}
      <Secao icon={<GitBranch className="w-4 h-4" />} titulo="Relações entre atos (e por que economizam tempo)">
        <p>
          A coluna <strong>Relações</strong> e a Ficha mostram como os atos se conectam. Tudo é
          <strong> clicável</strong>: clicando, você pula direto para o ato relacionado.
        </p>
        <ul className="space-y-1 mt-1">
          <li><Badge cor="bg-amber-100 text-amber-800 border-amber-200">Altera</Badge> / <Badge cor="bg-rose-100 text-rose-800 border-rose-200">Revoga</Badge> — o que <em>este</em> ato faz com outros.</li>
          <li><strong>↩ Referenciado por</strong> — quais atos <em>mais novos</em> mexeram neste (é assim que o portal sabe que algo foi revogado).</li>
        </ul>
        <p className="bg-blue-50 border border-blue-100 rounded p-2 text-xs text-blue-900 flex gap-1.5">
          <MousePointerClick className="w-4 h-4 shrink-0" />
          {/* O texto vai dentro de UM <span>: num container flex, cada elemento
              filho vira item — sem o span, cada <strong> viraria uma coluna e a
              frase se despedaçaria em blocos lado a lado. */}
          <span>
            Para investigar a fundo, use a aba <strong>🕸️ Mapa de Relações e Impacto</strong>: escolha um ato e veja
            o veredito (“revogado pela Portaria X”) e a teia completa de dependências.
          </span>
        </p>
      </Secao>

      {/* Chefias */}
      <Secao icon={<Users className="w-4 h-4" />} titulo="👥 Chefias da UFF — quem chefia cada setor">
        <p>
          A aba <strong>Chefias</strong> mostra o <strong>titular atual</strong> de cada função (Chefe,
          Coordenador, Diretor, Pró-Reitor…), montado a partir das <strong>designações e dispensas
          publicadas no Boletim</strong>. Vale sempre a designação mais recente de cada setor, e cada
          linha aponta a portaria de origem.
        </p>
        <p className="text-slate-500 text-xs">
          <strong>Ponderação:</strong> aparece só o que foi <strong>publicado como designação</strong> no
          período indexado. Se a última movimentação de um cargo foi uma dispensa sem sucessor publicado,
          ele não aparece. Sempre confira a <strong>data</strong> e a <strong>portaria</strong> mostradas.
        </p>
      </Secao>

      {/* Insights */}
      <Secao icon={<BarChart3 className="w-4 h-4" />} titulo="📈 Insights — o acervo em números">
        <p>
          A aba <strong>Insights</strong> transforma a base em painéis visuais: <strong>ritmo de publicação</strong>
          (calendário por dia), órgãos que mais publicam, <strong>cobertura de processos SEI</strong>, composição
          por tipo e situação de vigência. Traz ainda a <strong>rotatividade de chefias</strong> (quais cadeiras mais
          trocam de titular) e as <strong>normas revisadas ainda citadas</strong>.
        </p>
        <p className="text-slate-500 text-xs">
          <strong>Ponderação:</strong> os números refletem <strong>apenas o que já está indexado</strong>. Como a base
          ainda é recente, algumas análises (como a <em>meia-vida das normas</em>) só ganham sentido quando os anos
          anteriores forem carregados — por isso elas se <strong>ativam sozinhas</strong> com o tempo.
        </p>
      </Secao>

      {/* Prazos */}
      <Secao icon={<CalendarClock className="w-4 h-4" />} titulo="📅 Prazos e datas-limite — o radar">
        <p>
          A aba <strong>Prazos</strong> reúne, numa agenda, as datas-limite encontradas no <em>texto</em> dos atos —
          <strong> inscrições, recursos, entregas, prazos de contrato e validades</strong>. Cada prazo mostra:
        </p>
        <ul className="space-y-1 mt-1 ml-5 list-disc">
          <li><strong>Para quem serve</strong> — o público que deve se preocupar (candidatos, discentes, docentes, fornecedores, comunidade…).</li>
          <li>O <strong>assunto</strong> (a ementa do ato) e o <strong>trecho exato</strong> de onde a data foi tirada.</li>
          <li>A <strong>contagem regressiva</strong> (“faltam 11 dias”) e a cor de urgência.</li>
        </ul>

        <div className="bg-rose-50 border border-rose-200 rounded p-2.5 text-xs text-rose-900 flex gap-1.5 mt-1">
          <Scale className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Prazos de comissão disciplinar (categoria de alta confiança).</strong> Os prazos de
            <strong> Processo Administrativo Disciplinar (PAD)</strong>, <strong>PAD Sumário</strong> e
            <strong> Sindicância Investigativa</strong> e <strong>Sindicância Acusatória</strong> ganham um selo{' '}
            <Badge cor="bg-rose-600 text-white border-rose-700">Prazo legal</Badge> e uma categoria própria.
            São mais confiáveis que os demais porque o <strong>número de dias é lido literalmente do próprio ato</strong>{' '}
            (ex.: “prazo de 30 (trinta) dias”), incluindo as <strong>prorrogações e reconduções</strong> de comissão.
            Use o botão <Badge cor="bg-rose-100 text-rose-800 border-rose-200">⚖ PAD/Sindicância</Badge> logo acima da lista
            para ver só esses, ou <strong>Gerais</strong> para o resto.
          </span>
        </div>

        <p>
          Filtre por <strong>janela</strong> (esta semana, 30/90 dias…), por <strong>categoria</strong> (PAD/Sindicância × Gerais),
          por <strong>público</strong> ou por tipo, e use o botão <strong>Imprimir / PDF</strong> para uma lista limpa e fácil de ler no papel.
        </p>
        <div className="bg-amber-50 border border-amber-100 rounded p-2.5 text-xs text-amber-900 flex gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Como ler com cautela (importante):</strong> é um <strong>apoio para não perder prazos</strong>, não uma
            agenda oficial. A detecção da data e o <strong>“para quem”</strong> são <strong>automáticos</strong> e podem falhar
            ou classificar errado. Prazos relativos (“30 dias a contar da assinatura”) usam a <strong>data do ato</strong> como
            referência. O selo <Badge cor="bg-amber-100 text-amber-800 border-amber-200">revisado depois</Badge> avisa que um
            ato posterior mexeu naquele — nesses casos o prazo pode ter mudado. Em PAD/Sindicância, cada
            <strong> prorrogação/recondução é um novo prazo</strong>: vale sempre o do <strong>ato mais recente</strong> do processo.
            <strong> Sempre confirme no ato de origem.</strong>
          </span>
        </div>
      </Secao>

      {/* ODS */}
      <Secao icon={<Target className="w-4 h-4" />} titulo="🎯 ODS — o que a UFF propôs em cada Objetivo de Desenvolvimento Sustentável">
        <p>
          A aba <strong>ODS</strong> agrupa os atos normativos pelos <strong>17 Objetivos de
          Desenvolvimento Sustentável</strong> da ONU — o formato que rankings internacionais
          (como o <strong>THE Impact Rankings</strong>) e órgãos de controle usam para avaliar
          a gestão universitária. Clique numa ODS para ver os atos que a sustentam.
        </p>
        <p>Cada ato ligado a uma ODS recebe um <strong>tipo de vínculo</strong>, e a diferença entre eles é o ponto principal da aba:</p>
        <ul className="space-y-1.5 mt-1">
          <li><Badge cor="bg-emerald-100 text-emerald-700 border-emerald-200">Proposta</Badge> — o ato <strong>fundador</strong>: institui uma política, programa, plano ou estrutura. <em>É a evidência que interessa.</em></li>
          <li><Badge cor="bg-slate-100 text-slate-600 border-slate-200">Execução</Badge> — opera uma política que já existe (designa membros de comissão, ratifica um convênio). É contexto, não evidência nova.</li>
          <li><Badge cor="bg-sky-100 text-sky-700 border-sky-200">Pesquisa</Badge> — o ato viabiliza um projeto de pesquisa no tema.</li>
          <li><Badge cor="bg-violet-100 text-violet-700 border-violet-200">Ensino</Badge> — oferta acadêmica sobre o tema (curso, currículo, disciplina).</li>
        </ul>
        <p className="bg-blue-50 border border-blue-100 rounded p-2 text-xs text-blue-900 flex gap-1.5">
          <MousePointerClick className="w-4 h-4 shrink-0" />
          <span>
            Por que separar: um curso <em>sobre</em> recursos hídricos não é a política hídrica da
            universidade, e ratificar um convênio não é propor uma política de cooperação. Somar
            tudo num número só inflaria o resultado. Use os botões de vínculo dentro de cada ODS
            para ver só as <strong>propostas</strong> — é o recorte que responde
            “o que a UFF de fato institucionalizou aqui?”.
          </span>
        </p>
        <p>
          Cada linha traz ainda a <strong>confiança</strong> da classificação (alta, média,
          baixa), a <strong>meta THE/IPEA</strong> em que ela se ancora e a{' '}
          <strong>justificativa</strong>. O selo <Badge cor="bg-blue-100 text-blue-700 border-blue-200">revisado</Badge>{' '}
          marca as ligações conferidas por uma pessoa.
        </p>
        <div className="bg-amber-50 border border-amber-100 rounded p-2.5 text-xs text-amber-900 flex gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Como ler com cautela:</strong> a classificação é <strong>assistida por IA com
            curadoria humana</strong> e <strong>não é um relatório oficial da UFF</strong>. ODS sem
            evidência aparecem <strong>vazias de propósito</strong> — a distribuição é desigual
            porque a produção normativa real é desigual, e forçar equilíbrio seria fabricar
            evidência. Para uso oficial, confira sempre o ato de origem no Boletim.
          </span>
        </div>
      </Secao>

      {/* SEI */}
      <Secao icon={<LinkIcon className="w-4 h-4" />} titulo="Chegar ao processo no SEI">
        <p>
          Quando o ato tem processo SEI, a Ficha mostra os botões <strong>🔎 Abrir processo no SEI</strong> e
          <strong> 📄 Documento</strong>. A consulta pública do SEI é do próprio sistema da UFF:
          se o link direto não resolver, copie o número do processo na Ficha e cole na
          pesquisa pública do SEI (ela pede um CAPTCHA).
        </p>
        <p className="text-slate-500 text-xs">Cada ato também traz o link do <strong>PDF original do Boletim</strong> na UFF — a fonte primária.</p>
      </Secao>

      {/* Para quem indexa */}
      <Secao icon={<Sparkles className="w-4 h-4" />} titulo="Para quem organiza os atos (setor de documentação)">
        <ul className="space-y-1">
          <li><strong>Cadastrar / Editar / Excluir</strong>: botões na planilha para incluir ou corrigir um ato manualmente.</li>
          <li><strong>Importar / Exportar CSV</strong>: leve os dados para o Excel ou traga uma planilha pronta.</li>
          <li><strong>🧠 Assistente de Indexação</strong>: cole o texto de uma portaria e o sistema extrai sozinho o tipo, número, data, órgão, processo SEI e as relações — é só revisar e salvar.</li>
        </ul>
      </Secao>

      {/* De onde vêm os dados */}
      <Secao icon={<RefreshCw className="w-4 h-4" />} titulo="De onde vêm os dados (e atualização automática)">
        <p>
          A <strong>fonte primária</strong> são os <strong>Boletins de Serviço da UFF</strong> —
          os PDFs oficiais publicados no site da universidade. Todo dia, de forma automática,
          o sistema baixa os boletins novos, lê o texto de cada PDF, identifica os atos, suas
          relações e processos, e atualiza o portal sozinho — <strong>sem ninguém precisar
          mexer</strong>. Por isso os números no topo (total de atos, vigentes, revogados…)
          refletem sempre o estado mais recente do acervo.
        </p>
        <p className="text-slate-500 text-xs">
          O portal não cria nem altera norma nenhuma: ele só indexa o que já foi publicado.
          Para citar um ato oficialmente, use o PDF do boletim (link em cada ato).
        </p>
      </Secao>

      {/* Avisos */}
      <Secao icon={<ShieldAlert className="w-4 h-4" />} titulo="Importante">
        <ul className="space-y-1">
          {/* Cada item é flex (ícone + texto), então o texto precisa vir dentro
              de UM <span>. Solto, cada <strong> vira um item do flex e a frase
              se quebra em colunas lado a lado — era o que acontecia aqui. */}
          <li className="flex gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>O portal é uma <strong>camada de consulta</strong> sobre o acervo de PDFs — a <strong>fonte primária</strong> são os Boletins de Serviço. Em decisões oficiais, confira sempre o <strong>PDF oficial</strong> do Boletim (link em cada ato).</span>
          </li>
          <li className="flex gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>A indexação é automática e pode ter imperfeições em casos raros — por isso o original prevalece.</span>
          </li>
          <li className="flex gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>O <strong>radar de Prazos</strong>, os <strong>Insights</strong> e a aba <strong>ODS</strong> são apoios derivados do texto — ótimos como lembrete, panorama e evidência, mas o <strong>ato de origem sempre prevalece</strong>.</span>
          </li>
          <li className="flex gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>Os dados são informação <strong>pública</strong> do Boletim de Serviço da UFF.</span>
          </li>
        </ul>
      </Secao>

      {/* FAQ */}
      <Secao icon={<FileText className="w-4 h-4" />} titulo="Perguntas frequentes">
        <div className="space-y-2">
          <p><strong>Não acho um ato pelo nome.</strong> Tente partes do nome ou a matrícula SIAPE. Lembre que só constam os atos já publicados e indexados.</p>
          <p><strong>A lista mostra “exibindo os primeiros 300”.</strong> É só para a tela ficar rápida — refine a busca/filtros e o ato aparece.</p>
          <p><strong>Esse ato ainda vale?</strong> Olhe o selo de status e, na Ficha, a seção “Referenciado por”. Se houver “Revogado por…”, não vale mais.</p>
          <p><strong>Como compartilho um ato?</strong> Abra a Ficha e copie o número do processo SEI ou use o link do PDF do Boletim.</p>
          <p><strong>Posso confiar na data que aparece no radar de Prazos?</strong> Use como <strong>lembrete</strong> para não perder o prazo, mas <strong>confirme sempre no ato de origem</strong> — a data é lida automaticamente do texto e um ato posterior pode tê-la alterado (fique atento ao selo “revisado depois”).</p>
          <p><strong>O “para quem” de um prazo veio errado.</strong> O público é inferido automaticamente e pode escorregar no detalhe. Use o filtro de público como aproximação e confirme no ato.</p>
        </div>
      </Secao>

      <p className="text-center text-[11px] text-slate-400 pb-2">
        Dúvidas ou sugestões? Fale com a Superintendência de Documentação.
      </p>
    </div>
  );
}
