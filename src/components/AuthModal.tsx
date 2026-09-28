import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Mail, Lock, LogIn, UserPlus, KeyRound, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'RESET';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { user, loginWithEmail, registerWithEmail, signInWithGoogle, resetPassword, logoutUser } = useAuth();

  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setError('Por favor, informe um e-mail válido.');
      return;
    }

    if (mode !== 'RESET' && !password) {
      setError('Por favor, informe a senha.');
      return;
    }

    if (mode === 'REGISTER' && password !== confirmPassword) {
      setError('As senhas digitadas não conferem.');
      return;
    }

    if (mode === 'REGISTER' && password.length < 6) {
      setError('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'LOGIN') {
        await loginWithEmail(email.trim(), password);
        onClose();
      } else if (mode === 'REGISTER') {
        await registerWithEmail(email.trim(), password);
        setSuccessMsg('Conta criada com sucesso! Você já está autenticado.');
        setTimeout(() => onClose(), 1200);
      } else if (mode === 'RESET') {
        await resetPassword(email.trim());
        setSuccessMsg('E-mail de redefinição enviado! Verifique sua caixa de entrada.');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let message = 'Ocorreu um erro ao processar. Tente novamente.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        message = 'E-mail ou senha incorretos.';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'Este e-mail já está cadastrado em outra conta.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'O formato do e-mail é inválido.';
      } else if (err.code === 'auth/weak-password') {
        message = 'A senha é muito fraca. Digite ao menos 6 caracteres.';
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Falha na autenticação com o Google. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full overflow-hidden text-slate-900 dark:text-slate-100 transition-all">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
              {user
                ? 'Sua Conta Firebase'
                : mode === 'LOGIN'
                ? 'Autenticação de Usuário'
                : mode === 'REGISTER'
                ? 'Criar Nova Conta'
                : 'Recuperar Senha'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {user ? (
            /* Logged In View */
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-emerald-900 dark:text-emerald-200">Você está conectado!</p>
                  <p className="text-emerald-700 dark:text-emerald-300 font-mono text-[11px] truncate">
                    {user.email || user.displayName || 'Usuário Autenticado'}
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    ID Firebase: <span className="font-mono">{user.uid}</span>
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  ☁️ Sincronização em Nuvem Ativa
                </p>
                Seus lançamentos, fornecedores e funcionários agora são mantidos no banco de dados Firestore vinculado à sua conta.
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-all"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logoutUser();
                    onClose();
                  }}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md shadow-2xs transition-all"
                >
                  Sair da Conta
                </button>
              </div>
            </div>
          ) : (
            /* Login / Register / Reset Form */
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Google Auth Button */}
              {mode !== 'RESET' && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isSubmitting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-all shadow-2xs disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    Entrar com Conta Google
                  </button>

                  <div className="relative flex items-center justify-center">
                    <div className="border-t border-slate-200 dark:border-slate-800 w-full"></div>
                    <span className="bg-white dark:bg-slate-900 px-2 text-[10px] uppercase font-semibold text-slate-400 absolute">
                      ou com e-mail
                    </span>
                  </div>
                </div>
              )}

              {/* Alert Feedback Messages */}
              {error && (
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 rounded-md flex items-start gap-2 text-rose-800 dark:text-rose-200 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 rounded-md flex items-start gap-2 text-emerald-800 dark:text-emerald-200 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Field: Email */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    required
                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Field: Password */}
              {mode !== 'RESET' && (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Senha
                    </label>
                    {mode === 'LOGIN' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('RESET');
                          setError(null);
                        }}
                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Esqueceu a senha?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Field: Confirm Password */}
              {mode === 'REGISTER' && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Confirmar Senha
                  </label>
                  <div className="relative">
                    <Lock className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all shadow-2xs flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Aguarde...</span>
                ) : mode === 'LOGIN' ? (
                  <>
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Entrar no Sistema</span>
                  </>
                ) : mode === 'REGISTER' ? (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Criar Minha Conta</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Enviar E-mail de Recuperação</span>
                  </>
                )}
              </button>

              {/* Navigation Mode Switchers */}
              <div className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400">
                {mode === 'LOGIN' ? (
                  <p>
                    Ainda não possui uma conta?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('REGISTER');
                        setError(null);
                      }}
                      className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                    >
                      Cadastre-se aqui
                    </button>
                  </p>
                ) : mode === 'REGISTER' ? (
                  <p>
                    Já tem uma conta?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('LOGIN');
                        setError(null);
                      }}
                      className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                    >
                      Voltar ao Login
                    </button>
                  </p>
                ) : (
                  <p>
                    Lembrou a senha?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setMode('LOGIN');
                        setError(null);
                      }}
                      className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                    >
                      Voltar ao Login
                    </button>
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
