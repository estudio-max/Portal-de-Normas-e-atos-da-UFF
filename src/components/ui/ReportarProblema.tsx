import React from 'react';
import { Flag } from 'lucide-react';
import { AJUDA } from '../help/ajudaConteudo';
import { linksEmail } from './linksEmail';

// Canal de correção do acervo. É e-mail de propósito — e em DOIS caminhos, o do
// Gmail no navegador e o do programa da máquina (ver `linksEmail.ts`, que
// explica por que os dois). A escolha por e-mail, e não por formulário no
// próprio site, tem duas razões:
//
// 1. A API do portal é 100% SÓ LEITURA — não existe uma única rota que grave.
//    Receber avaliação pelo próprio site significaria abrir a PRIMEIRA
//    superfície de escrita pública do sistema, com tudo que vem junto (limite
//    de taxa, anti-spam, validação, moderação). Isso é decisão de arquitetura,
//    não detalhe de tela, e não se toma para descobrir se a demanda existe.
// 2. A aba Privacidade promete que o portal "não guarda o resultado de nenhuma
//    consulta". Pelo e-mail, quem envia é a pessoa, do cliente dela, vendo o
//    que manda — o portal continua sem guardar nada, e a promessa fica de pé.
//
// Se o volume justificar, este mesmo botão passa a apontar para uma rota
// própria sem que nada mais mude. Medir antes de construir.
//
// O corpo vai com o CONTEXTO (aba e data) e um roteiro curto, porque relato
// vago não conserta nada: o que salvou o dia 06/08/2026 foi o mantenedor dizer
// "a Portaria 108/2022 não mostra o cargo", não "achei um erro".
//
// NADA de dado pessoal é pré-preenchido — em especial a matrícula consultada na
// aba Meu SIAPE. O contexto que vai é só o nome da aba.

// Abas sem dado do acervo: aqui o convite não faz sentido (não há ato a
// corrigir), e a aba Sobre tem a pergunta própria, de outra natureza.
const SEM_CONVITE = new Set(['ajuda', 'privacidade', 'sobre', '']);

export function ReportarProblema({ activePath }: { activePath: string }) {
  if (SEM_CONVITE.has(activePath)) return null;

  const aba = AJUDA[activePath]?.titulo ?? activePath;
  const assunto = `Inteligência UFF — correção na aba ${aba}`;
  const corpo = [
    `Encontrei um problema no Inteligência UFF.`,
    ``,
    `Aba: ${aba}`,
    `Data: ${new Date().toLocaleDateString('pt-BR')}`,
    ``,
    `QUAL ATO OU INFORMAÇÃO ESTÁ ERRADA?`,
    `(quanto mais específico, mais rápido o conserto — ex.: "Portaria nº 108/2022,`,
    `de 26/01/2022: o cargo aparece em branco")`,
    ``,
    ``,
    `O QUE DEVERIA APARECER?`,
    ``,
    ``,
    `---`,
    `Esta mensagem foi escrita e enviada por você. O portal não coletou nem`,
    `enviou nenhuma informação automaticamente.`,
  ].join('\n');

  const link = linksEmail(assunto, corpo);

  return (
    // `slate-600` e não `slate-500`: em 11px o 500 media 4,6 de contraste no
    // tema claro — passa o mínimo, mas sem folga, e este texto é um convite que
    // precisa ser lido para funcionar. Os dois estão no mapa do fotofobia.
    <p className="mt-6 mb-1 text-center text-[12px] leading-relaxed text-slate-600">
      <Flag className="mr-1 -mt-0.5 inline h-3 w-3" />
      O acervo vem de 25 anos de PDF, e parte dele de digitalização.{' '}
      <strong>Achou um ato errado ou faltando?</strong> Escreva para a gente{' '}
      {/* `blue-700`, não `blue-600`: o modo fotofobia converte por lista de
          classes conhecidas e o 600 não está nela — medido, o link ficava em
          3,12 de contraste (azul escuro sobre fundo escuro), abaixo do mínimo. */}
      <a
        href={link.gmail}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-blue-700 underline decoration-dotted underline-offset-2"
      >
        pelo Gmail
      </a>{' '}
      ou{' '}
      <a
        href={link.mailto}
        className="font-semibold text-blue-700 underline decoration-dotted underline-offset-2"
      >
        pelo seu programa de e-mail
      </a>{' '}
      — quem consulta é quem enxerga o erro primeiro.
    </p>
  );
}
