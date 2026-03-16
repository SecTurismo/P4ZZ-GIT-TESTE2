import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import { db as firestore, auth } from '../firebase';
import { Product, Sale, Table, User, Category, Expense, Fiado, AppSettings, View, Customer, Delivery, AccessRequest, PaymentRequest, Plan, MenuCategory, ConsumptionRecord, CashierClosure, CashierShift, AffiliateCommission, AffiliatePaymentRequest, SupportTicket, Addon, DemoView, Supplier, PurchaseOrder, Reservation, CashFlowEntry, KDSOrder } from '../types';

const STORAGE_PREFIX = 'p4zz_system_';

// Test connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(firestore, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Evento customizado para notificar mudanças de dados entre componentes
export const notifyDataChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('p4zz_data_updated'));
  }
};

export const isDemoViewer = () => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  const pathParts = path.split('/').filter(Boolean);
  let normalizedPath = path;
  
  const knownRoutes = ['dashboard', 'products', 'categories', 'addons', 'new-sale', 'sales-history', 'reports', 'tables', 'deliveries', 'user-management', 'customer-management', 'fiados', 'settings', 'payment', 'plan-management', 'my-plan', 'employee-management', 'support', 'affiliates', 'employee-consumption', 'employee-reports', 'kds', 'suppliers', 'financial-flow', 'reservations', 'reset-password', 'demo'];
  
  if (pathParts.length > 0 && !knownRoutes.includes(pathParts[0])) {
    normalizedPath = '/' + pathParts.slice(1).join('/');
  }
  
  return normalizedPath.startsWith('/demo/painel/');
};

export const db = {
  get: async <T>(key: string, defaultValue: T, tenantId: string = 'MASTER'): Promise<T> => {
    if (isDemoViewer()) {
      const sessionKey = STORAGE_PREFIX + 'demo_' + key;
      const sessionData = sessionStorage.getItem(sessionKey);
      if (sessionData) return JSON.parse(sessionData);
    }

    try {
      const docRef = doc(firestore, 'tenants', tenantId, 'data', key);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data().value as T;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `tenants/${tenantId}/data/${key}`);
    }
    
    return defaultValue;
  },
  set: async (key: string, value: any, tenantId: string = 'MASTER'): Promise<void> => {
    if (isDemoViewer()) {
      sessionStorage.setItem(STORAGE_PREFIX + 'demo_' + key, JSON.stringify(value));
      notifyDataChanged();
      return;
    }

    try {
      const docRef = doc(firestore, 'tenants', tenantId, 'data', key);
      await setDoc(docRef, { value, updatedAt: new Date().toISOString() });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tenants/${tenantId}/data/${key}`);
    }
    
    notifyDataChanged();
  }
};

const getActiveTenantId = () => {
  const userStr = localStorage.getItem('p4zz_session_user');
  if (!userStr) return 'MASTER';
  try {
    const user = JSON.parse(userStr);
    return user.tenantId || 'MASTER';
  } catch {
    return 'MASTER';
  }
};

export const DEFAULT_MENU_STRUCTURE: MenuCategory[] = [
  { id: 'main', label: 'Operacional', items: ['dashboard', 'tables', 'new-sale', 'deliveries', 'kds', 'reservations'] },
  { id: 'inventory', label: 'CATEGORIAS', items: ['products', 'categories', 'addons', 'suppliers'] },
  { id: 'financial', label: 'Financeiro', items: ['fiados', 'sales-history', 'reports', 'financial-flow', 'affiliates'] },
  { id: 'config', label: 'Suporte', items: ['my-plan', 'employee-management', 'support'] },
  { id: 'master', label: 'MASTER', items: ['user-management', 'customer-management', 'plan-management', 'payment', 'settings'] }
];

export const DEFAULT_SETTINGS: AppSettings = {
  systemName: 'P4ZZ SYSTEM',
  primaryColor: '#4f46e5',
  accentColor: '#4f46e5',
  loginStyle: 'apple',
  themeMode: 'light',
  sidebarTheme: 'dark',
  sidebarColor: '#0f0f12',
  sidebarActiveColor: '#ffffff',
  sidebarWidth: 230,        // Padrão solicitado: 230px
  sidebarItemPadding: 6,    // Padrão solicitado: 6px
  sidebarFontSize: 10,      // Padrão solicitado: 10px
  sidebarIconSize: 16,      // Padrão solicitado: 16px
  sidebarActiveItemRadius: 12,
  sidebarEffectOpacity: 0.1,
  uiDensity: 'standard',
  buttonStyle: 'rounded',
  cardShadow: 'soft',
  glassIntensity: 20,
  loginTitle: 'ACESSO RESTRITO',
  loginWelcomeMessage: 'Bem-vindo de volta',
  loginButtonText: 'Entrar',
  loginBgColor: '#010818',
  loginAnimColor: '#4f46e5',
  loginAnimSpeed: 0.5,
  loginOrbDensity: 1,
  loginShowGradient: true,
  loginBoxTop: 0,
  loginBoxLeft: 550,
  loginBoxScale: 1.0,
  loginBoxPosition: 'center',
  
  // Defaults para Marketing
  loginSalesTitle: 'P4ZZ CONTROL',
  loginSalesTitleSize: 72,
  loginSalesTitleX: 0,
  loginSalesTitleY: 0,
  loginSalesTitleAnim: 'slide',
  loginSalesTitleColor: '#ffffff',
  loginSalesText: 'O SISTEMA MAIS COMPLETO E INTELIGENTE PARA GESTÃO DE ESTABELECIMENTOS.',
  loginSalesTextSize: 12,
  loginSalesTextX: 0,
  loginSalesTextY: 0,
  loginSalesTextAnim: 'typing',
  loginSalesTextColor: '#94a3b8',
  loginMarketingAlign: 'left',
  loginFeatures: 'GESTÃO COMPLETA\nSUPORTE 24H\nRELATÓRIOS INTELIGENTES',
  loginFeaturesX: 0,
  loginFeaturesY: 0,
  loginFeaturesAnimSpeed: 3,
  loginFeaturesColor: '#0f172a',
  loginFeaturesTextColor: '#ffffff',
  loginFeaturesBorderRadius: 40,
  loginFeaturesPadding: 16,
  loginFeaturesGap: 16,
  loginFeaturesAnimType: 'bounce',
  loginMarketingLeft: -350,
  loginMarketingTop: 0,
  loginMarketingScale: 1.0,
  loginBalloonColor: '#0f172a',
  loginBalloonHeight: 60,
  loginMarketingTextEnabled: true,
  loginMarketingImageEnabled: false,
  loginMarketingImageUrl: '',
  loginMarketingImageX: -350,
  loginMarketingImageY: 0,
  loginMarketingImageScale: 1.0,
  loginMarketingImageAnim: 'none',
  loginScreenBgColor: '#0a0f1e',
  loginMarketingPrimaryColor: '#6366f1',
  loginTheme: 'dark',
  loginThematicBorder: 'Nenhum',
  loginEffect: 'aurora',
  loginEffectColor: '#00BFFF',

  borderRadius: '1.5rem',
  glassMode: false,
  sidebarBubbles: false,
  sidebarTextColor: '#ffffff',
  workspaceBgColor: '#f8fafc',
  workspaceTheme: 'none',
  workspaceThemeColor: '#00BFFF',
  workspaceThemeColorEnabled: false,
  globalBanMessage: 'ACESSO BLOQUEADO: Este terminal foi banido por violação dos termos de uso.',
  globalSuspensionMessage: 'ACESSO SUSPENSO: Regularize sua fatura para reativar o acesso ao sistema.',
  loginBoxBgColor: 'rgba(15, 23, 42, 0.8)',
  loginBoxBorderColor: 'rgba(255, 255, 255, 0.1)',
  loginBoxTitleColor: '#ffffff',
  loginBoxBtnColor: '#00BFFF',
  loginBoxTextColor: '#94a3b8',
  loginBoxPlaceholderColor: '#64748b',
  loginBoxBorderRadius: 72,
  loginBoxPadding: 40,
  loginScreenBgType: 'color',
  loginScreenBgUrl: '',
  loginScreenBgLoop: false,
  loginBoxBorderImageUrl: '',
  loginBoxBorderImageScale: 1.0,
  loginBoxBorderImageX: 0,
  loginBoxBorderImageY: 0,
  loginBoxThemes: [
    { name: 'Padrão', settings: { loginBoxBgColor: 'rgba(15, 23, 42, 0.8)', loginBoxBorderColor: 'rgba(255, 255, 255, 0.1)', loginBoxTitleColor: '#ffffff', loginBoxBtnColor: '#00BFFF', loginBoxTextColor: '#94a3b8', loginBoxBorderImageUrl: '' } }
  ],
  loginTextColor: '#6366f1',
  loginTextColorEnabled: false,
  workspaceBgColorEnabled: false,
  loginBoxBgColorEnabled: false,
  loginBoxBorderColorEnabled: false,
  loginBoxTitleColorEnabled: false,
  loginBoxBtnColorEnabled: false,
  loginBoxTextColorEnabled: false,
  loginBoxPlaceholderColorEnabled: false,
  loginScreenBgColorEnabled: false,
  loginMarketingPrimaryColorEnabled: false,
  sidebarMainColorEnabled: false,
  sidebarTextColorEnabled: false,
  sidebarSecondaryColorEnabled: false,
  loginEffectColorEnabled: false,
  showDemoLink: false,
  demoLinkText: '',
  loginBtnPlansEnabled: true,
  loginBtnRequestEnabled: true,
  loginBtnRegularizeEnabled: true,
  loginBtnSupportEnabled: true,
  affiliateSystemEnabled: true,
  tablesSystemEnabled: true,
  kdsEnabled: true,
  suppliersEnabled: true,
  financialFlowEnabled: true,
  reservationsEnabled: true,
  
  // Defaults para Módulos Adicionais
  kdsAutoRefreshInterval: 10,
  kdsShowDeliveredOrders: false,
  kdsSoundNotification: true,
  kdsFontSize: 'medium',
  
  financialFlowDefaultPeriod: '30d',
  financialFlowShowProjections: true,
  financialFlowIncludePendingFiados: false,
  
  reservationsDefaultDuration: 120,
  reservationsBufferTime: 15,
  reservationsAutoConfirm: false,
  reservationsShowNotesOnCard: true,
  
  suppliersAutoUpdateStock: true,
  suppliersNotifyLowStock: true,

  globalMessageEnabled: false,
  globalMessageText: '',
  smtpHost: 'smtp.gmail.com',
  smtpPort: 465,
  smtpUser: '',
  smtpPass: '',
  smtpSecure: true,
  qrCodeMasterUrl: '',
  qrCodeMasterExpiration: 'none',
  qrCodeMenuPdf: '',
  qrRedirectType: 'pdf',
  qrRedirectUrl: '',
  saleConfirmationSoundEnabled: true,
  saleConfirmationSoundUrl: '',
  saleConfirmationSoundUpload: '',
  footerText: '',
  whatsappLink: '',
  whatsappSupportMessage: 'Olá! Preciso de suporte com o sistema P4ZZ.',
  aiSettings: {
    enabled: true,
    movementPredictionEnabled: true,
    stockPredictionEnabled: true,
    minSalesForAnalysis: 5
  },
  printSettings: {
    customerReceipt: {
      header: 'P4ZZ SYSTEM',
      footer: 'Obrigado pela preferência!',
      message: 'Volte sempre!',
      paperSize: '80mm',
      margins: { top: 5, bottom: 5, left: 5, right: 5 },
      showItemsPrice: true,
      showTotal: true
    },
    kitchenOrder: {
      header: 'COMANDA DE PRODUÇÃO',
      footer: '',
      message: '',
      paperSize: '80mm',
      margins: { top: 5, bottom: 5, left: 5, right: 5 },
      showItemsPrice: false,
      showTotal: false
    },
    a4Report: {
      header: 'RELATÓRIO DE VENDAS',
      footer: '',
      message: '',
      paperSize: 'A4',
      margins: { top: 10, bottom: 10, left: 10, right: 10 },
      showItemsPrice: true,
      showTotal: true
    },
    autoPrint: false,
    printDelay: 0
  },
  errorPage404Title: 'OPS! PÁGINA NÃO ENCONTRADA',
  errorPage404Message: 'A página que você está procurando não existe ou foi movida.',
  errorPage404ButtonText: 'VOLTAR AO INÍCIO',
  errorPage404ImageUrl: '',
  errorPage404BgColor: '#0f172a',
  errorPage404TextColor: '#ffffff',
  errorPage404Theme: 'modern',
  errorPage404Animation: 'fade',
  errorPage404ShowSearch: false,
  errorPage404ShowLinks: false,
  errorPage404ShowHomeButton: true,
  errorPage404ShowSupportButton: false,
  errorPage404RedirectTime: 0,
  errorPage404GradientEnabled: false,
  errorPage404GradientColor: '#4f46e5',
  errorPage404Pattern: 'none',
  errorPage404SocialLinks: [],
  errorPage404ShowReportButton: false,
  errorPage404ReportEmail: '',
  errorPage404ReportSuccessMessage: 'Obrigado! Nossa equipe foi notificada.'
};

const ALL_PERMISSIONS: View[] = [
  'dashboard', 'products', 'categories', 'new-sale', 'sales-history', 
  'reports', 'tables', 'deliveries', 'user-management', 'fiados', 
  'settings', 'customer-management', 'payment', 'plan-management', 
  'my-plan', 'employee-management', 'support', 'affiliates'
];

export const getUsers = async (): Promise<User[]> => {
  try {
    const docRef = doc(firestore, 'tenants', 'MASTER', 'data', 'users');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().value as User[];
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'tenants/MASTER/data/users');
  }
  
  // Fallback to local storage if Firebase fails or is empty
  const users = localStorage.getItem(STORAGE_PREFIX + 'users');
  const parsed = users ? JSON.parse(users) : [];
  
  if (parsed.length === 0) {
    const admin = {
      id: 'admin-id',
      name: 'ADMINISTRADOR',
      tenantId: 'MASTER',
      email: 'admin',
      login: 'admin',
      passwordHash: 'admin',
      role: 'admin' as const,
      active: true,
      permissions: ALL_PERMISSIONS
    };
    await saveUsers([admin]);
    return [admin];
  }
  return parsed;
};

export const saveUsers = async (users: User[]) => {
  try {
    const docRef = doc(firestore, 'tenants', 'MASTER', 'data', 'users');
    await setDoc(docRef, { value: users, updatedAt: new Date().toISOString() });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'tenants/MASTER/data/users');
  }

  try {
    localStorage.setItem(STORAGE_PREFIX + 'users', JSON.stringify(users));
  } catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      console.error('Erro: Limite de armazenamento local (localStorage) excedido ao salvar usuários.');
    } else {
      console.error('Erro ao salvar usuários no localStorage:', e);
    }
  }
  notifyDataChanged();
};

export const getCurrentUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  if (isDemoViewer()) {
    return {
      id: 'demo-viewer',
      name: 'Visitante Demo',
      email: 'demo@viewer.com',
      role: 'customer',
      tenantId: 'DEMO_VIEWER',
      active: true,
      isDemoViewer: true
    } as any;
  }
  const data = localStorage.getItem('p4zz_session_user');
  return data ? JSON.parse(data) : null;
};

export const setCurrentUser = (user: User | null) => {
  if (user) localStorage.setItem('p4zz_session_user', JSON.stringify(user));
  else localStorage.removeItem('p4zz_session_user');
  notifyDataChanged();
};

export const getProducts = async (): Promise<Product[]> => {
  const tenantId = getActiveTenantId();
  const products = await db.get<Product[]>(`products_${tenantId}`, [], tenantId);
  return products.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
};

export const saveProducts = async (products: Product[]) => {
  const tenantId = getActiveTenantId();
  await db.set(`products_${tenantId}`, products, tenantId);
};

export const getConsumptions = async (): Promise<ConsumptionRecord[]> => {
  const tenantId = getActiveTenantId();
  return await db.get<ConsumptionRecord[]>(`consumptions_${tenantId}`, [], tenantId);
};

export const saveConsumption = async (record: ConsumptionRecord): Promise<boolean> => {
  try {
    const tenantId = getActiveTenantId();
    const consumptions = await getConsumptions();
    consumptions.push(record);
    await db.set(`consumptions_${tenantId}`, consumptions, tenantId);
    
    const products = await getProducts();
    const p = products.find(prod => prod.id === record.productId);
    if (p) {
        p.stock = Math.max(0, p.stock - record.quantity);
        await saveProducts(products);
    }
    return true;
  } catch (e) {
    return false;
  }
};

export const saveAllConsumptions = async (consumptions: ConsumptionRecord[]) => {
  const tenantId = getActiveTenantId();
  await db.set(`consumptions_${tenantId}`, consumptions, tenantId);
};

export const deleteConsumption = async (id: string): Promise<boolean> => {
  try {
    const tenantId = getActiveTenantId();
    const consumptions = await getConsumptions();
    const record = consumptions.find(c => c.id === id);
    
    if (record) {
      const products = await getProducts();
      const p = products.find(prod => prod.id === record.productId);
      if (p) {
        p.stock += record.quantity;
        await saveProducts(products);
      }
      
      const updatedConsumptions = consumptions.filter(c => c.id !== id);
      await db.set(`consumptions_${tenantId}`, updatedConsumptions, tenantId);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
};

export const getCashierClosures = async (): Promise<CashierClosure[]> => {
  const tenantId = getActiveTenantId();
  return await db.get<CashierClosure[]>(`closures_${tenantId}`, [], tenantId);
};

export const saveCashierClosure = async (closure: CashierClosure): Promise<void> => {
  const tenantId = getActiveTenantId();
  const closures = await getCashierClosures();
  closures.push(closure);
  await db.set(`closures_${tenantId}`, closures, tenantId);
};

export const deleteCashierClosure = async (id: string): Promise<void> => {
  const tenantId = getActiveTenantId();
  const closures = await getCashierClosures();
  const updated = closures.filter(c => c.id !== id);
  await db.set(`closures_${tenantId}`, updated, tenantId);
};

export const getCashierShifts = async (): Promise<CashierShift[]> => {
  const tenantId = getActiveTenantId();
  return await db.get<CashierShift[]>(`shifts_${tenantId}`, [], tenantId);
};

export const saveCashierShifts = async (shifts: CashierShift[]) => {
  const tenantId = getActiveTenantId();
  await db.set(`shifts_${tenantId}`, shifts, tenantId);
};

export const getOpenShift = async (userId: string): Promise<CashierShift | null> => {
  const shifts = await getCashierShifts();
  return shifts.find(s => s.userId === userId && s.status === 'aberto') || null;
};

export const openCashierShift = async (userId: string, tenantId: string, userName: string, initialCash: number): Promise<CashierShift> => {
  const shifts = await getCashierShifts();
  const newShift: CashierShift = {
    id: Math.random().toString(36).substr(2, 9),
    userId,
    tenantId,
    userName,
    openDate: new Date().toISOString(),
    initialCash,
    status: 'aberto'
  };
  shifts.push(newShift);
  await saveCashierShifts(shifts);
  return newShift;
};

export const closeCashierShift = async (shiftId: string, finalCash: number): Promise<void> => {
  const shifts = await getCashierShifts();
  const index = shifts.findIndex(s => s.id === shiftId);
  if (index !== -1) {
    shifts[index].status = 'fechado';
    shifts[index].closeDate = new Date().toISOString();
    shifts[index].finalCash = finalCash;
    await saveCashierShifts(shifts);
  }
};

export const getSales = async (): Promise<Sale[]> => {
  const tenantId = getActiveTenantId();
  return await db.get<Sale[]>(`sales_${tenantId}`, [], tenantId);
};

export const saveSale = async (sale: Sale): Promise<boolean> => {
  try {
    const tenantId = getActiveTenantId();
    const sales = await getSales();
    
    // Garantir status de preparação para o KDS
    if (!sale.preparationStatus) {
      sale.preparationStatus = 'pending';
    }
    
    sales.push(sale);
    await db.set(`sales_${tenantId}`, sales, tenantId);
    
    const products = await getProducts();
    const addons = await getAddons();
    
    sale.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) p.stock = Math.max(0, p.stock - item.quantity);
      
      // Desconto de complementos
      addons.forEach(addon => {
        const link = addon.linkedProducts.find(lp => lp.productId === item.productId);
        if (link) {
          addon.totalQuantity = Math.max(0, addon.totalQuantity - (link.usagePerSale * item.quantity));
        }
      });
    });
    
    await saveProducts(products);
    await saveAddons(addons);
    return true;
  } catch (e) {
    return false;
  }
};

export const deleteSale = async (id: string) => {
  const tenantId = getActiveTenantId();
  const sales = await getSales();
  const saleToRemove = sales.find(s => s.id === id);
  if (saleToRemove) {
    const products = await getProducts();
    const addons = await getAddons();
    
    saleToRemove.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) p.stock += item.quantity;
      
      // Devolver complementos
      addons.forEach(addon => {
        const link = addon.linkedProducts.find(lp => lp.productId === item.productId);
        if (link) {
          addon.totalQuantity += (link.usagePerSale * item.quantity);
        }
      });
    });
    
    await saveProducts(products);
    await saveAddons(addons);
  }
  const updated = sales.filter(s => s.id !== id);
  await db.set(`sales_${tenantId}`, updated, tenantId);
};

export const getAppSettings = async (tenantId?: string): Promise<AppSettings> => {
  const tid = tenantId || getActiveTenantId();
  
  // Sempre busca as configurações globais como base
  const globalSettings = await db.get<AppSettings>(`settings_MASTER`, DEFAULT_SETTINGS, 'MASTER');
  
  if (tid === 'MASTER') return globalSettings;
  
  // Busca as sobreposições do cliente (tenant)
  const tenantOverrides = await db.get<Partial<AppSettings>>(`settings_${tid}`, {}, tid);
  
  // Mesclagem inteligente: Global + Sobreposições
  // Para objetos aninhados, fazemos o merge para não perder configurações globais não alteradas
  return { 
    ...globalSettings, 
    ...tenantOverrides,
    // Merge de objetos específicos para garantir a hierarquia correta
    customLabels: { 
      ...(globalSettings.customLabels || {}), 
      ...(tenantOverrides.customLabels || {}) 
    },
    menuShortcuts: { 
      ...(globalSettings.menuShortcuts || {}), 
      ...(tenantOverrides.menuShortcuts || {}) 
    },
    aiSettings: { 
      ...(globalSettings.aiSettings || {}), 
      ...(tenantOverrides.aiSettings || {}) 
    },
    printSettings: {
      ...(globalSettings.printSettings || {}),
      ...(tenantOverrides.printSettings || {}),
      customerReceipt: {
        ...(globalSettings.printSettings?.customerReceipt || {}),
        ...(tenantOverrides.printSettings?.customerReceipt || {})
      },
      kitchenOrder: {
        ...(globalSettings.printSettings?.kitchenOrder || {}),
        ...(tenantOverrides.printSettings?.kitchenOrder || {})
      },
      a4Report: {
        ...(globalSettings.printSettings?.a4Report || {}),
        ...(tenantOverrides.printSettings?.a4Report || {})
      }
    }
  } as AppSettings;
};

export const saveAppSettings = async (settings: AppSettings | Partial<AppSettings>, tenantId?: string) => {
  const tid = tenantId || getActiveTenantId();
  
  // Se for MASTER, salva como configuração global
  if (tid === 'MASTER') {
    await db.set(`settings_MASTER`, settings, 'MASTER');
  } else {
    // Se for um cliente, salva apenas as sobreposições
    await db.set(`settings_${tid}`, settings, tid);
  }
};

export const getAddons = async (): Promise<Addon[]> => {
  const tenantId = getActiveTenantId();
  return await db.get<Addon[]>(`addons_${tenantId}`, [], tenantId);
};

export const saveAddons = async (addons: Addon[]) => {
  const tenantId = getActiveTenantId();
  await db.set(`addons_${tenantId}`, addons, tenantId);
};

export const getCategories = async (): Promise<Category[]> => {
  const tenantId = getActiveTenantId();
  const categories = await db.get<Category[]>(`categories_${tenantId}`, [], tenantId);
  return categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
};

export const saveCategories = async (categories: Category[]) => {
  const tenantId = getActiveTenantId();
  await db.set(`categories_${tenantId}`, categories, tenantId);
};

export const getExpenses = async (): Promise<Expense[]> => {
  const tenantId = getActiveTenantId();
  return await db.get<Expense[]>(`expenses_${tenantId}`, [], tenantId);
};

export const saveExpense = async (expense: Expense) => {
  const tenantId = getActiveTenantId();
  const expenses = await getExpenses();
  expenses.push(expense);
  await db.set(`expenses_${tenantId}`, expenses, tenantId);
};

export const deleteExpense = async (id: string) => {
  const tenantId = getActiveTenantId();
  const expenses = await getExpenses();
  const updated = expenses.filter(e => e.id !== id);
  await db.set(`expenses_${tenantId}`, updated, tenantId);
};

export const getFiados = async (): Promise<Fiado[]> => {
  const tenantId = getActiveTenantId();
  return await db.get<Fiado[]>(`fiados_${tenantId}`, [], tenantId);
};

export const saveFiado = async (fiado: Fiado): Promise<boolean> => {
  try {
    const tenantId = getActiveTenantId();
    const fiados = await getFiados();
    const index = fiados.findIndex(f => f.id === fiado.id);
    
    const products = await getProducts();
    const addons = await getAddons();
    
    if (index !== -1) {
      const oldFiado = fiados[index];
      // Ajustar estoque baseado na diferença
      fiado.items.forEach(newItem => {
        const oldItem = oldFiado.items.find(oi => oi.productId === newItem.productId);
        const diff = newItem.quantity - (oldItem?.quantity || 0);
        if (diff !== 0) {
          const p = products.find(prod => prod.id === newItem.productId);
          if (p) p.stock = Math.max(0, p.stock - diff);
          
          // Ajustar complementos
          addons.forEach(addon => {
            const link = addon.linkedProducts.find(lp => lp.productId === newItem.productId);
            if (link) {
              addon.totalQuantity = Math.max(0, addon.totalQuantity - (link.usagePerSale * diff));
            }
          });
        }
      });
      // Verificar se algum item foi removido completamente
      oldFiado.items.forEach(oldItem => {
        const stillExists = fiado.items.find(ni => ni.productId === oldItem.productId);
        if (!stillExists) {
          const p = products.find(prod => prod.id === oldItem.productId);
          if (p) p.stock += oldItem.quantity;
          
          // Devolver complementos
          addons.forEach(addon => {
            const link = addon.linkedProducts.find(lp => lp.productId === oldItem.productId);
            if (link) {
              addon.totalQuantity += (link.usagePerSale * oldItem.quantity);
            }
          });
        }
      });
      fiados[index] = fiado;
    } else {
      fiados.push(fiado);
      fiado.items.forEach(item => {
        const p = products.find(prod => prod.id === item.productId);
        if (p) p.stock = Math.max(0, p.stock - item.quantity);
        
        // Desconto de complementos
        addons.forEach(addon => {
          const link = addon.linkedProducts.find(lp => lp.productId === item.productId);
          if (link) {
            addon.totalQuantity = Math.max(0, addon.totalQuantity - (link.usagePerSale * item.quantity));
          }
        });
      });
    }
    
    await db.set(`fiados_${tenantId}`, fiados, tenantId);
    await saveProducts(products);
    await saveAddons(addons);
    return true;
  } catch (e) {
    return false;
  }
};

export const deleteFiado = async (id: string) => {
  const tenantId = getActiveTenantId();
  const fiados = await getFiados();
  const fiadoToRemove = fiados.find(f => f.id === id);
  if (fiadoToRemove) {
    const products = await getProducts();
    const addons = await getAddons();
    
    fiadoToRemove.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) p.stock += item.quantity;
      
      // Devolver complementos
      addons.forEach(addon => {
        const link = addon.linkedProducts.find(lp => lp.productId === item.productId);
        if (link) {
          addon.totalQuantity += (link.usagePerSale * item.quantity);
        }
      });
    });
    
    await saveProducts(products);
    await saveAddons(addons);
  }
  const updated = fiados.filter(f => f.id !== id);
  await db.set(`fiados_${tenantId}`, updated, tenantId);
};

export const getKDSOrders = async (): Promise<KDSOrder[]> => {
  const tenantId = getActiveTenantId();
  return await db.get<KDSOrder[]>(`kds_orders_${tenantId}`, [], tenantId);
};

export const saveKDSOrder = async (order: KDSOrder): Promise<void> => {
  const tenantId = getActiveTenantId();
  const orders = await getKDSOrders();
  const index = orders.findIndex(o => o.id === order.id);
  if (index !== -1) orders[index] = order;
  else orders.push(order);
  await db.set(`kds_orders_${tenantId}`, orders, tenantId);
};

export const deleteKDSOrder = async (id: string): Promise<void> => {
  const tenantId = getActiveTenantId();
  const orders = await getKDSOrders();
  const updated = orders.filter(o => o.id !== id);
  await db.set(`kds_orders_${tenantId}`, updated, tenantId);
};

export const saveAllKDSOrders = async (orders: KDSOrder[]) => {
  const tenantId = getActiveTenantId();
  await db.set(`kds_orders_${tenantId}`, orders, tenantId);
};

export const getDeliveries = async (): Promise<Delivery[]> => {
  const tenantId = getActiveTenantId();
  return await db.get<Delivery[]>(`deliveries_${tenantId}`, [], tenantId);
};

export const saveDelivery = async (delivery: Delivery) => {
  const tenantId = getActiveTenantId();
  const deliveries = await getDeliveries();
  const index = deliveries.findIndex(d => d.id === delivery.id);
  if (index !== -1) deliveries[index] = delivery;
  else deliveries.push(delivery);
  await db.set(`deliveries_${tenantId}`, deliveries, tenantId);
};

export const saveAllDeliveries = async (deliveries: Delivery[]) => {
  const tenantId = getActiveTenantId();
  await db.set(`deliveries_${tenantId}`, deliveries, tenantId);
};

export const removeDelivery = async (id: string) => {
  const tenantId = getActiveTenantId();
  const deliveries = await getDeliveries();
  const updated = deliveries.filter(d => d.id !== id);
  await db.set(`deliveries_${tenantId}`, updated, tenantId);
};

export const getNextDeliveryNumber = async (): Promise<number> => {
  const sales = await getSales();
  const deliveries = await getDeliveries();
  const lastSaleNum = sales.filter(s => s.isDelivery).reduce((max, s) => Math.max(max, s.deliveryNumber || 0), 0);
  const lastDelivNum = deliveries.reduce((max, d) => Math.max(max, d.displayId || 0), 0);
  return Math.max(lastSaleNum, lastDelivNum) + 1;
};

export const getAccessRequests = async (): Promise<AccessRequest[]> => {
  return await db.get<AccessRequest[]>('access_requests', []);
};

export const saveAccessRequest = async (request: AccessRequest) => {
  const requests = await getAccessRequests();
  const index = requests.findIndex(r => r.id === request.id);
  if (index !== -1) requests[index] = request;
  else requests.push(request);
  await db.set('access_requests', requests);
};

export const removeAccessRequest = async (id: string) => {
  const requests = await getAccessRequests();
  const updated = requests.filter(r => r.id !== id);
  await db.set('access_requests', updated);
};

export const getPaymentRequests = async (): Promise<PaymentRequest[]> => {
  return await db.get<PaymentRequest[]>('payment_requests', []);
};

export const savePaymentRequest = async (request: PaymentRequest) => {
  const requests = await getPaymentRequests();
  const index = requests.findIndex(r => r.id === request.id);
  if (index !== -1) requests[index] = request;
  else requests.push(request);
  await db.set('payment_requests', requests);
};

/**
 * Verifica se uma ação é permitida com base no plano do usuário.
 */
export const checkPlanLimit = async (
  type: 'employees' | 'products' | 'categories' | 'tables' | 'ai' | 'printing' | 'reports' | 'marketing' | 'hosting' | 'backup' | 'label_customization',
  featureName?: string
): Promise<{ allowed: boolean; message?: string; limit?: number; current?: number }> => {
  // O sistema foi simplificado: todos os planos têm acesso total a todas as funções.
  return { allowed: true };
};

export const removePaymentRequest = async (id: string) => {
  const requests = await getPaymentRequests();
  const updated = requests.filter(r => r.id !== id);
  await db.set('payment_requests', updated);
};

export const getGlobalEstablishmentCategories = async (): Promise<string[]> => {
  return await db.get<string[]>('global_est_categories', ["Restaurante", "Pizzaria", "Lanchonete", "Loja", "Outros"]);
};

export const saveGlobalEstablishmentCategories = async (categories: string[]) => {
  await db.set('global_est_categories', categories);
};

export const getGlobalPlans = async (): Promise<Plan[]> => {
  const plans = await db.get<Plan[]>('global_plans', []);
  if (plans.length === 0) {
    const defaultPlans: Plan[] = [
      { id: 'p1', name: 'PLANO MENSAL', days: 30, price: 99.90, description: 'Acesso completo a todas as funções do sistema por 30 dias.' }
    ];
    await db.set('global_plans', defaultPlans);
    return defaultPlans;
  }
  return plans;
};

export const saveGlobalPlans = async (plans: Plan[]) => {
  await db.set('global_plans', plans);
};

export const getCustomers = async (tenantId: string): Promise<Customer[]> => {
  return await db.get<Customer[]>(`customers_${tenantId}`, [], tenantId);
};

export const saveCustomers = async (customers: Customer[], tenantId: string) => {
  await db.set(`customers_${tenantId}`, customers, tenantId);
};

export const getTables = async (): Promise<Table[]> => {
  const tenantId = getActiveTenantId();
  const tables = await db.get<Table[]>(`tables_${tenantId}`, [], tenantId);
  if (tables.length === 0) {
    const initialTables: Table[] = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      label: (i + 1).toString().padStart(2, '0'),
      status: 'Livre',
      items: []
    }));
    await db.set(`tables_${tenantId}`, initialTables, tenantId);
    return initialTables;
  }
  return tables;
};

export const saveTables = async (tables: Table[]) => {
  const tenantId = getActiveTenantId();
  await db.set(`tables_${tenantId}`, tables, tenantId);
};

export const getTenantEmployees = async (tenantId: string): Promise<User[]> => {
  const users = await getUsers();
  return users.filter(u => u.tenantId === tenantId && u.role === 'employee');
};

export const getMenuBackup = async (tenantId?: string): Promise<{ structure: MenuCategory[], shortcuts: Record<string, string>, labels: Record<string, string> } | null> => {
  const tid = tenantId || getActiveTenantId();
  return await db.get(`menu_backup_${tid}`, null, tid);
};

export const saveMenuBackup = async (data: { structure: MenuCategory[], shortcuts: Record<string, string>, labels: Record<string, string> }, tenantId?: string) => {
  const tid = tenantId || getActiveTenantId();
  await db.set(`menu_backup_${tid}`, data, tid);
};

export const exportFullBackup = async () => {
    const data = { 
      users: await getUsers(), 
      plans: await getGlobalPlans(), 
      requests: await getAccessRequests(), 
      paymentRequests: await getPaymentRequests(), 
      categories: await getGlobalEstablishmentCategories() 
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `p4zz_full_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
};

export const exportTenantBackup = async (tenantId: string) => {
    const data = { 
      products: await getProducts(), 
      sales: await getSales(), 
      expenses: await getExpenses(), 
      categories: await getCategories(), 
      tables: await getTables(), 
      deliveries: await getDeliveries(), 
      settings: await getAppSettings(tenantId) 
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `p4zz_${tenantId}_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
};

export const getAffiliateCommissions = async (): Promise<AffiliateCommission[]> => {
  return await db.get<AffiliateCommission[]>('affiliate_commissions', []);
};

export const saveAffiliateCommissions = async (commissions: AffiliateCommission[]) => {
  await db.set('affiliate_commissions', commissions);
};

export const getAffiliatePaymentRequests = async (): Promise<AffiliatePaymentRequest[]> => {
  return await db.get<AffiliatePaymentRequest[]>('affiliate_payment_requests', []);
};

export const saveAffiliatePaymentRequest = async (request: AffiliatePaymentRequest) => {
  const requests = await getAffiliatePaymentRequests();
  const index = requests.findIndex(r => r.id === request.id);
  if (index !== -1) requests[index] = request;
  else requests.push(request);
  await db.set('affiliate_payment_requests', requests);
};

export const removeAffiliatePaymentRequest = async (id: string) => {
  const requests = await getAffiliatePaymentRequests();
  const updated = requests.filter(r => r.id !== id);
  await db.set('affiliate_payment_requests', updated);
};

export const getSupportTickets = async (): Promise<SupportTicket[]> => {
  return await db.get<SupportTicket[]>('support_tickets', []);
};

export const saveSupportTicket = async (ticket: SupportTicket) => {
  const tickets = await getSupportTickets();
  const index = tickets.findIndex(t => t.id === ticket.id);
  if (index !== -1) tickets[index] = ticket;
  else tickets.push(ticket);
  await db.set('support_tickets', tickets);
};

export const getSuppliers = async () => {
  const tenantId = getActiveTenantId();
  return db.get<Supplier[]>(`suppliers_${tenantId}`, [], tenantId);
};

export const saveSuppliers = async (suppliers: Supplier[]) => {
  const tenantId = getActiveTenantId();
  await db.set(`suppliers_${tenantId}`, suppliers, tenantId);
};

export const getPurchaseOrders = async () => {
  const tenantId = getActiveTenantId();
  return db.get<PurchaseOrder[]>(`purchase_orders_${tenantId}`, [], tenantId);
};

export const savePurchaseOrders = async (orders: PurchaseOrder[]) => {
  const tenantId = getActiveTenantId();
  await db.set(`purchase_orders_${tenantId}`, orders, tenantId);
};

export const getReservations = async () => {
  const tenantId = getActiveTenantId();
  return db.get<Reservation[]>(`reservations_${tenantId}`, [], tenantId);
};

export const saveReservations = async (reservations: Reservation[]) => {
  const tenantId = getActiveTenantId();
  await db.set(`reservations_${tenantId}`, reservations, tenantId);
};

export const getCashFlow = async () => {
  const tenantId = getActiveTenantId();
  return db.get<CashFlowEntry[]>(`cash_flow_${tenantId}`, [], tenantId);
};

export const saveCashFlow = async (entries: CashFlowEntry[]) => {
  const tenantId = getActiveTenantId();
  await db.set(`cash_flow_${tenantId}`, entries, tenantId);
};

export const getDemoViews = async (): Promise<DemoView[]> => {
  return await db.get<DemoView[]>('demo_views', []);
};

export const saveDemoView = async (view: DemoView) => {
  const views = await getDemoViews();
  views.push(view);
  await db.set('demo_views', views);
};

export const validateUniqueness = async (
  name: string,
  document: string,
  excludeId?: string
): Promise<{ valid: boolean; message?: string }> => {
  const nameLower = name.trim().toLowerCase();
  const docClean = document.replace(/\D/g, "");

  if (!nameLower && !docClean) return { valid: true };

  // 1. Verificar Usuários (inclui Funcionários e Afiliados)
  const allUsers = await getUsers();
  
  if (nameLower) {
    const duplicateUserByName = allUsers.find(u => u.name.toLowerCase() === nameLower && u.id !== excludeId);
    if (duplicateUserByName) return { valid: false, message: "Já existe um usuário cadastrado com esse nome." };
  }

  if (docClean) {
    const duplicateUserByDoc = allUsers.find(u => (u.document || "").replace(/\D/g, "") === docClean && u.id !== excludeId);
    if (duplicateUserByDoc) return { valid: false, message: "Já existe um cadastro utilizando este documento." };
  }

  // 2. Verificar Solicitações de Acesso
  const requests = await getAccessRequests();
  if (nameLower) {
    const duplicateRequestByName = requests.find(r => r.name.toLowerCase() === nameLower && r.id !== excludeId);
    if (duplicateRequestByName) return { valid: false, message: "Já existe um usuário cadastrado com esse nome." };
  }
  if (docClean) {
    const duplicateRequestByDoc = requests.find(r => (r.document || "").replace(/\D/g, "") === docClean && r.id !== excludeId);
    if (duplicateRequestByDoc) return { valid: false, message: "Já existe um cadastro utilizando este documento." };
  }

  // 3. Verificar Clientes (Master e do Tenant Atual)
  const tenantId = getActiveTenantId();
  const currentTenantCustomers = await getCustomers(tenantId);
  
  if (nameLower) {
    const duplicateCustomerByName = currentTenantCustomers.find(c => c.name.toLowerCase() === nameLower && c.id !== excludeId);
    if (duplicateCustomerByName) return { valid: false, message: "Já existe um usuário cadastrado com esse nome." };
  }
  if (docClean) {
    const duplicateCustomerByDoc = currentTenantCustomers.find(c => (c.document || "").replace(/\D/g, "") === docClean && c.id !== excludeId);
    if (duplicateCustomerByDoc) return { valid: false, message: "Já existe um cadastro utilizando este documento." };
  }

  if (tenantId !== "MASTER") {
    const masterCustomers = await getCustomers("MASTER");
    if (nameLower) {
      const duplicateMasterCustomerByName = masterCustomers.find(c => c.name.toLowerCase() === nameLower && c.id !== excludeId);
      if (duplicateMasterCustomerByName) return { valid: false, message: "Já existe um usuário cadastrado com esse nome." };
    }
    if (docClean) {
      const duplicateMasterCustomerByDoc = masterCustomers.find(c => (c.document || "").replace(/\D/g, "") === docClean && c.id !== excludeId);
      if (duplicateMasterCustomerByDoc) return { valid: false, message: "Já existe um cadastro utilizando este documento." };
    }
  }

  return { valid: true };
};

export const importFullBackup = (content: string): boolean => {
  try {
    const data = JSON.parse(content);
    if (data.users) localStorage.setItem(STORAGE_PREFIX + 'users', JSON.stringify(data.users));
    if (data.plans) localStorage.setItem(STORAGE_PREFIX + 'global_plans', JSON.stringify(data.plans));
    notifyDataChanged();
    return true;
  } catch (e) { return false; }
};