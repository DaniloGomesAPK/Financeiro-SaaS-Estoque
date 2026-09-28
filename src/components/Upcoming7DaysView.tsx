import React, { useState, useMemo } from 'react';
import { CalculatedEntry } from '../types';
import { formatBRL, parseBRDate, getTodayDateString } from '../utils/calculations';
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Building2,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  Receipt,
  Layers,
} from 'lucide-react';

interface Upcoming7DaysViewProps {
  entries: CalculatedEntry[];
  onBack: () => void;
}

export const Upcoming7DaysView: React.FC<Upcoming7DaysViewProps> = ({ entries, onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'today' | 'upcoming'>('all');

  // Cálculo das datas limites: hoje até +7 dias
  const todayStr = useMemo(() => getTodayDateString(), []);
  const maxDueDateStr = useMemo(() => {
    const today = new Date();
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 7);
    const year = maxDate.getFullYear();
    const month = String(maxDate.getMonth() + 1).padStart(2, '0');
    const day = String(maxDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Helper para cálculo dos dias até o vencimento
  const getDaysUntilDue = (dueDateStr: string, currentDayStr: string) => {
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

  // Filtrar rigorosamente as contas a vencer nos próximos 7 dias (mesma regra do Dashboard)
  const upcomingEntries = useMemo(() => {
    return entries
      .filter((e) => {
        if (e.status !== 'À Vencer') return false;
        return e.dueDate >= todayStr && e.dueDate <= maxDueDateStr;
      })
      .sort((a, b) => {
        // Ordenação cronológica por vencimento
        if (a.dueDate !== b.dueDate) {
          return a.dueDate.localeCompare(b.dueDate);
        }
        // Em seguida, maior valor
        return (b.totalWithInterest || 0) - (a.totalWithInterest || 0);
      });
  }, [entries, todayStr, maxDueDateStr]);

  // Resumo financeiro total
  const totalUpcoming = useMemo(() => {
    return upcomingEntries.reduce((sum, e) => sum + (e.totalWithInterest || 0), 0);
  }, [upcomingEntries]);

  const totalCount = upcomingEntries.length;

  // Contas que vencem hoje
  const todayEntriesCount = useMemo(() => {
    return upcomingEntries.filter((e) => e.dueDate === todayStr).length;
  }, [upcomingEntries, todayStr]);

  const todayEntriesTotal = useMemo(() => {
    return upcomingEntries
      .filter((e) => e.dueDate === todayStr)
      .reduce((sum, e) => sum + (e.totalWithInterest || 0), 0);
  }, [upcomingEntries, todayStr]);

  // Lista filtrada por busca e subfiltro
  const filteredEntries = useMemo(() => {
    return upcomingEntries.filter((e) => {
      const days = getDaysUntilDue(e.dueDate, todayStr);
      if (statusFilter === 'today' && days !== 0) return false;
      if (statusFilter === 'upcoming' && days === 0) return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const favName = (e.favorecidoName || '').toLowerCase();
      const docType = (e.docType || '').toLowerCase();
      const nfNum = (e.nfNumber || '').toLowerCase();
      const dateBr = parseBRDate(e.dueDate).toLowerCase();

      return (
        favName.includes(term) ||
        docType.includes(term) ||
        nfNum.includes(term) ||
        dateBr.includes(term)
      );
    });
  }, [upcomingEntries, searchTerm, statusFilter, todayStr]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200 w-full">
      {/* Barra de Navegação Superior: Botão Voltar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          id="btn-voltar-dashboard"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-xs transition-all cursor-pointer hover:translate-x-[-2px]"
        >
          <ArrowLeft className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>← Voltar para Dashboard</span>
        </button>

        <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:flex items-center gap-1.5 font-medium">
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          <span>Atualizado em tempo real</span>
        </div>
      </div>

      {/* Cabeçalho Principal */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
                <Calendar className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-black dark:text-white">
                  Vencimentos Próximos 7 Dias
                </h1>
                <p className="text-xs sm:text-sm text-black dark:text-slate-300 flex items-center gap-1 mt-0.5">
                  <span>Período:</span>
                  <strong className="text-black dark:text-white font-bold">
                    {parseBRDate(todayStr)} até {parseBRDate(maxDueDateStr)}
                  </strong>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-black dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-black dark:text-slate-300 font-bold">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              Janela de 7 dias
            </span>
          </div>
        </div>

        {/* Resumo Financeiro */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          {/* Card 1: Total a Vencer */}
          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-black dark:text-amber-300 uppercase tracking-wider">
                Total a vencer
              </span>
              <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-black dark:text-white mt-1 tabular-nums">
              {formatBRL(totalUpcoming)}
            </div>
            <p className="text-[11px] text-black dark:text-slate-400 mt-1 font-medium">
              Montante financeiro a ser quitado na próxima semana
            </p>
          </div>

          {/* Card 2: Quantidade de Contas */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-black dark:text-slate-300 uppercase tracking-wider">
                Quantidade de contas
              </span>
              <Receipt className="w-4 h-4 text-black dark:text-slate-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-black dark:text-white mt-1 tabular-nums">
              {totalCount}
            </div>
            <p className="text-[11px] text-black dark:text-slate-400 mt-1 font-medium">
              {totalCount === 1 ? '1 conta programada' : `${totalCount} contas programadas`}
            </p>
          </div>

          {/* Card 3: Contas Vencendo Hoje */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-black dark:text-slate-300 uppercase tracking-wider">
                Vencem hoje
              </span>
              <AlertCircle className={`w-4 h-4 ${todayEntriesCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`} />
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-black dark:text-white mt-1 tabular-nums">
              {formatBRL(todayEntriesTotal)}
            </div>
            <p className="text-[11px] text-black dark:text-slate-400 mt-1 font-medium">
              {todayEntriesCount === 0
                ? 'Nenhum pagamento programado para hoje'
                : `${todayEntriesCount} ${todayEntriesCount === 1 ? 'conta com vencimento hoje' : 'contas com vencimento hoje'}`}
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por fornecedor, documento ou data..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filtros de Vencimento */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Todas ({upcomingEntries.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('today')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'today'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Hoje ({todayEntriesCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('upcoming')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === 'upcoming'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Próximos ({upcomingEntries.length - todayEntriesCount})
          </button>
        </div>
      </div>

      {/* Lista de Vencimentos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Contas a Vencer no Período</span>
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Exibindo {filteredEntries.length} de {upcomingEntries.length} contas
          </span>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/60">
            <div className="inline-flex p-3 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {upcomingEntries.length === 0
                ? 'Nenhum vencimento previsto para os próximos 7 dias'
                : 'Nenhum lançamento encontrado com o filtro aplicado'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              {upcomingEntries.length === 0
                ? 'Todas as contas estão em dia ou com vencimentos programados para datas posteriores.'
                : 'Tente alterar os termos de busca ou remover os filtros de status.'}
            </p>
            {upcomingEntries.length === 0 ? (
              <button
                type="button"
                onClick={onBack}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                Voltar para o Dashboard
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredEntries.map((entry) => {
              const daysUntil = getDaysUntilDue(entry.dueDate, todayStr);
              const isToday = daysUntil === 0;

              // 1. Fornecedor: Nome real do fornecedor
              const fornecedorNome = entry.favorecidoName || 'Fornecedor não informado';

              // 2. Documento: Tipo do documento
              const tipoDocumento = entry.docType || 'Outros';
              const documentoTexto = entry.nfNumber
                ? `${tipoDocumento} • Nº ${entry.nfNumber}`
                : tipoDocumento;

              // 3. Data de vencimento: DD/MM/YYYY
              const dataVencimento = entry.dueDate ? parseBRDate(entry.dueDate) : '-';

              // 4. Valor: R$ XX.XXX,XX (entry.totalWithInterest)
              const valorFormatado = formatBRL(entry.totalWithInterest);

              // 5. Status: Vence hoje / Próximo vencimento
              const statusTexto = isToday ? 'Vence hoje' : 'Próximo vencimento';

              return (
                <div
                  key={entry.id}
                  className={`p-4 rounded-xl border transition-all hover:shadow-md bg-white dark:bg-slate-900 flex flex-col justify-between gap-3 ${
                    isToday
                      ? 'border-rose-300 dark:border-rose-900/60 shadow-xs shadow-rose-100/50 dark:shadow-none bg-gradient-to-br from-rose-50/20 via-white to-white dark:from-rose-950/10 dark:via-slate-900 dark:to-slate-900'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Topo do Card: Fornecedor e Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                          isToday
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-black dark:text-slate-300 block">
                          Fornecedor
                        </span>
                        <h3
                          className="font-black text-sm sm:text-base text-black dark:text-white truncate"
                          title={fornecedorNome}
                        >
                          {fornecedorNome}
                        </h3>
                      </div>
                    </div>

                    {/* Badge de Status: Vence hoje / Próximo vencimento */}
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 border-2 ${
                        isToday
                          ? 'bg-rose-100 text-black border-rose-300 dark:bg-rose-950/90 dark:text-rose-200 dark:border-rose-800 animate-pulse'
                          : daysUntil === 1
                          ? 'bg-amber-100 text-black border-amber-300 dark:bg-amber-950/90 dark:text-amber-200 dark:border-amber-800'
                          : 'bg-blue-50 text-black border-blue-200 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-900/60'
                      }`}
                    >
                      {isToday && <AlertCircle className="w-3 h-3 text-black dark:text-rose-300" />}
                      <span>{statusTexto}</span>
                    </span>
                  </div>

                  {/* Informações Centrais: Documento e Vencimento */}
                  <div className="grid grid-cols-2 gap-2 py-2.5 px-3 rounded-lg bg-white border border-slate-300 text-xs shadow-2xs">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-black block">
                        Documento
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
                        Data de Vencimento
                      </span>
                      <div className="flex items-center gap-1.5 text-black font-bold text-xs mt-0.5 min-w-0">
                        <Calendar className="w-3.5 h-3.5 text-black shrink-0" />
                        <span className="truncate text-black">{dataVencimento}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé do Card: Valor */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-black dark:text-slate-300 block">
                        Valor
                      </span>
                      <span className="text-lg sm:text-xl font-black font-mono tracking-tight text-black dark:text-white tabular-nums">
                        {valorFormatado}
                      </span>
                    </div>

                    {daysUntil > 0 && (
                      <span className="text-[11px] font-bold text-black dark:text-slate-300">
                        {daysUntil === 1 ? 'Vence amanhã' : `Vence em ${daysUntil} dias`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
