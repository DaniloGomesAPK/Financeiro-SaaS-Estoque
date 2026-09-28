import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  PieChart,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ArrowLeft,
  DollarSign,
  CalendarCheck,
  UserCheck,
} from 'lucide-react';

interface LoginViewProps {
  onBypassDemo?: () => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';

export const LoginView: React.FC<LoginViewProps> = ({ onBypassDemo }) => {
  const { loginWithEmail, registerWithEmail, signInWithGoogle, resetPassword } = useAuth();

  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError('Por favor, informe seu e-mail cadastrado.');
      return;
    }

    if (mode === 'FORGOT_PASSWORD') {
      setIsSubmitting(true);
      try {
        await resetPassword(cleanEmail);
        setSuccessMsg(
          'E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada e a pasta de spam.'
        );
      } catch (err: any) {
        console.error('Password reset error:', err);
        if (err.code === 'auth/user-not-found') {
          setError('Nenhum usuário encontrado com este e-mail.');
        } else if (err.code === 'auth/invalid-email') {
          setError('O formato do e-mail inserido é inválido.');
        } else {
          setError(err.message || 'Erro ao solicitar redefinição. Tente novamente.');
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!password) {
      setError('Por favor, digite sua senha.');
      return;
    }

    if (mode === 'REGISTER') {
      if (password.length < 6) {
        setError('A senha deve possuir no mínimo 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setError('A confirmação de senha não confere.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === 'LOGIN') {
        await loginWithEmail(cleanEmail, password);
      } else if (mode === 'REGISTER') {
        await registerWithEmail(cleanEmail, password);
        setSuccessMsg('Cadastro realizado com sucesso! Bem-vindo ao sistema.');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let msg = 'Falha na autenticação. Verifique os dados e tente novamente.';
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password'
      ) {
        msg = 'E-mail ou senha incorretos.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'Este e-mail já está cadastrado em outra conta.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'O formato do e-mail é inválido.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'A senha é muito fraca. Utilize pelo menos 6 caracteres.';
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google auth error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Falha ao conectar com o Google. Tente novamente ou use login por e-mail.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-3 sm:p-6 lg:p-10 relative overflow-hidden">
      {/* Background Decorative Ambient Blobs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-5xl bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
        {/* Left Side: Brand Identity, App Icon & Financial Philosophy */}
        <div className="lg:col-span-6 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 p-6 sm:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/80 relative">
          <div className="space-y-6">
            {/* Logo and Brand Header */}
            <div className="flex items-center gap-3.5">
              <div className="relative group">
                <img
                  src="/icons/icon_512x512.png?v=2"
                  alt="Ícone Financeiro"
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-contain shadow-lg bg-slate-800/80 p-1 border border-slate-700/80 transition-transform group-hover:scale-105"
                  onError={(e) => {
                    // Fallback to smaller icon if 512 is missing
                    (e.target as HTMLImageElement).src = '/icons/icon_128x128.png?v=2';
                  }}
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                  <ShieldCheck className="w-3 h-3 text-white" />
                </div>
              </div>

              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                  <Sparkles className="w-3 h-3" /> Gestão Financeira Profissional
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Financeiro
                </h1>
                <p className="text-xs text-slate-400 font-medium">
                  Controle, transparência e pontualidade
                </p>
              </div>
            </div>

            {/* Financial Philosophy Quote Card */}
            <div className="bg-slate-800/60 border border-slate-700/70 rounded-xl p-4 sm:p-5 relative overflow-hidden shadow-inner">
              <div className="absolute top-0 right-0 p-3 opacity-10 text-emerald-400 pointer-events-none">
                <TrendingUp className="w-24 h-24" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-200 leading-relaxed italic relative z-10">
                &ldquo;O controle financeiro não é sobre limitar seus passos, mas sobre ter a
                clareza e a precisão necessárias para impulsionar o seu negócio com solidez e
                tranquilidade.&rdquo;
              </p>
              <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Gestão Inteligente
                </span>
                <span>Visão em Tempo Real</span>
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/40 p-2 rounded-lg border border-slate-800">
                <CalendarCheck className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Controle de Vencimentos</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/40 p-2 rounded-lg border border-slate-800">
                <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Fornecedores e Equipe</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/40 p-2 rounded-lg border border-slate-800">
                <PieChart className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Gráficos e Indicadores</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/40 p-2 rounded-lg border border-slate-800">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Sincronização em Nuvem</span>
              </div>
            </div>
          </div>

          {/* Footer Info on left */}
          <div className="pt-6 mt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>v2.5 &bull; Protegido por Firebase</span>
            <span className="text-emerald-400/90 font-sans font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Sistema Seguro
            </span>
          </div>
        </div>

        {/* Right Side: Authentication Forms */}
        <div className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-center bg-slate-900">
          <div className="max-w-md w-full mx-auto space-y-5">
            {/* Form Title & Subtitle */}
            <div className="text-left space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                {mode === 'LOGIN' && (
                  <>
                    <KeyRound className="w-5 h-5 text-blue-500" /> Acessar Sistema
                  </>
                )}
                {mode === 'REGISTER' && (
                  <>
                    <Sparkles className="w-5 h-5 text-emerald-500" /> Criar Nova Conta
                  </>
                )}
                {mode === 'FORGOT_PASSWORD' && (
                  <>
                    <KeyRound className="w-5 h-5 text-amber-500" /> Recuperar Senha
                  </>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                {mode === 'LOGIN' && 'Informe suas credenciais para gerenciar suas contas.'}
                {mode === 'REGISTER' && 'Preencha os dados abaixo para iniciar sua conta segura.'}
                {mode === 'FORGOT_PASSWORD' &&
                  'Digite seu e-mail cadastrado para receber o link de redefinição.'}
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-tight">{error}</span>
              </div>
            )}

            {/* Success Alert */}
            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-tight">{successMsg}</span>
              </div>
            )}

            {/* Google Quick Login Button (Visible in LOGIN and REGISTER modes) */}
            {mode !== 'FORGOT_PASSWORD' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 hover:border-slate-600 transition-all shadow-md disabled:opacity-50 group cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
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
                  <span>Continuar com Google</span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="h-px bg-slate-800 flex-1" />
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    ou com seu e-mail
                  </span>
                  <div className="h-px bg-slate-800 flex-1" />
                </div>
              </div>
            )}

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* E-mail Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  E-mail Corporativo ou Pessoal
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    required
                    className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700/80 focus:border-blue-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Password Field (only for LOGIN and REGISTER) */}
              {mode !== 'FORGOT_PASSWORD' && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-300">Senha de Acesso</label>

                    {/* Esqueci Minha Senha Button / Link */}
                    {mode === 'LOGIN' && (
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setSuccessMsg(null);
                          setMode('FORGOT_PASSWORD');
                        }}
                        className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold transition-colors hover:underline cursor-pointer"
                      >
                        Esqueci minha senha
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-9 pr-10 py-2 bg-slate-950/80 border border-slate-700/80 focus:border-blue-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                      title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm Password Field (only for REGISTER) */}
              {mode === 'REGISTER' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">Confirme sua Senha</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-700/80 focus:border-blue-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none transition-all shadow-inner"
                    />
                  </div>
                </div>
              )}

              {/* Remember Me Checkbox (only in LOGIN) */}
              {mode === 'LOGIN' && (
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                    />
                    <span>Lembrar meu acesso</span>
                  </label>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-white transition-all shadow-lg cursor-pointer disabled:opacity-50 mt-2 ${
                  mode === 'LOGIN'
                    ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-blue-600/20'
                    : mode === 'REGISTER'
                    ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 shadow-emerald-600/20'
                    : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 shadow-amber-600/20'
                }`}
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>
                      {mode === 'LOGIN' && 'Entrar no Sistema'}
                      {mode === 'REGISTER' && 'Cadastrar e Entrar'}
                      {mode === 'FORGOT_PASSWORD' && 'Enviar Instruções de Recuperação'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Bottom Switching Navigation */}
            <div className="pt-2 border-t border-slate-800/80 text-center space-y-2">
              {mode === 'LOGIN' && (
                <p className="text-xs text-slate-400">
                  Ainda não tem acesso?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setSuccessMsg(null);
                      setMode('REGISTER');
                    }}
                    className="font-bold text-blue-400 hover:text-blue-300 transition-colors hover:underline cursor-pointer"
                  >
                    Cadastre-se gratuitamente
                  </button>
                </p>
              )}

              {mode === 'REGISTER' && (
                <p className="text-xs text-slate-400">
                  Já possui cadastro?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setSuccessMsg(null);
                      setMode('LOGIN');
                    }}
                    className="font-bold text-blue-400 hover:text-blue-300 transition-colors hover:underline cursor-pointer"
                  >
                    Fazer Login
                  </button>
                </p>
              )}

              {mode === 'FORGOT_PASSWORD' && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMsg(null);
                    setMode('LOGIN');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-medium transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar para a tela de login
                </button>
              )}

              {/* Demo Mode / Guest Access Button if requested */}
              {onBypassDemo && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onBypassDemo}
                    className="text-[11px] text-slate-400 hover:text-slate-300 transition-colors hover:underline cursor-pointer"
                  >
                    Explorar em modo de demonstração / convidado &rarr;
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
