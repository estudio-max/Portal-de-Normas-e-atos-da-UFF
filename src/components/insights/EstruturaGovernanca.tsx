import React, { useEffect, useState } from 'react';
import { Landmark, ExternalLink, Loader2 } from 'lucide-react';
import * as ds from '../../dataSource';

// ESTRUTURA DE GOVERNANÇA DECLARADA × ÚLTIMA PUBLICAÇÃO NO BOLETIM
//
// O Relatório de Gestão Integrado 2025 da UFF declara, na Figura 2.4, quais são
// as instâncias internas de governança da universidade. Este painel põe essa
// lista ao lado da data em que o Boletim publicou algo sobre cada uma.
//
// O QUE ESTE PAINEL MEDE, E O QUE ELE NÃO MEDE. Ele mede a data do último ato
// que menciona o colegiado. Não mede atividade deliberativa — e a diferença é
// grande, porque o que o Boletim publica sobre um colegiado é, quase sempre, a
// RENOVAÇÃO DA COMPOSIÇÃO dele. Os 22 atos da CIS, por exemplo, são o ato que a
// constituiu para o triênio 2023-2026 mais toda a maquinaria eleitoral que
// escolheu os representantes; só o CGIRC emite decisões próprias em volume.
// Portanto "sem publicação desde X" lê-se «a composição não é renovada desde
// X», não «o colegiado não trabalha».
//
// POR QUE O ANO APARECE NO SELO. A primeira versão marcava tudo que passou da
// janela como "sem registro recente", e isso punha lado a lado a CIS (triênio
// correndo, constituída em 2023) e a Comissão Permanente de Telefonia (último
// ato em 2011) com o mesmo rótulo âmbar. Um mandato em curso e um colegiado
// provavelmente extinto pareciam a mesma coisa. Com o ano na cara, o leitor
// distingue — e a ordenação é pelo TEMPO DE SILÊNCIO, para os casos de 15 e 21
// anos ficarem no topo, que é onde mora a pergunta de verdade: isto ainda
// existe?
//
// A cor continua saindo do `estado` que a rota /api/comissoes calcula, e não de
// um gradiente meu: se esta aba classificasse por conta própria, ela e a aba
// Comissões passariam a discordar sobre o mesmo colegiado.
//
// A LISTA É CURADORIA, e é DATADA — sai da Figura 2.4 do RGI 2025 (p.15).
// Quando sair o RGI seguinte, remeça: instância pode entrar, sair ou mudar de
// nome. Mesmo princípio do `pdi_versao` no catálogo de políticas — âncora em
// documento oficial vale enquanto valer o documento.
//
// Ouvidoria, Corregedoria, Auditoria Interna e Procuradoria aparecem na mesma
// figura e NÃO entram aqui: são órgãos executivos permanentes, não colegiados.
// O catálogo de comissões do portal cobre colegiado, e misturar as duas coisas
// tornaria o "sem registro recente" ininterpretável — um órgão não se reúne.

const RGI_VERSAO = '2025';
const RGI_URL = 'https://www.uff.br/wp-content/uploads/2026/03/RGI-2025-PROVA-04.pdf';

/** Instância declarada na Figura 2.4, e o slug com que o portal a conhece.
 *  `slug: null` = o RGI declara e o catálogo do portal ainda não tem. */
const DECLARADAS: { nome: string; slug: string | null }[] = [
  { nome: 'Comitê de Governança, Integridade, Riscos e Controles', slug: 'cgirc' },
  { nome: 'Comitê de Gestão da Integridade', slug: 'cgi' },
  { nome: 'Comitê de Governança Digital', slug: 'gov-dig' },
  { nome: 'Comissão de Ética', slug: 'etica' },
  { nome: 'Comissão Própria de Avaliação', slug: 'cpa' },
  { nome: 'Comissão Permanente de Pessoal Docente', slug: 'cppd' },
  { nome: 'Comissão Interna de Supervisão do PCCTAE', slug: 'cis' },
  { nome: 'Grupo Gestor de Apoio à Governança', slug: null },
  { nome: 'Comitê de Planejamento e Execução', slug: null },
  { nome: 'Comitê Acadêmico de Planejamento e Execução Estratégica', slug: null },
];

const fmtData = (s: string | null) =>
  s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : null;

const ano = (s: string | null) => (s && /^\d{4}/.test(s) ? s.slice(0, 4) : null);

/** A cor sai do `estado` da rota; o TEXTO leva o ano, que é o discriminador. */
const COR: Record<string, string> = {
  sem_recente: 'bg-amber-50 text-amber-800 border-amber-200',
  insuficiente: 'bg-slate-100 text-slate-600 border-slate-200',
  recente: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function selo(corpo: ds.ComissaoCorpo): string {
  const a = ano(corpo.ultimaData);
  if (!a) return 'sem ato localizado';
  if (corpo.estado === 'recente') return `publicou em ${a}`;
  if (corpo.estado === 'insuficiente') return `dados insuficientes · ${a}`;
  return `sem publicação desde ${a}`;
}

export function EstruturaGovernanca() {
  const [r, setR] = useState<ds.ComissoesResp | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    ds.getComissoes().then(setR).catch(() => setR(null)).finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return (
      <div className="flex items-center gap-2 justify-center py-8 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando a estrutura…
      </div>
    );
  }
  if (!r) {
    return <p className="text-[13px] text-slate-400 py-6 text-center">
      Estrutura indisponível — a consulta ao banco não respondeu.
    </p>;
  }

  const porSlug = new Map<string, ds.ComissaoCorpo>(r.corpos.map(c => [c.slug, c] as const));
  const linhas = DECLARADAS.map(d => ({ ...d, corpo: d.slug ? porSlug.get(d.slug) ?? null : null }));

  // Ordena pelo TEMPO DE SILÊNCIO: a data mais antiga primeiro. É o que põe os
  // 15 e 21 anos no topo — onde está a pergunta que importa. Colegiado ainda
  // fora do catálogo vai para o fim: é lacuna nossa, não sinal da instituição.
  linhas.sort((a, b) => {
    if (!a.corpo && !b.corpo) return 0;
    if (!a.corpo) return 1;
    if (!b.corpo) return -1;
    return (a.corpo.ultimaData ?? '').localeCompare(b.corpo.ultimaData ?? '');
  });

  const semRecente = linhas.filter(l => l.corpo?.estado === 'sem_recente').length;
  const foraDoCatalogo = linhas.filter(l => !l.corpo).length;

  return (
    <div>
      <p className="text-[12px] text-slate-500 leading-relaxed mb-3">
        As instâncias que o <strong>Relatório de Gestão Integrado {RGI_VERSAO}</strong> declara como
        a estrutura interna de governança da UFF, ordenadas pelo <strong>tempo desde a última
        publicação</strong> no Boletim. O que o Boletim publica sobre um colegiado é, quase sempre,
        a <strong>renovação da composição</strong> dele — então leia esta coluna como “há quanto
        tempo a composição não é renovada”, e não como medida de atividade.
      </p>

      <ul className="space-y-1.5">
        {linhas.map(l => {
          const data = fmtData(l.corpo?.ultimaData ?? null);
          return (
            <li key={l.nome}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-700 leading-snug">{l.nome}</p>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  {l.corpo
                    ? <>{l.corpo.atos} ato(s) no acervo{data && <> · último em <strong className="text-slate-600">{data}</strong></>}</>
                    : <span className="italic">não consta do catálogo de colegiados do portal</span>}
                </p>
              </div>
              <span className={`shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded border ${
                l.corpo ? (COR[l.corpo.estado] ?? COR.insuficiente)
                        : 'bg-slate-50 text-slate-400 border-dashed border-slate-300'}`}>
                {l.corpo ? selo(l.corpo) : 'não catalogado'}
              </span>
            </li>
          );
        })}
      </ul>

      {/* A leitura em uma frase — e ela precisa ser cuidadosa nos dois sentidos:
          ausência de registro no Boletim NÃO é ausência de atividade, e falta no
          catálogo é lacuna nossa, não da universidade. */}
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[12px] text-slate-600 leading-relaxed">
        {semRecente > 0 && (
          <p>
            <strong>{semRecente}</strong> {semRecente === 1 ? 'instância declarada não tem' : 'instâncias declaradas não têm'}{' '}
            publicação no Boletim dentro da janela. <strong>O ano diz o que investigar</strong>:
            silêncio de dois ou três anos costuma ser mandato em curso — a composição foi
            constituída e nada mais precisou ser publicado; silêncio de dez ou mais anos levanta
            outra pergunta, a de se o colegiado ainda existe. Em nenhum dos casos isto é conclusão:
            um colegiado pode deliberar sem que o ato saia no Boletim.
          </p>
        )}
        {foraDoCatalogo > 0 && (
          <p className={semRecente > 0 ? 'mt-1.5' : undefined}>
            <strong>{foraDoCatalogo}</strong> {foraDoCatalogo === 1 ? 'instância ainda não está' : 'instâncias ainda não estão'}{' '}
            no catálogo de colegiados do portal — lacuna de curadoria nossa, que o próprio
            relatório ajuda a fechar.
          </p>
        )}
        <p className="mt-2 text-[12px] text-slate-400">
          Fonte da estrutura:{' '}
          <a href={RGI_URL} target="_blank" rel="noreferrer"
            className="underline hover:text-[#003366]">
            RGI {RGI_VERSAO}, Figura 2.4 <ExternalLink className="w-3 h-3 inline -mt-0.5" />
          </a>
          . A lista é curada e datada: quando sair o relatório seguinte, precisa ser remedida.
        </p>
      </div>
    </div>
  );
}

export const IconeGovernanca = Landmark;
