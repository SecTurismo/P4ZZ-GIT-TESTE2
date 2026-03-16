import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Key, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { User, AppSettings, AccessRequest, Plan, PaymentRequest, View } from '../types';
import { 
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth } from '../firebase';
import { 
  getUsers, setCurrentUser, saveAccessRequest,
  savePaymentRequest,
  getGlobalEstablishmentCategories, getGlobalPlans, getAppSettings,
  getAccessRequests, saveUsers, getCustomers, saveCustomers, validateUniqueness
} from '../services/storage';
import { calculateExpiryDate, formatDisplayDate, isExpired as checkExpired, isWithinGracePeriod } from '../utils/dateUtils';
import { createPixPayment, checkPaymentStatus } from '../services/mercadoPago';
import type { PixPaymentResponse } from '../services/mercadoPago';

// --- HELPERS DE FORMATAÇÃO ---

const formatCPF_CNPJ = (val: string) => {
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

const formatPhone = (val: string) => {
  const v = val.replace(/\D/g, '').slice(0, 11);
  if (v.length <= 10) return v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
};

const validateEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Helpers de Mascaramento de Segurança
const maskDocumentSafe = (val: string = '') => {
  const v = val.replace(/\D/g, '');
  if (v.length === 11) return `${v.slice(0, 3)}.***.***-${v.slice(-2)}`;
  if (v.length === 14) return `${v.slice(0, 2)}.***.***/****-${v.slice(-2)}`;
  return v.length > 2 ? `${v.slice(0, 2)}...${v.slice(-2)}` : v;
};

const maskPhoneSafe = (val: string = '') => {
  const v = val.replace(/\D/g, '');
  if (v.length >= 10) return `(${v.slice(0, 2)}) *****-**${v.slice(-2)}`;
  return v;
};

import { LoginProps } from '../types';
import { MarketingSection } from '../components/MarketingSection';
import { LoginEffects } from '../components/LoginEffects';

export const Login: React.FC<LoginProps> = ({ settings, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showPublicPayment, setShowPublicPayment] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [showPendingBlockModal, setShowPendingBlockModal] = useState(false);
  
  const [reqCategory, setReqCategory] = useState('');
  const [reqPlan, setReqPlan] = useState('');
  const [reqName, setReqName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [isSendingForgot, setIsSendingForgot] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [reqLogin, setReqLogin] = useState('');
  const [reqPassword, setReqPassword] = useState('');
  const [reqDocument, setReqDocument] = useState('');
  const [reqWhatsapp, setReqWhatsapp] = useState('');
  const [reqWhatsappConfirmed, setReqWhatsappConfirmed] = useState(false);
  const [requestSuccess, setReqSuccess] = useState(false);
  const [isAffiliateRequest, setIsAffiliateRequest] = useState(false);
  const [affiliatePaymentStep, setAffiliatePaymentStep] = useState<'form' | 'payment'>('form');
  
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [searchDoc, setSearchDoc] = useState('');
  const [searchError, setSearchError] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [paymentStep, setPaymentStep] = useState<'search' | 'method'>('search');
  const [paymentMode, setPaymentMode] = useState<'manual' | 'pix'>('pix');
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [pixData, setPixData] = useState<PixPaymentResponse | null>(null);
  const [pixStatus, setPixStatus] = useState<string>('pending');
  const [receiptImg, setReceiptImg] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirmValueChecked, setConfirmValueChecked] = useState(false);
  const [triedManualSubmit, setTriedManualSubmit] = useState(false); 
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loginBoxRef = useRef<HTMLDivElement>(null);
  
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [pixAmount, setPixAmount] = useState<number>(0);

  const [masterSettings, setMasterSettings] = useState<AppSettings | null>(null);
  
  const refreshMasterSettings = useCallback(() => {
    getAppSettings('MASTER').then(setMasterSettings);
  }, []);

  useEffect(() => {
    refreshMasterSettings();
    window.addEventListener('p4zz_data_updated', refreshMasterSettings);
    return () => window.removeEventListener('p4zz_data_updated', refreshMasterSettings);
  }, [refreshMasterSettings]);

  const safeSettings = useMemo(() => {
    if (!masterSettings) return settings;
    return { ...settings, ...masterSettings };
  }, [settings, masterSettings]);

  const isDark = safeSettings.loginTheme !== 'light';

  // Cores dinâmicas baseadas no tema
  const boxBg = safeSettings.loginBoxBgColorEnabled 
    ? (safeSettings.loginBoxBgColor || (isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)'))
    : (isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)');
    
  const boxBorder = safeSettings.loginBoxBorderColorEnabled 
    ? (safeSettings.loginBoxBorderColor || (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'))
    : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)');
    
  const boxTitleColor = safeSettings.loginBoxTitleColorEnabled 
    ? (safeSettings.loginBoxTitleColor || (isDark ? '#ffffff' : '#0f172a'))
    : (isDark ? '#ffffff' : '#0f172a');
    
  const boxTextColor = safeSettings.loginBoxTextColorEnabled 
    ? (safeSettings.loginBoxTextColor || (isDark ? '#94a3b8' : '#475569'))
    : (isDark ? '#94a3b8' : '#475569');
    
  const placeholderColor = safeSettings.loginBoxPlaceholderColorEnabled 
    ? (safeSettings.loginBoxPlaceholderColor || (isDark ? '#64748b' : '#94a3b8'))
    : (isDark ? '#64748b' : '#94a3b8');

  // Função para obter classes de animação
  const getAnimClass = (type?: string) => {
    switch (type) {
      case 'fade-in': return 'animate-in fade-in duration-1000';
      case 'slide': return 'animate-in slide-in-from-left-12 duration-1000';
      case 'bounce': return 'animate-bounce';
      case 'pulse': return 'animate-pulse';
      case 'glitch': return 'animate-pulse skew-x-12'; // Simulação simples de glitch
      default: return '';
    }
  };

  const primaryColor = safeSettings.primaryColor || '#4f46e5';
  const loginTextColor = safeSettings.loginTextColorEnabled ? safeSettings.loginTextColor : null;

  useEffect(() => {
    if (showRequestModal || showPlansModal) {
        getGlobalEstablishmentCategories().then(setAvailableCategories);
        getGlobalPlans().then(setAvailablePlans);
    }
  }, [showRequestModal, showPlansModal]);

  const filteredPlans = useMemo(() => {
    const doc = reqDocument.replace(/\D/g, '');
    let plans = availablePlans;
    
    if (safeSettings.affiliateSystemEnabled === false) {
      plans = plans.filter(p => p.name !== 'CONTA AFILIADO');
    }

    if (!doc) return plans.filter(p => !p.isPersonalized);
    
    const personalized = plans.filter(p => 
      p.isPersonalized && (p.linkedDocument || '').replace(/\D/g, '') === doc
    );
    
    if (personalized.length > 0) return personalized;
    
    return plans.filter(p => !p.isPersonalized);
  }, [availablePlans, reqDocument, safeSettings.affiliateSystemEnabled]);

  // Reset selected plan if it's no longer available for the current document
  useEffect(() => {
    if (reqPlan && filteredPlans.length > 0) {
      const isSpecial = reqPlan === 'DEMO GRÁTIS – 3 DIAS' || reqPlan === 'CONTA AFILIADO';
      const exists = filteredPlans.some(p => p.name === reqPlan);
      if (!exists && !isSpecial) {
        setReqPlan('');
      }
    }
  }, [filteredPlans, reqPlan]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setIsSubmitting(true);
    try {
        // First try Firebase Auth
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const firebaseUser = userCredential.user;
          
          const users = await getUsers();
          const user = users.find(u => u.email.toLowerCase() === firebaseUser.email?.toLowerCase());
          
          if (user) {
            if (!user.active) { 
              setError(user.deactivatedMessage || 'Conta suspensa.'); 
              setIsSubmitting(false); 
              return; 
            }
            setCurrentUser(user); 
            onLoginSuccess(user);
            return;
          }
        } catch (firebaseErr: any) {
          console.warn("Firebase Auth failed, falling back to local check:", firebaseErr.message);
        }

        // Fallback to local check (for legacy or admin accounts not yet in Firebase Auth)
        const users = await getUsers();
        const user = users.find(u => (u.login || u.email).toLowerCase() === email.toLowerCase() && u.passwordHash === password);
        if (!user) { setError('Credenciais inválidas.'); setIsSubmitting(false); return; }
        if (!user.active) { setError(user.deactivatedMessage || 'Conta suspensa.'); setIsSubmitting(false); return; }
        setCurrentUser(user); onLoginSuccess(user);
    } catch (err) { setError('Erro de conexão.'); setIsSubmitting(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess(false);

    if (!forgotIdentifier) {
      setForgotError('Por favor, insira seu e-mail ou CPF/CNPJ.');
      return;
    }

    setIsSendingForgot(true);
    try {
      const users = await getUsers();
      const searchClean = forgotIdentifier.replace(/\D/g, '');
      const user = users.find(u => 
        u.email.toLowerCase() === forgotIdentifier.toLowerCase() || 
        (u.document || '').replace(/\D/g, '') === searchClean ||
        (u.login || '').toLowerCase() === forgotIdentifier.toLowerCase()
      );

      if (!user || !user.email) {
        setForgotError('Conta não localizada. Verifique os dados informados.');
        return;
      }

      await sendPasswordResetEmail(auth, user.email);
      setForgotSuccess(true);
      setForgotIdentifier('');
    } catch (error: any) {
      console.error("Erro ao enviar recuperação:", error);
      if (error.code === 'auth/user-not-found') {
        setForgotError('E-mail não cadastrado no sistema de autenticação.');
      } else {
        setForgotError('Erro ao processar solicitação. Tente novamente em instantes.');
      }
    } finally {
      setIsSendingForgot(false);
    }
  };

  const handleSearchTerminal = async () => {
    const searchClean = searchDoc.replace(/\D/g, '');
    if (searchClean.length < 11) { setSearchError('Número incompleto'); return; }

    const users = await getUsers();
    const user = users.find(u => (u.document || '').replace(/\D/g, '') === searchClean);
    if (user) { 
        const plansList = await getGlobalPlans();
        const doc = (user.document || '').replace(/\D/g, '');
        const personalized = plansList.find(p => p.isPersonalized && (p.linkedDocument || '').replace(/\D/g, '') === doc);
        
        const matchedPlan = personalized || plansList.find(p => p.name === user.planName) || plansList[0];
        const price = user.sellingPrice || (matchedPlan ? matchedPlan.price : 99.90);
        setPixAmount(price);
        setFoundUser(user); setPaymentStep('method'); setSearchError(''); setFileError(null); setConfirmValueChecked(false); setReceiptImg(''); setTriedManualSubmit(false);
    } else { setSearchError('Terminal não localizado'); }
  };

  const computedStatus = useMemo(() => {
    if (!foundUser) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const deactMsg = (foundUser.deactivatedMessage || '').toUpperCase();
    
    // Bloqueado por Violação/Banimento
    if (!foundUser.active && (deactMsg.includes('BANIDO') || deactMsg.includes('VIOLAÇÃO'))) {
      return { label: 'Bloqueado', color: 'bg-rose-600 text-white', message: 'Acesso bloqueado por violação de termos.', isExpired: true };
    }
    
    // Suspenso Administrativamente
    if (!foundUser.active) {
      return { label: 'Suspenso', color: 'bg-amber-400 text-slate-900', message: 'Terminal suspenso administrativamente ou por inadimplência.', isExpired: true };
    }
    
    if (foundUser.expiresAt) {
      const graceDays = foundUser.gracePeriod ?? 10;
      
      if (checkExpired(foundUser.expiresAt, graceDays)) {
        return { label: 'Bloqueado', color: 'bg-rose-600 text-white', message: 'Licença expirada. Efetue o pagamento para reativar.', isExpired: true };
      }
      
      if (isWithinGracePeriod(foundUser.expiresAt, graceDays)) {
        return { label: 'Em Carência', color: 'bg-amber-500 text-white', message: 'Licença vencida. Regularize para evitar bloqueio.', isExpired: true };
      }

      return { label: 'Ativo', color: 'bg-emerald-500 text-white', message: 'Parabéns, seu plano está ativo.', isExpired: false };
    }
    
    return { label: 'Bloqueado', color: 'bg-rose-600 text-white', message: 'Licença expirada. Efetue o pagamento para reativar.', isExpired: true };
  }, [foundUser]);

  const handlePublicGeneratePix = async () => {
    if (!foundUser?.email || !safeSettings.mercadoPagoAccessToken) {
        alert("Configurações de pagamento incompletas.");
        return;
    }
    setIsGeneratingPix(true);
    try {
      const data = await createPixPayment(pixAmount, `Renovação ${foundUser.name}`, foundUser.email);
      if (data) { setPixData(data); setPixStatus('pending'); }
    } catch (err: any) {
        alert(err.message || "Erro ao gerar PIX");
    } finally { setIsGeneratingPix(false); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      const maxSize = 1 * 1024 * 1024; // 1MB
      if (!allowedTypes.includes(file.type)) {
        setFileError("Arquivo inválido. Use JPG, PNG ou PDF.");
        setReceiptImg('');
        return;
      }
      if (file.size > maxSize) {
        setFileError("O arquivo deve ter no máximo 1MB.");
        setReceiptImg('');
        return;
      }
      
      setFileError(null);
      setIsSubmitting(true);

      try {
        const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
        const { storage } = await import('../firebase');
        
        const fileName = `${Date.now()}_${file.name}`;
        const storageRef = ref(storage, `receipts/${fileName}`);
        
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        
        setReceiptImg(url);
      } catch (err) {
        console.error("Erro no upload:", err);
        setFileError('Erro ao enviar arquivo para o Firebase Storage.');
        setReceiptImg('');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleReqDocumentChange = (val: string) => {
    setReqDocument(formatCPF_CNPJ(val));
    if (fieldErrors.document) {
      setFieldErrors(prev => { const next = {...prev}; delete next.document; return next; });
    }
  };

  const handleSearchDocChange = (val: string) => {
    setSearchDoc(formatCPF_CNPJ(val));
    if (searchError) setSearchError('');
  };

  const validateRequestForm = async () => {
    const errors: Record<string, string> = {};
    const docClean = reqDocument.replace(/\D/g, '');
    const phoneClean = reqWhatsapp.replace(/\D/g, '');
    const loginClean = reqLogin.trim().toLowerCase();
    
    if (!reqName.trim()) errors.name = 'Obrigatório.';
    if (!reqEmail.trim()) errors.email = 'Obrigatório.';
    if (!validateEmail(reqEmail)) errors.email = 'E-mail inválido.';
    if (docClean.length < 11) errors.document = 'Número incompleto.';
    if (phoneClean.length < 11) errors.whatsapp = 'WhatsApp incompleto.';
    if (!reqCategory) errors.category = 'Selecione o ramo.';
    if (!reqPlan) errors.plan = 'Escolha um plano.';
    if (!loginClean) errors.login = 'Defina um usuário.';
    if (!reqPassword.trim()) errors.password = 'Defina uma senha.';
    if (!reqWhatsappConfirmed) errors.confirm = 'Confirme os dados.';

    // Validação de Duplicidade contra usuários existentes e outras entidades
    const uniqueness = await validateUniqueness(reqName, reqDocument);
    if (!uniqueness.valid) {
        if (uniqueness.message?.includes("nome")) errors.name = uniqueness.message;
        else errors.document = uniqueness.message || "Erro de validação";
    }

    const allUsers = await getUsers();
    if (allUsers.some(u => (u.login || u.email).toLowerCase() === loginClean)) {
        errors.login = 'Este usuário já está em uso.';
    }
    if (allUsers.some(u => u.email.toLowerCase() === reqEmail.toLowerCase().trim())) {
        errors.email = 'Este e-mail já está em uso.';
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submitAccessRequest = async (pType?: 'manual' | 'automatic', receipt?: string) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    const docClean = reqDocument.replace(/\D/g, '');
    const newRequest: AccessRequest = {
        id: requestId, 
        name: reqName.toUpperCase(), 
        document: docClean, 
        whatsapp: reqWhatsapp.replace(/\D/g, ''),
        email: reqEmail.toLowerCase().trim(),
        login: reqLogin.toLowerCase().trim(),
        category: reqCategory, 
        plan: reqPlan, 
        passwordHash: reqPassword, 
        createdAt: new Date().toISOString(), 
        status: 'pending',
        paymentType: pType,
        pixReceipt: receipt
    };
    await saveAccessRequest(newRequest);
    localStorage.setItem('p4zz_active_request_id', requestId);
    setReqSuccess(true);
  };

  const createAccountAutomatically = async () => {
    setIsCreatingAccount(true);
    try {
      const allUsers = await getUsers();
      const docClean = reqDocument.replace(/\D/g, '');
      const loginClean = reqLogin.trim().toLowerCase();
      const emailClean = reqEmail.trim().toLowerCase();

      const uniqueness = await validateUniqueness(reqName, reqDocument);
      if (!uniqueness.valid) {
          alert(`ERRO: ${uniqueness.message}`);
          return;
      }

      // Check for duplicates
      if (allUsers.some(u => (u.login || u.email).toLowerCase() === loginClean)) {
          alert("ERRO: Este login já está em uso por outro terminal.");
          return;
      }
      if (allUsers.some(u => u.email.toLowerCase() === emailClean)) {
          alert("ERRO: Este e-mail já está em uso.");
          return;
      }

      let userRole: User['role'] = 'customer';
      let daysToRenew = 30;
      let expiryDate = '';
      let permissions: View[] = ['dashboard', 'new-sale', 'tables', 'deliveries', 'products', 'categories', 'fiados', 'sales-history', 'reports'];
      
      if (reqPlan === 'CONTA AFILIADO') {
        userRole = 'affiliate';
        permissions = ['affiliates', 'support'];
        expiryDate = calculateExpiryDate(365);
      } else {
        const selectedPlan = availablePlans.find(p => p.name === reqPlan);
        daysToRenew = selectedPlan ? selectedPlan.days : 30;
        expiryDate = calculateExpiryDate(daysToRenew);
      }

      const newUser: User = {
        id: 'user-' + Math.random().toString(36).substr(2, 9),
        name: reqName.toUpperCase(),
        tenantId: reqName.toUpperCase(),
        email: emailClean,
        login: loginClean,
        passwordHash: reqPassword,
        role: userRole,
        active: true,
        document: docClean,
        whatsapp: reqWhatsapp.replace(/\D/g, ''),
        planName: reqPlan || '',
        expiresAt: expiryDate,
        createdAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        category: reqCategory || '',
        permissions,
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

      setReqSuccess(true);
    } catch (err) {
      console.error("Erro ao criar conta automaticamente:", err);
      alert("Erro ao criar conta. Por favor, entre em contato com o suporte.");
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = await validateRequestForm();
    if (!isValid) return;

    const allRequests = await getAccessRequests();
    const docClean = reqDocument.replace(/\D/g, '');
    const hasPending = allRequests.some(r => r.document.replace(/\D/g, '') === docClean && r.status === 'pending');
    
    if (hasPending) { 
        setShowRequestModal(false); 
        setShowPendingBlockModal(true); 
        return; 
    }

    if (reqPlan === 'DEMO GRÁTIS – 3 DIAS') {
      await submitAccessRequest();
      return;
    }

    // Para qualquer outro plano, inclusive AFILIADO, exige pagamento
    let price = 0;
    if (reqPlan === 'CONTA AFILIADO') {
      price = safeSettings.affiliateBasePrice || 150.00;
    } else {
      const plan = availablePlans.find(p => p.name === reqPlan);
      if (plan) price = plan.price;
    }

    setPixAmount(price);
    setAffiliatePaymentStep('payment');
    setPaymentMode('pix');
    setPixData(null);
    setPixStatus('pending');
    setReceiptImg('');
    setConfirmValueChecked(false);
    setTriedManualSubmit(false);

    // Auto-gerar PIX imediatamente
    if (safeSettings.mercadoPagoAccessToken) {
      setIsGeneratingPix(true);
      try {
        const data = await createPixPayment(price, `Adesão ${reqPlan} - ${reqName}`, reqLogin);
        if (data) { 
          setPixData(data); 
          setPixStatus('pending');
          
          const interval = setInterval(async () => {
            const status = await checkPaymentStatus(data.id);
            if (status === 'approved') {
              setPixStatus('approved');
              clearInterval(interval);
              await createAccountAutomatically();
            }
          }, 5000);
          
          const checkModal = setInterval(() => {
            if (!showRequestModal) {
              clearInterval(interval);
              clearInterval(checkModal);
            }
          }, 1000);
        }
      } catch (err: any) {
        console.error("Erro ao auto-gerar PIX:", err);
      } finally {
        setIsGeneratingPix(false);
      }
    }
  };

  const handleAffiliatePixGenerate = async () => {
    if (!reqLogin || !safeSettings.mercadoPagoAccessToken) {
        alert("Configurações de pagamento incompletas.");
        return;
    }
    setIsGeneratingPix(true);
    try {
      const data = await createPixPayment(pixAmount, `Adesão ${reqPlan} - ${reqName}`, reqLogin);
      if (data) { 
        setPixData(data); 
        setPixStatus('pending');
        
        // Iniciar polling de status
        const interval = setInterval(async () => {
          const status = await checkPaymentStatus(data.id);
          if (status === 'approved') {
            setPixStatus('approved');
            clearInterval(interval);
            await submitAccessRequest('automatic');
          }
        }, 5000);
        
        // Limpar intervalo se fechar modal
        const checkModal = setInterval(() => {
          if (!showRequestModal) {
            clearInterval(interval);
            clearInterval(checkModal);
          }
        }, 1000);
      }
    } catch (err: any) {
        alert(err.message || "Erro ao gerar PIX");
    } finally { setIsGeneratingPix(false); }
  };

  const handleAffiliateManualConfirm = async () => {
    setTriedManualSubmit(true);
    if (!confirmValueChecked || !receiptImg) return;
    setIsSubmitting(true);
    try {
      await submitAccessRequest('manual', receiptImg);
      // Opcional: Salvar o comprovante em algum lugar se necessário, 
      // mas o requisito diz apenas que a solicitação é enviada após pagamento.
      // Como não há um campo específico para comprovante na AccessRequest, 
      // vamos apenas prosseguir com o envio da solicitação.
    } catch (err) {
      alert("Erro ao processar envio.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInformaDeposito = async () => {
    setTriedManualSubmit(true);
    if (!confirmValueChecked || !receiptImg) return;
    setIsSubmitting(true);
    try {
        const req: PaymentRequest = { 
            id: Math.random().toString(36).substr(2, 9), 
            userId: foundUser!.id, 
            tenantId: foundUser!.tenantId, 
            userName: foundUser!.name, 
            payerName: foundUser!.name, 
            payerDocument: searchDoc.replace(/\D/g, ''), 
            paymentTime: new Date().toLocaleTimeString(), 
            receiptImage: receiptImg, 
            createdAt: new Date().toISOString(), 
            status: 'pending', 
            amount: pixAmount 
        }; 
        await savePaymentRequest(req); 
        alert("Comprovante enviado! Aguarde a liberação manual pelo administrador."); 
        setShowPublicPayment(false);
    } catch (err) {
        alert("Erro ao processar envio.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const renderLoginButton = (prefix: 'Plans' | 'Request' | 'Regularize' | 'Support' | 'Demo') => {
    const defaultTexts = { Plans: 'Nossos Planos', Request: 'Solicitar Acesso', Regularize: 'Regularização', Support: 'Suporte VIP', Demo: 'Ver Demonstração' };
    const defaultIcons = { Plans: '💎', Request: '🚀', Regularize: '⚠️', Support: '💬', Demo: '👁️' };
    const defaultColors = { Plans: '#4f46e5', Request: '#10b981', Regularize: '#f59e0b', Support: '#059669', Demo: '#6366f1' };
    const text = (safeSettings as any)[`loginBtn${prefix}Text`] || defaultTexts[prefix];
    const subtext = (safeSettings as any)[`loginBtn${prefix}Subtext`] || '';
    const bgColor = (safeSettings as any)[`loginBtn${prefix}Color`] || defaultColors[prefix];
    const textColor = (safeSettings as any)[`loginBtn${prefix}TextColor`] || '#ffffff';
    const iconBase64 = (safeSettings as any)[`loginBtn${prefix}Icon`];
    const showIcon = (safeSettings as any)[`loginBtn${prefix}ShowIcon`] !== false;
    
    const action = async () => {
      if (prefix === 'Plans') setShowPlansModal(true);
      else if (prefix === 'Request') {
        const activeId = localStorage.getItem('p4zz_active_request_id');
        const allReqs = await getAccessRequests();
        const isPending = allReqs.some(r => r.id === activeId && r.status === 'pending');
        if (isPending) { setShowPendingBlockModal(true); return; }
        setFieldErrors({}); setReqSuccess(false); setAffiliatePaymentStep('form'); setShowRequestModal(true);
      }
      else if (prefix === 'Regularize') { setFoundUser(null); setSearchDoc(''); setPaymentStep('search'); setShowPublicPayment(true); }
      else if (prefix === 'Demo') {
        window.open('/demo.html', '_blank');
      }
      else {
        const whatsappUrl = safeSettings.whatsappLink || "https://wa.me/5587981649139";
        window.open(whatsappUrl, "_blank");
      }
    };

    return (
      <button key={prefix} type="button" onClick={action} className="flex items-center gap-4 p-4 rounded-[2.2rem] border border-white/10 shadow-lg active:scale-95 hover:brightness-110 transition-all cursor-pointer w-full text-left" style={{ backgroundColor: bgColor }}>
        {showIcon && (
          <div className="w-10 h-10 rounded-2xl bg-black/10 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
            {iconBase64 ? <img src={iconBase64} className="w-full h-full object-contain p-1" alt="icon" /> : <div className="text-xl">{defaultIcons[prefix]}</div>}
          </div>
        )}
        <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest leading-none mb-1" style={{ color: textColor }}>{text}</span>
            {subtext && <span className="text-[7px] font-bold opacity-70 uppercase tracking-tight" style={{ color: textColor }}>{subtext}</span>}
        </div>
      </button>
    );
  };

  const boxPosition = safeSettings.loginBoxPosition || 'center';
  const justifyClass = boxPosition === 'left' ? 'md:justify-start md:px-20' : boxPosition === 'right' ? 'md:justify-end md:px-20' : 'md:justify-center';

  const getLogoAnimClass = (type?: string) => {
    switch (type) {
      case 'floating': return 'animate-bounce';
      case 'bounce': return 'animate-bounce';
      case 'pulse': return 'animate-pulse';
      case 'wave': return 'animate-pulse';
      case 'spin-slow': return 'animate-[spin_8s_linear_infinite]';
      case 'shake': return 'animate-[wiggle_1s_ease-in-out_infinite]';
      case 'zoom': return 'animate-[pulse_2s_ease-in-out_infinite]';
      case 'slide-side': return 'animate-[slide_3s_ease-in-out_infinite]';
      case 'swing': return 'animate-[swing_2s_ease-in-out_infinite]';
      case 'heartbeat': return 'animate-[pulse_1s_ease-in-out_infinite]';
      case 'rubber-band': return 'animate-[pulse_1.5s_ease-in-out_infinite]';
      case 'glitch': return 'animate-pulse skew-x-12';
      case 'rotate-y': return 'animate-[spin_5s_linear_infinite]';
      default: return '';
    }
  };

  return (
    <div className={`min-h-screen w-full flex items-center justify-center ${justifyClass} relative overflow-hidden`}>
      <style>
        {`
          .login-input::placeholder {
            color: ${safeSettings.loginBoxPlaceholderColorEnabled ? (safeSettings.loginBoxPlaceholderColor || '#64748b') : '#64748b'} !important;
            opacity: 1;
          }
        `}
      </style>
      {/* Fundo Dinâmico */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {safeSettings.loginScreenBgType === 'video' && safeSettings.loginScreenBgUrl ? (
          <video 
            autoPlay 
            muted 
            loop={safeSettings.loginScreenBgLoop} 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover"
            src={safeSettings.loginScreenBgUrl}
          />
        ) : (safeSettings.loginScreenBgType === 'image' || safeSettings.loginScreenBgType === 'gif') && safeSettings.loginScreenBgUrl ? (
          <div 
            className="absolute inset-0 w-full h-full bg-cover bg-center"
            style={{ backgroundImage: `url(${safeSettings.loginScreenBgUrl})` }}
          />
        ) : (
          <div 
            className="absolute inset-0 w-full h-full"
            style={{ backgroundColor: safeSettings.loginScreenBgColor || safeSettings.loginBgColor || '#010818' }}
          />
        )}
        
        {/* Overlay sutil para garantir legibilidade se necessário */}
        <div className="absolute inset-0 bg-black/20"></div>

        {/* Efeitos Animados */}
        <LoginEffects 
          effect={safeSettings.loginEffect || 'none'} 
          color={safeSettings.loginEffectColorEnabled ? (safeSettings.loginEffectColor || safeSettings.loginMarketingPrimaryColor || primaryColor) : (safeSettings.loginMarketingPrimaryColor || primaryColor)} 
        />
      </div>

      {/* Seção de Marketing (Lado Esquerdo) */}
      <div className="hidden md:block">
        <MarketingSection settings={safeSettings} />
      </div>
      
      <div 
          ref={loginBoxRef}
          className="relative w-full max-w-[360px] backdrop-blur-3xl border z-[60] transition-all duration-700 mx-4 md:mx-0 shadow-2xl" 
          style={{ 
            backgroundColor: boxBg,
            borderColor: boxBorder,
            borderRadius: `${safeSettings.loginBoxBorderRadius ?? safeSettings.loginBorderRadius ?? 72}px`,
            padding: `${safeSettings.loginBoxPadding ?? 40}px`,
            transform: window.innerWidth < 768 
              ? `translateY(50px) scale(${safeSettings.loginBoxScale ?? 1.0})` 
              : `translate(${safeSettings.loginBoxLeft ?? 550}px, ${safeSettings.loginBoxTop ?? 0}px) scale(${safeSettings.loginBoxScale ?? 1.0})` 
          }}>


          <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-3">
                {safeSettings.logoUrl && (
                  <img 
                    src={safeSettings.logoUrl} 
                    alt="Logo" 
                    className="h-10 w-auto object-contain"
                    referrerPolicy="no-referrer"
                  />
                )}
                <h2 
                  className="text-2xl font-black uppercase tracking-[0.3em] italic leading-none"
                  style={{ color: boxTitleColor }}
                >
                  {safeSettings.loginTitle || 'ACESSO RESTRITO'}
                </h2>
              </div>
              <div className="h-1.5 w-16 mx-auto rounded-full shadow-lg" style={{ backgroundColor: safeSettings.loginBoxBtnColorEnabled ? (safeSettings.loginBoxBtnColor || primaryColor) : primaryColor }}></div>
          </div>
          <form onSubmit={handleAuth} className="space-y-5">
              <div className="group relative space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Usuário</label>
                  <input 
                    type="text" 
                    required 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    placeholder="E-mail ou usuário..." 
                    className={`w-full px-6 py-4 border-b-2 rounded-2xl font-bold outline-none transition-all login-input ${isDark ? 'bg-white/5 text-white placeholder:text-slate-500' : 'bg-slate-100/50 text-slate-900 placeholder:text-slate-400'}`} 
                    style={{ 
                      borderColor: boxBorder,
                      color: boxTitleColor
                    } as any}
                  />
              </div>
              <div className="group relative space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Senha</label>
                  <input 
                    type="password" 
                    required 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="Senha secreta..." 
                    className={`w-full px-6 py-4 border-b-2 rounded-2xl font-bold outline-none transition-all login-input ${isDark ? 'bg-white/5 text-white placeholder:text-slate-500' : 'bg-slate-100/50 text-slate-900 placeholder:text-slate-400'}`} 
                    style={{ 
                      borderColor: boxBorder,
                      color: boxTitleColor
                    } as any}
                  />
              </div>
              <div className="flex justify-end px-1">
                <button 
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-[9px] font-black uppercase transition-colors tracking-widest opacity-90 hover:opacity-100"
                  style={{ color: loginTextColor || (isDark ? '#818cf8' : '#4f46e5') }}
                >
                  Esqueci minha senha
                </button>
              </div>
              {error && <p className="text-[10px] text-rose-500 font-black text-center uppercase tracking-widest bg-rose-500/10 py-2 rounded-xl border border-rose-500/20">{error}</p>}
              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full py-5 rounded-2xl font-black uppercase text-[12px] tracking-[0.4em] text-white shadow-2xl active:scale-95 hover:brightness-110 transition-all"
                style={{ backgroundColor: safeSettings.loginBoxBtnColorEnabled ? (safeSettings.loginBoxBtnColor || primaryColor) : primaryColor }}
              >
                {isSubmitting ? 'VALIDANDO...' : 'ENTRAR'}
              </button>
              {safeSettings.showDemoLink && (
                <div className="text-center pt-2">
                  <a 
                    href="/demo.html" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer underline underline-offset-4 opacity-90 hover:opacity-100"
                    style={{ color: loginTextColor || (isDark ? '#818cf8' : '#4f46e5') }}
                  >
                    {safeSettings.demoLinkText || 'Ver demonstração do sistema (Demo Viewer)'}
                  </a>
                </div>
              )}
          </form>
          <div className="flex flex-col gap-3 pt-6 border-t border-white/5">
              {(safeSettings.loginButtonsOrder || ['Plans', 'Request', 'Demo', 'Regularize', 'Support'])
                .filter(btn => {
                  if (btn === 'Demo') return false;
                  if (btn === 'Plans' && safeSettings.loginBtnPlansEnabled === false) return false;
                  if (btn === 'Request' && safeSettings.loginBtnRequestEnabled === false) return false;
                  if (btn === 'Regularize' && safeSettings.loginBtnRegularizeEnabled === false) return false;
                  if (btn === 'Support' && safeSettings.loginBtnSupportEnabled === false) return false;
                  return true;
                })
                .map(btn => renderLoginButton(btn as any))}
              {safeSettings.footerText && (
                <p className="text-[9px] font-bold text-slate-500 uppercase text-center mt-2 tracking-widest leading-relaxed">
                  {safeSettings.footerText}
                </p>
              )}
          </div>
      </div>

      {/* Modal Esqueci Minha Senha */}
      <AnimatePresence>
        {showForgotModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[1000] p-4 flex items-center justify-center"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-md rounded-[2.5rem] p-10 border shadow-2xl transition-all"
              style={{ 
                backgroundColor: boxBg,
                borderColor: boxBorder,
                color: boxTitleColor
              } as any}
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                    <Key className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black uppercase italic tracking-tighter">Recuperar Senha</h3>
                </div>
                <button 
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotError('');
                    setForgotSuccess(false);
                  }} 
                  className={`p-2 rounded-xl transition-colors ${isDark ? 'bg-white/5 text-slate-500 hover:text-white' : 'bg-slate-100 text-slate-400 hover:text-slate-600'}`}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {forgotSuccess ? (
                <div className="text-center space-y-6 py-4">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mx-auto border border-emerald-500/20">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-black uppercase tracking-widest text-emerald-500">Solicitação Enviada!</p>
                    <p className={`text-[10px] font-bold uppercase tracking-widest leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Se os dados informados estiverem corretos, você receberá as instruções de recuperação em instantes.
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowForgotModal(false)}
                    className="w-full py-4 bg-emerald-600 rounded-2xl font-black uppercase text-[10px] tracking-widest text-white shadow-lg active:scale-95 transition-all"
                  >
                    ENTENDI
                  </button>
                </div>
              ) : (
                <>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-8 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Insira o e-mail ou CPF/CNPJ cadastrado em sua conta para iniciarmos o processo de recuperação.
                  </p>

                  <form onSubmit={handleForgotPassword} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-slate-500 ml-1">E-mail ou CPF/CNPJ</label>
                      <input 
                        type="text" 
                        required 
                        value={forgotIdentifier} 
                        onChange={e => setForgotIdentifier(e.target.value)} 
                        placeholder="Identificação da conta..." 
                        className={`w-full px-6 py-4 border-b-2 rounded-2xl font-bold outline-none transition-all ${isDark ? 'bg-white/5 text-white placeholder:text-slate-500 border-white/10 focus:border-indigo-500' : 'bg-slate-100/50 text-slate-900 placeholder:text-slate-400 border-slate-200 focus:border-indigo-600'}`} 
                      />
                    </div>

                    {forgotError && (
                      <p className="text-[9px] text-rose-500 font-black uppercase tracking-widest bg-rose-500/10 py-3 px-4 rounded-xl border border-rose-500/20 text-center">
                        {forgotError}
                      </p>
                    )}

                    <button 
                      type="submit" 
                      disabled={isSendingForgot} 
                      className="w-full py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.3em] text-white shadow-xl active:scale-95 hover:brightness-110 transition-all disabled:opacity-50"
                      style={{ backgroundColor: safeSettings.loginBoxBtnColorEnabled ? (safeSettings.loginBoxBtnColor || primaryColor) : primaryColor }}
                    >
                      {isSendingForgot ? 'ENVIANDO...' : 'ENVIAR RECUPERAÇÃO'}
                    </button>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showPlansModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[1000] p-4 flex items-center justify-center animate-in fade-in">
           <div className="bg-[#0a0f1e] w-full max-w-4xl rounded-[3rem] p-8 border border-white/10 text-white flex flex-col max-h-[95vh] overflow-hidden">
              <div className="flex justify-between items-center mb-8 shrink-0">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Nossos Planos</h3>
                <button onClick={() => setShowPlansModal(false)} className="p-2 bg-white/5 rounded-xl text-slate-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg></button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-10 px-2 pb-6">
                  <div className="bg-slate-900/50 p-8 rounded-[2.5rem] border-2 border-indigo-500/30 flex flex-col justify-between hover:scale-[1.02] transition-transform">
                      <div className="space-y-4">
                        <span className="bg-indigo-500 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase">OFERTA INICIAL</span>
                        <h4 className="text-2xl font-black uppercase italic tracking-tighter">Demo Grátis</h4>
                        <p className="text-3xl font-black italic text-indigo-400">R$ 0,00</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">Acesso total por 3 dias para testes.</p>
                      </div>
                      <button onClick={() => { setShowPlansModal(false); setReqPlan('DEMO GRÁTIS – 3 DIAS'); setShowRequestModal(true); }} className="w-full mt-8 py-4 bg-indigo-600 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Solicitar Teste</button>
                  </div>
                  {filteredPlans.map(plan => (
                    <div key={plan.id} className="relative bg-slate-900/50 p-8 rounded-[2.5rem] border border-white/10 flex flex-col justify-between hover:border-indigo-500/50 transition-all">
                        {plan.days === 30 && (
                            <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-30">
                              <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-amber-400 bg-[length:200%_auto] animate-[gradient_3s_linear_infinite] text-slate-900 px-5 py-2 rounded-full text-[9px] font-black uppercase shadow-[0_8px_20px_-4px_rgba(245,158,11,0.5)] whitespace-nowrap border border-amber-200/50 flex items-center gap-1.5">
                                <span className="text-xs">⭐</span>
                                <span>Mais Escolhido</span>
                              </div>
                            </div>
                        )}
                        <div className="space-y-4">
                          <h4 className="text-2xl font-black uppercase italic tracking-tighter">{plan.name}</h4>
                          <p className="text-3xl font-black italic text-emerald-400">R$ {plan.price.toFixed(2)}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">{plan.days} dias de acesso ilimitado.</p>
                        </div>
                        <button onClick={() => { setShowPlansModal(false); setReqPlan(plan.name); setShowRequestModal(true); }} className="w-full mt-8 py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Escolher Plano</button>
                    </div>
                  ))}
              </div>
           </div>
        </div>
      )}

      {showRequestModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[1000] p-4 flex items-center justify-center animate-in fade-in">
           <div className="bg-[#0a0f1e] w-full max-w-lg rounded-[3rem] p-8 border border-white/10 text-white flex flex-col max-h-[95vh] overflow-hidden">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Solicitar Acesso</h3>
                <button onClick={() => setShowRequestModal(false)} className="p-2 bg-white/5 rounded-xl text-slate-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg></button>
              </div>
              {requestSuccess ? (
                <div className="text-center py-10 space-y-6">
                    <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto"><svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={4}/></svg></div>
                    <h4 className="text-xl font-black uppercase tracking-tighter italic">Sucesso!</h4>
                    <p className="text-xs text-slate-400 uppercase font-bold px-6">Seu acesso foi configurado ou está em análise.</p>
                    <button onClick={() => setShowRequestModal(false)} className="px-10 py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest">OK</button>
                </div>
              ) : affiliatePaymentStep === 'payment' ? (
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                  <div className="bg-indigo-600/10 p-6 rounded-[2.5rem] border-2 border-indigo-500/30 text-center">
                    <h4 className="text-lg font-black uppercase italic text-indigo-400 mb-2">{reqPlan}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Valor do Plano</p>
                    <div className="text-3xl font-black italic text-white tracking-tighter">R$ {pixAmount.toFixed(2)}</div>
                  </div>

                  <div className="space-y-6 text-center">
                    <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20">
                      <p className="text-[11px] font-black text-emerald-400 uppercase tracking-widest">
                        Pague agora para liberar sua conta automaticamente.
                      </p>
                    </div>

                    {!pixData ? (
                      <div className="py-10 flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Gerando QR Code Pix...</p>
                      </div>
                    ) : (
                      <div className="animate-in zoom-in-95 space-y-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase px-4">
                          Pague o Pix para que sua conta seja liberada automaticamente após a confirmação do pagamento.
                        </p>
                        <div className="bg-white p-4 rounded-3xl inline-block shadow-2xl border-4 border-indigo-500">
                          <img src={`data:image/png;base64,${pixData.qr_code_base64}`} className="w-48 h-48" alt="QR" />
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(pixData.qr_code); alert('Copiado!'); }} className="w-full py-4 bg-slate-800 rounded-2xl font-black uppercase text-[10px] tracking-widest">Copiar Código PIX</button>
                        <div className="text-emerald-500 animate-pulse text-[9px] font-black uppercase flex items-center justify-center gap-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                          Aguardando confirmação bancária...
                        </div>
                      </div>
                    )}

                    <div className="pt-6 border-t border-white/5 space-y-4">
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">OU</p>
                      <button 
                        onClick={() => submitAccessRequest()} 
                        disabled={isSubmitting}
                        className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all"
                      >
                        {isSubmitting ? 'ENVIANDO...' : 'Enviar solicitação para análise'}
                      </button>
                      <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed">
                        O administrador irá analisar sua solicitação e poderá entrar em contato pelo WhatsApp.
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setAffiliatePaymentStep('form')} className="w-full py-4 text-slate-500 font-black uppercase text-[8px] tracking-widest hover:text-white transition-colors">Voltar ao formulário</button>
                </div>
              ) : (
                <form onSubmit={handleRequestSubmit} className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-1"><label className={`text-[9px] font-black uppercase ${fieldErrors.name ? 'text-rose-500' : 'text-slate-500'} ml-1`}>Nome ou Empresa *</label><input value={reqName} onChange={e => setReqName(e.target.value.toUpperCase())} placeholder="Nome comercial..." className={`w-full px-5 py-3.5 bg-slate-900 border ${fieldErrors.name ? 'border-rose-500' : 'border-white/10'} rounded-2xl font-bold outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-700`} /></div>
                        <div className="space-y-1">
                          <label className={`text-[9px] font-black uppercase ${fieldErrors.login ? 'text-rose-500' : 'text-slate-500'} ml-1`}>Usuário (Login) *</label>
                          <input 
                            value={reqLogin} 
                            onChange={e => setReqLogin(e.target.value.toLowerCase())} 
                            placeholder="usuario123" 
                            className={`w-full px-5 py-3.5 bg-slate-900 border ${fieldErrors.login ? 'border-rose-500' : 'border-white/10'} rounded-2xl font-bold outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-700`} 
                          />
                          {fieldErrors.login && <p className="text-[8px] font-black text-rose-500 uppercase ml-2 mt-1">{fieldErrors.login}</p>}
                        </div>
                        <div className="space-y-1">
                          <label className={`text-[9px] font-black uppercase ${fieldErrors.email ? 'text-rose-500' : 'text-slate-500'} ml-1`}>E-mail *</label>
                          <input 
                            type="email"
                            value={reqEmail} 
                            onChange={e => setReqEmail(e.target.value.toLowerCase())} 
                            placeholder="seu@email.com" 
                            className={`w-full px-5 py-3.5 bg-slate-900 border ${fieldErrors.email ? 'border-rose-500' : 'border-white/10'} rounded-2xl font-bold outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-700`} 
                          />
                          {fieldErrors.email && <p className="text-[8px] font-black text-rose-500 uppercase ml-2 mt-1">{fieldErrors.email}</p>}
                        </div>
                        <div className="space-y-1">
                          <label className={`text-[9px] font-black uppercase ${fieldErrors.document ? 'text-rose-500' : 'text-slate-500'} ml-1`}>CPF ou CNPJ *</label>
                          <input 
                            value={reqDocument} 
                            onChange={e => handleReqDocumentChange(e.target.value)} 
                            className={`w-full px-5 py-3.5 bg-slate-900 border ${fieldErrors.document ? 'border-rose-500' : 'border-white/10'} rounded-2xl font-black outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-700`} 
                            placeholder="000.000.000-00 ou 00.000.000/0000-00" 
                          />
                          {fieldErrors.document && <p className="text-[8px] font-black text-rose-500 uppercase ml-2 mt-1">{fieldErrors.document}</p>}
                        </div>
                        <div className="space-y-1"><label className={`text-[9px] font-black uppercase ${fieldErrors.whatsapp ? 'text-rose-500' : 'text-slate-500'} ml-1`}>WhatsApp *</label><input value={reqWhatsapp} onChange={e => setReqWhatsapp(formatPhone(e.target.value))} className={`w-full px-5 py-3.5 bg-slate-900 border ${fieldErrors.whatsapp ? 'border-rose-500' : 'border-white/10'} rounded-2xl font-bold outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-700`} placeholder="(00) 00000-0000" /></div>
                        <div className="space-y-1"><label className={`text-[9px] font-black uppercase ${fieldErrors.category ? 'text-rose-500' : 'text-slate-500'} ml-1`}>Ramo *</label><select value={reqCategory} onChange={e => setReqCategory(e.target.value)} className={`w-full px-4 py-3.5 bg-slate-900 border ${fieldErrors.category ? 'border-rose-500' : 'border-white/10'} rounded-2xl font-bold outline-none`}><option value="">SELECIONE</option>{availableCategories.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select></div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Plano Desejado</label>
                          <select 
                            value={reqPlan} 
                            onChange={e => setReqPlan(e.target.value)} 
                            className="w-full px-4 py-3.5 bg-slate-950 border-2 border-indigo-500/30 rounded-2xl font-black text-indigo-400 outline-none"
                          >
                            <option value="">SELECIONE UM PLANO</option>
                            <option value="DEMO GRÁTIS – 3 DIAS">DEMO GRÁTIS – 3 DIAS</option>
                            <option value="CONTA AFILIADO">CONTA AFILIADO</option>
                            {filteredPlans.map(p => (
                                <option key={p.id} value={p.name}>{p.name} – R$ {p.price.toFixed(2)}</option>
                            ))}
                          </select>
                        </div>
                        <div className="bg-black/40 p-5 rounded-[2rem] border border-white/5 space-y-4">
                            <p className="text-[10px] font-black text-indigo-400 uppercase italic">Dados de Acesso</p>
                            <div className="space-y-1">
                                <label className={`text-[8px] font-black uppercase ${fieldErrors.login ? 'text-rose-500' : 'text-slate-600'} ml-1`}>Usuário *</label>
                                <input value={reqLogin} onChange={e => setReqLogin(e.target.value.toLowerCase())} className={`w-full px-5 py-3 bg-slate-950 border ${fieldErrors.login ? 'border-rose-500' : 'border-white/5'} rounded-xl font-bold outline-none placeholder:text-slate-700`} placeholder="USUÁRIO..." />
                                {fieldErrors.login && <p className="text-[8px] font-black text-rose-500 uppercase ml-2 mt-1">{fieldErrors.login}</p>}
                            </div>
                            <div className="space-y-1">
                                <label className={`text-[8px] font-black uppercase ${fieldErrors.password ? 'text-rose-500' : 'text-slate-600'} ml-1`}>Senha *</label>
                                <input type="password" value={reqPassword} onChange={e => setReqPassword(e.target.value)} className={`w-full px-5 py-3 bg-slate-950 border ${fieldErrors.password ? 'border-rose-500' : 'border-white/5'} rounded-xl font-bold outline-none placeholder:text-slate-700`} placeholder="SENHA..." />
                            </div>
                        </div>
                        <div onClick={() => setReqWhatsappConfirmed(!reqWhatsappConfirmed)} className={`p-4 rounded-2xl bg-black/40 border-2 ${fieldErrors.confirm ? 'border-rose-500' : 'border-white/10'} cursor-pointer flex justify-between items-center transition-all`}><span className={`text-[9px] font-black uppercase ${reqWhatsappConfirmed ? 'text-emerald-500' : 'text-slate-500'}`}>Confirmo meus dados</span><div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${reqWhatsappConfirmed ? 'bg-indigo-600 border-indigo-600' : 'border-white/20'}`}>{reqWhatsappConfirmed && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={5}/></svg>}</div></div>
                    </div>
                    <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-[1.8rem] font-black uppercase text-xs shadow-xl active:scale-95 transition-all">Enviar Solicitação</button>
                </form>
              )}
           </div>
        </div>
      )}

      {showPublicPayment && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[1000] p-4 flex items-center justify-center animate-in fade-in">
           <div className="bg-[#0a0f1e] w-full max-w-lg rounded-[3rem] p-8 border border-white/10 text-white flex flex-col max-h-[95vh] overflow-hidden">
              <div className="flex justify-between items-center mb-6 shrink-0">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-black uppercase italic tracking-tighter">Regularização</h3>
                  <button 
                    onClick={() => {
                      const whatsappUrl = safeSettings.whatsappLink || "https://wa.me/5587981649139";
                      window.open(whatsappUrl, "_blank");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 text-emerald-500 rounded-full border border-emerald-500/30 hover:bg-emerald-600/30 transition-all active:scale-95"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-4.821 4.754a8.117 8.117 0 01-3.841-.963L3.5 20l1.657-5.332a8.105 8.105 0 01-1.101-4.12c0-4.491 3.655-8.146 8.148-8.146 2.175 0 4.22.846 5.756 2.384a8.102 8.102 0 012.387 5.763c0 4.492-3.655 8.147-8.149 8.147m0-17.647C7.34 1.489 2.23 6.599 2.23 12.856c0 2.001.523 3.954 1.516 5.682L1.5 22.5l4.111-1.079a10.56 10.56 0 005.239 1.385h.005c6.262 0 11.371-5.11 11.371-11.367 0-3.036-1.181-5.891-3.328-8.038a11.306 11.306 0 00-8.048-3.332z"/></svg>
                    <span className="text-[8px] font-black uppercase tracking-widest">Suporte</span>
                  </button>
                </div>
                <button onClick={() => setShowPublicPayment(false)} className="p-2 bg-white/5 rounded-xl text-slate-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg></button>
              </div>
              
              {paymentStep === 'search' ? (
                <div className="space-y-6">
                    <div className="space-y-1">
                        <label className={`text-[9px] font-black uppercase ${searchError ? 'text-rose-500' : 'text-slate-500'} ml-1`}>Documento do Terminal (CPF/CNPJ)</label>
                        <input 
                          value={searchDoc} 
                          onChange={e => handleSearchDocChange(e.target.value)} 
                          placeholder="000.000.000-00" 
                          className={`w-full px-6 py-4 bg-slate-900 border ${searchError ? 'border-rose-500' : 'border-white/10'} rounded-2xl font-black outline-none focus:ring-2 focus:ring-indigo-500`} 
                        />
                        {searchError && <p className="text-[10px] text-rose-500 font-black uppercase ml-2 mt-1">{searchError}</p>}
                    </div>
                    <button onClick={handleSearchTerminal} className="w-full py-5 bg-indigo-600 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Localizar Terminal</button>
                </div>
              ) : (
                <div className="space-y-6 overflow-y-auto custom-scrollbar pr-2 pb-6">
                    <div className="bg-white/5 p-6 rounded-[2rem] border border-white/10 space-y-4">
                        <div className="flex justify-between items-start">
                            <h4 className="text-lg font-black uppercase italic text-white leading-tight">{foundUser?.name}</h4>
                            <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase ${computedStatus?.color}`}>{computedStatus?.label}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 pt-2 border-t border-white/5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">Documento</p>
                                    <p className="text-[10px] font-bold text-slate-200">
                                      {foundUser?.document ? maskDocumentSafe(foundUser.document) : '---'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">WhatsApp</p>
                                    <p className="text-[10px] font-bold text-slate-200">{foundUser?.whatsapp ? maskPhoneSafe(foundUser.whatsapp) : '---'}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                                <div>
                                    <p className="text-[7px] font-black text-emerald-400 uppercase tracking-widest">Plano Ativo</p>
                                    <p className="text-[10px] font-black text-white uppercase italic">{foundUser?.planName || 'PERSONALIZADO'}</p>
                                </div>
                                <div>
                                    <p className={`text-[7px] font-black uppercase tracking-widest ${computedStatus?.label !== 'Ativo' ? 'text-rose-500' : 'text-emerald-400'}`}>Vencimento</p>
                                    <p className={`text-[10px] font-black ${computedStatus?.label !== 'Ativo' ? 'text-rose-500' : 'text-white'}`}>
                                      {foundUser?.expiresAt ? new Date(foundUser.expiresAt + 'T12:00:00').toLocaleDateString() : '---'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {computedStatus?.label === 'Ativo' ? (
                        <div className="bg-emerald-500/10 p-8 rounded-[2.5rem] border-2 border-emerald-500/30 flex flex-col items-center gap-4 animate-in zoom-in-95 text-center">
                            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={5}/></svg>
                            </div>
                            <h4 className="text-lg font-black uppercase text-emerald-500 italic leading-tight">Parabéns, seu plano está ativo.</h4>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Não existem faturas pendentes.</p>
                            <button onClick={() => setShowPublicPayment(false)} className="mt-4 px-10 py-3 bg-white text-slate-900 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Fechar</button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                                <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed text-center">{computedStatus?.message}</p>
                            </div>

                            <div className="flex bg-slate-900 p-1.5 rounded-full shadow-inner mb-4">
                                <button onClick={() => setPaymentMode('pix')} className={`flex-1 py-3 rounded-full text-[9px] font-black uppercase transition-all ${paymentMode === 'pix' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>PIX Auto</button>
                                <button onClick={() => setPaymentMode('manual')} className={`flex-1 py-3 rounded-full text-[9px] font-black uppercase transition-all ${paymentMode === 'manual' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>PIX Manual</button>
                            </div>

                            {paymentMode === 'pix' ? (
                                <div className="space-y-6 text-center">
                                    {!pixData ? (
                                        <div className="space-y-6">
                                            <div className="p-5 bg-indigo-600/10 rounded-[2rem] border border-indigo-600/30 flex flex-col items-center gap-1">
                                                <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">VALOR</span>
                                                <span className="text-3xl font-black italic text-white tracking-tighter leading-none">R$ {pixAmount.toFixed(2)}</span>
                                            </div>
                                            <button onClick={handlePublicGeneratePix} disabled={isGeneratingPix} className="w-full py-5 bg-indigo-600 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:scale-105 transition-all">
                                                {isGeneratingPix ? 'GERANDO...' : `Gerar QR Code Pix no valor de R$ ${pixAmount.toFixed(2).replace('.', ',')}`}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="animate-in zoom-in-95">
                                            <div className="bg-white p-4 rounded-3xl inline-block mb-4 shadow-2xl border-4 border-indigo-500"><img src={`data:image/png;base64,${pixData.qr_code_base64}`} className="w-48 h-48" alt="QR" /></div>
                                            <button onClick={() => { navigator.clipboard.writeText(pixData.qr_code); alert('Copiado!'); }} className="w-full py-4 bg-slate-800 rounded-2xl font-black uppercase text-[10px] tracking-widest mb-4">Copiar Código PIX</button>
                                            <div className="text-emerald-500 animate-pulse text-[9px] font-black uppercase flex items-center justify-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div>Aguardando confirmação bancária...</div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="p-5 bg-emerald-600/10 rounded-[2rem] border border-emerald-600/30 flex flex-col items-center gap-1">
                                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">VALOR</span>
                                        <span className="text-3xl font-black italic text-white tracking-tighter leading-none">R$ {pixAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="bg-slate-950 p-6 rounded-[2.2rem] border border-white/5">
                                        <p className="text-[8px] font-black text-indigo-400 uppercase mb-2 tracking-[0.2em] italic">Instruções de Depósito</p>
                                        <p className="text-[11px] font-bold leading-relaxed">{safeSettings.paymentInstructions || 'Solicite a chave PIX no suporte.'}</p>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div 
                                            onClick={() => fileInputRef.current?.click()} 
                                            className={`py-6 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${receiptImg ? 'bg-emerald-500/10 border-emerald-500/50' : (triedManualSubmit && !receiptImg ? 'bg-rose-50 border-rose-500 shadow-lg ring-1 ring-rose-200' : 'bg-white/5 border-white/10')}`}
                                        >
                                            {receiptImg ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-emerald-500 font-black uppercase text-[10px]">Comprovante Anexado ✓</span>
                                                    <button onClick={(e) => { e.stopPropagation(); setReceiptImg(''); }} className="text-rose-500 text-[8px] font-black uppercase underline">Remover</button>
                                                </div>
                                            ) : (
                                                <>
                                                    <svg className={`w-6 h-6 ${triedManualSubmit && !receiptImg ? 'text-rose-500 animate-bounce' : 'text-slate-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" strokeWidth={2}/></svg>
                                                    <span className={`text-[9px] font-black uppercase ${triedManualSubmit && !receiptImg ? 'text-rose-500' : 'text-slate-500'}`}>Anexar comprovante</span>
                                                </>
                                            )}
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png,application/pdf" onChange={(e) => { handleFileChange(e); setTriedManualSubmit(false); }} />
                                        </div>
                                        
                                        <div 
                                            onClick={() => { setConfirmValueChecked(!confirmValueChecked); setTriedManualSubmit(false); }} 
                                            className={`flex items-center gap-3 cursor-pointer group p-3 bg-black/20 rounded-2xl border transition-all ${triedManualSubmit && !confirmValueChecked ? 'border-rose-500 shadow-lg ring-1 ring-rose-200' : 'border-white/5'}`}
                                        >
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${confirmValueChecked ? 'bg-indigo-600 border-indigo-600 shadow-lg' : (triedManualSubmit && !confirmValueChecked ? 'border-rose-500 bg-rose-50' : 'border-white/20')}`}>{confirmValueChecked && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={5}/></svg>}</div>
                                            <span className={`text-[9px] font-black uppercase ${confirmValueChecked ? 'text-white' : (triedManualSubmit && !confirmValueChecked ? 'text-rose-500' : 'text-slate-400 group-hover:text-white')} transition-colors`}>Confirmo o valor de R$ {pixAmount.toFixed(2)}</span>
                                        </div>

                                        <button onClick={handleInformaDeposito} disabled={isSubmitting} className="w-full py-5 bg-emerald-600 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">
                                            {isSubmitting ? 'ENVIANDO...' : 'Pagar via Pix Manual'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
              )}
           </div>
        </div>
      )}

      {showPendingBlockModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[1000] p-4 flex items-center justify-center animate-in fade-in">
           <div className="bg-[#0a0f1e] w-full max-w-[340px] rounded-[3rem] p-10 border-2 border-amber-500/30 text-white text-center shadow-2xl">
                <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20"><svg className="w-10 h-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={3}/></svg></div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-4 text-amber-500 leading-tight">Solicitação Já Enviada</h3>
                <p className="text-xs font-bold text-slate-400 uppercase leading-relaxed mb-10 px-4">Aguarde a aprovação do seu cadastro.</p>
                <div className="space-y-4 pt-4 border-t border-white/5">
                   <button onClick={() => window.open(safeSettings.whatsappLink || "https://wa.me/5587981649139", "_blank")} className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">Falar no WhatsApp</button>
                   <button onClick={() => setShowPendingBlockModal(false)} className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase text-[8px] tracking-widest">Entendi</button>
                </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Login;