import React, { useMemo, useState } from 'react';
import type { UffAct } from '../../types';

// Gráficos do Dashboard.
//
// TRÊS ESCOLHAS QUE VALE REGISTRAR
//
// 1. Uma matiz só, não paleta categórica. Todas as séries aqui medem UMA coisa
//    (quantidade de atos) ao longo de um eixo — ano, tipo, órgão. A posição já
//    codifica o valor; pintar cada barra de uma cor codificaria nada e ainda
//    criaria um problema de daltonismo para resolver. Cor entra quando há
//    IDENTIDADE a distinguir, e aqui não há.
//
// 2. As cores vivem em custom properties (`--chart-*` no index.css), não em
//    classes do Tailwind. O modo fotofobia deste projeto age por seletor de
//    classe (`[class*="bg-white"]`), e `fill` dentro de SVG não é alcançado por
//    isso — o gráfico ficaria escuro sobre escuro. Com token, o tema troca a
//    variável e o SVG acompanha.
//    Contraste medido contra as duas superfícies: marca 6,54:1 no claro e
//    5,35:1 no escuro; texto de eixo 4,76:1 e 7,11:1.
//
// 3. Os painéis do boletim saem dos atos que a home JÁ recebe. Nenhuma chamada
//    nova à API: `ultimoBoletim.atos` traz tipo, órgão e processo SEI, e é sobre
//    esse boletim que a página inteira fala.

const fmt = (n: number) => n.toLocaleString('pt-BR');

/** Tabela equivalente, sempre disponível. Gráfico sem alternativa textual é
 *  conteúdo que só existe para quem enxerga — e a mesma tabela serve a quem
 *  quer o número exato em vez da forma. */
function TabelaDados({ titulo, colunas, linhas }: {
  titulo: string; colunas: [string, string]; linhas: [string, number][];
}) {
  return (
    <details className="mt-3">
      <summary className="text-[11px] text-[#718096] cursor-pointer hover:text-[#1B6B3A] rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B6B3A]">
        Ver {titulo} em tabela
      </summary>
      <div className="mt-2 max-h-52 overflow-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-white">
            <tr className="text-[#A0AEC0] text-left">
              <th className="font-medium py-1">{colunas[0]}</th>
              <th className="font-medium py-1 text-right">{colunas[1]}</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(([k, v]) => (
              <tr key={k} className="border-t border-[#EDF2F7]">
                <td className="py-1 text-[#4A5568]">{k}</td>
                <td className="py-1 text-right text-[#1A202C] tabular-nums">{fmt(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function VazioGrafico({ texto }: { texto: string }) {
  return <p className="text-[13px] text-[#A0AEC0] py-8 text-center">{texto}</p>;
}

// ---------------------------------------------------------------------------
// ÁREA — o acervo ao longo de 26 anos.
//
// Antes isto era uma faixa de 120px sem eixo e sem valor visível: dava para ver
// que subia, não O QUANTO. Com referência de escala e ponto destacado, a
// pergunta "quantos atos em 2013?" passa a ter resposta na própria tela.
// ---------------------------------------------------------------------------
export function AreaPorAno({ dados }: { dados: [number, number][] }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const n = dados.length;
  if (!n) return <VazioGrafico texto="Série anual indisponível" />;

  const max = Math.max(1, ...dados.map(([, v]) => v));
  const W = 620, H = 170;
  const x = (i: number) => (i * W) / Math.max(1, n - 1);
  const y = (v: number) => H - (v / max) * (H - 14) - 4;

  const linha = dados.map(([, v], i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${linha} L${x(n - 1).toFixed(1)},${H} L0,${H} Z`;
  // Duas referências bastam para dar escala; mais vira grade decorativa
  // competindo com o dado.
  const refs = [0.5, 1].map(f => y(max * f));
  const sel = ativo !== null ? dados[ativo] : null;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <p className="text-[11px] text-[#A0AEC0]">
          {dados[0][0]}–{dados[n - 1][0]} · pico{' '}
          <span className="tabular-nums font-medium text-[#4A5568]">{fmt(max)}</span>
        </p>
        <p className="text-[12px] tabular-nums text-[#1A202C] min-h-[1.2em]">
          {sel && <><span className="font-semibold">{fmt(sel[1])}</span> <span className="text-[#A0AEC0]">em {sel[0]}</span></>}
        </p>
      </div>

      <div className="relative" onMouseLeave={() => setAtivo(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-[150px] block" role="img"
          aria-label={`Atos por ano, de ${dados[0][0]} a ${dados[n - 1][0]}, com pico de ${fmt(max)}.`}>
          {refs.map(yy => (
            <line key={yy} x1={0} x2={W} y1={yy} y2={yy}
              stroke="var(--chart-grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <defs>
            <linearGradient id="gradAno" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-fill)" />
              <stop offset="100%" stopColor="var(--chart-fill-2)" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#gradAno)" />
          {/* non-scaling-stroke porque o preserveAspectRatio="none" estica o
              viewBox: sem isso a linha engrossaria junto com a largura. */}
          <path d={linha} fill="none" stroke="var(--chart-mark)" strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {ativo !== null && (
            <line x1={x(ativo)} x2={x(ativo)} y1={0} y2={H} stroke="var(--chart-mark)"
              strokeWidth="1" strokeDasharray="3 3" opacity=".5" vectorEffect="non-scaling-stroke" />
          )}
        </svg>

        {/* O ponto vive fora do SVG esticado: dentro dele um círculo viraria
            elipse. Marca sobre a superfície, com anel, para separar da área. */}
        {ativo !== null && (
          <span className="absolute w-2.5 h-2.5 rounded-full pointer-events-none"
            style={{
              left: `${(ativo / Math.max(1, n - 1)) * 100}%`,
              top: `${(y(dados[ativo][1]) / H) * 100}%`,
              transform: 'translate(-50%, -50%)',
              background: 'var(--chart-mark)',
              boxShadow: '0 0 0 2px white',
            }} />
        )}

        {/* Zonas de alvo maiores que a marca: 26 pontos num traço fino são
            impossíveis de acertar se o alvo for o ponto. */}
        <div className="absolute inset-0 flex">
          {dados.map(([ano], i) => (
            <button key={ano} type="button"
              className="flex-1 min-w-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#1B6B3A]"
              onMouseEnter={() => setAtivo(i)} onFocus={() => setAtivo(i)}
              aria-label={`${ano}: ${fmt(dados[i][1])} atos`} />
          ))}
        </div>
      </div>

      <div className="grid mt-1 text-[10px] text-[#A0AEC0] tabular-nums"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {dados.map(([ano], i) => (
          <span key={ano} className="text-center truncate">
            {i === 0 || i === n - 1 || ano % 5 === 0 ? ano : ''}
          </span>
        ))}
      </div>

      <TabelaDados titulo="a série anual" colunas={['Ano', 'Atos']}
        linhas={dados.map(([a, v]) => [String(a), v])} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// BARRAS DE RANKING — reaproveitada por tipo e por órgão.
//
// Horizontal porque os rótulos são longos ("Determinação de Serviço" não cabe
// sob uma barra vertical). Com o valor direto na linha: são poucas barras, e
// ler forma e número no mesmo lugar dispensa o eixo.
//
// A cauda vira UMA faixa, em tom mais fraco. Desenhar sete fatias de menos de
// 1% cada produz linhas invisíveis que só existem para a legenda.
// ---------------------------------------------------------------------------
function BarrasRanking({ dados, total, topo = 5, rotuloCauda = 'Outros' }: {
  dados: [string, number][]; total: number; topo?: number; rotuloCauda?: string;
}) {
  const linhas = useMemo(() => {
    const ord = [...dados].sort((a, b) => b[1] - a[1]);
    const cabeca = ord.slice(0, topo);
    const cauda = ord.slice(topo);
    const soma = cauda.reduce((s, x) => s + x[1], 0);
    return soma > 0
      ? [...cabeca.map(x => ({ k: x[0], v: x[1], cauda: false })),
         { k: `${rotuloCauda} (${cauda.length})`, v: soma, cauda: true }]
      : cabeca.map(x => ({ k: x[0], v: x[1], cauda: false }));
  }, [dados, topo, rotuloCauda]);

  if (!linhas.length) return <VazioGrafico texto="Sem dados para este boletim" />;
  const max = Math.max(1, ...linhas.map(l => l.v));

  return (
    <ul className="space-y-2">
      {linhas.map(l => (
        <li key={l.k}>
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="text-[12px] text-[#4A5568] truncate" title={l.k}>{l.k}</span>
            <span className="text-[11px] tabular-nums text-[#A0AEC0] shrink-0">
              <span className="text-[#1A202C] font-medium">{fmt(l.v)}</span>
              {total > 0 && <> · {Math.round((l.v / total) * 100)}%</>}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[#EDF2F7] overflow-hidden">
            <div className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.max(2, (l.v / max) * 100)}%`,
                background: l.cauda ? 'var(--chart-mark-2)' : 'var(--chart-mark)',
                opacity: l.cauda ? 0.5 : 1,
              }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// O BOLETIM MAIS RECENTE — de que ele é feito, e quem publicou.
//
// A home já lista os atos deste boletim; estes painéis são a mesma informação
// somada. Nada aqui vem de chamada nova: sai dos atos que a página recebeu.
// ---------------------------------------------------------------------------
export function ComposicaoDoBoletim({ atos }: { atos: UffAct[] }) {
  const { tipos, comSei } = useMemo(() => {
    const t = new Map<string, number>();
    let sei = 0;
    for (const a of atos) {
      const k = a.tipoAto || '—';
      t.set(k, (t.get(k) ?? 0) + 1);
      if (a.processoSei) sei++;
    }
    return { tipos: [...t.entries()] as [string, number][], comSei: sei };
  }, [atos]);

  if (!atos.length) return <VazioGrafico texto="Nenhum ato neste boletim" />;
  const pctSei = Math.round((comSei / atos.length) * 100);

  return (
    <div>
      <BarrasRanking dados={tipos} total={atos.length} topo={4} rotuloCauda="Outros tipos" />

      {/* Cobertura de SEI é UMA proporção — medidor, não gráfico. E vale
          estar aqui: é o que diz se dá para rastrear o ato até o processo. */}
      <div className="mt-4 pt-3 border-t border-[#EDF2F7]">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className="text-[12px] text-[#4A5568]">Com processo SEI</span>
          <span className="text-[11px] tabular-nums text-[#A0AEC0]">
            <span className="text-[#1A202C] font-medium">{comSei}</span> de {atos.length} · {pctSei}%
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[#EDF2F7] overflow-hidden"
          role="img" aria-label={`${comSei} de ${atos.length} atos com processo SEI, ${pctSei} por cento`}>
          <div className="h-full rounded-full"
            style={{ width: `${Math.max(2, pctSei)}%`, background: 'var(--chart-mark)' }} />
        </div>
      </div>

      <TabelaDados titulo="a composição deste boletim" colunas={['Tipo de ato', 'Atos']}
        linhas={tipos.sort((a, b) => b[1] - a[1])} />
    </div>
  );
}

export function OrgaosDoBoletim({ atos }: { atos: UffAct[] }) {
  const orgaos = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of atos) {
      const k = a.orgaoEmissor || '—';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()] as [string, number][];
  }, [atos]);

  if (!atos.length) return <VazioGrafico texto="Nenhum ato neste boletim" />;

  return (
    <div>
      <p className="text-[11px] text-[#A0AEC0] mb-2">
        <span className="tabular-nums font-medium text-[#4A5568]">{orgaos.length}</span>{' '}
        {orgaos.length === 1 ? 'unidade publicou' : 'unidades publicaram'} neste boletim
      </p>
      <BarrasRanking dados={orgaos} total={atos.length} topo={5} rotuloCauda="Outras unidades" />
      <TabelaDados titulo="as unidades deste boletim" colunas={['Unidade', 'Atos']}
        linhas={orgaos.sort((a, b) => b[1] - a[1])} />
    </div>
  );
}
