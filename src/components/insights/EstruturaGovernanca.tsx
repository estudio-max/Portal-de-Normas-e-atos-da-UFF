import React, { useEffect, useState } from 'react';
import { Landmark, ExternalLink, Loader2 } from 'lucide-react';
import * as ds from '../../dataSource';

// ESTRUTURA DE GOVERNANÇA DECLARADA × EVIDÊNCIA NO BOLETIM
//
// O Relatório de Gestão Integrado 2025 da UFF declara, na Figura 2.4, quais são
// as instâncias internas de governança da universidade. Ele afirma que a
// estrutura EXISTE — e não diz quando cada parte dela agiu pela última vez.
//
// O Boletim diz. Este painel põe as duas coisas lado a lado, e é a única
// pergunta desta aba que um relatório de gestão não responde sozinho: é a que
// órgão de controle faz.
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

// Os três estados vêm da própria rota /api/comissoes, que já os calcula sobre a
// janela configurada. Aqui só se traduz para linguagem de leitor.
// A ORDEM é do leitor, não do alfabeto. Primeiro o que diz respeito à
// INSTITUIÇÃO — instância declarada que não registra atividade —, e só depois a
// lacuna que é NOSSA (colegiado ainda fora do catálogo). Inverter isso põe
// tarefa de curadoria do portal na frente de sinal de governança.
const ESTADO: Record<string, { rotulo: string; cor: string; ordem: number }> = {
  sem_recente: { rotulo: 'sem registro recente', cor: 'bg-amber-50 text-amber-800 border-amber-200', ordem: 0 },
  insuficiente: { rotulo: 'dados insuficientes', cor: 'bg-slate-100 text-slate-600 border-slate-200', ordem: 1 },
  recente: { rotulo: 'com evidência recente', cor: 'bg-emerald-50 text-emerald-700 border-emerald-200', ordem: 3 },
};
/** Sem corpo no catálogo: entre o "insuficiente" e o "com evidência". */
const ORDEM_SEM_CATALOGO = 2;

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

  // Painel de gestão abre pelo que falta.
  const peso = (l: typeof linhas[0]) =>
    !l.corpo ? ORDEM_SEM_CATALOGO : (ESTADO[l.corpo.estado]?.ordem ?? ORDEM_SEM_CATALOGO);
  linhas.sort((a, b) => peso(a) - peso(b));

  const semRecente = linhas.filter(l => l.corpo?.estado === 'sem_recente').length;
  const foraDoCatalogo = linhas.filter(l => !l.corpo).length;

  return (
    <div>
      <p className="text-[12px] text-slate-500 leading-relaxed mb-3">
        As instâncias que o <strong>Relatório de Gestão Integrado {RGI_VERSAO}</strong> declara como
        a estrutura interna de governança da UFF, ao lado da <strong>última evidência
        documental</strong> de cada uma no Boletim de Serviço. O relatório afirma que a estrutura
        existe; esta coluna mostra quando cada parte dela agiu.
      </p>

      <ul className="space-y-1.5">
        {linhas.map(l => {
          const est = l.corpo ? ESTADO[l.corpo.estado] : null;
          const data = fmtData(l.corpo?.ultimaData ?? null);
          return (
            <li key={l.nome}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-700 leading-snug">{l.nome}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {l.corpo
                    ? <>{l.corpo.atos} ato(s) no acervo{data && <> · último em <strong className="text-slate-600">{data}</strong></>}</>
                    : <span className="italic">não consta do catálogo de colegiados do portal</span>}
                </p>
              </div>
              <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                est ? est.cor : 'bg-slate-50 text-slate-400 border-dashed border-slate-300'}`}>
                {est ? est.rotulo : 'não catalogado'}
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
            <strong>{semRecente}</strong> {semRecente === 1 ? 'instância declarada está' : 'instâncias declaradas estão'}{' '}
            <strong>sem registro recente</strong> no Boletim. Isso é um ponto a verificar, não uma
            conclusão: um colegiado pode deliberar sem que o ato seja publicado.
          </p>
        )}
        {foraDoCatalogo > 0 && (
          <p className={semRecente > 0 ? 'mt-1.5' : undefined}>
            <strong>{foraDoCatalogo}</strong> {foraDoCatalogo === 1 ? 'instância ainda não está' : 'instâncias ainda não estão'}{' '}
            no catálogo de colegiados do portal — lacuna de curadoria nossa, que o próprio
            relatório ajuda a fechar.
          </p>
        )}
        <p className="mt-2 text-[11px] text-slate-400">
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
