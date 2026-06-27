import React from 'react';
import {
  Search, GitBranch, Sparkles, Link as LinkIcon, Database, ShieldCheck,
  ShieldAlert, GitBranch as Branch, FileText, Filter, User, Info, CheckCircle2,
  ArrowRight, MousePointerClick, RefreshCw
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
          Este guia explica, em linguagem simples, tudo o que o portal faz. Você não precisa
          ser da área jurídica nem de tecnologia para usar — é como pesquisar numa planilha
          inteligente dos atos publicados no Boletim de Serviço da UFF.
        </p>
      </div>

      {/* Início rápido */}
      <Secao icon={<Search className="w-4 h-4" />} titulo="Começando em 30 segundos">
        <ol className="list-decimal ml-5 space-y-1">
          <li>Na aba <strong>📊 Planilha e Cadastro</strong>, digite na caixa de busca o que procura
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
          Para investigar a fundo, use a aba <strong>🕸️ Mapa de Relações e Impacto</strong>: escolha um ato e veja
          o veredito (“revogado pela Portaria X”) e a teia completa de dependências.
        </p>
      </Secao>

      {/* SEI */}
      <Secao icon={<LinkIcon className="w-4 h-4" />} titulo="Chegar ao processo no SEI">
        <p>
          Quando o ato tem processo SEI, a Ficha mostra os botões <strong>🔎 Abrir processo no SEI</strong> e
          <strong> 📄 Documento</strong>. A aba <strong>🔗 Integração e Busca no SEI</strong> traz um passo a passo
          (com a parte do CAPTCHA) para consultar o processo público.
        </p>
        <p className="text-slate-500 text-xs">Cada ato também traz o link do <strong>PDF original do Boletim</strong> na UFF — a fonte oficial.</p>
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
          Todo dia, de forma automática, o sistema lê os boletins novos publicados no site da UFF,
          identifica os atos, suas relações e processos, e atualiza o portal sozinho — <strong>sem
          ninguém precisar mexer</strong>. Por isso os números no topo (total de atos, vigentes,
          revogados…) refletem sempre o estado mais recente.
        </p>
      </Secao>

      {/* Avisos */}
      <Secao icon={<ShieldAlert className="w-4 h-4" />} titulo="Importante">
        <ul className="space-y-1">
          <li className="flex gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> O portal é uma <strong>ferramenta de consulta</strong>. Em decisões oficiais, confira sempre o <strong>PDF oficial</strong> do Boletim (link em cada ato).</li>
          <li className="flex gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> A indexação é automática e pode ter imperfeições em casos raros — por isso o original prevalece.</li>
          <li className="flex gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> Os dados são informação <strong>pública</strong> do Boletim de Serviço da UFF.</li>
        </ul>
      </Secao>

      {/* FAQ */}
      <Secao icon={<FileText className="w-4 h-4" />} titulo="Perguntas frequentes">
        <div className="space-y-2">
          <p><strong>Não acho um ato pelo nome.</strong> Tente partes do nome ou a matrícula SIAPE. Lembre que só constam os atos já publicados e indexados.</p>
          <p><strong>A lista mostra “exibindo os primeiros 300”.</strong> É só para a tela ficar rápida — refine a busca/filtros e o ato aparece.</p>
          <p><strong>Esse ato ainda vale?</strong> Olhe o selo de status e, na Ficha, a seção “Referenciado por”. Se houver “Revogado por…”, não vale mais.</p>
          <p><strong>Como compartilho um ato?</strong> Abra a Ficha e copie o número do processo SEI ou use o link do PDF do Boletim.</p>
        </div>
      </Secao>

      <p className="text-center text-[11px] text-slate-400 pb-2">
        Dúvidas ou sugestões? Fale com a Superintendência de Documentação.
      </p>
    </div>
  );
}
