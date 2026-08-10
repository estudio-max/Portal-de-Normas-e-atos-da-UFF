import React, { useState } from 'react';
import { FolderSearch, Printer, Search, Loader2, Info, AlertTriangle, ExternalLink, UserSearch } from 'lucide-react';
import * as ds from '../../dataSource';
import { RecordCard, RecordCardList, DesktopTable } from '../ui/RecordCard';
import { requisitosDoAto, requisitosDaFuncao, REQUISITOS, type Requisito } from './rscRequisitos';

// Aba "Meu SIAPE": digite a matrícula, receba os atos do Boletim que a citam,
// com a referência do BS — para instruir processo.
//
// Foi fechada por senha (Gestão de Pessoal) até 18/07/2026. Aberta por decisão
// do mantenedor: com o RSC, o público desta consulta é o próprio servidor
// procurando os seus registros. Os atos são os mesmos já públicos no BS; a
// consulta é gerada na hora e nada é gravado.
//
// Por que esta aba existe: o RSC-PCCTAE — Decreto 13.048/2026, regulamentado na
// UFF pela IN GAR/RET/UFF nº 129, de 24/07/2026 — pontua, no Requisito I,
// participação em comissões, comitês, grupos de trabalho e núcleos; no IV,
// designação para responsabilidade técnico-administrativa; no V, exercício de
// CD/FG. Para pleitear, o servidor precisa achar os atos e dizer em que boletim
// saíram. Achar isso lendo 25 anos de PDF é inviável. E o art. 19, parágrafo
// único, I da IN é explícito ao aceitar "portarias, resoluções ou atos de
// designação ou nomeação" como prova — que é o que esta aba entrega.
// Os selos por requisito vivem em `rscRequisitos.ts`; leia o cabeçalho de lá
// antes de mexer, em especial sobre por que NÃO se diz "elegível".
//
// O que a aba afirma e o que NÃO afirma: ela afirma que EXISTE um ato publicado
// que cita esta matrícula, e diz onde ele está. Só isso. Ela NÃO afirma que a
// pessoa participou (ato_pessoa é menção — numa banca de progressão o avaliado
// também é citado), NÃO afirma que a lista é completa (30–70% dos atos não
// trazem SIAPE nenhum) e NÃO pontua: quem apura o Anexo I é a CRSC-PCCTAE. Se o
// portal apurasse e subnotificasse, o servidor perderia ponto por erro nosso.
// Assistiva, como Prazos e Mandatos: sempre confira o ato.

const fmtData = (s: string | null) =>
  s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10).split('-').reverse().join('/') : '—';

// A referência do BS é o produto: é o que o servidor copia para o processo.
const refBS = (a: ds.DossieAto) => {
  const p: string[] = [];
  if (a.bsNumero) p.push(`BS nº ${a.bsNumero}${a.bsAno ? '/' + a.bsAno : ''}`);
  if (a.secao) p.push(`Seção ${a.secao}`);
  if (a.pagina) p.push(`p. ${a.pagina}`);
  return p.join(', ') || '—';
};
const rotuloAto = (a: ds.DossieAto) =>
  `${a.tipo}${a.sigla ? ' ' + a.sigla : ''} nº ${a.numero}/${a.ano}`;

const esc = (s: string) =>
  (s || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m] as string));

// Selo de Requisito do RSC. Índigo de propósito: o âmbar já é "ato não vigente"
// e o vermelho é "nome divergente" — três avisos na mesma cor viram um só.
// O `title` carrega o texto do requisito porque o selo é curto por necessidade
// (cabe na tabela) e sozinho não explica nada.
const SeloRSC = ({ reqs }: { reqs: Requisito[] }) =>
  reqs.length ? (
    <>
      {reqs.map(r => (
        <span
          key={r}
          title={`RSC-PCCTAE · Requisito ${r} (${REQUISITOS[r].anexo} da IN 129/2026): ${REQUISITOS[r].titulo}. Confira o ato: quem avalia é a CRSC-UFF.`}
          className="ml-1.5 inline-block rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 align-middle"
        >
          RSC · Req. {r}
        </span>
      ))}
    </>
  ) : null;

// Matrícula e nome viajam por caminhos independentes na API: o SIAPE decide os
// blocos 1 e 2, o nome decide o 3º, e nada confrontava os dois. Digitar a
// matrícula de um e o nome de outro não dava erro — a tela juntava as duas
// pessoas sob um cabeçalho só, e desde 05/08/2026 o PDF imprime as duas juntas.
// Medido em produção: SIAPE 1396932 (Denise) + o nome de outra servidora trouxe
// 11 atos alheios, um deles instauração de PAD. Num documento anexado a
// processo de RSC, atribuir a alguém ato que não é dele é o pior erro possível
// — a mesma razão do aviso de `nomesDistintos`, por outra porta.
//
// A comparação é TOLERANTE de propósito. "Denise Rosas" e "Denise Aparecida de
// Miranda Rosas" são a mesma pessoa; nome de casada acrescenta sobrenome; e
// aviso que pisca à toa é aviso que ninguém lê. Só acusa quando NENHUM nome do
// registro contém o digitado nem está contido nele.
const PARTICULAS = new Set(['de', 'da', 'do', 'dos', 'das', 'e']);
const tokensNome = (s: string): string[] =>
  (s || '')
    // NFD separa a letra do acento, e `\p{M}` APAGA o acento. Deixar que ele
    // caia no filtro de pontuação abaixo não serve: a marca fica no MEIO da
    // palavra ("Antônio" = anto+U+0302+nio) e viraria separador, partindo o
    // token em dois. Medido: quebrava Antônio, Conceição, Inês — o aviso
    // dispararia em consulta legítima, que é o pior defeito que ele pode ter.
    // `\p{M}` em vez da classe literal: o fonte fica ASCII e sobrevive a
    // reencode do arquivo.
    .normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(t => t.length >= 3 && !PARTICULAS.has(t));  // <3 = inicial abreviada

// true = confere, ou não há o que confrontar (matrícula fora da base, campo
// vazio). Na dúvida NÃO acusa: o custo de um falso alarme aqui é a pessoa
// desconfiar do dossiê inteiro.
const nomeConfere = (digitado: string, registrados: string[]): boolean => {
  const d = tokensNome(digitado);
  if (!d.length || !registrados.length) return true;
  return registrados.some(n => {
    const g = tokensNome(n);
    if (!g.length) return true;
    return d.every(t => g.includes(t)) || g.every(t => d.includes(t));
  });
};

export default function DossieApi() {
  const [siape, setSiape] = useState('');
  const [nome, setNome] = useState('');
  const [r, setR] = useState<ds.DossieResp | null>(null);
  const [falha, setFalha] = useState<'senha' | 'falha' | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [buscou, setBuscou] = useState(false);

  const apiMode = ds.modo() === 'api';

  // Nome digitado × dono da matrícula. Vive aqui, e não dentro do imprimir(),
  // para que tela e PDF não possam divergir sobre a mesma consulta.
  const divergente = !!r?.porNome && !nomeConfere(r.porNome.termo, r.nomes);

  // Requisitos do RSC presentes neste dossiê. Só conta o que a pessoa vai ver
  // com selo: os atos achados pela MATRÍCULA e as funções. O bloco por nome
  // fica de fora do resumo de propósito — ele pode ser de outra pessoa (ver
  // `divergente`), e resumir os dois juntos daria um número que mistura gente.
  const resumoRSC = React.useMemo(() => {
    const m = new Map<Requisito, number>();
    if (r) {
      for (const f of r.funcoes) for (const q of requisitosDaFuncao(f)) m.set(q, (m.get(q) ?? 0) + 1);
      for (const a of r.atos) for (const q of requisitosDoAto(a)) m.set(q, (m.get(q) ?? 0) + 1);
    }
    return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0]));
  }, [r]);

  const buscar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const s = siape.replace(/\D/g, '');
    if (!s) return;
    setCarregando(true);
    setBuscou(true);
    try {
      const ret = await ds.getDossie(s, nome);
      setR(ret.dados);
      // 'senha' = a API no servidor ainda é a versão antiga, que exigia senha.
      setFalha(ret.motivo === 'ok' ? null : ret.motivo === 'senha' ? 'senha' : 'falha');
    } finally {
      setCarregando(false);
    }
  };

  const imprimir = () => {
    if (!r) return;
    const ident = `${esc(r.nomes.join(' · ') || 'nome não identificado')} (SIAPE ${esc(r.siape)})`;
    // O requisito vai numa COLUNA própria, não colado no rótulo do ato: quem
    // instrui o processo organiza a documentação "na ordem dos requisitos"
    // (art. 18, §3º), e uma coluna se ordena e se confere; um sufixo, não.
    const selo = (reqs: Requisito[]) =>
      reqs.length ? reqs.map(q => `Req. ${q}`).join('<br>') : '—';
    const linhasF = r.funcoes.map(f =>
      `<tr><td>${esc(f.acao === 'designar' ? 'Designação' : 'Dispensa')}</td><td>${esc(f.cargo)}</td>` +
      `<td>${esc(f.unidade)}</td><td>${fmtData(f.dataAto)}</td><td>${esc(f.atoLabel)}</td>` +
      `<td class="rsc">${selo(requisitosDaFuncao(f))}</td></tr>`).join('');
    const linhaAto = (a: ds.DossieAto) =>
      `<tr><td>${esc(rotuloAto(a))}</td><td>${fmtData(a.dataAto)}</td><td>${esc(a.ementa || '—')}</td>` +
      `<td>${esc(refBS(a))}</td><td class="rsc">${selo(requisitosDoAto(a))}</td></tr>`;
    const linhasA = r.atos.map(linhaAto).join('');
    // O 3º bloco — atos achados pelo NOME — ficava de fora do PDF até
    // 05/08/2026, e o efeito era o pior possível para o que esta aba faz.
    // A tela mostra os três blocos; o PDF trazia dois. Buscando só pela
    // matrícula vinham 1 ato, com o nome vinham dezenas — e o PDF continuava
    // com 1. Como este PDF é anexado a processo de RSC, a pessoa instruía o
    // pedido com um documento incompleto sem ter como perceber.
    const linhasN = (r.porNome?.atos ?? []).map(linhaAto).join('');
    // `divergente` vem do escopo do componente: quem lê o papel não viu a tela
    // nem sabe o que foi digitado, então o PDF tem que dizer isso na cara.
    const html =
      `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><title>Meu SIAPE — atos do BS — SIAPE ${esc(r.siape)}</title>` +
      `<style>body{font:12px/1.45 Arial,Helvetica,sans-serif;color:#111;margin:22px}` +
      `h1{font-size:17px;margin:0 0 2px}h2{font-size:13px;margin:18px 0 6px;color:#003366}` +
      `.sub{color:#555;font-size:11px;margin:0 0 4px}.aviso{border:1px solid #c4c9d2;background:#f7f8fa;padding:8px;font-size:10px;color:#444;margin:10px 0 4px}` +
      `.alerta{border:2px solid #b91c1c;background:#fef2f2;padding:9px;font-size:11px;color:#7f1d1d;margin:10px 0 4px}` +
      `.rsc{white-space:nowrap;font-weight:bold;color:#3730a3;font-size:10px;text-align:center}` +
      `.rsclegenda{border:1px solid #a5b4fc;background:#eef2ff;padding:8px;font-size:10px;color:#312e81;margin:10px 0 4px}` +
      `table{border-collapse:collapse;width:100%}th,td{border:1px solid #c4c9d2;padding:4px 6px;text-align:left;vertical-align:top}` +
      `th{background:#003366;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.04em}` +
      `tr:nth-child(even) td{background:#f3f5f8}@media print{@page{margin:12mm}}</style></head><body>` +
      `<h1>Meu SIAPE — atos do Boletim de Serviço da UFF</h1>` +
      `<p class="sub">${ident || 'SIAPE ' + esc(r.siape)} &middot; gerado em ${fmtData(new Date().toISOString().slice(0, 10))}</p>` +
      (divergente
        ? `<div class="alerta"><strong>ATENÇÃO: este documento reúne DUAS pessoas.</strong> A matrícula consultada ` +
          `(SIAPE ${esc(r.siape)}) é de <strong>${esc(r.nomes.join(' · ') || 'titular não identificado')}</strong>, mas o nome ` +
          `informado na busca foi <strong>“${esc(r.porNome?.termo ?? '')}”</strong>. A última seção foi localizada por esse nome e ` +
          `<strong>não pertence ao titular da matrícula</strong>. Não anexe este documento a processo sem separar as duas listas.</div>`
        : '') +
      `<div class="aviso"><strong>Material de instrução, não decisão.</strong> Esta lista reúne atos publicados que citam esta ` +
      `matrícula` + (linhasN ? ` ou o nome informado` : '') + `. ` +
      `Ela não comprova participação por si só (o ato pode citar a pessoa por outro motivo) e não é exaustiva: parte dos atos do Boletim ` +
      `não registra SIAPE e, portanto, não é alcançada por esta busca. A fonte oficial é o Boletim de Serviço da UFF; confira sempre o ato.</div>` +
      // Legenda do RSC. Vai no PDF com o MESMO peso que tem na tela: quem lê o
      // papel (a CRSC, a chefia) não viu a tela, e uma coluna "RSC · Req. I" sem
      // explicação pareceria uma pontuação que o portal não apurou.
      `<div class="rsclegenda"><strong>Sobre a coluna RSC.</strong> Ela indica que o ato é <strong>do tipo</strong> que o ` +
      `requisito descreve no art. 2º da Instrução Normativa GAR/RET/UFF nº 129, de 24/07/2026 — <strong>não</strong> que ele ` +
      `será pontuado. A própria IN determina que atender aos requisitos objetivos “não assegura, por si só, a concessão” ` +
      `(art. 15, §8º e art. 20, §3º), e não se pontua o que for “exclusivamente o desempenho ordinário das atribuições legais ` +
      `do cargo” (art. 20, §2º). A mesma atividade só pode ser contada uma vez (art. 15, §6º). Quem avalia o memorial e ` +
      `decide é a <strong>CRSC-UFF</strong>.<br>` +
      `<strong>Req. I</strong> — grupos de trabalho, comissões, comitês, núcleos, representações ou similares (Anexo I). ` +
      `<strong>Req. IV</strong> — responsabilidades técnico-administrativas ou especializadas (Anexo IV). ` +
      `<strong>Req. V</strong> — exercício de função ou cargo de direção ou assessoramento (Anexo V).<br>` +
      `Os requisitos <strong>II</strong> (projetos institucionais), <strong>III</strong> (premiação) e <strong>VI</strong> ` +
      `(produção científica) <strong>não são detectáveis</strong> a partir do Boletim e por isso nunca aparecem nesta coluna — ` +
      `comprovam-se por certificado, publicação ou declaração. Coluna vazia não significa ausência de direito.</div>` +
      (linhasF
        ? `<h2>Designações e dispensas de função (${r.funcoes.length})</h2>` +
          `<table><thead><tr><th>Ação</th><th>Cargo</th><th>Unidade</th><th>Data</th><th>Ato</th><th>RSC</th></tr></thead>` +
          `<tbody>${linhasF}</tbody></table>`
        : '') +
      `<h2>Atos que citam o SIAPE ${esc(r.siape)} (${r.atos.length})</h2>` +
      `<table><thead><tr><th>Ato</th><th>Data</th><th>Ementa</th><th>Referência no BS</th><th>RSC</th></tr></thead>` +
      `<tbody>${linhasA}</tbody></table>` +
      // Bloco do nome: sai com a MESMA ressalva que a tela mostra. Busca por
      // nome alcança o que a matrícula não acha, e em troca pode trazer
      // homônimo — quem anexa ao processo precisa ler isso no papel também.
      (linhasN && divergente
        ? `<h2>Atos que citam “${esc(r.porNome?.termo ?? '')}” — OUTRA PESSOA (${r.porNome?.total ?? 0})</h2>` +
          `<div class="alerta">Esta seção <strong>não é do titular do SIAPE ${esc(r.siape)}</strong>. Ela lista atos que citam ` +
          `o nome <strong>“${esc(r.porNome?.termo ?? '')}”</strong>, que não corresponde a ` +
          `<strong>${esc(r.nomes.join(' · ') || 'quem consta na matrícula')}</strong>. Se a intenção era buscar o titular, refaça ` +
          `a consulta com o nome dele; se era buscar outra pessoa, use uma consulta separada.</div>` +
          `<table><thead><tr><th>Ato</th><th>Data</th><th>Ementa</th><th>Referência no BS</th><th>RSC</th></tr></thead>` +
          `<tbody>${linhasN}</tbody></table>`
        : '') +
      (linhasN && !divergente
        ? `<h2>Outros atos que citam “${esc(r.porNome?.termo ?? '')}” no texto (${r.porNome?.total ?? 0})</h2>` +
          `<div class="aviso">Estes atos foram localizados pelo <strong>nome</strong>, não pela matrícula — é assim que se ` +
          `alcança o ato que não registra SIAPE (46% do acervo). <strong>Duas ressalvas:</strong> se a pessoa ocupou ` +
          `cargo de direção, os atos que ela <strong>assinou</strong> aparecem nesta lista, e assinar não é participar; ` +
          `e a busca por nome pode trazer <strong>pessoas de nome parecido</strong>. Confira ato por ato antes de usar. ` +
          `Os atos já listados acima não se repetem aqui.</div>` +
          `<table><thead><tr><th>Ato</th><th>Data</th><th>Ementa</th><th>Referência no BS</th><th>RSC</th></tr></thead>` +
          `<tbody>${linhasN}</tbody></table>`
        : '') +
      `<script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
    else alert('Permita pop-ups para gerar o PDF, ou use Ctrl+P nesta página.');
  };

  const TabelaAtos = ({ atos }: { atos: ds.DossieAto[] }) => (
    <>
    <RecordCardList className="p-2">
      {atos.map((a, i) => (
        <RecordCard
          key={a.id + i}
          titulo={rotuloAto(a)}
          selo={
            <>
              {a.status !== 'Ativo' && (
                <span className="inline-block rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                  {a.status}
                </span>
              )}
              <SeloRSC reqs={requisitosDoAto(a)} />
            </>
          }
          campos={[
            { rotulo: 'Data', valor: fmtData(a.dataAto) },
            { rotulo: 'Referência no BS', valor: <span className="font-mono">{refBS(a)}</span> },
          ]}
          texto={a.ementa || <span className="italic text-slate-400">sem ementa</span>}
          acoes={a.linkBoletim && (
            <a href={a.linkBoletim} target="_blank" referrerPolicy="no-referrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 underline">
              Abrir no Boletim <ExternalLink className="w-3 h-3" />
            </a>
          )}
        />
      ))}
    </RecordCardList>
    <DesktopTable>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wider">
            <th className="text-left font-bold px-3 py-2">Ato</th>
            <th className="text-left font-bold px-3 py-2 whitespace-nowrap">Data</th>
            <th className="text-left font-bold px-3 py-2">Ementa</th>
            <th className="text-left font-bold px-3 py-2 whitespace-nowrap">Referência no BS</th>
          </tr>
        </thead>
        <tbody>
          {atos.map((a, i) => (
            <tr key={a.id + i} className="border-t border-slate-100 hover:bg-slate-50 align-top">
              <td className="px-3 py-2 whitespace-nowrap">
                {a.linkBoletim ? (
                  <a href={a.linkBoletim} target="_blank" referrerPolicy="no-referrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs font-semibold">
                    {rotuloAto(a)} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : <span className="text-xs font-semibold text-slate-700">{rotuloAto(a)}</span>}
                {a.status !== 'Ativo' && (
                  <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                    {a.status}
                  </span>
                )}
                <SeloRSC reqs={requisitosDoAto(a)} />
              </td>
              <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{fmtData(a.dataAto)}</td>
              <td className="px-3 py-2 text-slate-700 text-xs leading-snug">
                {a.ementa || <span className="text-slate-400 italic">sem ementa</span>}
              </td>
              <td className="px-3 py-2 text-slate-500 text-[11px] font-mono whitespace-nowrap">{refBS(a)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DesktopTable>
    </>
  );

  // Modo estático não tem a rota — nem adianta pedir senha.
  if (!apiMode) {
    return (
      <div id="painel-dossie" className="bg-white p-6 rounded-lg border border-slate-200 text-center">
        <Info className="w-6 h-6 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-slate-700">Disponível apenas no modo banco de dados.</p>
        <p className="text-xs text-slate-500 mt-1">
          O Meu SIAPE cruza as tabelas de pessoas e designações no servidor; o modo estático não reproduz essa consulta.
        </p>
      </div>
    );
  }

  return (
    <div id="painel-dossie" className="space-y-3">
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-xs font-bold text-[#003366] flex items-center gap-1.5 uppercase tracking-wider">
              <FolderSearch className="w-4 h-4 text-yellow-500" /> Meu SIAPE — atos no Boletim
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-normal font-medium">
              Digite a sua matrícula SIAPE e veja os atos publicados que a citam, com a <strong>referência do boletim</strong> para
              copiar no processo. Útil para instruir pedidos que exigem comprovar participação em
              <strong> comissões, comitês, grupos de trabalho e núcleos</strong> — como o RSC
              (IN GAR/RET/UFF nº 129/2026).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={imprimir}
              // O bloco por NOME conta para habilitar: há matrícula que não
              // acha nada e cujo nome acha dezenas. Sem isto, quem mais precisa
              // do PDF é justamente quem não consegue gerá-lo.
              disabled={!r || (!r.atos.length && !r.funcoes.length && !r.porNome?.atos.length)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#003366] text-white text-xs font-bold hover:bg-[#00264d] disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Printer className="w-4 h-4" /> Exportar / Imprimir PDF
            </button>
          </div>
        </div>

        <form onSubmit={buscar} className="flex items-center gap-2 mt-3 flex-wrap">
          <div className="relative w-[190px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={siape}
              onChange={e => setSiape(e.target.value)}
              inputMode="numeric"
              placeholder="SIAPE (só números)"
              aria-label="Matrícula SIAPE"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[200px]">
            <UserSearch className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Nome (opcional) — busca no texto dos atos que não trazem SIAPE"
              aria-label="Nome do servidor (opcional)"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          <button
            type="submit"
            disabled={!siape.replace(/\D/g, '') || carregando}
            className="px-4 py-2 rounded-md bg-yellow-500 text-[#003366] text-xs font-bold hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            Buscar
          </button>
        </form>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Buscando atos…
        </div>
      ) : !buscou ? (
        <div className="bg-white p-6 rounded-lg border border-slate-200 text-center">
          <FolderSearch className="w-6 h-6 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">Digite um SIAPE para começar.</p>
          <p className="text-xs text-slate-500 mt-1">
            Zeros à esquerda não importam: <span className="font-mono">0307221</span> e <span className="font-mono">307221</span> são tratados como a mesma matrícula.
          </p>
        </div>
      ) : !r ? (
        <div className="bg-white p-6 rounded-lg border border-slate-200 text-center">
          <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">Não foi possível consultar agora.</p>
          <p className="text-xs text-slate-500 mt-1">
            {falha === 'senha'
              ? 'O servidor ainda está com a versão antiga desta consulta (que exigia senha). Tente mais tarde.'
              : 'A busca não respondeu. Tente novamente em instantes.'}
          </p>
        </div>
      ) : (
        <>
          {/* Identificação: quem é este SIAPE, segundo a base. */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">SIAPE {r.siape}</span>
              {r.pessoas.length ? (
                <span className="text-sm font-bold text-[#003366]">
                  {r.nomes.length ? r.nomes.join(' · ') : 'nome não identificado'}
                </span>
              ) : (
                <span className="text-sm font-semibold text-slate-600">nenhuma pessoa com esta matrícula na base</span>
              )}
            </div>

            {r.linhasPessoa > 1 && (
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
                Esta matrícula aparece no acervo em {r.linhasPessoa} grafias ({r.pessoas.map(p => p.siape).join(', ')}),
                por causa do zero à esquerda. Os atos das duas formas estão <strong>reunidos aqui</strong>.
              </p>
            )}

            {/* Duas grafias do siape com nomes diferentes: sinal de que a base
                juntou gente distinta. Avisar na cara — num dossiê que instrui
                processo, ato de outra pessoa é o pior erro possível. Isto pega
                só a fatia detectável: o siape que carrega duas pessoas numa
                grafia só já colapsou num nome antes de chegar aqui, e o v2 não
                guarda o nome por ato p/ desfazer. Ver dossie() no index_v2.php. */}
            {r.nomesDistintos > 1 && (
              <div className="mt-2 flex items-start gap-2 p-2 rounded border border-amber-200 bg-amber-50">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  <strong>Atenção: esta matrícula está associada a mais de um nome no acervo.</strong> Isso costuma ser erro de
                  leitura do boletim (nome trocado ou grafado de formas diferentes). <strong>Algum ato da lista abaixo pode não ser seu</strong> —
                  confira ato por ato antes de usar.
                </p>
              </div>
            )}

            {/* Nome digitado que não é o dono da matrícula. Vermelho, e não
                âmbar como o aviso acima: aquele diz que a base pode estar
                suja, este diz que a consulta está juntando duas pessoas — o
                erro é maior e tem conserto imediato pelo próprio usuário. */}
            {divergente && (
              <div className="mt-2 flex items-start gap-2 p-2 rounded border border-red-300 bg-red-50">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-800 leading-relaxed">
                  <strong>O nome informado não é o desta matrícula.</strong> Segundo o acervo, o SIAPE {r.siape} é de{' '}
                  <strong>{r.nomes.join(' · ') || 'titular não identificado'}</strong>, e você buscou por{' '}
                  <strong>“{r.porNome?.termo}”</strong>. Os dois blocos abaixo são de <strong>pessoas diferentes</strong> — e o
                  PDF sai assim também. Corrija o nome, ou faça uma consulta separada para a outra pessoa.
                </p>
              </div>
            )}
          </div>

          {/* Legenda do RSC. Aparece sempre que houve consulta, inclusive quando
              NADA foi marcado — a ausência de selo é informação, e sem a
              ressalva ela seria lida como "você não tem direito a nada". */}
          {(!!r.atos.length || !!r.funcoes.length) && (
            <div className="bg-white rounded-lg border border-indigo-200 shadow-xs overflow-hidden">
              <div className="px-3 py-2 border-b border-indigo-100 bg-indigo-50/60">
                {/* `text-indigo-700` e `text-slate-600`, não 800/900: o modo
                    fotofobia converte por lista de classes conhecidas, e
                    indigo-800/900 não estão nela. Medido no navegador com
                    `html.fotofobia`: ficavam em oklch(0.398) e oklab(0.359) —
                    escuro sobre o fundo escuro, ilegível e sem erro no console.
                    É a armadilha de cor documentada no CLAUDE.md. */}
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                  Requisitos do RSC-PCCTAE identificados
                </span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  IN GAR/RET/UFF nº 129, de 24/07/2026 (art. 2º) — carreira <strong>técnico-administrativa</strong>.
                </p>
              </div>
              <div className="p-3 space-y-2">
                {resumoRSC.length ? (
                  <ul className="space-y-1.5">
                    {resumoRSC.map(([q, n]) => (
                      <li key={q} className="flex items-start gap-2">
                        <span className="shrink-0 mt-0.5 inline-block rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                          Req. {q}
                        </span>
                        <span className="text-[11px] text-slate-700 leading-relaxed">
                          {REQUISITOS[q].titulo} <span className="text-slate-400">({REQUISITOS[q].anexo})</span>
                          {' — '}<strong>{n}</strong> {n === 1 ? 'registro marcado' : 'registros marcados'}.
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Nenhum requisito foi reconhecido automaticamente nestes registros. <strong>Isso não significa que você
                    não tenha o que apresentar</strong> — veja abaixo o que esta marcação não alcança.
                  </p>
                )}

                {/* A parte que impede a tela de afirmar demais. Não é rodapé
                    decorativo: são três limites que a própria IN impõe. */}
                <div className="rounded border border-slate-200 bg-slate-50 p-2.5 space-y-1.5">
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    <strong>O selo diz que o ato é do tipo que o requisito descreve — não que ele será pontuado.</strong>{' '}
                    A IN é expressa: atender aos requisitos objetivos <strong>“não assegura, por si só, a concessão”</strong>{' '}
                    (art. 15, §8º e art. 20, §3º). Quem avalia o memorial e decide é a <strong>CRSC-UFF</strong>.
                  </p>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    Não se pontua o que for <strong>“exclusivamente o desempenho ordinário das atribuições legais do
                    cargo”</strong> (art. 20, §2º) — isso depende do seu memorial, não do ato. E a mesma atividade{' '}
                    <strong>só conta uma vez</strong>, ainda que sirva a dois requisitos (art. 15, §6º).
                  </p>
                  <p className="text-[11px] text-slate-700 leading-relaxed">
                    <strong>Só 3 dos 6 requisitos são detectáveis aqui</strong> (I, IV e V). Os requisitos{' '}
                    <strong>II</strong> (projetos institucionais), <strong>III</strong> (premiação) e <strong>VI</strong>{' '}
                    (produção científica) não saem como ato de designação no Boletim — comprovam-se por certificado,
                    publicação ou declaração, que esta aba não tem. Ausência de selo nunca é ausência de direito.
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    A boa notícia: o ato publicado <em>é</em> documento hábil. O art. 19, parágrafo único, I lista entre as
                    provas válidas as <strong>“portarias, resoluções ou atos de designação ou nomeação”</strong> — que é
                    exatamente o que esta aba localiza, com a referência do BS para citar no processo.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Bloco 1: dado estruturado (cargo/unidade lidos do dispositivo). */}
          {!!r.funcoes.length && (
            <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
                <span className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">
                  Designações e dispensas de função ({r.funcoes.length})
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Cargo e unidade lidos do <strong>dispositivo do ato</strong> — é a mesma base das abas Chefias e Mandatos.
                </p>
              </div>
              <RecordCardList className="p-2">
                {r.funcoes.map((f, i) => (
                  <RecordCard
                    key={f.atoId + f.cargo + i}
                    titulo={f.cargo || '—'}
                    subtitulo={f.unidade || undefined}
                    selo={
                      <>
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-bold ${
                          f.acao === 'designar'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {f.acao === 'designar' ? 'Designação' : 'Dispensa'}
                        </span>
                        <SeloRSC reqs={requisitosDaFuncao(f)} />
                      </>
                    }
                    campos={[
                      { rotulo: 'Data', valor: fmtData(f.dataAto) },
                      { rotulo: 'Ato', valor: f.atoLabel },
                    ]}
                    acoes={f.linkBoletim && (
                      <a href={f.linkBoletim} target="_blank" referrerPolicy="no-referrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 underline">
                        Abrir no Boletim <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  />
                ))}
              </RecordCardList>
              <DesktopTable>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-[10px] uppercase tracking-wider">
                      <th className="text-left font-bold px-3 py-2">Ação</th>
                      <th className="text-left font-bold px-3 py-2">Cargo</th>
                      <th className="text-left font-bold px-3 py-2">Unidade</th>
                      <th className="text-left font-bold px-3 py-2 whitespace-nowrap">Data</th>
                      <th className="text-left font-bold px-3 py-2">Ato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.funcoes.map((f, i) => (
                      <tr key={f.atoId + f.cargo + i} className="border-t border-slate-100 hover:bg-slate-50 align-top">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${
                            f.acao === 'designar'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}>
                            {f.acao === 'designar' ? 'Designação' : 'Dispensa'}
                          </span>
                          <SeloRSC reqs={requisitosDaFuncao(f)} />
                        </td>
                        <td className="px-3 py-2 text-slate-800 font-medium">{f.cargo || '—'}</td>
                        <td className="px-3 py-2 text-slate-700 text-xs">{f.unidade || '—'}</td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{fmtData(f.dataAto)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {f.linkBoletim ? (
                            <a href={f.linkBoletim} target="_blank" referrerPolicy="no-referrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs font-semibold">
                              {f.atoLabel} <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : <span className="text-xs text-slate-500">{f.atoLabel}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DesktopTable>
            </div>
          )}

          {/* Bloco 2: menções. O rótulo tem que dizer que é menção, não prova. */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
              <span className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">
                Atos que citam este SIAPE ({r.atos.length})
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                São atos que <strong>mencionam a matrícula</strong> — não necessariamente atos em que você foi membro. Numa banca,
                por exemplo, o avaliado também é citado. Confira o ato antes de usar.
              </p>
            </div>
            {r.atos.length ? <TabelaAtos atos={r.atos} /> : (
              <div className="p-6 text-center">
                <Info className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">Nenhum ato encontrado para esta matrícula.</p>
                <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto leading-relaxed">
                  Isso <strong>não significa</strong> que não existam atos seus no Boletim: boa parte dos atos publicados não
                  registra o SIAPE de quem cita. Tente também pelo <strong>nome</strong>, no campo acima.
                </p>
              </div>
            )}
          </div>

          {/* Bloco 3: recall por nome — separado, porque a confiança é outra. */}
          {r.porNome && (
            <div className={`bg-white rounded-lg shadow-xs overflow-hidden border ${
              divergente ? 'border-red-300' : 'border-slate-200'}`}>
              <div className={`px-3 py-2 border-b ${
                divergente ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                <span className={`text-[11px] font-bold uppercase tracking-wider ${
                  divergente ? 'text-red-700' : 'text-slate-600'}`}>
                  {divergente
                    ? <>Atos de “{r.porNome.termo}” — outra pessoa ({r.porNome.total})</>
                    : <>Outros atos que citam “{r.porNome.termo}” no texto ({r.porNome.total})</>}
                </span>
                {/* A ressalva nomeia o caso COMUM, não só o raro. Medido em
                    05/08/2026 num dossiê real: de 100 atos achados pelo nome, a
                    maioria era de atos que a pessoa ASSINOU como Pró-Reitora —
                    o nome estava no bloco de assinatura, e o `signatario` do
                    ato veio vazio, então não há como filtrar. Avisar só do
                    homônimo seria avisar do improvável e calar sobre o provável. */}
                {divergente ? (
                  <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">
                    Esta lista <strong>não é do titular do SIAPE {r.siape}</strong>: ela veio do nome que você digitou, e esse
                    nome é de outra pessoa. Ela continua visível porque a busca por nome é legítima — mas não a some com o
                    bloco acima, e não anexe as duas a um mesmo processo.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Busca no <strong>corpo do ato</strong>, para alcançar o que a matrícula não acha — <strong>46% dos
                    atos não registram SIAPE</strong>. Duas ressalvas antes de usar: se você ocupou <strong>cargo de
                    direção</strong>, os atos que você <strong>assinou</strong> aparecem aqui — e assinar não é
                    participar; e a busca <strong>pode trazer pessoas de nome parecido</strong>. Confira ato por ato.
                    Os atos já listados acima não se repetem aqui.
                  </p>
                )}
              </div>
              {r.porNome.atos.length
                ? <TabelaAtos atos={r.porNome.atos} />
                : <div className="p-6 text-center text-sm text-slate-600 font-semibold">Nenhum outro ato cita esse nome.</div>}
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-slate-400 px-1 leading-relaxed">
        <Info className="w-3 h-3 inline mr-1 -mt-0.5" />
        <strong>Material de instrução, não decisão.</strong> Este painel localiza atos publicados e mostra onde eles saíram;
        ele não apura pontuação e não substitui a análise da comissão avaliadora. A lista não é exaustiva — parte dos atos do
        Boletim não registra SIAPE. A fonte oficial é o <strong>Boletim de Serviço da UFF</strong>: confira sempre o ato de origem.
      </p>
    </div>
  );
}
