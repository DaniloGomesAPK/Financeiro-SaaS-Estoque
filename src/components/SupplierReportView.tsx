import React, { useState, useMemo } from 'react';
import { Supplier, CalculatedEntry } from '../types';
import { formatBRL, parseBRDate, getMonthYearFromDateStr, MONTHS_PT } from '../utils/calculations';
import { generateSupplierPDFReport, SupplierPDFReportData } from '../utils/pdfGenerator';
import {
  Truck,
  FileDown,
  Calendar,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Receipt,
  FileText,
  Building2,
  Filter,
  DollarSign,
  Layers,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LabelList,
} from 'recharts';

interface SupplierReportViewProps {
  suppliers: Supplier[];
  entries: CalculatedEntry[];
}

type PeriodFilterType = 'all' | 'last30' | 'currentYear' | 'custom';

/**
 * Parses date string (YYYY-MM-DD or DD/MM/YYYY) to millisecond timestamp for chronological sorting
 */
function parseDateForSort(dateStr?: string): number {
  if (!dateStr) return 0;
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month - 1, day).getTime();
      }
    }
  }
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = Number(parts[0]);
      const month = Number(parts[1]);
      const year = Number(parts[2]);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month - 1, day).getTime();
      }
    }
  }
  const t = new Date(dateStr).getTime();
  return isNaN(t) ? 0 : t;
}

export const SupplierReportView: React.FC<SupplierReportViewProps> = ({
  suppliers,
  entries,
}) => {
  // Sort suppliers alphabetically
  const sortedSuppliers = useMemo(() => {
    return [...suppliers].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [suppliers]);

  // Selected supplier ID (defaults to first supplier if available)
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>(() => {
    if (sortedSuppliers.length > 0) {
      return sortedSuppliers[0].id;
    }
    return '';
  });

  // Filter states
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [documentSearch, setDocumentSearch] = useState('');
  const [pendingTab, setPendingTab] = useState<'all' | 'overdue' | 'toPay'>('all');

  // Currently selected supplier object
  const currentSupplier = useMemo(() => {
    if (!selectedSupplierId) return null;
    return sortedSuppliers.find((s) => s.id === Number(selectedSupplierId)) || null;
  }, [selectedSupplierId, sortedSuppliers]);

  // All entries strictly belonging to the selected supplier
  const supplierAllEntries = useMemo(() => {
    if (!currentSupplier) return [];

    const normName = currentSupplier.name.trim().toLowerCase();
    const fornId = `forn-${currentSupplier.id}`;

    return entries.filter((e) => {
      const matchId = e.favorecidoId === fornId;
      const matchName = e.favorecidoName.trim().toLowerCase() === normName;
      const isSupplierType = e.favorecidoType === 'Fornecedor' || !e.favorecidoId.startsWith('func-');
      return (matchId || matchName) && isSupplierType;
    });
  }, [currentSupplier, entries]);

  // Filter entries according to selected period
  const filteredEntries = useMemo(() => {
    if (supplierAllEntries.length === 0) return [];

    const now = new Date();
    const todayY = now.getFullYear();

    return supplierAllEntries.filter((e) => {
      // Use due date (or payment date for paid) for filtering
      const targetDateStr = e.paymentDate && e.paymentDate.trim() !== '' ? e.paymentDate : e.dueDate;
      if (!targetDateStr) return true;

      const entryDate = new Date(targetDateStr + 'T00:00:00');

      if (periodFilter === 'last30') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        return entryDate >= thirtyDaysAgo && entryDate <= now;
      }

      if (periodFilter === 'currentYear') {
        return entryDate.getFullYear() === todayY;
      }

      if (periodFilter === 'custom') {
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate + 'T00:00:00');
          const end = new Date(customEndDate + 'T23:59:59');
          return entryDate >= start && entryDate <= end;
        }
        if (customStartDate) {
          const start = new Date(customStartDate + 'T00:00:00');
          return entryDate >= start;
        }
        if (customEndDate) {
          const end = new Date(customEndDate + 'T23:59:59');
          return entryDate <= end;
        }
        return true;
      }

      // 'all'
      return true;
    });
  }, [supplierAllEntries, periodFilter, customStartDate, customEndDate]);

  // Apply optional text search (NF or Document)
  const displayedEntries = useMemo(() => {
    if (!documentSearch.trim()) return filteredEntries;
    const q = documentSearch.trim().toLowerCase();
    return filteredEntries.filter((e) => {
      const nf = (e.nfNumber || '').toLowerCase();
      const doc = (e.docType || '').toLowerCase();
      const id = String(e.id);
      return nf.includes(q) || doc.includes(q) || id.includes(q);
    });
  }, [filteredEntries, documentSearch]);

  // Partition into Pending and Paid, ordered chronologically by due date ascending (oldest -> newest)
  const pendingEntries = useMemo(() => {
    return displayedEntries
      .filter((e) => e.status !== 'Pago')
      .sort((a, b) => {
        const timeA = parseDateForSort(a.dueDate);
        const timeB = parseDateForSort(b.dueDate);
        if (timeA !== timeB) return timeA - timeB;
        return (a.id || 0) - (b.id || 0);
      });
  }, [displayedEntries]);

  const overdueEntries = useMemo(() => {
    return pendingEntries.filter((e) => e.status === 'Atrasado');
  }, [pendingEntries]);

  const toPayEntries = useMemo(() => {
    return pendingEntries.filter((e) => e.status === 'À Vencer');
  }, [pendingEntries]);

  const paidEntries = useMemo(() => {
    return displayedEntries
      .filter((e) => e.status === 'Pago')
      .sort((a, b) => {
        const timeA = parseDateForSort(a.dueDate);
        const timeB = parseDateForSort(b.dueDate);
        if (timeA !== timeB) return timeA - timeB;
        return (a.id || 0) - (b.id || 0);
      });
  }, [displayedEntries]);

  // Financial summary metrics
  const totalPurchased = useMemo(() => {
    // Total original or total amount bought from this supplier in the period
    return filteredEntries.reduce((sum, e) => sum + (e.value || 0), 0);
  }, [filteredEntries]);

  const totalPaid = useMemo(() => {
    return filteredEntries
      .filter((e) => e.status === 'Pago')
      .reduce((sum, e) => sum + (e.totalWithInterest || e.value || 0), 0);
  }, [filteredEntries]);

  const totalPending = useMemo(() => {
    return filteredEntries
      .filter((e) => e.status !== 'Pago')
      .reduce((sum, e) => sum + (e.totalWithInterest || e.value || 0), 0);
  }, [filteredEntries]);

  // Monthly chart data (Evolução de pagamentos e compras por mês)
  const monthlyChartData = useMemo(() => {
    const monthMap: Record<
      string,
      {
        month: number;
        year: number;
        monthLabel: string;
        paid: number;
        total: number;
        pending: number;
      }
    > = {};

    filteredEntries.forEach((e) => {
      const dateForMonth = e.paymentDate && e.paymentDate.trim() !== '' ? e.paymentDate : e.dueDate;
      const parts = getMonthYearFromDateStr(dateForMonth);
      if (!parts) return;

      const key = `${parts.year}-${String(parts.month).padStart(2, '0')}`;
      const mInfo = MONTHS_PT.find((item) => item.value === parts.month);
      const labelShort = mInfo ? `${mInfo.short}/${String(parts.year).slice(-2)}` : `${parts.month}/${parts.year}`;

      if (!monthMap[key]) {
        monthMap[key] = {
          month: parts.month,
          year: parts.year,
          monthLabel: labelShort,
          paid: 0,
          total: 0,
          pending: 0,
        };
      }

      const val = e.totalWithInterest || e.value || 0;
      monthMap[key].total += val;
      if (e.status === 'Pago') {
        monthMap[key].paid += val;
      } else {
        monthMap[key].pending += val;
      }
    });

    return Object.values(monthMap)
      .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))
      .map((item) => ({
        monthLabel: item.monthLabel,
        'Total Pago': Math.round(item.paid * 100) / 100,
        'Total Lançado': Math.round(item.total * 100) / 100,
        'Pendente': Math.round(item.pending * 100) / 100,
        rawPaid: item.paid,
        rawTotal: item.total,
      }));
  }, [filteredEntries]);

  // Period label for PDF and header
  const periodLabel = useMemo(() => {
    if (periodFilter === 'all') return 'Todo o Histórico';
    if (periodFilter === 'last30') return 'Últimos 30 Dias';
    if (periodFilter === 'currentYear') return `Ano Atual (${new Date().getFullYear()})`;
    if (periodFilter === 'custom') {
      const s = customStartDate ? parseBRDate(customStartDate) : 'Início';
      const e = customEndDate ? parseBRDate(customEndDate) : 'Fim';
      return `${s} até ${e}`;
    }
    return 'Período Selecionado';
  }, [periodFilter, customStartDate, customEndDate]);

  // Handler to generate and download PDF
  const handleDownloadPDF = () => {
    if (!currentSupplier) return;

    const reportData: SupplierPDFReportData = {
      supplierName: currentSupplier.name,
      periodLabel,
      totalPurchased,
      totalPaid,
      totalPending,
      pendingEntries,
      paidEntries,
      monthlyHistory: monthlyChartData.map((m) => ({
        monthLabel: m.monthLabel,
        paid: m['Total Pago'],
        total: m['Total Lançado'],
      })),
    };

    generateSupplierPDFReport(reportData);
  };

  // Pending entries filtered by tab
  const displayedPendingEntries = useMemo(() => {
    if (pendingTab === 'overdue') return overdueEntries;
    if (pendingTab === 'toPay') return toPayEntries;
    return pendingEntries;
  }, [pendingTab, pendingEntries, overdueEntries, toPayEntries]);

  return (
    <div className="space-y-4">
      {/* 1. TOP HEADER & SUPPLIER SELECTOR CARD */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-200/50 dark:border-blue-800/50 shadow-2xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-none">
                  Painel Individual de Fornecedores
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <Building2 className="w-3 h-3 text-blue-500" />
                  {suppliers.length} {suppliers.length === 1 ? 'fornecedor' : 'fornecedores'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Selecione um fornecedor para auditar histórico financeiro, pagamentos e contas pendentes.
              </p>
            </div>
          </div>

          {/* PDF Download Button */}
          {currentSupplier && (
            <button
              onClick={handleDownloadPDF}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer active:scale-95 self-start md:self-auto"
              title="Baixar relatório financeiro completo em PDF"
            >
              <FileDown className="w-4 h-4" />
              <span>Baixar Relatório PDF</span>
            </button>
          )}
        </div>

        {/* CONTROLS ROW: SELETOR DE FORNECEDOR + FILTROS DE PERÍODO */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          {/* Seletor de Fornecedor */}
          <div className="lg:col-span-5 space-y-1">
            <label
              htmlFor="supplier-selector"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Selecionar Fornecedor:
            </label>
            <div className="relative">
              <select
                id="supplier-selector"
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value ? Number(e.target.value) : '')}
                className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-lg text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer shadow-2xs"
              >
                {sortedSuppliers.length === 0 ? (
                  <option value="">Nenhum fornecedor cadastrado</option>
                ) : (
                  sortedSuppliers.map((s) => (
                    <option key={`sup-sel-${s.id}`} value={s.id}>
                      {s.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Filtro de Período */}
          <div className="lg:col-span-7 space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Período de Análise:
            </label>
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setPeriodFilter('all')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  periodFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter('last30')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  periodFilter === 'last30'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Últimos 30 dias
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter('currentYear')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  periodFilter === 'currentYear'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Ano atual ({new Date().getFullYear()})
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter('custom')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                  periodFilter === 'custom'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Personalizado
              </button>
            </div>
          </div>
        </div>

        {/* Inputs de Data para Período Personalizado */}
        {periodFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              Intervalo de datas:
            </span>
            <div className="flex items-center gap-2">
              <label className="text-slate-500 font-medium">De:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-500 font-medium">Até:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                }}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Limpar datas
              </button>
            )}
          </div>
        )}
      </div>

      {/* SE NENHUM FORNECEDOR CADASTRADO */}
      {sortedSuppliers.length === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center space-y-3">
          <Truck className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            Nenhum fornecedor cadastrado no sistema
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Cadastre seus fornecedores na aba <strong>Configurações</strong> para começar a acompanhar o histórico financeiro individual.
          </p>
        </div>
      )}

      {/* SE FORNECEDOR SELECIONADO */}
      {currentSupplier && (
        <>
          {/* 2. DASHBOARD FINANCEIRO DO FORNECEDOR - CARDS DE RESUMO */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Resumo Financeiro:
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white font-mono bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                  {currentSupplier.name}
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Filtro: <strong className="text-slate-700 dark:text-slate-300">{periodLabel}</strong> &bull; {filteredEntries.length} {filteredEntries.length === 1 ? 'conta total' : 'contas totais'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Total Lançado */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5 text-blue-500" />
                    Total Lançado
                  </span>
                  <div className="text-xl font-extrabold tracking-tight font-mono text-slate-900 dark:text-white tabular-nums">
                    {formatBRL(totalPurchased)}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Volume original de contas lançadas
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0 font-bold">
                  📦
                </div>
              </div>

              {/* Card 2: Total Pago */}
              <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-4 shadow-2xs hover:border-emerald-300 transition-all flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Total Pago
                  </span>
                  <div className="text-xl font-extrabold tracking-tight font-mono text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {formatBRL(totalPaid)}
                  </div>
                  <p className="text-[10px] text-emerald-800/80 dark:text-emerald-400">
                    {paidEntries.length} {paidEntries.length === 1 ? 'conta liquidada' : 'contas liquidadas'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-200/80 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-800 dark:text-emerald-200 shrink-0 font-bold">
                  💸
                </div>
              </div>

              {/* Card 3: Saldo Pendente */}
              <div className="bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl p-4 shadow-2xs hover:border-rose-300 transition-all flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    Saldo Pendente
                  </span>
                  <div className="text-xl font-extrabold tracking-tight font-mono text-rose-700 dark:text-rose-300 tabular-nums">
                    {formatBRL(totalPending)}
                  </div>
                  <p className="text-[10px] text-rose-800/80 dark:text-rose-400">
                    {pendingEntries.length} {pendingEntries.length === 1 ? 'pendência ativa' : 'pendências ativas'}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-rose-200/80 dark:bg-rose-900/60 flex items-center justify-center text-rose-800 dark:text-rose-200 shrink-0 font-bold">
                  ⚠️
                </div>
              </div>

              {/* Card 4: Quantidade de Contas */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                    Qtd. de Contas
                  </span>
                  <div className="text-xl font-extrabold tracking-tight font-mono text-slate-900 dark:text-white tabular-nums">
                    {filteredEntries.length}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                    <span className="text-emerald-600 dark:text-emerald-400">{paidEntries.length} pagas</span>
                    <span>&bull;</span>
                    <span className="text-rose-600 dark:text-rose-400">{overdueEntries.length} atraso</span>
                    <span>&bull;</span>
                    <span className="text-blue-600 dark:text-blue-400">{toPayEntries.length} vencer</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  📊
                </div>
              </div>
            </div>
          </div>

          {/* 3. HISTÓRICO FINANCEIRO (GRÁFICO COM RECHARTS) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Histórico Financeiro: Evolução por Período
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Demonstrativo mensal de valores pagos e lançados com {currentSupplier.name} ({periodLabel}).
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold font-mono text-slate-600 dark:text-slate-300 self-start sm:self-auto">
                Total Liquidado: <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{formatBRL(totalPaid)}</span>
              </span>
            </div>

            {monthlyChartData.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-xs text-slate-500 space-y-1 bg-slate-50/50 dark:bg-slate-800/30 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                <Receipt className="w-8 h-8 text-slate-400" />
                <span>Nenhum lançamento encontrado para este fornecedor no período selecionado.</span>
              </div>
            ) : (
              <div className="h-80 sm:h-96 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyChartData}
                    margin={{ top: 38, right: 15, left: 10, bottom: 5 }}
                    barGap={3}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                      domain={[0, (dataMax: number) => Math.ceil((dataMax * 1.18) || 100)]}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    
                    {/* Barra 1: Total Lançado (Azul / Índigo) */}
                    <Bar dataKey="Total Lançado" fill="#6366f1" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="Total Lançado"
                        position="top"
                        content={(props: any) => {
                          const { x, y, width, value } = props;
                          if (value === undefined || value === null || Number(value) <= 0) return null;
                          const numX = Number(x) || 0;
                          const numY = Number(y) || 0;
                          const numWidth = Number(width) || 0;
                          const centerX = numX + numWidth / 2;
                          return (
                            <g pointerEvents="none">
                              <text
                                x={centerX}
                                y={numY - 15}
                                fill="#4f46e5"
                                textAnchor="middle"
                                className="font-mono font-bold text-[9px] sm:text-[10px]"
                              >
                                {formatBRL(Number(value))}
                              </text>
                              <text
                                x={centerX}
                                y={numY - 4}
                                fill="#64748b"
                                textAnchor="middle"
                                className="font-sans font-semibold text-[8px] sm:text-[9px]"
                              >
                                Lançado
                              </text>
                            </g>
                          );
                        }}
                      />
                    </Bar>

                    {/* Barra 2: Total Pago (Verde) */}
                    <Bar dataKey="Total Pago" fill="#10b981" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="Total Pago"
                        position="top"
                        content={(props: any) => {
                          const { x, y, width, value } = props;
                          if (value === undefined || value === null || Number(value) <= 0) return null;
                          const numX = Number(x) || 0;
                          const numY = Number(y) || 0;
                          const numWidth = Number(width) || 0;
                          const centerX = numX + numWidth / 2;
                          return (
                            <g pointerEvents="none">
                              <text
                                x={centerX}
                                y={numY - 15}
                                fill="#059669"
                                textAnchor="middle"
                                className="font-mono font-bold text-[9px] sm:text-[10px]"
                              >
                                {formatBRL(Number(value))}
                              </text>
                              <text
                                x={centerX}
                                y={numY - 4}
                                fill="#64748b"
                                textAnchor="middle"
                                className="font-sans font-semibold text-[8px] sm:text-[9px]"
                              >
                                Pago
                              </text>
                            </g>
                          );
                        }}
                      />
                    </Bar>

                    {/* Barra 3: Pendente (Vermelho) */}
                    <Bar dataKey="Pendente" fill="#f43f5e" radius={[4, 4, 0, 0]}>
                      <LabelList
                        dataKey="Pendente"
                        position="top"
                        content={(props: any) => {
                          const { x, y, width, value } = props;
                          if (value === undefined || value === null || Number(value) <= 0) return null;
                          const numX = Number(x) || 0;
                          const numY = Number(y) || 0;
                          const numWidth = Number(width) || 0;
                          const centerX = numX + numWidth / 2;
                          return (
                            <g pointerEvents="none">
                              <text
                                x={centerX}
                                y={numY - 15}
                                fill="#e11d48"
                                textAnchor="middle"
                                className="font-mono font-bold text-[9px] sm:text-[10px]"
                              >
                                {formatBRL(Number(value))}
                              </text>
                              <text
                                x={centerX}
                                y={numY - 4}
                                fill="#64748b"
                                textAnchor="middle"
                                className="font-sans font-semibold text-[8px] sm:text-[9px]"
                              >
                                Pendente
                              </text>
                            </g>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* BUSCA RÁPIDA DE DOCUMENTOS DENTRO DO FORNECEDOR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-100/80 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 ml-1" />
              <input
                type="text"
                value={documentSearch}
                onChange={(e) => setDocumentSearch(e.target.value)}
                placeholder="Buscar por número de NF ou tipo de documento..."
                className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-80"
              />
              {documentSearch && (
                <button
                  onClick={() => setDocumentSearch('')}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Exibindo <strong>{displayedEntries.length}</strong> de {supplierAllEntries.length} lançamentos deste fornecedor.
            </div>
          </div>

          {/* 4. DUAS ÁREAS: CONTAS PENDENTES E CONTAS PAGAS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ÁREA 1: CONTAS PENDENTES (SEPARANDO ATRASADAS E A VENCER) */}
            <div className="bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900/60 rounded-xl shadow-2xs overflow-hidden flex flex-col">
              {/* Header com Abas de Status */}
              <div className="p-3 sm:p-3.5 border-b border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-rose-600 text-white">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-rose-950 dark:text-rose-200 uppercase tracking-wider">
                        Contas Pendentes
                      </h3>
                      <p className="text-[11px] text-rose-800/80 dark:text-rose-300/80">
                        {pendingEntries.length} {pendingEntries.length === 1 ? 'conta em aberto' : 'contas em aberto'}
                      </p>
                    </div>
                  </div>

                  <span className="font-mono font-extrabold text-rose-700 dark:text-rose-300 text-sm">
                    {formatBRL(totalPending)}
                  </span>
                </div>

                {/* Sub-Tabs: Todas, Atrasadas, A Vencer */}
                <div className="flex items-center gap-1 text-[11px] pt-1">
                  <button
                    onClick={() => setPendingTab('all')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                      pendingTab === 'all'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-rose-900 dark:text-rose-200 hover:bg-rose-100 border border-rose-200 dark:border-rose-900'
                    }`}
                  >
                    Todas ({pendingEntries.length})
                  </button>
                  <button
                    onClick={() => setPendingTab('overdue')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                      pendingTab === 'overdue'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-rose-900 dark:text-rose-200 hover:bg-rose-100 border border-rose-200 dark:border-rose-900'
                    }`}
                  >
                    ⚠️ Atrasadas ({overdueEntries.length})
                  </button>
                  <button
                    onClick={() => setPendingTab('toPay')}
                    className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                      pendingTab === 'toPay'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-blue-900 dark:text-blue-200 hover:bg-blue-100 border border-blue-200 dark:border-blue-900'
                    }`}
                  >
                    📅 À Vencer ({toPayEntries.length})
                  </button>
                </div>
              </div>

              {/* Lista / Tabela de Pendências */}
              <div className="flex-1 overflow-x-auto">
                {displayedPendingEntries.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      Nenhuma conta pendente para os filtros selecionados.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Todos os boletos com este fornecedor estão em dia!
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 text-[11px]">
                        <th className="py-2 px-3">Documento / NF</th>
                        <th className="py-2 px-2.5 text-center">Vencimento</th>
                        <th className="py-2 px-2.5 text-center">Status</th>
                        <th className="py-2 px-3 text-right font-mono">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-[11px]">
                      {displayedPendingEntries.map((e) => {
                        const isAtrasado = e.status === 'Atrasado';
                        return (
                          <tr
                            key={`pending-${e.id}`}
                            className="hover:bg-rose-50/30 dark:hover:bg-rose-950/10 transition-colors"
                          >
                            <td className="py-2 px-3">
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{e.nfNumber ? `NF ${e.nfNumber}` : `Doc #${e.id}`}</span>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {e.docType || 'Boleto'}
                                {e.interestValue > 0 && (
                                  <span className="text-rose-600 font-mono ml-1">
                                    (+{formatBRL(e.interestValue)} juros)
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="py-2 px-2.5 text-center font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {parseBRDate(e.dueDate)}
                            </td>

                            <td className="py-2 px-2.5 text-center whitespace-nowrap">
                              {isAtrasado ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                  Atrasado ({e.daysOverdue}d)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                                  À Vencer
                                </span>
                              )}
                            </td>

                            <td className="py-2 px-3 text-right font-mono font-extrabold text-rose-700 dark:text-rose-300 whitespace-nowrap">
                              {formatBRL(e.totalWithInterest || e.value)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-rose-50/80 dark:bg-rose-950/40 font-bold border-t border-rose-200 dark:border-rose-900/60 text-xs">
                        <td colSpan={3} className="py-2 px-3 text-rose-950 dark:text-rose-200 uppercase text-[10px]">
                          Subtotal Pendente:
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-extrabold text-rose-700 dark:text-rose-300">
                          {formatBRL(
                            displayedPendingEntries.reduce(
                              (acc, i) => acc + (i.totalWithInterest || i.value || 0),
                              0
                            )
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>

            {/* ÁREA 2: CONTAS PAGAS */}
            <div className="bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 rounded-xl shadow-2xs overflow-hidden flex flex-col">
              {/* Header Contas Pagas */}
              <div className="p-3 sm:p-3.5 border-b border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-emerald-600 text-white">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-200 uppercase tracking-wider">
                      Contas Pagas
                    </h3>
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                      {paidEntries.length} {paidEntries.length === 1 ? 'pagamento liquidado' : 'pagamentos liquidados'}
                    </p>
                  </div>
                </div>

                <span className="font-mono font-extrabold text-emerald-700 dark:text-emerald-300 text-sm">
                  {formatBRL(totalPaid)}
                </span>
              </div>

              {/* Lista / Tabela de Pagos */}
              <div className="flex-1 overflow-x-auto">
                {paidEntries.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 space-y-1">
                    <Receipt className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      Nenhum pagamento registrado no período.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Assim que boletos forem quitados, eles aparecerão aqui com a data de quitação.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 text-[11px]">
                        <th className="py-2 px-3">Documento / NF</th>
                        <th className="py-2 px-2.5 text-center">Vencimento</th>
                        <th className="py-2 px-2.5 text-center">Data do Pagamento</th>
                        <th className="py-2 px-3 text-right font-mono">Valor Pago</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-[11px]">
                      {paidEntries.map((e) => {
                        const payDate = e.paymentDate ? parseBRDate(e.paymentDate) : '-';
                        return (
                          <tr
                            key={`paid-${e.id}`}
                            className="hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 transition-colors"
                          >
                            <td className="py-2 px-3">
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{e.nfNumber ? `NF ${e.nfNumber}` : `Doc #${e.id}`}</span>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {e.docType || 'Boleto'}
                              </div>
                            </td>

                            <td className="py-2 px-2.5 text-center font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {parseBRDate(e.dueDate)}
                            </td>

                            <td className="py-2 px-2.5 text-center font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                              {payDate}
                            </td>

                            <td className="py-2 px-3 text-right font-mono font-extrabold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                              {formatBRL(e.totalWithInterest || e.value)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-50/80 dark:bg-emerald-950/40 font-bold border-t border-emerald-200 dark:border-emerald-900/60 text-xs">
                        <td colSpan={3} className="py-2 px-3 text-emerald-950 dark:text-emerald-200 uppercase text-[10px]">
                          Subtotal Pago:
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-extrabold text-emerald-700 dark:text-emerald-300">
                          {formatBRL(
                            paidEntries.reduce(
                              (acc, i) => acc + (i.totalWithInterest || i.value || 0),
                              0
                            )
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
