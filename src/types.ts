export type EntityType = 'Fornecedor' | 'Funcionário';

export type PaymentType = 'Pagamento' | 'Adiantamento' | 'Férias' | 'Rescisão';

export type DocumentType = 'Boleto' | 'Nota Fiscal' | 'Adiantamento' | 'Pagamento' | 'Férias' | 'Rescisão' | 'Outros';

export type EntryStatus = 'Atrasado' | 'À Vencer' | 'Pago';

export interface Supplier {
  id: number;
  name: string;
  firestoreId?: string;
  cnpj?: string;
  companyId?: string;
}

export interface Employee {
  id: number;
  name: string;
  firestoreId?: string;
  companyId?: string;
}

export interface Entry {
  id: number;
  firestoreId?: string;
  companyId?: string;
  favorecidoId: string; // e.g. "forn-1" or "func-2"
  favorecidoName: string;
  favorecidoType: EntityType;
  docType: DocumentType;
  nfNumber?: string;
  dueDate: string; // YYYY-MM-DD
  value: number;
  paymentDate?: string; // YYYY-MM-DD
  interestRate: number; // e.g. 2.5 (%)
  source?: 'manual' | 'nfe';
  nfeId?: string;
  nfeKey?: string;
  installmentNumber?: string;
  cancelled?: boolean;
  cancelReason?: string;
}

export interface CalculatedEntry extends Entry {
  status: EntryStatus;
  daysOverdue: number;
  interestValue: number;
  totalWithInterest: number;
  monthYear: string; // e.g. "8/2026"
}

export interface EntitySummary {
  name: string;
  type: EntityType;
  countPaid: number;
  valuePaid: number;
  countOverdue: number;
  valueOverdue: number;
  countToPay: number;
  valueToPay: number;
  balanceDue: number; // Saldo Devedor
  accumulatedInterest: number; // Juros Acumulados
}

export interface IncomeEntry {
  id: number;
  firestoreId?: string;
  companyId?: string;
  companyName: string; // Nome da empresa
  value: number; // Valor em R$
  date: string; // YYYY-MM-DD
  description?: string; // Observação ou número de documento
  forma_recebimento?: string; // Origem do Dinheiro (PIX, Dinheiro, Cartão de Crédito, etc.)
}

// --- SaaS / Estoque / NF-e ---
export type CompanyRole = 'owner' | 'finance' | 'viewer';

export interface UserProfile {
  email: string;
  companyId: string;
  role: CompanyRole;
  status?: 'legacy' | 'trial' | 'active' | 'expired' | 'suspended';
  plan?: 'legacy' | 'trial' | 'monthly' | 'annual';
}

export interface StockProduct {
  firestoreId: string;
  code: string;
  description: string;
  location: string;
  unit: string;
  pt: number;
  lt: number;
  currentStock: number;
  active: boolean;
  companyId: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type StockMovementType = 'ENTRY' | 'OUT' | 'ADJUSTMENT' | 'REVERSAL';
export type StockMovementSource = 'NFE' | 'MANUAL' | 'SERVICE' | 'ADJUSTMENT' | 'REVERSAL';

export interface StockMovement {
  firestoreId: string;
  companyId: string;
  productId: string;
  productCode: string;
  productDescription: string;
  type: StockMovementType;
  source: StockMovementSource;
  quantity: number;
  previousStock: number;
  newStock: number;
  nfeId?: string;
  nfeNumber?: string;
  observation?: string;
  createdAt: string;
  createdBy: string;
  createdByEmail?: string;
  reversalOf?: string;
}

export interface NfeInstallment {
  number: string;
  dueDate: string;
  value: number;
}

export interface NfeItem {
  line: number;
  supplierCode: string;
  description: string;
  unit: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  selectedForStock?: boolean;
  productId?: string;
}

export interface NfeRecord {
  firestoreId: string;
  companyId: string;
  accessKey: string;
  number: string;
  series: string;
  supplierId?: string;
  supplierName: string;
  supplierCnpj: string;
  issueDate: string;
  totalValue: number;
  status: 'ACTIVE' | 'CANCELLED';
  installments: NfeInstallment[];
  stockItemsCount: number;
  createdAt: string;
  createdBy: string;
  createdByEmail?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelledByEmail?: string;
  cancelReason?: string;
  reviewRequired?: boolean;
}

export interface AuditLog {
  firestoreId: string;
  companyId: string;
  action: string;
  entityType: 'STOCK_PRODUCT' | 'STOCK_MOVEMENT' | 'NFE' | 'FINANCIAL_ENTRY' | 'ACCESS' | 'OTHER';
  entityId: string;
  description: string;
  actorUid: string;
  actorEmail?: string;
  createdAt: string;
  changes?: Record<string, unknown>;
}

export interface CompanyAccess {
  companyId: string;
  status: 'legacy' | 'trial' | 'active' | 'expired' | 'suspended';
  plan: 'legacy' | 'trial' | 'monthly' | 'annual';
  trialStartedAt?: string;
  trialEndsAt?: string;
  accessUntil?: string;
  updatedAt?: string;
  updatedBy?: string;
}
