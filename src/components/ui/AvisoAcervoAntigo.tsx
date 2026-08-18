import React from 'react';
import { Archive } from 'lucide-react';

// ============================================================================
//  "NÃO ACHOU UM BOLETIM ATÉ 2001?" — o aviso que aponta para o arquivo.
//
//  POR QUE É COMPONENTE, E NÃO TEXTO REPETIDO (18/08/2026)
//  A informação veio da área de documentação da UFF e é a única do portal que
//  oferece uma SAÍDA REAL para quem não encontrou o que procurava: alguns
//  boletins publicados até 2001 não estão on-line em lugar nenhum, e existe
//  caminho para consultá-los presencialmente.
//
//  Ela precisa aparecer em mais de um lugar — a aba Sobre não é onde a pessoa
//  está quando a busca falha. Mas endereço de e-mail copiado à mão em três
//  telas é endereço que, no dia em que mudar, muda em duas. Então mora aqui,
//  uma vez.
//
//  ⚠️ ONDE ESTE AVISO **NÃO** DEVE APARECER: em tela cheia de resultados. Ele
//  responde "não achei" — mostrá-lo junto de uma lista que funcionou vira
//  ruído, e ruído repetido é o que faz o leitor parar de ler avisos. Os
//  chamadores decidem o momento; o componente não se auto-exibe.
//
//  ⚠️ E O QUE ELE NÃO PODE INSINUAR: que a lacuna é do portal. Não é — o
//  boletim não está on-line na origem. Dizer isso protege o leitor de concluir
//  que basta procurar "no site oficial" o que lá também não está.
// ============================================================================

const EMAIL = 'atendimento.car.sdc@id.uff.br';

/** `variante`:
 *  - `destaque` (padrão): caixa âmbar, para o estado vazio de uma busca.
 *  - `discreta`: linha de apoio, para o pé de uma tela que já tem conteúdo. */
export function AvisoAcervoAntigo({ variante = 'destaque' }: { variante?: 'destaque' | 'discreta' }) {
  const link = (
    <a href={`mailto:${EMAIL}`} className="text-blue-700 underline font-semibold break-all">
      {EMAIL}
    </a>
  );

  if (variante === 'discreta') {
    return (
      <p className="text-[12px] leading-relaxed text-slate-500">
        <strong className="text-slate-600">Procura um boletim até 2001?</strong> Alguns não estão
        disponíveis on-line — é lacuna na origem, não deste portal. Para verificar a
        possibilidade de consulta presencial, escreva para {link} (Coordenação de Arquivos /
        Superintendência de Documentação da UFF).
      </p>
    );
  }

  return (
    <div className="mx-auto mt-5 max-w-lg rounded-lg border border-amber-200 bg-amber-50 p-3 text-left">
      <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-amber-800">
        <Archive className="h-3.5 w-3.5" aria-hidden="true" />
        Procura um boletim até 2001?
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-700">
        <strong>Alguns boletins publicados até 2001 não estão disponíveis</strong> on-line — é
        lacuna na origem, não deste portal. Nesse caso, a consulta presencial pode ser possível:
        escreva para {link} (Coordenação de Arquivos / Superintendência de Documentação da UFF)
        para verificar.
      </p>
    </div>
  );
}

export const EMAIL_ARQUIVO = EMAIL;
