import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Filter, 
  Plus, 
  Copy, 
  ExternalLink, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Ban, 
  Pause, 
  Play, 
  Eye, 
  Check, 
  X,
  AlertTriangle,
  Lock,
  FileText,
  Calendar,
  Monitor
} from 'lucide-react';
import { uploadFile } from '../services/upload';
import { User, AffiliateCommission, AffiliatePaymentRequest, Plan, AccessRequest, Customer, View, PixKey, DemoView } from '../types';
import { 
  getUsers, getAffiliateCommissions, saveAffiliateCommissions, 
  getAffiliatePaymentRequests, saveAffiliatePaymentRequest,
  getGlobalPlans, getAppSettings, saveAccessRequest, notifyDataChanged,
  getCustomers, getAccessRequests, removeAccessRequest, saveUsers, saveCustomers,
  getPaymentRequests, getDemoViews, validateUniqueness
} from '../services/storage';
import { calculateExpiryDate, formatDisplayDate, isExpired as checkExpired, isWithinGracePeriod } from '../utils/dateUtils';
import { createPixPayment, checkPaymentStatus, PixPaymentResponse } from '../services/mercadoPago';

export default function AffiliateManagement() {
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('p4zz_session_user') || '{}'), []);
  const isMaster = currentUser?.tenantId === 'MASTER' && currentUser?.role === 'admin';
  
  const [users, setUsers] = useState<User[]>([]);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<AffiliatePaymentRequest[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [demoViews, setDemoViews] = useState<DemoView[]>([]);
  const [appSettings, setAppSettings] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [paymentRequestsGlobal, setPaymentRequestsGlobal] = useState<PaymentRequest[]>([]);
  
  const [activeTab, setActiveTab] = useState<'vendas' | 'comissoes' | 'solicitacoes' | 'contas' | 'saques' | 'clientes' | 'demo' | 'pagamento'>('vendas');
  const [mainTab, setMainTab] = useState<'vision' | 'manage' | 'requests' | 'payouts' | 'demo'>(isMaster ? 'manage' : 'vision');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string>(isMaster ? '' : currentUser.id);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<User | null>(null);
  const [editClientData, setEditClientData] = useState({
    name: '',
    email: '',
    whatsapp: '',
    planName: '',
    expiresAt: '',
    sellingPrice: 0,
    password: '',
    document: ''
  });
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    title: '',
    message: '' as React.ReactNode,
    onConfirm: () => {},
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    type: 'default' as 'default' | 'danger' | 'warning' | 'success',
    countdown: 0
  });
  const [modalCountdown, setModalCountdown] = useState(0);

  useEffect(() => {
    let timer: any;
    if (isConfirmModalOpen && modalCountdown > 0) {
      timer = setInterval(() => {
        setModalCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isConfirmModalOpen, modalCountdown]);

  const openConfirmModal = (config: {
    title: string;
    message: React.ReactNode;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'default' | 'danger' | 'warning' | 'success';
    countdown?: number;
  }) => {
    setConfirmModalConfig({
      title: config.title,
      message: config.message,
      onConfirm: config.onConfirm,
      confirmText: config.confirmText || 'Confirmar',
      cancelText: config.cancelText || 'Cancelar',
      type: config.type || 'default',
      countdown: config.countdown || 0
    });
    setModalCountdown(config.countdown || 0);
    setIsConfirmModalOpen(true);
  };
  const [isAffiliateCustomersModalOpen, setIsAffiliateCustomersModalOpen] = useState(false);
  const [viewingAffiliate, setViewingAffiliate] = useState<User | null>(null);
  const [newRequestData, setNewRequestData] = useState({
    name: '',
    whatsapp: '',
    document: '',
    email: '',
    login: '',
    password: '',
    planName: '',
    sellingPrice: 0
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<'qr' | 'manual' | null>(null);
  const [pixData, setPixData] = useState<PixPaymentResponse | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [manualReceipt, setManualReceipt] = useState<string | null>(null);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [viewedReceipts, setViewedReceipts] = useState<Set<string>>(new Set());
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);
  const [isPixKeyModalOpen, setIsPixKeyModalOpen] = useState(false);
  const [editingPixKey, setEditingPixKey] = useState<PixKey | null>(null);
  const [pixKeyFormData, setPixKeyFormData] = useState({
    type: 'CPF',
    key: '',
    label: ''
  });
  const [selectedPixKeyId, setSelectedPixKeyId] = useState<string>('');
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>('');
  const [isSavingPix, setIsSavingPix] = useState(false);
  const [showWithdrawalSuccess, setShowWithdrawalSuccess] = useState(false);

  useEffect(() => {
    const user = users.find(u => u.id === currentUser.id);
    if (user?.pixKeys) {
      setPixKeys(user.pixKeys);
    }
  }, [users, currentUser.id]);

  const handleSavePixKey = async () => {
    if (!pixKeyFormData.key.trim() || !pixKeyFormData.label.trim()) {
      alert("Por favor, preencha a chave Pix e um nome para identificação.");
      return;
    }

    // Validação de CPF/CNPJ
    const rawKey = pixKeyFormData.key.replace(/\D/g, '');
    if (pixKeyFormData.type === 'CPF' && rawKey.length !== 11) {
      alert("O CPF deve conter exatamente 11 dígitos.");
      return;
    }
    if (pixKeyFormData.type === 'CNPJ' && rawKey.length !== 14) {
      alert("O CNPJ deve conter exatamente 14 dígitos.");
      return;
    }

    setIsSavingPix(true);
    try {
      const allUsers = await getUsers();
      const userIndex = allUsers.findIndex(u => u.id === currentUser.id);
      
      if (userIndex === -1) throw new Error("Usuário não encontrado.");

      const currentKeys = allUsers[userIndex].pixKeys || [];
      let updatedKeys;

      // Limpar chave se for CPF ou CNPJ para salvar apenas números
      const cleanedKey = (pixKeyFormData.type === 'CPF' || pixKeyFormData.type === 'CNPJ') 
        ? pixKeyFormData.key.replace(/\D/g, '') 
        : pixKeyFormData.key;

      const finalFormData = { ...pixKeyFormData, key: cleanedKey };

      if (editingPixKey) {
        updatedKeys = currentKeys.map(k => k.id === editingPixKey.id ? { ...finalFormData, id: k.id } : k);
      } else {
        if (currentKeys.length >= 3) {
          alert("Você pode cadastrar no máximo 3 chaves Pix.");
          setIsSavingPix(false);
          return;
        }
        updatedKeys = [...currentKeys, { ...finalFormData, id: 'pix-' + Math.random().toString(36).substr(2, 9) }];
      }

      const updatedUser = { ...allUsers[userIndex], pixKeys: updatedKeys };
      allUsers[userIndex] = updatedUser;
      
      await saveUsers(allUsers);
      setUsers(allUsers);
      setPixKeys(updatedKeys);
      setIsPixKeyModalOpen(false);
      setEditingPixKey(null);
      setPixKeyFormData({ type: 'CPF', key: '', label: '' });
      alert("Chave Pix salva com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar chave Pix.");
    } finally {
      setIsSavingPix(false);
    }
  };

  const handleDeletePixKey = async (keyId: string) => {
    if (!confirm("Deseja realmente excluir esta chave Pix?")) return;

    try {
      const allUsers = await getUsers();
      const userIndex = allUsers.findIndex(u => u.id === currentUser.id);
      if (userIndex === -1) return;

      const updatedKeys = (allUsers[userIndex].pixKeys || []).filter(k => k.id !== keyId);
      allUsers[userIndex] = { ...allUsers[userIndex], pixKeys: updatedKeys };
      
      await saveUsers(allUsers);
      setUsers(allUsers);
      setPixKeys(updatedKeys);
      if (selectedPixKeyId === keyId) setSelectedPixKeyId('');
    } catch (e) {
      alert("Erro ao excluir chave Pix.");
    }
  };

  const validateField = (field: string, value: any) => {
    let error = '';
    switch (field) {
      case 'name':
        if (!value) error = 'Nome é obrigatório.';
        break;
      case 'document':
        const docNumbers = value.replace(/\D/g, '');
        if (!value) error = 'CPF/CNPJ é obrigatório.';
        else if (docNumbers.length !== 11 && docNumbers.length !== 14) error = 'Documento deve ter 11 (CPF) ou 14 (CNPJ) dígitos.';
        else if (!isValidCPF_CNPJ(value)) error = 'Documento inválido.';
        else {
          // Real-time duplicate check
          const isDuplicate = users.some(u => u.document === value && u.id !== editingClient?.id);
          const isRequestDuplicate = accessRequests.some(r => r.document === value && r.id !== (editingClient as any)?.requestId);
          if (isDuplicate || isRequestDuplicate) error = 'Documento já cadastrado.';
        }
        break;
      case 'whatsapp':
        const waNumbers = value.replace(/\D/g, '');
        if (!value) error = 'WhatsApp é obrigatório.';
        else if (waNumbers.length < 10 || waNumbers.length > 11) error = 'WhatsApp deve ter 10 ou 11 dígitos.';
        break;
      case 'email':
        if (!value) error = 'E-mail é obrigatório.';
        else if (!validateEmail(value)) error = 'Formato inválido.';
        else if (users.some(u => u.email === value && u.id !== editingClient?.id)) error = 'E-mail já cadastrado.';
        break;
      case 'login':
        if (!value) error = 'Login é obrigatório.';
        else if (users.some(u => (u.login || u.email) === value && u.id !== editingClient?.id)) error = 'Login já existe.';
        break;
      case 'password':
        if (!value) error = 'Senha é obrigatória.';
        break;
      case 'planName':
        if (!value) error = 'Selecione um plano.';
        break;
      case 'sellingPrice':
        const selectedPlan = plans.find(p => p.name === newRequestData.planName);
        if (!value || value <= 0) error = 'Preço de venda é obrigatório.';
        else if (selectedPlan && value < selectedPlan.price) error = `Mínimo: R$ ${selectedPlan.price.toFixed(2)}`;
        break;
    }
    setFormErrors(prev => ({ ...prev, [field]: error }));
  };

  useEffect(() => {
    if (isNewRequestModalOpen) {
      Object.keys(newRequestData).forEach(key => validateField(key, (newRequestData as any)[key]));
    }
  }, [newRequestData, isNewRequestModalOpen]);

  const filteredPlans = useMemo(() => {
    const doc = newRequestData.document.replace(/\D/g, '');
    if (!doc) return plans.filter(p => !p.isPersonalized);
    
    const personalized = plans.filter(p => 
      p.isPersonalized && (p.linkedDocument || '').replace(/\D/g, '') === doc
    );
    
    if (personalized.length > 0) return personalized;
    
    return plans.filter(p => !p.isPersonalized);
  }, [plans, newRequestData.document]);

  const filteredPlansForEdit = useMemo(() => {
    const doc = editClientData.document.replace(/\D/g, '');
    if (!doc) return plans.filter(p => !p.isPersonalized);
    
    const personalized = plans.filter(p => 
      p.isPersonalized && (p.linkedDocument || '').replace(/\D/g, '') === doc
    );
    
    if (personalized.length > 0) return personalized;
    
    return plans.filter(p => !p.isPersonalized);
  }, [plans, editClientData.document]);

  useEffect(() => {
    if (newRequestData.planName && filteredPlans.length > 0) {
      const exists = filteredPlans.some(p => p.name === newRequestData.planName);
      if (!exists) {
        setNewRequestData(prev => ({ ...prev, planName: '' }));
      }
    }
  }, [filteredPlans, newRequestData.planName]);

  const isFormValid = useMemo(() => {
    return Object.values(formErrors).every(err => !err) && 
           Object.keys(newRequestData).every(key => (newRequestData as any)[key] !== '' && (newRequestData as any)[key] !== 0);
  }, [formErrors, newRequestData]);

  const handleGeneratePix = async () => {
    if (!isFormValid) return;
    setIsGeneratingPix(true);
    try {
      const selectedPlan = plans.find(p => p.name === newRequestData.planName);
      const amount = selectedPlan?.price || 0;
      const data = await createPixPayment(amount, `Plano ${newRequestData.planName} - ${newRequestData.name}`, newRequestData.email);
      setPixData(data);
      setPaymentStatus('pending');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsGeneratingPix(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (pixData && paymentStatus === 'pending') {
      interval = setInterval(async () => {
        const status = await checkPaymentStatus(pixData.id);
        if (status === 'approved') {
          setPaymentStatus('approved');
          clearInterval(interval);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [pixData, paymentStatus]);

  const handleManualReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      if (manualReceipt && !manualReceipt.startsWith('data:')) {
        formData.append('oldPath', manualReceipt);
      }

      try {
        const url = await uploadFile(file, 'receipts');
        setManualReceipt(url);
        setPaymentStatus('approved'); // Unlock button
      } catch (error) {
        console.error('Erro no upload:', error);
        alert('Erro ao fazer upload do comprovante para o Firebase Storage.');
      } finally {
        e.target.value = '';
      }
    }
  };

  const formatWhatsApp = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  };

  const formatCPF_CNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 14);
    if (numbers.length <= 11) {
      // CPF
      if (numbers.length <= 3) return numbers;
      if (numbers.length <= 6) return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
      if (numbers.length <= 9) return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
      return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
    } else {
      // CNPJ: 00.000.000/0000-00
      if (numbers.length <= 2) return numbers;
      if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
      if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
      if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12)}`;
    }
  };

  const isValidCPF_CNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length === 11) {
      const strCPF = numbers;
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
    }
    if (numbers.length === 14) return true; // Validação simplificada para CNPJ
    return false;
  };

  const validateEmail = (email: string) => {
    if (email.includes('@')) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    // Simple username: allow alphanumeric, dots, underscores, hyphens
    return email.trim().length > 0 && /^[a-zA-Z0-9._-]+$/.test(email);
  };

  const refreshData = useCallback(async () => {
    const [allUsers, allComms, allPayReqs, allPlans, settings, allCustomers, allAccessReqs, allPaymentReqsGlobal, allDemoViews] = await Promise.all([
      getUsers(),
      getAffiliateCommissions(),
      getAffiliatePaymentRequests(),
      getGlobalPlans(),
      getAppSettings(),
      getCustomers('MASTER'),
      getAccessRequests(),
      getPaymentRequests(),
      getDemoViews()
    ]);
    setUsers(allUsers);
    setCommissions(allComms);
    setPaymentRequests(allPayReqs);
    setPlans(allPlans);
    setAppSettings(settings);
    setCustomers(allCustomers);
    setAccessRequests(allAccessReqs);
    setPaymentRequestsGlobal(allPaymentReqsGlobal);
    setDemoViews(allDemoViews);
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const affiliateUsers = useMemo(() => users.filter(u => u.isAffiliate || u.role === 'affiliate'), [users]);
  
  const filteredAffiliateUsers = useMemo(() => {
    const sorted = [...affiliateUsers].filter(u => 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Sort: pending requests first
    return sorted.sort((a, b) => {
      const aHasPending = accessRequests.some(r => r.affiliateId === a.id && r.status === 'pending');
      const bHasPending = accessRequests.some(r => r.affiliateId === b.id && r.status === 'pending');
      if (aHasPending && !bHasPending) return -1;
      if (!aHasPending && bHasPending) return 1;
      return 0;
    });
  }, [affiliateUsers, searchTerm, accessRequests]);

  const filteredCommissions = useMemo(() => {
    if (!selectedAffiliateId) return [];
    const existingAffiliateIds = new Set(affiliateUsers.map(u => u.id));
    return commissions.filter(c => 
      c.affiliateId === selectedAffiliateId && 
      existingAffiliateIds.has(c.affiliateId)
    );
  }, [commissions, selectedAffiliateId, affiliateUsers]);

  const filteredPaymentRequests = useMemo(() => {
    if (!selectedAffiliateId) return [];
    const existingAffiliateIds = new Set(affiliateUsers.map(u => u.id));
    return paymentRequests.filter(r => 
      r.affiliateId === selectedAffiliateId && 
      existingAffiliateIds.has(r.affiliateId)
    );
  }, [paymentRequests, selectedAffiliateId, affiliateUsers]);

  const filteredAccessRequests = useMemo(() => {
    if (!selectedAffiliateId) return [];
    const existingAffiliateIds = new Set(affiliateUsers.map(u => u.id));
    return accessRequests.filter(r => 
      r.affiliateId === selectedAffiliateId && 
      existingAffiliateIds.has(r.affiliateId)
    );
  }, [accessRequests, selectedAffiliateId, affiliateUsers]);

  const affiliateClients = useMemo(() => {
    if (!selectedAffiliateId) return [];
    const existingAffiliateIds = new Set(affiliateUsers.map(u => u.id));
    if (!existingAffiliateIds.has(selectedAffiliateId)) return [];

    const clients = users.filter(u => u && u.affiliateId === selectedAffiliateId);
    const pendingReqs = accessRequests.filter(r => r && r.status === 'pending' && r.affiliateId === selectedAffiliateId);
    
    const pendingClients = pendingReqs.map(r => ({
      id: r.id,
      name: r.name,
      whatsapp: r.whatsapp,
      login: r.login,
      planName: r.plan,
      sellingPrice: r.sellingPrice,
      createdAt: r.createdAt,
      status: 'pending' as const,
      isRequest: true,
      request: r,
      paymentType: r.paymentType,
      pixReceipt: r.pixReceipt
    }));

    const activeClients = clients.map(u => ({
      id: u.id,
      name: u.name,
      whatsapp: u.whatsapp,
      login: u.email,
      planName: u.planName,
      sellingPrice: u.sellingPrice,
      createdAt: u.createdAt,
      expiresAt: u.expiresAt,
      active: u.active,
      status: 'active' as const,
      isRequest: false,
      user: u,
      paymentType: u.paymentType,
      pixReceipt: u.pixReceipt
    }));

    return [...pendingClients, ...activeClients].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [users, accessRequests, selectedAffiliateId]);

  const affiliateStats = useMemo(() => {
    const stats: Record<string, { totalSales: number, totalCommission: number, pendingPayout: number, paidPayout: number }> = {};
    const existingAffiliateIds = new Set(users.filter(u => u.isAffiliate).map(u => u.id));
    
    const processedCommIds = new Set<string>();
    commissions.forEach(c => {
      if (!c || processedCommIds.has(c.id)) return;
      processedCommIds.add(c.id);
      if (!existingAffiliateIds.has(c.affiliateId)) return;
      if (!stats[c.affiliateId]) stats[c.affiliateId] = { totalSales: 0, totalCommission: 0, pendingPayout: 0, paidPayout: 0 };
      
      // Somente conta vendas aprovadas (que possuem customerId vinculado)
      if (c.customerId) {
        stats[c.affiliateId].totalSales += 1;
        // A comissão acumulada reflete tudo o que foi ganho (pendente ou pago)
        if (c.status === 'pending' || c.status === 'paid') {
          stats[c.affiliateId].totalCommission += c.commissionAmount;
        }
      }
    });

    const processedReqIds = new Set<string>();
    paymentRequests.forEach(r => {
      if (!r || processedReqIds.has(r.id)) return;
      processedReqIds.add(r.id);
      if (!existingAffiliateIds.has(r.affiliateId)) return;
      if (!stats[r.affiliateId]) stats[r.affiliateId] = { totalSales: 0, totalCommission: 0, pendingPayout: 0, paidPayout: 0 };
      if (r.status === 'pending') stats[r.affiliateId].pendingPayout += r.amount;
      if (r.status === 'paid') stats[r.affiliateId].paidPayout += r.amount;
    });

    // Garantir que nenhum valor seja negativo por erro de cálculo
    Object.keys(stats).forEach(id => {
      stats[id].totalCommission = Math.max(0, stats[id].totalCommission);
      stats[id].pendingPayout = Math.max(0, stats[id].pendingPayout);
      stats[id].paidPayout = Math.max(0, stats[id].paidPayout);
    });

    return stats;
  }, [commissions, paymentRequests, users]);

  const currentAffiliateStats = useMemo(() => {
    const initial = { totalSales: 0, totalCommission: 0, pendingPayout: 0, paidPayout: 0, demoViews: 0 };
    const affiliateId = isMaster ? selectedAffiliateId : currentUser.id;
    if (!affiliateId) return initial;
    
    const stats = affiliateStats[affiliateId] || initial;
    const views = demoViews.filter(v => v.affiliateId === affiliateId).length;
    
    return { ...stats, demoViews: views };
  }, [affiliateStats, selectedAffiliateId, isMaster, currentUser.id, demoViews]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações obrigatórias
    if (!newRequestData.name || !newRequestData.whatsapp || !newRequestData.document || !newRequestData.email || !newRequestData.login || !newRequestData.password || !newRequestData.planName || newRequestData.sellingPrice <= 0) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    // Validação de Formato
    if (!isValidCPF_CNPJ(newRequestData.document)) {
      alert("CPF ou CNPJ inválido. Por favor, verifique o número digitado.");
      return;
    }

    if (newRequestData.whatsapp.replace(/\D/g, '').length < 10) {
      alert("WhatsApp inválido. O número deve ter pelo menos 10 dígitos.");
      return;
    }

    if (!validateEmail(newRequestData.email)) {
      alert("E-mail inválido. Por favor, verifique o formato.");
      return;
    }

    const allUsers = await getUsers();
    const allRequests = await getAccessRequests();
    
    const uniqueness = await validateUniqueness(newRequestData.name, newRequestData.document);
    if (!uniqueness.valid) {
      alert(uniqueness.message);
      return;
    }

    if (allUsers.some(u => u.email === newRequestData.email) || allRequests.some(r => r.email === newRequestData.email)) {
      alert("Este e-mail já está cadastrado ou possui uma solicitação pendente.");
      return;
    }

    if (allUsers.some(u => (u.login || u.email) === newRequestData.login) || allRequests.some(r => r.login === newRequestData.login)) {
      alert("Este login já está cadastrado ou possui uma solicitação pendente.");
      return;
    }

    const selectedPlan = plans.find(p => p.name === newRequestData.planName);
    if (selectedPlan && newRequestData.sellingPrice < selectedPlan.price) {
      alert(`O preço de venda não pode ser menor que o valor base do plano (R$ ${selectedPlan.price.toFixed(2)}).`);
      return;
    }

    const basePrice = selectedPlan ? selectedPlan.price : (appSettings?.affiliateBasePrice || 50);
    const commissionPercent = appSettings?.affiliateCommissionPercent || 0;

    const request: AccessRequest = {
      id: 'req-' + Math.random().toString(36).substr(2, 9),
      name: newRequestData.name,
      email: newRequestData.email,
      whatsapp: newRequestData.whatsapp,
      document: newRequestData.document,
      category: 'Affiliate',
      login: newRequestData.login || newRequestData.email,
      passwordHash: newRequestData.password,
      plan: newRequestData.planName,
      status: 'pending',
      createdAt: new Date().toISOString(),
      affiliateId: currentUser.id,
      sellingPrice: newRequestData.sellingPrice,
      pixReceipt: manualReceipt || undefined,
      paymentType: paymentMethod === 'qr' ? 'automatic' : 'manual'
    };

    await saveAccessRequest(request);
    
    const profit = Math.max(0, newRequestData.sellingPrice - basePrice);
    const commissionAmount = commissionPercent > 0 
      ? (profit * (commissionPercent / 100))
      : profit;

    const commission: AffiliateCommission = {
      id: 'comm-' + Math.random().toString(36).substr(2, 9),
      affiliateId: currentUser.id,
      customerId: '',
      customerName: newRequestData.name,
      basePrice: basePrice,
      sellingPrice: newRequestData.sellingPrice,
      commissionAmount: commissionAmount,
      status: 'pending',
      createdAt: new Date().toISOString(),
      requestId: request.id
    };

    const allComms = await getAffiliateCommissions();
    await saveAffiliateCommissions([...allComms, commission]);

    setIsNewRequestModalOpen(false);
    setNewRequestData({ name: '', whatsapp: '', document: '', email: '', password: '', planName: '', sellingPrice: 0 });
    setFormErrors({});
    setPaymentMethod(null);
    setPixData(null);
    setPaymentStatus('pending');
    setManualReceipt(null);
    refreshData();
    notifyDataChanged();
    alert("Solicitação enviada com sucesso!");
  };

  const handleConfirmPayout = async (request: AffiliatePaymentRequest) => {
    if (!isMaster) return;
    
    const updatedRequest: AffiliatePaymentRequest = {
      ...request,
      status: 'paid',
      paidAt: new Date().toISOString()
    };

    await saveAffiliatePaymentRequest(updatedRequest);
    
    // Marcar as comissões como pagas para este afiliado
    const allComms = await getAffiliateCommissions();
    const updatedComms = allComms.map(c => {
      if (c.affiliateId === request.affiliateId && c.status === 'pending' && c.customerId) {
        // Só marcamos como pago se a venda já foi aprovada
        // E filtramos pela data da solicitação de saque (ou anterior)
        if (new Date(c.createdAt) <= new Date(request.createdAt)) {
          return { ...c, status: 'paid' as const };
        }
      }
      return c;
    });
    await saveAffiliateCommissions(updatedComms);
    
    refreshData();
    notifyDataChanged();
    alert("Pagamento confirmado!");
  };

  const handleDeleteCommission = async (id: string) => {
    if (!isMaster) return;
    openConfirmModal({
      title: 'Apagar Comissão',
      message: 'Tem certeza que deseja apagar esta comissão permanentemente? Esta ação não pode ser desfeita e afetará o saldo do afiliado.',
      onConfirm: async () => {
        const updatedComms = commissions.filter(c => c.id !== id);
        await saveAffiliateCommissions(updatedComms);
        refreshData();
        notifyDataChanged();
      },
      type: 'danger',
      confirmText: 'Apagar Agora'
    });
  };

  const handleRejectPayout = async (id: string) => {
    if (!isMaster) return;
    if (!window.confirm("Deseja realmente rejeitar esta solicitação de saque?")) return;
    
    const request = paymentRequests.find(r => r.id === id);
    if (!request) return;

    const updatedRequest: AffiliatePaymentRequest = {
      ...request,
      status: 'rejected'
    };

    await saveAffiliatePaymentRequest(updatedRequest);
    
    refreshData();
    notifyDataChanged();
    alert("Saque rejeitado.");
  };

  const handleViewReceipt = (receipt: string, requestId?: string) => {
    if (!receipt) {
      alert("Comprovante não encontrado.");
      return;
    }
    
    if (requestId) {
      setViewedReceipts(prev => new Set(prev).add(requestId));
    }

    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>Comprovante Pix - P4ZZ SYSTEM</title>
            <style>
              body { margin: 0; background: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; }
              .container { background: white; padding: 20px; rounded: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); max-width: 90%; }
              img { max-width: 100%; max-height: 85vh; border-radius: 10px; display: block; }
              .header { color: #1e293b; font-weight: 900; text-transform: uppercase; font-size: 12px; margin-bottom: 15px; text-align: center; letter-spacing: 2px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">Comprovante de Pagamento</div>
              <img src="${receipt}" alt="Comprovante Pix" />
            </div>
          </body>
        </html>
      `);
      newWindow.document.close();
    } else {
      alert("O navegador bloqueou a abertura da nova aba. Por favor, permita pop-ups.");
    }
  };

  const handleApproveAccessRequest = async (requestId: string) => {
    if (!isMaster) return;

    try {
      const request = accessRequests.find(r => r.id === requestId);
      if (!request || request.status !== 'pending') {
        alert("Solicitação não encontrada ou já processada.");
        return;
      }

      // 1. Criar o Usuário
      const newUserId = 'user-' + Math.random().toString(36).substr(2, 9);
      const tenantId = 'T-' + Math.random().toString(36).substr(2, 5).toUpperCase();
      
      const selectedPlan = plans.find(p => p.name === request.plan) || plans[0];
      const expiryStr = calculateExpiryDate(selectedPlan?.days || 30);

      const permissions: View[] = ['dashboard', 'new-sale', 'tables', 'deliveries', 'products', 'categories', 'fiados', 'sales-history', 'reports'];

      const newUser: User = {
        id: newUserId,
        tenantId: tenantId,
        name: request.name,
        email: request.email,
        login: request.login,
        passwordHash: request.passwordHash,
        role: 'customer',
        active: true,
        planName: request.plan,
        whatsapp: request.whatsapp,
        document: request.document,
        expiresAt: expiryStr,
        createdAt: new Date().toISOString(),
        affiliateId: request.affiliateId,
        sellingPrice: request.sellingPrice,
        paymentType: request.paymentType,
        pixReceipt: undefined,
        permissions
      };

      const allUsers = await getUsers();
      await saveUsers([...allUsers, newUser]);

      // 2. Criar o Customer (Licença) na MASTER
      const newCustomer: Customer = {
        id: 'cust-' + Math.random().toString(36).substr(2, 9),
        name: request.name,
        phone: request.whatsapp,
        email: request.login,
        document: request.document,
        balance: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
        linkedUserId: newUserId,
        licenseExpiresAt: expiryStr,
        planName: request.plan
      };

      const allCustomers = await getCustomers('MASTER');
      await saveCustomers([...allCustomers, newCustomer], 'MASTER');

      // 3. Atualizar a Solicitação
      const updatedRequest: AccessRequest = { ...request, status: 'approved', pixReceipt: undefined };
      await saveAccessRequest(updatedRequest);

      // 4. Vincular a comissão ao customerId recém criado
      const allComms = await getAffiliateCommissions();
      const newComms = allComms.map(c => {
        if (c.requestId === request.id) {
          return { ...c, customerId: newUserId, status: 'pending' as const };
        }
        return c;
      });
      await saveAffiliateCommissions(newComms);

      await refreshData();
      notifyDataChanged();
      alert(`Conta para ${request.name} aprovada e criada com sucesso!`);
    } catch (error) {
      console.error("Erro ao aprovar solicitação:", error);
      alert("Erro ao processar a aprovação. Tente novamente.");
    }
  };

  const handleRejectAccessRequest = async (id: string) => {
    if (!isMaster) return;

    try {
      const request = accessRequests.find(r => r.id === id);
      if (!request) return;

      // 1. Atualizar a Solicitação
      await saveAccessRequest({ ...request, status: 'rejected', pixReceipt: undefined });
      
      // 2. Atualizar a Comissão vinculada para 'rejected'
      const allComms = await getAffiliateCommissions();
      const updatedComms = allComms.map(c => {
        if (c.requestId === id) {
          return { ...c, status: 'rejected' as const };
        }
        return c;
      });
      await saveAffiliateCommissions(updatedComms);

      await refreshData();
      notifyDataChanged();
      alert("Solicitação rejeitada com sucesso.");
    } catch (error) {
      console.error("Erro ao rejeitar solicitação:", error);
      alert("Erro ao processar a rejeição. Tente novamente.");
    }
  };

  const handleDeleteClient = async (userId: string) => {
    const allUsers = await getUsers();
    const userToDelete = allUsers.find(u => u.id === userId);
    
    if (!isMaster && userToDelete?.affiliateId !== currentUser.id) {
      alert("Você não tem permissão para excluir esta conta.");
      return;
    }
    
    await saveUsers(allUsers.filter(u => u.id !== userId));
    
    const allCustomers = await getCustomers('MASTER');
    await saveCustomers(allCustomers.filter(c => c.linkedUserId !== userId), 'MASTER');
    
    refreshData();
    notifyDataChanged();
    alert("Cliente excluído com sucesso.");
  };

  const handleToggleClientActive = async (userId: string, active: boolean, actionLabel: string) => {
    const allUsers = await getUsers();
    const updated = allUsers.map(u => {
      if (u.id === userId) {
        return { 
          ...u, 
          active,
          deactivatedMessage: !active ? (actionLabel === 'Banir' ? 'Sua conta foi banida permanentemente.' : 'Sua conta está suspensa temporariamente.') : undefined
        };
      }
      return u;
    });
    await saveUsers(updated);

    // Sincronizar com o Customer na MASTER
    const allCustomers = await getCustomers('MASTER');
    const updatedCustomers = allCustomers.map(c => {
      if (c.linkedUserId === userId) {
        return { 
          ...c, 
          status: active ? 'active' as const : 'blocked' as const 
        };
      }
      return c;
    });
    await saveCustomers(updatedCustomers, 'MASTER');

    refreshData();
    notifyDataChanged();
    alert(`Cliente ${active ? 'ativado' : actionLabel + 'o'} com sucesso.`);
  };

  const handleEditClient = (user: User) => {
    // Permission check
    if (!isMaster && user.affiliateId !== currentUser.id) {
      alert("Você não tem permissão para editar este cliente.");
      return;
    }

    setEditingClient(user);
    setEditClientData({
      name: user.name,
      email: user.email,
      whatsapp: formatWhatsApp(user.whatsapp || ''),
      planName: user.planName || '',
      expiresAt: user.expiresAt || '',
      sellingPrice: user.sellingPrice || 0,
      password: user.passwordHash || '',
      document: formatCPF_CNPJ(user.document || '')
    });
    // Reset errors for the modal
    setFormErrors({});
    setIsEditClientModalOpen(true);
  };

  const handleSaveClientEdit = async () => {
    if (!editingClient) return;
    
    // Permission check
    if (!isMaster && editingClient.affiliateId !== currentUser.id) {
      alert("Você não tem permissão para editar este cliente.");
      return;
    }

    // Final validation
    const errors: Record<string, string> = {};
    const docNumbers = editClientData.document.replace(/\D/g, '');
    const waNumbers = editClientData.whatsapp.replace(/\D/g, '');
    
    if (!editClientData.name) errors.name = 'Nome é obrigatório.';
    if (!editClientData.document) errors.document = 'CPF/CNPJ é obrigatório.';
    else if (docNumbers.length !== 11 && docNumbers.length !== 14) errors.document = 'Documento deve ter 11 ou 14 dígitos.';
    else if (!isValidCPF_CNPJ(editClientData.document)) errors.document = 'Documento inválido.';
    else {
      const uniqueness = await validateUniqueness(editClientData.name, editClientData.document, editingClient.id);
      if (!uniqueness.valid) {
        if (uniqueness.message?.includes("nome")) errors.name = uniqueness.message;
        else errors.document = uniqueness.message || "Erro de validação";
      }
    }
    
    if (!editClientData.whatsapp) errors.whatsapp = 'WhatsApp é obrigatório.';
    else if (waNumbers.length < 10 || waNumbers.length > 11) errors.whatsapp = 'WhatsApp deve ter 10 ou 11 dígitos.';
    
    if (!editClientData.email) errors.email = 'Email/Login é obrigatório.';
    else if (!validateEmail(editClientData.email)) errors.email = 'Formato inválido.';
    else if (users.some(u => u.email === editClientData.email && u.id !== editingClient.id)) errors.email = 'Usuário já existe.';
    
    if (!editClientData.password) errors.password = 'Senha é obrigatória.';
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      alert("Por favor, corrija os erros no formulário.");
      return;
    }

    const allUsers = await getUsers();
    const updated = allUsers.map(u => u.id === editingClient.id ? {
      ...u,
      name: editClientData.name,
      email: editClientData.email,
      whatsapp: editClientData.whatsapp.replace(/\D/g, ''),
      planName: editClientData.planName,
      expiresAt: editClientData.expiresAt,
      sellingPrice: editClientData.sellingPrice,
      document: editClientData.document,
      passwordHash: editClientData.password
    } : u);
    await saveUsers(updated);
    
    // Recalcular comissão se for cliente de afiliado e o preço de venda mudou
    if (editingClient.affiliateId) {
      const [globalPlans, settings, allComms] = await Promise.all([
        getGlobalPlans(),
        getAppSettings('MASTER'),
        getAffiliateCommissions()
      ]);

      const currentPlan = globalPlans.find(p => p.name === editClientData.planName);
      const basePrice = currentPlan ? currentPlan.price : (settings.affiliateBasePrice || 50);
      const sellingPrice = editClientData.sellingPrice;
      const commissionPercent = settings.affiliateCommissionPercent || 0;
      
      const profit = Math.max(0, sellingPrice - basePrice);
      const newCommissionAmount = commissionPercent > 0 
          ? (profit * (commissionPercent / 100))
          : profit;

      // Atualiza todas as comissões PENDENTES deste cliente
      const updatedComms = allComms.map(comm => {
        if (comm.customerId === editingClient.id && comm.status === 'pending') {
          return {
            ...comm,
            basePrice: basePrice,
            sellingPrice: sellingPrice,
            commissionAmount: newCommissionAmount,
            customerName: editClientData.name
          };
        }
        return comm;
      });
      
      await saveAffiliateCommissions(updatedComms);
    }
    
    const allCustomers = await getCustomers('MASTER');
    const custIdx = allCustomers.findIndex(c => c.linkedUserId === editingClient.id);
    if (custIdx !== -1) {
      allCustomers[custIdx] = {
        ...allCustomers[custIdx],
        name: editClientData.name,
        phone: editClientData.whatsapp.replace(/\D/g, ''),
        email: editClientData.email,
        planName: editClientData.planName,
        licenseExpiresAt: editClientData.expiresAt,
        document: editClientData.document
      };
      await saveCustomers(allCustomers, 'MASTER');
    }
    
    setIsEditClientModalOpen(false);
    refreshData();
    notifyDataChanged();
    alert("Cliente atualizado com sucesso!");
  };

  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopyDemoLink = () => {
    const demoUrl = `${window.location.origin}/demo.html?affiliateId=${currentUser.id}`;
    navigator.clipboard.writeText(demoUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  return (
    <div className="space-y-8 pb-24 animate-in fade-in duration-500 max-w-6xl mx-auto">
      {isMaster && (
        <div className="flex justify-center mb-8">
          <div className="bg-slate-200/60 dark:bg-slate-800/60 p-1.5 rounded-full flex gap-1 shadow-inner border border-slate-300/30 dark:border-slate-700/30">
            <button 
              onClick={() => {
                setMainTab('manage');
                if (isMaster) {
                  setSelectedAffiliateId('');
                  setActiveTab('vendas');
                }
              }}
              className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${mainTab === 'manage' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Gerenciar Afiliados
            </button>
            <button 
              onClick={() => {
                setMainTab('vision');
                if (isMaster) {
                  setSelectedAffiliateId('');
                  setActiveTab('vendas');
                }
              }}
              className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${mainTab === 'vision' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Visão do Afiliado
            </button>
            <button 
              onClick={() => {
                setMainTab('payouts');
                if (isMaster) {
                  setSelectedAffiliateId('');
                  setActiveTab('vendas');
                }
              }}
              className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${mainTab === 'payouts' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' : 'text-slate-600 dark:text-slate-400'} flex items-center gap-2`}
            >
              Gerenciar Saques
              {paymentRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="bg-amber-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[7px] animate-pulse">
                  {paymentRequests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
            <button 
              onClick={() => {
                setMainTab('demo');
                if (isMaster) {
                  setSelectedAffiliateId('');
                  setActiveTab('vendas');
                }
              }}
              className={`px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${mainTab === 'demo' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' : 'text-slate-600 dark:text-slate-400'} flex items-center gap-2`}
            >
              Demo Viewer
            </button>
          </div>
        </div>
      )}

      {isMaster && mainTab === 'manage' && (
        <div key="manage-section" className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-4 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                Gerenciar Afiliados
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest">
                Pesquise e selecione um parceiro para ver detalhes
              </p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              <div className="relative">
                <input 
                  type="text"
                  placeholder="PESQUISAR AFILIADO..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="bg-slate-100 dark:bg-slate-800 border-none rounded-2xl px-6 py-3 font-black text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-64"
                />
              </div>
              <select 
                value={selectedAffiliateId} 
                onChange={e => setSelectedAffiliateId(e.target.value)}
                className="bg-slate-100 dark:bg-slate-800 border-none rounded-2xl px-6 py-3 font-black text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">SELECIONE UM AFILIADO...</option>
                {affiliateUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-slate-100 dark:bg-slate-950 border-b dark:border-slate-800">
                  <tr>
                    <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest">Afiliado</th>
                    <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Vendas</th>
                    <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Comissão Total</th>
                    <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Saldo Disponível</th>
                    <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Saque Pendente</th>
                    <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredAffiliateUsers.map(aff => {
                    const stats = affiliateStats[aff.id] || { totalSales: 0, totalCommission: 0, pendingPayout: 0, paidPayout: 0 };
                    const balance = stats.totalCommission - stats.paidPayout;
                    return (
                      <tr key={aff.id} className={`hover:bg-white dark:hover:bg-slate-800 transition-all ${accessRequests.some(r => r.affiliateId === aff.id && r.status === 'pending') ? 'bg-rose-50/30 dark:bg-rose-900/10' : ''}`}>
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-3">
                            {accessRequests.some(r => r.affiliateId === aff.id && r.status === 'pending') && (
                              <div className="w-3 h-3 bg-rose-500 rounded-sm shadow-sm animate-pulse" title="Solicitação Pendente" />
                            )}
                            <div>
                              <p className="font-black text-xs uppercase text-slate-900 dark:text-white">{aff.name}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase">{aff.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-6 text-center font-black text-xs text-slate-700 dark:text-slate-200">{stats.totalSales}</td>
                        <td className="px-10 py-6 text-center font-black text-xs text-emerald-600">R$ {stats.totalCommission.toFixed(2)}</td>
                        <td className="px-10 py-6 text-center font-black text-xs text-indigo-600">R$ {Math.max(0, stats.totalCommission - stats.paidPayout - stats.pendingPayout).toFixed(2)}</td>
                        <td className="px-10 py-6 text-center font-black text-xs text-amber-600">R$ {stats.pendingPayout.toFixed(2)}</td>
                        <td className="px-10 py-6 text-right">
                          <button 
                            onClick={() => {
                              setSelectedAffiliateId(aff.id);
                              setMainTab('vision');
                            }}
                            className="bg-indigo-500 text-white px-4 py-2 rounded-xl text-[8px] font-black uppercase shadow-md hover:brightness-110 transition-all"
                          >
                            Ver Detalhes
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAffiliateUsers.length === 0 && (
                    <tr><td colSpan={5} className="py-24 text-center opacity-30 font-black uppercase text-[10px] italic">Nenhum afiliado encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isMaster && mainTab === 'demo' && (
        <div key="demo-section" className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-4 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                Demo Viewer
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest">
                Atalho rápido para o ambiente de demonstração sincronizado
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-50 dark:bg-slate-950/50 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                  <Monitor className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white">Acesso Direto</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Visualize o sistema como um visitante</p>
                </div>
              </div>
              
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-8">
                O Demo Viewer permite que você visualize o sistema exatamente como ele está agora, mas em um ambiente seguro onde nenhuma alteração é salva permanentemente. Ideal para demonstrações rápidas.
              </p>

              <div className="flex flex-col gap-3">
                <a 
                  href="/demo.html" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir Demo Viewer
                </a>
                
                <button 
                  onClick={handleCopyDemoLink}
                  className="w-full bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-100 dark:border-indigo-900/30 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center justify-center gap-3"
                >
                  <Copy className="w-4 h-4" />
                  {copySuccess ? 'Link Copiado!' : 'Copiar Link da Demo'}
                </button>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/10 p-8 rounded-[2rem] border border-amber-100 dark:border-amber-900/20">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white">Sincronização Ativa</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Reflexo em tempo real</p>
                </div>
              </div>
              
              <ul className="space-y-4">
                {[
                  'Reflete nomes de menus e labels customizados',
                  'Exibe a identidade visual e cores atuais',
                  'Mostra a estrutura de módulos ativa',
                  'Sincroniza produtos e categorias em tempo real'
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-[11px] font-bold text-amber-800 dark:text-amber-300/80">
                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {isMaster && mainTab === 'payouts' && (
        <div key="payouts-section" className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-4 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                Gerenciar Saques
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest">
                Aprove ou rejeite solicitações de pagamento de comissões dos afiliados
              </p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[900px]">
                <thead className="bg-slate-100 dark:bg-slate-950 border-b dark:border-slate-800">
                  <tr>
                    <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest">Afiliado</th>
                    <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Dados Pix</th>
                    <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Valor</th>
                    <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Data</th>
                    <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paymentRequests.filter(r => r.status === 'pending').map(req => {
                    const affiliate = users.find(u => u.id === req.affiliateId);
                    return (
                      <tr key={req.id} className="hover:bg-white dark:hover:bg-slate-800 transition-all">
                        <td className="px-10 py-6">
                          <p className="font-black text-xs uppercase text-slate-900 dark:text-white">{req.affiliateName || affiliate?.name || 'DESCONHECIDO'}</p>
                          <p className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest">{affiliate?.email}</p>
                        </td>
                        <td className="px-10 py-6 text-center">
                          <div className="flex flex-col items-center bg-slate-100 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                            <p className="text-[10px] font-black uppercase text-slate-900 dark:text-white leading-none mb-1.5">{req.pixName || affiliate?.pixName || '---'}</p>
                            <p className="text-[11px] font-black text-indigo-600 uppercase tracking-widest bg-white dark:bg-slate-900 px-3 py-1 rounded-lg shadow-sm border border-indigo-100 dark:border-indigo-900/30">
                              {req.pixKey || affiliate?.pixKey || '---'}
                            </p>
                          </div>
                        </td>
                        <td className="px-10 py-6 text-center">
                          <p className="text-lg font-black text-emerald-600 italic">R$ {req.amount.toFixed(2)}</p>
                        </td>
                        <td className="px-10 py-6 text-center text-[10px] font-bold text-slate-400">
                          {new Date(req.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-10 py-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => handleRejectPayout(req.id)}
                              className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-[8px] font-black uppercase hover:bg-rose-100 transition-colors"
                            >
                              Rejeitar
                            </button>
                            <button 
                              onClick={() => handleConfirmPayout(req)}
                              className="bg-emerald-500 text-white px-6 py-2 rounded-xl text-[8px] font-black uppercase shadow-md hover:brightness-110 transition-all"
                            >
                              Confirmar Pagamento
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paymentRequests.filter(r => r.status === 'pending').length === 0 && (
                    <tr><td colSpan={4} className="py-24 text-center opacity-30 font-black uppercase text-[10px] italic">Nenhuma solicitação de saque pendente</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {(!isMaster || mainTab === 'vision') && (
        <div key="vision-section">
          {isMaster && !selectedAffiliateId ? (
            <div className="bg-white dark:bg-slate-900 p-12 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 text-center animate-in fade-in zoom-in duration-500">
              <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="w-12 h-12 text-slate-300" />
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white mb-2">Nenhum Afiliado Selecionado</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-xs mx-auto">
                Por favor, selecione um parceiro na aba de <strong>Gerenciamento</strong> para visualizar suas métricas detalhadas.
              </p>
              <button 
                onClick={() => setMainTab('manage')}
                className="mt-8 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-105 transition-all"
              >
                Ir para Gerenciamento
              </button>
            </div>
          ) : (
            <>
              {isMaster && selectedAffiliateId && (
            <div className="mb-8 p-8 bg-indigo-600 rounded-[3rem] shadow-xl shadow-indigo-200 dark:shadow-none flex items-center justify-between text-white animate-in slide-in-from-top-4">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-3xl font-black italic">
                  {users.find(u => u.id === selectedAffiliateId)?.name.charAt(0)}
                </div>
                <div>
                  <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest opacity-80">Painel de Controle do Afiliado:</p>
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter leading-none mt-1">
                    {users.find(u => u.id === selectedAffiliateId)?.name}
                  </h3>
                </div>
              </div>
              {isMaster && selectedAffiliateId && (
                <button 
                  onClick={() => {
                    setSelectedAffiliateId('');
                    setMainTab('manage');
                    setActiveTab('vendas');
                  }}
                  className="bg-white text-indigo-600 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-105 transition-all"
                >
                  ← Voltar para Gestão
                </button>
              )}
            </div>
          )}

          {/* Header & Stats */}
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
              <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                  {isMaster ? 'Visão Detalhada' : 'Minha Área de Afiliado'}
                </h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest">
                  {isMaster 
                    ? `Acompanhando métricas de: ${!selectedAffiliateId ? 'NENHUM SELECIONADO' : users.find(u => u.id === selectedAffiliateId)?.name.toUpperCase()}` 
                    : 'Acompanhe suas vendas e comissões'}
                </p>
              </div>
              
              {!isMaster && (
                <button 
                  onClick={() => setIsNewRequestModalOpen(true)}
                  className="bg-slate-950 dark:bg-white dark:text-slate-950 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:scale-105 transition-all"
                >
                  + Nova Solicitação de Cliente
                </button>
              )}
            </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Acessos Demo</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white italic">{currentAffiliateStats.demoViews} {currentAffiliateStats.demoViews === 1 ? 'Acesso' : 'Acessos'}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Vendas Totais</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white italic">{currentAffiliateStats.totalSales} {currentAffiliateStats.totalSales === 1 ? 'Venda' : 'Vendas'}</p>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/30">
            <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Comissão Acumulada</p>
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 italic">R$ {currentAffiliateStats.totalCommission.toFixed(2)}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/30">
            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Saldo Disponível</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 italic">
              R$ {Math.max(0, currentAffiliateStats.totalCommission - currentAffiliateStats.paidPayout - currentAffiliateStats.pendingPayout).toFixed(2)}
            </p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-3xl border border-amber-100 dark:border-amber-900/30">
            <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1">Saque Pendente</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 italic">R$ {currentAffiliateStats.pendingPayout.toFixed(2)}</p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pagamentos Recebidos</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white italic">R$ {currentAffiliateStats.paidPayout.toFixed(2)}</p>
          </div>
        </div>
        
        {!isMaster && (
          <div className="mt-6 flex justify-end">
            {(() => {
              const lastRequest = paymentRequests
                .filter(r => r.affiliateId === currentUser.id && r.status !== 'rejected')
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
              
              if (lastRequest) {
                const lastDate = lastRequest.status === 'paid' && lastRequest.paidAt 
                  ? new Date(lastRequest.paidAt) 
                  : new Date(lastRequest.createdAt);
                const now = new Date();
                const diffTime = now.getTime() - lastDate.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays < 30 || lastRequest.status === 'pending') {
                  const remainingDays = 30 - diffDays;
                  return (
                    <button 
                      disabled
                      className="bg-slate-200 dark:bg-slate-800 text-slate-400 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest cursor-not-allowed"
                    >
                      {lastRequest.status === 'pending' 
                        ? 'Saque em Análise...' 
                        : `Próximo Saque em ${remainingDays} ${remainingDays === 1 ? 'dia' : 'dias'}`}
                    </button>
                  );
                }
              }
              
              return (
                <button 
                  onClick={() => setActiveTab('pagamento')}
                  className="bg-emerald-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md hover:brightness-110 active:scale-95 transition-all"
                >
                  Solicitar Saque de Comissão
                </button>
              );
            })()}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex justify-center">
        <div className="bg-slate-200/60 dark:bg-slate-800/60 p-1.5 rounded-full flex flex-wrap justify-center gap-1 shadow-inner border border-slate-300/30 dark:border-slate-700/30">
          <button 
            onClick={() => setActiveTab('vendas')}
            className={`tab-btn px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'vendas' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Vendas
          </button>
          <button 
            onClick={() => setActiveTab('comissoes')}
            className={`tab-btn px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'comissoes' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Histórico de Comissões
          </button>
          <button 
            onClick={() => setActiveTab('solicitacoes')}
            className={`tab-btn px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'solicitacoes' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Histórico de Saques
          </button>
          <button 
            onClick={() => setActiveTab('clientes')}
            className={`tab-btn px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'clientes' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' : 'text-slate-600 dark:text-slate-400'} flex items-center gap-2 relative`}
          >
            Contas
            {isMaster && filteredAccessRequests.some(r => r.status === 'pending') && (
              <span className="bg-rose-500 text-white min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[8px] font-black animate-pulse shadow-lg shadow-rose-500/20 border-2 border-white dark:border-slate-700">
                {filteredAccessRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('demo')}
            className={`tab-btn px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'demo' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Demo View
          </button>
          {!isMaster && (
            <button 
              onClick={() => setActiveTab('pagamento')}
              className={`tab-btn px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'pagamento' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Configuração de Pagamento
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        {activeTab === 'vendas' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800">
                <tr>
                  <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                  <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Valor da Venda</th>
                  <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCommissions.length === 0 ? (
                  <tr><td colSpan={4} className="py-24 text-center opacity-30 font-black uppercase text-[10px] italic">Nenhuma venda registrada</td></tr>
                ) : (
                  filteredCommissions.map(comm => (
                    <tr key={comm.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-10 py-6 text-[10px] font-bold text-slate-500">{new Date(comm.createdAt).toLocaleDateString('pt-BR')}</td>
                      <td className="px-10 py-6">
                        <p className="font-black text-xs uppercase text-slate-900 dark:text-white">{comm.customerName}</p>
                        {isMaster && (
                          <p className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest">Afiliado: {users.find(u => u.id === comm.affiliateId)?.name || '---'}</p>
                        )}
                      </td>
                      <td className="px-10 py-6 text-center font-black text-xs text-slate-700 dark:text-slate-200">R$ {comm.sellingPrice.toFixed(2)}</td>
                      <td className="px-10 py-6 text-right">
                        <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                          comm.status === 'rejected' ? 'bg-rose-100 text-rose-600' :
                          comm.customerId ? 'bg-emerald-100 text-emerald-600' : 
                          'bg-amber-100 text-amber-600'
                        }`}>
                          {comm.status === 'rejected' ? 'REJEITADA' : 
                           comm.customerId ? 'APROVADA' : 
                           'AGUARDANDO APROVAÇÃO'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'comissoes' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800">
                <tr>
                  <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                  <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                  <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Comissão</th>
                  <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCommissions.length === 0 ? (
                  <tr><td colSpan={4} className="py-24 text-center opacity-30 font-black uppercase text-[10px] italic">Nenhuma comissão registrada</td></tr>
                ) : (
                  filteredCommissions.map(comm => (
                    <tr key={comm.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-10 py-6 text-[10px] font-bold text-slate-500">{new Date(comm.createdAt).toLocaleDateString('pt-BR')}</td>
                      <td className="px-10 py-6 font-black text-xs uppercase text-slate-900 dark:text-white">{comm.customerName}</td>
                      <td className="px-10 py-6 text-center font-black text-xs text-emerald-600">R$ {comm.commissionAmount.toFixed(2)}</td>
                      <td className="px-10 py-6 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                            comm.status === 'rejected' ? 'bg-rose-100 text-rose-600' :
                            comm.customerId ? 'bg-emerald-100 text-emerald-600' : 
                            'bg-amber-100 text-amber-600'
                          }`}>
                            {comm.status === 'rejected' ? 'SALE: REJEITADA' :
                             comm.customerId ? 'SALE: APROVADA' : 
                             'SALE: PENDENTE'}
                          </span>
                          <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                            comm.status === 'paid' ? 'bg-indigo-100 text-indigo-600' : 
                            comm.status === 'rejected' ? 'bg-rose-50 text-rose-400' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {comm.status === 'paid' ? 'PAGAMENTO: PAGO' : 
                             comm.status === 'rejected' ? 'PAGAMENTO: CANCELADO' :
                             'PAGAMENTO: PENDENTE'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'solicitacoes' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[800px]">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800">
                <tr>
                  <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                  <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Valor</th>
                  <th className="px-10 py-7 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPaymentRequests.length === 0 ? (
                  <tr><td colSpan={3} className="py-24 text-center opacity-30 font-black uppercase text-[10px] italic">Nenhuma solicitação de saque</td></tr>
                ) : (
                  filteredPaymentRequests.map(req => (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition-all">
                      <td className="px-10 py-6 text-[10px] font-bold text-slate-500">{new Date(req.createdAt).toLocaleDateString('pt-BR')}</td>
                      <td className="px-10 py-6 text-center font-black text-xs text-slate-700 dark:text-slate-200">R$ {req.amount.toFixed(2)}</td>
                      <td className="px-10 py-6 text-right">
                        <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${
                          req.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 
                          req.status === 'rejected' ? 'bg-rose-100 text-rose-600' : 
                          'bg-amber-100 text-amber-600'
                        }`}>
                          {req.status === 'paid' ? 'PAGO' : req.status === 'rejected' ? 'REJEITADO' : 'PENDENTE'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'clientes' ? (
          <div className="p-4 md:p-8 space-y-4">
            <div className="p-8 border-b dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 rounded-t-[2rem] flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">Clientes do Afiliado</h3>
                  {isMaster && filteredAccessRequests.some(r => r.status === 'pending') && (
                    <div className="bg-rose-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest animate-pulse flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {filteredAccessRequests.filter(r => r.status === 'pending').length} {filteredAccessRequests.filter(r => r.status === 'pending').length === 1 ? 'SOLICITAÇÃO PENDENTE' : 'SOLICITAÇÕES PENDENTES'}
                    </div>
                  )}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lista de clientes vinculados a este parceiro</p>
              </div>
            </div>

            {/* Header - Hidden on small screens */}
            <div className="hidden lg:grid lg:grid-cols-[2fr_1fr_1fr_1.5fr_1fr_1.5fr] gap-4 px-10 py-4 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Plano</div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Preço</div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Pagamento</div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</div>
            </div>

            {/* Rows */}
            <div className="space-y-3">
              {affiliateClients.map(client => {
                const today = new Date();
                const expiry = client.expiresAt ? new Date(client.expiresAt) : null;
                const isExpired = expiry && today > expiry;
                
                return (
                  <div key={client.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 hover:shadow-lg transition-all grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1.5fr_1fr_1.5fr] gap-6 items-center">
                    {/* Name & WhatsApp */}
                    <div className="flex flex-col min-w-0">
                      <p className="font-black text-xs uppercase text-slate-900 dark:text-white truncate" title={client.name}>{client.name}</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase">{client.whatsapp}</p>
                      {isMaster && (
                        <p className="text-[7px] font-bold text-indigo-500 uppercase mt-1">Afiliado: {users.find(aff => aff && aff.id === (client.isRequest ? client.request?.affiliateId : client.user?.affiliateId))?.name || '---'}</p>
                      )}
                    </div>

                    {/* Plan */}
                    <div className="text-center">
                      <span className="lg:hidden text-[8px] font-black text-slate-400 uppercase block mb-1">Plano</span>
                      <p className="font-black text-[10px] uppercase text-slate-700 dark:text-slate-200 truncate">{client.planName || '---'}</p>
                    </div>

                    {/* Price */}
                    <div className="text-center">
                      <span className="lg:hidden text-[8px] font-black text-slate-400 uppercase block mb-1">Preço</span>
                      <p className="font-black text-xs text-emerald-600">R$ {client.sellingPrice?.toFixed(2) || '0.00'}</p>
                    </div>

                    {/* Payment */}
                    <div className="flex flex-col items-center gap-1">
                      <span className="lg:hidden text-[8px] font-black text-slate-400 uppercase block mb-1">Pagamento</span>
                      {client.paymentType === 'automatic' ? (
                        <span className="px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-600">
                          ✅ Pix Automático
                        </span>
                      ) : client.paymentType === 'manual' ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${client.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {client.status === 'pending' ? '⏳ Pix Manual' : '✅ Pix Manual'}
                          </span>
                          {client.pixReceipt && (
                            <button 
                              onClick={() => handleViewReceipt(client.pixReceipt!, client.id)}
                              className="text-[7px] font-black uppercase text-indigo-600 hover:underline"
                            >
                              Ver Comprovante
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[8px] font-bold text-slate-400 uppercase">---</span>
                      )}
                    </div>

                    {/* Status */}
                    <div className="text-center">
                      <span className="lg:hidden text-[8px] font-black text-slate-400 uppercase block mb-1">Status</span>
                      {client.status === 'pending' ? (
                        <span className="px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-amber-100 text-amber-600">
                          PENDENTE
                        </span>
                      ) : (() => {
                        const grace = appSettings?.defaultGracePeriod ?? 10;

                        let statusLabel = 'ATIVO';
                        let statusColor = 'bg-emerald-100 text-emerald-600';

                        if (!client.active) {
                          if (client.user?.deactivatedMessage?.includes('banida')) {
                            statusLabel = 'BANIDO';
                            statusColor = 'bg-rose-100 text-rose-600';
                          } else {
                            statusLabel = 'SUSPENSO';
                            statusColor = 'bg-amber-100 text-amber-600';
                          }
                        } else if (client.expiresAt) {
                          if (checkExpired(client.expiresAt, grace)) {
                            statusLabel = 'EXPIRADO';
                            statusColor = 'bg-rose-100 text-rose-600';
                          } else if (isWithinGracePeriod(client.expiresAt, grace)) {
                            statusLabel = 'CARÊNCIA';
                            statusColor = 'bg-orange-100 text-orange-600';
                          }
                        }

                        return (
                          <div className="flex flex-col items-center gap-1">
                            <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${statusColor}`}>
                              {statusLabel}
                            </span>
                            {client.expiresAt && (
                              <span className="text-[7px] font-bold text-slate-400 uppercase">
                                Exp: {formatDisplayDate(client.expiresAt)}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end">
                      {(isMaster || (!isMaster && currentUser.id === client.user.affiliateId)) && (
                        <div className="flex items-center justify-end gap-1 md:gap-2 shrink-0 whitespace-nowrap">
                          {!client.isRequest && (
                            <>
                              <button 
                                onClick={() => handleEditClient(client.user)}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shrink-0"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => openConfirmModal({
                                  title: client.active ? 'Suspender Cliente' : 'Ativar Cliente',
                                  message: client.active ? 'Tem certeza que deseja suspender esta conta?' : `Tem certeza que deseja ativar o acesso de ${client.name}?`,
                                  onConfirm: () => handleToggleClientActive(client.id, !client.active, client.active ? 'Suspender' : 'Ativar'),
                                  type: client.active ? 'warning' : 'success'
                                })}
                                className={`p-2 rounded-lg transition-colors shrink-0 ${client.active ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                title={client.active ? 'Suspender' : 'Ativar'}
                              >
                                {client.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </button>
                              <button 
                                onClick={() => openConfirmModal({
                                  title: 'Banir Cliente',
                                  message: 'Tem certeza que deseja banir esta conta?',
                                  onConfirm: () => handleToggleClientActive(client.id, false, 'Banir'),
                                  type: 'danger',
                                  confirmText: 'Banir Agora'
                                })}
                                className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                                title="Banir"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => openConfirmModal({
                                  title: 'Deletar Conta',
                                  message: 'Tem certeza que deseja deletar esta conta? Esta ação não poderá ser desfeita.',
                                  onConfirm: () => handleDeleteClient(client.id),
                                  type: 'danger',
                                  confirmText: 'Excluir Permanentemente'
                                })}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-100 dark:border-red-900/30 shrink-0"
                                title="Deletar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                           {isMaster && client.isRequest && (
                            <div className="flex flex-col items-end gap-2">
                              {!viewedReceipts.has(client.id) && (
                                <p className="text-[7px] font-bold text-rose-500 uppercase animate-pulse">Visualize o comprovante para liberar as ações</p>
                              )}
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => openConfirmModal({
                                    title: 'Rejeitar Solicitação',
                                    message: `Deseja rejeitar a solicitação de acesso de ${client.name}?`,
                                    onConfirm: () => handleRejectAccessRequest(client.id),
                                    type: 'danger',
                                    confirmText: 'Rejeitar'
                                  })}
                                  disabled={!viewedReceipts.has(client.id)}
                                  className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-colors flex items-center gap-1 ${
                                    viewedReceipts.has(client.id) 
                                      ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' 
                                      : 'bg-slate-100 text-slate-300 cursor-not-allowed opacity-50'
                                  }`}
                                >
                                  <X className="w-3 h-3" />
                                  Rejeitar
                                </button>
                                <button 
                                  onClick={() => openConfirmModal({
                                    title: 'Aprovar Solicitação',
                                    message: (
                                      <div className="space-y-4 text-left">
                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Deseja aprovar a solicitação de acesso de <strong>{client.name}</strong>?</p>
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-2">
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalhes da Solicitação:</p>
                                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">Documento: {client.request.document}</p>
                                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">WhatsApp: {client.request.whatsapp}</p>
                                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">Plano: {client.planName} — R$ {plans.find(p => p.name === client.planName)?.price.toFixed(2) || '0.00'}</p>
                                          <p className="text-xs font-bold text-emerald-600 uppercase">Preço de Venda: R$ {client.sellingPrice?.toFixed(2)}</p>
                                        </div>
                                      </div>
                                    ),
                                    onConfirm: () => handleApproveAccessRequest(client.id),
                                    type: 'success',
                                    confirmText: 'Aprovar'
                                  })}
                                  disabled={!viewedReceipts.has(client.id)}
                                  className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase shadow-md transition-all flex items-center gap-1 ${
                                    viewedReceipts.has(client.id)
                                      ? 'bg-emerald-500 text-white hover:brightness-110'
                                      : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none opacity-50'
                                  }`}
                                >
                                  <Check className="w-3 h-3" />
                                  Aprovar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {affiliateClients.length === 0 && (
              <div className="py-24 text-center opacity-30 font-black uppercase text-[10px] italic bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800">
                Você ainda não possui clientes vinculados
              </div>
            )}
          </div>
        ) : activeTab === 'demo' ? (
          <div className="p-12 text-center max-w-2xl mx-auto">
            <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-8">
              <svg className="w-12 h-12 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h3 className="text-2xl font-black uppercase italic text-slate-900 dark:text-white mb-4">Gerador de Link de Demonstração</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-10 leading-relaxed">
              Gere um link exclusivo de demonstração para enviar aos seus clientes. 
              Eles poderão navegar por todo o sistema com dados fictícios, mas não poderão salvar ou alterar nenhuma informação.
              <br /><br />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Link Direto: <span className="text-indigo-500 select-all">{window.location.origin}/demo.html?affiliateId={currentUser.id}</span>
              </span>
            </p>
            
            <div className="relative inline-block">
              <button 
                onClick={handleCopyDemoLink}
                className="bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center gap-3 mx-auto"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Gerar Link de Demonstração
              </button>
              
              {copySuccess && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg animate-in fade-in slide-in-from-top-2 whitespace-nowrap">
                  Link copiado com sucesso!
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'pagamento' ? (
          <div className="p-8 md:p-12 animate-in fade-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Coluna Esquerda: Solicitação de Saque */}
              <div className="space-y-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">Solicitação de Saque</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Retire suas comissões acumuladas</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-xl space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Valor do Saque (R$)</label>
                    <input 
                      type="number"
                      value={withdrawalAmount}
                      onChange={e => {
                        setWithdrawalAmount(e.target.value);
                        const val = parseFloat(e.target.value);
                        const available = currentAffiliateStats.totalCommission - currentAffiliateStats.paidPayout - currentAffiliateStats.pendingPayout;
                        
                        if (available <= 0) {
                          setFormErrors(prev => ({...prev, withdrawal: 'Você não possui comissão acumulada no momento. Aguarde novas vendas para solicitar saque.'}));
                        } else if (val > available) {
                          setFormErrors(prev => ({...prev, withdrawal: 'O valor solicitado é maior que sua comissão disponível.'}));
                        } else {
                          setFormErrors(prev => {
                            const newErrors = {...prev};
                            delete newErrors.withdrawal;
                            return newErrors;
                          });
                        }
                      }}
                      placeholder="0.00"
                      className={`w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl font-black text-lg outline-none focus:ring-2 shadow-inner ${formErrors.withdrawal ? 'ring-2 ring-rose-500' : 'focus:ring-emerald-500'}`}
                    />
                    {formErrors.withdrawal && (
                      <p className="text-[9px] font-black text-rose-500 uppercase ml-2 mt-1">{formErrors.withdrawal}</p>
                    )}
                    <div className="flex justify-between items-center px-2">
                       <p className="text-[9px] font-bold text-slate-400 uppercase">Saldo Disponível: <span className="text-emerald-600">R$ {Math.max(0, currentAffiliateStats.totalCommission - currentAffiliateStats.paidPayout - currentAffiliateStats.pendingPayout).toFixed(2)}</span></p>
                       <button 
                        onClick={() => {
                          const balance = Math.max(0, currentAffiliateStats.totalCommission - currentAffiliateStats.paidPayout - currentAffiliateStats.pendingPayout);
                          setWithdrawalAmount(balance.toFixed(2));
                          setFormErrors(prev => {
                            const newErrors = {...prev};
                            delete newErrors.withdrawal;
                            return newErrors;
                          });
                        }}
                        className="text-[9px] font-black text-indigo-600 uppercase hover:underline"
                       >
                        Usar Tudo
                       </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Selecionar Chave Pix</label>
                    <select 
                      value={selectedPixKeyId}
                      onChange={e => setSelectedPixKeyId(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl font-black text-xs outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner appearance-none cursor-pointer"
                    >
                      <option value="">SELECIONE UMA CHAVE...</option>
                      {pixKeys.map(key => (
                        <option key={key.id} value={key.id}>{key.label.toUpperCase()} — {key.key}</option>
                      ))}
                    </select>
                    {pixKeys.length === 0 && (
                      <p className="text-[8px] font-bold text-rose-500 uppercase ml-2 italic">Você precisa cadastrar uma chave Pix ao lado primeiro.</p>
                    )}
                  </div>

                  <button 
                    onClick={async () => {
                      const available = currentAffiliateStats.totalCommission - currentAffiliateStats.paidPayout - currentAffiliateStats.pendingPayout;
                      
                      if (available <= 0) {
                        setFormErrors(prev => ({...prev, withdrawal: 'Você não possui comissão acumulada no momento. Aguarde novas vendas para solicitar saque.'}));
                        return;
                      }

                      const amount = parseFloat(withdrawalAmount);
                      
                      if (!selectedPixKeyId) return alert("Selecione uma chave Pix para o recebimento.");
                      if (isNaN(amount) || amount <= 0) return alert("Informe um valor válido.");
                      
                      if (amount > available) {
                        setFormErrors(prev => ({...prev, withdrawal: 'O valor solicitado é maior que sua comissão disponível.'}));
                        return;
                      }

                      const selectedKey = pixKeys.find(k => k.id === selectedPixKeyId);
                      if (!selectedKey) return;

                      // Regra de 30 dias
                      const lastRequest = paymentRequests
                        .filter(r => r.affiliateId === currentUser.id && r.status !== 'rejected')
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

                      if (lastRequest) {
                        if (lastRequest.status === 'pending') {
                          return alert("Você já possui uma solicitação de saque em análise.");
                        }
                        
                        const lastDate = lastRequest.status === 'paid' && lastRequest.paidAt 
                          ? new Date(lastRequest.paidAt) 
                          : new Date(lastRequest.createdAt);
                        
                        const diffDays = Math.floor((new Date().getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                        if (diffDays < 30) return alert(`Aguarde ${30 - diffDays} dias para o próximo saque.`);
                      }

                      openConfirmModal({
                        title: 'Confirmar Solicitação de Saque',
                        message: (
                          <div className="space-y-6">
                            <div className="bg-rose-50 dark:bg-rose-900/20 p-6 rounded-3xl border-2 border-rose-100 dark:border-rose-900/30">
                              <div className="flex items-center gap-3 mb-3 justify-center">
                                <AlertTriangle className="w-6 h-6 text-rose-600 animate-pulse" />
                                <h4 className="text-rose-600 font-black uppercase italic tracking-widest text-sm">Aviso Importante</h4>
                              </div>
                              <p className="text-rose-700 dark:text-rose-400 font-black text-base leading-tight uppercase italic">
                                "ATENÇÃO: Após solicitar um saque, você só poderá solicitar outro saque após 30 dias."
                              </p>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">
                              Deseja solicitar o saque de <span className="text-emerald-600 font-black">R$ {amount.toFixed(2)}</span> para a chave <span className="text-slate-900 dark:text-white font-black">{selectedKey.key}</span>?
                            </p>
                          </div>
                        ),
                        type: 'success',
                        countdown: 5,
                        confirmText: 'Confirmar Saque',
                        onConfirm: async () => {
                          const newReq: AffiliatePaymentRequest = {
                            id: 'pay-' + Math.random().toString(36).substr(2, 9),
                            affiliateId: currentUser.id,
                            affiliateName: currentUser.name,
                            amount: amount,
                            status: 'pending',
                            createdAt: new Date().toISOString(),
                            pixName: currentUser.name,
                            pixKey: selectedKey.key
                          };
                          const allReqs = await getAffiliatePaymentRequests();
                          await saveAffiliatePaymentRequest(newReq);
                          refreshData();
                          setWithdrawalAmount('');
                          setShowWithdrawalSuccess(true);
                        }
                      });
                    }}
                    disabled={!!formErrors.withdrawal}
                    className={`w-full py-5 rounded-2xl font-black uppercase text-xs shadow-xl transition-all flex items-center justify-center gap-2 ${formErrors.withdrawal ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:scale-[1.02] active:scale-95'}`}
                  >
                    Solicitar Saque Agora
                  </button>
                </div>
              </div>

              {/* Coluna Direita: Configuração de Chaves Pix */}
              <div className="space-y-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">Chaves Pix</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">Gerencie até 3 chaves para recebimento</p>
                    </div>
                  </div>
                  {pixKeys.length < 3 && (
                    <button 
                      onClick={() => {
                        setEditingPixKey(null);
                        setPixKeyFormData({ type: 'CPF', key: '', label: '' });
                        setIsPixKeyModalOpen(true);
                      }}
                      className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:scale-110 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {pixKeys.map(key => (
                    <div key={key.id} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-md flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center justify-center text-[10px] font-black text-slate-400">
                          {key.type}
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-900 dark:text-white leading-none mb-1">{key.label}</p>
                          <p className="text-[9px] font-bold text-slate-400 tracking-widest">{key.key}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingPixKey(key);
                            // Aplicar formatação se for CPF ou CNPJ ao abrir para edição
                            let displayKey = key.key;
                            if (key.type === 'CPF' || key.type === 'CNPJ') {
                              displayKey = formatCPF_CNPJ(key.key);
                            }
                            setPixKeyFormData({ type: key.type, key: displayKey, label: key.label });
                            setIsPixKeyModalOpen(true);
                          }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeletePixKey(key.id)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {pixKeys.length === 0 && (
                    <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/50 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-700">
                      <p className="text-[10px] font-black text-slate-400 uppercase italic">Nenhuma chave cadastrada</p>
                      <button 
                        onClick={() => setIsPixKeyModalOpen(true)}
                        className="mt-4 text-[10px] font-black text-indigo-600 uppercase hover:underline"
                      >
                        + Adicionar Primeira Chave
                      </button>
                    </div>
                  )}
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-2xl border border-amber-100 dark:border-amber-900/20 flex gap-4">
                  <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
                  <p className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase leading-relaxed">
                    Certifique-se de que a chave Pix informada está correta. Pagamentos realizados para chaves incorretas não poderão ser estornados.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal de Cadastro/Edição de Chave Pix */}
            {isPixKeyModalOpen && (
              <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in">
                <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 border border-white/5">
                  <div className="p-8 border-b bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">
                        {editingPixKey ? 'Editar Chave Pix' : 'Nova Chave Pix'}
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Configure seus dados de recebimento</p>
                    </div>
                    <button onClick={() => setIsPixKeyModalOpen(false)} className="p-3 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-90">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="p-8 space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Identificação (Ex: Meu CPF, Pix Nubank)</label>
                      <input 
                        placeholder="NOME DA CHAVE" 
                        value={pixKeyFormData.label} 
                        onChange={e => setPixKeyFormData({...pixKeyFormData, label: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Tipo de Chave</label>
                        <select 
                          value={pixKeyFormData.type}
                          onChange={e => setPixKeyFormData({...pixKeyFormData, type: e.target.value, key: ''})}
                          className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-bold text-sm outline-none cursor-pointer"
                        >
                          <option value="CPF">CPF</option>
                          <option value="CNPJ">CNPJ</option>
                          <option value="E-MAIL">E-MAIL</option>
                          <option value="TELEFONE">TELEFONE</option>
                          <option value="ALEATÓRIA">ALEATÓRIA</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Chave Pix</label>
                        <input 
                          placeholder="CHAVE PIX" 
                          value={pixKeyFormData.key} 
                          onChange={e => {
                            let val = e.target.value;
                            if (pixKeyFormData.type === 'CPF' || pixKeyFormData.type === 'CNPJ') {
                              val = formatCPF_CNPJ(val);
                            }
                            setPixKeyFormData({...pixKeyFormData, key: val});
                          }}
                          className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={handleSavePixKey}
                      disabled={isSavingPix}
                      className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {isSavingPix ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                      {editingPixKey ? 'Atualizar Chave' : 'Salvar Chave'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : null}
            </div>
          </>
        )}
      </div>
    )}

      {/* Modal Clientes do Afiliado */}
      {isAffiliateCustomersModalOpen && viewingAffiliate && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 border border-white/5 max-h-[90vh] flex flex-col">
            <div className="p-8 border-b bg-slate-50 dark:bg-slate-950 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">Clientes de {viewingAffiliate.name}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 tracking-widest">Gestão de Carteira do Afiliado</p>
              </div>
              <button onClick={() => setIsAffiliateCustomersModalOpen(false)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-90"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} /></svg></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-slate-950 border-b dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Plano</th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Preço</th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Cadastro</th>
                      <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Pagamentos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.filter(u => u.affiliateId === viewingAffiliate.id).map(u => {
                      const today = new Date();
                      const expiry = u.expiresAt ? new Date(u.expiresAt) : null;
                      const isExpired = expiry && today > expiry;
                      const userPayments = paymentRequestsGlobal.filter(p => p.userId === u.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                      
                      return (
                        <tr key={u.id} className="hover:bg-white dark:hover:bg-slate-800 transition-all">
                          <td className="px-6 py-4">
                            <p className="font-black text-xs uppercase text-slate-900 dark:text-white">{u.name}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase">{u.whatsapp}</p>
                          </td>
                          <td className="px-6 py-4 text-center font-black text-[10px] text-slate-700 dark:text-slate-200 uppercase">{u.planName || '---'}</td>
                          <td className="px-6 py-4 text-center font-black text-xs text-emerald-600">R$ {u.sellingPrice?.toFixed(2) || '0.00'}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest ${checkExpired(u.expiresAt || '') ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                              {checkExpired(u.expiresAt || '') ? 'EXPIRADO' : 'ATIVO'}
                            </span>
                            {u.expiresAt && (
                              <p className="text-[6px] font-bold text-slate-400 uppercase mt-1">{formatDisplayDate(u.expiresAt)}</p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center text-[9px] font-bold text-slate-400">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '---'}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex flex-col items-end gap-1">
                              {userPayments.slice(0, 2).map(p => (
                                <div key={p.id} className="flex items-center gap-1">
                                  <span className="text-[7px] font-bold text-slate-400">{new Date(p.createdAt).toLocaleDateString('pt-BR')}</span>
                                  <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'approved' ? 'bg-emerald-500' : p.status === 'rejected' ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                                </div>
                              ))}
                              {userPayments.length === 0 && <span className="text-[7px] font-bold text-slate-300 uppercase italic">Sem histórico</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {users.filter(u => u.affiliateId === viewingAffiliate.id).length === 0 && (
                      <tr><td colSpan={6} className="py-12 text-center opacity-30 font-black uppercase text-[9px] italic">Nenhum cliente vinculado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="p-8 border-t bg-slate-50 dark:bg-slate-950 shrink-0">
              <button onClick={() => setIsAffiliateCustomersModalOpen(false)} className="w-full py-4 bg-slate-900 dark:bg-white dark:text-slate-950 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">Fechar Janela</button>
            </div>
          </div>
        </div>
      )}
      {isNewRequestModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 border border-white/5">
            <div className="p-8 border-b bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">Nova Solicitação de Cliente</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Preencha os dados do novo cliente</p>
              </div>
              <button onClick={() => setIsNewRequestModalOpen(false)} className="p-3 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100 dark:border-slate-700 transition-all active:scale-90">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} /></svg>
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nome Completo *</label>
                  <input 
                    placeholder="NOME COMPLETO" 
                    value={newRequestData.name} 
                    onChange={e => {
                      const val = e.target.value.toUpperCase();
                      setNewRequestData({...newRequestData, name: val});
                      validateField('name', val);
                    }}
                    className={`w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 ${formErrors.name ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`}
                  />
                  {formErrors.name && <p className="text-[9px] font-black text-rose-500 uppercase ml-2 mt-1">{formErrors.name}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">CPF ou CNPJ *</label>
                  <input 
                    placeholder="000.000.000-00 ou 00.000.000/0000-00" 
                    value={newRequestData.document} 
                    onChange={e => {
                      const val = formatCPF_CNPJ(e.target.value);
                      setNewRequestData({...newRequestData, document: val});
                      validateField('document', val);
                    }}
                    className={`w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 ${formErrors.document ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`}
                  />
                  {formErrors.document && <p className="text-[9px] font-black text-rose-500 uppercase ml-2 mt-1">{formErrors.document}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">WhatsApp *</label>
                  <input 
                    placeholder="(00) 00000-0000" 
                    value={newRequestData.whatsapp} 
                    onChange={e => {
                      const val = formatWhatsApp(e.target.value);
                      setNewRequestData({...newRequestData, whatsapp: val});
                      validateField('whatsapp', val);
                    }}
                    className={`w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 ${formErrors.whatsapp ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`}
                  />
                  {formErrors.whatsapp && <p className="text-[9px] font-black text-rose-500 uppercase ml-2 mt-1">{formErrors.whatsapp}</p>}
                </div>
                <div className="space-y-1">
                  <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.login ? 'text-rose-600' : 'text-slate-400'}`}>Usuário (Login) *</label>
                  <input 
                    placeholder="usuario123" 
                    value={newRequestData.login} 
                    onChange={e => {
                      const val = e.target.value.toLowerCase();
                      setNewRequestData({...newRequestData, login: val});
                      validateField('login', val);
                    }}
                    className={`w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 ${formErrors.login ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`}
                  />
                  {formErrors.login && <p className="text-[9px] font-black text-rose-500 uppercase ml-2 mt-1">{formErrors.login}</p>}
                </div>

                <div className="space-y-1">
                  <label className={`text-[10px] font-black uppercase ml-2 ${formErrors.email ? 'text-rose-600' : 'text-slate-400'}`}>E-mail *</label>
                  <input 
                    placeholder="email@exemplo.com" 
                    value={newRequestData.email} 
                    onChange={e => {
                      const val = e.target.value.toLowerCase();
                      setNewRequestData({...newRequestData, email: val});
                      validateField('email', val);
                    }}
                    className={`w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 ${formErrors.email ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`}
                  />
                  {formErrors.email && <p className="text-[9px] font-black text-rose-500 uppercase ml-2 mt-1">{formErrors.email}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Senha Provisória *</label>
                  <input 
                    type="text"
                    placeholder="Senha de acesso" 
                    value={newRequestData.password} 
                    onChange={e => {
                      const val = e.target.value;
                      setNewRequestData({...newRequestData, password: val});
                      validateField('password', val);
                    }}
                    className={`w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 ${formErrors.password ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`}
                  />
                  {formErrors.password && <p className="text-[9px] font-black text-rose-500 uppercase ml-2 mt-1">{formErrors.password}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Plano *</label>
                  <select 
                    value={newRequestData.planName} 
                    onChange={e => {
                      const val = e.target.value;
                      setNewRequestData({
                        ...newRequestData, 
                        planName: val,
                        sellingPrice: 0 
                      });
                      validateField('planName', val);
                    }}
                    className={`w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-black text-[11px] uppercase outline-none focus:ring-2 ${formErrors.planName ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`}
                  >
                    <option value="">SELECIONE UM PLANO</option>
                    {filteredPlans.map(p => (
                      <option key={p.id} value={p.name}>
                        {p.name.toUpperCase()} — R$ {p.price.toFixed(2)}
                      </option>
                    ))}
                  </select>
                  {formErrors.planName && <p className="text-[9px] font-black text-rose-500 uppercase ml-2 mt-1">{formErrors.planName}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Preço de Venda (R$) *</label>
                  <input 
                    type="number"
                    placeholder="Ex: 75.00" 
                    value={newRequestData.sellingPrice || ''} 
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      setNewRequestData({...newRequestData, sellingPrice: val});
                      validateField('sellingPrice', val);
                    }}
                    className={`w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 dark:text-white border-none rounded-2xl font-black text-base outline-none focus:ring-2 ${formErrors.sellingPrice ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`}
                  />
                  {formErrors.sellingPrice && <p className="text-[9px] font-black text-rose-500 uppercase ml-2 mt-1">{formErrors.sellingPrice}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Afiliado Responsável</label>
                  <input 
                    type="text"
                    value={currentUser.name?.toUpperCase() || 'NÃO IDENTIFICADO'} 
                    disabled
                    className="w-full px-6 py-4 bg-slate-100 dark:bg-slate-950 dark:text-slate-500 border-none rounded-2xl font-bold text-sm outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Data de Cadastro</label>
                  <input 
                    type="text"
                    value={new Date().toLocaleDateString('pt-BR')} 
                    disabled
                    className="w-full px-6 py-4 bg-slate-100 dark:bg-slate-950 dark:text-slate-500 border-none rounded-2xl font-bold text-sm outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              {isFormValid && (
                <div className="space-y-6 pt-6 border-t dark:border-slate-800 animate-in fade-in slide-in-from-top-4">
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/30">
                    <h4 className="text-[11px] font-black uppercase italic text-indigo-600 dark:text-indigo-400 mb-4 tracking-widest">Seção de Pagamento</h4>
                    <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-6 uppercase">
                      Para enviar a solicitação é necessário realizar o pagamento de <span className="text-indigo-600 dark:text-indigo-400 font-black">R$ {(newRequestData.sellingPrice || 0).toFixed(2)}</span> referente ao plano escolhido.
                    </p>

                    <div className="flex gap-4 mb-6">
                      <button 
                        type="button"
                        onClick={() => setPaymentMethod('qr')}
                        className={`flex-1 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all ${paymentMethod === 'qr' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                      >
                        QR Code Pix
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPaymentMethod('manual')}
                        className={`flex-1 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all ${paymentMethod === 'manual' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                      >
                        Pix Manual
                      </button>
                    </div>

                    {paymentMethod === 'qr' && (
                      <div className="space-y-6 text-center animate-in fade-in zoom-in-95">
                        {!pixData ? (
                          <button 
                            type="button"
                            onClick={handleGeneratePix}
                            disabled={isGeneratingPix}
                            className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                          >
                            {isGeneratingPix ? 'Gerando QR Code...' : `Gerar QR Code Pix no valor de R$ ${(newRequestData.sellingPrice || 0).toFixed(2).replace('.', ',')}`}
                          </button>
                        ) : (
                          <div className="space-y-6">
                            <div className="bg-white p-4 rounded-3xl inline-block shadow-xl border-4 border-emerald-500">
                              <img src={pixData.qr_code_base64} alt="Pix QR Code" className="w-48 h-48" />
                            </div>
                            
                            <div className="space-y-3">
                              <button 
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(pixData.qr_code);
                                  alert("Código Pix copiado!");
                                }}
                                className="w-full py-3 bg-slate-900 dark:bg-white dark:text-slate-950 text-white rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" strokeWidth={2} /></svg>
                                Copiar Código Pix
                              </button>

                              <div className={`py-3 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2 ${paymentStatus === 'approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                <span className={`w-2 h-2 rounded-full ${paymentStatus === 'approved' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                                {paymentStatus === 'approved' ? 'Pagamento Confirmado!' : 'Aguardando Pagamento...'}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {paymentMethod === 'manual' && (
                      <div className="space-y-6 animate-in fade-in zoom-in-95">
                        <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-center">
                          <input 
                            type="file" 
                            id="receipt-upload" 
                            className="hidden" 
                            accept="image/*"
                            onChange={handleManualReceiptUpload}
                          />
                          <label htmlFor="receipt-upload" className="cursor-pointer space-y-3 block">
                            {manualReceipt ? (
                              <div className="relative group">
                                <img src={manualReceipt} alt="Comprovante" className="w-full h-32 object-cover rounded-xl" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                                  <span className="text-white text-[9px] font-black uppercase">Trocar Comprovante</span>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
                                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeWidth={2} /></svg>
                                </div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Anexar Comprovante Pix</p>
                              </>
                            )}
                          </label>
                        </div>
                        {manualReceipt && (
                          <div className="bg-emerald-100 text-emerald-600 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest flex items-center justify-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Comprovante Anexado!
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/30">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest">Sua Comissão Estimada:</span>
                      <span className="text-xl font-black text-indigo-700 dark:text-indigo-300 italic">
                        R$ {Math.max(0, newRequestData.sellingPrice - (plans.find(p => p.name === newRequestData.planName)?.price || 0)).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[8px] font-bold text-indigo-400 uppercase mt-2 italic">Base do Plano: R$ {(plans.find(p => p.name === newRequestData.planName)?.price || 0).toFixed(2)}</p>
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={!isFormValid || paymentStatus !== 'approved'}
                className={`w-full py-5 rounded-2xl font-black uppercase text-xs shadow-xl transition-all ${
                  !isFormValid || paymentStatus !== 'approved'
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white active:scale-95'
                }`}
              >
                Enviar Solicitação para Aprovação
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Cliente */}
      {isEditClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="bg-slate-50 dark:bg-slate-950 p-8 border-b dark:border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black uppercase italic text-slate-900 dark:text-white">Editar Cliente</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Gestão de Cliente Vinculado</p>
              </div>
              <button 
                onClick={() => setIsEditClientModalOpen(false)}
                className="p-3 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-2xl transition-all text-slate-400"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Users className="w-3 h-3" /> Nome Completo
                  </label>
                  <input 
                    type="text"
                    value={editClientData.name}
                    onChange={(e) => setEditClientData({...editClientData, name: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <FileText className="w-3 h-3" /> Documento (CPF/CNPJ)
                  </label>
                  <input 
                    type="text"
                    value={editClientData.document}
                    onChange={(e) => {
                      setEditClientData({...editClientData, document: e.target.value});
                      validateField('document', e.target.value);
                    }}
                    className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 transition-all ${formErrors.document ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`}
                    placeholder="000.000.000-00"
                  />
                  {formErrors.document && <p className="text-[8px] font-bold text-rose-500 ml-2 uppercase">{formErrors.document}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Search className="w-3 h-3" /> Email / Login
                  </label>
                  <input 
                    type="email"
                    value={editClientData.email}
                    onChange={(e) => {
                      setEditClientData({...editClientData, email: e.target.value});
                      validateField('email', e.target.value);
                    }}
                    className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 transition-all ${formErrors.email ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`}
                  />
                  {formErrors.email && <p className="text-[8px] font-bold text-rose-500 ml-2 uppercase">{formErrors.email}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Lock className="w-3 h-3" /> Senha
                  </label>
                  <div className="relative group">
                    <input 
                      type="text"
                      value={editClientData.password}
                      onChange={(e) => {
                        setEditClientData({...editClientData, password: e.target.value});
                        validateField('password', e.target.value);
                      }}
                      className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 transition-all ${formErrors.password ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`}
                      placeholder="senha de acesso"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Lock className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>
                  {formErrors.password && <p className="text-[8px] font-bold text-rose-500 ml-2 uppercase">{formErrors.password}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Plus className="w-3 h-3" /> WhatsApp
                  </label>
                  <input 
                    type="text"
                    value={editClientData.whatsapp}
                    onChange={(e) => {
                      const formatted = formatWhatsApp(e.target.value);
                      setEditClientData({...editClientData, whatsapp: formatted});
                      validateField('whatsapp', formatted);
                    }}
                    className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 transition-all ${formErrors.whatsapp ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`}
                  />
                  {formErrors.whatsapp && <p className="text-[8px] font-bold text-rose-500 ml-2 uppercase">{formErrors.whatsapp}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Filter className="w-3 h-3" /> Plano
                  </label>
                  <select 
                    value={editClientData.planName}
                    onChange={(e) => setEditClientData({...editClientData, planName: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    {filteredPlansForEdit.map(p => <option key={p.id} value={p.name}>{p.name} - R$ {p.price.toFixed(2)}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Vencimento
                  </label>
                  <input 
                    type="date"
                    value={editClientData.expiresAt}
                    onChange={(e) => setEditClientData({...editClientData, expiresAt: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <DollarSign className="w-3 h-3" /> Preço de Venda (R$)
                  </label>
                  <input 
                    type="number"
                    value={editClientData.sellingPrice}
                    onChange={(e) => setEditClientData({...editClientData, sellingPrice: Number(e.target.value)})}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  onClick={() => setIsEditClientModalOpen(false)}
                  className="flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveClientEdit}
                  className="flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-indigo-600 text-white shadow-xl hover:brightness-110 active:scale-95 transition-all"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação Genérico */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 border border-white/5">
            <div className="p-8 text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
                confirmModalConfig.type === 'danger' ? 'bg-rose-100 text-rose-600' :
                confirmModalConfig.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                confirmModalConfig.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                'bg-indigo-100 text-indigo-600'
              }`}>
                {confirmModalConfig.type === 'danger' ? <AlertTriangle className="w-10 h-10" /> :
                 confirmModalConfig.type === 'warning' ? <AlertCircle className="w-10 h-10" /> :
                 confirmModalConfig.type === 'success' ? <CheckCircle2 className="w-10 h-10" /> :
                 <AlertCircle className="w-10 h-10" />}
              </div>
              <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white mb-2">
                {confirmModalConfig.title}
              </h3>
              <div className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                {confirmModalConfig.message}
              </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-950/50 flex gap-3">
              <button 
                onClick={() => setIsConfirmModalOpen(false)}
                className="flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-all"
              >
                {confirmModalConfig.cancelText}
              </button>
              <button 
                onClick={() => {
                  if (modalCountdown > 0) return;
                  confirmModalConfig.onConfirm();
                  setIsConfirmModalOpen(false);
                }}
                disabled={modalCountdown > 0}
                className={`flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white shadow-lg transition-all ${
                  modalCountdown > 0 ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed' :
                  confirmModalConfig.type === 'danger' ? 'bg-rose-600 shadow-rose-200 dark:shadow-none hover:brightness-110 active:scale-95' :
                  confirmModalConfig.type === 'warning' ? 'bg-amber-600 shadow-amber-200 dark:shadow-none hover:brightness-110 active:scale-95' :
                  confirmModalConfig.type === 'success' ? 'bg-emerald-600 shadow-emerald-200 dark:shadow-none hover:brightness-110 active:scale-95' :
                  'bg-indigo-600 shadow-indigo-200 dark:shadow-none hover:brightness-110 active:scale-95'
                }`}
              >
                {confirmModalConfig.confirmText} {modalCountdown > 0 ? `(${modalCountdown})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Sucesso de Saque */}
      {showWithdrawalSuccess && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[400] p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 border border-white/5 p-8 text-center">
            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white mb-4">
              Solicitação Enviada!
            </h3>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-sm leading-relaxed mb-8 uppercase tracking-wide">
              ✅ Sua solicitação de saque foi enviada com sucesso e será analisada pelo administrador.
            </p>
            <button 
              onClick={() => setShowWithdrawalSuccess(false)}
              className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-200 dark:shadow-none hover:brightness-110 active:scale-95 transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
