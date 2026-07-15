import React from 'react';
import { ShieldCheck, FileText, UserCheck, Lock, Scale, Database, FolderSearch } from 'lucide-react';

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
          O Portal de Normas e Atos é uma camada de consulta sobre um acervo público: os Boletins
          de Serviço da UFF, publicados oficialmente pela própria universidade. O portal não cria
          dados novos — ele lê os PDFs já publicados pela UFF, organiza o conteúdo numa planilha
          pesquisável e devolve o link para o documento original em cada ato. A fonte primária e
          oficial continua sendo o boletim da UFF.
        </p>
      </div>

      <Secao icon={<FileText className="w-4 h-4" />} titulo="Responsável pelo tratamento">
        <p>
          Este portal é mantido por João Fanara, de forma independente da UFF, como ferramenta de
          consulta aos boletins públicos da universidade. Contato: <a href="mailto:joaofanara@id.uff.br" className="text-blue-700 underline font-semibold">joaofanara@id.uff.br</a>.
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

      <Secao icon={<FolderSearch className="w-4 h-4" />} titulo="A aba Dossiê do servidor é fechada">
        <p>
          Na maior parte do portal você consulta um ato de cada vez, e qualquer pessoa pode. A aba
          <strong> Dossiê do servidor</strong> faz outra coisa: reúne, numa lista só, os atos que
          citam a mesma matrícula ao longo de todos os anos indexados. Os atos são os mesmos, e
          todos já eram públicos — mas juntar o que estava espalhado por centenas de boletins é um
          tratamento de natureza diferente de ler um boletim, e não seria honesto tratar os dois
          como a mesma coisa.
        </p>
        <p>
          Por isso ela é a <strong>única aba restrita do portal</strong>, protegida por senha
          entregue à Gestão de Pessoal da UFF. A recusa acontece no servidor, não na tela: sem a
          senha, a consulta não é respondida. Ela existe porque o Decreto 13.048/2026 passou a
          exigir a comprovação de participações antigas para o Reconhecimento de Saberes e
          Competências, e levantar isso à mão em vinte e cinco anos de PDF não é razoável.
        </p>
        <p>
          O resultado é gerado na hora, a partir da consulta digitada, e não fica guardado: o portal
          não monta nem armazena perfil de ninguém. A aba também não pontua e não avalia conduta —
          devolve os atos publicados e o link do boletim de origem.
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
          Para o dossiê por matrícula, esse argumento não bastaria sozinho, e é melhor dizer isso do
          que fingir que basta: a UFF publicou atos avulsos, não históricos consolidados por pessoa.
          O que sustenta essa aba é outra coisa — ela não é pública. O acesso fica com a Gestão de
          Pessoal, que já trata esses dados por dever de ofício, e serve a uma finalidade estreita:
          instruir o processo de Reconhecimento de Saberes e Competências que o Decreto 13.048/2026
          criou. É um uso interno, sobre atos que já são públicos, que beneficia o próprio servidor
          avaliado, sem juízo de valor sobre ele e sem guardar o resultado.
        </p>
      </Secao>

      <Secao icon={<Lock className="w-4 h-4" />} titulo="O que fazemos para minimizar o risco">
        <p>
          Números de CPF encontrados no texto dos boletins são mascarados automaticamente
          (exibidos como <code className="bg-slate-100 px-1 rounded text-[12px]">***.XXX.XXX-**</code>),
          mantendo visível só o suficiente para conferência, sem publicar o número completo.
        </p>
      </Secao>

      <Secao icon={<UserCheck className="w-4 h-4" />} titulo="Seus direitos">
        <p>
          Se você aparece em algum ato indexado aqui e quer corrigir uma informação, ou pedir a
          remoção do seu nome de um trecho específico (por exemplo, uma ementa que cita um
          processo disciplinar), escreva para <a href="mailto:joaofanara@id.uff.br" className="text-blue-700 underline font-semibold">joaofanara@id.uff.br</a>.
          Cada pedido é avaliado caso a caso. Quando dá para resolver removendo só o nome do
          trecho, preferimos isso a apagar o ato inteiro — o ato em si continua existindo no
          boletim oficial da UFF de qualquer forma, com ou sem este portal.
        </p>
      </Secao>

      <p className="text-[11px] text-slate-400 text-center pt-2">
        O acesso ao banco de dados que sustenta este portal é restrito por senha e por um token de
        importação, ambos guardados fora do repositório de código.
      </p>
    </div>
  );
}
