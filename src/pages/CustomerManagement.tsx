
import React, { useState, useEffect, useCallback } from 'react';
import { Customer, User, Plan } from '../types';
import { getCustomers, saveCustomers, getAppSettings, getUsers, saveUsers, getGlobalPlans } from '../services/storage';
import { calculateExpiryDate, formatDisplayDate, isExpired as checkExpired, isWithinGracePeriod } from '../utils/dateUtils';

const CustomerManagement: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'blocked' | 'tolerance' | 'active'>('all');

  const getLicenseStatus = (customer: Customer, users: User[]) => {
    const linkedUser = users.find(u => u.id === customer.linkedUserId);
    const isDemo = linkedUser?.role === 'demo';
    const graceDays = linkedUser?.gracePeriod ?? 10;
    
    // PRIORIDADE: Status manual do Usuário (Suspenso, Banido ou Bloqueado)
    if (linkedUser && !linkedUser.active) {
      const msg = linkedUser.deactivatedMessage?.toLowerCase() || '';

      if (msg.includes('banido') || msg.includes('termos') || msg.includes('violação')) {
         return { 
            label: 'BANIDO', 
            color: 'text-white', 
            bg: 'bg-rose-700', 
            status: 'blocked' as const,
            desc: 'Violação de Termos' 
         };
      }

      if (isDemo) {
        return { 
          label: 'DEMO EXPIRADA', 
          color: 'text-white', 
          bg: 'bg-slate-700', 
          status: 'blocked' as const,
          desc: 'Período de testes finalizado' 
        };
      }

      return { 
        label: 'SUSPENSO', 
        color: 'text-slate-900', 
        bg: 'bg-yellow-400', 
        status: 'blocked' as const,
        desc: 'Acesso Interrompido' 
      };
    }

    if (customer.licenseExpiresAt) {
        if (checkExpired(customer.licenseExpiresAt, graceDays)) {
            return { label: 'EXPIRADO', color: 'text-white', bg: 'bg-rose-600', status: 'blocked' as const, desc: 'Licença Vencida' };
        }
        
        if (isWithinGracePeriod(customer.licenseExpiresAt, graceDays)) {
            const expiry = new Date(customer.licenseExpiresAt.includes('T') ? customer.licenseExpiresAt : customer.licenseExpiresAt + 'T23:59:59');
            const toleranceLimit = new Date(expiry);
            toleranceLimit.setDate(toleranceLimit.getDate() + graceDays);
            
            const today = new Date();
            const diffTime = toleranceLimit.getTime() - today.getTime();
            const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
            
            return { 
              label: `CARÊNCIA (${diffDays}d)`, 
              color: 'text-white', 
              bg: 'bg-amber-500', 
              status: 'tolerance' as const, 
              desc: `Bloqueio em ${toleranceLimit.toLocaleDateString('pt-BR')}` 
            };
        }

        return { label: isDemo ? 'DEMO ATIVA' : 'LICENÇA ATIVA', color: 'text-white', bg: isDemo ? 'bg-indigo-500' : 'bg-emerald-500', status: 'active' as const, desc: 'Acesso liberado' };
    }

    return { label: 'A DEFINIR', color: 'text-white', bg: 'bg-slate-400', status: 'active' as const, desc: 'Aguardando configuração' };
  };

  const syncUserAccess = useCallback(async (currentCustomers: Customer[], currentUsers: User[]) => {
    let usersChanged = false;
    // Fix: await storage call
    const masterSettings = await getAppSettings('MASTER');
    const unpaidMsg = masterSettings.globalSuspensionMessage || 'Acesso suspenso por falta de pagamento da licença.';

    const updatedUsers = currentUsers.map(user => {
      if (user.tenantId === 'MASTER') return user;

      const linkedCustomer = currentCustomers.find(c => c.linkedUserId === user.id);
      if (!linkedCustomer || !linkedCustomer.licenseExpiresAt) return user;

      const isDemo = user.role === 'demo';
      const graceDays = isDemo ? 0 : (user.gracePeriod ?? 10);
      
      const isExpiredTotal = checkExpired(linkedCustomer.licenseExpiresAt, graceDays);
      
      if (user.active && isExpiredTotal) {
        usersChanged = true;
        return { ...user, active: false, deactivatedMessage: isDemo ? 'CONTA DEMO EXPIRADA: Adquira um plano para continuar.' : unpaidMsg };
      }

      return user;
    });

    if (usersChanged) {
      // Fix: await storage call
      await saveUsers(updatedUsers);
      setSystemUsers(updatedUsers);
    }
  }, []);

  useEffect(() => {
    // Fix: await storage calls in useEffect
    const loadAll = async () => {
        const [loadedCustomers, loadedUsers, loadedPlans] = await Promise.all([
          getCustomers('MASTER'),
          getUsers(),
          getGlobalPlans()
        ]);
        
        const validCustomers = loadedCustomers.filter(c => {
            const linkedUser = loadedUsers.find(u => u.id === c.linkedUserId);
            if (!linkedUser) return false;
            if (linkedUser.role === 'admin' && linkedUser.tenantId === 'MASTER') return false; 
            return true;
        });

        setCustomers(validCustomers);
        setSystemUsers(loadedUsers);
        setPlans(loadedPlans);
        syncUserAccess(validCustomers, loadedUsers);
    };
    loadAll();
  }, [syncUserAccess]);

  const handleRenew = async (customerId: string) => {
    // Fix: await storage call
    const allC = await getCustomers('MASTER');
    const cIdx = allC.findIndex(c => c.id === customerId);
    
    if (cIdx !== -1) {
      const customer = allC[cIdx];
      // Fix: await storage call
      const allU = await getUsers();
      const uIdx = allU.findIndex(u => u.id === customer.linkedUserId);
      const user = allU[uIdx];

      if (!user) return;

      // Fix: await storage call
      const globalPlans = await getGlobalPlans();
      const activePlan = globalPlans.find(p => p.name === (user.planName || customer.planName)) || globalPlans[0];
      const daysToRenew = activePlan ? activePlan.days : 30;

      const expiryStr = calculateExpiryDate(daysToRenew);
      
      allC[cIdx].licenseExpiresAt = expiryStr;
      allC[cIdx].status = 'active';
      // Fix: await storage call
      await saveCustomers(allC, 'MASTER');
      setCustomers(allC);
      
      if (uIdx !== -1) {
        allU[uIdx].active = true;
        allU[uIdx].deactivatedMessage = '';
        allU[uIdx].expiresAt = expiryStr;
        allU[uIdx].paymentNotification = 'approved';
        // Fix: await storage call
        await saveUsers(allU);
        setSystemUsers(allU);
        alert(`Sucesso! O terminal de ${customer.name} foi renovado até ${formatDisplayDate(expiryStr)}.`);
      }
    }
  };

  const filtered = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.linkedUserId || '').toLowerCase().includes(searchTerm.toLowerCase());
    const lStatus = getLicenseStatus(c, systemUsers).status;
    return matchesSearch && (filter === 'all' || filter === lStatus);
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: 'Bloqueados / Expirados', val: customers.filter(c => getLicenseStatus(c, systemUsers).status === 'blocked').length, bg: 'bg-rose-600' },
          { label: 'Em Carência', val: customers.filter(c => getLicenseStatus(c, systemUsers).status === 'tolerance').length, bg: 'bg-amber-500' },
          { label: 'Ativos', val: customers.filter(c => getLicenseStatus(c, systemUsers).status === 'active').length, bg: 'bg-emerald-600' },
          { label: 'Total de Terminais', val: customers.length, bg: 'bg-slate-900' }
        ].map((stat, i) => (
          <div key={i} className={`${stat.bg} p-4 md:p-6 rounded-2xl md:rounded-[2rem] shadow-lg text-white border border-white/10`}>
             <p className="text-[7px] md:text-[8px] font-black opacity-60 uppercase tracking-widest mb-1 truncate">{stat.label}</p>
             <h3 className="text-xl md:text-3xl font-black italic tracking-tighter">{stat.val}</h3>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="relative flex-1">
            <input 
            type="text" 
            placeholder="BUSCAR POR NOME OU ID..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-5 py-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-black uppercase text-[10px] outline-none shadow-inner text-slate-900 dark:text-white" 
            />
            <svg className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={3}/></svg>
        </div>
        <select 
          value={filter} 
          onChange={e => setFilter(e.target.value as any)} 
          className="px-5 py-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border-none font-black text-[10px] uppercase outline-none shadow-inner text-slate-900 dark:text-white"
        >
          <option value="all">FILTRAR STATUS</option>
          <option value="active">ATIVOS</option>
          <option value="tolerance">CARÊNCIA</option>
          <option value="blocked">BLOQUEADOS / EXPIRADOS</option>
        </select>
      </div>

      <div className="hidden lg:block bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
            <tr>
              <th className="px-8 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">Estabelecimento</th>
              <th className="px-8 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Vencimento</th>
              <th className="px-8 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status Licença</th>
              <th className="px-8 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {filtered.map(c => {
               const lStatus = getLicenseStatus(c, systemUsers);
               const linkedUser = systemUsers.find(u => u.id === c.linkedUserId);
               const planName = linkedUser?.planName || c.planName;
               const planDetails = plans.find(p => p.name === planName);
               const planPrice = planDetails ? `R$ ${planDetails.price.toFixed(2)}` : '';

               return (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-all">
                  <td className="px-8 py-6">
                    <div className="font-black text-slate-900 dark:text-white text-sm uppercase italic tracking-tighter leading-tight">{c.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="text-[8px] font-black text-indigo-500 uppercase">ID: {c.linkedUserId}</span>
                       <span className="text-[7px] font-black text-slate-400 uppercase italic tracking-widest">
                         Plano: {planName || 'PERSONALIZADO'} {planPrice && <span className="text-emerald-500">- {planPrice}</span>}
                       </span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center font-black text-slate-500 italic text-xs">
                    {formatDisplayDate(c.licenseExpiresAt)}
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className={`mx-auto w-52 py-2.5 rounded-2xl text-[8px] font-black uppercase tracking-widest text-center shadow-md ${lStatus.bg} ${lStatus.color}`}>
                      {lStatus.label}
                    </div>
                    <p className="text-[7px] font-bold text-slate-400 mt-1 uppercase italic">{lStatus.desc}</p>
                  </td>
                  <td className="px-8 py-6 text-right">
                     <button onClick={() => handleRenew(c.id)} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest shadow-md hover:scale-105 transition-all">RENOVAR</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="lg:hidden space-y-4 px-2">
        {filtered.map(c => {
          const lStatus = getLicenseStatus(c, systemUsers);
          
          return (
            <div key={c.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-800 animate-in slide-in-from-bottom-4">
               <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 min-w-0 pr-4">
                     <h4 className="font-black text-sm uppercase italic text-slate-900 dark:text-white truncate">{c.name}</h4>
                     <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">@{c.linkedUserId}</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl text-[7px] font-black uppercase tracking-widest shadow-sm text-center min-w-[100px] ${lStatus.bg} ${lStatus.color}`}>
                    {lStatus.label.split(' ')[0]}
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3 mb-5 p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Vencimento</p>
                    <p className="text-[10px] font-black text-slate-700 dark:text-slate-300 italic">
                        {formatDisplayDate(c.licenseExpiresAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Motivo Status</p>
                    <p className={`text-[9px] font-black uppercase truncate ${lStatus.bg.replace('bg-', 'text-')}`}>{lStatus.desc}</p>
                  </div>
               </div>

               <button 
                  onClick={() => handleRenew(c.id)} 
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
               >
                  Renovar Licença
               </button>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
          <div className="py-24 text-center">
             <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 opacity-30">
                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             </div>
             <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em]">Nenhum terminal vencido para acompanhar</p>
          </div>
      )}
    </div>
  );
};

export default CustomerManagement;
