import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, AccessRequest, Plan, View, AppSettings } from '../types';
import { 
  getUsers, saveUsers, getAccessRequests, 
  getGlobalPlans, saveGlobalPlans, getCustomers, saveCustomers, exportTenantBackup,
  removeAccessRequest, notifyDataChanged, validateUniqueness,
  getGlobalEstablishmentCategories, saveGlobalEstablishmentCategories,
  getAppSettings
} from '../services/storage';
import { formatDisplayDate, isExpired, isWithinGracePeriod, calculateExpiryDate } from '../utils/dateUtils';

// --- HELPERS DE FORMATAÇÃO E VALIDAÇÃO ---

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

const formatWhatsApp = (val: string) => {
  const v = val.replace(/\D/g, '').slice(0, 11);
  if (v.length <= 2) return v;
  if (v.length <= 7) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
};

const isValidCPF = (cpf: string) => {
  const strCPF = cpf.replace(/\D/g, '');
  if (strCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(strCPF)) return false;

  let soma = 0;
  let resto;
  for (let i = 1; i <= 9; i++) soma = soma + parseInt(strCPF.substring(i - 1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  if ((resto === 10) || (resto === 11)) resto = 0;
  if (resto !== parseInt(strCPF.substring(9, 10))) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) soma = soma + parseInt(strCPF.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if ((resto === 10) || (resto === 11)) resto = 0;
  if (resto !== parseInt(strCPF.substring(10, 11))) return false;

  return true;
};

const validateEmail = (email: string) => {
  if (email.includes('@')) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
  // Simple username: allow alphanumeric, dots, underscores, hyphens
  return email.trim().length > 0 && /^[a-zA-Z0-9._-]+$/.test(email);
};

export default function UserManagement() {
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('p4zz_session_user') || '{}'), []);
  const isMaster = currentUser?.tenantId === 'MASTER' && currentUser?.role === 'admin';
  const isDemoViewer = currentUser?.isDemoViewer;

  const [users, setUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'expired-demos'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [globalCategories, setGlobalCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<{ old: string; new: string } | null>(null);
  
  const [affiliateSearch, setAffiliateSearch] = useState('');
  const [showAffiliateDropdown, setShowAffiliateDropdown] = useState(false);
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [plans, setPlans] = useState<Plan[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    establishmentName: '',
    category: '',
    document: '',
    whatsapp: '',
    whatsappConfirmed: false,
    email: '',
    login: '',
    passwordHash: '',
    role: 'customer' as User['role'],
    planName: '',
    expiresAt: '',
    active: true,
    originIp: '',
    originLocation: '',
    createdManually: false,
    gracePeriod: 10,
    isAffiliate: false,
    canAccessTables: true,
    affiliateId: '',
    showPersonalizedPlans: false
  });

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info' | 'success';
    action: () => void;
  } | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const [allUsers, allRequests, allPlans, allGlobalCats, masterSetts] = await Promise.all([
        getUsers(),
        getAccessRequests(),
        getGlobalPlans(),
        getGlobalEstablishmentCategories(),
        getAppSettings('MASTER')
      ]);
      setUsers(allUsers);
      setRequests(allRequests);
      setPlans(allPlans);
      setGlobalCategories(allGlobalCats);
      setSettings(masterSetts);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleInputChange = (field: string, value: any) => {
    const updated = { ...formData, [field]: value };
    
    if (field === 'role') {
        if (value === 'demo') {
            updated.planName = '';
            updated.expiresAt = ''; 
        } else if (value === 'customer') {
            updated.planName = ''; 
            updated.expiresAt = ''; 
        }
    }
    
    if (field === 'showPersonalizedPlans') {
        updated.planName = '';
    }

    if (field === 'planName' && (formData.role === 'customer' || formData.role === 'demo' || formData.role === 'admin')) {
        const selectedPlan = plans.find(p => p.name === value);
        if (selectedPlan) {
            updated.expiresAt = calculateExpiryDate(selectedPlan.days);
        }
    }

    setFormData(updated);
    
    if (formErrors[field]) {
        const newErrors = { ...formErrors };
        delete newErrors[field];
        setFormErrors(newErrors);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const allUsers = await getUsers();
    const errors: Record<string, string> = {};
    
    const loginClean = formData.login.trim().toLowerCase();
    const emailClean = formData.email.trim().toLowerCase();
    const docClean = formData.document.replace(/\D/g, '');

    // Validações Básicas
    if (!formData.name.trim()) errors.name = 'Obrigatório';
    if (!formData.establishmentName.trim()) errors.establishmentName = 'Obrigatório';
    if (!loginClean) errors.login = 'Obrigatório';
    if (!emailClean) errors.email = 'Obrigatório';
    if (!validateEmail(emailClean)) errors.email = 'E-mail inválido';
    if (!formData.passwordHash) errors.passwordHash = 'Obrigatório';
    if (!formData.whatsappConfirmed) errors.whatsappConfirmed = 'Confirme o WhatsApp';
    
    if (docClean.length === 11 && !isValidCPF(formData.document)) {
        errors.document = 'CPF inválido';
    }

    if (formData.role === 'customer') {
        if (!formData.planName) errors.planName = 'Selecione um plano';
    } else if (formData.role === 'demo') {
        if (!formData.expiresAt) errors.expiresAt = 'Data obrigatória para Demo';
    }

    // --- TRAVAS DE UNICIDADE ---
    const uniqueness = await validateUniqueness(formData.name, formData.document, editingUser?.id);
    if (!uniqueness.valid) {
        if (uniqueness.message?.includes("nome")) errors.name = uniqueness.message;
        else errors.document = uniqueness.message || "Erro de validação";
    }

    const existingByLogin = allUsers.find(u => (u.login || u.email).toLowerCase() === loginClean && u.id !== editingUser?.id);
    if (existingByLogin) errors.login = 'Este login já está em uso.';

    const existingByEmail = allUsers.find(u => u.email.toLowerCase() === emailClean && u.id !== editingUser?.id);
    if (existingByEmail) errors.email = 'Este e-mail já está em uso.';

    if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
    }

    const newUser: User = {
      id: editingUser ? editingUser.id : 'user-' + Math.random().toString(36).substr(2, 9),
      name: formData.name.toUpperCase(),
      tenantId: formData.establishmentName.toUpperCase(),
      email: emailClean,
      login: loginClean,
      passwordHash: formData.passwordHash,
      role: formData.role,
      active: formData.active,
      document: docClean,
      whatsapp: formData.whatsapp.replace(/\D/g, ''),
      planName: (formData.role === 'customer' || formData.role === 'demo' || formData.role === 'admin') ? formData.planName : undefined,
      expiresAt: (formData.role === 'customer' || formData.role === 'demo' || formData.role === 'admin') ? formData.expiresAt : undefined,
      createdAt: editingUser?.createdAt || new Date().toISOString(),
      category: formData.category,
      permissions: formData.role === 'affiliate' ? ['affiliates'] : (editingUser?.permissions || ['dashboard', 'new-sale', 'tables', 'deliveries', 'products', 'categories', 'expenses', 'sales-history', 'reports']),
      originIp: editingUser?.originIp || formData.originIp,
      originLocation: editingUser?.originLocation || formData.originLocation,
      createdManually: editingUser ? editingUser.createdManually : true,
      gracePeriod: (formData.role === 'customer' || formData.role === 'demo') ? Number(formData.gracePeriod) : undefined,
      isAffiliate: formData.role === 'affiliate' ? true : formData.isAffiliate,
      canAccessTables: formData.canAccessTables,
      affiliateId: formData.affiliateId || undefined
    };

    let updated;
    if (editingUser) updated = allUsers.map(u => u.id === editingUser.id ? newUser : u);
    else updated = [...allUsers, newUser];
    
    await saveUsers(updated);
    
    // Sincronizar com Planos Personalizados
    if (newUser.document) {
        const currentPlans = await getGlobalPlans();
        const cleanDoc = newUser.document.replace(/\D/g, '');
        const planIdx = currentPlans.findIndex(p => p.isPersonalized && (p.linkedDocument || '').replace(/\D/g, '') === cleanDoc);
        
        if (planIdx !== -1) {
            currentPlans[planIdx] = {
                ...currentPlans[planIdx],
                name: newUser.planName || currentPlans[planIdx].name,
                linkedDocument: cleanDoc
            };
            await saveGlobalPlans(currentPlans);
        }
    }

    if (newUser.role === 'customer' || newUser.role === 'demo' || newUser.role === 'admin') {
      const customers = await getCustomers('MASTER');
      const idx = customers.findIndex(c => c.linkedUserId === newUser.id);
      const custData = {
        id: idx !== -1 ? customers[idx].id : Math.random().toString(36).substr(2, 6),
        name: newUser.name, 
        phone: newUser.whatsapp || '', 
        document: newUser.document,
        balance: idx !== -1 ? customers[idx].balance : 0, 
        status: 'active' as any,
        createdAt: idx !== -1 ? customers[idx].createdAt : new Date().toISOString(),
        linkedUserId: newUser.id, 
        licenseExpiresAt: newUser.expiresAt || '',
        planName: newUser.planName
      };
      if (idx !== -1) customers[idx] = custData as any; else customers.push(custData as any);
      await saveCustomers(customers, 'MASTER');
    }

    setIsModalOpen(false);
    refreshData();
    notifyDataChanged();
  };

  const handleOpenModal = (user?: User) => {
    setFormErrors({});
    if (user) {
      setEditingUser(user);
      setAffiliateSearch(user.affiliateId ? users.find(u => u.id === user.affiliateId)?.name.toUpperCase() || '' : '');
      setFormData({
        name: user.name,
        establishmentName: user.tenantId,
        category: user.category || '',
        document: formatDocument(user.document || ''),
        whatsapp: formatWhatsApp(user.whatsapp || ''),
        whatsappConfirmed: true,
        email: user.email,
        login: user.login || user.email,
        passwordHash: user.passwordHash,
        role: user.role,
        planName: user.planName || '',
        expiresAt: user.expiresAt || '',
        active: user.active,
        originIp: user.originIp || '',
        originLocation: user.originLocation || '',
        createdManually: user.createdManually || false,
        gracePeriod: user.gracePeriod ?? 10,
        isAffiliate: user.isAffiliate || false,
        canAccessTables: user.canAccessTables !== false,
        affiliateId: user.affiliateId || '',
        showPersonalizedPlans: user.planName ? plans.find(p => p.name === user.planName)?.isPersonalized || false : false
      });
    } else {
      setEditingUser(null);
      setAffiliateSearch('');
      setFormData({
        name: '', establishmentName: '', category: '', document: '', whatsapp: '', whatsappConfirmed: false,
        email: '', passwordHash: '', role: 'customer', 
        planName: '', 
        expiresAt: '', active: true,
        originIp: '', originLocation: '', createdManually: true,
        gracePeriod: 10,
        isAffiliate: false,
        canAccessTables: true,
        affiliateId: '',
        showPersonalizedPlans: false
      });
    }
    setIsModalOpen(true);
  };

  const executeApprove = async (req: AccessRequest) => {
    const allUsers = await getUsers();
    
    // Verifica duplicidade antes de aprovar
    const docClean = req.document.replace(/\D/g, '');
    const loginClean = req.login.trim().toLowerCase();
    
    if (allUsers.some(u => (u.document || '').replace(/\D/g, '') === docClean)) {
        alert("ERRO: Este documento já possui um cadastro ativo no sistema.");
        return;
    }
    if (allUsers.some(u => (u.login || u.email).toLowerCase() === loginClean)) {
        alert("ERRO: Este login já está em uso por outro terminal.");
        return;
    }
    if (allUsers.some(u => u.email.toLowerCase() === req.email.toLowerCase())) {
        alert("ERRO: Este e-mail já está em uso.");
        return;
    }

    let userRole: User['role'] = 'customer';
    let daysToRenew = 30;
    let expiryDate = '';
    let permissions: View[] = ['dashboard', 'new-sale', 'tables', 'deliveries', 'products', 'categories', 'fiados', 'sales-history', 'reports'];
    
    if (req.plan?.toUpperCase().includes('DEMO')) {
      userRole = 'demo';
      // 72 horas exatas (3 dias)
      expiryDate = calculateExpiryDate(3);
    } else if (req.plan === 'CONTA AFILIADO') {
      userRole = 'affiliate';
      permissions = ['affiliates', 'support'];
      expiryDate = calculateExpiryDate(365); // 1 ano para afiliados
    } else {
      const selectedPlan = plans.find(p => p.name === req.plan);
      daysToRenew = selectedPlan ? selectedPlan.days : 30;
      expiryDate = calculateExpiryDate(daysToRenew);
    }

    const newUser: User = {
      id: 'user-' + Math.random().toString(36).substr(2, 9),
      name: (req.name || 'SOLICITANTE').toUpperCase(),
      tenantId: (req.name || 'EMPRESA').toUpperCase(),
      email: req.email.toLowerCase(),
      login: loginClean,
      passwordHash: req.passwordHash,
      role: userRole,
      active: true,
      document: docClean,
      whatsapp: req.whatsapp.replace(/\D/g, ''),
      planName: req.plan || '',
      expiresAt: expiryDate,
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      category: req.category || '',
      permissions,
      originIp: req.originIp,
      originLocation: req.originLocation,
      createdManually: false,
      gracePeriod: 10,
      isAffiliate: userRole === 'affiliate'
    };
    await saveUsers([...allUsers, newUser]);
    
    const customers = await getCustomers('MASTER');
    customers.push({
        id: Math.random().toString(36).substr(2, 6),
        name: newUser.name,
        phone: newUser.whatsapp || '',
        document: newUser.document,
        balance: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
        linkedUserId: newUser.id,
        licenseExpiresAt: newUser.expiresAt,
        planName: newUser.planName
    } as any);
    await saveCustomers(customers, 'MASTER');

    await removeAccessRequest(req.id);
    refreshData();
    notifyDataChanged();
  };

  const handleApproveConfirmation = (req: AccessRequest) => {
    setConfirmModal({
      show: true,
      title: 'Aprovar Solicitação?',
      message: `Deseja liberar o acesso para ${req.name}?`,
      type: 'success',
      action: async () => {
        await executeApprove(req);
        setConfirmModal(null);
      }
    });
  };

  const handleRejectConfirmation = (req: AccessRequest) => {
    setConfirmModal({
        show: true,
        title: 'Rejeitar Solicitação?',
        message: `Tem certeza que deseja recusar o pedido de ${req.name}?`,
        type: 'danger',
        action: async () => {
            await removeAccessRequest(req.id);
            refreshData();
            notifyDataChanged();
            setConfirmModal(null);
        }
    });
  };

  const handleUserAction = (type: 'suspend' | 'ban' | 'activate' | 'delete' | 'config', user: User) => {
    if (type === 'config') { exportTenantBackup(user.tenantId); return; }
    
    const isTargetMaster = user.tenantId === 'MASTER' && user.role === 'admin';
    if (isTargetMaster && (type === 'suspend' || type === 'ban' || type === 'delete')) {
        alert("O Administrador Master possui acesso vitalício e não pode ser bloqueado.");
        return;
    }

    const titles = { suspend: 'Suspender Acesso?', ban: 'Banir Usuário?', activate: 'Liberar Acesso?', delete: 'Excluir Permanentemente?' };
    const messages = { suspend: `Deseja interromper temporariamente o acesso de ${user.name}?`, ban: `BLOQUEIO PERMANENTE: ${user.name} não poderá mais acessar o sistema.`, activate: `Restabelecer todas as permissões de ${user.name} agora?`, delete: `ATENÇÃO: Todos os dados vinculados a ${user.name} serão perdidos.` };
    
    setConfirmModal({
      show: true,
      title: titles[type],
      message: messages[type],
      type: type === 'activate' ? 'success' : 'danger',
      action: async () => {
        const allUsers = await getUsers();
        let updated;
        if (type === 'delete') updated = allUsers.filter(u => u.id !== user.id);
        else updated = allUsers.map(u => {
            if (u.id === user.id) {
              if (type === 'suspend') return { ...u, active: false, deactivatedMessage: 'SUSPENSO: Acesso interrompido pelo administrador.' };
              if (type === 'ban') return { ...u, active: false, deactivatedMessage: 'BANIDO: Acesso bloqueado permanentemente.' };
              if (type === 'activate') return { ...u, active: true, deactivatedMessage: '' };
            }
            return u;
        });
        await saveUsers(updated);
        setConfirmModal(null);
        refreshData();
        notifyDataChanged();
      }
    });
  };

  const filteredUsersList = users.filter(u => {
    if (!u) return false;
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || (u.document && u.document.includes(searchTerm));
    const isSystemAccount = !u.affiliateId || u.isAffiliate || u.role === 'admin';
    return u.role !== 'employee' && matchesSearch && isSystemAccount;
  });
  
  const pendingRequests = requests.filter(r => r && r.status === 'pending' && !r.affiliateId);

  const expiredDemosList = users.filter(u => {
    if (u.role !== 'demo' || !u.expiresAt) return false;
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || (u.document && u.document.includes(searchTerm));
    return isExpired(u.expiresAt) && matchesSearch;
  });

  const getStatusInfo = (user: User) => {
    const deactMsg = (user.deactivatedMessage || '').toUpperCase();
    if (!user.active && deactMsg.includes('BANIDO')) return { label: 'Banido', color: 'bg-rose-600 text-white', status: 'banned' };
    if (!user.active && deactMsg.includes('DEMO_EXPIRADA')) return { label: 'Demo Expirada', color: 'bg-slate-700 text-white', status: 'expired' };
    if (!user.active) return { label: 'Suspenso', color: 'bg-amber-400 text-slate-900', status: 'suspended' };
    
    if (user.expiresAt) {
        const grace = user.role === 'demo' ? 0 : (user.gracePeriod || 0);
        
        if (isExpired(user.expiresAt, grace)) {
            return { label: user.role === 'demo' ? 'Demo Expirada' : 'Vencido', color: 'bg-rose-600 text-white', status: 'expired' };
        }
        
        if (isWithinGracePeriod(user.expiresAt, grace)) {
            return { label: 'Em Carência', color: 'bg-orange-50 text-white', status: 'active' };
        }
    }
    
    if (user.role === 'admin') return { label: 'Admin', color: 'bg-indigo-600 text-white', status: 'active' };
    if (user.role === 'demo') return { label: 'Demo Ativa', color: 'bg-indigo-500 text-white', status: 'active' };
    return { label: 'Ativo', color: 'bg-emerald-500 text-white', status: 'active' };
  };

  const getTabClass = (tabId: typeof activeTab) => {
    const isActive = activeTab === tabId;
    return `px-6 md:px-10 py-3.5 md:py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all duration-300 active:scale-95 ${
      isActive 
        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' 
        : 'text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-white/40 dark:hover:bg-slate-700/40'
    }`;
  };

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="flex justify-center no-print scrollbar-hide">
        <div className="bg-slate-200/60 dark:bg-slate-800/60 p-1.5 rounded-full flex shadow-inner whitespace-nowrap overflow-x-auto border border-slate-300/30 dark:border-slate-700/30">
          <button onClick={() => setActiveTab('users')} className={getTabClass('users')}>Usuários</button>
          <button onClick={() => setActiveTab('requests')} className={`${getTabClass('requests')} flex items-center gap-2`}>
            Solicitações
            {pendingRequests.length > 0 && <span className="bg-rose-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[7px] animate-pulse">{pendingRequests.length}</span>}
          </button>
          <button onClick={() => setActiveTab('expired-demos')} className={`${getTabClass('expired-demos')} flex items-center gap-2`}>
            Demos
            {expiredDemosList.length > 0 && <span className="bg-rose-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[7px]">{expiredDemosList.length}</span>}
          </button>
        </div>
      </div>

      <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="relative flex-1 w-full md:w-auto">
                  <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="PESQUISAR..." className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-black text-[10px] uppercase outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner" />
                  <svg className="w-5 h-5 text-slate-300 absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={3}/></svg>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                  <button 
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-90 shadow-sm border border-slate-200 dark:border-slate-700"
                    title="Gerenciar Categorias"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth={2}/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth={2}/></svg>
                  </button>
                  <button onClick={() => handleOpenModal()} className="flex-1 md:flex-none bg-slate-950 dark:bg-white dark:text-slate-950 text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-105 transition-all">+ Novo Cadastro</button>
              </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
            {activeTab === 'users' ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[950px]">
                        <thead className="bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800">
                            <tr>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest">Identificação</th>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Tipo / Plano</th>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Vencimento</th>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredUsersList.map(u => {
                                const info = getStatusInfo(u);
                                const userPlan = plans.find(p => p.name === u.planName);
                                const isSelf = u.id === currentUser.id;
                                const isTargetMaster = u.tenantId === 'MASTER' && u.role === 'admin';

                                return (
                                    <tr key={u.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                                        <td className="px-10 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xs shadow-inner ${u.active ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>{u.name.substring(0, 2).toUpperCase()}</div>
                                                <div className="flex flex-col">
                                                    <p className="font-black text-xs uppercase text-slate-900 dark:text-white italic leading-none">{u.name} {isSelf && <span className="text-[7px] bg-slate-900 text-white px-1.5 py-0.5 rounded ml-1 tracking-widest">VOCÊ</span>}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{formatDocument(u.document) || 'SEM DOCUMENTO'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <span className={`inline-block px-3 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest mb-1 ${u.role === 'admin' ? 'bg-indigo-100 text-indigo-600' : (u.role === 'demo' ? 'bg-indigo-50 text-indigo-700' : (u.role === 'affiliate' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'))}`}>{u.role === 'admin' ? 'ADMINISTRADOR' : (u.role === 'demo' ? 'CONTA DEMO' : (u.role === 'affiliate' ? 'AFILIADO' : u.role))}</span>
                                            <p className="text-[9px] font-black text-slate-800 dark:text-slate-200 uppercase">{u.planName || (u.role === 'admin' ? 'ACESSO TOTAL' : 'PERSONALIZADO')}</p>
                                            {userPlan && <p className="text-[8px] font-black text-emerald-500 uppercase italic">R$ {userPlan.price.toFixed(2)}</p>}
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <p className={`text-[10px] font-black uppercase italic ${u.expiresAt ? (getStatusInfo(u).status === 'expired' ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200') : 'text-slate-400'}`}>
                                                {formatDisplayDate(u.expiresAt)}
                                            </p>
                                            {u.expiresAt && u.gracePeriod && u.gracePeriod > 0 && u.role !== 'demo' && (
                                                <p className="text-[7px] font-bold text-slate-400 uppercase mt-0.5">+{u.gracePeriod}D CARÊNCIA</p>
                                            )}
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <span className={`inline-block w-28 py-2 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm ${info.color}`}>{info.label}</span>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <div className="flex justify-end gap-1.5">
                                                {!u.active ? (
                                                  <button 
                                                    onClick={() => handleUserAction('activate', u)} 
                                                    className={`px-4 py-2 bg-emerald-500 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-md hover:brightness-110 active:scale-95 transition-all`}
                                                  >
                                                    Liberar Acesso
                                                  </button>
                                                ) : (
                                                  <>
                                                    {!isTargetMaster && (
                                                      <>
                                                        <button 
                                                          onClick={() => handleUserAction('suspend', u)} 
                                                          className={`p-3.5 md:p-2.5 text-amber-500 bg-amber-50 rounded-xl shadow-sm active:scale-90`}
                                                        >
                                                          <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2.5}/></svg>
                                                        </button>
                                                        <button 
                                                          onClick={() => handleUserAction('ban', u)} 
                                                          className={`p-3.5 md:p-2.5 text-rose-500 bg-rose-50 rounded-xl shadow-sm active:scale-90`}
                                                        >
                                                          <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth={2.5}/></svg>
                                                        </button>
                                                      </>
                                                    )}
                                                  </>
                                                )}
                                                <button 
                                                  onClick={() => handleUserAction('config', u)} 
                                                  className={`p-3.5 md:p-2.5 text-indigo-500 bg-indigo-50 rounded-xl shadow-sm active:scale-90`}
                                                >
                                                  <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4-4m4 4V4" strokeWidth={2.5}/></svg>
                                                </button>
                                                <button 
                                                  onClick={() => handleOpenModal(u)} 
                                                  className={`p-3.5 md:p-2.5 text-slate-400 bg-slate-50 rounded-xl shadow-sm active:scale-90`}
                                                >
                                                  <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2.5}/></svg>
                                                </button>
                                                {!isTargetMaster && (
                                                  <button 
                                                    onClick={() => handleUserAction('delete', u)} 
                                                    className={`p-3.5 md:p-2.5 text-rose-300 bg-slate-50 rounded-xl shadow-sm hover:text-rose-600 active:scale-90`}
                                                  >
                                                    <svg className="w-5 h-5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2-0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg>
                                                  </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : activeTab === 'requests' ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[800px]">
                      <thead className="bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800">
                        <tr>
                          <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest">Solicitante</th>
                          <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Contato</th>
                          <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Plano Desejado</th>
                          <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {pendingRequests.map(req => (
                          <tr key={req.id} className="hover:bg-slate-50/50 transition-all">
                            <td className="px-10 py-6">
                               <p className="font-black text-xs uppercase text-slate-900 dark:text-white leading-none">{req.name || req.login || 'NOME NÃO INFORMADO'}</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{formatDocument(req.document)}</p>
                            </td>
                            <td className="px-10 py-6 text-center">
                               <p className="text-[10px] font-black text-indigo-500 uppercase">{formatWhatsApp(req.whatsapp)}</p>
                               <p className="text-[8px] text-slate-400 font-bold uppercase">{req.login}</p>
                            </td>
                            <td className="px-10 py-6 text-center">
                               <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 px-3 py-1 rounded-lg text-[8px] font-black uppercase">{req.plan || 'NÃO INFORMADO'}</span>
                            </td>
                            <td className="px-10 py-6 text-right">
                               <div className="flex justify-end gap-2">
                                  <button onClick={() => handleRejectConfirmation(req)} className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-[8px] font-black uppercase hover:bg-rose-100 transition-colors">Rejeitar</button>
                                  <button onClick={() => handleApproveConfirmation(req)} className="bg-emerald-500 text-white px-6 py-2 rounded-xl text-[8px] font-black uppercase shadow-md hover:brightness-110 transition-all">Aprovar</button>
                               </div>
                            </td>
                          </tr>
                        ))}
                        {pendingRequests.length === 0 && (
                          <tr><td colSpan={4} className="py-24 text-center opacity-30 font-black uppercase text-[10px] italic">Sem solicitações pendentes</td></tr>
                        )}
                      </tbody>
                    </table>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[950px]">
                        <thead className="bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800">
                            <tr>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest">Identificação</th>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Vencimento Original</th>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {expiredDemosList.length === 0 ? (
                                <tr><td colSpan={4} className="py-24 text-center opacity-30 font-black uppercase text-[10px] italic">Nenhuma demo vencida localizada</td></tr>
                            ) : (
                                expiredDemosList.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-50/50 transition-all">
                                        <td className="px-10 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black text-xs shadow-inner">EX</div>
                                                <div className="flex flex-col">
                                                    <p className="font-black text-xs uppercase text-slate-900 dark:text-white italic leading-none">{u.name}</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{formatDocument(u.document) || 'SEM DOCUMENTO'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <p className="text-[10px] font-black text-rose-600 uppercase italic">
                                                {u.expiresAt ? formatDisplayDate(u.expiresAt) : '---'}
                                            </p>
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <span className="inline-block w-28 py-2 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm bg-slate-700 text-white">EXPIRADA</span>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <div className="flex justify-end gap-1.5">
                                                <button onClick={() => handleOpenModal(u)} className="p-2.5 text-slate-400 bg-slate-50 rounded-xl shadow-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2.5}/></svg></button>
                                                <button onClick={() => handleUserAction('delete', u)} className="p-2.5 text-rose-300 bg-slate-50 rounded-xl shadow-sm hover:text-rose-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
          </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[200] p-2 md:p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[95vh] overflow-y-auto custom-scrollbar">
              <div className="p-6 md:p-8 border-b dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center">
                 <div>
                    <h3 className="text-lg md:text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">{editingUser ? 'Ficha do Usuário' : 'Novo Usuário'}</h3>
                    <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mt-1">Configuração de Acesso</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="p-3 md:p-2.5 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-90"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} /></svg></button>
              </div>

              <form onSubmit={handleSave} className="p-6 md:p-10 space-y-6 md:space-y-8">
                 <div className="space-y-6">
                    <div className="space-y-1">
                        <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.name ? 'text-rose-600' : 'text-slate-400'}`}>Nome Completo *</label>
                        <input placeholder="Digite o nome completo" value={formData.name} onChange={e => handleInputChange('name', e.target.value.toUpperCase())} className={`w-full px-6 py-5 border-2 rounded-2xl font-bold text-sm outline-none transition-all ${formErrors.name ? 'border-rose-500 bg-rose-50/30' : 'bg-slate-50 dark:bg-slate-800 dark:text-white border-transparent focus:border-indigo-500'}`} />
                    </div>
                    <div className="space-y-1">
                        <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.establishmentName ? 'text-rose-600' : 'text-slate-400'}`}>ID Empresa / Tenant *</label>
                        <input 
                           placeholder="Digite o nome do estabelecimento"
                           disabled={editingUser?.tenantId === 'MASTER' && editingUser?.role === 'admin'}
                           value={formData.establishmentName} 
                           onChange={e => handleInputChange('establishmentName', e.target.value.toUpperCase())} 
                           className={`w-full px-6 py-5 border-2 rounded-2xl font-black text-base outline-none transition-all ${editingUser?.tenantId === 'MASTER' ? 'bg-slate-100 opacity-60 cursor-not-allowed' : ''} ${formErrors.establishmentName ? 'border-rose-500 bg-rose-50/30' : 'bg-slate-50 dark:bg-slate-800 dark:text-white border-transparent focus:border-indigo-500'}`} 
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Categoria de Estabelecimento</label>
                        <select 
                           value={formData.category} 
                           onChange={e => handleInputChange('category', e.target.value)} 
                           className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-black text-xs uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                           <option value="">SELECIONE UMA CATEGORIA</option>
                           {globalCategories.map(cat => (
                              <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                           ))}
                        </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.document ? 'text-rose-600' : 'text-slate-400'}`}>CPF ou CNPJ *</label>
                        <input 
                            placeholder="000.000.000-00 ou 00.000.000/0000-00" 
                            value={formData.document} 
                            onChange={e => handleInputChange('document', formatDocument(e.target.value))} 
                            className={`w-full px-6 py-5 border-2 rounded-2xl font-black text-base outline-none bg-slate-50 dark:bg-slate-800 dark:text-white transition-all ${formErrors.document ? 'border-rose-500 focus:border-rose-500' : 'border-transparent focus:border-indigo-500'}`} 
                        />
                        {formErrors.document && <p className="text-[8px] font-black text-rose-600 uppercase ml-2 mt-1 italic">{formErrors.document}</p>}
                    </div>
                    <div className="space-y-1">
                        <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.whatsapp ? 'text-rose-600' : 'text-slate-400'}`}>WhatsApp *</label>
                        <input 
                            placeholder="Digite o WhatsApp com DDD" 
                            value={formData.whatsapp} 
                            onChange={e => handleInputChange('whatsapp', formatWhatsApp(e.target.value))} 
                            className={`w-full px-6 py-5 border-2 rounded-2xl font-bold text-sm outline-none transition-all ${formErrors.whatsapp ? 'border-rose-500 bg-rose-50/30' : 'bg-slate-50 dark:bg-slate-800 dark:text-white border-transparent focus:border-emerald-500'}`} 
                        />
                        {formErrors.whatsapp && <p className="text-[8px] font-black text-rose-600 uppercase ml-2 mt-1 italic">{formErrors.whatsapp}</p>}
                    </div>
                 </div>

                 <div 
                    onClick={() => handleInputChange('whatsappConfirmed', !formData.whatsappConfirmed)} 
                    className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${formData.whatsappConfirmed ? 'bg-emerald-50 border-emerald-500/30' : formErrors.whatsappConfirmed ? 'bg-rose-50 border-rose-500/50' : 'bg-slate-50 border-slate-100 dark:bg-slate-800/40 dark:border-slate-800'}`}
                 >
                    <div className="flex-1">
                       <span className={`text-[10px] font-black uppercase tracking-widest ${formData.whatsappConfirmed ? 'text-emerald-700' : formErrors.whatsappConfirmed ? 'text-rose-600' : 'text-slate-500'}`}>Confirmo o contato do usuário</span>
                       {formErrors.whatsappConfirmed && <p className="text-[8px] font-bold text-rose-600 mt-1 uppercase italic">{formErrors.whatsappConfirmed}</p>}
                    </div>
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-colors ${formData.whatsappConfirmed ? 'bg-emerald-500 border-emerald-500' : formErrors.whatsappConfirmed ? 'bg-white border-rose-500' : 'bg-white border-slate-300'}`}>
                        {formData.whatsappConfirmed && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={4}/></svg>}
                    </div>
                 </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div 
                        onClick={() => handleInputChange('canAccessTables', !formData.canAccessTables)} 
                        className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${formData.canAccessTables ? 'bg-indigo-50 border-indigo-500/30' : 'bg-slate-50 border-slate-100 dark:bg-slate-800/40 dark:border-slate-800'}`}
                    >
                        <div className="flex-1">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${formData.canAccessTables ? 'text-indigo-700' : 'text-slate-500'}`}>Permitir acesso ao sistema de Mesas</span>
                        </div>
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-colors ${formData.canAccessTables ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-slate-300'}`}>
                        {formData.canAccessTables && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={4}/></svg>}
                        </div>
                    </div>

                    {(formData.role === 'customer' || formData.role === 'demo' || formData.role === 'admin') && settings?.affiliateSystemEnabled !== false && (
                        <div 
                            onClick={() => handleInputChange('isAffiliate', !formData.isAffiliate)} 
                            className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${formData.isAffiliate ? 'bg-indigo-50 border-indigo-500/30' : 'bg-slate-50 border-slate-100 dark:bg-slate-800/40 dark:border-slate-800'}`}
                        >
                            <div className="flex-1">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${formData.isAffiliate ? 'text-indigo-700' : 'text-slate-500'}`}>Ativar como Afiliado</span>
                            </div>
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 transition-colors ${formData.isAffiliate ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-slate-300'}`}>
                            {formData.isAffiliate && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={4}/></svg>}
                            </div>
                        </div>
                    )}
                    {settings?.affiliateSystemEnabled !== false && (
                        <div className={`space-y-1 relative ${!(formData.role === 'customer' || formData.role === 'demo' || formData.role === 'admin') ? 'col-span-1 md:col-span-2' : ''}`}>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Afiliado Responsável</label>
                            <div className="relative">
                                <input 
                                    type="text"
                                    placeholder="PESQUISAR AFILIADO..."
                                    value={affiliateSearch || (formData.affiliateId ? users.find(u => u.id === formData.affiliateId)?.name.toUpperCase() : '')}
                                    onFocus={() => setShowAffiliateDropdown(true)}
                                    onChange={(e) => {
                                        setAffiliateSearch(e.target.value);
                                        setShowAffiliateDropdown(true);
                                        if (!e.target.value) handleInputChange('affiliateId', '');
                                    }}
                                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-black text-[11px] uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                {showAffiliateDropdown && (
                                    <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
                                        <div 
                                            className="px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-[10px] font-black uppercase text-slate-500"
                                            onClick={() => {
                                                handleInputChange('affiliateId', '');
                                                setAffiliateSearch('');
                                                setShowAffiliateDropdown(false);
                                            }}
                                        >
                                            NENHUM AFILIADO
                                        </div>
                                        {users
                                            .filter(u => u.isAffiliate && (u.name.toLowerCase().includes(affiliateSearch.toLowerCase()) || u.email.toLowerCase().includes(affiliateSearch.toLowerCase())))
                                            .map(aff => (
                                                <div 
                                                    key={aff.id}
                                                    className="px-5 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 cursor-pointer flex flex-col"
                                                    onClick={() => {
                                                        handleInputChange('affiliateId', aff.id);
                                                        setAffiliateSearch(aff.name.toUpperCase());
                                                        setShowAffiliateDropdown(false);
                                                    }}
                                                >
                                                    <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200">{aff.name}</span>
                                                    <span className="text-[9px] text-slate-400">{aff.email}</span>
                                                </div>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>
                            {showAffiliateDropdown && (
                                <div 
                                    className="fixed inset-0 z-40" 
                                    onClick={() => setShowAffiliateDropdown(false)}
                                />
                            )}
                        </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Data de Cadastro</label>
                    <input 
                        type="text"
                        value={editingUser?.createdAt ? new Date(editingUser.createdAt).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')} 
                        disabled
                        className="w-full px-5 py-4 bg-slate-100 dark:bg-slate-950 dark:text-slate-500 border-none rounded-2xl font-bold text-sm outline-none cursor-not-allowed"
                    />
                  </div>

                 <div className="space-y-6 pt-4 border-t dark:border-white/5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 ml-2 italic">Acesso ao Sistema</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="space-y-1">
                            <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.login ? 'text-rose-600' : 'text-slate-400'}`}>Usuário (Login) *</label>
                            <input placeholder="Digite o login de acesso" value={formData.login} onChange={e => handleInputChange('login', e.target.value.toLowerCase())} className={`w-full px-5 py-4 border-2 rounded-2xl font-bold text-sm outline-none transition-all bg-white dark:bg-slate-800 dark:text-white ${formErrors.login ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700 focus:border-indigo-500'}`} />
                            {formErrors.login && <p className="text-[8px] font-black text-rose-600 uppercase ml-2 mt-1 italic">{formErrors.login}</p>}
                        </div>
                        <div className="space-y-1">
                            <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.email ? 'text-rose-600' : 'text-slate-400'}`}>E-mail *</label>
                            <input placeholder="Digite o e-mail" value={formData.email} onChange={e => handleInputChange('email', e.target.value.toLowerCase())} className={`w-full px-5 py-4 border-2 rounded-2xl font-bold text-sm outline-none transition-all bg-white dark:bg-slate-800 dark:text-white ${formErrors.email ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700 focus:border-indigo-500'}`} />
                            {formErrors.email && <p className="text-[8px] font-black text-rose-600 uppercase ml-2 mt-1 italic">{formErrors.email}</p>}
                        </div>
                        <div className="space-y-1">
                            <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.passwordHash ? 'text-rose-600' : 'text-slate-400'}`}>Senha *</label>
                            <input placeholder="Digite uma senha" type="text" value={formData.passwordHash} onChange={e => handleInputChange('passwordHash', e.target.value)} className={`w-full px-5 py-4 border-2 rounded-2xl font-bold text-sm outline-none transition-all bg-white dark:bg-slate-800 dark:text-white ${formErrors.passwordHash ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700 focus:border-indigo-500'}`} />
                        </div>
                    </div>
                 </div>

                 <div className="space-y-6 pt-4 border-t dark:border-white/5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Tipo de Conta</label>
                            <select 
                               disabled={editingUser?.tenantId === 'MASTER' && editingUser?.role === 'admin'}
                               value={formData.role} 
                               onChange={e => {
                                  const newRole = e.target.value as any;
                                  handleInputChange('role', newRole);
                                  if (newRole === 'demo' && !formData.expiresAt) {
                                    handleInputChange('expiresAt', calculateExpiryDate(3)); // 3 days for demo
                                  }
                                }} 
                               className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-black text-[11px] uppercase outline-none cursor-pointer ${editingUser?.tenantId === 'MASTER' ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                                {editingUser?.tenantId === 'MASTER' && editingUser?.role === 'admin' ? (
                                    <option value="admin">Administrador Master</option>
                                ) : (
                                    <>
                                        <option value="customer">Cliente Pagante</option>
                                        <option value="demo">Conta Demo (Testes)</option>
                                        {settings?.affiliateSystemEnabled !== false && <option value="affiliate">Afiliado</option>}
                                        <option value="admin">Administrador (Acesso Completo)</option>
                                    </>
                                )}
                            </select>
                        </div>
                        
                             {formData.role === 'demo' && editingUser && (
                                <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Criação</p>
                                        <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{editingUser.createdAt ? new Date(editingUser.createdAt).toLocaleString('pt-BR') : '---'}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Aprovação</p>
                                        <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{editingUser.approvedAt ? new Date(editingUser.approvedAt).toLocaleString('pt-BR') : '---'}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Expiração (72h)</p>
                                        <p className="text-[10px] font-bold text-rose-500">{editingUser.expiresAt ? new Date(editingUser.expiresAt).toLocaleString('pt-BR') : '---'}</p>
                                    </div>
                                </div>
                             )}

                        {(formData.role === 'customer' || formData.role === 'demo' || formData.role === 'admin') && (
                            <div className="space-y-4 animate-in slide-in-from-top-2">
                                <div className="flex items-center gap-2 ml-2">
                                    <input 
                                        type="checkbox" 
                                        id="showPersonalizedPlans"
                                        checked={formData.showPersonalizedPlans}
                                        onChange={e => handleInputChange('showPersonalizedPlans', e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <label htmlFor="showPersonalizedPlans" className="text-[10px] font-black uppercase text-slate-500 cursor-pointer">
                                        Plano Personalizado
                                    </label>
                                </div>

                                {formData.showPersonalizedPlans ? (
                                    <div className="space-y-1 animate-in zoom-in-95 duration-200">
                                        <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.planName ? 'text-rose-600' : 'text-slate-400'}`}>
                                            Escolher Plano Personalizado *
                                        </label>
                                        <select 
                                            value={formData.planName} 
                                            onChange={e => handleInputChange('planName', e.target.value)} 
                                            className={`w-full px-5 py-4 bg-indigo-50 dark:bg-indigo-900/20 dark:text-white border-2 border-indigo-100 dark:border-indigo-900/30 rounded-2xl font-black text-[11px] uppercase outline-none focus:border-indigo-500 ${formErrors.planName ? 'border-rose-500' : ''}`}
                                        >
                                            <option value="">SELECIONE UM PLANO PERSONALIZADO</option>
                                            {plans
                                                .filter(p => p.isPersonalized)
                                                .map(p => (
                                                    <option key={p.id} value={p.name}>{p.name.toUpperCase()} — R$ {p.price.toFixed(2)}</option>
                                                ))
                                            }
                                        </select>
                                        {formErrors.planName && <p className="text-[8px] font-black text-rose-600 uppercase ml-2 mt-1 italic">{formErrors.planName}</p>}
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.planName ? 'text-rose-600' : 'text-slate-400'}`}>
                                            Escolher Plano *
                                        </label>
                                        <select 
                                            disabled={editingUser?.tenantId === 'MASTER' && editingUser?.role === 'admin'}
                                            value={formData.planName} 
                                            onChange={e => handleInputChange('planName', e.target.value)} 
                                            className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-black text-[11px] uppercase outline-none ${editingUser?.tenantId === 'MASTER' ? 'opacity-60 cursor-not-allowed' : ''} ${formErrors.planName ? 'ring-2 ring-rose-500' : ''}`}
                                        >
                                            {editingUser?.tenantId === 'MASTER' && editingUser?.role === 'admin' ? (
                                                <option value="">MASTER VITALÍCIO</option>
                                            ) : (
                                                <>
                                                    <option value="">SELECIONE UM PLANO</option>
                                                    {plans
                                                        .filter(p => !p.isPersonalized)
                                                        .map(p => (
                                                            <option key={p.id} value={p.name}>{p.name.toUpperCase()} — R$ {p.price.toFixed(2)}</option>
                                                        ))
                                                    }
                                                </>
                                            )}
                                        </select>
                                        {formErrors.planName && <p className="text-[8px] font-black text-rose-600 uppercase ml-2 mt-1 italic">{formErrors.planName}</p>}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {(formData.role === 'customer' || formData.role === 'demo') && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
                            <div className="space-y-1 animate-in slide-in-from-top-2">
                                <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.expiresAt ? 'text-rose-600' : 'text-slate-400'}`}>Validade do Plano {formData.role === 'demo' ? '*' : '(Opcional)'}</label>
                                 <input 
                                    type={formData.role === 'demo' ? "datetime-local" : "date"} 
                                    value={formData.role === 'demo' ? (formData.expiresAt.includes('T') ? formData.expiresAt.slice(0, 16) : formData.expiresAt) : (formData.expiresAt.includes('T') ? formData.expiresAt.split('T')[0] : formData.expiresAt)} 
                                    onChange={e => handleInputChange('expiresAt', e.target.value)} 
                                    className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-black text-sm uppercase outline-none ${formErrors.expiresAt ? 'ring-2 ring-rose-500' : ''}`} 
                                 />
                            </div>
                            <div className="space-y-1 animate-in slide-in-from-top-2">
                                <label className={`text-[10px] font-black uppercase ml-2 text-slate-400`}>Carência (Dias)</label>
                                <input 
                                    type="number" 
                                    min="0"
                                    step="1"
                                    value={formData.gracePeriod} 
                                    onChange={e => handleInputChange('gracePeriod', e.target.value === '' ? '' : parseInt(e.target.value))} 
                                    className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-black text-sm uppercase outline-none`} 
                                />
                            </div>
                        </div>
                    )}
                 </div>

                 <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Salvar Registro</button>
              </form>
           </div>
        </div>
       )}

       {confirmModal?.show && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-in fade-in">
             <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[2rem] p-6 shadow-2xl border border-white/10">
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase mb-2">{confirmModal.title}</h3>
                <p className="text-slate-500 text-[10px] font-bold uppercase mb-6">{confirmModal.message}</p>
                <div className="grid grid-cols-2 gap-3">
                   <button onClick={() => setConfirmModal(null)} className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Voltar</button>
                   <button onClick={confirmModal.action} className={`py-3 rounded-xl text-white font-black text-[9px] uppercase shadow-lg ${confirmModal.type === 'success' ? 'bg-emerald-500' : 'bg-rose-600'}`}>Confirmar</button>
                </div>
             </div>
          </div>
       )}

       {isCategoryModalOpen && (
         <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 border border-white/5">
               <div className="p-6 border-b bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
                  <div>
                     <h3 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">Categorias de Estabelecimento</h3>
                     <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Gerenciamento Global</p>
                  </div>
                  <button onClick={() => setIsCategoryModalOpen(false)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-90"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} /></svg></button>
               </div>

               <div className="p-6 space-y-6">
                  <div className="flex gap-2">
                     <input 
                        placeholder="NOVA CATEGORIA..." 
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value.toUpperCase())}
                        className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-xl font-black text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                     />
                     <button 
                        onClick={async () => {
                           if (!newCategoryName.trim()) return;
                           if (globalCategories.includes(newCategoryName.trim())) {
                              alert("Esta categoria já existe.");
                              return;
                           }
                           const updated = [...globalCategories, newCategoryName.trim()];
                           await saveGlobalEstablishmentCategories(updated);
                           setGlobalCategories(updated);
                           setNewCategoryName('');
                           notifyDataChanged();
                        }}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all"
                     >
                        Adicionar
                     </button>
                  </div>

                  <div className="relative">
                     <input 
                        value={categorySearch}
                        onChange={e => setCategorySearch(e.target.value.toUpperCase())}
                        placeholder="PESQUISAR CATEGORIA..." 
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-black text-[9px] uppercase outline-none shadow-inner" 
                     />
                     <svg className="w-4 h-4 text-slate-300 absolute left-3.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={3}/></svg>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                     {globalCategories
                        .filter(cat => cat.toUpperCase().includes(categorySearch.toUpperCase()))
                        .map(cat => (
                        <div key={cat} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 group">
                           {editingCategory?.old === cat ? (
                              <input 
                                 autoFocus
                                 value={editingCategory.new}
                                 onChange={e => setEditingCategory({ ...editingCategory, new: e.target.value.toUpperCase() })}
                                 onBlur={async () => {
                                    if (editingCategory.new.trim() && editingCategory.new !== editingCategory.old) {
                                       if (globalCategories.includes(editingCategory.new.trim())) {
                                          alert("Esta categoria já existe.");
                                          setEditingCategory(null);
                                          return;
                                       }
                                       const updated = globalCategories.map(c => c === editingCategory.old ? editingCategory.new.trim() : c);
                                       await saveGlobalEstablishmentCategories(updated);
                                       setGlobalCategories(updated);
                                       
                                       // Atualizar usuários que usam essa categoria
                                       const allUsers = await getUsers();
                                       const updatedUsers = allUsers.map(u => u.category === editingCategory.old ? { ...u, category: editingCategory.new.trim() } : u);
                                       await saveUsers(updatedUsers);
                                    }
                                    setEditingCategory(null);
                                    notifyDataChanged();
                                 }}
                                 className="bg-white dark:bg-slate-700 px-2 py-1 rounded font-black text-[10px] uppercase outline-none ring-1 ring-indigo-500"
                              />
                           ) : (
                              <span className="text-[10px] font-black uppercase text-slate-700 dark:text-slate-200">{cat}</span>
                           )}
                           
                           <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                 onClick={() => setEditingCategory({ old: cat, new: cat })}
                                 className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                              >
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2}/></svg>
                              </button>
                              <button 
                                 onClick={async () => {
                                    const isUsedInUsers = users.some(u => u.category === cat);
                                    const isUsedInRequests = requests.some(r => r.category === cat);
                                    
                                    if (isUsedInUsers || isUsedInRequests) {
                                       alert("Não é possível excluir: Esta categoria está sendo usada por usuários ou solicitações.");
                                       return;
                                    }
                                    
                                    if (confirm(`Deseja excluir a categoria "${cat}"?`)) {
                                       const updated = globalCategories.filter(c => c !== cat);
                                       await saveGlobalEstablishmentCategories(updated);
                                       setGlobalCategories(updated);
                                       notifyDataChanged();
                                    }
                                 }}
                                 className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                              >
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2}/></svg>
                              </button>
                           </div>
                        </div>
                     ))}
                     {globalCategories.length === 0 && (
                        <p className="text-center py-8 text-[9px] font-bold text-slate-400 uppercase italic">Nenhuma categoria cadastrada</p>
                     )}
                  </div>
               </div>
            </div>
         </div>
       )}
    </div>
  );
}