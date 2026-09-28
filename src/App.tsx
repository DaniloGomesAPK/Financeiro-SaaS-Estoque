import React, { useState, useEffect, useMemo } from 'react';
import { Supplier, Employee, Entry, CalculatedEntry, IncomeEntry } from './types';
import { calculateEntryDetails, exportToCSV, getTodayDateString, parseCurrencyInput } from './utils/calculations';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { EntriesView } from './components/EntriesView';
import { SupplierReportView } from './components/SupplierReportView';
import { ConfigView } from './components/ConfigView';
import { Upcoming7DaysView } from './components/Upcoming7DaysView';
import { StatusDetailsView } from './components/StatusDetailsView';
import { InventoryView } from './components/InventoryView';
import { AccessBlockedView } from './components/AccessBlockedView';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthModal } from './components/AuthModal';
import { LoginView } from './components/LoginView';
import { useFirebaseSync } from './hooks/useFirebaseSync';
import { CheckCircle2, AlertCircle } from 'lucide-react';

function AppContent() {
  const { user, loading, accessLoading, hasAccess, companyAccess } = useAuth();
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'entries'
    | 'suppliers'
    | 'inventory'
    | 'config'
    | 'upcoming-details'
    | 'overdue-details'
    | 'to-pay-details'
    | 'paid-details'
    | 'incomes-details'
  >('dashboard');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme_preference') === 'dark';
  });

  // State populated EXCLUSIVELY from Cloud Firestore via onSnapshot
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rawEntries, setRawEntries] = useState<Entry[]>([]);
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);

  // Notification Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Firebase Firestore Direct Real-time Sync
  const {
    isSyncing,
    isOnline,
    lastSyncedAt,
    saveEntryToFirestore,
    deleteEntryFromFirestore,
    saveSupplierToFirestore,
    deleteSupplierFromFirestore,
    saveEmployeeToFirestore,
    deleteEmployeeFromFirestore,
    saveIncomeToFirestore,
    deleteIncomeFromFirestore,
  } = useFirebaseSync({
    setRawEntries,
    setSuppliers,
    setEmployees,
    setIncomes,
    showToast,
  });

  // Dark Mode preference handling
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme_preference', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme_preference', 'light');
    }
  }, [darkMode]);

  // Dynamically calculate statuses, interest, and totals in memory
  const calculatedEntries: CalculatedEntry[] = useMemo(() => {
    const today = getTodayDateString();
    return rawEntries.filter((raw) => !raw.cancelled).map((raw) => {
      // 1. Cross-reference suppliers and employees to resolve favorecidoName if empty or generic
      let resolvedFavorecidoName = (raw.favorecidoName || '').trim();
      let resolvedFavorecidoType = raw.favorecidoType;

      if (!resolvedFavorecidoName || resolvedFavorecidoName.toLowerCase() === 'fornecedor') {
        if (raw.favorecidoId) {
          if (raw.favorecidoId.startsWith('forn-')) {
            const numId = parseInt(raw.favorecidoId.replace('forn-', ''), 10);
            const sup = suppliers.find((s) => s.id === numId || String(s.id) === raw.favorecidoId.replace('forn-', ''));
            if (sup?.name) {
              resolvedFavorecidoName = sup.name;
              resolvedFavorecidoType = 'Fornecedor';
            }
          } else if (raw.favorecidoId.startsWith('func-')) {
            const cleanIdStr = raw.favorecidoId.replace('func-', '').split('-')[0];
            const numId = parseInt(cleanIdStr, 10);
            const emp = employees.find((e) => e.id === numId || String(e.id) === cleanIdStr);
            if (emp?.name) {
              resolvedFavorecidoName = emp.name;
              resolvedFavorecidoType = 'Funcionário';
            }
          } else {
            const sup = suppliers.find((s) => String(s.id) === raw.favorecidoId || s.name.toLowerCase() === raw.favorecidoId.toLowerCase());
            if (sup?.name) {
              resolvedFavorecidoName = sup.name;
              resolvedFavorecidoType = 'Fornecedor';
            } else {
              const emp = employees.find((e) => String(e.id) === raw.favorecidoId || e.name.toLowerCase() === raw.favorecidoId.toLowerCase());
              if (emp?.name) {
                resolvedFavorecidoName = emp.name;
                resolvedFavorecidoType = 'Funcionário';
              }
            }
          }
        }
      }

      const parsedVal = typeof raw.value === 'number' && !isNaN(raw.value)
        ? raw.value
        : parseCurrencyInput(raw.value || 0);
      const safeVal = !isNaN(parsedVal) && parsedVal >= 0 ? parsedVal : 0;

      const cleanEntry: Entry = {
        ...raw,
        favorecidoName: resolvedFavorecidoName || 'Fornecedor não informado',
        favorecidoType: resolvedFavorecidoType || (raw.favorecidoId?.startsWith('func-') ? 'Funcionário' : 'Fornecedor'),
        docType: raw.docType || 'Boleto',
        value: safeVal,
      };

      return calculateEntryDetails(cleanEntry, today);
    });
  }, [rawEntries, suppliers, employees]);

  // Entry Operations (Direct Cloud Firestore)
  const handleAddEntry = async (newEntryData: Omit<Entry, 'id'>) => {
    const maxId = rawEntries.reduce((max, e) => Math.max(max, e.id), 0);
    let resolvedName = (newEntryData.favorecidoName || '').trim();
    if (!resolvedName || resolvedName.toLowerCase() === 'fornecedor') {
      if (newEntryData.favorecidoId?.startsWith('forn-')) {
        const id = parseInt(newEntryData.favorecidoId.replace('forn-', ''), 10);
        const sup = suppliers.find((s) => s.id === id);
        if (sup) resolvedName = sup.name;
      } else if (newEntryData.favorecidoId?.startsWith('func-')) {
        const cleanId = newEntryData.favorecidoId.replace('func-', '').split('-')[0];
        const id = parseInt(cleanId, 10);
        const emp = employees.find((e) => e.id === id);
        if (emp) resolvedName = emp.name;
      }
    }
    const numValue = typeof newEntryData.value === 'number' && !isNaN(newEntryData.value)
      ? newEntryData.value
      : parseCurrencyInput(newEntryData.value || 0);

    const newEntry: Entry = {
      ...newEntryData,
      id: Math.max(maxId + 1, Date.now() * 1000 + Math.floor(Math.random() * 1000)),
      favorecidoName: resolvedName || 'Fornecedor não informado',
      value: !isNaN(numValue) && numValue >= 0 ? numValue : 0,
      docType: newEntryData.docType || 'Boleto',
      favorecidoType: newEntryData.favorecidoType || 'Fornecedor',
    };
    await saveEntryToFirestore(newEntry);
    showToast('Boleto/Lançamento salvo no Firestore com sucesso!');
  };

  const handleUpdateEntry = async (updated: CalculatedEntry) => {
    let resolvedName = (updated.favorecidoName || '').trim();
    if (!resolvedName || resolvedName.toLowerCase() === 'fornecedor') {
      if (updated.favorecidoId?.startsWith('forn-')) {
        const id = parseInt(updated.favorecidoId.replace('forn-', ''), 10);
        const sup = suppliers.find((s) => s.id === id);
        if (sup) resolvedName = sup.name;
      } else if (updated.favorecidoId?.startsWith('func-')) {
        const cleanId = updated.favorecidoId.replace('func-', '').split('-')[0];
        const id = parseInt(cleanId, 10);
        const emp = employees.find((e) => e.id === id);
        if (emp) resolvedName = emp.name;
      }
    }
    const numValue = typeof updated.value === 'number' && !isNaN(updated.value)
      ? updated.value
      : parseCurrencyInput(updated.value || 0);

    const raw: Entry = {
      id: updated.id,
      firestoreId: updated.firestoreId,
      companyId: updated.companyId,
      favorecidoId: updated.favorecidoId,
      favorecidoName: resolvedName || 'Fornecedor não informado',
      favorecidoType: updated.favorecidoType || 'Fornecedor',
      docType: updated.docType || 'Boleto',
      nfNumber: updated.nfNumber || '',
      dueDate: updated.dueDate,
      value: !isNaN(numValue) && numValue >= 0 ? numValue : 0,
      paymentDate: updated.paymentDate || '',
      interestRate: updated.interestRate || 0,
      source: updated.source,
      nfeId: updated.nfeId,
      nfeKey: updated.nfeKey,
      installmentNumber: updated.installmentNumber,
      cancelled: updated.cancelled,
      cancelReason: updated.cancelReason,
    };
    await saveEntryToFirestore(raw);
    showToast('Lançamento atualizado no Firestore com sucesso!');
  };

  const handleDeleteEntry = async (id: number) => {
    const target = rawEntries.find((e) => e.id === id);
    await deleteEntryFromFirestore(id, target?.firestoreId);
    showToast('Lançamento excluído do Firestore.');
  };

  const handleDeleteMultipleEntries = async (ids: number[]) => {
    for (const id of ids) {
      const target = rawEntries.find((e) => e.id === id);
      await deleteEntryFromFirestore(id, target?.firestoreId);
    }
    showToast(`${ids.length} lançamentos excluídos do Firestore.`);
  };

  const handleQuickTogglePaid = async (id: number) => {
    const target = rawEntries.find((e) => e.id === id);
    if (!target) return;
    const todayStr = getTodayDateString();
    const isCurrentlyPaid = Boolean(target.paymentDate && target.paymentDate.trim() !== '');
    const updated: Entry = {
      ...target,
      paymentDate: isCurrentlyPaid ? '' : todayStr,
    };
    await saveEntryToFirestore(updated);
    showToast(isCurrentlyPaid ? 'Status alterado para Em Aberto.' : 'Pagamento registrado com sucesso!');
  };

  // Supplier Operations (Direct Cloud Firestore)
  const handleAddSupplier = async (name: string) => {
    const trimmedName = name.trim();
    const exists = suppliers.some(
      (s) => s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (exists) {
      showToast(`Fornecedor "${trimmedName}" já está cadastrado.`, 'error');
      return;
    }
    const maxId = suppliers.reduce((max, s) => Math.max(max, s.id), 0);
    const newSup: Supplier = { id: Math.max(maxId + 1, Date.now() * 1000 + Math.floor(Math.random() * 1000)), name: trimmedName };
    await saveSupplierToFirestore(newSup);
    showToast(`Fornecedor "${trimmedName}" salvo no Firestore!`);
  };

  const handleUpdateSupplier = async (id: number, name: string) => {
    const trimmedName = name.trim();
    const exists = suppliers.some(
      (s) => s.id !== id && s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (exists) {
      showToast(`Já existe outro fornecedor com o nome "${trimmedName}".`, 'error');
      return;
    }
    const current = suppliers.find((s) => s.id === id);
    const updated: Supplier = { id, name: trimmedName, firestoreId: current?.firestoreId, cnpj: current?.cnpj, companyId: current?.companyId };
    await saveSupplierToFirestore(updated);
    showToast('Fornecedor atualizado no Firestore!');
  };

  const handleDeleteSupplier = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir este fornecedor do Firestore?')) {
      const target = suppliers.find((s) => s.id === id);
      await deleteSupplierFromFirestore(id, target?.firestoreId);
      showToast('Fornecedor removido do Firestore.');
    }
  };

  // Employee Operations (Direct Cloud Firestore)
  const handleAddEmployee = async (name: string) => {
    const trimmedName = name.trim();
    // Rule: funcionário deve ser único por nome
    const exists = employees.some(
      (emp) =>
        emp.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (exists) {
      showToast(`Funcionário "${trimmedName}" já está cadastrado.`, 'error');
      return;
    }

    const maxId = employees.reduce((max, emp) => Math.max(max, emp.id), 0);
    const newEmp: Employee = { id: Math.max(maxId + 1, Date.now() * 1000 + Math.floor(Math.random() * 1000)), name: trimmedName };
    await saveEmployeeToFirestore(newEmp);
    showToast(`Funcionário "${trimmedName}" salvo no Firestore!`);
  };

  const handleUpdateEmployee = async (id: number, name: string) => {
    const trimmedName = name.trim();
    const exists = employees.some(
      (emp) =>
        emp.id !== id &&
        emp.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (exists) {
      showToast(`Já existe um cadastro de "${trimmedName}".`, 'error');
      return;
    }

    const current = employees.find((emp) => emp.id === id);
    const updated: Employee = { id, name: trimmedName, firestoreId: current?.firestoreId, companyId: current?.companyId };
    await saveEmployeeToFirestore(updated);
    showToast('Funcionário atualizado no Firestore!');
  };

  const handleDeleteEmployee = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir este funcionário do Firestore?')) {
      const target = employees.find((emp) => emp.id === id);
      await deleteEmployeeFromFirestore(id, target?.firestoreId);
      showToast('Funcionário removido do Firestore.');
    }
  };

  // Income Operations (Direct Cloud Firestore)
  const handleAddIncome = async (newIncomeData: Omit<IncomeEntry, 'id'>) => {
    const maxId = incomes.reduce((max, inc) => Math.max(max, inc.id), 0);
    const newIncome: IncomeEntry = {
      ...newIncomeData,
      id: Math.max(maxId + 1, Date.now() * 1000 + Math.floor(Math.random() * 1000)),
    };
    await saveIncomeToFirestore(newIncome);
    showToast(`Entrada da empresa "${newIncome.companyName}" salva no Firestore!`);
  };

  const handleDeleteIncome = async (id: number) => {
    const target = incomes.find((inc) => inc.id === id);
    await deleteIncomeFromFirestore(id, target?.firestoreId);
    showToast('Entrada excluída do Firestore.');
  };

  // JSON Backup / Import / Export to Firestore
  const handleExportJSON = () => {
    const backupData = {
      version: '2.0-cloud',
      exportedAt: new Date().toISOString(),
      suppliers,
      employees,
      entries: rawEntries,
      incomes,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_firestore_contas_${getTodayDateString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Backup JSON exportado com sucesso!');
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.suppliers && parsed.employees && parsed.entries) {
          showToast('Importando dados para o Cloud Firestore...', 'success');
          // Write all to Firestore, strictly stripping any foreign userId so save* assigns currentUser.uid
          if (Array.isArray(parsed.suppliers)) {
            for (const s of parsed.suppliers) {
              const { userId: _ignored, ...supData } = s;
              await saveSupplierToFirestore(supData);
            }
          }
          if (Array.isArray(parsed.employees)) {
            for (const emp of parsed.employees) {
              const { userId: _ignored, ...empData } = emp;
              await saveEmployeeToFirestore(empData);
            }
          }
          if (Array.isArray(parsed.entries)) {
            for (const entry of parsed.entries) {
              const { userId: _ignored, ...entryData } = entry;
              await saveEntryToFirestore(entryData);
            }
          }
          if (Array.isArray(parsed.incomes)) {
            for (const inc of parsed.incomes) {
              const { userId: _ignored, ...incData } = inc;
              await saveIncomeToFirestore(incData);
            }
          }
          showToast('Dados salvos no Cloud Firestore com sucesso!');
        } else {
          showToast('Formato de arquivo JSON inválido.', 'error');
        }
      } catch (err) {
        showToast('Erro ao ler ou importar arquivo JSON para o Firestore.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportCSV = () => {
    exportToCSV(calculatedEntries);
    showToast('Relatório CSV exportado!');
  };

  const handleClearAllData = async () => {
    if (confirm('⚠️ ATENÇÃO: Deseja REALMENTE apagar TODOS os lançamentos, receitas, fornecedores e funcionários do Firestore?')) {
      for (const e of rawEntries) await deleteEntryFromFirestore(e.id, e.firestoreId);
      for (const s of suppliers) await deleteSupplierFromFirestore(s.id, s.firestoreId);
      for (const emp of employees) await deleteEmployeeFromFirestore(emp.id, emp.firestoreId);
      for (const inc of incomes) await deleteIncomeFromFirestore(inc.id, inc.firestoreId);
      showToast('Todos os dados foram excluídos do Firestore.', 'error');
    }
  };

  if (loading || accessLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-4">
        <div className="relative mb-4">
          <img
            src="/icons/icon_512x512.png?v=2"
            alt="Carregando..."
            className="w-16 h-16 rounded-2xl animate-pulse shadow-2xl border border-slate-800 bg-slate-900 p-1"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/icons/icon_128x128.png?v=2';
            }}
          />
        </div>
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
        <p className="text-xs text-slate-400 font-medium">Carregando dados do Cloud Firestore...</p>
      </div>
    );
  }

  // Force login view to ensure every interaction uses Firebase Auth and Firestore Cloud
  if (!user) {
    return <LoginView />;
  }

  if (!hasAccess) {
    return <AccessBlockedView />;
  }

  const trialDaysRemaining = companyAccess?.status === 'trial' && companyAccess.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(companyAccess.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {trialDaysRemaining !== null && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 px-4 py-2 text-center text-xs sm:text-sm font-semibold text-amber-800 dark:text-amber-200">
          Teste gratuito: {trialDaysRemaining > 0 ? `${trialDaysRemaining} dia(s) restante(s)` : 'último dia de acesso'}. Após o período, a liberação mensal ou anual é feita pelo administrador.
        </div>
      )}
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium animate-in slide-in-from-bottom-5 duration-200 ${
            toast.type === 'success'
              ? 'bg-slate-900 text-white border-slate-700 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-800'
              : 'bg-rose-900 text-white border-rose-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSyncing={isSyncing}
        isOnline={isOnline}
        lastSyncedAt={lastSyncedAt}
      />

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-2.5 sm:px-4 lg:px-6 py-3 sm:py-4 pb-24 sm:pb-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            entries={calculatedEntries}
            suppliers={suppliers}
            employees={employees}
            incomes={incomes}
            onViewUpcomingDetails={() => setActiveTab('upcoming-details')}
            onViewOverdueDetails={() => setActiveTab('overdue-details')}
            onViewToPayDetails={() => setActiveTab('to-pay-details')}
            onViewPaidDetails={() => setActiveTab('paid-details')}
            onViewIncomesDetails={() => setActiveTab('incomes-details')}
          />
        )}

        {activeTab === 'upcoming-details' && (
          <Upcoming7DaysView
            entries={calculatedEntries}
            onBack={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'overdue-details' && (
          <StatusDetailsView
            entries={calculatedEntries}
            type="overdue"
            onBack={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'to-pay-details' && (
          <StatusDetailsView
            entries={calculatedEntries}
            type="to-pay"
            onBack={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'paid-details' && (
          <StatusDetailsView
            entries={calculatedEntries}
            type="paid"
            onBack={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'incomes-details' && (
          <StatusDetailsView
            incomes={incomes}
            type="incomes"
            onBack={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'entries' && (
          <EntriesView
            entries={calculatedEntries}
            suppliers={suppliers}
            employees={employees}
            incomes={incomes}
            onAddEntry={handleAddEntry}
            onUpdateEntry={handleUpdateEntry}
            onDeleteEntry={handleDeleteEntry}
            onDeleteMultipleEntries={handleDeleteMultipleEntries}
            onQuickTogglePaid={handleQuickTogglePaid}
            onAddIncome={handleAddIncome}
            onDeleteIncome={handleDeleteIncome}
          />
        )}

        {activeTab === 'suppliers' && (
          <SupplierReportView
            suppliers={suppliers}
            entries={calculatedEntries}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryView
            suppliers={suppliers}
            entries={rawEntries}
            showToast={showToast}
          />
        )}

        {activeTab === 'config' && (
          <ConfigView
            suppliers={suppliers}
            employees={employees}
            onAddSupplier={handleAddSupplier}
            onUpdateSupplier={handleUpdateSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            onExportJSON={handleExportJSON}
            onImportJSON={handleImportJSON}
            onExportCSV={handleExportCSV}
            onRestoreSampleData={() => {
              showToast('Para manter a integridade, use o cadastro direto de novos boletos.', 'error');
            }}
            onClearAllData={handleClearAllData}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            isSyncing={isSyncing}
            isOnline={isOnline}
            lastSyncedAt={lastSyncedAt}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-2.5 mt-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-[11px] text-slate-500 dark:text-slate-400">
          Financeiro &copy; {new Date().getFullYear()} &bull; Google Cloud Firestore Realtime &bull; 100% Nuvem
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
