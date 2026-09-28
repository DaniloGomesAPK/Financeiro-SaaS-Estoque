import React, { useState, useRef } from 'react';
import { Supplier, Employee } from '../types';
import {
  Truck,
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Database,
  Download,
  Upload,
  FileCode2,
  RefreshCw,
  Moon,
  Sun,
  Cloud,
  Smartphone,
  Laptop,
  CheckCircle2,
  Copy,
  Zap,
  WifiOff,
} from 'lucide-react';
import { UserMenu } from './UserMenu';
import { useAuth } from '../context/AuthContext';

interface ConfigViewProps {
  suppliers: Supplier[];
  employees: Employee[];
  onAddSupplier: (name: string) => void;
  onUpdateSupplier: (id: number, name: string) => void;
  onDeleteSupplier: (id: number) => void;
  onAddEmployee: (name: string) => void;
  onUpdateEmployee: (id: number, name: string) => void;
  onDeleteEmployee: (id: number) => void;
  darkMode: boolean;
  setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  onExportJSON: () => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportCSV: () => void;
  onRestoreSampleData: () => void;
  onClearAllData: () => void;
  onOpenAuthModal: () => void;
  isSyncing?: boolean;
  isOnline?: boolean;
  lastSyncedAt?: Date | null;
  onForceSync?: () => void;
}

export const ConfigView: React.FC<ConfigViewProps> = ({
  suppliers,
  employees,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  darkMode,
  setDarkMode,
  onExportJSON,
  onImportJSON,
  onExportCSV,
  onRestoreSampleData,
  onClearAllData,
  onOpenAuthModal,
  isSyncing = false,
  isOnline = true,
  lastSyncedAt,
  onForceSync,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'suppliers' | 'employees' | 'system'>('suppliers');
  const [copiedLink, setCopiedLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Supplier Form / Inline Edit state
  const [newSupplierName, setNewSupplierName] = useState('');
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  const [editingSupplierName, setEditingSupplierName] = useState('');

  // Employee Form / Inline Edit state
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [editingEmployeeName, setEditingEmployeeName] = useState('');

  // Supplier handlers
  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;
    onAddSupplier(newSupplierName.trim());
    setNewSupplierName('');
  };

  const startEditSupplier = (sup: Supplier) => {
    setEditingSupplierId(sup.id);
    setEditingSupplierName(sup.name);
  };

  const saveEditSupplier = (id: number) => {
    if (!editingSupplierName.trim()) return;
    onUpdateSupplier(id, editingSupplierName.trim());
    setEditingSupplierId(null);
  };

  // Employee handlers
  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployeeName.trim()) return;
    onAddEmployee(newEmployeeName.trim());
    setNewEmployeeName('');
  };

  const startEditEmployee = (emp: Employee) => {
    setEditingEmployeeId(emp.id);
    setEditingEmployeeName(emp.name);
  };

  const saveEditEmployee = (id: number) => {
    if (!editingEmployeeName.trim()) return;
    onUpdateEmployee(id, editingEmployeeName.trim());
    setEditingEmployeeId(null);
  };

  const handleCopyAppUrl = () => {
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    });
  };

  const formatLastSync = (date: Date | null | undefined) => {
    if (!date) return 'Em tempo real';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="space-y-4">
      {/* Config Tabs Bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex items-center gap-1.5 py-2 px-4 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'suppliers'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Fornecedores ({suppliers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('employees')}
          className={`flex items-center gap-1.5 py-2 px-4 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'employees'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Funcionários ({employees.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-1.5 py-2 px-4 font-bold text-xs border-b-2 transition-all cursor-pointer ${
            activeTab === 'system'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Sistema, Nuvem & Backup</span>
        </button>
      </div>

      {/* TAB 1: FORNECEDORES */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Add Supplier Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs h-fit">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-600" />
              Novo Fornecedor
            </h3>
            <form onSubmit={handleAddSupplier} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Nome da Empresa / Fornecedor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dell Tecnologia, CEMIG, etc."
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded transition-colors shadow-2xs cursor-pointer"
              >
                Cadastrar Fornecedor
              </button>
            </form>
          </div>

          {/* Suppliers Table List */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Fornecedores Cadastrados ({suppliers.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 px-3 w-16">ID</th>
                    <th className="py-2 px-3">Nome do Fornecedor</th>
                    <th className="py-2 px-3 w-24 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-6 text-slate-400">
                        Nenhum fornecedor cadastrado.
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((sup) => (
                      <tr key={sup.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-1.5 px-3 font-mono text-slate-400">#{sup.id}</td>
                        <td className="py-1.5 px-3 font-medium">
                          {editingSupplierId === sup.id ? (
                            <input
                              type="text"
                              value={editingSupplierName}
                              onChange={(e) => setEditingSupplierName(e.target.value)}
                              className="px-2 py-0.5 border rounded text-xs bg-white dark:bg-slate-800 w-full"
                              autoFocus
                            />
                          ) : (
                            sup.name
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          {editingSupplierId === sup.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => saveEditSupplier(sup.id)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded cursor-pointer"
                                title="Salvar"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingSupplierId(null)}
                                className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => startEditSupplier(sup)}
                                className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded cursor-pointer"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeleteSupplier(sup.id)}
                                className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded cursor-pointer"
                                title="Deletar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FUNCIONÁRIOS */}
      {activeTab === 'employees' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Add Employee Form */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs h-fit">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-3 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-600" />
              Novo Funcionário
            </h3>
            <form onSubmit={handleAddEmployee} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Nome do Funcionário *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Silva"
                  value={newEmployeeName}
                  onChange={(e) => setNewEmployeeName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded transition-colors shadow-2xs cursor-pointer"
              >
                Cadastrar Funcionário
              </button>
            </form>
          </div>

          {/* Employees Table List */}
          <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-2xs">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Funcionários Cadastrados ({employees.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="py-2 px-3 w-16">ID</th>
                    <th className="py-2 px-3">Nome do Funcionário</th>
                    <th className="py-2 px-3 w-24 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {employees.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-6 text-slate-400">
                        Nenhum funcionário cadastrado.
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-1.5 px-3 font-mono text-slate-400">#{emp.id}</td>
                        <td className="py-1.5 px-3 font-medium">
                          {editingEmployeeId === emp.id ? (
                            <input
                              type="text"
                              value={editingEmployeeName}
                              onChange={(e) => setEditingEmployeeName(e.target.value)}
                              className="px-2 py-0.5 border rounded text-xs bg-white dark:bg-slate-800 w-full"
                              autoFocus
                            />
                          ) : (
                            emp.name
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          {editingEmployeeId === emp.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => saveEditEmployee(emp.id)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded cursor-pointer"
                                title="Salvar"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingEmployeeId(null)}
                                className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                                title="Cancelar"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => startEditEmployee(emp)}
                                className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded cursor-pointer"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeleteEmployee(emp.id)}
                                className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 rounded cursor-pointer"
                                title="Deletar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SISTEMA, NUVEM & BACKUP */}
      {activeTab === 'system' && (
        <div className="space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={onImportJSON}
            accept=".json"
            className="hidden"
          />

          {/* Sincronismo em Tempo Real Multi-Dispositivos (Computador <-> Celular) */}
          <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-800/60 rounded-xl p-4 shadow-md text-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-xs">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                    Sincronismo em Tempo Real Multi-Dispositivos
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      Ativo
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    Qualquer alteração feita no seu Computador reflete instantaneamente no Celular (e vice-versa).
                  </p>
                </div>
              </div>

              {onForceSync && (
                <button
                  type="button"
                  onClick={onForceSync}
                  disabled={isSyncing}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}</span>
                </button>
              )}
            </div>

            {/* Sync Status Info Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-3">
              <div className="bg-slate-800/80 border border-slate-700/80 p-2.5 rounded-lg flex items-center gap-2.5">
                <Cloud className={`w-5 h-5 ${isOnline ? 'text-emerald-400' : 'text-rose-400'} shrink-0`} />
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 block font-medium">Status da Conexão</span>
                  <span className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                    {isOnline ? 'Conectado à Nuvem' : 'Modo Offline'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 p-2.5 rounded-lg flex items-center gap-2.5">
                <Laptop className="w-5 h-5 text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 block font-medium">Conta Sincronizada</span>
                  <span className="text-xs font-bold text-slate-100 truncate block">
                    {user?.email || 'Modo Convidado'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-800/80 border border-slate-700/80 p-2.5 rounded-lg flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-purple-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 block font-medium">Última Atualização</span>
                  <span className="text-xs font-bold text-slate-100 font-mono">
                    {formatLastSync(lastSyncedAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Step-by-step cross-device guide */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 text-xs space-y-2">
              <span className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                📱 Como usar no seu iPhone / Android e Computador ao mesmo tempo:
              </span>
              <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
                <li>
                  Abra o link do sistema no Safari ou Chrome do seu <strong>iPhone/Android</strong>.
                </li>
                <li>
                  Faça login com a <strong>mesma conta</strong> ({user?.email || 'seu e-mail'}).
                </li>
                <li>
                  Pronto! Ao adicionar ou dar baixa em um pagamento no computador, o celular atualizará <strong>imediatamente em segundo plano</strong> via Firestore WebSockets.
                </li>
              </ol>

              <div className="pt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyAppUrl}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold rounded-md border border-slate-600 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-blue-400" />}
                  <span>{copiedLink ? 'Link Copiado para a Área de Transferência!' : 'Copiar Link para Abrir no Celular'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Autenticação e Conta */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-2">
              Gerenciamento de Conta
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Acesse sua conta para manter seus dados seguros e sincronizados com a nuvem do Google Firestore.
            </p>
            <div className="flex items-center gap-3">
              <UserMenu onOpenAuthModal={onOpenAuthModal} />
            </div>
          </div>

          {/* Exportar & Backup */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-2">
              Exportar & Backup de Dados
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Faça download dos seus dados ou importe um backup salvo anteriormente.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onExportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded shadow-2xs transition-colors cursor-pointer"
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Exportar CSV</span>
              </button>

              <button
                onClick={onExportJSON}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded border border-slate-700 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Exportar Backup (JSON)</span>
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded border border-slate-700 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-purple-400" />
                <span>Importar Backup (JSON)</span>
              </button>
            </div>
          </div>

          {/* Preferências & Manutenção */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-2">
              Preferências & Manutenção
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Alterne o tema do sistema ou restaure dados iniciais.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
              >
                {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
                <span>{darkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
              </button>

              <button
                onClick={onRestoreSampleData}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50 text-xs font-semibold rounded transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Restaurar Dados Exemplo</span>
              </button>

              <button
                onClick={onClearAllData}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700/50 text-xs font-semibold rounded transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Todos os Dados</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
