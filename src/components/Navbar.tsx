import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Settings,
  LogOut,
  User as UserIcon,
  Cloud,
  RefreshCw,
  WifiOff,
  Truck,
  Boxes,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  activeTab:
    | 'dashboard'
    | 'entries'
    | 'suppliers'
    | 'inventory'
    | 'config'
    | 'upcoming-details'
    | 'overdue-details'
    | 'to-pay-details'
    | 'paid-details'
    | 'incomes-details';
  setActiveTab: (tab: 'dashboard' | 'entries' | 'suppliers' | 'inventory' | 'config') => void;
  onLogout?: () => void;
  isSyncing?: boolean;
  isOnline?: boolean;
  lastSyncedAt?: Date | null;
  onForceSync?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onLogout,
  isSyncing = false,
  isOnline = true,
  lastSyncedAt,
  onForceSync,
}) => {
  const { user, logoutUser } = useAuth();

  const handleSignOut = async () => {
    try {
      if (onLogout) {
        onLogout();
      }
      await logoutUser();
    } catch (e) {
      console.error(e);
    }
  };

  const formatLastSync = (date: Date | null | undefined) => {
    if (!date) return 'Em tempo real';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <>
      {/* Top Header for Desktop & Mobile */}
      <header className="bg-slate-900 text-white shadow-sm sticky top-0 z-30 border-b border-slate-800 pt-safe">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between py-2 sm:py-2.5 gap-2">
            {/* Logo & Title */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <img
                src="/icons/icon_128x128.png?v=2"
                alt="Financeiro"
                className="w-8 h-8 rounded-lg shadow-xs object-contain bg-slate-800 p-0.5 border border-slate-700 shrink-0"
              />
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-white leading-none truncate">
                  Financeiro
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-[10px] sm:text-[11px] text-slate-400 leading-tight truncate">
                    Gestão Financeira
                  </p>
                  {/* Real-time sync indicator dot */}
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                    <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-400 animate-ping' : isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                    <span className="hidden lg:inline">{isSyncing ? 'Sincronizando' : isOnline ? 'Sincronizado' : 'Offline'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop Navigation Tabs (hidden on small mobile, visible sm+) */}
            <nav className="hidden sm:flex items-center gap-1 bg-slate-800/90 p-1 rounded-lg border border-slate-700/80">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'dashboard' ||
                  activeTab === 'upcoming-details' ||
                  activeTab === 'overdue-details' ||
                  activeTab === 'to-pay-details' ||
                  activeTab === 'paid-details' ||
                  activeTab === 'incomes-details'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => setActiveTab('entries')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'entries'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Lançamentos</span>
              </button>

              <button
                onClick={() => setActiveTab('suppliers')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'suppliers'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Fornecedores</span>
              </button>

              <button
                onClick={() => setActiveTab('inventory')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'inventory'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Estoque</span>
              </button>

              <button
                onClick={() => setActiveTab('config')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'config'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Configuração</span>
              </button>
            </nav>

            {/* User Profile, Cloud Sync Button & Logout */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Cloud Sync Status Button */}
              {user && onForceSync && (
                <button
                  onClick={onForceSync}
                  disabled={isSyncing}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs border transition-all cursor-pointer active:scale-95 ${
                    !isOnline
                      ? 'bg-rose-950/50 text-rose-300 border-rose-800'
                      : isSyncing
                      ? 'bg-amber-950/50 text-amber-300 border-amber-800'
                      : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700'
                  }`}
                  title={
                    !isOnline
                      ? 'Offline - Verifique sua conexão'
                      : `Sincronização Cloud Ativa (Última: ${formatLastSync(lastSyncedAt)}). Clique para atualizar.`
                  }
                >
                  {!isOnline ? (
                    <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                  ) : isSyncing ? (
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  ) : (
                    <Cloud className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span className="hidden xl:inline text-[11px] font-medium text-slate-200">
                    {isSyncing ? 'Sincronizando...' : 'Nuvem Conectada'}
                  </span>
                </button>
              )}

              {user ? (
                <>
                  <div
                    className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-slate-800/80 rounded-md border border-slate-700 text-slate-300 text-xs"
                    title={`Conectado como ${user.email || 'Usuário'}`}
                  >
                    <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                      {user.email ? user.email.charAt(0) : 'U'}
                    </div>
                    <span className="text-[11px] font-medium max-w-[110px] truncate text-slate-200">
                      {user.email ? user.email.split('@')[0] : 'Usuário'}
                    </span>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900 border border-rose-800/60 transition-all cursor-pointer shadow-xs active:scale-95"
                    title="Sair da Conta"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sair</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Voltar para a tela de Login"
                >
                  <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Login</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* iOS & Mobile Bottom Tab Navigation Bar (fixed at screen bottom, native app feel) */}
      <nav
        aria-label="Navegação Mobile"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/90 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5 px-2 shadow-lg"
      >
        <div className="grid grid-cols-5 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all min-h-[46px] cursor-pointer ${
              activeTab === 'dashboard' ||
              activeTab === 'upcoming-details' ||
              activeTab === 'overdue-details' ||
              activeTab === 'to-pay-details' ||
              activeTab === 'paid-details' ||
              activeTab === 'incomes-details'
                ? 'bg-blue-600/20 text-blue-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard
              className={`w-4 h-4 mb-0.5 ${
                activeTab === 'dashboard' ||
                activeTab === 'upcoming-details' ||
                activeTab === 'overdue-details' ||
                activeTab === 'to-pay-details' ||
                activeTab === 'paid-details' ||
                activeTab === 'incomes-details'
                  ? 'text-blue-400'
                  : ''
              }`}
            />
            <span className="text-[10px] leading-none">Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('entries')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all min-h-[46px] cursor-pointer ${
              activeTab === 'entries'
                ? 'bg-blue-600/20 text-blue-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className={`w-4 h-4 mb-0.5 ${activeTab === 'entries' ? 'text-blue-400' : ''}`} />
            <span className="text-[10px] leading-none">Lançamentos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('suppliers')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all min-h-[46px] cursor-pointer ${
              activeTab === 'suppliers'
                ? 'bg-blue-600/20 text-blue-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className={`w-4 h-4 mb-0.5 ${activeTab === 'suppliers' ? 'text-blue-400' : ''}`} />
            <span className="text-[10px] leading-none">Fornecedores</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all min-h-[46px] cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-blue-600/20 text-blue-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Boxes className={`w-4 h-4 mb-0.5 ${activeTab === 'inventory' ? 'text-blue-400' : ''}`} />
            <span className="text-[10px] leading-none">Estoque</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all min-h-[46px] cursor-pointer ${
              activeTab === 'config'
                ? 'bg-blue-600/20 text-blue-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className={`w-4 h-4 mb-0.5 ${activeTab === 'config' ? 'text-blue-400' : ''}`} />
            <span className="text-[10px] leading-none">Configuração</span>
          </button>
        </div>
      </nav>
    </>
  );
};
