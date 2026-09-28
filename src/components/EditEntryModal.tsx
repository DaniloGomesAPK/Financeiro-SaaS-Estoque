import React, { useState, useEffect, useMemo } from 'react';
import { CalculatedEntry, DocumentType, Supplier, Employee, PaymentType } from '../types';
import { getTipoFavorecido, parseCurrencyInput, formatBRL } from '../utils/calculations';
import { X, Check, Trash2, AlertTriangle } from 'lucide-react';

interface EditEntryModalProps {
  entry: CalculatedEntry;
  suppliers: Supplier[];
  employees: Employee[];
  onClose: () => void;
  onSave: (updatedEntry: CalculatedEntry) => void;
  onDelete?: (id: number) => void;
}

export const EditEntryModal: React.FC<EditEntryModalProps> = ({
  entry,
  suppliers,
  employees,
  onClose,
  onSave,
  onDelete,
}) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const getInitialFavorecidoSelect = (favId?: string, favName?: string) => {
    if (!favId) return '';
    if (favId.startsWith('func-')) {
      const cleanId = favId.replace('func-', '').split('-')[0];
      const found = employees.find((e) => String(e.id) === cleanId || e.id === parseInt(cleanId, 10));
      if (found) return `func-${found.id}`;
      if (favName) {
        const foundByName = employees.find((e) => e.name.trim().toLowerCase() === favName.trim().toLowerCase());
        if (foundByName) return `func-${foundByName.id}`;
      }
      return `func-${cleanId}`;
    }
    return favId;
  };

  const getInitialEmployeePaymentType = (dType?: DocumentType): PaymentType | '' => {
    if (dType === 'Pagamento' || dType === 'Adiantamento' || dType === 'Férias' || dType === 'Rescisão') {
      return dType;
    }
    return '';
  };

  const [favorecidoSelect, setFavorecidoSelect] = useState(() =>
    getInitialFavorecidoSelect(entry.favorecidoId, entry.favorecidoName)
  );
  const [employeePaymentType, setEmployeePaymentType] = useState<PaymentType | ''>(() =>
    getInitialEmployeePaymentType(entry.docType)
  );
  const [docType, setDocType] = useState<DocumentType>(entry.docType);
  const [nfNumber, setNfNumber] = useState(entry.nfNumber || '');
  const [dueDate, setDueDate] = useState(entry.dueDate);
  const [value, setValue] = useState(
    entry.value ? entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
  );
  const [paymentDate, setPaymentDate] = useState(entry.paymentDate || '');
  const [interestRate, setInterestRate] = useState(entry.interestRate.toString());

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

  useEffect(() => {
    if (entry) {
      setFavorecidoSelect(getInitialFavorecidoSelect(entry.favorecidoId, entry.favorecidoName));
      setEmployeePaymentType(getInitialEmployeePaymentType(entry.docType));
      setDocType(entry.docType);
      setNfNumber(entry.nfNumber || '');
      setDueDate(entry.dueDate);
      setValue(
        entry.value ? entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
      );
      setPaymentDate(entry.paymentDate || '');
      setInterestRate(entry.interestRate.toString());
    }
  }, [entry, employees]);

  const handleFavorecidoChange = (val: string) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const numValue = parseCurrencyInput(value);
    const numInterestRate = parseCurrencyInput(interestRate) || 0;

    if (!favorecidoSelect) {
      alert('Selecione um favorecido.');
      return;
    }
    if (favorecidoSelect.startsWith('func-') && !employeePaymentType) {
      alert('Por favor, informe o tipo de lançamento do funcionário.');
      return;
    }
    if (!dueDate) {
      alert('A data de vencimento é obrigatória.');
      return;
    }
    if (isNaN(numValue) || numValue <= 0) {
      alert('Informe um valor válido e maior que zero.');
      return;
    }

    // Determine favorecido details
    let favorecidoName = '';
    let favorecidoType: 'Fornecedor' | 'Funcionário' = 'Fornecedor';

    if (favorecidoSelect.startsWith('forn-')) {
      const id = parseInt(favorecidoSelect.replace('forn-', ''), 10);
      const s = suppliers.find((sup) => sup.id === id || String(sup.id) === favorecidoSelect.replace('forn-', ''));
      if (s) {
        favorecidoName = s.name;
        favorecidoType = getTipoFavorecido(s.name, employees, favorecidoSelect);
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
          favorecidoName = favorecidoSelect || entry.favorecidoName;
        }
      }
    }

    if (!favorecidoName || favorecidoName.trim() === '' || favorecidoName.trim().toLowerCase() === 'fornecedor') {
      favorecidoName = entry.favorecidoName && entry.favorecidoName.toLowerCase() !== 'fornecedor'
        ? entry.favorecidoName
        : 'Fornecedor não informado';
    }

    const updated: CalculatedEntry = {
      ...entry,
      favorecidoId: favorecidoSelect,
      favorecidoName,
      favorecidoType,
      docType,
      nfNumber,
      dueDate,
      value: numValue,
      paymentDate,
      interestRate: numInterestRate,
    };

    onSave(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            Editar Lançamento #{entry.id}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3 sm:p-4 space-y-3 text-xs">
          {/* Favorecido */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
              Favorecido <span className="text-rose-500">*</span>
            </label>
            <select
              value={favorecidoSelect}
              onChange={(e) => handleFavorecidoChange(e.target.value)}
              className="w-full px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none h-7.5"
              required
            >
              <optgroup label="Fornecedores">
                {sortedSuppliers.map((s) => (
                  <option key={`forn-${s.id}`} value={`forn-${s.id}`}>
                    [F] {s.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Funcionários">
                {uniqueEmployees.map((emp) => (
                  <option key={`func-${emp.id}`} value={`func-${emp.id}`}>
                    {emp.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* 2. Ao selecionar o funcionário, abrir uma segunda opção: Tipo de lançamento */}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Vencimento */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                Vencimento <span className="text-rose-500">*</span>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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

            {/* Taxa Juros */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                Taxa de Juros (%) (Mensal)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="Ex: 2.5 ou 2,5"
                className="w-full px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none h-7.5 font-mono"
              />
            </div>
          </div>

          {confirmDelete ? (
            <div className="p-2.5 rounded-md bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-850 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-rose-800 dark:text-rose-200 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Confirmar exclusão deste lançamento de {formatBRL(entry.value)}?</span>
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 font-semibold text-[11px] rounded transition-colors"
                >
                  Não, voltar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDelete) onDelete(entry.id);
                    onClose();
                  }}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded shadow-2xs transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Sim, Excluir
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div>
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded text-xs font-semibold transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir Lançamento
                  </button>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs rounded transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded shadow-2xs transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Salvar Alterações
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
