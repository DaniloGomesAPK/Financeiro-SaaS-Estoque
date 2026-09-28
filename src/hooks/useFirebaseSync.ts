import type React from 'react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  db,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  writeBatch,
} from '../lib/firebase';
import { Entry, Supplier, Employee, IncomeEntry } from '../types';
import { parseCurrencyInput } from '../utils/calculations';

interface FirebaseSyncParams {
  setRawEntries: React.Dispatch<React.SetStateAction<Entry[]>>;
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
  setIncomes: React.Dispatch<React.SetStateAction<IncomeEntry[]>>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

type FirestoreDocLike = { id: string; data: () => any };

const uniqueByFirestoreId = <T extends { firestoreId?: string }>(items: T[]): T[] => {
  const map = new Map<string, T>();
  items.forEach((item, index) => map.set(item.firestoreId || `legacy-${index}`, item));
  return [...map.values()];
};

export function useFirebaseSync({
  setRawEntries,
  setSuppliers,
  setEmployees,
  setIncomes,
  showToast,
}: FirebaseSyncParams) {
  const { user, companyId, hasAccess, accessLoading } = useAuth();
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const migrationAttempted = useRef<string | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Conectado à nuvem Firebase.', 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('Sem conexão de rede.', 'error');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showToast]);

  const updateSyncTimestamp = useCallback(() => setLastSyncedAt(new Date()), []);

  // Backfill companyId on legacy documents owned by the current account.
  // It is additive: no document is renamed, deleted or recreated.
  useEffect(() => {
    if (!user || !companyId || accessLoading || !hasAccess) return;
    const migrationKey = `${user.uid}:${companyId}`;
    if (migrationAttempted.current === migrationKey) return;
    migrationAttempted.current = migrationKey;

    const migrate = async () => {
      const collections = ['entries', 'suppliers', 'employees', 'incomes'];
      try {
        for (const collectionName of collections) {
          const snap = await getDocs(query(collection(db, collectionName), where('userId', '==', user.uid)));
          for (const item of snap.docs) {
            const data = item.data();
            if (!data.companyId) {
              await setDoc(doc(db, collectionName, item.id), { companyId }, { merge: true });
            }
          }
        }
      } catch (error) {
        console.warn('Migração compatível de companyId não concluída:', error);
      }
    };
    void migrate();
  }, [user, companyId, hasAccess, accessLoading]);

  useEffect(() => {
    if (!user || !companyId || accessLoading || !hasAccess) {
      setRawEntries([]);
      setSuppliers([]);
      setEmployees([]);
      setIncomes([]);
      return;
    }

    const uid = user.uid;
    setIsSyncing(true);

    const entrySnapshots: { company: Entry[]; legacy: Entry[] } = { company: [], legacy: [] };
    const supplierSnapshots: { company: Supplier[]; legacy: Supplier[] } = { company: [], legacy: [] };
    const employeeSnapshots: { company: Employee[]; legacy: Employee[] } = { company: [], legacy: [] };
    const incomeSnapshots: { company: IncomeEntry[]; legacy: IncomeEntry[] } = { company: [], legacy: [] };

    const parseEntry = (d: FirestoreDocLike): Entry => {
      const data = d.data();
      const docIdNum = Number(data.id ?? d.id.replace(/^.*_entry_/, ''));
      const rawVal = data.value ?? data.valor ?? data.amount ?? data.total ?? 0;
      const parsedVal = typeof rawVal === 'number' && !isNaN(rawVal) ? rawVal : parseCurrencyInput(rawVal);
      const safeVal = !isNaN(parsedVal) && parsedVal >= 0 ? parsedVal : 0;
      const rawName = (
        data.favorecidoName || data.supplierName || data.fornecedor || data.fornecedorNome ||
        data.favorecido || data.nome || data.nomeFavorecido || data.name || data.razaoSocial || ''
      ).toString().trim();
      const rawFavorecidoId = (data.favorecidoId || data.supplierId || data.fornecedorId || '').toString().trim();
      let rawFavorecidoType = (data.favorecidoType || data.tipoFavorecido || '').toString().trim();
      if (rawFavorecidoType !== 'Fornecedor' && rawFavorecidoType !== 'Funcionário') {
        rawFavorecidoType = rawFavorecidoId.startsWith('func-') ? 'Funcionário' : 'Fornecedor';
      }
      const rawInterest = typeof data.interestRate === 'number' && !isNaN(data.interestRate)
        ? data.interestRate
        : parseCurrencyInput(data.interestRate ?? data.juros ?? 0);
      return {
        id: isNaN(docIdNum) ? Number(data.id || Date.now()) : docIdNum,
        firestoreId: d.id,
        companyId: data.companyId || companyId,
        favorecidoId: rawFavorecidoId,
        favorecidoName: rawName,
        favorecidoType: rawFavorecidoType as 'Fornecedor' | 'Funcionário',
        docType: (data.docType || data.tipoDocumento || data.tipoDoc || 'Boleto') as Entry['docType'],
        nfNumber: (data.nfNumber || data.numeroNF || data.notaFiscal || '').toString().trim(),
        dueDate: (data.dueDate || data.dataVencimento || data.vencimento || '').toString().trim(),
        value: safeVal,
        paymentDate: (data.paymentDate || data.dataPagamento || '').toString().trim(),
        interestRate: !isNaN(rawInterest) ? rawInterest : 0,
        source: data.source || 'manual',
        nfeId: data.nfeId || '',
        nfeKey: data.nfeKey || '',
        installmentNumber: data.installmentNumber || '',
        cancelled: Boolean(data.cancelled),
        cancelReason: data.cancelReason || '',
      };
    };

    const publishEntries = () => {
      const merged = uniqueByFirestoreId([...entrySnapshots.company, ...entrySnapshots.legacy]);
      merged.sort((a, b) => b.id - a.id);
      setRawEntries(merged);
    };
    const publishSuppliers = () => {
      const merged = uniqueByFirestoreId([...supplierSnapshots.company, ...supplierSnapshots.legacy]);
      merged.sort((a, b) => a.id - b.id);
      setSuppliers(merged);
    };
    const publishEmployees = () => {
      const merged = uniqueByFirestoreId([...employeeSnapshots.company, ...employeeSnapshots.legacy]);
      merged.sort((a, b) => a.id - b.id);
      setEmployees(merged);
    };
    const publishIncomes = () => {
      const merged = uniqueByFirestoreId([...incomeSnapshots.company, ...incomeSnapshots.legacy]);
      merged.sort((a, b) => b.id - a.id);
      setIncomes(merged);
    };

    const qEntriesCompany = query(collection(db, 'entries'), where('companyId', '==', companyId));
    const qEntriesLegacy = query(collection(db, 'entries'), where('userId', '==', uid));
    const unsubEntriesCompany = onSnapshot(qEntriesCompany, (snap) => {
      entrySnapshots.company = snap.docs.map(parseEntry);
      setIsSyncing(false); updateSyncTimestamp(); publishEntries();
    }, (err) => { setIsSyncing(false); console.error(err); showToast('Erro ao carregar lançamentos.', 'error'); });
    const unsubEntriesLegacy = onSnapshot(qEntriesLegacy, (snap) => {
      entrySnapshots.legacy = snap.docs.map(parseEntry); publishEntries();
    }, (err) => console.error(err));

    const parseSupplier = (d: FirestoreDocLike): Supplier => {
      const data = d.data();
      return {
        id: Number(data.id ?? d.id.replace(/^.*_sup_/, '')),
        firestoreId: d.id,
        companyId: data.companyId || companyId,
        name: data.name || '',
        cnpj: data.cnpj || '',
      };
    };
    const qSupCompany = query(collection(db, 'suppliers'), where('companyId', '==', companyId));
    const qSupLegacy = query(collection(db, 'suppliers'), where('userId', '==', uid));
    const unsubSupCompany = onSnapshot(qSupCompany, (snap) => { supplierSnapshots.company = snap.docs.map(parseSupplier); publishSuppliers(); }, console.error);
    const unsubSupLegacy = onSnapshot(qSupLegacy, (snap) => { supplierSnapshots.legacy = snap.docs.map(parseSupplier); publishSuppliers(); }, console.error);

    const parseEmployee = (d: FirestoreDocLike): Employee => {
      const data = d.data();
      return { id: Number(data.id ?? d.id.replace(/^.*_emp_/, '')), firestoreId: d.id, companyId: data.companyId || companyId, name: data.name || '' };
    };
    const qEmpCompany = query(collection(db, 'employees'), where('companyId', '==', companyId));
    const qEmpLegacy = query(collection(db, 'employees'), where('userId', '==', uid));
    const unsubEmpCompany = onSnapshot(qEmpCompany, (snap) => { employeeSnapshots.company = snap.docs.map(parseEmployee); publishEmployees(); }, console.error);
    const unsubEmpLegacy = onSnapshot(qEmpLegacy, (snap) => { employeeSnapshots.legacy = snap.docs.map(parseEmployee); publishEmployees(); }, console.error);

    const parseIncome = (d: FirestoreDocLike): IncomeEntry => {
      const data = d.data();
      return {
        id: Number(data.id ?? d.id.replace(/^.*_inc_/, '')),
        firestoreId: d.id,
        companyId: data.companyId || companyId,
        companyName: data.companyName || '',
        value: Number(data.value || 0),
        date: data.date || '',
        description: data.description || '',
        forma_recebimento: data.forma_recebimento || '',
      };
    };
    const qIncCompany = query(collection(db, 'incomes'), where('companyId', '==', companyId));
    const qIncLegacy = query(collection(db, 'incomes'), where('userId', '==', uid));
    const unsubIncCompany = onSnapshot(qIncCompany, (snap) => { incomeSnapshots.company = snap.docs.map(parseIncome); publishIncomes(); }, console.error);
    const unsubIncLegacy = onSnapshot(qIncLegacy, (snap) => { incomeSnapshots.legacy = snap.docs.map(parseIncome); publishIncomes(); }, console.error);

    return () => {
      unsubEntriesCompany(); unsubEntriesLegacy();
      unsubSupCompany(); unsubSupLegacy();
      unsubEmpCompany(); unsubEmpLegacy();
      unsubIncCompany(); unsubIncLegacy();
    };
  }, [user, companyId, hasAccess, accessLoading]);

  const getCreateOrExistingRef = (collectionName: string, firestoreId?: string) =>
    firestoreId ? doc(db, collectionName, firestoreId) : doc(collection(db, collectionName));

  const makeAuditPayload = (action: string, entityType: string, entityId: string, description: string, changes?: Record<string, unknown>) => ({
    companyId: companyId!,
    action,
    entityType,
    entityId,
    description,
    actorUid: user!.uid,
    actorEmail: user!.email || '',
    createdAt: new Date().toISOString(),
    ...(changes ? { changes } : {}),
  });

  const saveEntryToFirestore = async (entry: Entry) => {
    if (!user || !companyId) throw new Error('Usuário/empresa não disponível.');
    setIsSyncing(true);
    try {
      const safeValue = typeof entry.value === 'number' && !isNaN(entry.value) ? Math.max(entry.value, 0) : Math.max(parseCurrencyInput(entry.value ?? 0), 0);
      const isNew = !entry.firestoreId;
      const docRef = getCreateOrExistingRef('entries', entry.firestoreId);
      const auditRef = doc(collection(db, 'auditLogs'));
      const { firestoreId: _ignore, ...payload } = entry;
      const batch = writeBatch(db);
      batch.set(docRef, {
        ...payload,
        favorecidoName: (entry.favorecidoName || '').trim() || 'Fornecedor não informado',
        value: safeValue,
        valor: safeValue,
        favorecidoType: entry.favorecidoType || 'Fornecedor',
        docType: entry.docType || 'Boleto',
        ...(entry.firestoreId ? {} : { userId: user.uid }),
        companyId,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      batch.set(auditRef, makeAuditPayload(
        isNew ? 'CREATE' : 'UPDATE',
        'FINANCIAL_ENTRY',
        docRef.id,
        `${isNew ? 'Lançamento criado' : 'Lançamento atualizado'}: ${entry.favorecidoName || 'Fornecedor'}${entry.nfNumber ? ` / NF ${entry.nfNumber}` : ''}.`,
        { value: safeValue, dueDate: entry.dueDate, paymentDate: entry.paymentDate || '' }
      ));
      await batch.commit();
      updateSyncTimestamp();
    } finally { setIsSyncing(false); }
  };

  const deleteEntryFromFirestore = async (entryId: number, firestoreId?: string) => {
    if (!user || !companyId) return;
    const docRef = firestoreId ? doc(db, 'entries', firestoreId) : doc(db, 'entries', `${user.uid}_entry_${entryId}`);
    const auditRef = doc(collection(db, 'auditLogs'));
    const batch = writeBatch(db);
    batch.delete(docRef);
    batch.set(auditRef, makeAuditPayload('DELETE', 'FINANCIAL_ENTRY', firestoreId || String(entryId), `Lançamento ${entryId} excluído.`));
    await batch.commit();
    updateSyncTimestamp();
  };

  const saveSupplierToFirestore = async (supplier: Supplier) => {
    if (!user || !companyId) return;
    const docRef = getCreateOrExistingRef('suppliers', supplier.firestoreId);
    const auditRef = doc(collection(db, 'auditLogs'));
    const isNew = !supplier.firestoreId;
    const { firestoreId: _ignore, ...payload } = supplier;
    const batch = writeBatch(db);
    batch.set(docRef, { ...payload, ...(supplier.firestoreId ? {} : { userId: user.uid }), companyId, updatedAt: new Date().toISOString() }, { merge: true });
    batch.set(auditRef, makeAuditPayload(isNew ? 'CREATE' : 'UPDATE', 'OTHER', docRef.id, `${isNew ? 'Fornecedor cadastrado' : 'Fornecedor atualizado'}: ${supplier.name}.`));
    await batch.commit();
    updateSyncTimestamp();
  };

  const deleteSupplierFromFirestore = async (supplierId: number, firestoreId?: string) => {
    if (!user || !companyId) return;
    const docRef = firestoreId ? doc(db, 'suppliers', firestoreId) : doc(db, 'suppliers', `${user.uid}_sup_${supplierId}`);
    const auditRef = doc(collection(db, 'auditLogs'));
    const batch = writeBatch(db);
    batch.delete(docRef);
    batch.set(auditRef, makeAuditPayload('DELETE', 'OTHER', firestoreId || String(supplierId), `Fornecedor ${supplierId} excluído.`));
    await batch.commit();
    updateSyncTimestamp();
  };

  const saveEmployeeToFirestore = async (employee: Employee) => {
    if (!user || !companyId) return;
    const docRef = getCreateOrExistingRef('employees', employee.firestoreId);
    const auditRef = doc(collection(db, 'auditLogs'));
    const isNew = !employee.firestoreId;
    const { firestoreId: _ignore, ...payload } = employee;
    const batch = writeBatch(db);
    batch.set(docRef, { ...payload, ...(employee.firestoreId ? {} : { userId: user.uid }), companyId, updatedAt: new Date().toISOString() }, { merge: true });
    batch.set(auditRef, makeAuditPayload(isNew ? 'CREATE' : 'UPDATE', 'OTHER', docRef.id, `${isNew ? 'Funcionário cadastrado' : 'Funcionário atualizado'}: ${employee.name}.`));
    await batch.commit();
    updateSyncTimestamp();
  };

  const deleteEmployeeFromFirestore = async (employeeId: number, firestoreId?: string) => {
    if (!user || !companyId) return;
    const docRef = firestoreId ? doc(db, 'employees', firestoreId) : doc(db, 'employees', `${user.uid}_emp_${employeeId}`);
    const auditRef = doc(collection(db, 'auditLogs'));
    const batch = writeBatch(db);
    batch.delete(docRef);
    batch.set(auditRef, makeAuditPayload('DELETE', 'OTHER', firestoreId || String(employeeId), `Funcionário ${employeeId} excluído.`));
    await batch.commit();
    updateSyncTimestamp();
  };

  const saveIncomeToFirestore = async (income: IncomeEntry) => {
    if (!user || !companyId) return;
    const docRef = getCreateOrExistingRef('incomes', income.firestoreId);
    const auditRef = doc(collection(db, 'auditLogs'));
    const isNew = !income.firestoreId;
    const { firestoreId: _ignore, ...payload } = income;
    const batch = writeBatch(db);
    batch.set(docRef, { ...payload, ...(income.firestoreId ? {} : { userId: user.uid }), companyId, updatedAt: new Date().toISOString() }, { merge: true });
    batch.set(auditRef, makeAuditPayload(isNew ? 'CREATE' : 'UPDATE', 'OTHER', docRef.id, `${isNew ? 'Entrada financeira cadastrada' : 'Entrada financeira atualizada'}: ${income.companyName}.`, { value: income.value, date: income.date }));
    await batch.commit();
    updateSyncTimestamp();
  };

  const deleteIncomeFromFirestore = async (incomeId: number, firestoreId?: string) => {
    if (!user || !companyId) return;
    const docRef = firestoreId ? doc(db, 'incomes', firestoreId) : doc(db, 'incomes', `${user.uid}_inc_${incomeId}`);
    const auditRef = doc(collection(db, 'auditLogs'));
    const batch = writeBatch(db);
    batch.delete(docRef);
    batch.set(auditRef, makeAuditPayload('DELETE', 'OTHER', firestoreId || String(incomeId), `Entrada financeira ${incomeId} excluída.`));
    await batch.commit();
    updateSyncTimestamp();
  };

  return {
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
  };
}
