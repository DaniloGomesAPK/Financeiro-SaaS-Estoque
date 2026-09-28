import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, Cloud, ShieldCheck } from 'lucide-react';

interface UserMenuProps {
  onOpenAuthModal: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ onOpenAuthModal }) => {
  const { user } = useAuth();

  return (
    <div className="flex items-center gap-2">
      {user ? (
        <button
          onClick={onOpenAuthModal}
          className="flex items-center gap-2 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300/80 dark:border-emerald-800 rounded-md text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/80 transition-all text-xs font-bold shadow-2xs group"
          title="Conta Autenticada Firebase"
        >
          <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-extrabold uppercase shrink-0">
            {user.email ? user.email.charAt(0) : 'U'}
          </div>
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-[11px] leading-tight font-extrabold truncate max-w-[120px]">
              {user.email ? user.email.split('@')[0] : 'Usuário'}
            </span>
            <span className="text-[9px] text-emerald-700 dark:text-emerald-400 leading-none flex items-center gap-0.5">
              <Cloud className="w-2.5 h-2.5 text-emerald-500" /> Cloud Sync
            </span>
          </div>
        </button>
      ) : (
        <button
          onClick={onOpenAuthModal}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-md transition-all text-xs font-bold shadow-2xs"
          title="Autenticar via Firebase para sincronização em nuvem"
        >
          <LogIn className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Entrar / Cadastrar</span>
          <span className="hidden md:inline-flex items-center gap-0.5 ml-1 text-[9px] px-1.5 py-0.25 bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 rounded font-semibold">
            <ShieldCheck className="w-2.5 h-2.5" /> Firebase
          </span>
        </button>
      )}
    </div>
  );
};
