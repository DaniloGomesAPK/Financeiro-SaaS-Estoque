import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Boxes,
  CheckCircle2,
  FileDown,
  FileText,
  History,
  PackagePlus,
  Plus,
  Search,
  ShoppingCart,
  Upload,
  X,
} from 'lucide-react';
import { Entry, NfeItem, StockProduct, Supplier } from '../types';
import { useInventorySync } from '../hooks/useInventorySync';
import { parseNfeXml, ParsedNfe } from '../utils/nfeParser';
import { generateStockPurchaseReport } from '../utils/stockPdf';
import { useAuth } from '../context/AuthContext';

interface InventoryViewProps {
  suppliers: Supplier[];
  entries: Entry[];
  showToast: (message: string, type?: 'success' | 'error') => void;
}

type InventoryTab = 'products' | 'movements' | 'import' | 'nfe' | 'audit';

type ProductFormState = {
  code: string;
  description: string;
  location: string;
  unit: string;
  pt: string;
  lt: string;
};

const emptyProductForm: ProductFormState = {
  code: '', description: '', location: '', unit: 'UN', pt: '0', lt: '0',
};

const formatNumber = (value: number) => Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const formatMoney = (value: number) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR');
};

export const InventoryView: React.FC<InventoryViewProps> = ({ suppliers, entries, showToast }) => {
  const { user } = useAuth();
  const {
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
  } = useInventorySync(showToast);

  const [tab, setTab] = useState<InventoryTab>('products');
  const [search, setSearch] = useState('');
  const [onlyPurchase, setOnlyPurchase] = useState(false);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [editingProduct, setEditingProduct] = useState<StockProduct | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);

  const [movementProductId, setMovementProductId] = useState('');
  const [movementType, setMovementType] = useState<'ENTRY' | 'OUT' | 'ADJUSTMENT'>('ENTRY');
  const [movementQty, setMovementQty] = useState('');
  const [movementObservation, setMovementObservation] = useState('');

  const [parsedNfe, setParsedNfe] = useState<ParsedNfe | null>(null);
  const [nfeItems, setNfeItems] = useState<NfeItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [cancelSupplierId, setCancelSupplierId] = useState('');
  const [cancelNfNumber, setCancelNfNumber] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyPurchase && !(p.currentStock < p.pt)) return false;
      return !q || p.code.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.location.toLowerCase().includes(q);
    });
  }, [products, search, onlyPurchase]);

  const selectedMovementProduct = products.find((p) => p.firestoreId === movementProductId);
  const selectedSupplier = suppliers.find((s) => String(s.id) === selectedSupplierId);

  const openNewProduct = () => {
    setEditingProduct(null);
    setProductForm(emptyProductForm);
    setShowProductForm(true);
  };

  const openEditProduct = (product: StockProduct) => {
    setEditingProduct(product);
    setProductForm({
      code: product.code,
      description: product.description,
      location: product.location,
      unit: product.unit,
      pt: String(product.pt),
      lt: String(product.lt),
    });
    setShowProductForm(true);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        code: productForm.code,
        description: productForm.description,
        location: productForm.location,
        unit: productForm.unit,
        pt: Number(productForm.pt || 0),
        lt: Number(productForm.lt || 0),
      };
      if (!payload.description.trim()) throw new Error('Informe a descrição do produto.');
      if (editingProduct) await updateProduct(editingProduct, payload);
      else await addProduct(payload);
      setShowProductForm(false);
      setEditingProduct(null);
      setProductForm(emptyProductForm);
    } catch (error: any) {
      showToast(error?.message || 'Erro ao salvar produto.', 'error');
    }
  };

  const saveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovementProduct) return showToast('Selecione um produto.', 'error');
    try {
      const rawQty = Number(String(movementQty).replace(',', '.'));
      if (!Number.isFinite(rawQty) || rawQty === 0) throw new Error('Informe uma quantidade válida.');
      const qty = movementType === 'ADJUSTMENT' ? rawQty : Math.abs(rawQty);
      await registerMovement(selectedMovementProduct, movementType, qty, movementType === 'ADJUSTMENT' ? 'ADJUSTMENT' : 'MANUAL', movementObservation);
      setMovementQty('');
      setMovementObservation('');
    } catch (error: any) {
      showToast(error?.message || 'Erro ao registrar movimentação.', 'error');
    }
  };

  const handleXmlFile = async (file?: File) => {
    if (!file) return;
    try {
      const xml = await file.text();
      const parsed = parseNfeXml(xml);
      setParsedNfe(parsed);
      setNfeItems(parsed.items.map((item) => ({ ...item, selectedForStock: false, productId: '' })));

      const normalizedCnpj = parsed.supplierCnpj.replace(/\D/g, '');
      const byCnpj = suppliers.find((s) => (s.cnpj || '').replace(/\D/g, '') === normalizedCnpj && normalizedCnpj);
      const byName = suppliers.find((s) => s.name.trim().toLowerCase() === parsed.supplierName.trim().toLowerCase());
      setSelectedSupplierId(String((byCnpj || byName)?.id || ''));
      showToast(`NF ${parsed.number || ''} lida. Confira antes de confirmar.`);
    } catch (error: any) {
      setParsedNfe(null); setNfeItems([]);
      showToast(error?.message || 'Não foi possível ler a NF-e.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateNfeItem = (index: number, patch: Partial<NfeItem>) => {
    setNfeItems((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  };

  const confirmImport = async () => {
    if (!parsedNfe) return;
    if (!selectedSupplier) return showToast('Selecione o fornecedor cadastrado correspondente à NF.', 'error');
    try {
      await confirmNfeImport(parsedNfe, selectedSupplier, nfeItems.map((item) => ({ ...item, selectedForStock: Boolean(item.selectedForStock) })));
      setParsedNfe(null); setNfeItems([]); setSelectedSupplierId('');
      setTab('nfe');
    } catch (error: any) {
      showToast(error?.message || 'Erro ao importar NF-e.', 'error');
    }
  };

  const handleCancelNfe = async () => {
    const supplier = suppliers.find((s) => String(s.id) === cancelSupplierId);
    if (!supplier || !cancelNfNumber.trim()) return showToast('Informe fornecedor e número da NF.', 'error');
    const record = nfeRecords.find((n) => n.status === 'ACTIVE' && String(n.supplierId) === String(supplier.id) && n.number.trim() === cancelNfNumber.trim());
    if (!record) return showToast('NF ativa não encontrada para esse fornecedor.', 'error');
    const linkedEntries = entries.filter((e) => e.nfeId === record.firestoreId);
    const linkedMovements = movements.filter((m) => m.nfeId === record.firestoreId && m.type === 'ENTRY');
    const paidEntries = linkedEntries.filter((e) => Boolean(e.paymentDate));
    const message = `Cancelar NF ${record.number} de ${record.supplierName}?\n\nVínculos encontrados:\n- ${linkedEntries.length} parcela(s) financeira(s) (${paidEntries.length} já paga(s))\n- ${linkedMovements.length} entrada(s) de estoque\n\nNada será apagado. A NF ficará como CANCELADA e exigirá revisão.`;
    if (!window.confirm(message)) return;
    try {
      await cancelNfe(record, cancelReason);
      setCancelNfNumber(''); setCancelReason('');
    } catch (error: any) {
      showToast(error?.message || 'Erro ao cancelar NF.', 'error');
    }
  };

  const exportPurchasePdf = () => {
    try {
      generateStockPurchaseReport(products, user?.email || undefined);
      showToast('Relatório PDF de compras gerado.');
    } catch (error: any) {
      showToast(error?.message || 'Não foi possível gerar o PDF.', 'error');
    }
  };

  const tabs: { id: InventoryTab; label: string; icon: React.ElementType }[] = [
    { id: 'products', label: 'Estoque', icon: Boxes },
    { id: 'movements', label: 'Movimentações', icon: History },
    { id: 'import', label: 'Importar NF-e', icon: Upload },
    { id: 'nfe', label: 'Notas Fiscais', icon: FileText },
    { id: 'audit', label: 'Auditoria', icon: Archive },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Controle de Estoque</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">PT dispara a compra; a reposição sugerida completa o saldo até PT + LT.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportPurchasePdf} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">
            <FileDown className="w-4 h-4" /> PDF para Compras
          </button>
          <button onClick={openNewProduct} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">
            <Plus className="w-4 h-4" /> Novo Produto
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <SummaryCard label="Itens cadastrados" value={products.length} />
        <SummaryCard label="Dentro do parâmetro" value={products.filter((p) => p.currentStock >= p.pt).length} tone="green" />
        <SummaryCard label="Abaixo do PT" value={purchaseNeeds.length} tone="red" />
        <SummaryCard label="NF cancelada p/ revisar" value={nfeRecords.filter((n) => n.status === 'CANCELLED' && n.reviewRequired).length} tone="amber" />
      </div>

      <div className="flex gap-1 overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={`whitespace-nowrap flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold ${tab === id ? 'bg-slate-900 text-white dark:bg-blue-600' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {loadingInventory && <div className="text-sm text-slate-500">Carregando estoque...</div>}

      {tab === 'products' && (
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar código, descrição ou local" className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
            </div>
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium">
              <input type="checkbox" checked={onlyPurchase} onChange={(e) => setOnlyPurchase(e.target.checked)} /> Somente itens para compra
            </label>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300">
                <tr>{['Código','Descrição','Local','Un.','PT','LT','Ideal','Saldo atual','Comprar','Situação',''].map((h) => <th key={h} className="text-left px-3 py-2.5 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredProducts.map((p) => {
                  const below = p.currentStock < p.pt;
                  const ideal = p.pt + p.lt;
                  const buy = below ? Math.max(ideal - p.currentStock, 0) : 0;
                  return (
                    <tr key={p.firestoreId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-3 py-2.5 font-bold">{p.code}</td>
                      <td className="px-3 py-2.5">{p.description}</td>
                      <td className="px-3 py-2.5">{p.location || '-'}</td>
                      <td className="px-3 py-2.5">{p.unit}</td>
                      <td className="px-3 py-2.5">{formatNumber(p.pt)}</td>
                      <td className="px-3 py-2.5">{formatNumber(p.lt)}</td>
                      <td className="px-3 py-2.5 font-medium">{formatNumber(ideal)}</td>
                      <td className="px-3 py-2.5 font-bold">{formatNumber(p.currentStock)}</td>
                      <td className={`px-3 py-2.5 font-bold ${below ? 'text-rose-600' : 'text-slate-400'}`}>{below ? formatNumber(buy) : '0'}</td>
                      <td className="px-3 py-2.5"><StatusBadge below={below} /></td>
                      <td className="px-3 py-2.5"><button onClick={() => openEditProduct(p)} className="text-blue-600 hover:underline text-xs font-semibold">Editar</button></td>
                    </tr>
                  );
                })}
                {filteredProducts.length === 0 && <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">Nenhum item encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'movements' && (
        <section className="grid lg:grid-cols-[360px_1fr] gap-4">
          <form onSubmit={saveMovement} className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 h-fit">
            <h3 className="font-bold">Nova movimentação</h3>
            <Field label="Produto"><select value={movementProductId} onChange={(e) => setMovementProductId(e.target.value)} className="input-base"><option value="">Selecione...</option>{products.map((p) => <option key={p.firestoreId} value={p.firestoreId}>{p.code} - {p.description} (Saldo {formatNumber(p.currentStock)})</option>)}</select></Field>
            <Field label="Tipo"><select value={movementType} onChange={(e) => setMovementType(e.target.value as any)} className="input-base"><option value="ENTRY">Entrada manual</option><option value="OUT">Saída manual</option><option value="ADJUSTMENT">Ajuste (+ ou -)</option></select></Field>
            <Field label="Quantidade"><input value={movementQty} onChange={(e) => setMovementQty(e.target.value)} inputMode="decimal" className="input-base" placeholder={movementType === 'ADJUSTMENT' ? 'Ex.: -2 ou 5' : 'Ex.: 10'} /></Field>
            <Field label="Observação"><textarea value={movementObservation} onChange={(e) => setMovementObservation(e.target.value)} className="input-base min-h-20" placeholder="Motivo da movimentação" /></Field>
            <button type="submit" className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-semibold">Registrar movimentação</button>
          </form>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <table className="w-full min-w-[780px] text-sm"><thead className="bg-slate-50 dark:bg-slate-800/70"><tr>{['Data','Produto','Tipo','Origem','Qtd.','Saldo ant.','Novo saldo','Usuário'].map((h) => <th key={h} className="text-left px-3 py-2.5">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">{movements.slice(0, 200).map((m) => <tr key={m.firestoreId}><td className="px-3 py-2">{new Date(m.createdAt).toLocaleString('pt-BR')}</td><td className="px-3 py-2 font-medium">{m.productCode} - {m.productDescription}</td><td className="px-3 py-2">{m.type}</td><td className="px-3 py-2">{m.source}{m.nfeNumber ? ` / NF ${m.nfeNumber}` : ''}</td><td className="px-3 py-2 font-bold">{formatNumber(m.quantity)}</td><td className="px-3 py-2">{formatNumber(m.previousStock)}</td><td className="px-3 py-2">{formatNumber(m.newStock)}</td><td className="px-3 py-2">{m.createdByEmail || '-'}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'import' && (
        <section className="space-y-4">
          <div className="rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center">
            <Upload className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <h3 className="font-bold">Importar XML da NF-e</h3>
            <p className="text-sm text-slate-500 mt-1">O XML é usado somente para preencher os dados. O arquivo não será armazenado.</p>
            <input ref={fileInputRef} type="file" accept=".xml,text/xml,application/xml" onChange={(e) => handleXmlFile(e.target.files?.[0])} className="mt-4 text-sm" />
          </div>

          {parsedNfe && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <InfoBox label="NF" value={`${parsedNfe.number}${parsedNfe.series ? ` / Série ${parsedNfe.series}` : ''}`} />
                <InfoBox label="Emitente" value={parsedNfe.supplierName || '-'} />
                <InfoBox label="Emissão" value={formatDate(parsedNfe.issueDate)} />
                <InfoBox label="Valor total" value={formatMoney(parsedNfe.totalValue)} />
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <h3 className="font-bold mb-2">Fornecedor no Financeiro</h3>
                <select value={selectedSupplierId} onChange={(e) => setSelectedSupplierId(e.target.value)} className="input-base max-w-xl"><option value="">Selecione o fornecedor cadastrado...</option>{suppliers.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}</select>
                {!selectedSupplierId && <p className="text-xs text-amber-600 mt-2">O emitente da NF precisa ser associado a um fornecedor já cadastrado antes da confirmação.</p>}
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <h3 className="font-bold mb-2">Parcelas que serão criadas no Financeiro</h3>
                {parsedNfe.installments.length === 0 ? <div className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">Nenhuma duplicata/parcela com vencimento foi encontrada no XML. A NF ainda pode movimentar estoque, mas não criará contas automaticamente.</div> : (
                  <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-slate-500"><th className="py-2">Parcela</th><th>Vencimento</th><th>Valor</th></tr></thead><tbody>{parsedNfe.installments.map((p) => <tr key={`${p.number}-${p.dueDate}`} className="border-t border-slate-100 dark:border-slate-800"><td className="py-2">{p.number}</td><td>{formatDate(p.dueDate)}</td><td className="font-semibold">{formatMoney(p.value)}</td></tr>)}</tbody></table></div>
                )}
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-center justify-between gap-2 mb-3"><div><h3 className="font-bold">Itens da NF-e</h3><p className="text-xs text-slate-500">Marque somente os itens que devem entrar no estoque e associe ao código interno da empresa.</p></div></div>
                <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="bg-slate-50 dark:bg-slate-800/70"><tr>{['Estoque','Cód. fornecedor','Descrição','Un.','Qtd.','Unitário','Total','Produto interno'].map((h) => <th key={h} className="text-left px-2 py-2">{h}</th>)}</tr></thead><tbody>{nfeItems.map((item, index) => <tr key={`${item.line}-${item.supplierCode}`} className="border-t border-slate-100 dark:border-slate-800"><td className="px-2 py-2"><input type="checkbox" checked={Boolean(item.selectedForStock)} onChange={(e) => updateNfeItem(index, { selectedForStock: e.target.checked })} /></td><td className="px-2 py-2">{item.supplierCode}</td><td className="px-2 py-2">{item.description}</td><td className="px-2 py-2">{item.unit}</td><td className="px-2 py-2">{formatNumber(item.quantity)}</td><td className="px-2 py-2">{formatMoney(item.unitValue)}</td><td className="px-2 py-2">{formatMoney(item.totalValue)}</td><td className="px-2 py-2"><select disabled={!item.selectedForStock} value={item.productId || ''} onChange={(e) => updateNfeItem(index, { productId: e.target.value })} className="input-base min-w-[260px] disabled:opacity-50"><option value="">Associe ao produto...</option>{products.map((p) => <option key={p.firestoreId} value={p.firestoreId}>{p.code} - {p.description}</option>)}</select></td></tr>)}</tbody></table></div>
                <p className="text-xs text-slate-500 mt-2">Se o produto ainda não existe, cadastre-o em Estoque → Novo Produto e depois retorne à importação.</p>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => { setParsedNfe(null); setNfeItems([]); }} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold">Descartar leitura</button>
                <button onClick={confirmImport} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold inline-flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Confirmar NF-e</button>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'nfe' && (
        <section className="space-y-4">
          <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/20">
            <h3 className="font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-600" /> Cancelamento manual de NF</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 mb-3">Informe o fornecedor e a NF. O sistema não apaga dados: marca a NF como cancelada e alerta sobre os vínculos para revisão.</p>
            <div className="grid md:grid-cols-4 gap-2">
              <select value={cancelSupplierId} onChange={(e) => setCancelSupplierId(e.target.value)} className="input-base"><option value="">Fornecedor...</option>{suppliers.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}</select>
              <input value={cancelNfNumber} onChange={(e) => setCancelNfNumber(e.target.value)} className="input-base" placeholder="Número da NF" />
              <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="input-base" placeholder="Motivo / observação" />
              <button onClick={handleCancelNfe} className="px-3 py-2 rounded-lg bg-rose-600 text-white font-semibold">Cancelar NF</button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 dark:bg-slate-800/70"><tr>{['NF','Fornecedor','Emissão','Valor','Parcelas','Itens estoque','Status','Impactos / revisão'].map((h) => <th key={h} className="text-left px-3 py-2.5">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{nfeRecords.map((n) => {
              const linkedEntries = entries.filter((e) => e.nfeId === n.firestoreId);
              const linkedMovements = movements.filter((m) => m.nfeId === n.firestoreId && m.type === 'ENTRY');
              const paid = linkedEntries.filter((e) => Boolean(e.paymentDate)).length;
              return <tr key={n.firestoreId}><td className="px-3 py-2 font-bold">{n.number}</td><td className="px-3 py-2">{n.supplierName}</td><td className="px-3 py-2">{formatDate(n.issueDate)}</td><td className="px-3 py-2">{formatMoney(n.totalValue)}</td><td className="px-3 py-2">{linkedEntries.length}</td><td className="px-3 py-2">{linkedMovements.length}</td><td className="px-3 py-2"><span className={`px-2 py-1 rounded-full text-xs font-bold ${n.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{n.status === 'ACTIVE' ? 'ATIVA' : 'CANCELADA'}</span></td><td className="px-3 py-2">{n.status === 'CANCELLED' && n.reviewRequired ? <div className="space-y-1.5"><div className="text-xs text-rose-600 font-semibold">Revisar {linkedEntries.length} parcela(s) ({paid} paga) e {linkedMovements.length} entrada(s).</div><div className="flex flex-wrap gap-1.5">{linkedEntries.some((e) => !e.paymentDate && !e.cancelled) && <button onClick={async () => { try { await cancelOpenFinancialEntriesForNfe(n, linkedEntries); } catch (error: any) { showToast(error?.message || 'Erro ao cancelar parcelas.', 'error'); } }} className="text-[11px] px-2 py-1 rounded bg-amber-100 text-amber-800 font-semibold">Cancelar parcelas abertas</button>}{linkedMovements.length > 0 && <button onClick={async () => { try { await reverseNfeStock(n); } catch (error: any) { showToast(error?.message || 'Erro ao estornar estoque.', 'error'); } }} className="text-[11px] px-2 py-1 rounded bg-rose-100 text-rose-800 font-semibold">Estornar estoque</button>}<button onClick={() => markNfeReviewed(n)} className="text-[11px] px-2 py-1 rounded bg-blue-100 text-blue-800 font-semibold">Concluir revisão</button></div></div> : n.status === 'CANCELLED' ? <span className="text-xs text-slate-500">Revisão concluída</span> : '-'}</td></tr>;
            })}{nfeRecords.length === 0 && <tr><td colSpan={8} className="text-center py-8 text-slate-500">Nenhuma NF importada.</td></tr>}</tbody></table>
          </div>
        </section>
      )}

      {tab === 'audit' && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800"><h3 className="font-bold">Log de Auditoria</h3><p className="text-xs text-slate-500">Histórico append-only das ações do novo módulo. Exibindo os registros mais recentes.</p></div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">{auditLogs.slice(0, 200).map((log) => <div key={log.firestoreId} className="p-3 flex flex-col sm:flex-row sm:items-start justify-between gap-2"><div><div className="text-sm font-semibold">{log.description}</div><div className="text-xs text-slate-500 mt-1">{log.entityType} · {log.action} · {log.actorEmail || log.actorUid}</div></div><div className="text-xs text-slate-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString('pt-BR')}</div></div>)}{auditLogs.length === 0 && <div className="p-8 text-center text-slate-500">Nenhum evento registrado.</div>}</div>
        </section>
      )}

      {showProductForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" onMouseDown={() => setShowProductForm(false)}>
          <form onSubmit={saveProduct} onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">{editingProduct ? 'Editar produto' : 'Novo produto'}</h3><button type="button" onClick={() => setShowProductForm(false)}><X className="w-5 h-5" /></button></div>
            <div className="grid sm:grid-cols-2 gap-3"><Field label="Código da empresa"><input required disabled={Boolean(editingProduct)} value={productForm.code} onChange={(e) => setProductForm({ ...productForm, code: e.target.value })} className="input-base disabled:opacity-60 disabled:cursor-not-allowed" /></Field><Field label="Unidade"><input required value={productForm.unit} onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })} className="input-base" placeholder="UN, KG, M..." /></Field></div>
            <Field label="Descrição"><input required value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} className="input-base" /></Field>
            <Field label="Local"><input value={productForm.location} onChange={(e) => setProductForm({ ...productForm, location: e.target.value })} className="input-base" /></Field>
            <div className="grid sm:grid-cols-2 gap-3"><Field label="PT - Ponto de Transferência"><input min="0" step="any" type="number" value={productForm.pt} onChange={(e) => setProductForm({ ...productForm, pt: e.target.value })} className="input-base" /></Field><Field label="LT - Lote de Transferência"><input min="0" step="any" type="number" value={productForm.lt} onChange={(e) => setProductForm({ ...productForm, lt: e.target.value })} className="input-base" /></Field></div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm"><strong>Quantidade ideal:</strong> {formatNumber(Number(productForm.pt || 0) + Number(productForm.lt || 0))}. <span className="text-slate-500">A compra só é sinalizada quando o saldo fica abaixo do PT.</span></div>
            <button type="submit" className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold">Salvar produto</button>
          </form>
        </div>
      )}

      <style>{`.input-base{width:100%;border-radius:.5rem;border:1px solid rgb(203 213 225);background:white;padding:.6rem .75rem;font-size:.875rem;color:rgb(15 23 42)}.dark .input-base{border-color:rgb(51 65 85);background:rgb(15 23 42);color:rgb(241 245 249)}`}</style>
    </div>
  );
};

const SummaryCard = ({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'green' | 'red' | 'amber' }) => {
  const tones = { slate: 'text-slate-900 dark:text-white', green: 'text-emerald-600', red: 'text-rose-600', amber: 'text-amber-600' };
  return <div className="p-3 sm:p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"><div className="text-xs text-slate-500">{label}</div><div className={`text-2xl font-bold mt-1 ${tones[tone]}`}>{value}</div></div>;
};

const StatusBadge = ({ below }: { below: boolean }) => below
  ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700"><ShoppingCart className="w-3 h-3" /> Necessita compra</span>
  : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> Dentro do parâmetro</span>;

const InfoBox = ({ label, value }: { label: string; value: string }) => <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"><div className="text-xs text-slate-500">{label}</div><div className="font-bold mt-1 break-words">{value}</div></div>;

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block"><span className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{label}</span>{children}</label>;
