import React, { useState, useMemo } from 'react';
import { CalculatedEntry, IncomeEntry } from '../types';
import { formatBRL, parseBRDate, getTodayDateString } from '../utils/calculations';
import { generateStatusDetailsPDFReport } from '../utils/pdfGenerator';
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Building2,
  DollarSign,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Search,
  Receipt,
  Layers,
  TrendingDown,
  TrendingUp,
  X,
  FileDown,
} from 'lucide-react';

export interface StatusDetailsViewProps {
  entries?: CalculatedEntry[];
  incomes?: IncomeEntry[];
  type: 'overdue' | 'to-pay' | 'paid' | 'incomes';
  onBack: () => void;
}

export const StatusDetailsView: React.FC<StatusDetailsViewProps> = ({
  entries = [],
  incomes = [],
  type,
  onBack,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [subFilter, setSubFilter] = useState<'all' | 'period1' | 'period2' | 'custom'>('all');
  const [isCustomDateModalOpen, setIsCustomDateModalOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');

  const todayStr = useMemo(() => getTodayDateString(), []);

  const isOverdue = type === 'overdue';
  const isToPay = type === 'to-pay';
  const isPaid = type === 'paid';
  const isIncomes = type === 'incomes';

  const handleOpenCustomDateModal = () => {
    setTempStartDate(customStartDate);
    setTempEndDate(customEndDate);
    setIsCustomDateModalOpen(true);
  };

  const handleCloseCustomDateModal = () => {
    setIsCustomDateModalOpen(false);
  };

  const handleConfirmCustomDateModal = () => {
    let start = tempStartDate.trim();
    let end = tempEndDate.trim();

    if (!start && !end) {
      alert('Por favor, informe pelo menos uma data (inicial ou final).');
      return;
    }

    if (start && end && start > end) {
      const swap = start;
      start = end;
      end = swap;
    }

    setCustomStartDate(start);
    setCustomEndDate(end);
    setSubFilter('custom');
    setIsCustomDateModalOpen(false);
  };

  const handleClearCustomFilter = () => {
    setTempStartDate('');
    setTempEndDate('');
    setCustomStartDate('');
    setCustomEndDate('');
    setSubFilter('all');
    setIsCustomDateModalOpen(false);
  };

  // Helper para cálculo dos dias de diferença em relação a hoje
  const getDaysDiff = (dueDateStr: string, currentDayStr: string) => {
    try {
      const [dYear, dMonth, dDay] = dueDateStr.split('-').map(Number);
      const [tYear, tMonth, tDay] = currentDayStr.split('-').map(Number);
      const due = new Date(dYear, dMonth - 1, dDay);
      const cur = new Date(tYear, tMonth - 1, tDay);
      const diffMs = due.getTime() - cur.getTime();
      return Math.round(diffMs / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  };

  // 1. Filtrar estritamente por status / tipo
  const targetEntries = useMemo(() => {
    if (isIncomes) {
      return (incomes || [])
        .map((inc) => ({
          id: inc.id,
          favorecidoId: `income-${inc.id}`,
          favorecidoName: inc.companyName || 'Empresa não informada',
          favorecidoType: 'Fornecedor' as const,
          docType: (inc.forma_recebimento || 'Outros') as any,
          nfNumber: inc.description || '',
          dueDate: inc.date,
          paymentDate: inc.date,
          value: inc.value,
          interestRate: 0,
          status: 'Pago' as const,
          daysOverdue: 0,
          interestValue: 0,
          totalWithInterest: inc.value,
          monthYear: '',
        }))
        .sort((a, b) => b.dueDate.localeCompare(a.dueDate)); // mais recentes primeiro
    }

    return (entries || [])
      .filter((e) => {
        if (isOverdue) {
          return e.status === 'Atrasado';
        } else if (isToPay) {
          return e.status === 'À Vencer';
        } else if (isPaid) {
          return e.status === 'Pago';
        }
        return false;
      })
      .sort((a, b) => {
        if (isOverdue) {
          if (a.dueDate !== b.dueDate) {
            return a.dueDate.localeCompare(b.dueDate); // mais atrasados primeiro
          }
          return (b.totalWithInterest || 0) - (a.totalWithInterest || 0);
        } else if (isToPay) {
          if (a.dueDate !== b.dueDate) {
            return a.dueDate.localeCompare(b.dueDate);
          }
          return (b.totalWithInterest || 0) - (a.totalWithInterest || 0);
        } else {
          // Para pagos: cronológico decrescente (pagamentos mais recentes primeiro)
          const dateA = a.paymentDate || a.dueDate;
          const dateB = b.paymentDate || b.dueDate;
          if (dateA !== dateB) {
            return dateB.localeCompare(dateA);
          }
          return (b.totalWithInterest || 0) - (a.totalWithInterest || 0);
        }
      });
  }, [entries, incomes, isOverdue, isToPay, isPaid, isIncomes]);

  // Cálculos de Resumo Financeiro
  const totalAmount = useMemo(() => {
    return targetEntries.reduce((sum, e) => sum + (e.totalWithInterest || 0), 0);
  }, [targetEntries]);

  const totalCount = targetEntries.length;

  // Métricas específicas para Atrasado
  const totalInterest = useMemo(() => {
    return targetEntries.reduce((sum, e) => sum + (e.interestValue || 0), 0);
  }, [targetEntries]);

  const countOverdueUpTo30Days = useMemo(() => {
    return targetEntries.filter((e) => {
      const days = e.daysOverdue || Math.abs(getDaysDiff(e.dueDate, todayStr));
      return days <= 30;
    }).length;
  }, [targetEntries, todayStr]);

  const countOverdueMoreThan30Days = useMemo(() => {
    return targetEntries.filter((e) => {
      const days = e.daysOverdue || Math.abs(getDaysDiff(e.dueDate, todayStr));
      return days > 30;
    }).length;
  }, [targetEntries, todayStr]);

  // Métricas específicas para À Vencer
  const todayDueEntries = useMemo(() => {
    return targetEntries.filter((e) => e.dueDate === todayStr);
  }, [targetEntries, todayStr]);

  const next7DaysEntries = useMemo(() => {
    return targetEntries.filter((e) => {
      const days = getDaysDiff(e.dueDate, todayStr);
      return days >= 0 && days <= 7;
    });
  }, [targetEntries, todayStr]);

  const totalNext7Days = useMemo(() => {
    return next7DaysEntries.reduce((sum, e) => sum + (e.totalWithInterest || 0), 0);
  }, [next7DaysEntries]);

  // Métricas específicas para Pago (Saídas)
  const paidLast30DaysEntries = useMemo(() => {
    return targetEntries.filter((e) => {
      const pDate = e.paymentDate || e.dueDate;
      const days = Math.abs(getDaysDiff(pDate, todayStr));
      return days <= 30;
    });
  }, [targetEntries, todayStr]);

  const totalPaidLast30Days = useMemo(() => {
    return paidLast30DaysEntries.reduce((sum, e) => sum + (e.totalWithInterest || 0), 0);
  }, [paidLast30DaysEntries]);

  const countPaidMoreThan30Days = targetEntries.length - paidLast30DaysEntries.length;

  // Métricas específicas para Entradas (Receitas)
  const incomesLast30DaysEntries = useMemo(() => {
    return targetEntries.filter((e) => {
      const days = Math.abs(getDaysDiff(e.dueDate, todayStr));
      return days <= 30;
    });
  }, [targetEntries, todayStr]);

  const totalIncomesLast30Days = useMemo(() => {
    return incomesLast30DaysEntries.reduce((sum, e) => sum + (e.totalWithInterest || 0), 0);
  }, [incomesLast30DaysEntries]);

  const countIncomesMoreThan30Days = targetEntries.length - incomesLast30DaysEntries.length;

  // Quantidade de registros dentro do período personalizado
  const countCustom = useMemo(() => {
    if (!customStartDate && !customEndDate) return 0;
    return targetEntries.filter((e) => {
      let itemDate = e.dueDate;
      if (isPaid) {
        itemDate = e.paymentDate || e.dueDate;
      } else if (isIncomes) {
        itemDate = e.paymentDate || e.dueDate;
      } else {
        itemDate = e.dueDate;
      }
      if (customStartDate && itemDate < customStartDate) return false;
      if (customEndDate && itemDate > customEndDate) return false;
      return true;
    }).length;
  }, [targetEntries, isPaid, isIncomes, customStartDate, customEndDate]);

  // Filtragem de busca e subfiltros
  const filteredEntries = useMemo(() => {
    return targetEntries.filter((e) => {
      // Subfiltro
      if (isOverdue) {
        const days = e.daysOverdue || Math.abs(getDaysDiff(e.dueDate, todayStr));
        if (subFilter === 'period1' && days > 30) return false;
        if (subFilter === 'period2' && days <= 30) return false;
        if (subFilter === 'custom') {
          const itemDate = e.dueDate;
          if (customStartDate && itemDate < customStartDate) return false;
          if (customEndDate && itemDate > customEndDate) return false;
        }
      } else if (isToPay) {
        const days = getDaysDiff(e.dueDate, todayStr);
        if (subFilter === 'period1' && days !== 0) return false; // Vencem Hoje
        if (subFilter === 'period2' && (days < 0 || days > 7)) return false; // Próximos 7 dias
        if (subFilter === 'custom') {
          const itemDate = e.dueDate;
          if (customStartDate && itemDate < customStartDate) return false;
          if (customEndDate && itemDate > customEndDate) return false;
        }
      } else if (isPaid) {
        const pDate = e.paymentDate || e.dueDate;
        const days = Math.abs(getDaysDiff(pDate, todayStr));
        if (subFilter === 'period1' && days > 30) return false; // Últimos 30 dias
        if (subFilter === 'period2' && days <= 30) return false; // Anteriores
        if (subFilter === 'custom') {
          const itemDate = e.paymentDate || e.dueDate;
          if (customStartDate && itemDate < customStartDate) return false;
          if (customEndDate && itemDate > customEndDate) return false;
        }
      } else if (isIncomes) {
        const days = Math.abs(getDaysDiff(e.dueDate, todayStr));
        if (subFilter === 'period1' && days > 30) return false; // Últimos 30 dias
        if (subFilter === 'period2' && days <= 30) return false; // Anteriores
        if (subFilter === 'custom') {
          const itemDate = e.paymentDate || e.dueDate;
          if (customStartDate && itemDate < customStartDate) return false;
          if (customEndDate && itemDate > customEndDate) return false;
        }
      }

      // Busca textual
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const favName = (e.favorecidoName || '').toLowerCase();
      const docType = (e.docType || '').toLowerCase();
      const nfNum = (e.nfNumber || '').toLowerCase();
      const dateBr = parseBRDate(e.paymentDate || e.dueDate).toLowerCase();

      return (
        favName.includes(term) ||
        docType.includes(term) ||
        nfNum.includes(term) ||
        dateBr.includes(term)
      );
    });
  }, [targetEntries, isOverdue, isToPay, isPaid, isIncomes, subFilter, customStartDate, customEndDate, searchTerm, todayStr]);

  const backButtonId = isOverdue
    ? 'btn-voltar-dashboard-atrasados'
    : isToPay
    ? 'btn-voltar-dashboard-a-vencer'
    : isPaid
    ? 'btn-voltar-dashboard-pagos'
    : 'btn-voltar-dashboard-entradas';

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleGeneratePDF = () => {
    setIsGeneratingPdf(true);
    try {
      let filterLabel = 'Todos os Registros';
      if (subFilter === 'period1') {
        if (isOverdue) filterLabel = 'Até 30 dias de atraso';
        else if (isToPay) filterLabel = 'Vencem Hoje';
        else if (isPaid) filterLabel = 'Últimos 30 dias';
        else filterLabel = 'Últimos 30 dias';
      } else if (subFilter === 'period2') {
        if (isOverdue) filterLabel = '+ de 30 dias de atraso';
        else if (isToPay) filterLabel = 'Próximos 7 dias';
        else if (isPaid) filterLabel = 'Anteriores a 30 dias';
        else filterLabel = 'Anteriores a 30 dias';
      } else if (subFilter === 'custom') {
        const startStr = customStartDate ? parseBRDate(customStartDate) : '';
        const endStr = customEndDate ? parseBRDate(customEndDate) : '';
        if (startStr && endStr) {
          filterLabel = `Período: ${startStr} até ${endStr}`;
        } else if (startStr) {
          filterLabel = `A partir de ${startStr}`;
        } else if (endStr) {
          filterLabel = `Até ${endStr}`;
        } else {
          filterLabel = 'Período Personalizado';
        }
      }

      const exportTotalAmount = filteredEntries.reduce(
        (sum, e) => sum + (e.totalWithInterest || e.value || 0),
        0
      );
      const exportTotalCount = filteredEntries.length;

      let kpiCards: { label: string; value: string; subtext?: string }[] = [];
      if (isOverdue) {
        kpiCards = [
          {
            label: 'Total em Atraso',
            value: formatBRL(exportTotalAmount),
            subtext: `${exportTotalCount} ${exportTotalCount === 1 ? 'título vencido' : 'títulos vencidos'}`,
          },
          {
            label: 'Total de Títulos',
            value: `${exportTotalCount} contas`,
            subtext: `${countOverdueMoreThan30Days} com mais de 30 dias`,
          },
          {
            label: 'Juros e Multas',
            value: formatBRL(totalInterest),
            subtext: 'Encargos acumulados',
          },
        ];
      } else if (isToPay) {
        const todayDueSum = todayDueEntries.reduce((s, e) => s + (e.totalWithInterest || e.value || 0), 0);
        kpiCards = [
          {
            label: 'Total a Vencer',
            value: formatBRL(exportTotalAmount),
            subtext: `${exportTotalCount} ${exportTotalCount === 1 ? 'conta programada' : 'contas programadas'}`,
          },
          {
            label: 'Vencem Hoje',
            value: `${todayDueEntries.length} contas`,
            subtext: formatBRL(todayDueSum),
          },
          {
            label: 'Próximos 7 Dias',
            value: `${next7DaysEntries.length} contas`,
            subtext: formatBRL(totalNext7Days),
          },
        ];
      } else if (isPaid) {
        kpiCards = [
          {
            label: 'Total Quitado',
            value: formatBRL(exportTotalAmount),
            subtext: `${exportTotalCount} ${exportTotalCount === 1 ? 'pagamento' : 'pagamentos'}`,
          },
          {
            label: 'Últimos 30 Dias',
            value: `${paidLast30DaysEntries.length} contas`,
            subtext: formatBRL(totalPaidLast30Days),
          },
          {
            label: 'Histórico Anterior',
            value: `${countPaidMoreThan30Days} contas`,
            subtext: 'Pagamentos consolidados',
          },
        ];
      } else {
        const avgIncome = exportTotalCount > 0 ? exportTotalAmount / exportTotalCount : 0;
        kpiCards = [
          {
            label: 'Total Recebido',
            value: formatBRL(exportTotalAmount),
            subtext: `${exportTotalCount} ${exportTotalCount === 1 ? 'recebimento' : 'recebimentos'}`,
          },
          {
            label: 'Últimos 30 Dias',
            value: `${incomesLast30DaysEntries.length} entradas`,
            subtext: formatBRL(totalIncomesLast30Days),
          },
          {
            label: 'Ticket Médio',
            value: formatBRL(avgIncome),
            subtext: 'Média por recebimento',
          },
        ];
      }

      generateStatusDetailsPDFReport({
        type,
        filterLabel,
        searchTerm: searchTerm.trim() || undefined,
        entries: filteredEntries,
        rawIncomes: incomes,
        totalAmount: exportTotalAmount,
        totalCount: exportTotalCount,
        kpiCards,
      });
    } catch (err) {
      console.error('Erro ao gerar relatório PDF:', err);
      alert('Ocorreu um erro ao gerar o relatório PDF. Por favor, tente novamente.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200 w-full">
      {/* Barra Superior de Navegação */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 gap-2 flex-wrap">
        <button
          type="button"
          id={backButtonId}
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-lg text-black dark:text-white bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-xs transition-all cursor-pointer hover:translate-x-[-2px]"
        >
          <ArrowLeft className="w-4 h-4 text-black dark:text-blue-400" />
          <span>← Voltar para Dashboard</span>
        </button>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Botão Baixar Relatório PDF */}
          <button
            type="button"
            id={`btn-gerar-pdf-${type}`}
            onClick={handleGeneratePDF}
            disabled={isGeneratingPdf}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-lg text-white shadow-xs transition-all cursor-pointer active:scale-95 ${
              isOverdue
                ? 'bg-rose-600 hover:bg-rose-700'
                : isToPay
                ? 'bg-blue-600 hover:bg-blue-700'
                : isPaid
                ? 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
            title={`Baixar relatório PDF completo de ${
              isOverdue
                ? 'Contas Atrasadas'
                : isToPay
                ? 'Contas a Vencer'
                : isPaid
                ? 'Contas Pagas'
                : 'Entradas e Receitas'
            }`}
          >
            {isGeneratingPdf ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Gerando PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                <span>Baixar Relatório PDF</span>
              </>
            )}
          </button>

          <div className="text-xs text-black dark:text-slate-300 hidden md:flex items-center gap-1.5 font-bold">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>Atualizado em tempo real</span>
          </div>
        </div>
      </div>

      {/* Cabeçalho Executivo */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span
                className={`p-2.5 rounded-xl border ${
                  isOverdue
                    ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
                    : isToPay
                    ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/50'
                    : isPaid
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                    : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50'
                }`}
              >
                {isOverdue ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : isToPay ? (
                  <Calendar className="w-5 h-5" />
                ) : isPaid ? (
                  <Receipt className="w-5 h-5" />
                ) : (
                  <TrendingUp className="w-5 h-5" />
                )}
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-black dark:text-white">
                  {isOverdue
                    ? 'Total Atrasado'
                    : isToPay
                    ? 'Total À Vencer'
                    : isPaid
                    ? 'Total Pago (Saídas)'
                    : 'Total Entradas'}
                </h1>
                <p className="text-xs sm:text-sm text-black dark:text-slate-200 mt-0.5 font-medium">
                  {isOverdue
                    ? 'Contas com status vencido/atrasado pendentes de pagamento'
                    : isToPay
                    ? 'Contas programadas com status À Vencer aguardando quitação'
                    : isPaid
                    ? 'Compromissos financeiros quitados e histórico de pagamentos'
                    : 'Receitas operacionais e histórico de recebimentos financeiros'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black uppercase tracking-wider ${
                isOverdue
                  ? 'bg-rose-100 text-black dark:bg-rose-950/80 dark:text-rose-200 border-2 border-rose-300 dark:border-rose-800'
                  : isToPay
                  ? 'bg-blue-100 text-black dark:bg-blue-950/80 dark:text-blue-200 border-2 border-blue-300 dark:border-blue-800'
                  : isPaid
                  ? 'bg-slate-200 text-black dark:bg-slate-800 dark:text-slate-200 border-2 border-slate-300 dark:border-slate-700'
                  : 'bg-emerald-100 text-black dark:bg-emerald-950/80 dark:text-emerald-200 border-2 border-emerald-300 dark:border-emerald-800'
              }`}
            >
              {isOverdue ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-black dark:text-rose-400" />
                  Status: Atrasado
                </>
              ) : isToPay ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-black dark:text-blue-400" />
                  Status: À Vencer
                </>
              ) : isPaid ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-black dark:text-slate-300" />
                  Status: Pago
                </>
              ) : (
                <>
                  <TrendingUp className="w-3.5 h-3.5 text-black dark:text-emerald-400" />
                  Status: Entradas
                </>
              )}
            </span>
          </div>
        </div>

        {/* Resumo Financeiro com 3 KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          {/* KPI 1: Montante Financeiro Total */}
          <div
            className={`p-4 rounded-xl border ${
              isOverdue
                ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/40'
                : isToPay
                ? 'bg-blue-50/70 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-900/40'
                : isPaid
                ? 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                : 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-black dark:text-slate-200">
                {isOverdue
                  ? 'Total em Atraso'
                  : isToPay
                  ? 'Total a Vencer'
                  : isPaid
                  ? 'Total Quitado'
                  : 'Total Recebido'}
              </span>
              <DollarSign
                className={`w-4 h-4 ${
                  isOverdue
                    ? 'text-rose-600 dark:text-rose-400'
                    : isToPay
                    ? 'text-blue-600 dark:text-blue-400'
                    : isPaid
                    ? 'text-slate-700 dark:text-slate-300'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-black dark:text-white mt-1 tabular-nums">
              {formatBRL(totalAmount)}
            </div>
            <p className="text-[11px] text-black dark:text-slate-300 mt-1 font-medium">
              {isOverdue
                ? 'Montante consolidado com encargos e juros previstos'
                : isToPay
                ? 'Montante total de compromissos programados'
                : isPaid
                ? 'Montante consolidado de pagamentos e saídas realizadas'
                : 'Montante consolidado de receitas e entradas financeiras'}
            </p>
          </div>

          {/* KPI 2: Quantidade de Contas */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {isIncomes ? 'Quantidade de entradas' : 'Quantidade de contas'}
              </span>
              <Receipt className="w-4 h-4 text-slate-700" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900 mt-1 tabular-nums">
              {totalCount}
            </div>
            <p className="text-[11px] text-slate-700 mt-1 font-medium">
              {isOverdue
                ? `${totalCount === 1 ? '1 conta em atraso' : `${totalCount} contas em atraso`}`
                : isToPay
                ? `${totalCount === 1 ? '1 conta programada' : `${totalCount} contas programadas`}`
                : isPaid
                ? `${totalCount === 1 ? '1 pagamento realizado' : `${totalCount} pagamentos realizados`}`
                : `${totalCount === 1 ? '1 entrada confirmada' : `${totalCount} entradas confirmadas`}`}
            </p>
          </div>

          {/* KPI 3: Indicador Auxiliar */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 dark:border-slate-700/80 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {isOverdue
                  ? 'Juros Acumulados'
                  : isToPay
                  ? 'Próximos 7 Dias'
                  : 'Últimos 30 Dias'}
              </span>
              {isOverdue ? (
                <TrendingDown className="w-4 h-4 text-rose-500" />
              ) : isToPay ? (
                <Clock className="w-4 h-4 text-amber-500" />
              ) : isPaid ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              )}
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900 mt-1 tabular-nums">
              {isOverdue
                ? formatBRL(totalInterest)
                : isToPay
                ? formatBRL(totalNext7Days)
                : isPaid
                ? formatBRL(totalPaidLast30Days)
                : formatBRL(totalIncomesLast30Days)}
            </div>
            <p className="text-[11px] text-slate-700 mt-1 font-medium">
              {isOverdue
                ? 'Valor acumulado por dias de atraso'
                : isToPay
                ? `${next7DaysEntries.length} ${next7DaysEntries.length === 1 ? 'conta na próxima semana' : 'contas na próxima semana'}`
                : isPaid
                ? `${paidLast30DaysEntries.length} ${paidLast30DaysEntries.length === 1 ? 'pagamento recente' : 'pagamentos recentes'}`
                : `${incomesLast30DaysEntries.length} ${incomesLast30DaysEntries.length === 1 ? 'recebimento recente' : 'recebimentos recentes'}`}
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-black dark:text-slate-400" />
          <input
            type="text"
            placeholder={
              isIncomes
                ? 'Buscar por empresa, descrição ou data...'
                : 'Buscar por fornecedor, documento ou data...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-black dark:text-white placeholder:text-slate-500 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filtros rápidos */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setSubFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              subFilter === 'all'
                ? isOverdue
                  ? 'bg-rose-600 text-white shadow-xs'
                  : isToPay
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isPaid
                  ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-xs'
                  : 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-black dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            Todas ({targetEntries.length})
          </button>

          {isOverdue ? (
            <>
              <button
                type="button"
                onClick={() => setSubFilter('period1')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  subFilter === 'period1'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-black dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Até 30 dias ({countOverdueUpTo30Days})
              </button>
              <button
                type="button"
                onClick={() => setSubFilter('period2')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  subFilter === 'period2'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-black dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                + de 30 dias ({countOverdueMoreThan30Days})
              </button>
            </>
          ) : isToPay ? (
            <>
              <button
                type="button"
                onClick={() => setSubFilter('period1')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  subFilter === 'period1'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-black dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Hoje ({todayDueEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setSubFilter('period2')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  subFilter === 'period2'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-black dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Próximos 7 dias ({next7DaysEntries.length})
              </button>
            </>
          ) : isPaid ? (
            <>
              <button
                type="button"
                onClick={() => setSubFilter('period1')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  subFilter === 'period1'
                    ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-black dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Últimos 30 dias ({paidLast30DaysEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setSubFilter('period2')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  subFilter === 'period2'
                    ? 'bg-slate-900 dark:bg-slate-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-black dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Anteriores ({countPaidMoreThan30Days})
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSubFilter('period1')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  subFilter === 'period1'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-black dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Últimos 30 dias ({incomesLast30DaysEntries.length})
              </button>
              <button
                type="button"
                onClick={() => setSubFilter('period2')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  subFilter === 'period2'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-black dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Anteriores ({countIncomesMoreThan30Days})
              </button>
            </>
          )}

          {/* Nova opção: Personalizado 📅 */}
          <button
            type="button"
            id={`btn-filtro-personalizado-${type}`}
            onClick={handleOpenCustomDateModal}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
              subFilter === 'custom'
                ? isOverdue
                  ? 'bg-rose-600 text-white shadow-xs'
                  : isToPay
                  ? 'bg-blue-600 text-white shadow-xs'
                  : isPaid
                  ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-xs'
                  : 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-black dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <span>Personalizado 📅</span>
            {subFilter === 'custom' && (customStartDate || customEndDate) && (
              <span className="text-[10px] bg-black/20 dark:bg-white/20 px-1.5 py-0.2 rounded font-mono">
                {countCustom}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Indicador do Período Personalizado Ativo */}
      {subFilter === 'custom' && (customStartDate || customEndDate) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <div className="flex items-center gap-2">
            <Calendar
              className={`w-3.5 h-3.5 ${
                isOverdue
                  ? 'text-rose-500'
                  : isToPay
                  ? 'text-blue-500'
                  : isPaid
                  ? 'text-slate-600 dark:text-slate-400'
                  : 'text-emerald-500'
              }`}
            />
            <span className="text-slate-700 dark:text-slate-300">
              Período selecionado ({isOverdue || isToPay ? 'Vencimento' : isPaid ? 'Pagamento' : 'Recebimento'}):{' '}
              <strong className="font-bold text-black dark:text-white">
                {customStartDate ? parseBRDate(customStartDate) : 'Início'} até{' '}
                {customEndDate ? parseBRDate(customEndDate) : 'Fim'}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              id={`btn-alterar-periodo-${type}`}
              onClick={handleOpenCustomDateModal}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Alterar período
            </button>
            <button
              type="button"
              id={`btn-limpar-periodo-tag-${type}`}
              onClick={handleClearCustomFilter}
              className="text-[11px] font-bold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer inline-flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Limpar
            </button>
          </div>
        </div>
      )}

      {/* Grid de Cards dos Lançamentos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black uppercase tracking-wider text-black dark:text-white flex items-center gap-2">
            <Layers
              className={`w-4 h-4 ${
                isOverdue
                  ? 'text-rose-600 dark:text-rose-400'
                  : isToPay
                  ? 'text-blue-600 dark:text-blue-400'
                  : isPaid
                  ? 'text-slate-700 dark:text-slate-300'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            />
            <span>
              {isOverdue
                ? 'Contas em Atraso'
                : isToPay
                ? 'Contas Programadas a Vencer'
                : isPaid
                ? 'Contas e Saídas Pagas'
                : 'Receitas e Entradas Financeiras'}
            </span>
          </h2>
          <span className="text-xs text-black dark:text-slate-200 font-bold">
            Exibindo {filteredEntries.length} de {targetEntries.length} {isIncomes ? 'entradas' : 'contas'}
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/60">
            <div className="inline-flex p-3 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {targetEntries.length === 0
                ? isOverdue
                  ? 'Nenhuma conta atrasada no momento'
                  : isToPay
                  ? 'Nenhuma conta à vencer programada'
                  : isPaid
                  ? 'Nenhuma conta paga encontrada'
                  : 'Nenhuma entrada financeira encontrada'
                : 'Nenhum lançamento encontrado com o filtro aplicado'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              {targetEntries.length === 0
                ? isOverdue
                  ? 'Parabéns! Todos os compromissos financeiros estão rigorosamente em dia.'
                  : isToPay
                  ? 'Não há contas com status À Vencer cadastradas.'
                  : isPaid
                  ? 'Não há registros de compromissos quitados no momento.'
                  : 'Não há registros de receitas e recebimentos no momento.'
                : 'Tente alterar os termos da busca ou selecione outro filtro rápido.'}
            </p>
            {targetEntries.length === 0 && (
              <button
                type="button"
                onClick={onBack}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                Voltar para o Dashboard
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {filteredEntries.map((entry) => {
              const diffDays = getDaysDiff(entry.dueDate, todayStr);
              const daysOverdue = entry.daysOverdue || Math.abs(diffDays);
              const isToday = diffDays === 0;

              // 1. Fornecedor / Empresa: Nome real
              const fornecedorNome = entry.favorecidoName || (isIncomes ? 'Empresa não informada' : 'Fornecedor não informado');

              // 2. Documento: Tipo do documento com NF ou Descrição
              const tipoDocumento = entry.docType || 'Outros';
              const documentoTexto = isIncomes
                ? (entry.docType && entry.docType !== 'Outros'
                    ? `${entry.docType}${entry.nfNumber ? ` • ${entry.nfNumber}` : ''}`
                    : (entry.nfNumber || 'Recebimento operacional'))
                : entry.nfNumber
                ? `${tipoDocumento} • Nº ${entry.nfNumber}`
                : tipoDocumento;

              // 3. Data de vencimento ou pagamento
              const dataExibicao = isPaid && entry.paymentDate
                ? parseBRDate(entry.paymentDate)
                : entry.dueDate
                ? parseBRDate(entry.dueDate)
                : '-';

              const dataLabel = isPaid
                ? 'Data de Pagamento'
                : isIncomes
                ? 'Data de Recebimento'
                : 'Data de Vencimento';

              // 4. Valor: entry.totalWithInterest
              const valorFormatado = formatBRL(entry.totalWithInterest);

              // 5. Status text & badge
              let statusLabel = '';
              let badgeClasses = '';

              if (isOverdue) {
                statusLabel = `Atrasado (${daysOverdue} ${daysOverdue === 1 ? 'dia' : 'dias'})`;
                badgeClasses = 'bg-rose-100 text-black border-2 border-rose-300 dark:bg-rose-950/90 dark:text-rose-200 dark:border-rose-800';
              } else if (isToPay) {
                if (isToday) {
                  statusLabel = 'Vence hoje';
                  badgeClasses = 'bg-rose-100 text-black border-2 border-rose-300 dark:bg-rose-950/90 dark:text-rose-200 dark:border-rose-800 animate-pulse';
                } else if (diffDays === 1) {
                  statusLabel = 'Vence amanhã';
                  badgeClasses = 'bg-amber-100 text-black border-2 border-amber-300 dark:bg-amber-950/90 dark:text-amber-200 dark:border-amber-800';
                } else {
                  statusLabel = `Em ${diffDays} dias`;
                  badgeClasses = 'bg-blue-50 text-black border-2 border-blue-200 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-900/60';
                }
              } else if (isPaid) {
                statusLabel = 'Pago / Quitado';
                badgeClasses = 'bg-slate-200 text-black border-2 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';
              } else {
                statusLabel = 'Recebido';
                badgeClasses = 'bg-emerald-100 text-black border-2 border-emerald-300 dark:bg-emerald-950/90 dark:text-emerald-200 dark:border-emerald-800';
              }

              return (
                <div
                  key={entry.id}
                  className={`p-4 rounded-xl border transition-all hover:shadow-md bg-white dark:bg-slate-900 flex flex-col justify-between gap-3 ${
                    isOverdue
                      ? 'border-rose-200 dark:border-rose-900/60 hover:border-rose-300'
                      : isToPay && isToday
                      ? 'border-rose-300 dark:border-rose-900/60 shadow-xs shadow-rose-100/50 dark:shadow-none bg-gradient-to-br from-rose-50/20 via-white to-white dark:from-rose-950/10 dark:via-slate-900 dark:to-slate-900'
                      : isIncomes
                      ? 'border-emerald-200 dark:border-emerald-900/60 hover:border-emerald-300'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Topo do Card: Fornecedor e Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                          isOverdue
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                            : isToPay && isToday
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                            : isIncomes
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {isIncomes ? <TrendingUp className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-black dark:text-slate-300 block">
                          {isIncomes ? 'Empresa / Origem' : 'Fornecedor'}
                        </span>
                        <h3
                          className="font-black text-sm sm:text-base text-black dark:text-white truncate"
                          title={fornecedorNome}
                        >
                          {fornecedorNome}
                        </h3>
                      </div>
                    </div>

                    {/* Badge de Status */}
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 border ${badgeClasses}`}
                    >
                      {(isOverdue || (isToPay && isToday)) && (
                        <AlertCircle className="w-3 h-3 text-black dark:text-rose-300" />
                      )}
                      {isPaid && <CheckCircle2 className="w-3 h-3 text-black dark:text-slate-300" />}
                      {isIncomes && <TrendingUp className="w-3 h-3 text-black dark:text-emerald-300" />}
                      <span>{statusLabel}</span>
                    </span>
                  </div>

                  {/* Informações Centrais: Bloco Branco de Alto Contraste (Documento e Vencimento / Pagamento) */}
                  <div className="grid grid-cols-2 gap-2 py-2.5 px-3 rounded-lg bg-white border border-slate-300 text-xs shadow-2xs">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-black block">
                        {isIncomes ? 'Descrição' : 'Documento'}
                      </span>
                      <div className="flex items-center gap-1.5 text-black font-bold text-xs mt-0.5 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-black shrink-0" />
                        <span className="truncate text-black" title={documentoTexto}>
                          {documentoTexto}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-black block">
                        {dataLabel}
                      </span>
                      <div className="flex items-center gap-1.5 text-black font-bold text-xs mt-0.5 min-w-0">
                        <Calendar className="w-3.5 h-3.5 text-black shrink-0" />
                        <span className="truncate text-black">{dataExibicao}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé do Card: Valor */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-black dark:text-slate-300 block">
                        {isIncomes
                          ? 'Valor Recebido'
                          : isOverdue && entry.interestValue > 0
                          ? 'Valor com Juros'
                          : 'Valor'}
                      </span>
                      <span className="text-lg sm:text-xl font-black font-mono tracking-tight tabular-nums text-black dark:text-white">
                        {valorFormatado}
                      </span>
                    </div>

                    {isOverdue ? (
                      entry.interestValue > 0 ? (
                        <span className="text-[11px] font-bold text-black dark:text-rose-300">
                          + {formatBRL(entry.interestValue)} juros
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-black dark:text-slate-300">
                          Sem juros adicionais
                        </span>
                      )
                    ) : isToPay ? (
                      diffDays > 0 && (
                        <span className="text-[11px] font-bold text-black dark:text-blue-300">
                          {diffDays === 1 ? 'Vence amanhã' : `Vence em ${diffDays} dias`}
                        </span>
                      )
                    ) : isPaid ? (
                      entry.interestValue > 0 ? (
                        <span className="text-[11px] font-bold text-black dark:text-slate-300">
                          + {formatBRL(entry.interestValue)} juros pagos
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-black dark:text-slate-300">
                          Liquidado integralmente
                        </span>
                      )
                    ) : (
                      <span className="text-[11px] font-bold text-black dark:text-emerald-300">
                        Entrada confirmada
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Período Personalizado */}
      {isCustomDateModalOpen && (
        <div
          id="modal-periodo-personalizado-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto"
          onClick={handleCloseCustomDateModal}
        >
          <div
            id="modal-periodo-personalizado-box"
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-lg ${
                    isOverdue
                      ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400'
                      : isToPay
                      ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400'
                      : isPaid
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Personalizado 📅
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isOverdue
                      ? 'Filtrar por data de vencimento'
                      : isToPay
                      ? 'Filtrar por data de vencimento'
                      : isPaid
                      ? 'Filtrar por data do pagamento'
                      : 'Filtrar por data do recebimento'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                id="btn-fechar-modal-periodo"
                onClick={handleCloseCustomDateModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="custom-start-date"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Data inicial
                  </label>
                  <input
                    type="date"
                    id="custom-start-date"
                    value={tempStartDate}
                    onChange={(e) => setTempStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="custom-end-date"
                    className="block text-xs font-bold text-slate-700 dark:text-slate-300"
                  >
                    Data final
                  </label>
                  <input
                    type="date"
                    id="custom-end-date"
                    value={tempEndDate}
                    onChange={(e) => setTempEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Informação do Critério */}
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                <span>
                  Critério de data:{' '}
                  <strong className="text-slate-900 dark:text-white font-semibold">
                    {isOverdue || isToPay
                      ? 'Data de Vencimento'
                      : isPaid
                      ? 'Data do Pagamento'
                      : 'Data do Recebimento'}
                  </strong>
                  . Os lançamentos fora do período escolhido não serão exibidos.
                </span>
              </div>
            </div>

            {/* Rodapé de Ações */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <div>
                {(customStartDate || customEndDate || subFilter === 'custom') && (
                  <button
                    type="button"
                    id="btn-limpar-periodo-modal"
                    onClick={handleClearCustomFilter}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    Limpar filtro
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-cancelar-modal-periodo"
                  onClick={handleCloseCustomDateModal}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer border border-slate-300 dark:border-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  id="btn-confirmar-modal-periodo"
                  onClick={handleConfirmCustomDateModal}
                  className={`px-4 py-1.5 text-xs font-bold text-white rounded-lg transition-all cursor-pointer shadow-xs ${
                    isOverdue
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : isToPay
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : isPaid
                      ? 'bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

