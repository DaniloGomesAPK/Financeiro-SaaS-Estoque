import React, { useState, useMemo } from 'react';
import { Entry, CalculatedEntry, Supplier, Employee, DocumentType, EntryStatus, IncomeEntry, PaymentType } from '../types';
import { parseBRDate, formatBRL, getTodayDateString, getTipoFavorecido, parseCurrencyInput } from '../utils/calculations';
import {
  PlusCircle,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Filter,
  ArrowUpDown,
  TrendingUp,
  ArrowDownRight,
  Building2,
  Receipt,
  FileSpreadsheet,
  CheckSquare,
  Square,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { EditEntryModal } from './EditEntryModal';
import { ConfirmModal } from './ConfirmModal';

interface EntriesViewProps {
  entries: CalculatedEntry[];
  suppliers: Supplier[];
  employees: Employee[];
  incomes: IncomeEntry[];
  onAddEntry: (newEntry: Omit<Entry, 'id'>) => void;
  onUpdateEntry: (updatedEntry: CalculatedEntry) => void;
  onDeleteEntry: (id: number) => void;
  onDeleteMultipleEntries?: (ids: number[]) => void;
  onQuickTogglePaid: (id: number) => void;
  onAddIncome: (newIncome: Omit<IncomeEntry, 'id'>) => void;
  onDeleteIncome: (id: number) => void;
}

export const EntriesView: React.FC<EntriesViewProps> = ({
  entries,
  suppliers,
  employees,
  incomes,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onDeleteMultipleEntries,
  onQuickTogglePaid,
  onAddIncome,
  onDeleteIncome,
}) => {
  // Active sub-tab inside Lançamentos: 'all' (standard layout) | 'incomes' (focus on entries/receitas)
  const [activeViewMode, setActiveViewMode] = useState<'expenses' | 'incomes'>('expenses');

  // Multi-selection state for Despesas
  const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);

  // In-App Confirm Delete states
  const [entryToDelete, setEntryToDelete] = useState<CalculatedEntry | null>(null);
  const [incomeToDelete, setIncomeToDelete] = useState<IncomeEntry | null>(null);

  // Income Entry Bar State
  const [incomeCompany, setIncomeCompany] = useState('');
  const [incomeValue, setIncomeValue] = useState('');
  const [incomeDate, setIncomeDate] = useState(getTodayDateString());
  const [formaRecebimento, setFormaRecebimento] = useState('');
  const [incomeDescription, setIncomeDescription] = useState('');
  const [incomeSearchQuery, setIncomeSearchQuery] = useState('');

  // Form State for Despesas
  const [favorecidoCategory, setFavorecidoCategory] = useState<'' | 'Fornecedor' | 'Funcionário'>('');
  const [favorecidoSelect, setFavorecidoSelect] = useState<string>('');
  const [docType, setDocType] = useState<DocumentType>('Boleto');
  const [nfNumber, setNfNumber] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [value, setValue] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [interestRate, setInterestRate] = useState('');

  // Filter & Search State for Despesas
  const [statusFilter, setStatusFilter] = useState<'Todos' | EntryStatus>('Todos');
  const [daysOverdueFilter, setDaysOverdueFilter] = useState<'todos' | '1-7' | '8-15' | '16-30' | '30+' | '60+'>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'status' | 'dueDate' | 'value' | 'favorecidoName' | 'daysOverdue'>('status');
  const [sortAsc, setSortAsc] = useState(true);

  // Mobile layout switch: 'cards' (best on iPhone) or 'table' (full horizontal table)
  const [mobileLayoutMode, setMobileLayoutMode] = useState<'cards' | 'table'>('cards');

  // Edit Modal State
  const [editingEntry, setEditingEntry] = useState<CalculatedEntry | null>(null);

  // Estado do Tipo de Lançamento quando um funcionário é selecionado
  const [employeePaymentType, setEmployeePaymentType] = useState<PaymentType | ''>('');

  // Sorted suppliers
  const sortedSuppliers = useMemo(
    () => [...suppliers].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [suppliers]
  );

  // 1. Mostrar cada funcionário apenas uma vez (sem duplicatas)
  const uniqueEmployees = useMemo(() => {
    const map = new Map<string, Employee>();
    for (const emp of employees) {
      const key = emp.name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, emp);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [employees]);

  const isEmployeeSelected = favorecidoSelect.startsWith('func-');

  const handleStatusFilterChange = (newStatus: 'Todos' | EntryStatus) => {
    setStatusFilter(newStatus);
    if (newStatus === 'Atrasado') {
      // Ao filtrar por atrasados, prioriza imediatamente quem está devendo a mais tempo (maior número de dias de atraso)
      setSortField('daysOverdue');
      setSortAsc(false);
    } else if (sortField === 'daysOverdue') {
      setSortField('status');
      setSortAsc(true);
    }
  };

  const handleCategoryChange = (cat: '' | 'Fornecedor' | 'Funcionário') => {
    setFavorecidoCategory(cat);
    setFavorecidoSelect('');
    setEmployeePaymentType('');
    if (
      docType === 'Pagamento' ||
      docType === 'Adiantamento' ||
      docType === 'Férias' ||
      docType === 'Rescisão'
    ) {
      setDocType('Boleto');
    }
  };

  const handleFavorecidoSelectChange = (val: string) => {
    setFavorecidoSelect(val);
    if (val.startsWith('func-')) {
      setEmployeePaymentType('');
      setDocType('Boleto');
    } else if (val.startsWith('forn-')) {
      if (
        docType === 'Pagamento' ||
        docType === 'Adiantamento' ||
        docType === 'Férias' ||
        docType === 'Rescisão'
      ) {
        setDocType('Boleto');
      }
    }
  };

  const handleEmployeePaymentTypeChange = (newType: PaymentType | '') => {
    setEmployeePaymentType(newType);
    if (newType) {
      // Usar essa escolha para definir automaticamente o tipo do documento do lançamento
      setDocType(newType as DocumentType);
    } else {
      setDocType('Boleto');
    }
  };

  const handleValueBlur = () => {
    if (value.trim()) {
      const parsed = parseCurrencyInput(value);
      if (parsed > 0) {
        setValue(
          parsed.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
      }
    }
  };

  const handleIncomeValueBlur = () => {
    if (incomeValue.trim()) {
      const parsed = parseCurrencyInput(incomeValue);
      if (parsed > 0) {
        setIncomeValue(
          parsed.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
      }
    }
  };

  // Submit Handler for Despesas
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!favorecidoSelect) {
      alert('Por favor, selecione um favorecido (Fornecedor ou Funcionário).');
      return;
    }
    if (isEmployeeSelected && !employeePaymentType) {
      alert('Por favor, informe o tipo de lançamento do funcionário.');
      return;
    }
    if (!dueDate) {
      alert('Por favor, informe a data de vencimento.');
      return;
    }
    const numValue = parseCurrencyInput(value);
    if (numValue <= 0) {
      alert('Por favor, informe um valor válido e maior que zero.');
      return;
    }

    const numInterest = parseCurrencyInput(interestRate) || 0;

    // Identify Favorecido details
    let favorecidoName = '';
    let favorecidoType: 'Fornecedor' | 'Funcionário' = 'Fornecedor';

    if (favorecidoSelect.startsWith('forn-')) {
      const id = parseInt(favorecidoSelect.replace('forn-', ''), 10);
      const sup = suppliers.find((s) => s.id === id || String(s.id) === favorecidoSelect.replace('forn-', ''));
      if (sup) {
        favorecidoName = sup.name;
        favorecidoType = getTipoFavorecido(sup.name, employees, favorecidoSelect);
      }
    } else if (favorecidoSelect.startsWith('func-')) {
      const cleanIdStr = favorecidoSelect.replace('func-', '').split('-')[0];
      const id = parseInt(cleanIdStr, 10);
      const emp =
        employees.find((e) => e.id === id || String(e.id) === cleanIdStr) ||
        uniqueEmployees.find((e) => e.id === id || String(e.id) === cleanIdStr);
      if (emp) {
        favorecidoName = emp.name;
        favorecidoType = getTipoFavorecido(emp.name, employees, favorecidoSelect);
      }
    } else {
      const sup = suppliers.find((s) => String(s.id) === favorecidoSelect || s.name.toLowerCase() === favorecidoSelect.toLowerCase());
      if (sup) {
        favorecidoName = sup.name;
        favorecidoType = 'Fornecedor';
      } else {
        const emp = employees.find((e) => String(e.id) === favorecidoSelect || e.name.toLowerCase() === favorecidoSelect.toLowerCase());
        if (emp) {
          favorecidoName = emp.name;
          favorecidoType = 'Funcionário';
        } else {
          favorecidoName = favorecidoSelect;
        }
      }
    }

    if (!favorecidoName || favorecidoName.trim() === '' || favorecidoName.trim().toLowerCase() === 'fornecedor') {
      favorecidoName = 'Fornecedor não informado';
    }

    onAddEntry({
      favorecidoId: favorecidoSelect,
      favorecidoName,
      favorecidoType,
      docType,
      nfNumber: nfNumber.trim(),
      dueDate,
      value: numValue,
      paymentDate: paymentDate.trim(),
      interestRate: numInterest,
    });

    // Reset Form
    setFavorecidoCategory('');
    setFavorecidoSelect('');
    setEmployeePaymentType('');
    setDocType('Boleto');
    setNfNumber('');
    setValue('');
    setPaymentDate('');
    setInterestRate('');
  };

  // Submit Handler for Entrada (Receita)
  const handleIncomeSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!incomeCompany.trim()) {
      alert('Por favor, informe o Nome da Empresa pagadora / cliente.');
      return;
    }
    const numValue = parseCurrencyInput(incomeValue);
    if (numValue <= 0) {
      alert('Por favor, informe um valor válido para a entrada.');
      return;
    }
    if (!incomeDate) {
      alert('Por favor, selecione a data da entrada.');
      return;
    }
    if (!formaRecebimento) {
      alert('Por favor, selecione a Origem do Dinheiro.');
      return;
    }

    onAddIncome({
      companyName: incomeCompany.trim(),
      value: numValue,
      date: incomeDate,
      description: incomeDescription.trim(),
      forma_recebimento: formaRecebimento,
    });

    // Reset Income Form
    setIncomeCompany('');
    setIncomeValue('');
    setIncomeDescription('');
    setFormaRecebimento('');
  };

  // Filter & Sort Entries (Despesas)
  const filteredEntries = entries.filter((e) => {
    if (statusFilter !== 'Todos' && e.status !== statusFilter) {
      return false;
    }
    if (statusFilter === 'Atrasado' && daysOverdueFilter !== 'todos') {
      if (daysOverdueFilter === '1-7' && (e.daysOverdue < 1 || e.daysOverdue > 7)) return false;
      if (daysOverdueFilter === '8-15' && (e.daysOverdue < 8 || e.daysOverdue > 15)) return false;
      if (daysOverdueFilter === '16-30' && (e.daysOverdue < 16 || e.daysOverdue > 30)) return false;
      if (daysOverdueFilter === '30+' && e.daysOverdue <= 30) return false;
      if (daysOverdueFilter === '60+' && e.daysOverdue <= 60) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = e.favorecidoName.toLowerCase().includes(q);
      const matchNf = e.nfNumber ? e.nfNumber.toLowerCase().includes(q) : false;
      const matchDoc = e.docType.toLowerCase().includes(q);
      return matchName || matchNf || matchDoc;
    }
    return true;
  });

  // Default Order by Status: Atrasado -> À Vencer -> Pago
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (sortField === 'daysOverdue') {
      return sortAsc ? a.daysOverdue - b.daysOverdue : b.daysOverdue - a.daysOverdue;
    } else if (sortField === 'status') {
      const orderMap: Record<EntryStatus, number> = {
        Atrasado: 1,
        'À Vencer': 2,
        Pago: 3,
      };
      const orderA = orderMap[a.status];
      const orderB = orderMap[b.status];
      return sortAsc ? orderA - orderB : orderB - orderA;
    } else if (sortField === 'dueDate') {
      return sortAsc
        ? a.dueDate.localeCompare(b.dueDate)
        : b.dueDate.localeCompare(a.dueDate);
    } else if (sortField === 'value') {
      return sortAsc ? a.totalWithInterest - b.totalWithInterest : b.totalWithInterest - a.totalWithInterest;
    } else if (sortField === 'favorecidoName') {
      return sortAsc
        ? a.favorecidoName.localeCompare(b.favorecidoName)
        : b.favorecidoName.localeCompare(a.favorecidoName);
    }
    return 0;
  });

  const handleHeaderSort = (field: 'status' | 'dueDate' | 'value' | 'favorecidoName' | 'daysOverdue') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      // Ao clicar para ordenar por Dias de Atraso, defaulta para decrescente (maior atraso primeiro)
      setSortAsc(field === 'daysOverdue' ? false : true);
    }
  };

  // Selection helpers
  const handleToggleSelectAll = () => {
    if (selectedEntryIds.length === sortedEntries.length && sortedEntries.length > 0) {
      setSelectedEntryIds([]);
    } else {
      setSelectedEntryIds(sortedEntries.map((e) => e.id));
    }
  };

  const handleToggleSelectEntry = (id: number) => {
    setSelectedEntryIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleExecuteBatchDelete = () => {
    if (selectedEntryIds.length === 0) return;
    if (onDeleteMultipleEntries) {
      onDeleteMultipleEntries(selectedEntryIds);
    } else {
      selectedEntryIds.forEach((id) => onDeleteEntry(id));
    }
    setSelectedEntryIds([]);
    setIsBatchDeleteModalOpen(false);
  };

  const handleBatchTogglePaid = () => {
    selectedEntryIds.forEach((id) => onQuickTogglePaid(id));
    setSelectedEntryIds([]);
  };

  const selectedEntriesSum = entries
    .filter((e) => selectedEntryIds.includes(e.id))
    .reduce((sum, e) => sum + e.totalWithInterest, 0);

  // Filter & Sort Incomes (Receitas)
  const filteredIncomes = incomes.filter((inc) => {
    if (!incomeSearchQuery.trim()) return true;
    const q = incomeSearchQuery.toLowerCase();
    return (
      inc.companyName.toLowerCase().includes(q) ||
      (inc.description && inc.description.toLowerCase().includes(q)) ||
      (inc.forma_recebimento && inc.forma_recebimento.toLowerCase().includes(q))
    );
  });

  const totalIncomesValue = incomes.reduce((sum, inc) => sum + inc.value, 0);

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* 1. BARRA DE LANÇAMENTO DE ENTRADA (RECEITA / RECEBIMENTO) */}
      {/* ========================================================================= */}
      <div className="bg-emerald-50/90 dark:bg-emerald-950/40 border-2 border-emerald-500/40 dark:border-emerald-700/60 rounded-xl shadow-2xs p-3.5 sm:p-4 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 mb-3 border-b border-emerald-200/80 dark:border-emerald-800/80">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-2xs">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                Barra de Lançamento de Entrada (Receitas)
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">
                  {incomes.length} registradas
                </span>
              </h2>
              <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                Informe o Nome da Empresa, Valor e Data para lançar receitas com reflexo imediato no Dashboard.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
              Total Entradas:{' '}
              <span className="font-mono text-emerald-700 dark:text-emerald-300 font-extrabold">
                {formatBRL(totalIncomesValue)}
              </span>
            </span>
          </div>
        </div>

        {/* Input Bar Form */}
        <form onSubmit={handleIncomeSubmit} className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5 text-xs">
            {/* Nome da Empresa */}
            <div className="sm:col-span-2 md:col-span-3">
              <label className="block text-[11px] font-bold text-emerald-950 dark:text-emerald-200 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Nome da Empresa <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={incomeCompany}
                onChange={(e) => setIncomeCompany(e.target.value)}
                placeholder="Ex: Construtora Alvorada Ltda, Cliente ABC..."
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-md text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none h-8 shadow-2xs"
                required
              />
            </div>

            {/* Valor da Entrada */}
            <div className="sm:col-span-1 md:col-span-2">
              <label className="block text-[11px] font-bold text-emerald-950 dark:text-emerald-200 mb-1 flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Valor da Entrada (R$) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={incomeValue}
                onChange={(e) => setIncomeValue(e.target.value)}
                onBlur={handleIncomeValueBlur}
                placeholder="0,00"
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-md text-xs font-bold font-mono text-emerald-700 dark:text-emerald-300 placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none h-8 shadow-2xs"
                required
              />
            </div>

            {/* Data da Entrada */}
            <div className="sm:col-span-1 md:col-span-2">
              <label className="block text-[11px] font-bold text-emerald-950 dark:text-emerald-200 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Data da Entrada <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={incomeDate}
                onChange={(e) => setIncomeDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-md text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none h-8 shadow-2xs font-mono"
                required
              />
            </div>

            {/* Origem do Dinheiro */}
            <div className="sm:col-span-1 md:col-span-2">
              <label
                htmlFor="forma_recebimento"
                className="block text-[11px] font-bold text-emerald-950 dark:text-emerald-200 mb-1 flex items-center gap-1"
              >
                <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Origem do Dinheiro <span className="text-rose-500">*</span>
              </label>
              <select
                id="forma_recebimento"
                name="forma_recebimento"
                value={formaRecebimento}
                onChange={(e) => setFormaRecebimento(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-md text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none h-8 shadow-2xs cursor-pointer"
                required
              >
                <option value="">Selecione...</option>
                <option value="PIX">PIX</option>
                <option value="Dinheiro">Dinheiro</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Transferência Bancária">Transferência Bancária</option>
                <option value="Boleto">Boleto</option>
                <option value="Cheque">Cheque</option>
                <option value="Outros">Outros</option>
              </select>
            </div>

            {/* Descrição / Obs (Opcional) */}
            <div className="sm:col-span-1 md:col-span-3">
              <label className="block text-[11px] font-bold text-emerald-950 dark:text-emerald-200 mb-1">
                Descrição / Ref. (Opcional)
              </label>
              <input
                type="text"
                value={incomeDescription}
                onChange={(e) => setIncomeDescription(e.target.value)}
                placeholder="Ex: Faturamento NF 450, Medição..."
                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-md text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none h-8 shadow-2xs"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-md text-xs font-extrabold shadow-sm transition-all cursor-pointer hover:shadow-md"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Lançar Entrada</span>
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* SUB-NAVEGAÇÃO: DESPESAS vs ENTRADAS REGISTRADAS */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveViewMode('expenses')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            activeViewMode === 'expenses'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>Financeiro / Despesas</span>
          <span
            className={`px-1.5 py-0.25 rounded-full text-[10px] font-mono ${
              activeViewMode === 'expenses'
                ? 'bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900'
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            {entries.length}
          </span>
        </button>

        <button
          onClick={() => setActiveViewMode('incomes')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            activeViewMode === 'incomes'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span>Entradas / Receitas Registradas</span>
          <span
            className={`px-1.5 py-0.25 rounded-full text-[10px] font-mono ${
              activeViewMode === 'incomes'
                ? 'bg-emerald-800 text-white'
                : 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100'
            }`}
          >
            {incomes.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ABA 2: LISTA DE ENTRADAS REGISTRADAS */}
      {/* ========================================================================= */}
      {activeViewMode === 'incomes' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xs overflow-hidden">
          {/* Header Controls for Incomes */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-800/40">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Histórico de Entradas Cadastradas ({filteredIncomes.length})
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Lançamentos de receita computados nos gráficos e relatórios consolidados do Dashboard.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={incomeSearchQuery}
                  onChange={(e) => setIncomeSearchQuery(e.target.value)}
                  placeholder="Buscar empresa ou descrição..."
                  className="w-full pl-8 pr-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none h-7.5"
                />
              </div>
            </div>
          </div>

          {/* Mobile Incomes Card List */}
          <div className="sm:hidden divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {filteredIncomes.length === 0 ? (
              <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-xs px-4">
                Nenhuma entrada cadastrada ou encontrada na busca.
              </div>
            ) : (
              filteredIncomes.map((inc) => (
                <div key={`inc-card-${inc.id}`} className="p-3 space-y-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                        {inc.companyName}
                      </span>
                    </div>
                    <span className="font-mono font-extrabold text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
                      {formatBRL(inc.value)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[10px]">#{inc.id} &bull; {parseBRDate(inc.date)}</span>
                      {inc.forma_recebimento && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60">
                          {inc.forma_recebimento}
                        </span>
                      )}
                    </div>
                    <button
                      id={`btn-delete-income-m-${inc.id}`}
                      onClick={() => setIncomeToDelete(inc)}
                      className="p-1.5 rounded text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                      title="Excluir Entrada"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {inc.description && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">
                      {inc.description}
                    </p>
                  )}
                </div>
              ))
            )}
            {filteredIncomes.length > 0 && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border-t border-emerald-200 dark:border-emerald-800 flex items-center justify-between font-bold text-xs">
                <span className="text-emerald-950 dark:text-emerald-200 uppercase tracking-wider text-[10px]">
                  Total Recebido:
                </span>
                <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-300 text-sm">
                  {formatBRL(filteredIncomes.reduce((acc, i) => acc + i.value, 0))}
                </span>
              </div>
            )}
          </div>

          {/* Incomes Table (Desktop & Tablet) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 text-[11px]">
                  <th className="py-2 px-3 w-10 text-center font-mono">ID</th>
                  <th className="py-2 px-3">Nome da Empresa / Cliente</th>
                  <th className="py-2 px-3">Data do Recebimento</th>
                  <th className="py-2 px-3">Origem do Dinheiro</th>
                  <th className="py-2 px-3">Descrição / Detalhes</th>
                  <th className="py-2 px-3 text-right font-mono">Valor Recebido</th>
                  <th className="py-2 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800 text-[11px] tabular-nums font-mono">
                {filteredIncomes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400 font-sans">
                      Nenhuma entrada cadastrada ou encontrada na busca.
                    </td>
                  </tr>
                ) : (
                  filteredIncomes.map((inc) => (
                    <tr
                      key={inc.id}
                      className="hover:bg-slate-100/60 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-2 px-3 text-center text-slate-500 font-mono text-[10px]">
                        #{inc.id}
                      </td>
                      <td className="py-2 px-3 font-sans font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>{inc.companyName}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-800 dark:text-slate-200">
                        {parseBRDate(inc.date)}
                      </td>
                      <td className="py-2 px-3 font-sans">
                        {inc.forma_recebimento ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60">
                            {inc.forma_recebimento}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[10px]">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-600 dark:text-slate-400">
                        {inc.description || '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                        {formatBRL(inc.value)}
                      </td>
                      <td className="py-2 px-3 text-center font-sans">
                        <button
                          id={`btn-delete-income-${inc.id}`}
                          onClick={() => setIncomeToDelete(inc)}
                          className="p-1 rounded text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors cursor-pointer"
                          title="Excluir Entrada"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredIncomes.length > 0 && (
                <tfoot>
                  <tr className="bg-emerald-50/50 dark:bg-emerald-950/30 font-bold border-t border-emerald-200 dark:border-emerald-800 text-xs">
                    <td colSpan={5} className="py-2.5 px-3 text-right text-emerald-950 dark:text-emerald-200 font-sans uppercase tracking-wider">
                      Total de Entradas Selecionadas:
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-700 dark:text-emerald-300">
                      {formatBRL(filteredIncomes.reduce((acc, i) => acc + i.value, 0))}
                    </td>
                    <td className="py-2.5 px-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 1: FORMULÁRIO E TABELA DE DESPESAS */}
      {/* ========================================================================= */}
      {activeViewMode === 'expenses' && (
        <>
          {/* 1. Form Section (High Density) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xs p-3 sm:p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5 mb-3 pb-2 border-b border-slate-200 dark:border-slate-800">
              <PlusCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Novo Lançamento de Despesa
            </h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-2.5 text-xs">
                {/* 1. Tipo do Favorecido */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                    Favorecido <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={favorecidoCategory}
                    onChange={(e) => handleCategoryChange(e.target.value as '' | 'Fornecedor' | 'Funcionário')}
                    className="w-full px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none h-7.5 font-medium"
                    required
                  >
                    <option value="">-- Selecione --</option>
                    <option value="Fornecedor">Fornecedor</option>
                    <option value="Funcionário">Funcionário</option>
                  </select>
                </div>

                {/* 2. Seleção de Fornecedor */}
                {favorecidoCategory === 'Fornecedor' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                      Fornecedor <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={favorecidoSelect}
                      onChange={(e) => handleFavorecidoSelectChange(e.target.value)}
                      className="w-full px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none h-7.5"
                      required
                    >
                      <option value="">-- Selecione o Fornecedor --</option>
                      {sortedSuppliers.map((supplier) => (
                        <option key={`forn-${supplier.id}`} value={`forn-${supplier.id}`}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 2. Seleção de Funcionário */}
                {favorecidoCategory === 'Funcionário' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                      Funcionário <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={favorecidoSelect}
                      onChange={(e) => handleFavorecidoSelectChange(e.target.value)}
                      className="w-full px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none h-7.5"
                      required
                    >
                      <option value="">-- Selecione o Funcionário --</option>
                      {uniqueEmployees.map((employee) => (
                        <option key={`func-${employee.id}`} value={`func-${employee.id}`}>
                          {employee.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 3. Ao selecionar o funcionário, abrir uma segunda opção: Tipo de lançamento */}
                {isEmployeeSelected && (
                  <div>
                    <label className="block text-[11px] font-semibold text-blue-700 dark:text-blue-400 mb-0.5">
                      Tipo de lançamento <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={employeePaymentType}
                      onChange={(e) => handleEmployeePaymentTypeChange(e.target.value as PaymentType | '')}
                      className="w-full px-2.5 py-1 bg-white dark:bg-slate-800 border-2 border-blue-500 dark:border-blue-500 rounded text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none h-7.5 font-medium"
                      required
                    >
                      <option value="">-- Selecione o tipo --</option>
                      <option value="Pagamento">Pagamento</option>
                      <option value="Adiantamento">Adiantamento</option>
                      <option value="Férias">Férias</option>
                      <option value="Rescisão">Rescisão</option>
                    </select>
                  </div>
                )}

                {/* Tipo Documento */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5 flex items-center justify-between">
                    <span>Tipo Documento</span>
                    {isEmployeeSelected && (
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-normal">(Automático)</span>
                    )}
                  </label>
                  <select
                    value={docType}
                    disabled={isEmployeeSelected}
                    onChange={(e) => setDocType(e.target.value as DocumentType)}
                    className={`w-full px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none h-7.5 ${
                      isEmployeeSelected
                        ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 cursor-not-allowed'
                        : ''
                    }`}
                  >
                    <option value="Boleto">Boleto</option>
                    <option value="Nota Fiscal">Nota Fiscal</option>
                    <option value="Adiantamento">Adiantamento</option>
                    <option value="Pagamento">Pagamento</option>
                    <option value="Férias">Férias</option>
                    <option value="Rescisão">Rescisão</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                {/* Número NF */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                    Número NF (opcional)
                  </label>
                  <input
                    type="text"
                    value={nfNumber}
                    onChange={(e) => setNfNumber(e.target.value)}
                    placeholder="Ex: 1001"
                    className="w-full px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none h-7.5 font-mono"
                  />
                </div>

                {/* Data Vencimento */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                    Data Vencimento <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none h-7.5 font-mono"
                    required
                  />
                </div>

                {/* Valor */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                    Valor (R$) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onBlur={handleValueBlur}
                    placeholder="Ex: 1.950,00 ou 1950"
                    className="w-full px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none h-7.5 font-mono"
                    required
                  />
                </div>

                {/* Data Pagamento */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                    Data Pagamento (opcional)
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none h-7.5 font-mono"
                  />
                </div>

                {/* Taxa de Juros (%) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                    Taxa Juros (%) Mensal
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none h-7.5 font-mono"
                  />
                </div>

                {/* Submit Button */}
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded shadow-2xs transition-all h-7.5"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Adicionar Lançamento</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* 2. Table Section (High Density) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xs overflow-hidden">
        {/* Table Filters Header */}
        <div className="p-2.5 sm:p-3 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-1 uppercase tracking-wider">
              <Filter className="w-3 h-3" />
              Status:
            </span>

            <button
              type="button"
              onClick={() => handleStatusFilterChange('Todos')}
              className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'Todos'
                  ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                  : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
              }`}
            >
              Todos ({entries.length})
            </button>

            <button
              type="button"
              onClick={() => handleStatusFilterChange('Atrasado')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'Atrasado'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 hover:bg-rose-200'
              }`}
            >
              <AlertCircle className="w-3 h-3" />
              Atrasado ({entries.filter((e) => e.status === 'Atrasado').length})
            </button>

            <button
              type="button"
              onClick={() => handleStatusFilterChange('À Vencer')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'À Vencer'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 hover:bg-blue-200'
              }`}
            >
              <Clock className="w-3 h-3" />
              À Vencer ({entries.filter((e) => e.status === 'À Vencer').length})
            </button>

            <button
              type="button"
              onClick={() => handleStatusFilterChange('Pago')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'Pago'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              Pago ({entries.filter((e) => e.status === 'Pago').length})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-56">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar favorecido ou NF..."
              className="w-full pl-7 pr-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none h-7"
            />
          </div>
        </div>

        {/* Overdue Specific Range Filter & Sort Controls */}
        {statusFilter === 'Atrasado' && (
          <div className="px-2.5 sm:px-3 py-2 bg-rose-50/90 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                Filtrar por Dias de Atraso:
              </span>

              <button
                type="button"
                onClick={() => setDaysOverdueFilter('todos')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  daysOverdueFilter === 'todos'
                    ? 'bg-rose-700 text-white shadow-2xs'
                    : 'bg-rose-200/70 dark:bg-rose-900/40 text-rose-900 dark:text-rose-200 hover:bg-rose-200'
                }`}
              >
                Todos ({entries.filter((e) => e.status === 'Atrasado').length})
              </button>

              <button
                type="button"
                onClick={() => setDaysOverdueFilter('1-7')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  daysOverdueFilter === '1-7'
                    ? 'bg-rose-700 text-white shadow-2xs'
                    : 'bg-rose-200/70 dark:bg-rose-900/40 text-rose-900 dark:text-rose-200 hover:bg-rose-200'
                }`}
              >
                1 a 7 dias ({entries.filter((e) => e.status === 'Atrasado' && e.daysOverdue >= 1 && e.daysOverdue <= 7).length})
              </button>

              <button
                type="button"
                onClick={() => setDaysOverdueFilter('8-15')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  daysOverdueFilter === '8-15'
                    ? 'bg-rose-700 text-white shadow-2xs'
                    : 'bg-rose-200/70 dark:bg-rose-900/40 text-rose-900 dark:text-rose-200 hover:bg-rose-200'
                }`}
              >
                8 a 15 dias ({entries.filter((e) => e.status === 'Atrasado' && e.daysOverdue >= 8 && e.daysOverdue <= 15).length})
              </button>

              <button
                type="button"
                onClick={() => setDaysOverdueFilter('16-30')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                  daysOverdueFilter === '16-30'
                    ? 'bg-rose-700 text-white shadow-2xs'
                    : 'bg-rose-200/70 dark:bg-rose-900/40 text-rose-900 dark:text-rose-200 hover:bg-rose-200'
                }`}
              >
                16 a 30 dias ({entries.filter((e) => e.status === 'Atrasado' && e.daysOverdue >= 16 && e.daysOverdue <= 30).length})
              </button>

              <button
                type="button"
                onClick={() => setDaysOverdueFilter('30+')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  daysOverdueFilter === '30+'
                    ? 'bg-rose-800 text-white shadow-2xs ring-1 ring-rose-400'
                    : 'bg-rose-200 dark:bg-rose-900/60 text-rose-950 dark:text-rose-100 hover:bg-rose-300'
                }`}
              >
                +30 dias ({entries.filter((e) => e.status === 'Atrasado' && e.daysOverdue > 30).length})
              </button>

              <button
                type="button"
                onClick={() => setDaysOverdueFilter('60+')}
                className={`px-2 py-0.5 rounded text-[11px] font-extrabold transition-all cursor-pointer ${
                  daysOverdueFilter === '60+'
                    ? 'bg-red-900 text-white shadow-2xs ring-1 ring-red-400'
                    : 'bg-red-200/90 dark:bg-red-950/80 text-red-950 dark:text-red-200 hover:bg-red-300'
                }`}
              >
                +60 dias ({entries.filter((e) => e.status === 'Atrasado' && e.daysOverdue > 60).length})
              </button>
            </div>

            {/* Quick Sort Direction for Overdue */}
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-900 dark:text-rose-200">
              <span>Ordenação:</span>
              <button
                type="button"
                onClick={() => {
                  if (sortField === 'daysOverdue') {
                    setSortAsc(!sortAsc);
                  } else {
                    setSortField('daysOverdue');
                    setSortAsc(false);
                  }
                }}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded font-bold hover:bg-rose-50 dark:hover:bg-slate-800 text-rose-700 dark:text-rose-300 cursor-pointer transition-colors shadow-2xs"
                title="Clique para alternar a ordem do atraso"
              >
                <ArrowUpDown className="w-3 h-3 text-rose-500" />
                <span>
                  {sortField === 'daysOverdue'
                    ? sortAsc
                      ? 'Menor atraso primeiro'
                      : 'Maior atraso primeiro (Mais antigo)'
                    : 'Ordenar por Dias de Atraso'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Batch Selection Action Bar */}
        {selectedEntryIds.length > 0 && (
          <div
            id="batch-selection-toolbar"
            className="p-2.5 bg-blue-50/95 dark:bg-slate-800 border-2 border-blue-400 dark:border-blue-600 rounded-lg flex flex-wrap items-center justify-between gap-2.5 shadow-sm transition-all"
          >
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-blue-600 text-white shadow-2xs">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-blue-950 dark:text-blue-200">
                  {selectedEntryIds.length} {selectedEntryIds.length === 1 ? 'lançamento selecionado' : 'lançamentos selecionados'}
                </span>
                <span className="text-[11px] text-blue-700 dark:text-blue-300 ml-2 font-mono font-bold">
                  (Total: {formatBRL(selectedEntriesSum)})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-batch-pay"
                type="button"
                onClick={handleBatchTogglePaid}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                title="Alternar status de pagamento dos itens selecionados"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Marcar/Alternar Pagamento</span>
              </button>

              <button
                id="btn-batch-delete"
                type="button"
                onClick={() => setIsBatchDeleteModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded text-xs font-extrabold shadow-2xs transition-colors cursor-pointer"
                title="Excluir todos os lançamentos selecionados"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Selecionados ({selectedEntryIds.length})</span>
              </button>

              <button
                id="btn-clear-selection"
                type="button"
                onClick={() => setSelectedEntryIds([])}
                className="px-2.5 py-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-xs font-medium transition-colors cursor-pointer"
              >
                Limpar
              </button>
            </div>
          </div>
        )}

        {/* Mobile View Toggle Switch (Cards vs Table) & Swipe Hint */}
        <div className="sm:hidden flex items-center justify-between px-3 py-2 bg-slate-100/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Modo:</span>
            <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 p-0.5 bg-white dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setMobileLayoutMode('cards')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  mobileLayoutMode === 'cards'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                📱 Cards
              </button>
              <button
                type="button"
                onClick={() => setMobileLayoutMode('table')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                  mobileLayoutMode === 'table'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                📊 Tabela
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            {sortedEntries.length} itens
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MOBILE CARDS VIEW (Clean, dense iOS layout) */}
        {/* ========================================================================= */}
        {mobileLayoutMode === 'cards' && (
          <div className="sm:hidden divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {sortedEntries.length === 0 ? (
              <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-xs px-4">
                Nenhum lançamento encontrado para os filtros selecionados.
              </div>
            ) : (
              sortedEntries.map((entry) => {
                const isSelected = selectedEntryIds.includes(entry.id);
                const isSupplier = entry.favorecidoType === 'Fornecedor';

                return (
                  <div
                    key={`card-${entry.id}`}
                    className={`p-3 space-y-2 transition-colors ${
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 border-l-4 border-l-blue-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Card Header: Checkbox + Favorecido + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectEntry(entry.id)}
                          className="w-4 h-4 mt-0.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {entry.favorecidoName}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.25 rounded font-semibold shrink-0 ${
                                isSupplier
                                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                              }`}
                            >
                              {isSupplier ? 'Fornecedor' : 'Funcionário'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            #{entry.id} &bull; {entry.docType} {entry.nfNumber ? `NF: ${entry.nfNumber}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                          entry.status === 'Pago'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : entry.status === 'Atrasado'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                        }`}
                      >
                        {entry.status === 'Pago' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {entry.status === 'Atrasado' && <AlertCircle className="w-3 h-3 text-rose-600" />}
                        {entry.status === 'À Vencer' && <Clock className="w-3 h-3 text-blue-600" />}
                        {entry.status}
                        {entry.daysOverdue > 0 && ` (${entry.daysOverdue}d)`}
                      </span>
                    </div>

                    {/* Dates and Financial Grid */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-md text-[11px] border border-slate-200/60 dark:border-slate-700/60">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Vencimento:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                          {parseBRDate(entry.dueDate)}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Pagamento:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                          {entry.paymentDate ? parseBRDate(entry.paymentDate) : '-'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block text-[10px]">Valor Original:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                          {formatBRL(entry.value)}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 dark:text-slate-400 block text-[10px]">
                          Total {entry.interestValue > 0 ? '(c/ Juros):' : ':'}
                        </span>
                        <span className="font-extrabold text-slate-950 dark:text-white font-mono text-xs text-blue-700 dark:text-blue-300">
                          {formatBRL(entry.totalWithInterest)}
                        </span>
                      </div>
                    </div>

                    {/* Card Actions Bar (Large 44px tap area) */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => onQuickTogglePaid(entry.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all min-h-[38px] cursor-pointer ${
                          entry.status === 'Pago'
                            ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                            : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <CheckCircle2 className={`w-4 h-4 ${entry.status === 'Pago' ? 'text-emerald-600' : 'text-slate-400'}`} />
                        <span>{entry.status === 'Pago' ? 'Pago (Desmarcar)' : 'Marcar como Pago'}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingEntry(entry)}
                          className="flex items-center justify-center p-2 rounded-md text-blue-600 hover:text-blue-800 bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 border border-blue-200 dark:border-blue-900 min-h-[38px] min-w-[38px] cursor-pointer transition-colors"
                          title="Editar Lançamento"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setEntryToDelete(entry)}
                          className="flex items-center justify-center p-2 rounded-md text-rose-600 hover:text-rose-800 bg-rose-50 dark:bg-rose-950/80 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 min-h-[38px] min-w-[38px] cursor-pointer transition-colors"
                          title="Excluir Lançamento"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* DESKTOP & MOBILE TABLE VIEW (with smooth horizontal panning) */}
        {/* ========================================================================= */}
        <div className={`${mobileLayoutMode === 'table' ? 'block' : 'hidden sm:block'} overflow-x-auto`}>
          {/* Mobile swipe helper */}
          <div className="sm:hidden px-3 py-1.5 bg-blue-50/80 dark:bg-blue-950/50 border-b border-blue-200 dark:border-blue-900 text-[11px] text-blue-800 dark:text-blue-300 flex items-center gap-1.5 font-medium">
            <span>👉 Deslize para os lados para visualizar todas as 15 colunas da planilha.</span>
          </div>

          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 select-none text-[11px]">
                <th className="py-2 px-2 w-8 text-center">
                  <input
                    id="checkbox-select-all"
                    type="checkbox"
                    checked={sortedEntries.length > 0 && selectedEntryIds.length === sortedEntries.length}
                    onChange={handleToggleSelectAll}
                    title="Selecionar / Desmarcar todos os visíveis"
                    className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-2 px-2 w-8 text-center font-mono">ID</th>
                <th
                  onClick={() => handleHeaderSort('favorecidoName')}
                  className="py-2 px-2.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
                >
                  <div className="flex items-center gap-1">
                    <span>Favorecido</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2 px-2">Tipo Doc</th>
                <th className="py-2 px-2 font-mono">NF</th>
                <th
                  onClick={() => handleHeaderSort('dueDate')}
                  className="py-2 px-2.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
                >
                  <div className="flex items-center gap-1">
                    <span>Vencimento</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2 px-2.5 text-right font-mono">Valor</th>
                <th className="py-2 px-2">Data Pagto</th>
                <th
                  onClick={() => handleHeaderSort('status')}
                  className="py-2 px-2.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60"
                >
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2 px-2 text-center">Juros %</th>
                <th
                  onClick={() => handleHeaderSort('daysOverdue')}
                  className={`py-2 px-2 text-center cursor-pointer transition-colors ${
                    sortField === 'daysOverdue'
                      ? 'bg-rose-100/80 dark:bg-rose-950/60 text-rose-900 dark:text-rose-300 font-extrabold'
                      : 'hover:bg-slate-200/60 dark:hover:bg-slate-700/60'
                  }`}
                  title="Clique para ordenar por dias de atraso"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Dias Atraso</span>
                    <ArrowUpDown className={`w-3 h-3 ${sortField === 'daysOverdue' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
                  </div>
                </th>
                <th className="py-2 px-2.5 text-right font-mono">Juros (R$)</th>
                <th
                  onClick={() => handleHeaderSort('value')}
                  className="py-2 px-2.5 text-right cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 font-extrabold font-mono"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Total c/ Juros</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-2 px-2 text-center">Mês/Ano</th>
                <th className="py-2 px-2.5 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800 text-[11px] tabular-nums font-mono">
              {sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={15} className="py-8 text-center text-slate-500 dark:text-slate-400 font-sans">
                    Nenhum lançamento encontrado.
                  </td>
                </tr>
              ) : (
                sortedEntries.map((entry) => {
                  let statusBadgeClass = '';
                  let statusText = entry.status;
                  const isSelected = selectedEntryIds.includes(entry.id);

                  if (entry.status === 'Pago') {
                    statusBadgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800';
                  } else if (entry.status === 'Atrasado') {
                    statusBadgeClass = 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800';
                  } else {
                    statusBadgeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-300 dark:border-blue-800';
                  }

                  return (
                    <tr
                      key={entry.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-blue-50/80 dark:bg-blue-950/50'
                          : 'hover:bg-slate-100/60 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-1.5 px-2 text-center">
                        <input
                          id={`checkbox-entry-${entry.id}`}
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectEntry(entry.id)}
                          className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* ID */}
                      <td className="py-1.5 px-2 text-center text-slate-500 font-mono text-[10px]">
                        #{entry.id}
                      </td>

                      {/* Favorecido */}
                      <td className="py-1.5 px-2.5 font-sans font-medium text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex flex-col">
                          <span>{entry.favorecidoName}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {getTipoFavorecido(entry.favorecidoName, employees, entry.favorecidoId)}
                          </span>
                        </div>
                      </td>

                      {/* Tipo Doc */}
                      <td className="py-1.5 px-2 font-sans text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {entry.docType}
                      </td>

                      {/* NF */}
                      <td className="py-1.5 px-2 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {entry.nfNumber || '-'}
                      </td>

                      {/* Vencimento */}
                      <td className="py-1.5 px-2.5 text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {parseBRDate(entry.dueDate)}
                      </td>

                      {/* Valor Base */}
                      <td className="py-1.5 px-2.5 text-right font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatBRL(entry.value)}
                      </td>

                      {/* Data Pagto */}
                      <td className="py-1.5 px-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {entry.paymentDate ? parseBRDate(entry.paymentDate) : '-'}
                      </td>

                      {/* Status Badge */}
                      <td className="py-1.5 px-2.5 font-sans">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.25 rounded text-[10px] font-bold ${statusBadgeClass}`}
                        >
                          {entry.status === 'Pago' && <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                          {entry.status === 'Atrasado' && <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />}
                          {entry.status === 'À Vencer' && <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />}
                          {statusText}
                        </span>
                      </td>

                      {/* Taxa Juros */}
                      <td className="py-1.5 px-2 text-center text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {entry.interestRate > 0 ? `${entry.interestRate}%` : '-'}
                      </td>

                      {/* Dias Atrasados */}
                      <td className="py-1.5 px-2 text-center whitespace-nowrap">
                        {entry.daysOverdue > 0 ? (
                          <span
                            className={`inline-flex items-center justify-center px-1.5 py-0.25 rounded text-[10px] font-bold ${
                              entry.daysOverdue > 30
                                ? 'bg-rose-600 text-white font-extrabold shadow-2xs'
                                : entry.daysOverdue > 15
                                ? 'bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200 font-bold'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-semibold'
                            }`}
                            title={`Atrasado há ${entry.daysOverdue} dias (Venceu em ${parseBRDate(entry.dueDate)})`}
                          >
                            {entry.daysOverdue}d
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">0</span>
                        )}
                      </td>

                      {/* Juros (R$) */}
                      <td className="py-1.5 px-2.5 text-right text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {entry.interestValue > 0 ? formatBRL(entry.interestValue) : 'R$ 0,00'}
                      </td>

                      {/* Total com Juros */}
                      <td className="py-1.5 px-2.5 text-right font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatBRL(entry.totalWithInterest)}
                      </td>

                      {/* Mês/Ano */}
                      <td className="py-1.5 px-2 text-center font-sans text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {entry.monthYear}
                      </td>

                      {/* Ações */}
                      <td className="py-1.5 px-2.5 text-center font-sans whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* Quick Paid Toggle Button */}
                          <button
                            id={`btn-toggle-paid-${entry.id}`}
                            onClick={() => onQuickTogglePaid(entry.id)}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              entry.status === 'Pago'
                                ? 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            title={entry.status === 'Pago' ? 'Desmarcar Pagamento' : 'Marcar como Pago Hoje'}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Button */}
                          <button
                            id={`btn-edit-entry-${entry.id}`}
                            onClick={() => setEditingEntry(entry)}
                            className="p-1 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors cursor-pointer"
                            title="Editar Lançamento"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            id={`btn-delete-entry-${entry.id}`}
                            onClick={() => setEntryToDelete(entry)}
                            className="p-1 rounded text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors cursor-pointer"
                            title="Excluir Lançamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
    </>
  )}

      {/* Edit Entry Modal */}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          suppliers={suppliers}
          employees={employees}
          onClose={() => setEditingEntry(null)}
          onSave={(updated) => {
            onUpdateEntry(updated);
            setEditingEntry(null);
          }}
          onDelete={(id) => {
            onDeleteEntry(id);
            setEditingEntry(null);
          }}
        />
      )}

      {/* Single Entry Deletion Confirmation Modal */}
      {entryToDelete && (
        <ConfirmModal
          isOpen={Boolean(entryToDelete)}
          title="Excluir Lançamento"
          description={`Tem certeza que deseja excluir permanentemente o lançamento #${entryToDelete.id}? Esta ação não pode ser desfeita.`}
          confirmLabel="Sim, Excluir Lançamento"
          cancelLabel="Cancelar"
          variant="danger"
          onClose={() => setEntryToDelete(null)}
          onConfirm={() => {
            onDeleteEntry(entryToDelete.id);
            // Also remove from selection if present
            setSelectedEntryIds((prev) => prev.filter((id) => id !== entryToDelete.id));
            setEntryToDelete(null);
          }}
        >
          <div className="bg-slate-50 dark:bg-slate-800/80 rounded-lg p-3 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
              <span className="text-slate-500 dark:text-slate-400">Favorecido:</span>
              <span className="font-bold text-slate-900 dark:text-white">{entryToDelete.favorecidoName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
              <span className="text-slate-500 dark:text-slate-400">Documento / NF:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {entryToDelete.docType} {entryToDelete.nfNumber ? `(NF: ${entryToDelete.nfNumber})` : ''}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
              <span className="text-slate-500 dark:text-slate-400">Vencimento:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{parseBRDate(entryToDelete.dueDate)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
              <span className="text-slate-500 dark:text-slate-400">Status:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{entryToDelete.status}</span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span className="text-slate-500 dark:text-slate-400">Valor Total c/ Juros:</span>
              <span className="font-mono font-extrabold text-rose-600 dark:text-rose-400 text-sm">
                {formatBRL(entryToDelete.totalWithInterest)}
              </span>
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* Batch Entries Deletion Confirmation Modal */}
      {isBatchDeleteModalOpen && (
        <ConfirmModal
          isOpen={isBatchDeleteModalOpen}
          title={`Excluir ${selectedEntryIds.length} Lançamentos`}
          description={`Atenção: Você está prestes a excluir ${selectedEntryIds.length} lançamentos selecionados simultaneamente. Esta operação removerá permanentemente os registros e atualizará todos os totais e gráficos do sistema.`}
          confirmLabel={`Excluir ${selectedEntryIds.length} Lançamentos`}
          cancelLabel="Cancelar"
          variant="danger"
          onClose={() => setIsBatchDeleteModalOpen(false)}
          onConfirm={handleExecuteBatchDelete}
        >
          <div className="bg-rose-50 dark:bg-rose-950/40 rounded-lg p-3 border border-rose-200 dark:border-rose-900/60 text-xs space-y-2">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Resumo do lote selecionado para exclusão:</span>
            </div>
            <div className="flex justify-between border-t border-rose-200/80 dark:border-rose-900/60 pt-2 text-slate-800 dark:text-slate-200">
              <span>Quantidade:</span>
              <span className="font-mono font-bold">{selectedEntryIds.length} itens</span>
            </div>
            <div className="flex justify-between text-slate-800 dark:text-slate-200">
              <span>Soma dos Valores:</span>
              <span className="font-mono font-extrabold text-rose-700 dark:text-rose-400">
                {formatBRL(selectedEntriesSum)}
              </span>
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* Income Deletion Confirmation Modal */}
      {incomeToDelete && (
        <ConfirmModal
          isOpen={Boolean(incomeToDelete)}
          title="Excluir Entrada (Receita)"
          description={`Tem certeza que deseja excluir o lançamento de entrada da empresa "${incomeToDelete.companyName}"?`}
          confirmLabel="Sim, Excluir Entrada"
          cancelLabel="Cancelar"
          variant="danger"
          onClose={() => setIncomeToDelete(null)}
          onConfirm={() => {
            onDeleteIncome(incomeToDelete.id);
            setIncomeToDelete(null);
          }}
        >
          <div className="bg-slate-50 dark:bg-slate-800/80 rounded-lg p-3 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
              <span className="text-slate-500 dark:text-slate-400">Empresa:</span>
              <span className="font-bold text-slate-900 dark:text-white">{incomeToDelete.companyName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
              <span className="text-slate-500 dark:text-slate-400">Data da Entrada:</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">{parseBRDate(incomeToDelete.date)}</span>
            </div>
            {incomeToDelete.description && (
              <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5">
                <span className="text-slate-500 dark:text-slate-400">Descrição:</span>
                <span className="text-slate-800 dark:text-slate-200">{incomeToDelete.description}</span>
              </div>
            )}
            <div className="flex justify-between pt-0.5">
              <span className="text-slate-500 dark:text-slate-400">Valor Recebido:</span>
              <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                {formatBRL(incomeToDelete.value)}
              </span>
            </div>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
};
