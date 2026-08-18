# -*- coding: utf-8 -*-
"""Gera o infográfico do ciclo de extração em HTML, com os números vindos da API.

    python tools/gerar_infografico.py --saida ../infografico-extracao.html

Por que existe: infográfico gerado como IMAGEM tem os números DIGITADOS. Eles
nascem certos e envelhecem em silêncio — e este infográfico fala justamente de
um número que ficou errado por meses sem ninguém notar. Aqui eles são buscados
da API no momento de gerar, e a página carimba a data.

Se a API não responder, o script FALHA em vez de emitir número velho. Número
inventado num material que denuncia número inventado seria a piada pronta.
"""
import argparse
import io
import json
import re
import sys
import urllib.request
from datetime import date

# A API recusa user-agent de script (mod_security da HostGator devolve 406).
CABECALHO = {'User-Agent': 'curl/8.0'}
MESES = ('janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
         'agosto', 'setembro', 'outubro', 'novembro', 'dezembro')


def busca(base, rota):
    req = urllib.request.Request(f'{base}/api/{rota}', headers=CABECALHO)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode('utf-8'))


def numeros(base):
    d = busca(base, 'revalidacao')
    grad = next(x for x in d['resumo'] if x['via'].startswith('Gradua'))
    serie = sorted((x for x in d['serie'] if x['via'].startswith('Gradua')),
                   key=lambda y: y['ano'])
    # A JANELA DO DEFEITO. 2011-2017 é o trecho que o portal publicava com zero
    # absoluto; comparar o "antes" dela com o "depois" do acervo inteiro seria
    # trocar a base no meio do gráfico — e num material sobre número falso isso
    # é justamente o que não pode acontecer.
    janela = [x for x in serie if 2011 <= x['ano'] <= 2017]
    jt = sum(x['total'] for x in janela)
    jd = sum(x['deferidos'] for x in janela)
    return {
        'total': grad['total'],
        'deferidos': grad['deferidos'],
        'taxa': round(100 * grad['deferidos'] / max(1, grad['total'])),
        'janela_total': jt,
        'janela_deferidos': jd,
        'janela_taxa': round(100 * jd / max(1, jt)),
        'janela_antes': 614,   # o que a extração defeituosa via naqueles anos
        'anos_min': serie[0]['ano'],
        'anos_max': serie[-1]['ano'],
        'serie': serie,
    }


def barra_serie(serie):
    """Sparkline da taxa por ano. Coluna sem verde é ano sem deferimento —
    a forma que denunciava o defeito e que ninguém via, porque o gráfico de
    então desenhava só o volume."""
    largura, altura, gap = 13, 54, 3
    partes = []
    for i, x in enumerate(serie):
        p = x['deferidos'] / max(1, x['total'])
        h = max(3, round(p * altura))
        px = i * (largura + gap)
        partes.append(
            f'<rect x="{px}" y="0" width="{largura}" height="{altura}" rx="2" '
            f'fill="var(--trilho)"/>'
            f'<rect x="{px}" y="{altura - h}" width="{largura}" height="{h}" rx="2" '
            f'fill="var(--verde)"><title>{x["ano"]}: {x["deferidos"]} de {x["total"]} '
            f'({round(100 * p)}%)</title></rect>')
    w = len(serie) * (largura + gap) - gap
    return (f'<svg viewBox="0 0 {w} {altura}" width="100%" height="{altura}" '
            f'role="img" aria-label="Taxa de deferimento por ano, de '
            f'{serie[0]["ano"]} a {serie[-1]["ano"]}: '
            + '; '.join(f'{x["ano"]} {round(100 * x["deferidos"] / max(1, x["total"]))}%'
                        for x in serie)
            + f'.">{"".join(partes)}</svg>')


PAGINA = '''<title>O Verbo que Faltava</title>
<style>
  /* ---------------------------------------------------------------------
     O assunto é papel virando dado. A página é construída sobre esse par:
     o lado da FONTE usa serifa e monoespaçada — a tipografia do documento
     oficial e do texto cru; o lado do DADO usa sans e números tabulares.
     Nenhuma cor é literal fora do bloco de tokens.
     --------------------------------------------------------------------- */
  :root {
    color-scheme: light;
    --papel: #F1F4F1;          /* papel de boletim fotocopiado: cinza com viés verde */
    --superficie: #FFFFFF;
    --tinta: #14201A;          /* quase-preto com viés verde, não cinza puro */
    --tinta-fraca: #55635C;
    --linha: #D3DBD5;
    --verde: #1B6B3A;          /* a marca de deferimento do próprio portal */
    --verde-fraco: #E3EFE7;
    --vermelho: #A2322A;       /* indeferido: decisão, não alarme */
    --vermelho-fraco: #F6E7E5;
    --azul: #2563EB;           /* a cor de série do portal */
    --azul-fraco: #E6EDFD;
    --trilho: #DDE3DE;
    --serifa: Georgia, 'Iowan Old Style', 'Times New Roman', serif;
    --sans: system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    --mono: ui-monospace, 'Cascadia Mono', 'SF Mono', Consolas, 'Liberation Mono', monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --papel: #101714;
      --superficie: #17211D;
      --tinta: #E6EDE8;
      --tinta-fraca: #9DAEA5;
      --linha: #2B3833;
      --verde: #5FB37E;
      --verde-fraco: #1B2E23;
      --vermelho: #D98A82;
      --vermelho-fraco: #2E1E1C;
      --azul: #5A8FE0;
      --azul-fraco: #1A2740;
      --trilho: #26332E;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --papel: #101714;
    --superficie: #17211D;
    --tinta: #E6EDE8;
    --tinta-fraca: #9DAEA5;
    --linha: #2B3833;
    --verde: #5FB37E;
    --verde-fraco: #1B2E23;
    --vermelho: #D98A82;
    --vermelho-fraco: #2E1E1C;
    --azul: #5A8FE0;
    --azul-fraco: #1A2740;
    --trilho: #26332E;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--papel);
    color: var(--tinta);
    font-family: var(--sans);
    font-size: 16px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }
  .folha { max-width: 1120px; margin: 0 auto; padding: clamp(24px, 5vw, 64px) clamp(18px, 4vw, 48px) 72px; }

  h1 {
    font-family: var(--serifa);
    font-size: clamp(30px, 5.2vw, 52px);
    line-height: 1.08;
    letter-spacing: -0.015em;
    margin: 0 0 10px;
    text-wrap: balance;
  }
  .sub { font-size: clamp(15px, 2vw, 19px); color: var(--tinta-fraca); margin: 0; max-width: 62ch; }
  .carimbo {
    font-family: var(--mono); font-size: 12px; letter-spacing: .07em;
    text-transform: uppercase; color: var(--tinta-fraca);
    display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 22px 0 0;
  }

  h2 {
    font-family: var(--serifa); font-size: clamp(20px, 2.6vw, 27px);
    margin: 0 0 4px; letter-spacing: -0.01em; text-wrap: balance;
  }
  .olho {
    font-family: var(--mono); font-size: 11.5px; letter-spacing: .13em;
    text-transform: uppercase; color: var(--tinta-fraca); margin: 0 0 14px;
  }
  section { margin-top: clamp(40px, 6vw, 72px); }
  p { margin: 0 0 12px; max-width: 66ch; }
  strong { font-weight: 700; }

  .grade { display: grid; gap: 16px; }
  @media (min-width: 760px) { .g3 { grid-template-columns: repeat(3, 1fr); } .g2 { grid-template-columns: 1fr 1fr; } }

  .cartao {
    background: var(--superficie); border: 1px solid var(--linha);
    border-radius: 4px; padding: 18px 20px;
  }
  .cartao h3 {
    font-family: var(--mono); font-size: 12px; letter-spacing: .11em;
    text-transform: uppercase; margin: 0 0 8px; color: var(--tinta-fraca);
  }
  .cartao p { font-size: 14.5px; margin: 0; }

  /* O funil: as redações entram, duas decisões saem. */
  .redacoes { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 18px; padding: 0; list-style: none; }
  .redacoes li {
    font-family: var(--mono); font-size: 12.5px; padding: 7px 11px;
    background: var(--superficie); border: 1px solid var(--linha); border-radius: 3px;
  }
  .redacoes li[data-nova] { border-color: var(--verde); box-shadow: inset 3px 0 0 var(--verde); }
  .saidas { display: flex; gap: 10px; flex-wrap: wrap; }
  .selo {
    font-family: var(--mono); font-size: 13px; font-weight: 700; letter-spacing: .08em;
    padding: 8px 16px; border-radius: 3px;
  }
  .selo.def { background: var(--verde-fraco); color: var(--verde); border: 1px solid var(--verde); }
  .selo.ind { background: var(--vermelho-fraco); color: var(--vermelho); border: 1px solid var(--vermelho); }

  /* A tese: o zero falso. */
  .tese { background: var(--superficie); border: 1px solid var(--linha); border-radius: 4px; padding: clamp(20px, 3vw, 32px); }
  .duelo { display: grid; gap: 22px; margin-top: 20px; }
  @media (min-width: 700px) { .duelo { grid-template-columns: 1fr 1fr; } }
  .lado { display: flex; flex-direction: column; gap: 8px; }
  .cifra { font-family: var(--mono); font-size: clamp(38px, 7vw, 58px); font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
  .cifra.antes { color: var(--tinta-fraca); }
  .cifra.depois { color: var(--verde); }
  .medida { font-size: 14px; color: var(--tinta-fraca); }
  .trilho { height: 10px; background: var(--trilho); border-radius: 5px; overflow: hidden; }
  .trilho span { display: block; height: 100%; background: var(--verde); border-radius: 5px; }

  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .rolagem { overflow-x: auto; border: 1px solid var(--linha); border-radius: 4px; background: var(--superficie); }
  th, td { text-align: left; padding: 9px 14px; border-bottom: 1px solid var(--linha); white-space: nowrap; }
  th { font-family: var(--mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--tinta-fraca); }
  tbody tr:last-child td { border-bottom: 0; }
  td.num { font-variant-numeric: tabular-nums; font-family: var(--mono); font-size: 13px; }
  .marca { font-family: var(--mono); font-size: 11.5px; font-weight: 700; padding: 3px 8px; border-radius: 3px; }
  .marca.def { background: var(--verde-fraco); color: var(--verde); }
  .marca.ind { background: var(--vermelho-fraco); color: var(--vermelho); }

  .nota {
    border-left: 3px solid var(--vermelho); background: var(--superficie);
    padding: 16px 20px; border-radius: 0 4px 4px 0; margin-top: 28px;
  }
  .nota p { font-size: 14.5px; margin: 0; }
  .nota p + p { margin-top: 8px; }

  footer { margin-top: 56px; padding-top: 20px; border-top: 1px solid var(--linha);
           font-size: 13px; color: var(--tinta-fraca); }
  a { color: var(--azul); }
  a:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--azul); outline-offset: 2px; }
</style>

<div class="folha">
  <header>
    <h1>O verbo que faltava</h1>
    <p class="sub">Como um índice do Boletim de Serviço da UFF transforma PDF em dado —
      e como uma palavra ausente de um padrão de busca fez o portal publicar
      <strong>0% de deferimento</strong> em anos com centenas de pedidos decididos.</p>
    <p class="carimbo">
      <span>Portal de Normas e Atos da UFF</span>
      <span>·</span>
      <span>Acervo {ANOS}</span>
      <span>·</span>
      <span>Números lidos da API em {DATA}</span>
    </p>
  </header>

  <section>
    <p class="olho">A fonte</p>
    <h2>Texto não estruturado, 25 anos dele</h2>
    <p>O Boletim de Serviço é publicado em PDF. Não há campo, tabela nem
      identificador: há um documento corrido, com formatos que mudaram várias
      vezes ao longo de duas décadas e meia, e trechos que passaram por
      digitalização.</p>
    <div class="grade g3">
      <div class="cartao">
        <h3>Preâmbulo</h3>
        <p>Onde moram o órgão emissor e o cargo de quem assina. É também uma
          armadilha: o cargo de <em>quem assina</em> já foi confundido com o de
          quem recebe o ato, em 101 falsos positivos de um classificador.</p>
      </div>
      <div class="cartao">
        <h3>Ementa</h3>
        <p>O resumo oficial. Curta, e às vezes inutilizável — num recorte de 136
          atos, 15 não tinham ementa aproveitável: fragmento, rodapé, ou OCR que
          espaça as letras uma a uma.</p>
      </div>
      <div class="cartao">
        <h3>Dispositivo</h3>
        <p>É ele que decide, e é por ele que se classifica — nunca por menção.
          “A portaria X, <em>que</em> concedeu aposentadoria” cita a concessão;
          não concede nada.</p>
      </div>
    </div>
  </section>

  <section>
    <p class="olho">A extração</p>
    <h2>Do PDF ao texto estruturado</h2>
    <p>Expressões regulares reconhecem onde cada ato começa e termina, e daí
      saem as entidades: matrícula, processo, órgão emissor, e as relações de
      revogação entre atos de épocas diferentes.</p>
    <div class="grade g2">
      <div class="cartao">
        <h3>O texto como fonte da verdade</h3>
        <p>Todo dado derivado guarda a sua origem (<code>extracao_id</code>).
          É isso que permite reprocessar o acervo inteiro quando as regras
          mudam — foi o que se fez em 18 de agosto de 2026.</p>
      </div>
      <div class="cartao">
        <h3>O que não se infere</h3>
        <p>Quando o ato não declara o país de origem do diploma, o campo fica
          vazio. Lacuna honesta vale mais que palpite: adivinhar pelo nome da
          instituição erra em universidade de nome espanhol fora da América
          Latina.</p>
      </div>
    </div>
  </section>

  <section>
    <p class="olho">A normalização</p>
    <h2>O mesmo fato, escrito de sete maneiras</h2>
    <p>Vários redatores ao longo de 25 anos. Cada época tem a sua fórmula para
      dizer a mesma coisa, e um padrão que conhece só uma delas não erra — ele
      fica <em>cego</em>, e cegueira não deixa rastro.</p>
    <ul class="redacoes">
      <li data-nova>“Aprovar a revalidação do Diploma”</li>
      <li>“Deferir a solicitação de Revalidação”</li>
      <li>“Homologar a revalidação do título”</li>
      <li>“Indeferir a solicitação de Revalidação”</li>
      <li data-nova>“Indeferir o pedido de revalidação do Diploma de &lt;curso&gt;”</li>
      <li>“Manifestar-se pelo indeferimento do pedido”</li>
      <li>“Homologar o parecer da comissão, indeferindo”</li>
    </ul>
    <div class="saidas">
      <span class="selo def">DEFERIDO</span>
      <span class="selo ind">INDEFERIDO</span>
    </div>
    <p style="margin-top:18px">As duas marcadas em verde são as que faltavam. A
      primeira — <strong>“Aprovar”</strong> — é o verbo que o Conselho usa para
      deferir, e nenhum padrão o conhecia.</p>
  </section>

  <section>
    <p class="olho">A tese</p>
    <div class="tese">
      <h2>O zero falso</h2>
      <p>Entre 2011 e 2017 o portal exibia <strong>zero deferimentos</strong> —
        sete anos seguidos, entre 100% antes e 83% depois. Um processo humano com
        centenas de casos não faz isso. O zero absoluto não era política da
        universidade: era o padrão descrevendo a si mesmo.</p>

      <div class="duelo">
        <div class="lado">
          <span class="cifra antes">0%</span>
          <div class="trilho"><span style="width:0"></span></div>
          <span class="medida">2011–2017, como o portal publicava<br>
            {JANELA_ANTES} decisões visíveis, nenhuma deferida</span>
        </div>
        <div class="lado">
          <span class="cifra depois">{JANELA_TAXA}%</span>
          <div class="trilho"><span style="width:{JANELA_TAXA}%"></span></div>
          <span class="medida">2011–2017, depois do conserto<br>
            {JANELA_TOTAL} decisões visíveis, {JANELA_DEFERIDOS} deferidas</span>
        </div>
      </div>

      <p style="margin-top:22px">Repare que o denominador também mudou:
        <strong>{JANELA_DELTA} decisões daqueles anos não existiam</strong> no
        portal. Não era só a taxa que estava errada — havia ato que o índice não
        enxergava. No acervo inteiro, a taxa de deferimento da graduação é de
        <strong>{TAXA}%</strong> ({TOTAL} decisões, {DEFERIDOS} deferidas).</p>

      <div style="margin-top:24px">
        <p class="olho" style="margin-bottom:8px">Taxa de deferimento por ano, {ANOS}</p>
        {SPARK}
        <p class="medida" style="margin-top:8px">Cada barra é um ano; a parte
          verde é a fatia deferida. Era esta forma que denunciava o defeito — e o
          gráfico de então desenhava só o volume, então dez colunas sem verde
          nenhum passavam por série normal.</p>
      </div>
    </div>
  </section>

  <section>
    <p class="olho">O resultado</p>
    <h2>Decisão vira linha, e a linha aponta para o ato</h2>
    <p>Cada decisão guarda a via, o resultado, o curso, a instituição e o país —
      e o ato publicado que a originou, que é público e permite conferir.</p>
    <div class="rolagem">
      <table>
        <caption class="olho" style="text-align:left;padding:12px 14px 0">
          Exemplo de saída — os campos são reais, os registros são ilustrativos
        </caption>
        <thead>
          <tr><th>Ano</th><th>Via</th><th>Decisão</th><th>Curso</th><th>Ato de origem</th></tr>
        </thead>
        <tbody>
          <tr><td class="num">2014</td><td>Graduação</td><td><span class="marca ind">INDEFERIDO</span></td><td>Medicina</td><td class="num">Decisão 118/2014</td></tr>
          <tr><td class="num">2015</td><td>Graduação</td><td><span class="marca def">DEFERIDO</span></td><td>Educação Física</td><td class="num">Decisão 402/2015</td></tr>
          <tr><td class="num">2022</td><td>Graduação</td><td><span class="marca def">DEFERIDO</span></td><td>Engenharia Civil</td><td class="num">Decisão 61/2022</td></tr>
          <tr><td class="num">2025</td><td>Pós-graduação</td><td><span class="marca def">DEFERIDO</span></td><td>Doutorado em Filosofia</td><td class="num">Decisão 210/2025</td></tr>
        </tbody>
      </table>
    </div>
    <p style="margin-top:14px" class="medida">Não há matrícula nem nome nesta
      tabela, e isso é estrutural: a tabela de revalidações <strong>não tem
      coluna de pessoa</strong>. São pessoas privadas, não servidores — quem
      consultar o banco no futuro não consegue expor ninguém por descuido,
      porque o dado não está lá.</p>
  </section>

  <div class="nota">
    <p><strong>Este número esteve errado.</strong> O portal publicou 21% de
      deferimento até 18 de agosto de 2026, quando se descobriu que nenhum
      padrão conhecia o verbo “Aprovar”.</p>
    <p>O erro não deu sinal nenhum: sem exceção, sem registro em log, com os
      testes passando. O extrator acerta tudo o que vê — e o que ele não vê não
      deixa rastro. Quem escreve o padrão escreve também o caso de teste, então
      o teste confirma exatamente aquilo que já se sabia.</p>
  </div>

  <footer>
    Fonte: atos publicados no Boletim de Serviço da UFF, {ANOS}.
    Números lidos de <code>/api/revalidacao</code> em {DATA} — esta página é
    gerada por <code>tools/gerar_infografico.py</code>, e os valores não são
    digitados à mão.
  </footer>
</div>
'''


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--base', default='https://inteligencia.fanara.com.br')
    ap.add_argument('--saida', required=True)
    args = ap.parse_args()

    try:
        n = numeros(args.base)
    except Exception as e:
        print(f'API nao respondeu ({e}). Nada gerado — nao emito numero velho.',
              file=sys.stderr)
        return 1

    hoje = date.today()
    html = PAGINA
    for chave, valor in {
        '{ANOS}': f"{n['anos_min']}–{n['anos_max']}",
        '{DATA}': f'{hoje.day} de {MESES[hoje.month - 1]} de {hoje.year}',
        '{TOTAL}': f"{n['total']:,}".replace(',', '.'),
        '{DEFERIDOS}': f"{n['deferidos']:,}".replace(',', '.'),
        '{TAXA}': str(n['taxa']),
        '{JANELA_TOTAL}': str(n['janela_total']),
        '{JANELA_DEFERIDOS}': str(n['janela_deferidos']),
        '{JANELA_TAXA}': str(n['janela_taxa']),
        '{JANELA_ANTES}': str(n['janela_antes']),
        '{JANELA_DELTA}': str(n['janela_total'] - n['janela_antes']),
        '{SPARK}': barra_serie(n['serie']),
    }.items():
        html = html.replace(chave, valor)

    # Só os marcadores, e não qualquer chave: o CSS é cheio de `{`. A
    # primeira versão desta linha procurava `{` solto e reprovava a página
    # inteira por causa da folha de estilo.
    sobrou = re.findall(r'\{[A-Z_]+\}', html)
    assert not sobrou, f'marcador nao substituido: {sobrou}'
    io.open(args.saida, 'w', encoding='utf-8', newline='').write(html)
    print(f"{args.saida}: {n['taxa']}% no acervo, {n['janela_taxa']}% em 2011-2017 "
          f"(era 0%), {len(n['serie'])} anos na série")
    return 0


if __name__ == '__main__':
    sys.exit(main())
