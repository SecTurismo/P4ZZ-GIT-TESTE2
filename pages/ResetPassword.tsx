import React, { useState, useEffect } from 'react';
import { Key, Lock, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { AppSettings } from '../types';
import { confirmPasswordReset } from 'firebase/auth';
import { auth } from '../firebase';

interface ResetPasswordProps {
  settings: AppSettings;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ settings }) => {
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const t = urlParams.get('oobCode') || urlParams.get('token');
    setToken(t);
    if (!t) {
      setStatus('error');
      setMessage('Token de redefinição não encontrado ou inválido.');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('As senhas não coincidem.');
      return;
    }

    if (newPassword.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (!token) {
      setStatus('error');
      setMessage('Token de redefinição ausente.');
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordReset(auth, token, newPassword);
      setStatus('success');
      setMessage('Sua senha foi redefinida com sucesso! Você já pode fechar esta aba e fazer login no sistema.');
    } catch (error: any) {
      console.error("Erro ao redefinir senha:", error);
      setStatus('error');
      if (error.code === 'auth/expired-action-code') {
        setMessage('O link de redefinição expirou. Solicite um novo.');
      } else if (error.code === 'auth/invalid-action-code') {
        setMessage('O link de redefinição é inválido ou já foi utilizado.');
      } else {
        setMessage('Erro ao redefinir senha. Tente novamente em instantes.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const primaryColor = settings.loginMarketingPrimaryColor || '#4f46e5';

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px]"></div>
      </div>

      <div className="relative w-full max-w-md bg-[#0a0f1e]/80 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-10 shadow-2xl animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-indigo-500/10 rounded-[2rem] flex items-center justify-center text-indigo-400 mx-auto mb-6 border border-indigo-500/20 shadow-inner">
            <Key className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">Redefinir Senha</h2>
          <div className="h-1.5 w-16 mx-auto rounded-full mt-4" style={{ backgroundColor: primaryColor }}></div>
        </div>

        {status === 'success' ? (
          <div className="text-center space-y-6 animate-in slide-in-from-bottom-4">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mx-auto border border-emerald-500/20">
              <CheckCircle className="w-10 h-10" />
            </div>
            <p className="text-sm font-bold text-slate-300 uppercase tracking-widest leading-relaxed">
              {message}
            </p>
            <button 
              onClick={() => window.location.href = '/'}
              className="w-full py-5 bg-emerald-600 rounded-2xl font-black uppercase text-[11px] tracking-[0.3em] text-white shadow-xl active:scale-95 hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              VOLTAR PARA O LOGIN
            </button>
          </div>
        ) : status === 'error' ? (
          <div className="text-center space-y-6 animate-in slide-in-from-bottom-4">
            <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mx-auto border border-rose-500/20">
              <AlertCircle className="w-10 h-10" />
            </div>
            <p className="text-sm font-bold text-rose-400 uppercase tracking-widest leading-relaxed">
              {message}
            </p>
            <button 
              onClick={() => window.location.href = '/'}
              className="w-full py-5 bg-slate-800 rounded-2xl font-black uppercase text-[11px] tracking-[0.3em] text-white shadow-xl active:scale-95 hover:brightness-110 transition-all"
            >
              TENTAR NOVAMENTE
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Nova Senha</label>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="password" 
                  required 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  placeholder="Mínimo 6 caracteres" 
                  className="w-full pl-14 pr-6 py-4 bg-white/5 border-b-2 border-white/10 rounded-2xl text-white font-bold outline-none focus:border-indigo-500 transition-all" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Confirmar Nova Senha</label>
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="password" 
                  required 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  placeholder="Repita a nova senha" 
                  className="w-full pl-14 pr-6 py-4 bg-white/5 border-b-2 border-white/10 rounded-2xl text-white font-bold outline-none focus:border-indigo-500 transition-all" 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting || !token} 
              className="w-full py-5 bg-indigo-600 rounded-2xl font-black uppercase text-[11px] tracking-[0.3em] text-white shadow-xl active:scale-95 hover:brightness-110 transition-all disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              {isSubmitting ? 'PROCESSANDO...' : 'REDEFINIR SENHA AGORA'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
