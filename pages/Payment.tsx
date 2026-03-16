import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { uploadFile } from '../services/upload';
import type { PaymentRequest, User, AppSettings, Plan } from '../types';
import { 
  getPaymentRequests, 
  savePaymentRequest, 
  getAppSettings, 
  getCurrentUser, 
  setCurrentUser,
  getUsers, 
  saveUsers,
  getCustomers,
  saveCustomers,
  getGlobalPlans,
  saveAppSettings,
  getAffiliateCommissions,
  saveAffiliateCommissions,
  DEFAULT_SETTINGS
} from '../services/storage';
import { calculateExpiryDate, isExpired as checkExpired, isWithinGracePeriod } from '../src/utils/dateUtils';
import { createPixPayment, checkPaymentStatus } from '../services/mercadoPago';
import type { PixPaymentResponse } from '../services/mercadoPago';

// Helper de Mascaramento de Segurança (Para exibição pública)
const maskDocumentSafe = (val: string = '') => {
  const v = val.replace(/\D/g, '');
  if (v.length === 11) return `${v.slice(0, 3)}.***.***-${v.slice(-2)}`;
  if (v.length === 14) return `${v.slice(0, 2)}.***.***/****-${v.slice(-2)}`;
  return v.length > 2 ? `${v.slice(0, 2)}...${v.slice(-2)}` : v;
};

interface PaymentProps {
  onUpdate?: () => void;
  onNavigate?: (view: any, tab?: any) => void;
}

const Payment: React.FC<PaymentProps> = ({ onUpdate, onNavigate }) => {
  const user = useMemo(() => getCurrentUser(), []);
  const isAdmin = user?.role === 'admin';
  const isMaster = user?.tenantId === 'MASTER' && isAdmin;
  
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  
  // --- STATES PARA CLIENTE ---
  const [paymentMode, setPaymentMode] = useState<'manual' | 'pix'>('pix');
  const [customerMessage, setCustomerMessage] = useState('');
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States PIX Automático
  const [pixAmount, setPixAmount] = useState<number>(0);
  const [pixData, setPixData] = useState<PixPaymentResponse | null>(null);
  const [pixStatus, setPixStatus] = useState<string>('pending');
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);

  // --- STATES PARA ADMIN ---
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'reject', req: PaymentRequest } | null>(null);
  const [adminMessage, setAdminMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');

  const loadRequests = useCallback(async () => {
    const [reqs, users] = await Promise.all([getPaymentRequests(), getUsers()]);
    setRequests(reqs);
    setSystemUsers(users);
  }, []);

  const handlePixPaymentNotification = useCallback(async (mpId: string, amount: number) => {
    if (!user) return;
    
    // Se for cliente de afiliado, aprova automaticamente
    const isAffiliateCustomer = !!user?.affiliateId;
    const status = isAffiliateCustomer ? 'approved' : 'pending';

    const newRequest: PaymentRequest = {
        id: Math.random().toString(36).substr(2, 9),
        userId: user.id,
        tenantId: user.tenantId,
        userName: user.name,
        payerName: user.name.toUpperCase(),
        payerDocument: user.document || "SISTEMA AUTOMÁTICO",
        paymentTime: new Date().toLocaleTimeString(),
        createdAt: new Date().toISOString(),
        status: status,
        mpPaymentId: mpId,
        amount: amount
    };

    if (isAffiliateCustomer) {
        // Lógica de Renovação Automática
        const [allUsers, globalPlans, settings] = await Promise.all([
            getUsers(), 
            getGlobalPlans(),
            getAppSettings('MASTER')
        ]);
        
        const userIdx = allUsers.findIndex(u => u.id === user.id);
        const targetUser = allUsers[userIdx];
        
        if (targetUser) {
            const currentPlan = globalPlans.find(p => p.name === targetUser.planName);
            const daysToRenew = currentPlan ? currentPlan.days : 30;
            
            const expiryStr = calculateExpiryDate(daysToRenew, targetUser.expiresAt);

            allUsers[userIdx].active = true;
            allUsers[userIdx].expiresAt = expiryStr;
            allUsers[userIdx].deactivatedMessage = ''; 
            allUsers[userIdx].paymentNotification = 'approved';
            allUsers[userIdx].adminResponseMessage = settings.billingApprovedMessage || 'Seu pagamento foi aprovado automaticamente.';
            await saveUsers(allUsers);

            // Atualiza o usuário na sessão atual para refletir no painel imediatamente
            const updatedSessionUser = { 
                ...user, 
                active: true, 
                expiresAt: expiryStr,
                paymentNotification: 'approved'
            };
            setCurrentUser(updatedSessionUser);

            // Atualiza Customer
            const allCustomers = await getCustomers('MASTER');
            const custIdx = allCustomers.findIndex(c => c.linkedUserId === user.id);
            if (custIdx !== -1) {
                allCustomers[custIdx].licenseExpiresAt = expiryStr;
                allCustomers[custIdx].status = 'active';
                await saveCustomers(allCustomers, 'MASTER');
            }

            // Geração de Comissão
            const basePrice = currentPlan ? currentPlan.price : (settings.affiliateBasePrice || 50);
            const sellingPrice = amount;
            const commissionPercent = settings.affiliateCommissionPercent || 0;
            
            const profit = Math.max(0, sellingPrice - basePrice);
            const commissionAmount = commissionPercent > 0 
                ? (profit * (commissionPercent / 100))
                : profit;

            if (commissionAmount > 0) {
                const newCommission = {
                    id: 'comm-' + Math.random().toString(36).substr(2, 9),
                    affiliateId: targetUser.affiliateId,
                    customerId: targetUser.id,
                    customerName: targetUser.name,
                    basePrice: basePrice,
                    sellingPrice: sellingPrice,
                    commissionAmount: commissionAmount,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    requestId: newRequest.id
                };
                const allComms = await getAffiliateCommissions();
                await saveAffiliateCommissions([...allComms, newCommission as any]);
            }
        }
    }

    await savePaymentRequest(newRequest);
    loadRequests();
    setPixData(null);
    setShowSuccess(true);
    if (onUpdate) onUpdate();
  }, [user, loadRequests, onUpdate]);

  useEffect(() => {
    loadRequests();
    getAppSettings('MASTER').then(setSettings);

    if (!isAdmin && user) {
        if (user.sellingPrice) {
            setPixAmount(user.sellingPrice);
        } else {
            getGlobalPlans().then(globalPlans => {
              const matchedPlan = globalPlans.find(p => p.name === user.planName) || globalPlans[0];
              const price = matchedPlan ? matchedPlan.price : 99.90;
              setPixAmount(price);
            });
        }
    }
  }, [isAdmin, user, loadRequests]);

  // Monitoramento de status do PIX (Estabilizado para evitar travamentos)
  useEffect(() => {
    let interval: any;
    if (pixData && pixStatus === 'pending') {
      interval = setInterval(async () => {
        try {
            const status = await checkPaymentStatus(pixData.id);
            if (status === 'approved') {
              setPixStatus('approved');
              handlePixPaymentNotification(pixData.id, pixAmount);
            } else if (status === 'cancelled' || status === 'rejected') {
              setPixStatus(status);
            }
        } catch (e) { console.error("Erro ao checar status do PIX"); }
      }, 5000);
    }
    return () => { if(interval) clearInterval(interval); };
  }, [pixData, pixStatus, pixAmount, handlePixPaymentNotification]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Limite de 1MB conforme solicitado para evitar bloat no servidor
      if (file.size > 1 * 1024 * 1024) {
        alert("O arquivo excede o limite de 1MB.");
        e.target.value = '';
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      // Se já houver um comprovante carregado, podemos passar para deletar o antigo
      if (receiptImage && !receiptImage.startsWith('data:')) {
        formData.append('oldPath', receiptImage);
      }

      try {
        const url = await uploadFile(file, 'receipts');
        setReceiptImage(url);
      } catch (error) {
        console.error('Erro no upload:', error);
        alert('Erro ao fazer upload do comprovante para o Firebase Storage.');
      } finally {
        e.target.value = '';
      }
    }
  };

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !receiptImage) {
        alert("Anexe o comprovante.");
        return;
    }
    setIsSubmitting(true);
    
    try {
      const newRequest: PaymentRequest = {
        id: Math.random().toString(36).substr(2, 9),
        userId: user.id,
        tenantId: user.tenantId,
        userName: user.name,
        payerName: user.name.toUpperCase(), 
        payerDocument: user.document || "NÃO INFORMADO", 
        paymentTime: new Date().toLocaleTimeString(),
        receiptImage: receiptImage,
        createdAt: new Date().toISOString(),
        status: 'pending',
        amount: pixAmount,
        customerMessage: customerMessage
      };
      await savePaymentRequest(newRequest);
      loadRequests();
      setShowSuccess(true);
    } catch (err) {
      alert("Erro ao enviar comprovante.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGeneratePix = async () => {
    if (!user?.email || !settings.mercadoPagoAccessToken) {
        alert("Sistema de pagamentos não configurado corretamente.");
        return;
    }
    setIsGeneratingPix(true);
    try {
      const data = await createPixPayment(pixAmount, `Renovação ${user.name}`, user.email);
      if (data) { setPixData(data); setPixStatus('pending'); }
    } catch (err: any) {
        alert(err.message || "Erro ao gerar PIX");
    } finally { setIsGeneratingPix(false); }
  };

  const executeAction = async () => {
    if (!confirmAction) return;
    const { type, req } = confirmAction;
    
    const [allUsers, globalPlans] = await Promise.all([getUsers(), getGlobalPlans()]);
    const userIdx = allUsers.findIndex(u => u.id === req.userId);
    const targetUser = allUsers[userIdx];
    
    if (type === 'approve') {
        const currentPlan = globalPlans.find(p => p.name === targetUser?.planName);
        const daysToRenew = currentPlan ? currentPlan.days : 30;
        const expiryStr = calculateExpiryDate(daysToRenew, targetUser?.expiresAt);

        if (userIdx !== -1) {
            allUsers[userIdx].active = true;
            allUsers[userIdx].expiresAt = expiryStr;
            allUsers[userIdx].deactivatedMessage = ''; 
            allUsers[userIdx].paymentNotification = 'approved';
            allUsers[userIdx].adminResponseMessage = adminMessage || settings.billingApprovedMessage || 'Seu pagamento foi aprovado.';
            await saveUsers(allUsers);
        }

        const allCustomers = await getCustomers('MASTER');
        const custIdx = allCustomers.findIndex(c => c.linkedUserId === req.userId);
        if (custIdx !== -1) {
            allCustomers[custIdx].licenseExpiresAt = expiryStr;
            allCustomers[custIdx].status = 'active';
            await saveCustomers(allCustomers, 'MASTER');
        }

        await savePaymentRequest({ ...req, status: 'approved', adminMessage: adminMessage });

        // Geração de Comissão para Afiliado na Renovação
        if (targetUser?.affiliateId) {
            const basePrice = currentPlan ? currentPlan.price : (settings.affiliateBasePrice || 50);
            const sellingPrice = targetUser.sellingPrice || req.amount || (currentPlan?.price || 0);
            const commissionPercent = settings.affiliateCommissionPercent || 0;
            
            const profit = Math.max(0, sellingPrice - basePrice);
            const commissionAmount = commissionPercent > 0 
                ? (profit * (commissionPercent / 100))
                : profit;

            if (commissionAmount > 0) {
                const newCommission = {
                    id: 'comm-' + Math.random().toString(36).substr(2, 9),
                    affiliateId: targetUser.affiliateId,
                    customerId: targetUser.id,
                    customerName: targetUser.name,
                    basePrice: basePrice,
                    sellingPrice: sellingPrice,
                    commissionAmount: commissionAmount,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    requestId: req.id
                };
                const allComms = await getAffiliateCommissions();
                await saveAffiliateCommissions([...allComms, newCommission as any]);
            }
        }
    } else {
        if (userIdx !== -1) {
             allUsers[userIdx].paymentNotification = 'rejected';
             allUsers[userIdx].deactivatedMessage = `PAGAMENTO RECUSADO: ${adminMessage}`;
             allUsers[userIdx].active = false; 
             await saveUsers(allUsers);
        }
        await savePaymentRequest({ ...req, status: 'rejected', rejectionReason: adminMessage, adminMessage: adminMessage });
    }
    setConfirmAction(null);
    setAdminMessage('');
    loadRequests();
    if (onUpdate) onUpdate();
  };


  const expiryStatus = useMemo(() => {
    if (!user || !user.expiresAt) return null;
    
    const grace = settings?.defaultGracePeriod ?? 10;
    
    if (checkExpired(user.expiresAt, grace)) {
      return { label: 'CARÊNCIA ATIVA', color: 'text-rose-500', bg: 'bg-rose-50', msg: `Seu plano está expirado.` };
    }
    
    if (isWithinGracePeriod(user.expiresAt, grace)) {
      return { label: 'CARÊNCIA ATIVA', color: 'text-orange-500', bg: 'bg-orange-50', msg: `Seu plano está em período de carência.` };
    }

    return { label: 'PLANO ATIVO', color: 'text-emerald-600', bg: 'bg-emerald-50', msg: `Sua licença está ativa.` };
  }, [user, settings]);

  if (isAdmin) {
    const activeReqs = requests.filter(r => r.status === activeTab);
    return (
      <div className="space-y-8 pb-24 animate-in fade-in duration-500 max-w-6xl mx-auto">
        {confirmAction && (
            <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 w-full max-w-[380px] rounded-[2.5rem] p-10 shadow-2xl border border-white/10 text-center animate-in zoom-in-95">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl ${confirmAction.type === 'approve' ? 'bg-emerald-500' : 'bg-rose-600'} text-white`}>
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={confirmAction.type === 'approve' ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"}/></svg>
                    </div>
                    <h3 className={`text-xl font-black uppercase italic mb-2 tracking-tighter ${confirmAction.type === 'approve' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {confirmAction.type === 'approve' ? 'Aprovar Pagamento?' : 'Rejeitar Pagamento?'}
                    </h3>
                    <textarea 
                        value={adminMessage} 
                        onChange={e => setAdminMessage(e.target.value)} 
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border rounded-xl text-[10px] font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-6" 
                        placeholder="Mensagem para o cliente..." 
                        rows={3}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setConfirmAction(null)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Voltar</button>
                        <button onClick={executeAction} className={`py-4 rounded-2xl text-white font-black text-[10px] uppercase tracking-widest shadow-lg transition-all ${confirmAction.type === 'approve' ? 'bg-emerald-500' : 'bg-rose-600'}`}>Confirmar</button>
                    </div>
                </div>
            </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2.5}/></svg>
                </div>
                <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">Gestão Financeira</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Controle de Renovação e Faturas</p>
                </div>
            </div>
            {isMaster && (
                <button 
                  onClick={() => onNavigate?.('settings', 'payments')} 
                  className="px-8 py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-105 transition-all"
                >
                  Configurações PIX
                </button>
            )}
        </div>

        <div className="flex md:justify-center overflow-x-auto pb-4 no-print">
            <div className="bg-slate-200 dark:bg-slate-800 p-1.5 rounded-full flex shadow-inner whitespace-nowrap">
                <button onClick={() => setActiveTab('pending')} className={`px-8 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'pending' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md' : 'text-slate-500'}`}>Pendentes {requests.filter(r => r.status === 'pending').length > 0 && <span className="bg-rose-500 text-white w-4 h-4 rounded-full inline-flex items-center justify-center ml-2 text-[7px] animate-pulse">{requests.filter(r => r.status === 'pending').length}</span>}</button>
                <button onClick={() => setActiveTab('approved')} className={`px-8 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'approved' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-500'}`}>Aprovados</button>
                <button onClick={() => setActiveTab('rejected')} className={`px-8 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'rejected' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-500'}`}>Recusados</button>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-950 border-b">
                        <tr>
                            <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest">Identificação</th>
                            <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Data / Hora</th>
                            <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Valor</th>
                            {activeTab === 'pending' && <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold uppercase" style={{ fontSize: '11px' }}>
                        {activeReqs.length === 0 ? (
                            <tr><td colSpan={5} className="py-24 text-center opacity-30 italic font-black uppercase text-[10px]">Nenhum registro localizado</td></tr>
                        ) : (
                            activeReqs.map(req => (
                                <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                                    <td className="px-10 py-6">
                                        <p className="font-black text-slate-900 dark:text-white leading-none">{req.userName}</p>
                                        <p className="text-[9px] font-bold text-slate-400 mt-1">Tenant ID: {req.tenantId}</p>
                                    </td>
                                    <td className="px-10 py-6 text-center">
                                        <p className="text-[10px] text-slate-500">{new Date(req.createdAt).toLocaleDateString()}</p>
                                        <p className="text-[8px] font-black text-indigo-500">{req.paymentTime}</p>
                                    </td>
                                    <td className="px-10 py-6 text-center font-black italic text-emerald-600">R$ {req.amount?.toFixed(2)}</td>
                                    {activeTab === 'pending' && (
                                        <td className="px-10 py-6 text-right">
                                            <div className="flex justify-end gap-2">
                                                {req.receiptImage && (
                                                    <button onClick={() => { const win = window.open(""); win?.document.write(`<img src="${req.receiptImage}" style="max-width:100%" />`); }} className="p-2.5 text-indigo-500 bg-indigo-50 rounded-xl shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth={2}/></svg></button>
                                                )}
                                                <button onClick={() => setConfirmAction({type:'reject', req})} className="p-2.5 text-rose-500 bg-rose-50 rounded-xl shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg></button>
                                                <button onClick={() => setConfirmAction({type:'approve', req})} className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md hover:brightness-110 active:scale-95 transition-all">Aprovar</button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-24 animate-in fade-in duration-500">
      {showSuccess ? (
          <div className="text-center space-y-6 py-20 bg-white dark:bg-slate-900 rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-800 animate-in zoom-in-95">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-500/20">
                  <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-xl font-black uppercase text-emerald-500 italic">
                {user?.affiliateId ? 'Pagamento Confirmado!' : 'Pagamento em Análise!'}
              </h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest px-12 leading-relaxed">
                {user?.affiliateId 
                  ? 'Seu pagamento foi processado e seu plano foi renovado automaticamente. Aproveite!' 
                  : 'Recebemos sua solicitação. O administrador analisará os dados em instantes para renovar seu terminal.'}
              </p>
              <button onClick={() => setShowSuccess(false)} className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all shadow-lg">Entendido</button>
          </div>
      ) : (
          <div className="space-y-6">
            {expiryStatus && (
                <div className={`${expiryStatus.bg} p-6 rounded-[2.5rem] border-l-8 border-current shadow-sm flex items-center gap-6 ${expiryStatus.color} animate-bounce-subtle`}>
                    <div className="w-12 h-12 bg-white/50 rounded-2xl flex items-center justify-center shadow-inner"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={3}/></svg></div>
                    <div><p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">{expiryStatus.label}</p><p className="text-sm font-bold uppercase">{expiryStatus.msg}</p></div>
                </div>
            )}

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 space-y-8">
                {!user?.affiliateId && (
                  <div className="flex bg-slate-200 dark:bg-slate-800 p-1.5 rounded-full flex shadow-inner w-fit mx-auto">
                      <button onClick={() => setPaymentMode('pix')} className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${paymentMode === 'pix' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md' : 'text-slate-500'}`}>PIX Automático</button>
                      <button onClick={() => setPaymentMode('manual')} className={`px-8 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${paymentMode === 'manual' ? 'bg-white dark:bg-slate-700 text-slate-900 shadow-md' : 'text-slate-500'}`}>PIX Manual</button>
                  </div>
                )}

                {paymentMode === 'pix' ? (
                    <div className="flex flex-col items-center">
                        {!pixData ? (
                            <div className="w-full space-y-6">
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-700 text-center">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Valor do Plano: {user?.planName || 'PERSONALIZADO'}</span>
                                    <span className="text-4xl font-black italic text-slate-900 dark:text-white">R$ {pixAmount.toFixed(2)}</span>
                                </div>
                                <button onClick={handleGeneratePix} disabled={isGeneratingPix} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black uppercase text-[11px] tracking-[0.3em] shadow-xl active:scale-95 transition-all hover:scale-[1.02]">
                                    {isGeneratingPix ? 'Processando...' : `Gerar QR Code Pix no valor de R$ ${pixAmount.toFixed(2).replace('.', ',')}`}
                                </button>
                                <p className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-widest">Liberação imediata após a confirmação bancária.</p>
                            </div>
                        ) : (
                            <div className="animate-in zoom-in-95 w-full text-center space-y-6">
                                <div className="bg-white p-4 rounded-[2.5rem] inline-block shadow-2xl border-4 border-indigo-500">
                                    <img src={`data:image/png;base64,${pixData.qr_code_base64}`} className="w-52 h-52 object-contain" alt="QR Code" />
                                </div>
                                <button onClick={() => { navigator.clipboard.writeText(pixData.qr_code); alert("Código PIX copiado!"); }} className="w-full bg-slate-950 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Copiar Código PIX</button>
                                <div className="flex items-center justify-center gap-3 text-emerald-500 animate-pulse font-black text-[10px] uppercase tracking-widest">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                    Aguardando Confirmação...
                                </div>
                                <button onClick={() => setPixData(null)} className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Voltar</button>
                            </div>
                        )}
                    </div>
                ) : (
                    <form onSubmit={handleSubmitManual} className="space-y-6">
                        <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-900/30">
                            <h4 className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-3 italic">Instruções para Depósito</h4>
                            <p className="text-sm font-bold text-emerald-900 dark:text-slate-300 whitespace-pre-line leading-relaxed">{settings.paymentInstructions || 'Chave PIX: 49.507.779/0001-25 (CNPJ)'}</p>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Valor da Renovação (Automático)</label>
                                <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 rounded-2xl font-black text-sm text-indigo-500 shadow-inner">R$ {pixAmount.toFixed(2)}</div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Anexar Comprovante (Obrigatório)</label>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
                                <button type="button" onClick={() => fileInputRef.current?.click()} className={`w-full py-6 border-2 border-dashed rounded-2xl transition-all flex flex-col items-center justify-center gap-2 ${receiptImage ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-indigo-400'}`}>
                                    {receiptImage ? (
                                        <div className="flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={3}/></svg><span className="font-black text-[10px] uppercase">Arquivo Carregado ✓</span></div>
                                    ) : (
                                        <>
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4-4m4 4V4" strokeWidth={2}/></svg>
                                            <span className="font-black text-[10px] uppercase">Tirar Foto ou Anexar Arquivo</span>
                                        </>
                                    )}
                                </button>
                            </div>
                            <textarea value={customerMessage} onChange={e => setCustomerMessage(e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner resize-none" rows={3} placeholder="MENSAGEM ADICIONAL (OPCIONAL)" />
                        </div>

                        <button type="submit" disabled={isSubmitting || !receiptImage} className="w-full bg-emerald-600 text-white py-6 rounded-3xl font-black uppercase text-[11px] tracking-[0.3em] shadow-xl active:scale-95 transition-all disabled:opacity-30">
                            {isSubmitting ? 'Transmitindo...' : 'Enviar para Auditoria'}
                        </button>
                    </form>
                )}
            </div>
            
            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-6 rounded-[2rem] border border-indigo-100 dark:border-indigo-800 flex items-start gap-4">
                <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-indigo-600 shrink-0 shadow-sm"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2.5}/></svg></div>
                <div className="space-y-1"><p className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest italic">Aviso de Renovação</p><p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase">O envio do comprovante manual pode levar até 2 horas úteis para ser aprovado. Utilize o PIX Automático para liberação em segundos.</p></div>
            </div>
          </div>
      )}
    </div>
  );
};

export default Payment;