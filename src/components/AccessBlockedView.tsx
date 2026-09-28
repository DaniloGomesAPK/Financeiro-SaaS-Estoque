import React from 'react';
import { CalendarClock, CreditCard, LogOut, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AccessBlockedView: React.FC = () => {
  const { companyAccess, logoutUser } = useAuth();
  const suspended = companyAccess?.status === 'suspended';

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl p-6 sm:p-8">
        <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6 text-amber-400" />
        </div>
        <h1 className="text-2xl font-bold">{suspended ? 'Acesso suspenso' : 'Período de acesso encerrado'}</h1>
        <p className="text-slate-400 mt-2 leading-relaxed">
          Seus dados continuam preservados no sistema. Para voltar a utilizar o Financeiro, solicite a liberação do plano mensal ou anual após o pagamento via PIX.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 mt-6">
          <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
            <div className="flex items-center gap-2 font-bold"><CalendarClock className="w-4 h-4 text-blue-400" /> Plano Mensal</div>
            <p className="text-xs text-slate-400 mt-2">Liberação manual pelo administrador após confirmação do PIX.</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
            <div className="flex items-center gap-2 font-bold"><CreditCard className="w-4 h-4 text-emerald-400" /> Plano Anual</div>
            <p className="text-xs text-slate-400 mt-2">Acesso anual liberado pelo painel administrativo.</p>
          </div>
        </div>

        <div className="mt-6 p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
          Nenhum lançamento, fornecedor, estoque ou histórico é apagado quando o acesso vence.
        </div>

        <button onClick={() => logoutUser()} className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 font-semibold text-sm">
          <LogOut className="w-4 h-4" /> Sair da conta
        </button>
      </div>
    </div>
  );
};
