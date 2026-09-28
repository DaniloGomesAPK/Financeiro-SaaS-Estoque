import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  db,
  collection,
  doc,
  setDoc,
  query,
  where,
  onSnapshot,
  runTransaction,
} from '../lib/firebase';
import {
  AuditLog,
  Entry,
  NfeItem,
  NfeRecord,
  StockMovement,
  StockMovementSource,
  StockMovementType,
  StockProduct,
  Supplier,
} from '../types';
import { ParsedNfe } from '../utils/nfeParser';

interface ProductInput {
  code: string;
  description: string;
  location: string;
  unit: string;
  pt: number;
  lt: number;
}

interface SelectedNfeItem extends NfeItem {
  selectedForStock: boolean;
  productId?: string;
}

const nowIso = () => new Date().toISOString();

export function useInventorySync(showToast: (message: string, type?: 'success' | 'error') => void) {
  const { user, companyId, hasAccess, accessLoading } = useAuth();
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [nfeRecords, setNfeRecords] = useState<NfeRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(true);

  useEffect(() => {
    if (!user || !companyId || accessLoading || !hasAccess) {
      setProducts([]); setMovements([]); setNfeRecords([]); setAuditLogs([]); setLoadingInventory(false);
      return;
    }
    setLoadingInventory(true);
    const unsubs: Array<() => void> = [];

    unsubs.push(onSnapshot(query(collection(db, 'products'), where('companyId', '==', companyId)), (snap) => {
      const rows: StockProduct[] = snap.docs.map((d) => ({ firestoreId: d.id, ...(d.data() as Omit<StockProduct, 'firestoreId'>) }));
      rows.sort((a, b) => a.code.localeCompare(b.code, 'pt-BR'));
      setProducts(rows);
      setLoadingInventory(false);
    }, (err) => { console.error(err); setLoadingInventory(false); }));

    unsubs.push(onSnapshot(query(collection(db, 'stockMovements'), where('companyId', '==', companyId)), (snap) => {
      const rows: StockMovement[] = snap.docs.map((d) => ({ firestoreId: d.id, ...(d.data() as Omit<StockMovement, 'firestoreId'>) }));
      rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      setMovements(rows);
    }, console.error));

    unsubs.push(onSnapshot(query(collection(db, 'nfe'), where('companyId', '==', companyId)), (snap) => {
      const rows: NfeRecord[] = snap.docs.map((d) => ({ firestoreId: d.id, ...(d.data() as Omit<NfeRecord, 'firestoreId'>) }));
      rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      setNfeRecords(rows);
    }, console.error));

    unsubs.push(onSnapshot(query(collection(db, 'auditLogs'), where('companyId', '==', companyId)), (snap) => {
      const rows: AuditLog[] = snap.docs.map((d) => ({ firestoreId: d.id, ...(d.data() as Omit<AuditLog, 'firestoreId'>) }));
      rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      setAuditLogs(rows.slice(0, 300));
    }, console.error));

    return () => unsubs.forEach((unsub) => unsub());
  }, [user, companyId, hasAccess, accessLoading]);

  const purchaseNeeds = useMemo(() => products.filter((p) => p.active !== false && p.currentStock < p.pt), [products]);

  const makeAudit = (action: string, entityType: AuditLog['entityType'], entityId: string, description: string, changes?: Record<string, unknown>) => ({
    companyId: companyId!, action, entityType, entityId, description,
    actorUid: user!.uid, actorEmail: user!.email || '', createdAt: nowIso(), ...(changes ? { changes } : {}),
  });

  const addProduct = async (input: ProductInput) => {
    if (!user || !companyId) throw new Error('Usuário não autenticado.');
    const normalizedCode = input.code.trim().toUpperCase();
    if (!normalizedCode) throw new Error('Informe o código do produto.');
    if (products.some((p) => p.code.trim().toUpperCase() === normalizedCode && p.active !== false)) {
      throw new Error(`Já existe um item com o código ${normalizedCode}.`);
    }
    // Deterministic ID enforces one internal product code per company, even with simultaneous users.
    const productRef = doc(db, 'products', `${companyId}_${encodeURIComponent(normalizedCode)}`);
    const auditRef = doc(collection(db, 'auditLogs'));
    const timestamp = nowIso();
    await runTransaction(db, async (tx) => {
      const existing = await tx.get(productRef);
      if (existing.exists()) throw new Error(`Já existe um item com o código ${normalizedCode}.`);
      tx.set(productRef, {
        ...input,
        code: normalizedCode,
        description: input.description.trim(),
        location: input.location.trim(),
        unit: input.unit.trim().toUpperCase() || 'UN',
        pt: Math.max(0, Number(input.pt) || 0),
        lt: Math.max(0, Number(input.lt) || 0),
        currentStock: 0,
        active: true,
        companyId,
        createdAt: timestamp,
        createdBy: user.uid,
        updatedAt: timestamp,
        updatedBy: user.uid,
      });
      tx.set(auditRef, makeAudit('CREATE', 'STOCK_PRODUCT', productRef.id, `Produto ${normalizedCode} cadastrado.`));
    });
    showToast('Produto cadastrado no estoque.');
    return productRef.id;
  };

  const updateProduct = async (product: StockProduct, input: ProductInput) => {
    if (!user || !companyId) throw new Error('Usuário não autenticado.');
    const normalizedCode = input.code.trim().toUpperCase();
    if (normalizedCode !== product.code.trim().toUpperCase()) {
      throw new Error('O código interno não pode ser alterado após o cadastro. Crie um novo item se precisar trocar o código.');
    }
    const productRef = doc(db, 'products', product.firestoreId);
    const auditRef = doc(collection(db, 'auditLogs'));
    await runTransaction(db, async (tx) => {
      tx.update(productRef, {
        ...input,
        code: normalizedCode,
        description: input.description.trim(),
        location: input.location.trim(),
        unit: input.unit.trim().toUpperCase() || 'UN',
        pt: Math.max(0, Number(input.pt) || 0),
        lt: Math.max(0, Number(input.lt) || 0),
        updatedAt: nowIso(),
        updatedBy: user.uid,
      });
      tx.set(auditRef, makeAudit('UPDATE', 'STOCK_PRODUCT', product.firestoreId, `Produto ${normalizedCode} atualizado.`, {
        before: { code: product.code, description: product.description, location: product.location, pt: product.pt, lt: product.lt },
        after: input,
      }));
    });
    showToast('Produto atualizado.');
  };

  const registerMovement = async (
    product: StockProduct,
    type: StockMovementType,
    quantity: number,
    source: StockMovementSource,
    observation = '',
    extra?: { nfeId?: string; nfeNumber?: string; reversalOf?: string }
  ) => {
    if (!user || !companyId) throw new Error('Usuário não autenticado.');
    const qty = Math.abs(Number(quantity) || 0);
    if (qty <= 0) throw new Error('Informe uma quantidade maior que zero.');
    const productRef = doc(db, 'products', product.firestoreId);
    const movementRef = doc(collection(db, 'stockMovements'));
    const auditRef = doc(collection(db, 'auditLogs'));

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(productRef);
      if (!snap.exists()) throw new Error('Produto não encontrado.');
      const current = Number(snap.data().currentStock || 0);
      const delta = type === 'ENTRY' ? qty : type === 'OUT' || type === 'REVERSAL' ? -qty : Number(quantity);
      const next = current + delta;
      if (next < 0) throw new Error(`Saldo insuficiente. Saldo atual: ${current}.`);
      const timestamp = nowIso();
      tx.update(productRef, { currentStock: next, updatedAt: timestamp, updatedBy: user.uid });
      tx.set(movementRef, {
        companyId, productId: product.firestoreId, productCode: product.code, productDescription: product.description,
        type, source, quantity: Math.abs(delta), previousStock: current, newStock: next,
        observation: observation.trim(), createdAt: timestamp, createdBy: user.uid, createdByEmail: user.email || '',
        ...(extra || {}),
      });
      tx.set(auditRef, makeAudit('CREATE', 'STOCK_MOVEMENT', movementRef.id, `${type} de ${Math.abs(delta)} ${product.unit} em ${product.code}.`, { previousStock: current, newStock: next, source }));
    });
    showToast('Movimentação de estoque registrada.');
  };

  const confirmNfeImport = async (
    parsed: ParsedNfe,
    supplier: Supplier,
    items: SelectedNfeItem[],
  ) => {
    if (!user || !companyId) throw new Error('Usuário não autenticado.');
    if (!supplier) throw new Error('Selecione o fornecedor correspondente à NF-e.');
    const selected = items.filter((i) => i.selectedForStock);
    const missingProduct = selected.find((i) => !i.productId);
    if (missingProduct) throw new Error(`Associe o item "${missingProduct.description}" a um produto do estoque.`);

    const stableKey = (parsed.accessKey || `${parsed.supplierCnpj}_${parsed.number}_${parsed.series}_${parsed.issueDate}`).replace(/[^a-zA-Z0-9_-]/g, '');
    const nfeRef = doc(db, 'nfe', `${companyId}_${stableKey}`);
    const productRefs = selected.map((item) => doc(db, 'products', item.productId!));
    const importNumericBase = Date.now() * 1000;

    await runTransaction(db, async (tx) => {
      const existingNfe = await tx.get(nfeRef);
      if (existingNfe.exists()) throw new Error(`A NF ${parsed.number} já foi importada.`);

      // All product reads must happen before writes.
      const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));
      productSnaps.forEach((snap, index) => {
        if (!snap.exists()) throw new Error(`Produto associado ao item ${selected[index].description} não foi encontrado.`);
      });

      const timestamp = nowIso();
      if (supplier.firestoreId && parsed.supplierCnpj) {
        tx.update(doc(db, 'suppliers', supplier.firestoreId), {
          cnpj: parsed.supplierCnpj,
          updatedAt: timestamp,
        });
      }
      tx.set(nfeRef, {
        companyId,
        accessKey: parsed.accessKey || stableKey,
        number: parsed.number,
        series: parsed.series,
        supplierId: String(supplier.id),
        supplierName: supplier.name,
        supplierCnpj: parsed.supplierCnpj,
        issueDate: parsed.issueDate,
        totalValue: parsed.totalValue,
        status: 'ACTIVE',
        installments: parsed.installments,
        stockItemsCount: selected.length,
        createdAt: timestamp,
        createdBy: user.uid,
        createdByEmail: user.email || '',
        reviewRequired: false,
      });

      // Keep item details without storing the XML file.
      items.forEach((item) => {
        const itemRef = doc(collection(db, 'nfeItems'));
        tx.set(itemRef, {
          companyId,
          nfeId: nfeRef.id,
          nfeNumber: parsed.number,
          line: item.line,
          supplierCode: item.supplierCode,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unitValue: item.unitValue,
          totalValue: item.totalValue,
          selectedForStock: Boolean(item.selectedForStock),
          productId: item.productId || '',
        });
      });

      // Create financial installments directly in the existing entries collection.
      parsed.installments.forEach((installment, installmentIndex) => {
        const entryRef = doc(collection(db, 'entries'));
        const entryId = importNumericBase + installmentIndex;
        tx.set(entryRef, {
          id: entryId,
          favorecidoId: `forn-${supplier.id}`,
          favorecidoName: supplier.name,
          favorecidoType: 'Fornecedor',
          docType: 'Boleto',
          nfNumber: parsed.number,
          dueDate: installment.dueDate,
          value: installment.value,
          valor: installment.value,
          paymentDate: '',
          interestRate: 0,
          source: 'nfe',
          nfeId: nfeRef.id,
          nfeKey: parsed.accessKey || stableKey,
          installmentNumber: installment.number,
          cancelled: false,
          userId: user.uid,
          companyId,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      });

      selected.forEach((item, index) => {
        const productSnap = productSnaps[index];
        if (!productSnap.exists()) throw new Error(`Produto associado ao item ${item.description} não foi encontrado.`);
        const productData = productSnap.data();
        const current = Number(productData.currentStock || 0);
        const next = current + Number(item.quantity || 0);
        const productRef = productRefs[index];
        const movementRef = doc(collection(db, 'stockMovements'));
        tx.update(productRef, { currentStock: next, updatedAt: timestamp, updatedBy: user.uid });
        tx.set(movementRef, {
          companyId,
          productId: productRef.id,
          productCode: productData.code || '',
          productDescription: productData.description || item.description,
          type: 'ENTRY',
          source: 'NFE',
          quantity: Number(item.quantity || 0),
          previousStock: current,
          newStock: next,
          nfeId: nfeRef.id,
          nfeNumber: parsed.number,
          observation: `Entrada automática pela NF-e ${parsed.number}`,
          createdAt: timestamp,
          createdBy: user.uid,
          createdByEmail: user.email || '',
        });
      });

      const auditRef = doc(collection(db, 'auditLogs'));
      tx.set(auditRef, makeAudit('IMPORT', 'NFE', nfeRef.id, `NF ${parsed.number} importada: ${parsed.installments.length} parcela(s) e ${selected.length} item(ns) movimentado(s).`, {
        supplier: supplier.name,
        installments: parsed.installments.length,
        stockItems: selected.length,
      }));
    });

    showToast(`NF ${parsed.number} importada com sucesso.`);
  };

  const cancelNfe = async (record: NfeRecord, reason: string) => {
    if (!user || !companyId) throw new Error('Usuário não autenticado.');
    if (record.status === 'CANCELLED') throw new Error('Esta NF já está cancelada.');
    const nfeRef = doc(db, 'nfe', record.firestoreId);
    const auditRef = doc(collection(db, 'auditLogs'));
    const timestamp = nowIso();
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(nfeRef);
      if (!snap.exists()) throw new Error('NF não encontrada.');
      tx.update(nfeRef, {
        status: 'CANCELLED',
        cancelledAt: timestamp,
        cancelledBy: user.uid,
        cancelledByEmail: user.email || '',
        cancelReason: reason.trim(),
        reviewRequired: true,
      });
      tx.set(auditRef, makeAudit('CANCEL', 'NFE', record.firestoreId, `NF ${record.number} do fornecedor ${record.supplierName} marcada como cancelada. Revisão de financeiro/estoque necessária.`, { reason: reason.trim() }));
    });
    showToast('NF cancelada. Os vínculos financeiros e de estoque precisam ser revisados.', 'error');
  };

  const cancelOpenFinancialEntriesForNfe = async (record: NfeRecord, linkedEntries: Entry[]) => {
    if (!user || !companyId) throw new Error('Usuário não autenticado.');
    const openEntries = linkedEntries.filter((e) => e.nfeId === record.firestoreId && !e.paymentDate && !e.cancelled && e.firestoreId);
    if (openEntries.length === 0) throw new Error('Não existem parcelas abertas para cancelar.');
    const auditRef = doc(collection(db, 'auditLogs'));
    await runTransaction(db, async (tx) => {
      for (const entry of openEntries) {
        tx.update(doc(db, 'entries', entry.firestoreId!), {
          cancelled: true,
          cancelReason: `NF ${record.number} cancelada`,
          cancelledAt: nowIso(),
          cancelledBy: user.uid,
        });
      }
      tx.set(auditRef, makeAudit(
        'CANCEL_LINKED_ENTRIES',
        'FINANCIAL_ENTRY',
        record.firestoreId,
        `${openEntries.length} parcela(s) aberta(s) da NF ${record.number} foram marcadas como canceladas sem exclusão do histórico.`
      ));
    });
    showToast(`${openEntries.length} parcela(s) aberta(s) cancelada(s).`);
  };

  const reverseNfeStock = async (record: NfeRecord) => {
    if (!user || !companyId) throw new Error('Usuário não autenticado.');
    const originalEntries = movements.filter((m) => m.nfeId === record.firestoreId && m.type === 'ENTRY');
    if (originalEntries.length === 0) throw new Error('Esta NF não possui entradas de estoque para estornar.');

    const pending = originalEntries.filter((m) => !movements.some((r) => r.type === 'REVERSAL' && r.reversalOf === m.firestoreId));
    if (pending.length === 0) throw new Error('Todas as entradas de estoque desta NF já foram estornadas.');

    const productRefs = pending.map((m) => doc(db, 'products', m.productId));
    const reversalRefs = pending.map((m) => doc(db, 'stockMovements', `reversal_${m.firestoreId}`));
    const auditRef = doc(collection(db, 'auditLogs'));

    await runTransaction(db, async (tx) => {
      const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));
      const reversalSnaps = await Promise.all(reversalRefs.map((ref) => tx.get(ref)));

      pending.forEach((movement, index) => {
        if (reversalSnaps[index].exists()) return;
        const productSnap = productSnaps[index];
        if (!productSnap.exists()) throw new Error(`Produto ${movement.productCode} não encontrado.`);
        const current = Number(productSnap.data().currentStock || 0);
        const qty = Number(movement.quantity || 0);
        if (current < qty) {
          throw new Error(`Não é possível estornar ${movement.productCode}: saldo atual ${current} é menor que a entrada original ${qty}. Faça a revisão manual do item.`);
        }
      });

      const timestamp = nowIso();
      let reversedCount = 0;
      pending.forEach((movement, index) => {
        if (reversalSnaps[index].exists()) return;
        const productSnap = productSnaps[index];
        if (!productSnap.exists()) throw new Error(`Produto ${movement.productCode} não encontrado.`);
        const productData = productSnap.data();
        const current = Number(productData.currentStock || 0);
        const qty = Number(movement.quantity || 0);
        const next = current - qty;
        tx.update(productRefs[index], { currentStock: next, updatedAt: timestamp, updatedBy: user.uid });
        tx.set(reversalRefs[index], {
          companyId,
          productId: movement.productId,
          productCode: movement.productCode,
          productDescription: movement.productDescription,
          type: 'REVERSAL',
          source: 'REVERSAL',
          quantity: qty,
          previousStock: current,
          newStock: next,
          nfeId: record.firestoreId,
          nfeNumber: record.number,
          observation: `Estorno da entrada originada pela NF ${record.number}`,
          reversalOf: movement.firestoreId,
          createdAt: timestamp,
          createdBy: user.uid,
          createdByEmail: user.email || '',
        });
        reversedCount += 1;
      });
      tx.set(auditRef, makeAudit('REVERSAL', 'STOCK_MOVEMENT', record.firestoreId, `Estorno de ${reversedCount} entrada(s) de estoque da NF ${record.number}.`));
    });
    showToast('Entradas de estoque da NF estornadas com sucesso.');
  };

  const markNfeReviewed = async (record: NfeRecord) => {
    if (!user || !companyId) return;
    const nfeRef = doc(db, 'nfe', record.firestoreId);
    const auditRef = doc(collection(db, 'auditLogs'));
    await runTransaction(db, async (tx) => {
      tx.update(nfeRef, { reviewRequired: false, reviewedAt: nowIso(), reviewedBy: user.uid });
      tx.set(auditRef, makeAudit('REVIEW', 'NFE', record.firestoreId, `Revisão do cancelamento da NF ${record.number} concluída.`));
    });
    showToast('Revisão da NF marcada como concluída.');
  };

  return {
    products,
    movements,
    nfeRecords,
    auditLogs,
    purchaseNeeds,
    loadingInventory,
    addProduct,
    updateProduct,
    registerMovement,
    confirmNfeImport,
    cancelNfe,
    cancelOpenFinancialEntriesForNfe,
    reverseNfeStock,
    markNfeReviewed,
  };
}
