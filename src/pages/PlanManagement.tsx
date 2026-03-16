import React, { useState, useEffect, useMemo } from 'react';
import { Plan, User, Customer, AccessRequest } from '../types';
import { 
  getGlobalPlans, saveGlobalPlans, getUsers, saveUsers, 
  getCustomers, saveCustomers, getAccessRequests, notifyDataChanged 
} from '../services/storage';
import { calculateExpiryDate, formatDisplayDate, isExpired as checkExpired } from '../utils/dateUtils';

const PlanManagement: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [modalType, setModalType] = useState<'global' | 'personalized' | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [searchPersonalized, setsearchPersonalized] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  
  // Estado de erros para feedback visual
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const initialUserFormData = {
    name: '',
    email: '',
    password: '',
    whatsapp: '',
    role: 'customer' as User['role'],
    tenantId: 'MASTER',
    login: '',
    gracePeriod: 0,
    expiresAt: '',
    planName: '',
    linkedDocument: ''
  };

  const [section1Data, setSection1Data] = useState({...initialUserFormData});
  const [section2Data, setSection2Data] = useState({...initialUserFormData});
  const [foundUser1, setFoundUser1] = useState<User | null>(null);
  const [foundUser2, setFoundUser2] = useState<User | null>(null);
  const [docError1, setDocError1] = useState('');
  const [docError2, setDocError2] = useState('');

  const [formData, setFormData] = useState<Partial<Plan & { personalizedType: 'renewal' | 'exclusive' }>>({
    name: '',
    days: 30,
    price: 0,
    renewalPrice: 0,
    description: '',
    isPersonalized: false,
    linkedDocument: '',
    personalizedType: 'renewal'
  });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'general' | 'personalized'>('general');

  useEffect(() => {
    const loadInitialData = async () => {
        await refreshPlans();
        const users = await getUsers();
        setSystemUsers(users);
    };
    loadInitialData();
  }, []);

  const refreshPlans = async () => {
    try {
        const p = await getGlobalPlans();
        setPlans(Array.isArray(p) ? p : []);
    } catch (e) {
        setPlans([]);
    }
  };

  const getClientNameByDoc = (doc?: string) => {
    if (!doc) return '---';
    const cleanDoc = doc.replace(/\D/g, '');
    const user = systemUsers.find(u => (u.document || '').replace(/\D/g, '') === cleanDoc);
    return user ? user.name : 'USUÁRIO NÃO LOCALIZADO';
  };

  const getUserStatusByDoc = (doc?: string) => {
    if (!doc) return 'inactive';
    const cleanDoc = doc.replace(/\D/g, '');
    const user = systemUsers.find(u => (u.document || '').replace(/\D/g, '') === cleanDoc);
    if (!user) return 'inactive';
    
    // Se o usuário estiver inativo manualmente, retorna inativo
    if (!user.active) return 'inactive';

    // Se tiver data de expiração, verifica se já venceu
    if (user.expiresAt) {
      if (checkExpired(user.expiresAt)) return 'inactive';
    }

    return 'active';
  };

  const getExpiryByDoc = (doc?: string) => {
    if (!doc) return '---';
    const cleanDoc = doc.replace(/\D/g, '');
    const user = systemUsers.find(u => (u.document || '').replace(/\D/g, '') === cleanDoc);
    return formatDisplayDate(user?.expiresAt);
  };

  const formatDocument = (val: string = '') => {
    const v = val.replace(/\D/g, '').slice(0, 14);
    if (v.length <= 11) {
      return v
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return v
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };

  const formatWhatsApp = (val: string = '') => {
    const v = val.replace(/\D/g, '').slice(0, 11);
    if (v.length <= 10) {
      return v
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
    }
    return v
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
  };

  const verifyDocument = (doc: string, section: 'section1' | 'section2') => {
    const cleanDoc = doc.replace(/\D/g, '');
    if (cleanDoc.length < 11) {
      if (section === 'section1') { setFoundUser1(null); setDocError1(''); }
      else { setFoundUser2(null); setDocError2(''); }
      return;
    }
    
    const userMatch = systemUsers.find(u => (u.document || '').replace(/\D/g, '') === cleanDoc);
    
    // Se estamos editando, o documento atual do plano não deve disparar erro de duplicidade
    const isCurrentDoc = editingPlan && (editingPlan.linkedDocument || '').replace(/\D/g, '') === cleanDoc;

    if (userMatch && !isCurrentDoc) {
      if (section === 'section1') {
        setDocError1('Este documento já pertence a um usuário cadastrado');
        setFoundUser1(userMatch);
      } else {
        setDocError2('Este documento já pertence a um usuário cadastrado');
        setFoundUser2(userMatch);
      }
    } else {
      if (section === 'section1') {
        setDocError1('');
        setFoundUser1(null);
      } else {
        setDocError2('');
        setFoundUser2(null);
      }
    }
  };

  const handleOpenModal = async (plan?: Plan, type?: 'global' | 'personalized') => {
    setFormErrors({});
    setFoundUser1(null);
    setFoundUser2(null);
    setDocError1('');
    setDocError2('');
    setSection1Data({...initialUserFormData});
    setSection2Data({...initialUserFormData});
    setSelectedUserId('');
    
    // Atualiza a lista de usuários antes de abrir para garantir dados frescos
    const latestUsers = await getUsers();
    setSystemUsers(latestUsers);
    
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        ...plan,
        personalizedType: plan.renewalPrice ? 'renewal' : 'exclusive'
      });
      setModalType(plan.isPersonalized ? 'personalized' : 'global');

      if (plan.isPersonalized && plan.linkedDocument) {
          const doc = formatDocument(plan.linkedDocument);
          setSection1Data(prev => ({...prev, linkedDocument: doc}));
          
          const cleanDoc = doc.replace(/\D/g, '');
          const userMatch = latestUsers.find(u => (u.document || '').replace(/\D/g, '') === cleanDoc);
          if (userMatch) {
            setFoundUser1(userMatch);
            setSelectedUserId(userMatch.id);
            setSection1Data({
              name: userMatch.name,
              email: userMatch.email,
              login: userMatch.login || userMatch.email,
              password: '',
              whatsapp: formatWhatsApp(userMatch.whatsapp || ''),
              role: userMatch.role,
              tenantId: userMatch.tenantId || 'MASTER',
              gracePeriod: userMatch.gracePeriod || 0,
              expiresAt: userMatch.expiresAt || '',
              planName: userMatch.planName || '',
              linkedDocument: formatDocument(userMatch.document)
            });
          }
      }
    } else {
      setEditingPlan(null);
      const targetType = type || (activeTab === 'general' ? 'global' : 'personalized');
      setModalType(targetType);
      
      setFormData({ 
        name: '', 
        days: 30, 
        price: 0, 
        renewalPrice: 0,
        description: '', 
        isPersonalized: targetType === 'personalized', 
        linkedDocument: '',
        personalizedType: 'renewal'
      });
    }
    setIsModalOpen(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.name || !formData.name.trim()) errors.name = 'O nome do plano é obrigatório';
    if (!formData.days || Number(formData.days) <= 0) errors.days = 'Mínimo 1 dia';
    
    if (formData.isPersonalized) {
        if (formData.personalizedType === 'exclusive') {
            const doc = section2Data.linkedDocument.replace(/\D/g, '');
            if (doc.length !== 11 && doc.length !== 14) {
                errors.document2 = 'Documento inválido (11 ou 14 dígitos)';
            }
            const wa = section2Data.whatsapp.replace(/\D/g, '');
            if (wa.length !== 10 && wa.length !== 11) {
                errors.whatsapp2 = 'WhatsApp inválido (10 ou 11 dígitos)';
            }
            if (!section2Data.email) {
                errors.email2 = 'E-mail obrigatório';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(section2Data.email)) {
                errors.email2 = 'E-mail inválido';
            }
            if (!section2Data.login) {
                errors.login2 = 'Login obrigatório';
            }
        } else {
            // Renewal type might also need validation if we are creating a user
            if (formData.renewalPrice === undefined || Number(formData.renewalPrice) < 0) {
                errors.renewalPrice = 'Valor de renovação inválido';
            }
        }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    
    setIsSaving(true);
    try {
        const planNameUpper = formData.name!.toUpperCase();
        const activeData = section2Data; // Usando section2Data como padrão para o novo estilo de formulário
        const linkedDoc = formData.isPersonalized ? activeData.linkedDocument.replace(/\D/g, '') : undefined;

        const newPlan: Plan = {
          id: editingPlan ? editingPlan.id : Math.random().toString(36).substr(2, 9),
          name: planNameUpper,
          days: Number(formData.days),
          price: Number(formData.price),
          renewalPrice: formData.personalizedType === 'renewal' ? Number(formData.renewalPrice) : undefined,
          description: formData.description || '',
          isPersonalized: !!formData.isPersonalized,
          linkedDocument: linkedDoc
        };

        // Se for personalizado, salvar/atualizar o usuário
        if (formData.isPersonalized) {
            const cleanDoc = (linkedDoc || '').replace(/\D/g, '');
            if (!cleanDoc) throw new Error("Documento é obrigatório.");

            const existingUser = systemUsers.find(u => (u.document || '').replace(/\D/g, '') === cleanDoc);
            const isCurrentDoc = editingPlan && (editingPlan.linkedDocument || '').replace(/\D/g, '') === cleanDoc;
            
            // Bloqueia se o documento já existe e não é o documento atual do plano que está sendo editado
            if (existingUser && !isCurrentDoc && !editingPlan) {
                setFormErrors(prev => ({...prev, document2: 'Este documento já pertence a outro usuário.'}));
                setIsSaving(false);
                return;
            }

            // Recalcular validade
            const newExpiresAt = calculateExpiryDate(Number(formData.days));

            const userData: User = {
                id: existingUser ? existingUser.id : 'user-' + Math.random().toString(36).substr(2, 9),
                tenantId: activeData.tenantId || 'MASTER',
                name: activeData.name || 'CLIENTE PERSONALIZADO',
                email: activeData.email,
                login: activeData.login || activeData.email,
                passwordHash: activeData.password || (existingUser ? existingUser.passwordHash : '123456'),
                role: activeData.role || 'customer',
                active: true,
                document: cleanDoc,
                whatsapp: activeData.whatsapp.replace(/\D/g, ''),
                planName: planNameUpper,
                expiresAt: newExpiresAt,
                createdAt: existingUser ? existingUser.createdAt : new Date().toISOString()
            };

            let updatedUsers: User[];
            if (existingUser) {
                updatedUsers = systemUsers.map(u => u.id === existingUser.id ? userData : u);
            } else {
                updatedUsers = [...systemUsers, userData];
            }
            await saveUsers(updatedUsers);
            setSystemUsers(updatedUsers);

            // Sincronizar com a aba de clientes (CustomerManagement)
            const customers = await getCustomers('MASTER');
            const custIdx = customers.findIndex(c => c.linkedUserId === userData.id || (c.document && c.document.replace(/\D/g, '') === cleanDoc));
            const custData: Customer = {
                id: custIdx !== -1 ? customers[custIdx].id : Math.random().toString(36).substr(2, 9),
                name: userData.name,
                phone: userData.whatsapp || '',
                document: userData.document,
                balance: custIdx !== -1 ? customers[custIdx].balance : 0,
                status: 'active',
                createdAt: custIdx !== -1 ? customers[custIdx].createdAt : new Date().toISOString(),
                linkedUserId: userData.id,
                licenseExpiresAt: userData.expiresAt || '',
                planName: userData.planName
            };
            if (custIdx !== -1) customers[custIdx] = custData; else customers.push(custData);
            await saveCustomers(customers, 'MASTER');
        }

        const currentPlans = await getGlobalPlans();
        const safePlans = Array.isArray(currentPlans) ? currentPlans : [];
        let updatedPlans: Plan[];
        if (editingPlan) {
          updatedPlans = safePlans.map(p => p.id === editingPlan.id ? newPlan : p);
        } else {
          updatedPlans = [...safePlans, newPlan];
        }

        await saveGlobalPlans(updatedPlans);
        setPlans(updatedPlans);
        
        setIsModalOpen(false);
        setEditingPlan(null);
        if (typeof notifyDataChanged === 'function') notifyDataChanged();
        if (typeof refreshPlans === 'function') refreshPlans();
    } catch (err) {
        console.error("Erro ao salvar:", err);
        alert("Erro técnico ao salvar. Verifique os campos.");
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    try {
        const currentPlans = await getGlobalPlans();
        const updated = (Array.isArray(currentPlans) ? currentPlans : []).filter(p => p.id !== confirmDeleteId);
        await saveGlobalPlans(updated);
        setPlans(updated);
        setConfirmDeleteId(null);
    } catch (e) {
        alert("Erro ao excluir.");
    }
  };

  const generalPlansList = plans.filter(p => !p.isPersonalized);
  const filteredPersonalizedPlans = useMemo(() => {
    const list = plans.filter(p => p.isPersonalized);
    if (!searchPersonalized) return list;
    const searchLower = searchPersonalized.toLowerCase();
    return list.filter(plan => 
      getClientNameByDoc(plan.linkedDocument).toLowerCase().includes(searchLower) || 
      plan.linkedDocument?.includes(searchPersonalized)
    );
  }, [plans, searchPersonalized, systemUsers]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">Ofertas e Planos</h3>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">Configure os preços e promoções do seu ecossistema.</p>
        </div>
        <button 
          onClick={() => handleOpenModal(undefined, activeTab === 'general' ? 'global' : 'personalized')}
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
          {activeTab === 'general' ? 'Novo Plano Global' : 'Criar Plano Personalizado'}
        </button>
      </div>

      <div className="flex md:justify-center overflow-x-auto pb-2 px-4 md:px-0">
          <div className="bg-slate-200 dark:bg-slate-800 p-1.5 rounded-full flex shadow-inner whitespace-nowrap">
              <button 
                  onClick={() => setActiveTab('general')} 
                  className={`px-8 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'general' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-600 dark:text-slate-400'}`}
              >
                  Planos Globais
                  <span className="ml-2 bg-slate-100 dark:bg-slate-600 px-2 py-0.5 rounded-full text-[8px] font-bold">{generalPlansList.length}</span>
              </button>
              <button 
                  onClick={() => setActiveTab('personalized')} 
                  className={`px-8 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'personalized' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-600 dark:text-slate-400'}`}
              >
                  Planos Personalizados
                  <span className="ml-2 bg-slate-100 dark:bg-slate-600 px-2 py-0.5 rounded-full text-[8px] font-bold">{plans.filter(p => p.isPersonalized).length}</span>
              </button>
          </div>
      </div>

      {activeTab === 'general' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {generalPlansList.map(plan => (
            <div key={plan.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-lg flex flex-col justify-between hover:border-indigo-500 transition-all relative group overflow-hidden">
               <div className="relative z-10 space-y-4">
                  <div>
                     <h4 className="text-xl font-black uppercase italic text-slate-900 dark:text-white tracking-tighter">{plan.name}</h4>
                     <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">{plan.days} Dias</p>
                  </div>
                  <div className="py-4 border-y border-slate-100 dark:border-slate-800">
                     <span className="text-3xl font-black text-indigo-600 italic tracking-tighter">R$ {plan.price.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed uppercase">{plan.description || 'Nenhuma descrição.'}</p>
               </div>
               <div className="grid grid-cols-2 gap-3 mt-6">
                  <button onClick={() => handleOpenModal(plan)} className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-black uppercase text-[9px] tracking-widest border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors">Editar</button>
                  <button onClick={() => setConfirmDeleteId(plan.id)} className="py-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl font-black uppercase text-[9px] tracking-widest border border-rose-100 dark:border-rose-900/50 hover:bg-rose-100 transition-colors">Excluir</button>
               </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
           <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <svg className="w-5 h-5 text-indigo-600 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={2.5} /></svg>
              <input 
                 value={searchPersonalized}
                 onChange={e => setsearchPersonalized(e.target.value)}
                 placeholder="BUSCAR CLIENTE OU DOCUMENTO..."
                 className="flex-1 bg-transparent border-none outline-none font-black text-[10px] uppercase tracking-widest text-slate-800 dark:text-white"
              />
           </div>

           <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left">
                 <thead className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                       <th className="px-8 py-5 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Cliente</th>
                       <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Plano</th>
                       <th className="px-8 py-5 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Vencimento</th>
                       <th className="px-8 py-5 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Status</th>
                       <th className="px-8 py-5 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Preço Mensal</th>
                       <th className="px-8 py-5 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-right">Ações</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPersonalizedPlans.map(plan => (
                       <tr key={plan.id} className="hover:bg-slate-50/50 transition-all">
                          <td className="px-8 py-4">
                             <p className="text-[11px] font-black text-slate-950 dark:text-white uppercase italic">{getClientNameByDoc(plan.linkedDocument)}</p>
                             <p className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase">{formatDocument(plan.linkedDocument)}</p>
                          </td>
                          <td className="px-8 py-4"><span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">{plan.name}</span></td>
                          <td className="px-8 py-4 text-center">
                             <p className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase italic leading-none">{getExpiryByDoc(plan.linkedDocument)}</p>
                          </td>
                          <td className="px-8 py-4 text-center">
                             {getUserStatusByDoc(plan.linkedDocument) === 'active' ? (
                                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-full text-[8px] font-black uppercase tracking-widest">Ativo</span>
                             ) : (
                                <span className="px-3 py-1 bg-rose-500/10 text-rose-600 rounded-full text-[8px] font-black uppercase tracking-widest">Inativo</span>
                             )}
                          </td>
                          <td className="px-8 py-4 text-center"><span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 italic">R$ {plan.price.toFixed(2)}</span></td>
                          <td className="px-8 py-4 text-right">
                             <div className="flex justify-end gap-2">
                                <button onClick={() => handleOpenModal(plan)} className="p-2 text-slate-600 hover:text-indigo-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2.5}/></svg></button>
                                <button onClick={() => setConfirmDeleteId(plan.id)} className="p-2 text-slate-600 hover:text-rose-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg></button>
                             </div>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {/* MODAL EDIT/NEW */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-6xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[95vh] overflow-y-auto custom-scrollbar">
               <div className="p-8 border-b dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center">
                  <div>
                     <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                       {editingPlan ? (modalType === 'personalized' ? 'Editar Plano Personalizado' : 'Editar Plano Global') : (modalType === 'personalized' ? 'Novo Plano Personalizado' : 'Novo Plano Global')}
                     </h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                        {modalType === 'personalized' ? 'Configuração de Acesso Exclusivo' : 'Configuração de Oferta Padrão'}
                     </p>
                  </div>
                  <button onClick={() => setIsModalOpen(false)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100 dark:border-slate-700 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} /></svg></button>
               </div>
               
               <form onSubmit={handleSave} className="p-10 space-y-8">
                  {/* SEÇÃO DE SELEÇÃO DE TIPO DE PLANO PERSONALIZADO */}
                  {modalType === 'personalized' && (
                    <div className="flex flex-col md:flex-row gap-4">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, personalizedType: 'renewal' })}
                        className={`flex-1 p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center text-center gap-3 ${
                          formData.personalizedType === 'renewal'
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-60'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${formData.personalizedType === 'renewal' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeWidth={2.5}/></svg>
                        </div>
                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-widest italic">Personalizado por Renovação</h4>
                          <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Valor promocional inicial com renovação automática para valor normal</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, personalizedType: 'exclusive' })}
                        className={`flex-1 p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center text-center gap-3 ${
                          formData.personalizedType === 'exclusive'
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-60'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${formData.personalizedType === 'exclusive' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" strokeWidth={2.5}/></svg>
                        </div>
                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-widest italic">Exclusivo por CPF/CNPJ</h4>
                          <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Plano privado vinculado a um documento específico</p>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* CONFIGURAÇÕES DE PREÇO E NOME */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1 md:col-span-2">
                      <label className={`text-[9px] font-black uppercase ml-2 ${formErrors.name ? 'text-rose-600' : 'text-slate-500'}`}>Nome do Plano *</label>
                      <input 
                        required 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} 
                        className={`w-full px-5 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 ${formErrors.name ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'} dark:text-white`} 
                        placeholder="EX: PLANO MENSAL" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase ml-2 text-slate-500">Valor {formData.personalizedType === 'renewal' ? 'Promocional' : 'Mensal'} (R$)</label>
                      <input 
                        required 
                        type="number" 
                        step="0.01" 
                        value={formData.price === 0 ? '' : formData.price} 
                        onChange={e => setFormData({...formData, price: Number(e.target.value)})} 
                        className="w-full px-5 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" 
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className={`text-[9px] font-black uppercase ml-2 ${formErrors.days ? 'text-rose-600' : 'text-slate-500'}`}>Quantidade de Dias *</label>
                      <input 
                        required 
                        type="number"
                        value={formData.days} 
                        onChange={e => setFormData({...formData, days: Number(e.target.value)})} 
                        className={`w-full px-5 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 ${formErrors.days ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'} dark:text-white`} 
                        placeholder="30" 
                      />
                    </div>
                    {formData.isPersonalized && formData.personalizedType === 'renewal' && (
                      <div className="space-y-1">
                        <label className={`text-[9px] font-black uppercase ml-2 ${formErrors.renewalPrice ? 'text-rose-600' : 'text-slate-500'}`}>Valor de Renovação (R$) *</label>
                        <input 
                          required 
                          type="number" 
                          step="0.01" 
                          value={formData.renewalPrice === 0 ? '' : formData.renewalPrice} 
                          onChange={e => setFormData({...formData, renewalPrice: Number(e.target.value)})} 
                          className={`w-full px-5 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs uppercase outline-none focus:ring-2 ${formErrors.renewalPrice ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'} dark:text-white`} 
                          placeholder="0.00"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                     <label className="text-[9px] font-black uppercase ml-2 text-slate-500">Descrição do Plano (Opcional)</label>
                     <textarea 
                        value={formData.description} 
                        onChange={e => setFormData({...formData, description: e.target.value})} 
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" 
                        rows={3}
                        placeholder="Descreva os benefícios deste plano..."
                     />
                  </div>

                  {modalType === 'personalized' && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-8 rounded-[2.5rem] border border-emerald-100 dark:border-emerald-900/30 space-y-8">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100 dark:border-emerald-900/30">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeWidth={2.5}/></svg>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 italic">Dados do Cliente</h4>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Informações para faturamento e controle de acesso</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase ml-2 text-slate-500">Nome Completo</label>
                          <input 
                            value={section2Data.name} 
                            onChange={e => setSection2Data({...section2Data, name: e.target.value.toUpperCase()})} 
                            className="w-full px-6 py-5 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 rounded-2xl font-bold text-sm uppercase outline-none transition-all dark:text-white" 
                            placeholder="NOME DO CLIENTE"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase ml-2 text-slate-500">ID Empresa / Tenant</label>
                          <input 
                            value={section2Data.tenantId} 
                            onChange={e => setSection2Data({...section2Data, tenantId: e.target.value.toUpperCase()})} 
                            className="w-full px-6 py-5 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 rounded-2xl font-bold text-sm uppercase outline-none transition-all dark:text-white" 
                            placeholder="MASTER"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={`text-[9px] font-black uppercase ml-2 ${formErrors.document2 ? 'text-rose-600' : 'text-slate-500'}`}>CPF ou CNPJ *</label>
                          <input 
                            value={section2Data.linkedDocument} 
                            onChange={e => {
                              const val = formatDocument(e.target.value);
                              setSection2Data({...section2Data, linkedDocument: val});
                              verifyDocument(val, 'section2');
                            }} 
                            className={`w-full px-6 py-5 bg-white dark:bg-slate-800 border-2 ${formErrors.document2 ? 'border-rose-500 bg-rose-50/30' : 'border-transparent focus:border-emerald-500'} rounded-2xl font-bold text-sm uppercase outline-none transition-all dark:text-white`} 
                            placeholder="000.000.000-00"
                          />
                          {docError2 && <p className="text-[8px] font-black text-amber-500 uppercase ml-2 mt-1">ℹ️ {docError2}</p>}
                          {formErrors.document2 && <p className="text-[8px] font-black text-rose-500 uppercase ml-2 mt-1">⚠️ {formErrors.document2}</p>}
                        </div>
                        <div className="space-y-1">
                          <label className={`text-[9px] font-black uppercase ml-2 ${formErrors.whatsapp2 ? 'text-rose-600' : 'text-slate-500'}`}>WhatsApp *</label>
                          <input 
                            value={section2Data.whatsapp} 
                            onChange={e => setSection2Data({...section2Data, whatsapp: formatWhatsApp(e.target.value)})} 
                            className={`w-full px-6 py-5 bg-white dark:bg-slate-800 border-2 ${formErrors.whatsapp2 ? 'border-rose-500 bg-rose-50/30' : 'border-transparent focus:border-emerald-500'} rounded-2xl font-bold text-sm uppercase outline-none transition-all dark:text-white`} 
                            placeholder="(00) 00000-0000"
                          />
                          {formErrors.whatsapp2 && <p className="text-[8px] font-black text-rose-500 uppercase ml-2 mt-1">⚠️ {formErrors.whatsapp2}</p>}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase ml-2 text-slate-500">Tipo de Conta</label>
                          <select 
                            value={section2Data.role} 
                            onChange={e => setSection2Data({...section2Data, role: e.target.value as User['role']})} 
                            className="w-full px-6 py-5 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 rounded-2xl font-bold text-sm uppercase outline-none transition-all dark:text-white appearance-none"
                          >
                            <option value="customer">Cliente Pagante</option>
                            <option value="demo">Conta DM</option>
                            <option value="admin">Administrador</option>
                            <option value="affiliate">Conta Afiliado</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className={`text-[9px] font-black uppercase ml-2 ${formErrors.login2 ? 'text-rose-600' : 'text-slate-500'}`}>Usuário (Login) *</label>
                          <input 
                            value={section2Data.login} 
                            onChange={e => setSection2Data({...section2Data, login: e.target.value.toLowerCase()})} 
                            className={`w-full px-6 py-5 bg-white dark:bg-slate-800 border-2 ${formErrors.login2 ? 'border-rose-500 bg-rose-50/30' : 'border-transparent focus:border-emerald-500'} rounded-2xl font-bold text-sm outline-none transition-all dark:text-white`} 
                            placeholder="usuario123"
                          />
                          {formErrors.login2 && <p className="text-[8px] font-black text-rose-500 uppercase ml-2 mt-1">⚠️ {formErrors.login2}</p>}
                        </div>
                        <div className="space-y-1">
                          <label className={`text-[9px] font-black uppercase ml-2 ${formErrors.email2 ? 'text-rose-600' : 'text-slate-500'}`}>E-mail *</label>
                          <input 
                            value={section2Data.email} 
                            onChange={e => setSection2Data({...section2Data, email: e.target.value.toLowerCase()})} 
                            className={`w-full px-6 py-5 bg-white dark:bg-slate-800 border-2 ${formErrors.email2 ? 'border-rose-500 bg-rose-50/30' : 'border-transparent focus:border-emerald-500'} rounded-2xl font-bold text-sm outline-none transition-all dark:text-white`} 
                            placeholder="usuario@email.com"
                          />
                          {formErrors.email2 && <p className="text-[8px] font-black text-rose-500 uppercase ml-2 mt-1">⚠️ {formErrors.email2}</p>}
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase ml-2 text-slate-500">Senha</label>
                          <input 
                            type="text"
                            value={section2Data.password} 
                            onChange={e => setSection2Data({...section2Data, password: e.target.value})} 
                            className="w-full px-6 py-5 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 rounded-2xl font-bold text-sm outline-none transition-all dark:text-white" 
                            placeholder="SENHA DE ACESSO"
                          />
                        </div>
                      </div>
                    </div>
                  )}



                  {/* BOTÕES DE AÇÃO */}
                  <div className="flex gap-4 pt-4 border-t dark:border-white/5">
                    <button 
                      type="button" 
                      onClick={() => setIsModalOpen(false)} 
                      className="flex-1 px-8 py-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black uppercase text-xs rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSaving}
                      className="flex-[2] px-8 py-5 bg-indigo-600 text-white font-black uppercase text-xs rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? 'Salvando...' : editingPlan ? 'Salvar Alterações' : 'Criar Novo Plano'}
                    </button>
                  </div>
               </form>
            </div>
        </div>
      )}

      {/* CONFIRM DELETE */}
      {confirmDeleteId && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-in fade-in duration-200">
             <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[2rem] p-6 shadow-2xl border border-white/10">
                <h3 className="text-lg font-black text-slate-950 dark:text-white uppercase italic tracking-tighter mb-1">Excluir Plano?</h3>
                <p className="text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase mb-6 leading-relaxed">Deseja remover esta oferta permanentemente?</p>
                <div className="grid grid-cols-2 gap-3">
                   <button onClick={() => setConfirmDeleteId(null)} className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl font-black text-[9px] uppercase tracking-widest border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors">Voltar</button>
                   <button onClick={handleDelete} className="py-3 bg-rose-600 text-white font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">Confirmar</button>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default PlanManagement;