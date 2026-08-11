// Dois caminhos para a MESMA mensagem: a janela do Gmail no navegador e o
// programa de e-mail da máquina.
//
// Por que os dois, e não só `mailto:`: o público deste portal é servidor da
// UFF, e o e-mail institucional é lido majoritariamente pela interface do
// Gmail, no navegador. `mailto:` só abre o Gmail se a pessoa tiver registrado
// o Gmail como aplicativo padrão de e-mail no navegador — o que a maioria nunca
// fez. Sem isso o clique não faz nada, ou abre um cliente de mesa que ela não
// usa e não vai enviar de lá. Um convite que não abre é pior que convite
// nenhum: gasta a boa vontade de quem quis ajudar.
//
// E por que NÃO detectar automaticamente: não há como saber pelo navegador qual
// cliente a pessoa usa; detecção aqui erraria em silêncio, que é o defeito que
// se está tentando evitar. Dois links nomeados deixam a escolha com quem sabe.

const DESTINO = 'nidi.gar@id.uff.br';

export interface LinksEmail {
  gmail: string;
  mailto: string;
  destino: string;
}

/** Gera os dois destinos a partir de UMA fonte, para assunto e corpo não divergirem. */
export function linksEmail(assunto: string, corpo: string): LinksEmail {
  const a = encodeURIComponent(assunto);
  const c = encodeURIComponent(corpo);
  return {
    // `view=cm` abre a janela de composição; `fs=1` em tela cheia. Se a pessoa
    // não estiver logada, o Gmail pede login e reabre a composição preenchida.
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(DESTINO)}&su=${a}&body=${c}`,
    mailto: `mailto:${DESTINO}?subject=${a}&body=${c}`,
    destino: DESTINO,
  };
}
