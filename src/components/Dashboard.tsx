import React, { useState, useMemo, useEffect } from 'react';
import { CalculatedEntry, EntitySummary, Supplier, Employee, IncomeEntry } from '../types';
import { formatBRL, calculateSummaries, MONTHS_PT, getMonthYearFromDateStr, parseBRDate, getTodayDateString } from '../utils/calculations';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  UserCheck,
  RotateCcw,
  BarChart3,
  TrendingUp,
  Award,
  Building2,
  Receipt,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  ShieldAlert,
  Percent,
  Clock,
  ArrowRight,
  FileText,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Cell,
  LabelList,
} from 'recharts';

interface DashboardProps {
  entries: CalculatedEntry[];
  suppliers: Supplier[];
  employees: Employee[];
  incomes?: IncomeEntry[];
  onViewUpcomingDetails?: () => void;
  onViewOverdueDetails?: () => void;
  onViewToPayDetails?: () => void;
  onViewPaidDetails?: () => void;
  onViewIncomesDetails?: () => void;
}

const STORAGE_KEY_MODE = 'contas_pagar_period_mode'; // 'MONTH' | 'ALL'
const STORAGE_KEY_MONTH = 'contas_pagar_period_month'; // e.g. 8
const STORAGE_KEY_YEAR = 'contas_pagar_period_year'; // e.g. 2026

export const Dashboard: React.FC<DashboardProps> = ({
  entries,
  suppliers,
  employees,
  incomes = [],
  onViewUpcomingDetails,
  onViewOverdueDetails,
  onViewToPayDetails,
  onViewPaidDetails,
  onViewIncomesDetails,
}) => {
  // Current real date defaults
  const today = new Date();
  const currentMonthNum = today.getMonth() + 1; // 1-12
  const currentYearNum = today.getFullYear(); // e.g. 2026

  // 1. Initial State from URL params or localStorage or defaults
  const [filterMode, setFilterMode] = useState<'MONTH' | 'ALL'>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const monthParam = urlParams.get('month');
    if (monthParam === 'ALL') return 'ALL';
    const savedMode = localStorage.getItem(STORAGE_KEY_MODE);
    if (savedMode === 'ALL') return 'ALL';
    return 'MONTH';
  });

  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const m = urlParams.get('month');
    if (m && m !== 'ALL') {
      const parsed = parseInt(m, 10);
      if (parsed >= 1 && parsed <= 12) return parsed;
    }
    const saved = localStorage.getItem(STORAGE_KEY_MONTH);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (parsed >= 1 && parsed <= 12) return parsed;
    }
    // Default to current month or August (8) if in 2026
    return currentMonthNum;
  });

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const y = urlParams.get('year');
    if (y) {
      const parsed = parseInt(y, 10);
      if (parsed >= 2020 && parsed <= 2030) return parsed;
    }
    const saved = localStorage.getItem(STORAGE_KEY_YEAR);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (parsed >= 2020 && parsed <= 2030) return parsed;
    }
    return currentYearNum;
  });

  // Sync state changes to localStorage and URL search params
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MODE, filterMode);
    localStorage.setItem(STORAGE_KEY_MONTH, String(selectedMonth));
    localStorage.setItem(STORAGE_KEY_YEAR, String(selectedYear));

    const url = new URL(window.location.href);
    if (filterMode === 'ALL') {
      url.searchParams.set('month', 'ALL');
      url.searchParams.delete('year');
    } else {
      url.searchParams.set('month', String(selectedMonth).padStart(2, '0'));
      url.searchParams.set('year', String(selectedYear));
    }
    window.history.replaceState({}, '', url.toString());
  }, [filterMode, selectedMonth, selectedYear]);

  // Handle Month Shortcut Actions
  const handleSelectCurrentMonth = () => {
    setFilterMode('MONTH');
    setSelectedMonth(currentMonthNum);
    setSelectedYear(currentYearNum);
  };

  const handleResetToAll = () => {
    setFilterMode('ALL');
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterMode('MONTH');
    setSelectedMonth(parseInt(e.target.value, 10));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterMode('MONTH');
    setSelectedYear(parseInt(e.target.value, 10));
  };

  // Label for active period scope
  const monthName = MONTHS_PT.find((m) => m.value === selectedMonth)?.label || 'Agosto';
  const periodLabel = filterMode === 'ALL' ? 'Todos os Períodos' : `${monthName}/${selectedYear}`;

  // 2. Filter Entries by Selected Month/Year
  // helper to check if a YYYY-MM-DD date falls in selected month & year
  const isDateInSelectedPeriod = (dateStr: string | undefined): boolean => {
    if (!dateStr) return false;
    const parts = getMonthYearFromDateStr(dateStr);
    if (!parts) return false;
    return parts.month === selectedMonth && parts.year === selectedYear;
  };

  // Filtered subset for Supplier/Employee Summary Table
  const filteredEntriesForPeriod = useMemo(() => {
    if (filterMode === 'ALL') return entries;

    return entries.filter((e) => {
      // Check if due date is in selected period
      const isDueInPeriod = isDateInSelectedPeriod(e.dueDate);
      
      // Check if payment date is in selected period (if paid)
      const isPaidInPeriod = e.status === 'Pago' && e.paymentDate && isDateInSelectedPeriod(e.paymentDate);

      return isDueInPeriod || isPaidInPeriod;
    });
  }, [entries, filterMode, selectedMonth, selectedYear]);

  // 3. Dynamic Summary Cards Calculations
  // Card 1 - Total Atrasado
  const totalOverdue = useMemo(() => {
    return entries
      .filter((e) => {
        if (e.status !== 'Atrasado') return false;
        if (filterMode === 'ALL') return true;
        return isDateInSelectedPeriod(e.dueDate);
      })
      .reduce((sum, e) => sum + e.totalWithInterest, 0);
  }, [entries, filterMode, selectedMonth, selectedYear]);

  const countOverdue = useMemo(() => {
    return entries.filter((e) => {
      if (e.status !== 'Atrasado') return false;
      if (filterMode === 'ALL') return true;
      return isDateInSelectedPeriod(e.dueDate);
    }).length;
  }, [entries, filterMode, selectedMonth, selectedYear]);

  // Card 2 - Total À Vencer
  const totalToPay = useMemo(() => {
    return entries
      .filter((e) => {
        if (e.status !== 'À Vencer') return false;
        if (filterMode === 'ALL') return true;
        return isDateInSelectedPeriod(e.dueDate);
      })
      .reduce((sum, e) => sum + e.totalWithInterest, 0);
  }, [entries, filterMode, selectedMonth, selectedYear]);

  const countToPay = useMemo(() => {
    return entries.filter((e) => {
      if (e.status !== 'À Vencer') return false;
      if (filterMode === 'ALL') return true;
      return isDateInSelectedPeriod(e.dueDate);
    }).length;
  }, [entries, filterMode, selectedMonth, selectedYear]);

  // Card 3 - Total Pago
  // "Filtra lançamentos onde: Mês/Ano do Pagamento = mês selecionado E Status = 'Pago'"
  const totalPaid = useMemo(() => {
    return entries
      .filter((e) => {
        if (e.status !== 'Pago') return false;
        if (filterMode === 'ALL') return true;
        // If paymentDate is present, check paymentDate month & year; otherwise check dueDate
        if (e.paymentDate && e.paymentDate.trim() !== '') {
          return isDateInSelectedPeriod(e.paymentDate);
        }
        return isDateInSelectedPeriod(e.dueDate);
      })
      .reduce((sum, e) => sum + e.totalWithInterest, 0);
  }, [entries, filterMode, selectedMonth, selectedYear]);

  const countPaid = useMemo(() => {
    return entries.filter((e) => {
      if (e.status !== 'Pago') return false;
      if (filterMode === 'ALL') return true;
      if (e.paymentDate && e.paymentDate.trim() !== '') {
        return isDateInSelectedPeriod(e.paymentDate);
      }
      return isDateInSelectedPeriod(e.dueDate);
    }).length;
  }, [entries, filterMode, selectedMonth, selectedYear]);

  // Card 4 - Total Geral
  // "Filtra lançamentos onde: Mês/Ano do Vencimento = mês selecionado (TODOS os status)"
  const totalGeneral = useMemo(() => {
    return entries
      .filter((e) => {
        if (filterMode === 'ALL') return true;
        return isDateInSelectedPeriod(e.dueDate);
      })
      .reduce((sum, e) => sum + e.totalWithInterest, 0);
  }, [entries, filterMode, selectedMonth, selectedYear]);

  const countGeneral = useMemo(() => {
    return entries.filter((e) => {
      if (filterMode === 'ALL') return true;
      return isDateInSelectedPeriod(e.dueDate);
    }).length;
  }, [entries, filterMode, selectedMonth, selectedYear]);

  // Card 5 - Total Entradas (Receitas)
  const filteredIncomesForPeriod = useMemo(() => {
    if (filterMode === 'ALL') return incomes;
    return incomes.filter((inc) => isDateInSelectedPeriod(inc.date));
  }, [incomes, filterMode, selectedMonth, selectedYear]);

  const totalIncomesPeriod = useMemo(() => {
    return filteredIncomesForPeriod.reduce((sum, inc) => sum + inc.value, 0);
  }, [filteredIncomesForPeriod]);

  const countIncomesPeriod = useMemo(() => {
    return filteredIncomesForPeriod.length;
  }, [filteredIncomesForPeriod]);

  // Saldo Líquido Operacional do Período: Entradas - Despesas Pagas
  const netBalancePeriod = useMemo(() => {
    return totalIncomesPeriod - totalPaid;
  }, [totalIncomesPeriod, totalPaid]);

  // 4. Bloco Executivo de Saúde Financeira
  const futureCommitments = useMemo(() => {
    return totalToPay + totalOverdue;
  }, [totalToPay, totalOverdue]);

  const coverageRatio = useMemo(() => {
    if (futureCommitments <= 0) {
      return 1;
    }

    const availableBalance = Math.max(netBalancePeriod, 0);
    return availableBalance / futureCommitments;
  }, [netBalancePeriod, futureCommitments]);

  const coverageGap = useMemo(() => {
    const availableBalance = Math.max(netBalancePeriod, 0);
    return Math.max(futureCommitments - availableBalance, 0);
  }, [futureCommitments, netBalancePeriod]);

  const financialHealth = useMemo(() => {
    // Caso 1: Sem compromissos pendentes no período
    if (futureCommitments === 0) {
      if (netBalancePeriod >= 0) {
        return {
          status: 'Saudável' as const,
          color: 'emerald',
          badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800',
          cardBg: 'bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/20 dark:from-emerald-950/20 dark:via-slate-900 dark:to-teal-950/10 border-emerald-300/80 dark:border-emerald-800/80',
          verdict: 'Situação financeira saudável. O saldo operacional cobre os compromissos pendentes com margem superior a 20% e não existem contas em atraso.',
        };
      } else {
        return {
          status: 'Atenção' as const,
          color: 'amber',
          badgeBg: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800',
          cardBg: 'bg-gradient-to-br from-amber-50/40 via-white to-yellow-50/20 dark:from-amber-950/20 dark:via-slate-900 dark:to-yellow-950/10 border-amber-300/80 dark:border-amber-800/80',
          verdict: 'Atenção: não há compromissos pendentes em aberto, porém o período registrou déficit operacional.',
        };
      }
    }

    // Caso 2: Saudável (cobertura >= 120%, saldo operacional >= 0 e sem contas em atraso)
    if (coverageRatio >= 1.2 && netBalancePeriod >= 0 && totalOverdue === 0) {
      return {
        status: 'Saudável' as const,
        color: 'emerald',
        badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800',
        cardBg: 'bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/20 dark:from-emerald-950/20 dark:via-slate-900 dark:to-teal-950/10 border-emerald-300/80 dark:border-emerald-800/80',
        verdict: 'Situação financeira saudável. O saldo operacional cobre os compromissos pendentes com margem superior a 20% e não existem contas em atraso.',
      };
    }

    // Caso 3: Atenção (cobertura >= 100% e < 120%, OU cobertura >= 100% com contas em atraso)
    if (coverageRatio >= 1) {
      return {
        status: 'Atenção' as const,
        color: 'amber',
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800',
        cardBg: 'bg-gradient-to-br from-amber-50/40 via-white to-yellow-50/20 dark:from-amber-950/20 dark:via-slate-900 dark:to-yellow-950/10 border-amber-300/80 dark:border-amber-800/80',
        verdict: totalOverdue > 0
          ? 'Atenção: há contas em atraso, embora o saldo operacional seja suficiente para cobrir os compromissos pendentes. Recomenda-se regularizar as pendências.'
          : 'Atenção: o saldo operacional cobre os compromissos pendentes, porém com margem inferior a 20%.',
      };
    }

    // Caso 4: Risco (coverageRatio < 1)
    return {
      status: 'Risco' as const,
      color: 'rose',
      badgeBg: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800',
      cardBg: 'bg-gradient-to-br from-rose-50/40 via-white to-red-50/20 dark:from-rose-950/20 dark:via-slate-900 dark:to-red-950/10 border-rose-300/80 dark:border-rose-800/80',
      verdict: 'Alerta de risco financeiro: o saldo operacional disponível é insuficiente para cobrir as contas atrasadas e a vencer.',
    };
  }, [futureCommitments, coverageRatio, netBalancePeriod, totalOverdue]);

  // Indicador Financeiro: "Vencimentos Próximos 7 Dias"
  // Regras:
  // - Calcular automaticamente considerando a data atual até +7 dias.
  // - Considerar somente lançamentos com status "À Vencer".
  // - Somar os valores das contas dentro desse período.
  // - Ordenação: 1º vencimento mais próximo; 2º maior valor.
  const todayStr = useMemo(() => getTodayDateString(), []);

  const maxDueDateStr = useMemo(() => {
    const [y, m, d] = todayStr.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d + 7);
    const y7 = targetDate.getFullYear();
    const m7 = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d7 = String(targetDate.getDate()).padStart(2, '0');
    return `${y7}-${m7}-${d7}`;
  }, [todayStr]);

  const upcoming7DaysEntries = useMemo(() => {
    return entries
      .filter((e) => {
        if (e.status !== 'À Vencer') return false;
        return e.dueDate >= todayStr && e.dueDate <= maxDueDateStr;
      })
      .sort((a, b) => {
        // Primeiro vencimento mais próximo (ordem cronológica crescente)
        if (a.dueDate !== b.dueDate) {
          return a.dueDate.localeCompare(b.dueDate);
        }
        // Depois maior valor (ordem decrescente de montante)
        return (b.totalWithInterest || 0) - (a.totalWithInterest || 0);
      });
  }, [entries, todayStr, maxDueDateStr]);

  const totalUpcoming7Days = useMemo(() => {
    return upcoming7DaysEntries.reduce((sum, e) => sum + (e.totalWithInterest || 0), 0);
  }, [upcoming7DaysEntries]);

  const countUpcoming7Days = upcoming7DaysEntries.length;

  const getDaysUntilDue = (dueDateStr: string, fromDateStr: string): number => {
    const [y1, m1, d1] = fromDateStr.split('-').map(Number);
    const [y2, m2, d2] = dueDateStr.split('-').map(Number);
    const date1 = new Date(y1, m1 - 1, d1).getTime();
    const date2 = new Date(y2, m2 - 1, d2).getTime();
    const diffTime = date2 - date1;
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  };

  // Resumo de entidades (utilizado no gráfico Top 5 Favorecidos)
  const entitySummaries = useMemo(() => {
    return calculateSummaries(filteredEntriesForPeriod, suppliers, employees);
  }, [filteredEntriesForPeriod, suppliers, employees]);

  // 5. Chart Data Calculations

  // CHART 1: Evolução por Mês (últimos 6 meses) - Com Entradas e Saídas
  const chartEvolucaoData = useMemo(() => {
    const endYear = filterMode === 'ALL' ? currentYearNum : selectedYear;
    const endMonth = filterMode === 'ALL' ? currentMonthNum : selectedMonth;

    const result = [];
    for (let i = 5; i >= 0; i--) {
      let m = endMonth - i;
      let y = endYear;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }

      const mInfo = MONTHS_PT.find((item) => item.value === m);
      const labelShort = mInfo ? `${mInfo.short}/${String(y).slice(-2)}` : `${m}/${y}`;

      // Filter entries for month m and year y
      let overdueSum = 0;
      let toPaySum = 0;
      let paidSum = 0;
      let incomeSum = 0;

      entries.forEach((e) => {
        const dueParts = getMonthYearFromDateStr(e.dueDate);
        const isDueThisMonth = dueParts && dueParts.month === m && dueParts.year === y;

        if (e.status === 'Atrasado' && isDueThisMonth) {
          overdueSum += e.totalWithInterest;
        } else if (e.status === 'À Vencer' && isDueThisMonth) {
          toPaySum += e.totalWithInterest;
        } else if (e.status === 'Pago') {
          const payDateStr = e.paymentDate && e.paymentDate.trim() !== '' ? e.paymentDate : e.dueDate;
          const payParts = getMonthYearFromDateStr(payDateStr);
          if (payParts && payParts.month === m && payParts.year === y) {
            paidSum += e.totalWithInterest;
          }
        }
      });

      incomes.forEach((inc) => {
        const incParts = getMonthYearFromDateStr(inc.date);
        if (incParts && incParts.month === m && incParts.year === y) {
          incomeSum += inc.value;
        }
      });

      result.push({
        monthLabel: labelShort,
        'Entradas (Receitas)': Math.round(incomeSum * 100) / 100,
        'Total Pago (Despesas)': Math.round(paidSum * 100) / 100,
        'Total Atrasado': Math.round(overdueSum * 100) / 100,
        'Total À Vencer': Math.round(toPaySum * 100) / 100,
      });
    }

    return result;
  }, [entries, incomes, filterMode, selectedMonth, selectedYear, currentMonthNum, currentYearNum]);

  // CHART 2: Valor Gasto com os Funcionários
  const chartEmployeeExpensesData = useMemo(() => {
    const empEntries = filteredEntriesForPeriod.filter((e) => e.favorecidoType === 'Funcionário');

    const empMap: Record<string, { name: string; paid: number; pending: number; total: number }> = {};

    empEntries.forEach((e) => {
      const name = e.favorecidoName || 'Outro Funcionário';
      if (!empMap[name]) {
        empMap[name] = { name, paid: 0, pending: 0, total: 0 };
      }
      if (e.status === 'Pago') {
        empMap[name].paid += e.totalWithInterest;
      } else {
        empMap[name].pending += e.totalWithInterest;
      }
      empMap[name].total += e.totalWithInterest;
    });

    return Object.values(empMap)
      .map((item) => ({
        name: item.name,
        'Pago': Math.round(item.paid * 100) / 100,
        'Pendente': Math.round(item.pending * 100) / 100,
        total: Math.round(item.total * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filteredEntriesForPeriod]);

  const totalEmployeeExpense = useMemo(() => {
    return chartEmployeeExpensesData.reduce((acc, item) => acc + item.total, 0);
  }, [chartEmployeeExpensesData]);

  // CHART 3: Top 5 Fornecedores / Funcionários
  const chartTopEntitiesData = useMemo(() => {
    const sorted = [...entitySummaries]
      .filter((item) => item.valuePaid + item.balanceDue > 0)
      .sort((a, b) => (b.valuePaid + b.balanceDue) - (a.valuePaid + a.balanceDue))
      .slice(0, 5);

    return sorted.map((item) => ({
      name: item.name,
      type: item.type,
      total: Math.round((item.valuePaid + item.balanceDue) * 100) / 100,
      balanceDue: Math.round(item.balanceDue * 100) / 100,
      valuePaid: Math.round(item.valuePaid * 100) / 100,
    }));
  }, [entitySummaries]);

  // CHART 4: Entradas por Empresa (Volume de Receita no Período)
  const chartIncomesByCompanyData = useMemo(() => {
    const companyMap: Record<string, { companyName: string; total: number; count: number }> = {};

    filteredIncomesForPeriod.forEach((inc) => {
      const comp = inc.companyName.trim() || 'Outra Empresa';
      if (!companyMap[comp]) {
        companyMap[comp] = { companyName: comp, total: 0, count: 0 };
      }
      companyMap[comp].total += inc.value;
      companyMap[comp].count += 1;
    });

    return Object.values(companyMap)
      .map((item) => ({
        companyName: item.companyName,
        total: Math.round(item.total * 100) / 100,
        count: item.count,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [filteredIncomesForPeriod]);

  // Year choices for dropdown
  const yearOptions = [2023, 2024, 2025, 2026, 2027, 2028, 2029];

  // Helper para formatar valores grandes com abreviação executiva: R$ 90.668,46 -> R$ 90,6 mil
  const formatCompactBRL = (val: number): string => {
    if (!val || isNaN(val) || val <= 0) return 'R$ 0';
    const absVal = Math.abs(val);

    if (absVal >= 1_000_000) {
      const truncated = Math.floor((absVal / 1_000_000) * 10) / 10;
      const formatted = truncated.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      return `R$ ${formatted} mi`;
    }
    if (absVal >= 1_000) {
      const truncated = Math.floor((absVal / 1_000) * 10) / 10;
      const formatted = truncated.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      return `R$ ${formatted} mil`;
    }
    return `R$ ${absVal.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  };

  // Helper para renderizar labels fixos inclinados (-40°) conectados a cada barra no gráfico "Fluxo Financeiro Mensal"
  // Requisitos:
  // - Labels inclinados acompanhando cada barra (rotação aproximada de -35°/-45°)
  // - Conexão visual com a barra correspondente (haste de ancoragem vertical e ponto de fixação)
  // - Formato: R$ XX,X mil • CATEGORIA (valor em destaque, categoria em escala menor)
  // - Para barras pequenas, mantém o posicionamento externo tradicional acima da barra
  // - Elimina qualquer colisão entre séries do mesmo mês através do paralelismo angular
  const renderMonthlyBarLabel = (
    category: string,
    _barIndex: number,
    lightColor: string,
    valColorClass: string
  ) => {
    return (props: {
      x?: number | string;
      y?: number | string;
      width?: number | string;
      value?: unknown;
    }) => {
      const { x = 0, y = 0, width = 0, value } = props;
      const num = Number(value);
      if (!num || isNaN(num) || num <= 0) return null;

      const centerX = Number(x) + Number(width) / 2;
      const topY = Number(y);

      return (
        <g className="pointer-events-none select-none">
          {/* Haste de conexão visual conectando o topo da barra ao label */}
          <line
            x1={centerX}
            y1={topY}
            x2={centerX}
            y2={topY - 6}
            stroke={lightColor}
            strokeWidth={1.5}
            strokeLinecap="round"
            opacity={0.65}
          />
          <circle
            cx={centerX}
            cy={topY}
            r={1.5}
            fill={lightColor}
            opacity={0.8}
          />

          {/* Label rotacionado a -40° acompanhando a barra correspondente */}
          <g transform={`translate(${centerX}, ${topY - 8}) rotate(-40)`}>
            <text
              x={0}
              y={0}
              textAnchor="start"
              dominantBaseline="central"
            >
              {/* Valor em destaque */}
              <tspan
                fill={lightColor}
                className={`font-black font-mono tracking-tight ${valColorClass}`}
                fontSize={9}
                fontWeight="800"
              >
                {formatCompactBRL(num)}
              </tspan>
              {/* Separador elegante */}
              <tspan
                fill="#94a3b8"
                className="fill-slate-400 dark:fill-slate-500 font-medium"
                fontSize={7.5}
              >
                {' • '}
              </tspan>
              {/* Categoria em tamanho menor */}
              <tspan
                fill="#475569"
                className="fill-slate-600 dark:fill-slate-300 font-bold uppercase tracking-wider"
                fontSize={7.5}
                fontWeight="700"
                fontFamily="sans-serif"
              >
                {category.toUpperCase()}
              </tspan>
            </text>
          </g>
        </g>
      );
    };
  };

  return (
    <div className="space-y-4">
      {/* 1. SELETOR DE MÊS / ANO & PERIOD INDICATOR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Controls Group */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <span className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Período:
            </span>

            {/* Dropdown 1: Mês */}
            <div className="flex items-center gap-1">
              <select
                value={filterMode === 'ALL' ? '' : selectedMonth}
                onChange={handleMonthChange}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none h-7.5"
              >
                {filterMode === 'ALL' && <option value="">Selecione o Mês</option>}
                {MONTHS_PT.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Dropdown 2: Ano */}
            <div className="flex items-center gap-1">
              <select
                value={filterMode === 'ALL' ? '' : selectedYear}
                onChange={handleYearChange}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs font-semibold text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none h-7.5 font-mono"
              >
                {filterMode === 'ALL' && <option value="">Ano</option>}
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Shortcut Button 1: Mês Atual */}
            <button
              onClick={handleSelectCurrentMonth}
              className={`px-3 py-1 rounded text-xs font-bold transition-all h-7.5 flex items-center gap-1 ${
                filterMode === 'MONTH' && selectedMonth === currentMonthNum && selectedYear === currentYearNum
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
              title="Ir para o mês/ano atual"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              <span>Mês Atual</span>
            </button>

            {/* Shortcut Button 2: Resetar para Todos os Períodos */}
            <button
              onClick={handleResetToAll}
              className={`px-3 py-1 rounded text-xs font-bold transition-all h-7.5 flex items-center gap-1.5 ${
                filterMode === 'ALL'
                  ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
              title="Exibir dados consolidados de todos os meses e anos"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Resetar para Todos os Períodos</span>
            </button>
          </div>

          {/* INDICADOR DO PERÍODO FILTRADO */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Filtro ativo:</span>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs font-extrabold tracking-tight">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              Exibindo: <span className="font-mono">{periodLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CARDS DE RESUMO - DINÂMICOS POR MÊS (DESPESAS + ENTRADAS + SALDO) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {/* Card 1 - Total Atrasado */}
        <div className="p-3 rounded-lg border bg-rose-50 border-rose-200 text-black dark:bg-rose-950/70 dark:border-rose-900/80 dark:text-rose-100 shadow-2xs flex flex-col justify-between transition-all hover:border-rose-300">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-black dark:text-rose-300">
                <span>Total Atrasado</span>
              </div>
              <div className="text-lg font-extrabold tracking-tight font-mono tabular-nums text-black dark:text-rose-100">
                {formatBRL(totalOverdue)}
              </div>
              <p className="text-[10px] font-bold text-black dark:text-rose-300">
                {countOverdue} {countOverdue === 1 ? 'pendência' : 'pendências'}
              </p>
            </div>
            <div className="p-2 rounded-md bg-rose-200/80 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200 text-sm font-bold">
              ⚠️
            </div>
          </div>
          <div className="pt-2 mt-2 border-t border-rose-200/80 dark:border-rose-900/60 flex items-center justify-end">
            <button
              type="button"
              id="btn-ver-detalhes-total-atrasado"
              onClick={() => {
                if (onViewOverdueDetails) {
                  onViewOverdueDetails();
                }
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-black hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-200 transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-rose-100/80 dark:hover:bg-rose-900/50"
            >
              Exibir detalhes
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 2 - Total À Vencer */}
        <div className="p-3 rounded-lg border bg-blue-50 border-blue-200 text-black dark:bg-blue-950/70 dark:border-blue-900/80 dark:text-blue-100 shadow-2xs flex flex-col justify-between transition-all hover:border-blue-300">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-black dark:text-blue-300">
                <span>Total À Vencer</span>
              </div>
              <div className="text-lg font-extrabold tracking-tight font-mono tabular-nums text-black dark:text-blue-100">
                {formatBRL(totalToPay)}
              </div>
              <p className="text-[10px] font-bold text-black dark:text-blue-300">
                {countToPay} {countToPay === 1 ? 'a pagar' : 'a pagar'}
              </p>
            </div>
            <div className="p-2 rounded-md bg-blue-200/80 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200 text-sm font-bold">
              📅
            </div>
          </div>
          <div className="pt-2 mt-2 border-t border-blue-200/80 dark:border-blue-900/60 flex items-center justify-end">
            <button
              type="button"
              id="btn-ver-detalhes-total-a-vencer"
              onClick={() => {
                if (onViewToPayDetails) {
                  onViewToPayDetails();
                }
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-black hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200 transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-blue-100/80 dark:hover:bg-blue-900/50"
            >
              Exibir detalhes
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 3 - Total Pago (Saídas) */}
        <div className="p-3 rounded-lg border bg-slate-100 border-slate-200 text-slate-900 dark:bg-slate-800/90 dark:border-slate-700 dark:text-slate-100 shadow-2xs flex flex-col justify-between transition-all hover:border-slate-300">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <span>Total Pago (Saídas)</span>
              </div>
              <div className="text-lg font-extrabold tracking-tight font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {formatBRL(totalPaid)}
              </div>
              <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400">
                {countPaid} {countPaid === 1 ? 'liquidado' : 'liquidados'}
              </p>
            </div>
            <div className="p-2 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold">
              💸
            </div>
          </div>
          <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end">
            <button
              type="button"
              id="btn-ver-detalhes-total-pago"
              onClick={() => {
                if (onViewPaidDetails) {
                  onViewPaidDetails();
                }
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-slate-200/80 dark:hover:bg-slate-700/50"
            >
              Exibir detalhes
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 4 - Total Entradas (Receitas) */}
        <div className="p-3 rounded-lg border-2 bg-emerald-50 border-emerald-500/60 text-emerald-950 dark:bg-emerald-950/70 dark:border-emerald-700/80 dark:text-emerald-100 shadow-2xs flex flex-col justify-between transition-all hover:border-emerald-500">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                <TrendingUp className="w-3 h-3 text-emerald-600" />
                <span>Total Entradas</span>
              </div>
              <div className="text-lg font-extrabold tracking-tight font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                {formatBRL(totalIncomesPeriod)}
              </div>
              <p className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                {countIncomesPeriod} {countIncomesPeriod === 1 ? 'recebimento' : 'recebimentos'}
              </p>
            </div>
            <div className="p-2 rounded-md bg-emerald-200/90 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 text-sm font-bold shadow-2xs">
              💰
            </div>
          </div>
          <div className="pt-2 mt-2 border-t border-emerald-200 dark:border-emerald-800 flex items-center justify-end">
            <button
              type="button"
              id="btn-ver-detalhes-total-entradas"
              onClick={() => {
                if (onViewIncomesDetails) {
                  onViewIncomesDetails();
                }
              }}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-emerald-200 transition-colors cursor-pointer py-0.5 px-1.5 rounded hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50"
            >
              Exibir detalhes
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 5 - Saldo Líquido Operacional (Entradas - Saídas Pagas) */}
        <div
          className={`p-3 rounded-lg border flex items-center justify-between transition-all shadow-2xs ${
            netBalancePeriod >= 0
              ? 'bg-teal-50 border-teal-200 text-teal-950 dark:bg-teal-950/70 dark:border-teal-900/80 dark:text-teal-100'
              : 'bg-amber-50 border-amber-200 text-amber-950 dark:bg-amber-950/70 dark:border-amber-900/80 dark:text-amber-100'
          }`}
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              <Wallet className="w-3 h-3" />
              <span>Saldo Operacional</span>
            </div>
            <div
              className={`text-lg font-extrabold tracking-tight font-mono tabular-nums ${
                netBalancePeriod >= 0
                  ? 'text-teal-700 dark:text-teal-300'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {formatBRL(netBalancePeriod)}
            </div>
            <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-0.5">
              {netBalancePeriod >= 0 ? (
                <>
                  <ArrowUpRight className="w-3 h-3 text-teal-600" />
                  <span className="text-teal-700 dark:text-teal-300 font-semibold">Saldo operacional positivo</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-3 h-3 text-amber-600" />
                  <span className="text-amber-700 dark:text-amber-300 font-semibold">Saldo operacional negativo</span>
                </>
              )}
            </p>
          </div>
          <div
            className={`p-2 rounded-md text-sm font-bold ${
              netBalancePeriod >= 0
                ? 'bg-teal-200/80 dark:bg-teal-900 text-teal-900 dark:text-teal-100'
                : 'bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-100'
            }`}
          >
            {netBalancePeriod >= 0 ? '📊' : '⚖️'}
          </div>
        </div>
      </div>

      {/* 2.1 PAINEL DE RÁPIDA VISUALIZAÇÃO DE ENTRADAS (RECEITAS) */}
      <div className="bg-white dark:bg-slate-900 border border-emerald-300/80 dark:border-emerald-800/80 rounded-lg shadow-2xs overflow-hidden">
        <div className="p-2.5 sm:p-3 border-b border-emerald-200 dark:border-emerald-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50/60 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-emerald-600 text-white">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-xs font-extrabold text-emerald-950 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-2">
                Rápida Visualização de Entradas (Receitas) - {periodLabel}
              </h2>
              <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                Lançamentos de entrada informados com reflexo imediato no fluxo de caixa ({filteredIncomesForPeriod.length} registros).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
              Total Recebido:{' '}
              <span className="font-mono text-emerald-700 dark:text-emerald-300 font-extrabold">
                {formatBRL(totalIncomesPeriod)}
              </span>
            </span>
          </div>
        </div>

        {/* Mobile Incomes Card List */}
        <div className="sm:hidden divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
          {filteredIncomesForPeriod.length === 0 ? (
            <div className="py-6 text-center text-slate-500 dark:text-slate-400 text-xs px-4">
              Nenhuma entrada registrada para o período <span className="font-semibold">{periodLabel}</span>.
            </div>
          ) : (
            filteredIncomesForPeriod.map((inc) => (
              <div key={`dash-inc-m-${inc.id}`} className="p-3 space-y-1 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{inc.companyName}</span>
                  </div>
                  <span className="font-mono font-extrabold text-xs text-emerald-600 dark:text-emerald-400 shrink-0">
                    {formatBRL(inc.value)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>#{inc.id} &bull; {inc.date.includes('-') ? inc.date.split('-').reverse().join('/') : inc.date}</span>
                    {inc.forma_recebimento && (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                        {inc.forma_recebimento}
                      </span>
                    )}
                  </div>
                  {inc.description && <span className="italic font-sans text-slate-600 dark:text-slate-300 truncate max-w-[160px]">{inc.description}</span>}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick Incomes Table (Desktop & Tablet) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-950 dark:text-emerald-200 font-bold border-b border-emerald-200 dark:border-emerald-800 text-[11px]">
                <th className="py-2 px-3 w-12 font-mono text-center">ID</th>
                <th className="py-2 px-3">Nome da Empresa / Cliente</th>
                <th className="py-2 px-3">Data do Recebimento</th>
                <th className="py-2 px-3">Descrição / Detalhes</th>
                <th className="py-2 px-3 text-right font-mono">Valor da Entrada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800 text-[11px] font-mono tabular-nums">
              {filteredIncomesForPeriod.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500 dark:text-slate-400 font-sans">
                    Nenhuma entrada registrada para o período <span className="font-semibold">{periodLabel}</span>.
                  </td>
                </tr>
              ) : (
                filteredIncomesForPeriod.map((inc) => (
                  <tr key={inc.id} className="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors">
                    <td className="py-1.5 px-3 font-mono text-slate-400 text-center text-[10px]">#{inc.id}</td>
                    <td className="py-1.5 px-3 font-sans font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>{inc.companyName}</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-slate-800 dark:text-slate-200">
                      {inc.date.includes('-')
                        ? inc.date.split('-').reverse().join('/')
                        : inc.date}
                    </td>
                    <td className="py-1.5 px-3 font-sans text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {inc.forma_recebimento && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {inc.forma_recebimento}
                          </span>
                        )}
                        <span>{inc.description || '-'}</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-right font-extrabold font-mono text-emerald-600 dark:text-emerald-400">
                      {formatBRL(inc.value)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredIncomesForPeriod.length > 0 && (
              <tfoot>
                <tr className="bg-emerald-50 dark:bg-emerald-950/40 font-bold border-t border-emerald-200 dark:border-emerald-800 text-xs">
                  <td colSpan={4} className="py-2 px-3 text-right text-emerald-950 dark:text-emerald-200 font-sans uppercase">
                    Total de Entradas em {periodLabel}:
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-extrabold text-emerald-700 dark:text-emerald-300">
                    {formatBRL(totalIncomesPeriod)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 3. CARD EXECUTIVO: SAÚDE FINANCEIRA */}
      <div className={`rounded-xl border p-4 sm:p-5 shadow-xs transition-all ${financialHealth.cardBg}`}>
        {/* Header do Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800/80 pb-3">
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-lg text-white shadow-xs shrink-0 ${
                financialHealth.status === 'Saudável'
                  ? 'bg-emerald-600 dark:bg-emerald-500'
                  : financialHealth.status === 'Atenção'
                  ? 'bg-amber-600 dark:bg-amber-500'
                  : 'bg-rose-600 dark:bg-rose-500'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  SAÚDE FINANCEIRA
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                  {periodLabel}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Visão executiva do saldo operacional e da capacidade de cobertura dos compromissos pendentes.
              </p>
            </div>
          </div>

          {/* Badge de Status Geral: Verde (Saudável), Amarelo (Atenção), Vermelho (Risco) */}
          <div className="flex items-center self-start sm:self-auto">
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-black uppercase tracking-wide shadow-2xs ${financialHealth.badgeBg}`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                  financialHealth.status === 'Saudável'
                    ? 'bg-emerald-500'
                    : financialHealth.status === 'Atenção'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
              <span>Status: {financialHealth.status}</span>
            </div>
          </div>
        </div>

        {/* 4 Pilares Executivos: Saldo Operacional | Compromissos Pendentes | Cobertura Financeira | Vencimentos Próximos 7 Dias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 pt-4">
          {/* Pilar 1: Saldo Operacional */}
          <div className="bg-white dark:bg-slate-900/90 rounded-lg p-3.5 border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                Saldo Operacional
              </span>
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                  netBalancePeriod >= 0
                    ? 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                }`}
              >
                {netBalancePeriod >= 0 ? 'Saldo positivo' : 'Saldo negativo'}
              </span>
            </div>

            <div>
              <div
                className={`text-xl sm:text-2xl font-black font-mono tracking-tight tabular-nums ${
                  netBalancePeriod >= 0
                    ? 'text-teal-700 dark:text-teal-300'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {formatBRL(netBalancePeriod)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Resultado líquido apurado: Receitas recebidas menos Despesas pagas no período.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono">
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                Entradas: {formatBRL(totalIncomesPeriod)}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Pagas: {formatBRL(totalPaid)}
              </span>
            </div>
          </div>

          {/* Pilar 2: Compromissos Pendentes */}
          <div className="bg-white dark:bg-slate-900/90 rounded-lg p-3.5 border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Compromissos Pendentes
              </span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 font-mono">
                {countToPay + countOverdue} {countToPay + countOverdue === 1 ? 'conta' : 'contas'}
              </span>
            </div>

            <div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight tabular-nums text-slate-900 dark:text-white">
                {formatBRL(futureCommitments)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Total de contas atrasadas e a vencer que ainda exigem liquidação financeira.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono">
              <span className="text-blue-700 dark:text-blue-400 font-semibold">
                À Vencer: {formatBRL(totalToPay)}
              </span>
              <span className={totalOverdue > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-400'}>
                {totalOverdue > 0 ? `Atrasado: ${formatBRL(totalOverdue)}` : 'Sem atrasos'}
              </span>
            </div>
          </div>

          {/* Pilar 3: Cobertura Financeira (Saldo Operacional / Compromissos Pendentes) */}
          <div className="bg-white dark:bg-slate-900/90 rounded-lg p-3.5 border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                Cobertura Financeira
              </span>
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded font-mono ${
                  coverageRatio >= 1.2
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                    : coverageRatio >= 1.0
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                }`}
              >
                {futureCommitments > 0 ? `${coverageRatio.toFixed(2)}x` : '100%+'}
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-xl sm:text-2xl font-black font-mono tracking-tight tabular-nums ${
                    coverageRatio >= 1.2
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : coverageRatio >= 1.0
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {futureCommitments > 0 ? `${Math.round(coverageRatio * 100)}%` : '100% coberto'}
                </span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  (Saldo Operacional / Compromissos Pendentes)
                </span>
              </div>

              {/* Barra de Progresso / Medidor Visual de Cobertura */}
              <div className="space-y-1 mt-2">
                <div className="flex justify-between text-[9px] font-bold text-slate-500 dark:text-slate-400 font-mono">
                  <span>0%</span>
                  <span className="text-slate-700 dark:text-slate-300 font-extrabold">100% (Ponto de Equilíbrio)</span>
                  <span>200%+</span>
                </div>
                <div className="relative h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      coverageRatio >= 1.2 ? 'bg-emerald-500' : coverageRatio >= 1.0 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, (coverageRatio / 2) * 100)}%` }}
                  />
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-400/80 dark:bg-slate-500" title="100% Cobertura" />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              {futureCommitments > 0 ? (
                <div className="space-y-1">
                  <div>
                    R$ <strong className="font-mono text-slate-800 dark:text-slate-200">{coverageRatio.toFixed(2)}</strong> disponível para cada R$ 1,00 de compromisso pendente.
                  </div>
                  {coverageRatio < 1 && coverageGap > 0 && (
                    <div className="text-rose-600 dark:text-rose-400 font-bold font-mono">
                      Déficit de cobertura: {formatBRL(coverageGap)}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  Sem passivos pendentes registrados no período.
                </span>
              )}
            </div>
          </div>

          {/* Pilar 4: Vencimentos Próximos 7 Dias */}
          <div
            id="card-vencimentos-proximos-7-dias"
            className="bg-white dark:bg-slate-900/90 rounded-lg p-3.5 border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col justify-between space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Vencimentos Próximos 7 Dias
              </span>
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 font-mono">
                {countUpcoming7Days} {countUpcoming7Days === 1 ? 'conta' : 'contas'}
              </span>
            </div>

            <div>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-tight tabular-nums text-slate-900 dark:text-white">
                {formatBRL(totalUpcoming7Days)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Volume de contas a vencer na próxima semana (hoje até +7 dias).
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                {countUpcoming7Days > 0 ? (
                  <span className="text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Exige atenção
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Em dia
                  </span>
                )}
              </span>
              <button
                type="button"
                id="btn-ver-detalhes-proximos-7-dias"
                onClick={() => {
                  if (onViewUpcomingDetails) {
                    onViewUpcomingDetails();
                  }
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer py-0.5 px-2 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40"
              >
                Exibir detalhes
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Rodapé Executivo: Diagnóstico e Orientação */}
        <div className="mt-3.5 p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
          <div className="mt-0.5 shrink-0">
            {financialHealth.status === 'Saudável' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : financialHealth.status === 'Atenção' ? (
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            )}
          </div>
          <div className="flex-1">
            <strong className="font-bold text-slate-900 dark:text-white mr-1.5">
              Diagnóstico Operacional:
            </strong>
            <span>{financialHealth.verdict}</span>
          </div>
        </div>
      </div>

      {/* 4. GRÁFICOS INTERATIVOS (CHARTS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CHART 1: Fluxo Financeiro Mensal (últimos 6 meses) - Entradas vs Saídas com Valores Fixos */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 shadow-2xs space-y-3 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 dark:border-slate-800 pb-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Fluxo Financeiro Mensal
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Comparativo entre entradas, pagamentos e compromissos financeiros.
              </p>
            </div>
          </div>

          <div className="w-full overflow-x-auto pb-1">
            <div className="h-96 sm:h-[440px] min-w-[960px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartEvolucaoData}
                  margin={{ top: 80, right: 70, left: 10, bottom: 5 }}
                  barCategoryGap="8%"
                  barGap={6}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                    domain={[0, (dataMax: number) => Math.ceil((dataMax * 1.35) || 1000)]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="Entradas (Receitas)" fill="#059669" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="Entradas (Receitas)"
                      position="top"
                      content={renderMonthlyBarLabel(
                        'Entradas',
                        0,
                        '#047857',
                        'fill-emerald-800 dark:fill-emerald-300'
                      )}
                    />
                  </Bar>
                  <Bar dataKey="Total Pago (Despesas)" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="Total Pago (Despesas)"
                      position="top"
                      content={renderMonthlyBarLabel(
                        'Pago',
                        1,
                        '#1d4ed8',
                        'fill-blue-800 dark:fill-blue-300'
                      )}
                    />
                  </Bar>
                  <Bar dataKey="Total Atrasado" fill="#f43f5e" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="Total Atrasado"
                      position="top"
                      content={renderMonthlyBarLabel(
                        'Atrasado',
                        2,
                        '#be123c',
                        'fill-rose-800 dark:fill-rose-300'
                      )}
                    />
                  </Bar>
                  <Bar dataKey="Total À Vencer" fill="#94a3b8" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="Total À Vencer"
                      position="top"
                      content={renderMonthlyBarLabel(
                        'À Vencer',
                        3,
                        '#334155',
                        'fill-slate-800 dark:fill-slate-200'
                      )}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* CHART 4: Entradas por Empresa (Volume de Receita no Período) */}
        <div className="bg-white dark:bg-slate-900 border border-emerald-300/80 dark:border-emerald-800/80 rounded-lg p-3.5 shadow-2xs space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800/80 pb-2">
            <h3 className="text-xs font-bold text-emerald-950 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Entradas por Empresa / Cliente ({periodLabel})
            </h3>
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono font-bold">
              Total: {formatBRL(totalIncomesPeriod)}
            </span>
          </div>

          {chartIncomesByCompanyData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-500">
              Nenhuma entrada registrada para o período selecionado.
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartIncomesByCompanyData}
                  layout="vertical"
                  margin={{ top: 5, right: 95, left: 15, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={(v) => `R$${v}`}
                  />
                  <YAxis
                    dataKey="companyName"
                    type="category"
                    width={120}
                    tick={(props: { x?: number; y?: number; payload?: { value: string } }) => {
                      const { x = 0, y = 0, payload } = props;
                      return (
                        <text
                          x={Number(x) - 6}
                          y={y}
                          dy={4}
                          textAnchor="end"
                          fill="#FFFFFF"
                          className="fill-slate-900 dark:fill-white font-semibold text-[11px] select-none"
                          fontSize={11}
                          fontWeight={600}
                        >
                          {payload?.value || ''}
                        </text>
                      );
                    }}
                  />
                  <Bar dataKey="total" fill="#059669" radius={[0, 4, 4, 0]}>
                    <LabelList
                      dataKey="total"
                      position="right"
                      content={(props: {
                        x?: number | string;
                        y?: number | string;
                        width?: number | string;
                        height?: number | string;
                        value?: unknown;
                      }) => {
                        const { x = 0, y = 0, width = 0, height = 0, value } = props;
                        const num = Number(value);
                        if (!num || isNaN(num) || num <= 0) return null;
                        return (
                          <text
                            x={Number(x) + Number(width) + 8}
                            y={Number(y) + Number(height) / 2}
                            dominantBaseline="central"
                            textAnchor="start"
                            fill="#FFFFFF"
                            className="fill-slate-900 dark:fill-white font-bold font-mono text-[11px] tracking-tight pointer-events-none select-none"
                            fontSize={11}
                            fontWeight={700}
                          >
                            {formatBRL(num)}
                          </text>
                        );
                      }}
                    />
                    {chartIncomesByCompanyData.map((_, index) => (
                      <Cell
                        key={`income-cell-${index}`}
                        fill={index === 0 ? '#047857' : index === 1 ? '#059669' : '#10b981'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* CHART 3: Top 5 Fornecedores/Funcionários por Valor Total */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 shadow-2xs space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              Top 5 Favorecidos (Despesas) - {periodLabel}
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">Por Volume Total em R$</span>
          </div>

          {chartTopEntitiesData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-500">
              Nenhum favorecido com saldo no período.
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartTopEntitiesData}
                  layout="vertical"
                  margin={{ top: 5, right: 95, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={(v) => `R$${v}`}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={130}
                    tick={(props: { x?: number; y?: number; payload?: { value: string } }) => {
                      const { x = 0, y = 0, payload } = props;
                      return (
                        <text
                          x={Number(x) - 6}
                          y={y}
                          dy={4}
                          textAnchor="end"
                          fill="#FFFFFF"
                          className="fill-slate-900 dark:fill-white font-semibold text-[11px] select-none"
                          fontSize={11}
                          fontWeight={600}
                        >
                          {payload?.value || ''}
                        </text>
                      );
                    }}
                  />
                  <Bar dataKey="total" fill="#6366f1" radius={[0, 4, 4, 0]}>
                    <LabelList
                      dataKey="total"
                      position="right"
                      content={(props: {
                        x?: number | string;
                        y?: number | string;
                        width?: number | string;
                        height?: number | string;
                        value?: unknown;
                      }) => {
                        const { x = 0, y = 0, width = 0, height = 0, value } = props;
                        const num = Number(value);
                        if (!num || isNaN(num) || num <= 0) return null;
                        return (
                          <text
                            x={Number(x) + Number(width) + 8}
                            y={Number(y) + Number(height) / 2}
                            dominantBaseline="central"
                            textAnchor="start"
                            fill="#FFFFFF"
                            className="fill-slate-900 dark:fill-white font-bold font-mono text-[11px] tracking-tight pointer-events-none select-none"
                            fontSize={11}
                            fontWeight={700}
                          >
                            {formatBRL(num)}
                          </text>
                        );
                      }}
                    />
                    {chartTopEntitiesData.map((item, index) => (
                      <Cell
                        key={`top-cell-${index}`}
                        fill={item.type === 'Fornecedor' ? '#6366f1' : '#8b5cf6'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* CHART 2: Valor Gasto com os Funcionários */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 shadow-2xs space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Valor Gasto com Funcionários ({periodLabel})
            </h3>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-bold">
              Total: {formatBRL(totalEmployeeExpense)}
            </span>
          </div>

          {chartEmployeeExpensesData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-slate-500">
              Nenhum gasto com funcionário registrado no período selecionado.
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartEmployeeExpensesData}
                  margin={{ top: 26, right: 15, left: 10, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis
                    dataKey="name"
                    tick={(props: { x?: number; y?: number; payload?: { value: string } }) => {
                      const { x = 0, y = 0, payload } = props;
                      return (
                        <text
                          x={x}
                          y={Number(y) + 12}
                          textAnchor="middle"
                          fill="#FFFFFF"
                          className="fill-slate-900 dark:fill-white font-semibold text-[11px] select-none"
                          fontSize={11}
                          fontWeight={600}
                        >
                          {payload?.value || ''}
                        </text>
                      );
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    tickFormatter={(val) => `R$${val}`}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                  <Bar dataKey="Pago" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]}>
                    <LabelList
                      dataKey="Pago"
                      position="center"
                      content={(props: {
                        x?: number | string;
                        y?: number | string;
                        width?: number | string;
                        height?: number | string;
                        value?: unknown;
                      }) => {
                        const { x = 0, y = 0, width = 0, height = 0, value } = props;
                        const num = Number(value);
                        if (!num || isNaN(num) || num <= 50) return null;
                        return (
                          <text
                            x={Number(x) + Number(width) / 2}
                            y={Number(y) + Number(height) / 2}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill="#FFFFFF"
                            className="fill-white font-bold font-mono text-[10px] tracking-tight pointer-events-none select-none"
                            fontSize={10}
                            fontWeight={700}
                          >
                            {formatBRL(num)}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                  <Bar dataKey="Pendente" fill="#3b82f6" stackId="a" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="Pendente"
                      position="top"
                      content={(props: {
                        x?: number | string;
                        y?: number | string;
                        width?: number | string;
                        value?: unknown;
                      }) => {
                        const { x = 0, y = 0, width = 0, value } = props;
                        const num = Number(value);
                        if (!num || isNaN(num) || num <= 0) return null;
                        return (
                          <text
                            x={Number(x) + Number(width) / 2}
                            y={Number(y) - 6}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            className="fill-slate-900 dark:fill-white font-bold font-mono text-[10px] tracking-tight pointer-events-none select-none"
                            fontSize={10}
                            fontWeight={700}
                          >
                            {formatBRL(num)}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
