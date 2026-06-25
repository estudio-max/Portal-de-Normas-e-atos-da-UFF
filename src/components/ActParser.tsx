import React, { useState } from 'react';
import { 
  Sparkles, Clipboard, AlertCircle, Check, ArrowRight, Play, 
  HelpCircle, RotateCw, FileText, Settings, ShieldAlert, BadgeHelp
} from 'lucide-react';
import { UffAct, ActType, ActRelation } from '../types';
import { SAMPLE_TEXTS_TO_PARSE } from '../data/initialActs';

interface ActParserProps {
  onAddParsedAct: (act: UffAct) => void;
}

export default function ActParser({ onAddParsedAct }: ActParserProps) {
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsedResult, setParsedResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Custom tips for the loading screen (staggered display)
  const [loadingTipIndex, setLoadingTipIndex] = useState(0);
  const loadingTips = [
    "Identificando o tipo do ato (Portaria, Resolução, Instrução de Serviço)...",
    "Localizando referências numéricas e ano de publicação...",
    "Buscando números de processo do SEI (Sistema Eletrônico de Informações)...",
    "Mapeando relações cruzadas (Atos revogados e modificações)...",
    "Gerando resumo didático em linguagem simples...",
    "Gerando palavras-chave relevantes para busca..."
  ];

  // Helper to rotate loading tips
  React.useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingTipIndex(prev => (prev + 1) % loadingTips.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // Load a sample text
  const handleLoadSample = (sampleText: string) => {
    setRawText(sampleText);
    setParsedResult(null);
    setError(null);
  };

  // Run AI Parse
  const handleAiParse = async () => {
    if (!rawText.trim()) {
      alert("Por favor, digite ou cole o texto do ato legislativo para analisar.");
      return;
    }

    setLoading(true);
    setError(null);
    setParsedResult(null);
    setLoadingTipIndex(0);

    try {
      const response = await fetch("/api/parse-act", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: rawText })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ocorreu um erro desconhecido ao chamar a IA.");
      }

      setParsedResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro na conexão com o servidor. Verifique suas configurações de chaves.");
    } finally {
      setLoading(false);
    }
  };

  // Edit fields inside parsed results
  const handleResultChange = (field: string, value: any) => {
    setParsedResult((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  // Add a parsed relationship in the editor
  const handleAddRelationInResult = (tipo: string, destino: string, detalhes: string) => {
    if (!destino) return;
    const newRel: ActRelation = {
      id: `rel-ai-${Date.now()}`,
      tipoRelacao: tipo as any,
      atoDestino: destino,
      detalhes: detalhes || undefined
    };
    setParsedResult((prev: any) => ({
      ...prev,
      relacoes: [...(prev.relacoes || []), newRel]
    }));
  };

  const handleRemoveRelationInResult = (id: string) => {
    setParsedResult((prev: any) => ({
      ...prev,
      relacoes: prev.relacoes.filter((r: any) => r.id !== id)
    }));
  };

  // Save the validated act to spreadsheet database
  const handleSaveToDatabase = () => {
    if (!parsedResult) return;

    // Build formal UFF act
    const finalAct: UffAct = {
      id: `act-parsed-${Date.now()}`,
      tipoAto: parsedResult.tipoAto as ActType,
      numero: parsedResult.numero,
      ano: parsedResult.ano || new Date().getFullYear(),
      dataAssinatura: parsedResult.dataAssinatura || new Date().toISOString().split('T')[0],
      orgaoEmissor: parsedResult.orgaoEmissor || "Reitoria",
      ementa: parsedResult.ementa,
      processoSei: parsedResult.processoSei || null,
      relacoes: parsedResult.relacoes.map((r: any) => ({
        id: r.id || `rel-${Date.now()}-${Math.random()}`,
        tipoRelacao: r.tipoRelacao,
        atoDestino: r.atoDestino,
        detalhes: r.detalhes
      })),
      tags: parsedResult.tags || [],
      conteudoResumido: parsedResult.conteudoResumido || "",
      status: parsedResult.relacoes.some((r: any) => r.tipoRelacao === 'Revoga') ? 'Ativo' : 'Ativo', // Default to active, audit can flag.
      boletimNumero: "BS nº 12/2026",
      linkBoletim: "https://boletimdeservico.uff.br/boletins/bs-2026/",
      notasInternas: "Indexado automaticamente via Inteligência Artificial Gemini.",
      dataCriacao: new Date().toISOString().split('T')[0]
    };

    onAddParsedAct(finalAct);
    
    setSuccessMessage(`O ato ${finalAct.tipoAto} nº ${finalAct.numero}/${finalAct.ano} foi indexado e adicionado à planilha com sucesso!`);
    setParsedResult(null);
    setRawText('');
    
    setTimeout(() => {
      setSuccessMessage(null);
    }, 4500);
  };

  return (
    <div id="act-parser-container" className="space-y-3">
      {/* Introduction banner */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="p-1 bg-yellow-50 text-yellow-600 rounded">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-[#003366] uppercase tracking-wide">
              Assistente IA de Indexação de Boletins UFF
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
            Evite a digitação manual de relatórios e planilhas. Cole o texto copiado de qualquer PDF de Boletim de Serviço da UFF. A inteligência artificial Gemini identificará automaticamente os órgãos, ementas, números de processo SEI e as conexões de revogação ou alteração de normas.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Input panel (5 cols) */}
        <div className="lg:col-span-5 bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col space-y-3">
          <div className="space-y-0.5">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Texto bruto da Legislação</h4>
            <p className="text-[10px] text-slate-400">Cole o texto do ato administrativo ou selecione uma amostra de teste abaixo:</p>
          </div>

          {/* Sample quick selectors */}
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Textos de Demonstração (Uff 2026)</span>
            <div className="flex flex-col gap-1">
              {SAMPLE_TEXTS_TO_PARSE.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleLoadSample(sample.text)}
                  className="text-left p-1.5 bg-slate-50 hover:bg-yellow-50/50 border border-slate-200 hover:border-yellow-400 rounded text-[11px] font-medium text-slate-700 transition-all flex items-center justify-between group cursor-pointer"
                >
                  <span className="line-clamp-1 group-hover:text-slate-950 font-semibold">{sample.title}</span>
                  <Play className="w-2.5 h-2.5 text-slate-400 group-hover:text-yellow-600 shrink-0 ml-1.5" />
                </button>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <div className="flex-1 min-h-[250px] flex flex-col">
            <textarea
              id="textarea-bruto-ato"
              rows={10}
              placeholder="Cole o texto completo ou parte do ato administrativo extraído do Boletim de Serviço da UFF aqui..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full flex-1 p-2 text-[11px] bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 focus:bg-white text-slate-800 font-mono leading-relaxed"
            ></textarea>
          </div>

          <button
            id="btn-analisar-ia"
            type="button"
            onClick={handleAiParse}
            disabled={loading || !rawText.trim()}
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-blue-950 font-bold text-xs py-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed uppercase"
          >
            {loading ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin text-blue-950" />
                <span>Analisando Legislação...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-blue-950 stroke-[2.5px]" />
                <span>Analisar Texto com IA</span>
              </>
            )}
          </button>
        </div>

        {/* Right Output Review panel (7 cols) */}
        <div className="lg:col-span-7">
          {successMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 mb-3 animate-fade-in shadow-xs">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {loading ? (
            /* Elegant loading skeletal with educational quotes */
            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-xs h-full flex flex-col items-center justify-center min-h-[450px] text-center space-y-4">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-12 h-12 rounded-full border-4 border-slate-100 border-t-yellow-500 animate-spin"></div>
                <div className="w-6 h-6 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="space-y-1 max-w-sm">
                <h5 className="font-bold text-xs text-[#003366] uppercase tracking-wide">Extraindo Metadados Inteligentes</h5>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  Aguarde um instante. Nossa IA está mapeando o documento para gerar o índice cadastral.
                </p>
              </div>

              {/* Cycling tips */}
              <div className="bg-slate-50 border border-slate-150 px-3 py-2 rounded text-[10px] text-[#003366] font-bold uppercase tracking-wide flex items-center gap-1.5 animate-pulse max-w-md">
                <Settings className="w-3 h-3 animate-spin text-yellow-500" />
                <span>{loadingTips[loadingTipIndex]}</span>
              </div>
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg text-xs font-medium space-y-2.5 min-h-[450px] flex flex-col justify-center">
              <AlertCircle className="w-6 h-6 text-red-500 mx-auto animate-bounce" />
              <div className="text-center space-y-1">
                <p className="font-bold uppercase tracking-wide">Não foi possível concluir a indexação automática</p>
                <p className="text-slate-500 leading-relaxed max-w-md mx-auto text-[11px]">
                  {error}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded border border-rose-100 text-slate-500 font-normal leading-relaxed text-[10px] max-w-md mx-auto">
                <p className="font-bold text-red-950 mb-0.5 uppercase tracking-wide">Dica de Configuração:</p>
                Para utilizar o assistente de IA, certifique-se de configurar a variável <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[9px] text-rose-800 font-semibold">GEMINI_API_KEY</code> no menu <strong>Settings &gt; Secrets</strong> do AI Studio.
              </div>
            </div>
          ) : parsedResult ? (
            /* Review & Edit parsed Form */
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs space-y-3 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-150 pb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                  <h4 className="font-bold text-xs uppercase tracking-wide text-[#003366]">
                    Revisar Dados Extraídos pela IA
                  </h4>
                </div>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 uppercase">
                  Extração Concluída
                </span>
              </div>

              {/* Grid 1: Tipo, Número e Ano */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Tipo de Ato</label>
                  <select
                    value={parsedResult.tipoAto}
                    onChange={(e) => handleResultChange('tipoAto', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                  >
                    <option value="Portaria">Portaria</option>
                    <option value="Resolução">Resolução</option>
                    <option value="Instrução de Serviço">Instrução de Serviço</option>
                    <option value="Decisão">Decisão</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Número</label>
                  <input
                    type="text"
                    value={parsedResult.numero}
                    onChange={(e) => handleResultChange('numero', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Ano</label>
                  <input
                    type="number"
                    value={parsedResult.ano}
                    onChange={(e) => handleResultChange('ano', Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400 font-semibold"
                  />
                </div>
              </div>

              {/* Grid 2: Data Assinatura, Emissor e SEI */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Data Assinatura</label>
                  <input
                    type="date"
                    value={parsedResult.dataAssinatura}
                    onChange={(e) => handleResultChange('dataAssinatura', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Emissor</label>
                  <input
                    type="text"
                    value={parsedResult.orgaoEmissor}
                    onChange={(e) => handleResultChange('orgaoEmissor', e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400 font-semibold uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Processo SEI</label>
                  <input
                    type="text"
                    value={parsedResult.processoSei || ''}
                    placeholder="Sem processo"
                    onChange={(e) => handleResultChange('processoSei', e.target.value || null)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400 font-mono"
                  />
                </div>
              </div>

              {/* Ementa */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Ementa Oficial</label>
                <textarea
                  rows={2}
                  value={parsedResult.ementa}
                  onChange={(e) => handleResultChange('ementa', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400 leading-normal font-medium"
                ></textarea>
              </div>

              {/* Explicação simples */}
              <div>
                <label className="block text-[9px] font-bold text-[#003366] uppercase mb-0.5">Impacto Didático (Explicação Simples)</label>
                <textarea
                  rows={2}
                  value={parsedResult.conteudoResumido}
                  onChange={(e) => handleResultChange('conteudoResumido', e.target.value)}
                  className="w-full bg-yellow-50/25 border border-yellow-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400 leading-normal font-semibold text-slate-900"
                ></textarea>
              </div>

              {/* Tags Editor */}
              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Palavras-chave (Separadas por vírgula)</label>
                <input
                  type="text"
                  value={parsedResult.tags ? parsedResult.tags.join(', ') : ''}
                  onChange={(e) => handleResultChange('tags', e.target.value.split(',').map((t: string) => t.trim()))}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-yellow-400"
                />
              </div>

              {/* Relations Editor block */}
              <div className="bg-slate-50 p-2.5 rounded-md border border-slate-200 text-xs space-y-1.5">
                <span className="font-bold text-slate-700 block uppercase tracking-wide text-[9px]">Relações Identificadas pela IA ({parsedResult.relacoes?.length || 0})</span>
                
                {parsedResult.relacoes && parsedResult.relacoes.length > 0 ? (
                  <div className="space-y-1">
                    {parsedResult.relacoes.map((rel: any, index: number) => (
                      <div key={index} className="flex items-center justify-between bg-white p-1.5 rounded border border-slate-150">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-1 rounded text-[8px] font-extrabold uppercase ${
                            rel.tipoRelacao === 'Revoga' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {rel.tipoRelacao}
                          </span>
                          <span className="font-bold text-slate-800 text-[11px]">{rel.atoDestino}</span>
                          {rel.detalhes && <span className="text-slate-400 italic font-medium ml-1">({rel.detalhes})</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveRelationInResult(rel.id || index)}
                          className="p-0.5 text-slate-400 hover:text-red-600 rounded transition-all cursor-pointer"
                        >
                          <Check className="w-3 h-3 text-emerald-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 italic">Nenhum vínculo legislativo identificado neste trecho.</p>
                )}
              </div>

              {/* Big Action button to add to spreadsheet */}
              <button
                type="button"
                onClick={handleSaveToDatabase}
                className="w-full bg-[#003366] hover:bg-blue-800 text-white font-bold text-xs py-2 rounded-md transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer uppercase tracking-wider"
              >
                <span>Aprovar Indexação e Salvar na Planilha</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            /* Empty state placeholder */
            <div className="bg-slate-50/50 p-6 rounded-lg border-2 border-dashed border-slate-200 h-full flex flex-col items-center justify-center min-h-[450px] text-center space-y-3">
              <FileText className="w-10 h-10 text-slate-300" />
              <div className="space-y-1 max-w-sm">
                <h5 className="font-bold text-xs text-[#003366] uppercase tracking-wide">Ficha de Revisão Vazia</h5>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  Cole o texto de uma portaria ou resolução ao lado e clique em <strong>Analisar Texto</strong>. O resultado estruturado aparecerá aqui pronto para revisão e salvamento na planilha.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
