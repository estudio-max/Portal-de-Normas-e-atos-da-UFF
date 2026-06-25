import React, { useState } from 'react';
import { 
  Search, Clipboard, Check, ExternalLink, HelpCircle, 
  Info, Sparkles, ArrowRight, ShieldCheck, FileText
} from 'lucide-react';

export default function SeiIntegration() {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [customSei, setCustomSei] = useState('');
  
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => {
      setCopiedText(null);
    }, 2000);
  };

  const handleOpenSeiSearch = () => {
    window.open(
      "https://sei.uff.br/sei/modulos/pesquisa/md_pesq_processo_pesquisar.php?acao_externa=protocolo_pesquisar&acao_origem_externa=protocolo_pesquisar&id_orgao_acesso_externo=0",
      "_blank",
      "referrer"
    );
  };

  const seiExamples = [
    { num: "23069.011245/2026-12", desc: "Regulamento de Cargos e Salários (Resolução CUV nº 12/2026)" },
    { num: "23069.003948/2026-77", desc: "Regulamento Geral de Estágios de Graduação (Resolução CEPEx nº 05/2026)" },
    { num: "23069.002871/2026-44", desc: "Instrução de Ponto Eletrônico da PROGEPE" },
    { num: "23069.000542/2026-33", desc: "Portaria de Criação da Comissão de Normas" }
  ];

  return (
    <div id="sei-integration-panel" className="space-y-3">
      {/* SEI Header Info */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="p-1 bg-yellow-50 text-yellow-600 rounded">
            <Search className="w-4 h-4" />
          </span>
          <h3 className="text-sm font-bold text-[#003366] uppercase tracking-wide">
            Integração Inteligente com o SEI UFF
          </h3>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
          O Sistema Eletrônico de Informações (SEI) da UFF é onde tramitam todos os processos administrativos oficiais relativos às portarias e resoluções. Nosso portal correlaciona automaticamente os atos indexados com seus respectivos processos SEI públicos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Card: SEI Link builder */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs space-y-3.5 flex flex-col justify-between">
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-yellow-500" /> Atalho de Busca Externa
            </h4>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              Digite ou escolha um processo SEI abaixo para copiar o número formatado. Nós abriremos a pesquisa pública do SEI UFF em uma nova aba e você poderá colar para acessar o processo na íntegra.
            </p>

            {/* Custom input */}
            <div className="space-y-1">
              <label className="block text-[9px] font-bold text-slate-400 uppercase">Processo SEI Personalizado</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: 23069.012345/2026-00"
                  value={customSei}
                  onChange={(e) => setCustomSei(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-yellow-400 text-slate-800"
                />
                {customSei && (
                  <button
                    type="button"
                    onClick={() => handleCopy(customSei)}
                    className="bg-[#003366] hover:bg-blue-800 text-white font-bold text-xs px-3 rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {copiedText === customSei ? (
                      <Check className="w-3.5 h-3.5 text-green-300" />
                    ) : (
                      <Clipboard className="w-3.5 h-3.5" />
                    )}
                    <span>Copiar</span>
                  </button>
                )}
              </div>
            </div>

            {/* List of demo items */}
            <div className="space-y-1.5 pt-1.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Processos de Referência (Demonstração)</span>
              <div className="flex flex-col gap-1.5">
                {seiExamples.map((ex, idx) => (
                  <div key={idx} className="bg-slate-50 hover:bg-slate-100/70 p-2 rounded-md border border-slate-200 flex items-center justify-between text-xs transition-all">
                    <div className="space-y-0.5">
                      <span className="font-mono font-bold text-[#003366] text-[11px]">{ex.num}</span>
                      <span className="text-[10px] text-slate-400 font-semibold block">"{ex.desc}"</span>
                    </div>
                    <button
                      onClick={() => handleCopy(ex.num)}
                      className="bg-white hover:bg-slate-100 border border-slate-200 p-1.5 rounded text-slate-500 hover:text-slate-700 transition-all cursor-pointer shadow-2xs"
                      title="Copiar número"
                    >
                      {copiedText === ex.num ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Clipboard className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleOpenSeiSearch}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-blue-950 font-bold text-xs py-2 rounded-md transition-all flex items-center justify-center gap-1.5 shadow-xs mt-3.5 cursor-pointer uppercase tracking-wider"
          >
            <span>Abrir Pesquisa Pública SEI UFF</span>
            <ExternalLink className="w-3.5 h-3.5 text-blue-950 stroke-[2.5px]" />
          </button>
        </div>

        {/* Right Card: Step-by-step instructions */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs space-y-3 font-medium text-xs text-slate-700">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-blue-500" /> Guia de Consulta no SEI UFF
          </h4>

          <div className="space-y-2.5 pt-1">
            <div className="flex items-start gap-2.5">
              <div className="bg-[#00264d] w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5">
                1
              </div>
              <p className="leading-relaxed text-[11px] font-medium text-slate-600">
                Clique no botão amarelo <strong>"Abrir Pesquisa Pública SEI UFF"</strong>. Uma nova aba do seu navegador será aberta com o site oficial da pesquisa de processos da UFF.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="bg-[#00264d] w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5">
                2
              </div>
              <p className="leading-relaxed text-[11px] font-medium text-slate-600">
                Nesta nova aba do SEI, localize o campo denominado <strong>"Nº do Processo ou Documento"</strong>.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="bg-[#00264d] w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5">
                3
              </div>
              <p className="leading-relaxed text-[11px] font-medium text-slate-600">
                Pressione <strong>Ctrl + V</strong> (ou clique com o botão direito e selecione "Colar") para preencher o número que você copiou anteriormente do nosso portal.
              </p>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="bg-[#00264d] w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5">
                4
              </div>
              <p className="leading-relaxed text-[11px] font-medium text-slate-600">
                Digite os caracteres da imagem anti-robô (CAPTCHA) exigida pelo sistema governamental e clique em <strong>Pesquisar</strong>. O processo e todos os seus despachos e portarias assinadas estarão legíveis na tela.
              </p>
            </div>
          </div>

          <div className="bg-blue-50/50 p-3 rounded-md border border-blue-100 flex gap-2 text-[10px] leading-relaxed text-blue-900 mt-2 font-normal">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Nota sobre a Pesquisa Pública:</p>
              Apenas os documentos de interesse público e sem restrição de sigilo (como nomeações, regimentos e regulamentos gerais) estarão acessíveis na consulta pública. Documentos com informações pessoais de servidores contam com tarjas ou restrições legais conforme a LGPD.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
