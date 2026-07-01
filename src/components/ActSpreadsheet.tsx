import React, { useState, useMemo, useRef } from 'react';
import { 
  Search, Plus, Edit2, Trash2, Download, Upload, Filter, X, Check, CheckSquare, Square, 
  ChevronDown, ChevronUp, Link, Clipboard, HelpCircle, Eye, RefreshCw, AlertCircle, Sparkles
} from 'lucide-react';
import { UffAct, ActType, ActRelation } from '../types';

interface ActSpreadsheetProps {
  acts: UffAct[];
  onAddAct: (act: UffAct) => void;
  onUpdateAct: (act: UffAct) => void;
  onDeleteAct: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkStatusUpdate: (ids: string[], status: 'Ativo' | 'Revogado' | 'Alterado') => void;
  onImportActs: (importedActs: UffAct[]) => void;
}

export default function ActSpreadsheet({
  acts,
  onAddAct,
  onUpdateAct,
  onDeleteAct,
  onBulkDelete,
  onBulkStatusUpdate,
  onImportActs
}: ActSpreadsheetProps) {
  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('todos');
  const [filterOrgao, setFilterOrgao] = useState<string>('todos');
  const [filterAno, setFilterAno] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [soComRelacoes, setSoComRelacoes] = useState(false);
  const [soComSei, setSoComSei] = useState(false);
  const [filterNome, setFilterNome] = useState('');
  const [filterSiape, setFilterSiape] = useState('');

  const LIMITE_RENDER = 300; // máximo de linhas desenhadas de uma vez (desempenho)

  // Sorting State
  const [sortField, setSortField] = useState<keyof UffAct>('dataAssinatura');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals & Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAct, setEditingAct] = useState<UffAct | null>(null);
  const [viewingAct, setViewingAct] = useState<UffAct | null>(null);

  // Form Field States
  const [formTipo, setFormTipo] = useState<ActType>('Portaria');
  const [formNumero, setFormNumero] = useState('');
  const [formAno, setFormAno] = useState<number>(2026);
  const [formData, setFormData] = useState('2026-06-25');
  const [formOrgao, setFormOrgao] = useState('');
  const [formEmenta, setFormEmenta] = useState('');
  const [formSei, setFormSei] = useState('');
  const [formConteudoResumido, setFormConteudoResumido] = useState('');
  const [formStatus, setFormStatus] = useState<'Ativo' | 'Revogado' | 'Alterado'>('Ativo');
  const [formBoletimNum, setFormBoletimNum] = useState('');
  const [formBoletimLink, setFormBoletimLink] = useState('');
  const [formNotas, setFormNotas] = useState('');
  const [formTagsString, setFormTagsString] = useState('');
  const [formRelations, setFormRelations] = useState<ActRelation[]>([]);

  // Relation Form Inputs
  const [relTipo, setRelTipo] = useState<'Altera' | 'Revoga' | 'Complementa' | 'Regulamenta'>('Altera');
  const [relDestino, setRelDestino] = useState('');
  const [relDetalhes, setRelDetalhes] = useState('');

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [rawImportData, setRawImportData] = useState('');

  // SEI link builder
  const handleCopySei = (sei: string) => {
    navigator.clipboard.writeText(sei);
    alert(`Processo SEI ${sei} copiado para a área de transferência!`);
  };

  // Extract unique options for filters
  const uniqueTypes = useMemo(() => Array.from(new Set(acts.map(a => a.tipoAto))), [acts]);
  const uniqueOrgaos = useMemo(() => Array.from(new Set(acts.map(a => a.orgaoEmissor))).sort(), [acts]);
  const uniqueYears = useMemo(() => Array.from(new Set(acts.map(a => a.ano))).sort((a, b) => b - a), [acts]);

  // Resolve relações para atos da própria base (para navegar clicando)
  const actById = useMemo(() => new Map(acts.map(a => [a.id, a])), [acts]);
  const resolveRef = (atoDestino: string): UffAct | undefined => {
    const dest = atoDestino.toLowerCase();
    const nums = (atoDestino.match(/\d[\d.]*/g) || []).map(s => s.replace(/\D/g, ''));
    return acts.find(a => {
      const nd = a.numero.replace(/\D/g, '');
      if (!nd || !nums.includes(nd)) return false;
      const sigla = (a.orgaoEmissor || '').toLowerCase().split(/[ /]/)[0];
      const tipoWord = a.tipoAto.toLowerCase().split(' ')[0];
      const siglaOk = sigla && sigla !== 'reitoria' && sigla !== 'uff' && dest.includes(sigla);
      return siglaOk || (dest.includes(tipoWord) && nd.length >= 3);
    });
  };

  // Handle Sort
  const handleSort = (field: keyof UffAct) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter & Sort Acts
  const filteredAndSortedActs = useMemo(() => {
    return acts
      .filter(act => {
        const matchesSearch = 
          act.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
          act.ementa.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (act.processoSei && act.processoSei.toLowerCase().includes(searchTerm.toLowerCase())) ||
          act.orgaoEmissor.toLowerCase().includes(searchTerm.toLowerCase()) ||
          act.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
          act.conteudoResumido.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesType = filterType === 'todos' || act.tipoAto === filterType;
        const matchesOrgao = filterOrgao === 'todos' || act.orgaoEmissor === filterOrgao;
        const matchesAno = filterAno === 'todos' || act.ano.toString() === filterAno;
        const matchesStatus = filterStatus === 'todos' || act.status === filterStatus;
        const temRelacoes = (act.relacoes && act.relacoes.length > 0) ||
                            (act.referenciadoPor && act.referenciadoPor.length > 0);
        const matchesRel = !soComRelacoes || temRelacoes;
        const matchesSei = !soComSei || !!act.processoSei;

        // Busca por NOME no corpo do ato (pega tabelas/listas), ementa e assinante
        const nome = filterNome.trim().toLowerCase();
        const matchesNome = !nome ||
          (act.textoBusca || '').includes(nome) ||
          act.ementa.toLowerCase().includes(nome) ||
          act.orgaoEmissor.toLowerCase().includes(nome) ||
          (act.signatario || '').toLowerCase?.().includes(nome);
        // Busca por matrícula SIAPE (lista extraída + corpo, para SIAPEs em tabela)
        const siape = filterSiape.replace(/\D/g, '');
        const matchesSiape = !siape ||
          (act.siapes || []).some(s => s.includes(siape)) ||
          (act.textoBusca || '').includes(siape);

        return matchesSearch && matchesType && matchesOrgao && matchesAno && matchesStatus
               && matchesRel && matchesSei && matchesNome && matchesSiape;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (valA === undefined || valA === null) return sortDirection === 'asc' ? -1 : 1;
        if (valB === undefined || valB === null) return sortDirection === 'asc' ? 1 : -1;

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' 
            ? valA.localeCompare(valB) 
            : valB.localeCompare(valA);
        } else {
          return sortDirection === 'asc'
            ? (valA as number) - (valB as number)
            : (valB as number) - (valA as number);
        }
      });
  }, [acts, searchTerm, filterType, filterOrgao, filterAno, filterStatus, soComRelacoes, soComSei, filterNome, filterSiape, sortField, sortDirection]);

  // Bulk selections
  const handleSelectAll = () => {
    if (selectedIds.length === filteredAndSortedActs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAndSortedActs.map(a => a.id));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Open Form for Adding New Act
  const openAddForm = () => {
    setEditingAct(null);
    setFormTipo('Portaria');
    setFormNumero('');
    setFormAno(2026);
    setFormData('2026-06-25');
    setFormOrgao('Reitoria');
    setFormEmenta('');
    setFormSei('');
    setFormConteudoResumido('');
    setFormStatus('Ativo');
    setFormBoletimNum('BS nº 12/2026');
    setFormBoletimLink('https://boletimdeservico.uff.br/boletins/bs-2026/');
    setFormNotas('');
    setFormTagsString('Nomeação, Comissão, Boletim');
    setFormRelations([]);
    setIsFormOpen(true);
  };

  // Open Form for Editing Existing Act
  const openEditForm = (act: UffAct) => {
    setEditingAct(act);
    setFormTipo(act.tipoAto);
    setFormNumero(act.numero);
    setFormAno(act.ano);
    setFormData(act.dataAssinatura);
    setFormOrgao(act.orgaoEmissor);
    setFormEmenta(act.ementa);
    setFormSei(act.processoSei || '');
    setFormConteudoResumido(act.conteudoResumido);
    setFormStatus(act.status);
    setFormBoletimNum(act.boletimNumero || '');
    setFormBoletimLink(act.linkBoletim || '');
    setFormNotas(act.notasInternas || '');
    setFormTagsString(act.tags.join(', '));
    setFormRelations([...act.relacoes]);
    setIsFormOpen(true);
  };

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNumero || !formOrgao || !formEmenta) {
      alert("Por favor, preencha os campos obrigatórios (Número, Órgão Emissor, Ementa).");
      return;
    }

    const processedTags = formTagsString
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    const actData: UffAct = {
      id: editingAct ? editingAct.id : `act-${Date.now()}`,
      tipoAto: formTipo,
      numero: formNumero,
      ano: Number(formAno),
      dataAssinatura: formData,
      orgaoEmissor: formOrgao,
      ementa: formEmenta,
      processoSei: formSei.trim() || null,
      relacoes: formRelations,
      tags: processedTags,
      conteudoResumido: formConteudoResumido || formEmenta.substring(0, 150) + "...",
      status: formStatus,
      boletimNumero: formBoletimNum || undefined,
      linkBoletim: formBoletimLink || undefined,
      notasInternas: formNotas || undefined,
      dataCriacao: editingAct?.dataCriacao || new Date().toISOString().split('T')[0]
    };

    if (editingAct) {
      onUpdateAct(actData);
    } else {
      onAddAct(actData);
    }

    setIsFormOpen(false);
    setEditingAct(null);
  };

  // Add Relation helper
  const handleAddRelation = () => {
    if (!relDestino) {
      alert("Informe o ato de destino da relação (ex: Portaria nº 123/2024)");
      return;
    }
    const newRelation: ActRelation = {
      id: `rel-${Date.now()}`,
      tipoRelacao: relTipo,
      atoDestino: relDestino,
      detalhes: relDetalhes || undefined
    };
    setFormRelations(prev => [...prev, newRelation]);
    setRelDestino('');
    setRelDetalhes('');
  };

  const handleRemoveRelation = (id: string) => {
    setFormRelations(prev => prev.filter(r => r.id !== id));
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      "Tipo de Ato", "Número", "Ano", "Data de Assinatura", "Órgão Emissor", 
      "Ementa", "Processo SEI", "Status", "Boletim Número", "Link Boletim", 
      "Marcadores", "Explicação Simples", "Relações (Formato JSON)"
    ];

    const rows = filteredAndSortedActs.map(a => [
      a.tipoAto,
      `"${a.numero}"`,
      a.ano,
      a.dataAssinatura,
      `"${a.orgaoEmissor}"`,
      `"${a.ementa.replace(/"/g, '""')}"`,
      `"${a.processoSei || ''}"`,
      a.status,
      `"${a.boletimNumero || ''}"`,
      `"${a.linkBoletim || ''}"`,
      `"${a.tags.join(',')}"`,
      `"${a.conteudoResumido.replace(/"/g, '""')}"`,
      `"${JSON.stringify(a.relacoes).replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `portal_normas_uff_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import from CSV/JSON Text
  const handleImportTextSubmit = () => {
    try {
      if (!rawImportData.trim()) {
        alert("Cole algum conteúdo CSV ou JSON para importar.");
        return;
      }

      let parsedActs: UffAct[] = [];

      // Check if it's JSON
      if (rawImportData.trim().startsWith('[')) {
        parsedActs = JSON.parse(rawImportData);
      } else {
        // Simple CSV parser
        const lines = rawImportData.split('\n');
        if (lines.length < 2) throw new Error("CSV inválido ou sem dados.");
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Basic CSV quote-aware splitter
          const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
          if (!matches) continue;
          
          const cols = matches.map(c => c.trim().replace(/^["']|["']$/g, '').replace(/""/g, '"'));
          
          const act: any = {
            id: `imported-${Date.now()}-${i}`,
            tipoAto: (cols[0] as ActType) || "Portaria",
            numero: cols[1] || "",
            ano: Number(cols[2]) || 2026,
            dataAssinatura: cols[3] || new Date().toISOString().split('T')[0],
            orgaoEmissor: cols[4] || "Reitoria",
            ementa: cols[5] || "",
            processoSei: cols[6] || null,
            status: (cols[7] as any) || "Ativo",
            boletimNumero: cols[8] || undefined,
            linkBoletim: cols[9] || undefined,
            tags: cols[10] ? cols[10].split(',') : [],
            conteudoResumido: cols[11] || "",
            relacoes: []
          };

          if (cols[12]) {
            try {
              act.relacoes = JSON.parse(cols[12]);
            } catch (e) {
              act.relacoes = [];
            }
          }
          parsedActs.push(act);
        }
      }

      if (parsedActs.length === 0) {
        throw new Error("Nenhum ato válido foi extraído do arquivo.");
      }

      onImportActs(parsedActs);
      setImportStatus(`Sucesso: ${parsedActs.length} atos importados com sucesso!`);
      setTimeout(() => {
        setIsImportModalOpen(false);
        setRawImportData('');
        setImportStatus(null);
      }, 1500);

    } catch (err: any) {
      alert(`Erro na importação: ${err.message || err}`);
    }
  };

  // Demo CSV template generator
  const handleFillDemoImport = () => {
    const demoCsv = `Tipo de Ato,Número,Ano,Data de Assinatura,Órgão Emissor,Ementa,Processo SEI,Status,Boletim Número,Link Boletim,Marcadores,Explicação Simples,Relações (Formato JSON)
Portaria,68.991,2026,2026-06-25,PROGRAD,"Aprova novas normas de matrícula extraordinária de calouros para o segundo semestre de 2026",23069.011845/2026-33,Ativo,BS nº 15/2026,https://boletimdeservico.uff.br/boletins/bs-2026/,"Matrícula,Calouros,Graduação","Regula as regras para preenchimento de vagas ociosas em disciplinas de graduação da UFF na segunda fase.",[]`;
    setRawImportData(demoCsv);
  };

  return (
    <div id="act-spreadsheet-container" className="space-y-3">
      {/* Search, Filter and Import/Export Tools Panel */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex flex-col md:flex-row items-stretch justify-between gap-2.5">
          {/* Main Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2 w-3.5 h-3.5 text-slate-400" />
            <input
              id="input-busca-geral"
              type="text"
              placeholder="Buscar por número, ementa, processo SEI, tags, conteúdo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 focus:bg-white transition-all text-slate-800"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-1.5 p-0.5 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Action buttons (Add, Import, Export) */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-cadastrar-ato"
              onClick={openAddForm}
              className="flex items-center gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-blue-950 font-bold text-xs px-3 py-1.5 rounded-md transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-blue-950 stroke-[3px]" />
              <span>CADASTRAR ATO</span>
            </button>

            <button
              id="btn-importar-csv"
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs px-2.5 py-1.5 rounded-md transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Importar Planilha</span>
            </button>

            <button
              id="btn-exportar-csv"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs px-2.5 py-1.5 rounded-md transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* Dropdown Filters row */}
        <div className="flex items-center gap-2.5 flex-wrap bg-slate-50 p-2 rounded-md border border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
            <span className="font-bold text-slate-500 mr-1.5">FILTROS:</span>
          </div>

          {/* Type Filter */}
          <div className="flex flex-col gap-1">
            <select
              id="select-filtro-tipo"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-white border border-slate-200 hover:border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-yellow-400"
            >
              <option value="todos">Tipo: Todos</option>
              {uniqueTypes.sort().map(tp => (
                <option key={tp} value={tp}>{tp}</option>
              ))}
            </select>
          </div>

          {/* Emitting Body Filter */}
          <div className="flex flex-col gap-1">
            <select
              id="select-filtro-orgao"
              value={filterOrgao}
              onChange={(e) => setFilterOrgao(e.target.value)}
              className="bg-white border border-slate-200 hover:border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-yellow-400"
            >
              <option value="todos">Emissor: Todos</option>
              {uniqueOrgaos.map(orgao => (
                <option key={orgao} value={orgao}>{orgao}</option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="flex flex-col gap-1">
            <select
              id="select-filtro-ano"
              value={filterAno}
              onChange={(e) => setFilterAno(e.target.value)}
              className="bg-white border border-slate-200 hover:border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-yellow-400"
            >
              <option value="todos">Ano: Todos</option>
              {uniqueYears.map(year => (
                <option key={year} value={year.toString()}>{year}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col gap-1">
            <select
              id="select-filtro-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white border border-slate-200 hover:border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-yellow-400"
            >
              <option value="todos">Status: Todos</option>
              <option value="Ativo">Vigentes</option>
              <option value="Revogado">Revogados</option>
              <option value="Alterado">Alterados</option>
            </select>
          </div>

          {/* Busca por NOME do servidor (no corpo do ato) */}
          <div className="relative">
            <input
              id="input-filtro-nome"
              type="text"
              placeholder="Nome do servidor…"
              value={filterNome}
              onChange={(e) => setFilterNome(e.target.value)}
              title="Mostra só os atos que mencionam este nome (busca no corpo, inclusive tabelas)"
              className="w-40 bg-white border border-slate-200 hover:border-slate-300 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-yellow-400"
            />
          </div>

          {/* Busca por matrícula SIAPE */}
          <div className="relative">
            <input
              id="input-filtro-siape"
              type="text"
              inputMode="numeric"
              placeholder="SIAPE…"
              value={filterSiape}
              onChange={(e) => setFilterSiape(e.target.value)}
              title="Mostra só os atos que citam esta matrícula SIAPE"
              className="w-28 bg-white border border-slate-200 hover:border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-yellow-400"
            />
          </div>

          {/* Atalhos rápidos (chips) */}
          <button
            onClick={() => setSoComRelacoes(v => !v)}
            className={`px-2 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer ${soComRelacoes ? 'bg-[#003366] text-white border-[#003366]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
          >
            só c/ relações
          </button>
          <button
            onClick={() => setSoComSei(v => !v)}
            className={`px-2 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer ${soComSei ? 'bg-[#003366] text-white border-[#003366]' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
          >
            só c/ SEI
          </button>

          {/* Clear Filters helper */}
          {(filterType !== 'todos' || filterOrgao !== 'todos' || filterAno !== 'todos' || filterStatus !== 'todos' || searchTerm || filterNome || filterSiape || soComRelacoes || soComSei) && (
            <button
              id="btn-limpar-filtros"
              onClick={() => {
                setFilterType('todos');
                setFilterOrgao('todos');
                setFilterAno('todos');
                setFilterStatus('todos');
                setSearchTerm('');
                setFilterNome('');
                setFilterSiape('');
                setSoComRelacoes(false);
                setSoComSei(false);
              }}
              className="ml-auto flex items-center gap-1 text-yellow-600 hover:text-yellow-700 font-bold text-xs uppercase tracking-wide cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpar Filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* Bulk actions notification bar */}
      {selectedIds.length > 0 && (
        <div id="barra-acoes-em-massa" className="bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg flex items-center justify-between text-xs text-blue-900 animate-fade-in">
          <div className="flex items-center gap-2 font-semibold">
            <CheckSquare className="w-4 h-4 text-[#003366]" />
            <span><strong>{selectedIds.length}</strong> atos selecionados para ações em lote:</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                onBulkStatusUpdate(selectedIds, 'Ativo');
                setSelectedIds([]);
              }}
              className="bg-white hover:bg-emerald-50 border border-slate-200 text-emerald-700 font-bold px-2 py-1 rounded text-xs transition-all cursor-pointer shadow-xs"
            >
              Definir Ativo
            </button>
            <button
              onClick={() => {
                onBulkStatusUpdate(selectedIds, 'Alterado');
                setSelectedIds([]);
              }}
              className="bg-white hover:bg-blue-50 border border-slate-200 text-blue-700 font-bold px-2 py-1 rounded text-xs transition-all cursor-pointer shadow-xs"
            >
              Definir Alterado
            </button>
            <button
              onClick={() => {
                onBulkStatusUpdate(selectedIds, 'Revogado');
                setSelectedIds([]);
              }}
              className="bg-white hover:bg-red-50 border border-slate-200 text-red-700 font-bold px-2 py-1 rounded text-xs transition-all cursor-pointer shadow-xs"
            >
              Definir Revogado
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Tem certeza de que deseja excluir permanentemente estes ${selectedIds.length} atos?`)) {
                  onBulkDelete(selectedIds);
                  setSelectedIds([]);
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-2.5 py-1 rounded text-xs transition-all flex items-center gap-1 cursor-pointer shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir Selecionados
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-slate-500 hover:text-slate-800 px-2 cursor-pointer font-bold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Contagem de resultados + aviso de limite de exibição */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
        <span>
          <strong className="text-slate-700">{filteredAndSortedActs.length}</strong> ato(s) encontrado(s)
          {filteredAndSortedActs.length > LIMITE_RENDER && (
            <span className="text-amber-600 font-semibold"> — exibindo os primeiros {LIMITE_RENDER}. Refine a busca ou os filtros para ver os demais.</span>
          )}
        </span>
      </div>

      {/* Main Spreadsheet Grid (High Density) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                <th className="py-2 px-2.5 w-10 text-center">
                  <button 
                    onClick={handleSelectAll}
                    className="p-1 hover:bg-slate-200 rounded cursor-pointer"
                  >
                    {selectedIds.length === filteredAndSortedActs.length && filteredAndSortedActs.length > 0 ? (
                      <CheckSquare className="w-3.5 h-3.5 text-[#003366]" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="py-2 px-2.5 w-40 cursor-pointer hover:bg-slate-100 transition-all" onClick={() => handleSort('tipoAto')}>
                  <div className="flex items-center gap-1">
                    <span>Ato / Número</span>
                    {sortField === 'tipoAto' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="py-2 px-2.5 w-24 cursor-pointer hover:bg-slate-100 transition-all" onClick={() => handleSort('dataAssinatura')}>
                  <div className="flex items-center gap-1">
                    <span>Assinatura</span>
                    {sortField === 'dataAssinatura' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="py-2 px-2.5 w-28 cursor-pointer hover:bg-slate-100 transition-all" onClick={() => handleSort('orgaoEmissor')}>
                  <div className="flex items-center gap-1">
                    <span>Emissor</span>
                    {sortField === 'orgaoEmissor' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="py-2 px-2.5 cursor-pointer hover:bg-slate-100 transition-all" onClick={() => handleSort('ementa')}>
                  <div className="flex items-center gap-1">
                    <span>Ementa (Assunto)</span>
                    {sortField === 'ementa' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="py-2 px-2.5 w-36">
                  <div className="flex items-center gap-1">
                    <span>Relações</span>
                  </div>
                </th>
                <th className="py-2 px-2.5 w-44 cursor-pointer hover:bg-slate-100 transition-all" onClick={() => handleSort('processoSei')}>
                  <div className="flex items-center gap-1">
                    <span>Processo SEI</span>
                    {sortField === 'processoSei' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="py-2 px-2.5 w-24 text-center cursor-pointer hover:bg-slate-100 transition-all" onClick={() => handleSort('status')}>
                  <div className="flex items-center justify-center gap-1">
                    <span>Status</span>
                    {sortField === 'status' && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
                <th className="py-2 px-2.5 w-28 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredAndSortedActs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    <AlertCircle className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                    <p className="font-semibold text-slate-500 text-xs">Nenhum ato legislativo encontrado.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tente ajustar seus termos de pesquisa ou remover os filtros aplicados.</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedActs.slice(0, LIMITE_RENDER).map((act) => {
                  const isSelected = selectedIds.includes(act.id);
                  return (
                    <tr 
                      key={act.id} 
                      className={`hover:bg-blue-50/40 transition-colors duration-100 ${
                        isSelected ? 'bg-blue-50/20' : ''
                      } ${act.status === 'Revogado' ? 'bg-slate-50/40 text-slate-400' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="py-1.5 px-2.5 text-center">
                        <button 
                          onClick={() => handleSelectOne(act.id)}
                          className="p-1 hover:bg-slate-200/60 rounded cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-[#003366]" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-slate-300" />
                          )}
                        </button>
                      </td>

                      {/* Name / Number */}
                      <td className="py-1.5 px-2.5">
                        <div className="font-bold text-slate-900 leading-tight">
                          {act.tipoAto}
                        </div>
                        <div className="text-[10px] font-mono font-bold text-blue-800 bg-blue-50 px-1 py-0.25 rounded border border-blue-100 inline-block mt-0.5">
                          nº {act.numero}/{act.ano}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-1.5 px-2.5 whitespace-nowrap text-[11px] font-bold font-mono text-slate-600">
                        {act.dataAssinatura.split('-').reverse().join('/')}
                      </td>

                      {/* Issuer */}
                      <td className="py-1.5 px-2.5 font-bold text-slate-700 text-[11px] uppercase tracking-wide">
                        {act.orgaoEmissor}
                      </td>

                      {/* Summary / Ementa */}
                      <td className="py-1.5 px-2.5">
                        <div className="line-clamp-2 text-[11px] text-slate-800 leading-normal" title={act.ementa}>
                          {act.ementa}
                        </div>
                        {act.tags.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {act.tags.slice(0, 4).map((tag, i) => (
                              <span 
                                key={i} 
                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-[9px] font-bold px-1.5 py-0.25 rounded transition-all cursor-default"
                              >
                                #{tag}
                              </span>
                            ))}
                            {act.tags.length > 4 && (
                              <span className="text-[9px] text-slate-400 ml-1 font-bold">+{act.tags.length - 4}</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Relações (saída + entrada/referenciado por) */}
                      <td className="py-1.5 px-2.5">
                        {(() => {
                          const out = Array.from(new Set(act.relacoes.map(r => r.tipoRelacao)));
                          const inb = act.referenciadoPor || [];
                          const cor = (t: string) => t === 'Revoga'
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : t === 'Altera'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-indigo-100 text-indigo-800 border-indigo-200';
                          if (out.length === 0 && inb.length === 0) {
                            return <span className="text-slate-300 text-[11px]">—</span>;
                          }
                          return (
                            <button
                              onClick={() => setViewingAct(act)}
                              title="Ver atos relacionados (clicável)"
                              className="flex flex-wrap items-center gap-1 cursor-pointer hover:opacity-70 transition-opacity text-left"
                            >
                              {out.map((t, i) => (
                                <span key={i}
                                  className={`px-1.5 py-0.25 rounded text-[9px] font-extrabold uppercase border ${cor(t)}`}>
                                  {t}
                                </span>
                              ))}
                              {inb.length > 0 && (
                                <span
                                  className="px-1.5 py-0.25 rounded text-[9px] font-extrabold uppercase border bg-slate-100 text-slate-600 border-slate-200 inline-flex items-center gap-0.5">
                                  ↩ {inb.length}
                                </span>
                              )}
                            </button>
                          );
                        })()}
                      </td>

                      {/* SEI Number */}
                      <td className="py-1.5 px-2.5 text-[11px] font-mono">
                        {act.processoSei ? (
                          <div className="flex items-center gap-1 text-blue-900 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded transition-all w-fit group">
                            <span className="font-bold text-blue-950">{act.processoSei}</span>
                            <button
                              onClick={() => handleCopySei(act.processoSei!)}
                              className="p-0.5 hover:bg-blue-200 rounded text-slate-400 hover:text-blue-700 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                              title="Copiar Número do Processo SEI"
                            >
                              <Clipboard className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">Não vinculado</span>
                        )}
                      </td>

                      {/* Status Badges conforming strictly to Design instructions */}
                      <td className="py-1.5 px-2.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                          act.status === 'Ativo' 
                            ? 'bg-green-100 text-green-700 border-green-200' 
                            : act.status === 'Revogado'
                            ? 'bg-red-100 text-red-700 border-red-200' 
                            : 'bg-blue-100 text-blue-700 border-blue-200'
                        }`}>
                          {act.status === 'Ativo' ? 'VIGENTE' : act.status === 'Revogado' ? 'REVOGADO' : 'ALTERADO'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-1.5 px-2.5">
                        <div className="flex items-center justify-center gap-1">
                          {/* View details */}
                          <button
                            onClick={() => setViewingAct(act)}
                            title="Ver detalhes"
                            className="p-1 bg-slate-50 hover:bg-slate-150 text-slate-600 rounded transition-all cursor-pointer border border-slate-200"
                          >
                            <Eye className="w-3 h-3" />
                          </button>

                          {/* Edit inline */}
                          <button
                            onClick={() => openEditForm(act)}
                            title="Editar Ato"
                            className="p-1 bg-slate-50 hover:bg-blue-100 text-[#003366] rounded transition-all cursor-pointer border border-slate-200"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => {
                              if (window.confirm(`Excluir o ato ${act.tipoAto} nº ${act.numero}/${act.ano} permanentemente?`)) {
                                onDeleteAct(act.id);
                              }
                            }}
                            title="Excluir do Portal"
                            className="p-1 bg-slate-50 hover:bg-red-100 text-rose-600 hover:text-rose-900 rounded transition-all cursor-pointer border border-slate-200"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW ACT DETAILS PANEL */}
      {viewingAct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-[#0A2540] text-white p-5 rounded-t-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[#009485]">Ficha do Ato Indexado</span>
                <h3 className="text-lg font-semibold tracking-tight mt-1">
                  {viewingAct.tipoAto} nº {viewingAct.numero}/{viewingAct.ano}
                </h3>
              </div>
              <button 
                onClick={() => setViewingAct(null)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content body */}
            <div className="p-6 space-y-5 text-sm text-slate-700">
              {/* Core Attributes */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-400 font-medium uppercase">Órgão Emissor</div>
                  <div className="font-bold text-slate-900 mt-0.5">{viewingAct.orgaoEmissor}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-400 font-medium uppercase">Data de Assinatura</div>
                  <div className="font-bold font-mono text-slate-900 mt-0.5">
                    {viewingAct.dataAssinatura.split('-').reverse().join('/')}
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-400 font-medium uppercase">Processo / Documento SEI</div>
                  <div className="font-mono text-slate-900 mt-0.5 font-bold">
                    {viewingAct.processoSei ? (
                      <span className="text-blue-900 underline hover:text-blue-950 cursor-pointer" onClick={() => handleCopySei(viewingAct.processoSei!)} title="Copiar número do processo">
                        {viewingAct.processoSei}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic font-normal">Não vinculado</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {viewingAct.linkSeiProcesso && (
                      <a href={viewingAct.linkSeiProcesso} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#003366] text-white px-2 py-1 rounded hover:bg-blue-900 transition-all no-underline">
                        🔎 Abrir processo no SEI
                      </a>
                    )}
                    {viewingAct.linkSeiDocumento && (
                      <a href={viewingAct.linkSeiDocumento} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-700 text-white px-2 py-1 rounded hover:bg-blue-800 transition-all no-underline"
                        title={`Documento SEI ${viewingAct.seiDocumento || ''}`}>
                        📄 Documento{viewingAct.seiDocumento ? ` ${viewingAct.seiDocumento}` : ''}
                      </a>
                    )}
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-400 font-medium uppercase">Status da Vigência</div>
                  <div className="mt-0.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                      viewingAct.status === 'Ativo' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : viewingAct.status === 'Revogado'
                        ? 'bg-rose-100 text-rose-800' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {viewingAct.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* SIAPEs citadas no ato */}
              {viewingAct.siapes && viewingAct.siapes.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
                    Matrículas SIAPE citadas ({viewingAct.siapes.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {viewingAct.siapes.map((s, i) => (
                      <button key={i} onClick={() => { setViewingAct(null); setFilterSiape(s); }}
                        title="Filtrar atos por esta matrícula"
                        className="font-mono text-[11px] bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-900 border border-slate-200 px-2 py-0.5 rounded cursor-pointer transition-all">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Official Ementa */}
              <div className="space-y-1">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Ementa Oficial (Publicada no Boletim)</span>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs italic font-medium leading-relaxed text-slate-800">
                  "{viewingAct.ementa}"
                </div>
              </div>

              {/* AI simple explanation */}
              <div className="space-y-1 bg-teal-50/40 p-4 rounded-xl border border-teal-100">
                <span className="text-xs text-[#009485] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Explicação em Linguagem Simples (Impacto Prático)
                </span>
                <p className="text-xs text-slate-800 leading-relaxed mt-1">
                  {viewingAct.conteudoResumido}
                </p>
              </div>

              {/* Relationships */}
              <div className="space-y-2">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Relações Legislativas ({viewingAct.relacoes.length})</span>
                {viewingAct.relacoes.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhum vínculo legislativo registrado.</p>
                ) : (
                  <div className="space-y-1.5">
                    {viewingAct.relacoes.map((rel, index) => {
                      const alvo = resolveRef(rel.atoDestino);
                      return (
                      <div key={index} className="flex items-start gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                          rel.tipoRelacao === 'Revoga'
                            ? 'bg-rose-100 text-rose-800'
                            : rel.tipoRelacao === 'Altera'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {rel.tipoRelacao}
                        </span>
                        <div>
                          {alvo ? (
                            <button
                              onClick={() => setViewingAct(alvo)}
                              className="font-semibold text-blue-800 hover:text-blue-950 underline decoration-dotted cursor-pointer text-left"
                              title="Abrir este ato"
                            >
                              {rel.atoDestino}
                            </button>
                          ) : (
                            <span className="font-semibold text-slate-900">
                              {rel.atoDestino} <span className="text-slate-400 italic font-normal">(ato externo)</span>
                            </span>
                          )}
                          {rel.detalhes && <span className="text-slate-500 ml-1">({rel.detalhes})</span>}
                        </div>
                      </div>
                    );})}
                  </div>
                )}
              </div>

              {/* Referenciado por (índice reverso pré-calculado) */}
              <div className="space-y-2">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
                  Referenciado por ({(viewingAct.referenciadoPor || []).length})
                </span>
                {(viewingAct.referenciadoPor || []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Nenhum ato posterior altera ou revoga este.</p>
                ) : (
                  <div className="space-y-1.5">
                    {(viewingAct.referenciadoPor || []).map((rev, index) => {
                      const origem = actById.get(rev.porId);
                      return (
                      <div key={index} className="flex items-start gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${
                          rev.relacao === 'Revoga' ? 'bg-rose-100 text-rose-800'
                            : rev.relacao === 'Altera' ? 'bg-amber-100 text-amber-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {rev.relacao === 'Revoga' ? 'Revogado por' : rev.relacao === 'Altera' ? 'Alterado por' : 'Referenciado por'}
                        </span>
                        {origem ? (
                          <button
                            onClick={() => setViewingAct(origem)}
                            className="font-semibold text-blue-800 hover:text-blue-950 underline decoration-dotted cursor-pointer text-left"
                            title="Abrir este ato"
                          >
                            {rev.porLabel}
                          </button>
                        ) : (
                          <span className="font-semibold text-slate-900">{rev.porLabel}</span>
                        )}
                      </div>
                    );})}
                  </div>
                )}
              </div>

              {/* Tags & Metadata */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs text-slate-400">
                <div className="flex gap-1.5">
                  {viewingAct.tags.map((tag, i) => (
                    <span key={i} className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded">#{tag}</span>
                  ))}
                </div>
                <span>Adicionado em: {viewingAct.dataCriacao || 'N/A'}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-150 rounded-b-2xl flex justify-between gap-2">
              {viewingAct.boletimNumero && (
                <div className="text-xs flex items-center gap-1 text-slate-500">
                  <span>Publicado em: <strong>{viewingAct.boletimNumero}</strong></span>
                  {viewingAct.linkBoletim && (
                    <a href={viewingAct.linkBoletim} target="_blank" referrerPolicy="no-referrer" className="text-teal-600 hover:underline inline-flex items-center gap-0.5">
                      (Acessar Boletim <Link className="w-2.5 h-2.5" />)
                    </a>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => {
                    const act = viewingAct;
                    setViewingAct(null);
                    openEditForm(act);
                  }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-4 py-2 rounded-lg transition-all cursor-pointer"
                >
                  Editar Dados
                </button>
                <button
                  onClick={() => setViewingAct(null)}
                  className="bg-[#0A2540] hover:bg-blue-900 text-white font-medium px-4 py-2 rounded-lg transition-all cursor-pointer"
                >
                  Fechar Ficha
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL (Add / Edit) */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-150 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-[#0A2540] text-white p-5 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingAct ? `Editar ${editingAct.tipoAto} nº ${editingAct.numero}` : 'Cadastrar Novo Ato Administrativo'}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm text-slate-700">
              {/* Row 1: Tipo e Número */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de Ato *</label>
                  <select
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value as ActType)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    {['Portaria','Resolução','Determinação de Serviço','Instrução Normativa','Norma de Serviço','Decisão','Comunicado','Edital','Resumo de Despachos','Outro'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Número *</label>
                  <input
                    type="text"
                    placeholder="Ex: 68.321"
                    value={formNumero}
                    onChange={(e) => setFormNumero(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Ano *</label>
                  <input
                    type="number"
                    value={formAno}
                    onChange={(e) => setFormAno(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Data da Assinatura *</label>
                  <input
                    type="date"
                    value={formData}
                    onChange={(e) => setFormData(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                  />
                </div>
              </div>

              {/* Row 2: Emissor e SEI */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Órgão Emissor *</label>
                  <input
                    type="text"
                    placeholder="Ex: Reitoria, PROGEPE, CEPEx..."
                    value={formOrgao}
                    onChange={(e) => setFormOrgao(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 uppercase font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Processo SEI (Se houver)</label>
                  <input
                    type="text"
                    placeholder="Ex: 23069.XXXXXX/YYYY-ZZ"
                    value={formSei}
                    onChange={(e) => setFormSei(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Status da Vigência *</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Alterado">Alterado</option>
                    <option value="Revogado">Revogado</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Ementa */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Ementa Oficial (Publicado) *</label>
                <textarea
                  rows={3}
                  placeholder="Ementa oficial como escrita no boletim..."
                  value={formEmenta}
                  onChange={(e) => setFormEmenta(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                ></textarea>
              </div>

              {/* Row 4: Explicação simples */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Explicação em Linguagem Simples</label>
                <textarea
                  rows={2}
                  placeholder="Escreva de forma simples o que muda com este ato na prática..."
                  value={formConteudoResumido}
                  onChange={(e) => setFormConteudoResumido(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                ></textarea>
              </div>

              {/* Row 5: Boletim de Serviço */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Boletim Número</label>
                  <input
                    type="text"
                    placeholder="Ex: BS nº 12/2026"
                    value={formBoletimNum}
                    onChange={(e) => setFormBoletimNum(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Link do Boletim PDF</label>
                  <input
                    type="url"
                    placeholder="https://boletimdeservico.uff.br/..."
                    value={formBoletimLink}
                    onChange={(e) => setFormBoletimLink(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Row 6: Tags e Marcadores */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Marcadores (Tags separadas por vírgulas)</label>
                <input
                  type="text"
                  placeholder="Ex: Servidores, Nomeação, Comissão, Graduação..."
                  value={formTagsString}
                  onChange={(e) => setFormTagsString(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* SECTION: Vínculos/Relações de Alteração e Revogação */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0A2540] block border-b border-slate-200 pb-1.5">Vínculos Legislativos (Altera/Revoga outros Atos)</span>
                
                {/* Relações adicionadas */}
                {formRelations.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {formRelations.map((rel) => (
                      <div key={rel.id} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            rel.tipoRelacao === 'Revoga' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {rel.tipoRelacao}
                          </span>
                          <span className="font-semibold text-slate-800">{rel.atoDestino}</span>
                          {rel.detalhes && <span className="text-slate-500 italic">({rel.detalhes})</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveRelation(rel.id)}
                          className="p-1 hover:bg-slate-100 rounded text-rose-500 hover:text-rose-700 transition-all cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bloco de inserção rápida */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 pt-1.5">
                  <div>
                    <select
                      value={relTipo}
                      onChange={(e) => setRelTipo(e.target.value as any)}
                      className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    >
                      <option value="Altera">Altera</option>
                      <option value="Revoga">Revoga</option>
                      <option value="Complementa">Complementa</option>
                      <option value="Regulamenta">Regulamenta</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      placeholder="Identificador (Ex: Portaria nº 123/2024)"
                      value={relDestino}
                      onChange={(e) => setRelDestino(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 font-semibold"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Detalhes (Ex: Art. 4º)"
                      value={relDetalhes}
                      onChange={(e) => setRelDetalhes(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddRelation}
                  className="flex items-center gap-1.5 text-xs bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-[#009485] font-semibold px-3 py-1.5 rounded transition-all cursor-pointer shadow-xs ml-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Vincular Ato</span>
                </button>
              </div>

              {/* Row 7: Notas administrativas */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Notas Internas e Observações Administrativas</label>
                <textarea
                  rows={2}
                  placeholder="Anotações para uso interno de indexação da UFF (ex: 'Aprovado na 3ª sessão ordinária')"
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500 text-xs"
                ></textarea>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-150 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#0A2540] hover:bg-blue-900 text-white font-medium px-5 py-2 rounded-lg transition-all cursor-pointer shadow-sm"
                >
                  {editingAct ? 'Atualizar Dados' : 'Salvar Ato na Planilha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-150 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-[#0A2540] text-white p-5 rounded-t-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[#009485]">Importar Planilha / Banco de Dados</span>
                <h3 className="text-lg font-semibold tracking-tight mt-1">Carregar Dados de Atos</h3>
              </div>
              <button 
                onClick={() => setIsImportModalOpen(false)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm text-slate-700">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1.5 leading-relaxed">
                <p className="font-semibold text-slate-800">Como funciona o importador do portal?</p>
                <p>Você pode colar um conteúdo no formato <strong>CSV (valores separados por vírgula)</strong> ou <strong>JSON</strong> correspondente ao esquema de Atos da UFF.</p>
                <p className="text-slate-500">O cabeçalho esperado é: <code className="bg-white px-1 py-0.5 border border-slate-200 rounded">Tipo de Ato, Número, Ano, Data de Assinatura, Órgão Emissor, Ementa, Processo SEI, Status, Boletim Número...</code></p>
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={handleFillDemoImport}
                    className="text-teal-600 hover:text-teal-800 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Preencher com Exemplo Prático (CSV)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Cole aqui seus dados (CSV ou JSON)</label>
                <textarea
                  rows={8}
                  placeholder="Cole as linhas do Excel salvas como CSV ou um array JSON de atos..."
                  value={rawImportData}
                  onChange={(e) => setRawImportData(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-250 rounded p-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                ></textarea>
              </div>

              {importStatus && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg p-3 text-xs font-medium flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{importStatus}</span>
                </div>
              )}

              {/* Footer */}
              <div className="pt-4 border-t border-slate-150 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-medium px-4 py-2 rounded-lg transition-all cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleImportTextSubmit}
                  className="bg-[#0A2540] hover:bg-blue-900 text-white font-medium px-5 py-2 rounded-lg transition-all cursor-pointer shadow-sm"
                >
                  Processar e Importar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
