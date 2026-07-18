import React from 'react';
import { Sparkles, Lightbulb, Code2, Info } from 'lucide-react';

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

export default function Sobre() {
  return (
    <div className="space-y-3 max-w-4xl mx-auto">
      <div className="bg-[#003366] text-white rounded-lg p-5">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Info className="w-5 h-5 text-yellow-400" /> Sobre este projeto
        </h2>
        <p className="text-[13px] text-blue-100 mt-1 leading-relaxed">
          O Portal de Normas e Atos da UFF foi idealizado e construído por João Fanara, de forma
          independente. Esta página conta a motivação e como o projeto foi feito.
        </p>
      </div>

      <Secao icon={<Lightbulb className="w-4 h-4" />} titulo="A ideia, contada por quem a teve">
        <p className="italic">
          "No começo dos anos 2000, integrei a equipe que produziu o Portal de Normas do BNDES. Fui
          responsável pela arquitetura de informação, pelo design e pelo frontend do sistema. Desde
          essa época eu queria fazer algo parecido para a UFF.
        </p>
        <p className="italic">
          O problema é que os dois casos não são iguais. O BNDES tinha um setor que centralizava a
          criação e a gestão das suas normas. A UFF nunca teve isso. E sem um órgão responsável por
          organizar o conteúdo, é difícil sustentar um sistema de normas: o material está todo lá,
          publicado boletim a boletim há mais de vinte anos, mas nunca foi produzido pensando em
          virar uma base de dados única.
        </p>
        <p className="italic">
          Só recentemente, com as ferramentas de IA que existem hoje, ficou possível fazer o que
          faltava: ler milhares de arquivos em PDF (vários deles fruto de digitalização e OCR de
          qualidade bem irregular) e extrair de cada um o tipo de ato, o número, a data, o órgão, as
          pessoas citadas — com uma qualidade aceitável para virar uma ferramenta de consulta de
          verdade."
        </p>
      </Secao>

      <Secao icon={<Code2 className="w-4 h-4" />} titulo="Como foi construído">
        <p>
          O portal é mantido por João Fanara, de forma independente e sem vínculo oficial com a
          administração da UFF.
        </p>
        <p>
          A extração dos atos publicados nos boletins, a modelagem do banco de dados e boa parte do
          código do site foram feitos com o Claude, o assistente de IA da Anthropic, no que se
          costuma chamar de "vibe coding": conduzir o desenvolvimento em conversa com a IA, testando
          e corrigindo o resultado a cada passo, em vez de escrever cada linha manualmente. Não faz
          sentido esconder isso — foi assim que o projeto foi construído, e é isso que tornou viável
          um trabalho desse tamanho fora de uma equipe grande.
        </p>
      </Secao>

      <Secao icon={<Sparkles className="w-4 h-4" />} titulo="O que este portal é (e o que não é)">
        <p>
          O Portal de Normas e Atos da UFF é uma camada de consulta sobre um acervo público: os
          Boletins de Serviço que a própria universidade já publica oficialmente. Ele não substitui
          o boletim, não cria informação nova e não tem vínculo institucional formal com a UFF. É
          uma ferramenta independente, feita para facilitar o acesso a algo que já era público, mas
          difícil de encontrar.
        </p>
      </Secao>

      <p className="text-[11px] text-slate-400 text-center pt-2">
        Dúvidas ou sugestões sobre o projeto: <a href="mailto:nidi.gar@id.uff.br" className="underline">nidi.gar@id.uff.br</a>.
      </p>
    </div>
  );
}
