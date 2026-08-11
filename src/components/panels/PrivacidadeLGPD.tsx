import React from 'react';
import { ShieldCheck, FileText, Lock, Scale, Database, FolderSearch } from 'lucide-react';

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

export default function PrivacidadeLGPD() {
  return (
    <div className="space-y-3 max-w-4xl mx-auto">
      <div className="bg-[#003366] text-white rounded-lg p-5">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-yellow-400" /> Privacidade e proteção de dados (LGPD)
        </h2>
        <p className="text-[13px] text-blue-100 mt-1 leading-relaxed">
          O Inteligência UFF é uma camada de consulta sobre um acervo público: os Boletins
          de Serviço da UFF, publicados oficialmente pela própria universidade. O portal não cria
          dados novos — ele lê os PDFs já publicados pela UFF, organiza o conteúdo numa planilha
          pesquisável e devolve o link para o documento original em cada ato. A fonte primária e
          oficial continua sendo o boletim da UFF.
        </p>
      </div>

      <Secao icon={<FileText className="w-4 h-4" />} titulo="Responsável pelo tratamento">
        <p>
          Este portal é mantido pelo Nidi (Núcleo Institucional de Dados Integrados), vinculado ao
          Gabinete do Reitor da UFF, como ferramenta de consulta aos boletins públicos da
          universidade. João Fanara, idealizador do projeto, coordena o Nidi. Contato: <a href="mailto:nidi.gar@id.uff.br" className="text-blue-700 underline font-semibold">nidi.gar@id.uff.br</a>.
        </p>
      </Secao>

      <Secao icon={<Database className="w-4 h-4" />} titulo="Que dados aparecem aqui">
        <p>
          Os atos publicados no Boletim de Serviço frequentemente citam nome, matrícula SIAPE,
          cargo e, em alguns casos, número de CPF de servidores e outras pessoas envolvidas nos
          atos administrativos (portarias, designações, concessões, processos disciplinares, entre
          outros). Esses dados já constam do documento oficial publicado pela UFF.
        </p>
      </Secao>

      <Secao icon={<FolderSearch className="w-4 h-4" />} titulo="A aba Meu SIAPE">
        <p>
          Na maior parte do portal você consulta um ato de cada vez. A aba <strong>Meu SIAPE</strong> faz
          outra coisa: reúne, numa lista só, os atos que citam uma matrícula ao longo de todos os
          anos indexados. Os atos são os mesmos, e todos já eram públicos — mas juntar o que estava
          espalhado por centenas de boletins é um tratamento de natureza diferente de ler um
          boletim, e não seria honesto tratar os dois como a mesma coisa.
        </p>
        <p>
          Essa aba nasceu restrita por senha. Foi <strong>aberta em julho de 2026</strong>, e o
          motivo é o público a que ela passou a servir: com o Decreto 13.048/2026 (Reconhecimento de
          Saberes e Competências), são os próprios servidores que precisam localizar seus registros
          antigos no Boletim para instruir seus pedidos — e levantar isso à mão em vinte e cinco
          anos de PDF não é razoável. Restringir a busca à Gestão de Pessoal significava obrigar
          cada servidor a pedir a terceiros uma consulta sobre si mesmo, em documentos públicos.
        </p>
        <p>
          As mitigações continuam as mesmas: o resultado é gerado na hora, a partir da consulta
          digitada, e não fica guardado — o portal não monta nem armazena perfil de ninguém. A aba
          não pontua e não avalia conduta: devolve os atos publicados e o link do boletim de origem.
          E vale dizer com clareza: qualquer pessoa pode consultar qualquer matrícula, mas tudo o
          que aparece já estava publicado pela UFF nos boletins.
        </p>
      </Secao>

      <Secao icon={<Scale className="w-4 h-4" />} titulo="Base legal">
        <p>
          O tratamento se apoia no art. 7º, inciso IX, da LGPD (legítimo interesse). Para a consulta
          ato a ato, o raciocínio é direto: a finalidade aqui — dar acesso organizado a atos
          administrativos que a própria UFF já publicou como documento público — é a mesma
          finalidade que motivou a publicação original pela universidade, amparada pelo princípio
          constitucional da publicidade dos atos administrativos.
        </p>
        <p>
          Para a consulta por matrícula (Meu SIAPE), o raciocínio precisa de mais um passo, e é
          melhor explicitá-lo do que fingir que não existe: a UFF publicou atos avulsos, não
          históricos consolidados por pessoa. O que sustenta essa aba é a finalidade e o desenho
          dela: existe para o servidor localizar os próprios registros e instruir o Reconhecimento
          de Saberes e Competências (Decreto 13.048/2026); não revela nada além do que o documento
          público já traz, apenas poupa o trabalho de folhear os boletins; não emite juízo de valor;
          e não guarda o resultado de nenhuma consulta. Os CPFs seguem mascarados e pedidos de
          remoção são atendidos caso a caso.
        </p>
      </Secao>

      <Secao icon={<Lock className="w-4 h-4" />} titulo="O que fazemos para minimizar o risco">
        <p>
          Números de CPF encontrados no texto dos boletins são mascarados automaticamente
          (exibidos como <code className="bg-slate-100 px-1 rounded text-[12px]">***.XXX.XXX-**</code>),
          mantendo visível só o suficiente para conferência, sem publicar o número completo.
        </p>
      </Secao>

      <p className="text-[11px] text-slate-400 text-center pt-2">
        O acesso ao banco de dados que sustenta este portal é restrito por senha e por um token de
        importação, ambos guardados fora do repositório de código.
      </p>
    </div>
  );
}
