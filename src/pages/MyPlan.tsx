import React, { useMemo, useState, useEffect } from 'react';
import { User, Plan } from '../types';
import { getCurrentUser, getGlobalPlans, saveUsers, getUsers, setCurrentUser, notifyDataChanged } from '../services/storage';
import { calculateExpiryDate, formatDisplayDate, isExpired as checkExpired, isWithinGracePeriod } from '../utils/dateUtils';

const MyPlan: React.FC = () => {
  const user = getCurrentUser();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState<Plan | null>(null);
  const [isProcessingUpgrade, setIsProcessingUpgrade] = useState(false);
  const [showPixCode, setShowPixCode] = useState(false);

  useEffect(() => {
    getGlobalPlans().then(setPlans);
  }, []);

  const availableUpgrades = useMemo(() => {
    if (!user || !plans.length) return [];
    const currentPlan = plans.find(p => p.name === user.planName);
    const currentPrice = currentPlan?.price || 0;
    const userDoc = (user.document || '').replace(/\D/g, '');
    
    // Filtra planos globais mais caros OU planos personalizados vinculados ao documento do usuário
    return plans.filter(p => {
      if (p.isPersonalized) {
        return (p.linkedDocument || '').replace(/\D/g, '') === userDoc && p.name !== user.planName;
      }
      return p.price > currentPrice;
    });
  }, [user, plans]);

  const handleUpgrade = async () => {
    if (!user || !selectedUpgradePlan) return;
    
    setIsProcessingUpgrade(true);
    
    // Simula processamento de pagamento
    setTimeout(async () => {
      try {
        const allUsers = await getUsers();
        const updatedUsers = allUsers.map(u => {
          if (u.id === user.id) {
            // Atualiza plano, validade (reset para 30 dias) e status
            const expiresAt = calculateExpiryDate(30);
            return {
              ...u,
              planName: selectedUpgradePlan.name,
              expiresAt: expiresAt,
              active: true
            };
          }
          return u;
        });
        
        await saveUsers(updatedUsers);
        const updatedUser = updatedUsers.find(u => u.id === user.id);
        if (updatedUser) {
          setCurrentUser(updatedUser);
          notifyDataChanged();
        }
        
        setIsUpgradeModalOpen(false);
        setSelectedUpgradePlan(null);
        setShowPixCode(false);
        alert(`Upgrade para o plano ${selectedUpgradePlan.name} realizado com sucesso!`);
      } catch (error) {
        alert('Erro ao processar upgrade.');
      } finally {
        setIsProcessingUpgrade(false);
      }
    }, 2000);
  };

  const details = useMemo(() => {
    if (!user) return null;

    const matchedPlan = plans.find(p => p.name === user.planName);
    
    // Lógica de Alta Precisão (72h exatas) para Demo
    const hasExpiryDate = !!user.expiresAt && user.expiresAt.trim() !== '';
    const now = new Date();
    
    let daysLeftDisplay = '0';
    let expiryDisplayStr = 'ACESSO VITALÍCIO';

    if (hasExpiryDate) {
        const expiryDate = new Date(user.expiresAt!.includes('T') ? user.expiresAt! : user.expiresAt! + 'T23:59:59');
        const diff = expiryDate.getTime() - now.getTime();
        
        if (diff > 0) {
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            
            if (user.role === 'demo') {
                daysLeftDisplay = d > 0 ? `${d}D ${h}H` : `${h}H ${m}M`;
            } else {
                daysLeftDisplay = (d + 1).toString(); // +1 para arredondar para cima amigavelmente
            }
        } else {
            daysLeftDisplay = '0';
        }
        
        expiryDisplayStr = formatDisplayDate(user.expiresAt);
    } else {
        daysLeftDisplay = '∞';
    }

    const isExpired = checkExpired(user.expiresAt);
    const graceDays = user.gracePeriod ?? 10;
    const isInGrace = isWithinGracePeriod(user.expiresAt, graceDays);

    let statusLabel = 'ATIVO';
    let statusColor = 'bg-emerald-600';
    let statusDesc = 'Sua licença está em dia.';

    if (user.role === 'demo') {
        statusLabel = 'CONTA DEMO';
        statusColor = 'bg-indigo-600';
        statusDesc = 'Acesso de teste de 72h. Após o prazo, o terminal será bloqueado automaticamente.';
    } else if (!user.active) {
      statusLabel = 'BLOQUEADO';
      statusColor = 'bg-rose-600';
      statusDesc = 'Acesso interrompido. Regularize sua fatura para reativar o terminal.';
    } else if (isInGrace) {
      statusLabel = 'EM CARÊNCIA';
      statusColor = 'bg-orange-500';
      
      const expiry = new Date(user.expiresAt!.includes('T') ? user.expiresAt! : user.expiresAt! + 'T23:59:59');
      const toleranceLimit = new Date(expiry);
      toleranceLimit.setDate(toleranceLimit.getDate() + graceDays);
      const graceRemaining = Math.max(0, Math.ceil((toleranceLimit.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      
      statusDesc = `Licença vencida. Bloqueio total em ${graceRemaining} dias.`;
    }

    const formatDocument = (doc: string) => {
      if (!doc) return 'NÃO INFORMADO';
      const clean = doc.replace(/\D/g, '');
      if (clean.length === 11) {
        return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      }
      if (clean.length === 14) {
        return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
      }
      return doc;
    };

    return {
      matchedPlan,
      daysLeft: daysLeftDisplay,
      statusLabel,
      statusColor,
      statusDesc,
      createdAtStr: user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : 'Não registrado',
      expiryStr: expiryDisplayStr,
      isVitalicio: !hasExpiryDate,
      formattedDocument: formatDocument(user.document || '')
    };
  }, [user, plans]);

  if (!user || !details) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {user.role === 'demo' && (
          <div className="bg-indigo-600 p-6 rounded-[2rem] text-white flex items-center gap-4 shadow-xl animate-pulse border-4 border-indigo-400">
             <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
             </div>
             <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter">LICENÇA TEMPORÁRIA ATIVA</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Seu tempo restante é de {details.daysLeft}. Aproveite os recursos.</p>
             </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between relative overflow-hidden">
           <div className={`absolute top-0 right-0 px-8 py-3 rounded-bl-[2rem] text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-lg ${details.statusColor}`}>
              {details.statusLabel}
           </div>
           
           <div className="space-y-6">
              <div>
                 <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-tight">Olá, {user.name}</h2>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">ID DO TERMINAL: {user.tenantId}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-slate-50 dark:border-slate-800">
                 <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-2">
                    <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest italic">Documento Registrado</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white tracking-tighter">{details.formattedDocument}</p>
                 </div>
                 <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-2">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Início do Acesso</p>
                    <p className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase italic">{details.createdAtStr}</p>
                 </div>
                 <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-2">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Término do Acesso</p>
                    <p className="text-sm font-black text-slate-700 dark:text-slate-200">{details.expiryStr}</p>
                 </div>
                 <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-2">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tipo de Licença</p>
                    <p className={`text-sm font-black uppercase ${user.role === 'demo' ? 'text-indigo-500' : 'text-emerald-500'}`}>{user.role.toUpperCase()}</p>
                 </div>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase italic bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">{details.statusDesc}</p>
           </div>

           <div className="mt-12 flex items-end justify-between">
              <div>
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Validade Programada</p>
                 <p className="text-2xl font-black italic tracking-tighter text-indigo-500">{details.expiryStr}</p>
              </div>
              <div className="text-right">
                 <span className="text-6xl font-black italic tracking-tighter text-slate-900 dark:text-white">
                    {details.daysLeft}
                 </span>
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tempo Restante</p>
              </div>
           </div>
        </div>

        <div className="bg-slate-955 p-8 md:p-10 rounded-[3rem] shadow-2xl flex flex-col justify-between text-white relative overflow-hidden bg-slate-900">
           <div className="relative z-10">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400 mb-6">Plano Ativo</h3>
              <div className="space-y-4">
                 <h4 className="text-4xl font-black italic uppercase tracking-tighter">{user.planName || 'PERSONALIZADO'}</h4>
                 <div className="flex flex-col gap-2">
                    <div className="inline-block self-start px-4 py-2 bg-white/10 rounded-2xl border border-white/5 font-black text-emerald-400 text-2xl tracking-tighter italic">
                       {details.matchedPlan?.price === 0 ? 'GRÁTIS' : `R$ ${details.matchedPlan?.price.toFixed(2) || '0.00'}`}
                    </div>
                    {details.matchedPlan?.renewalPrice && (
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Próxima Renovação: <span className="text-indigo-400">R$ {details.matchedPlan.renewalPrice.toFixed(2)}</span>
                      </p>
                    )}
                 </div>
              </div>
           </div>

           {availableUpgrades.length > 0 && (
             <div className="mt-8 pt-8 border-t border-white/10">
                <button 
                  onClick={() => setIsUpgradeModalOpen(true)}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeWidth={3}/></svg>
                  Fazer Upgrade de Plano
                </button>
                <p className="text-[8px] font-bold text-slate-400 uppercase text-center mt-3 tracking-widest">Escolha a melhor opção para você</p>
             </div>
           )}
        </div>
      </div>

      {/* MODAL DE UPGRADE */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">Upgrade de Plano</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Selecione uma nova opção de assinatura</p>
              </div>
              <button onClick={() => { setIsUpgradeModalOpen(false); setShowPixCode(false); }} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg></button>
            </div>

            <div className="p-8 space-y-6">
              {!showPixCode ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableUpgrades.map(plan => {
                      const currentPrice = details.matchedPlan?.price || 0;
                      const diff = plan.price - currentPrice;
                      return (
                        <button 
                          key={plan.id}
                          onClick={() => setSelectedUpgradePlan(plan)}
                          className={`p-6 rounded-[2rem] border-2 text-left transition-all ${selectedUpgradePlan?.id === plan.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}
                        >
                          <h4 className="text-sm font-black uppercase italic text-slate-900 dark:text-white mb-1">{plan.name}</h4>
                          <div className="flex items-baseline gap-2 mb-4">
                            <span className="text-2xl font-black text-indigo-600 italic">R$ {plan.price.toFixed(2)}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">/ 30 dias</span>
                          </div>
                          <div className="bg-emerald-500/10 text-emerald-600 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest inline-block">
                            Pague apenas R$ {diff.toFixed(2)}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedUpgradePlan && (
                    <div className="pt-6 border-t dark:border-slate-800">
                      <button 
                        onClick={() => setShowPixCode(true)}
                        className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
                      >
                        Gerar Pagamento Pix
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center space-y-6 py-4">
                  <div className="w-48 h-48 bg-white p-4 rounded-3xl mx-auto shadow-lg border border-slate-100">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=p4zz-upgrade-${selectedUpgradePlan?.id}`} 
                      alt="QR Code Pix"
                      className="w-full h-full"
                    />
                  </div>
                  <div>
                    <h4 className="text-lg font-black uppercase italic text-slate-900 dark:text-white">Aguardando Pagamento</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Escaneie o QR Code acima para pagar R$ {(selectedUpgradePlan!.price - (details.matchedPlan?.price || 0)).toFixed(2)}</p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowPixCode(false)}
                      className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px] rounded-2xl"
                    >
                      Voltar
                    </button>
                    <button 
                      onClick={handleUpgrade}
                      disabled={isProcessingUpgrade}
                      className="flex-[2] py-4 bg-indigo-600 text-white font-black uppercase text-[10px] rounded-2xl shadow-lg flex items-center justify-center gap-2"
                    >
                      {isProcessingUpgrade ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Confirmando...
                        </>
                      ) : 'Já paguei'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPlan;