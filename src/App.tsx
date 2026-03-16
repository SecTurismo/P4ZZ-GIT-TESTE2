import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ProductList from './pages/ProductList';
import CategoryManagement from './pages/CategoryManagement';
import NewSale from './pages/NewSale';
import SalesHistory from './pages/SalesHistory';
import Reports from './pages/Reports';
import Tables from './pages/Tables';
import Deliveries from './pages/Deliveries';
import UserManagement from './pages/UserManagement';
import CustomerManagement from './pages/CustomerManagement';
import FiadoManagement from './pages/FiadoManagement';
import AdminSettings from './pages/AdminSettings';
import { Login } from './pages/Login';
import Payment from './pages/Payment';
import PlanManagement from './pages/PlanManagement';
import MyPlan from './pages/MyPlan';
import EmployeeManagement from './pages/EmployeeManagement';
import Support from './pages/Support';
import AffiliateManagement from './pages/AffiliateManagement';
import EmployeeReports from './pages/EmployeeReports';
import KDS from './pages/KDS';
import SupplierManagement from './pages/SupplierManagement';
import FinancialFlow from './pages/FinancialFlow';
import Reservations from './pages/Reservations';
import NotFound from './pages/NotFound';
import { ResetPassword } from './pages/ResetPassword';
import { LoginEffects } from './components/LoginEffects';
import KitchenMonitor from './pages/KitchenMonitor';
import { View, Product, Sale, User, Expense, Fiado, AppSettings, ConsumptionRecord, CashierClosure, CashierShift, Addon, Category, Table, Customer } from './types';
import { LOW_STOCK_LIMIT } from '@/constants';
import { 
  getProducts, 
  getSales, 
  getCurrentUser, 
  setCurrentUser, 
  getUsers,
  saveUsers,
  getExpenses, 
  getFiados,
  getConsumptions,
  getAppSettings, 
  getDeliveries, 
  getAccessRequests, 
  getPaymentRequests, 
  getAffiliatePaymentRequests,
  getSupportTickets,
  getOpenShift,
  getAddons,
  getCategories,
  getTables,
  getCustomers,
  getDemoViews,
  saveDemoView,
  openCashierShift,
  saveCashierClosure,
  closeCashierShift,
  DEFAULT_MENU_STRUCTURE,
  DEFAULT_SETTINGS 
} from './services/storage';
import { formatDisplayDate, isExpired as checkExpired, isWithinGracePeriod } from './utils/dateUtils';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const path = window.location.pathname;
    // Detect repo prefix from path if it exists (e.g., /P4ZZ-GIT-TESTE/dashboard -> /dashboard)
    // This assumes the app is either at root or in a single-level subdirectory
    const pathParts = path.split('/').filter(Boolean);
    let normalizedPath = path;
    
    // If we have parts and the first part isn't a known route, it's likely a repo prefix
    const knownRoutes = ['dashboard', 'products', 'categories', 'addons', 'new-sale', 'sales-history', 'reports', 'tables', 'deliveries', 'user-management', 'customer-management', 'fiados', 'settings', 'payment', 'plan-management', 'my-plan', 'employee-management', 'support', 'affiliates', 'employee-consumption', 'employee-reports', 'kds', 'suppliers', 'financial-flow', 'reservations', 'reset-password', 'demo'];
    
    if (pathParts.length > 0 && !knownRoutes.includes(pathParts[0])) {
      normalizedPath = '/' + pathParts.slice(1).join('/');
    }

    if (normalizedPath.startsWith('/demo/painel/')) {
      const urlParams = new URLSearchParams(window.location.search);
      const affiliateId = urlParams.get('affiliateId');
      
      // Registrar visualização de demo se houver affiliateId
      if (affiliateId) {
        getDemoViews().then(views => {
          const newView = {
            id: Math.random().toString(36).substr(2, 9),
            affiliateId,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
          };
          saveDemoView(newView);
        });
      }

      return {
        id: 'demo-viewer',
        name: 'Visitante Demo',
        email: 'demo@viewer.com',
        role: 'customer',
        tenantId: 'MASTER',
        active: true,
        isDemoViewer: true,
        isAffiliate: true,
        affiliateId: affiliateId || undefined
      } as any;
    }
    return getCurrentUser();
  });
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fiados, setFiados] = useState<Fiado[]>([]);
  const [consumptions, setConsumptions] = useState<ConsumptionRecord[]>([]);
  const [pendingDeliveriesCount, setPendingDeliveriesCount] = useState(0);
  const [pendingAccessRequestsCount, setPendingAccessRequestsCount] = useState(0);
  const [pendingAffiliateAccessRequestsCount, setPendingAffiliateAccessRequestsCount] = useState(0);
  const [pendingPaymentRequestsCount, setPendingPaymentRequestsCount] = useState(0); 
  const [pendingAffiliatePayoutsCount, setPendingAffiliatePayoutsCount] = useState(0);
  const [pendingSupportResponsesCount, setPendingSupportResponsesCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [lowAddonsCount, setLowAddonsCount] = useState(0);
  const [inactiveCategoriesCount, setInactiveCategoriesCount] = useState(0);
  const [inactiveProductsCount, setInactiveProductsCount] = useState(0);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsTab, setSettingsTab] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [hasShownGlobalMessage, setHasShownGlobalMessage] = useState(false);
  
  const [activeShift, setActiveShift] = useState<CashierShift | null>(null);
  const [isCashierOpening, setIsCashierOpening] = useState(false);
  const [isCashierClosing, setIsCashierClosing] = useState(false);
  const [initialCashInput, setInitialCashInput] = useState('');
  const [finalCashInput, setFinalCashInput] = useState('');
  const [isProcessingShift, setIsProcessingShift] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    const pathParts = path.split('/').filter(Boolean);
    let normalizedPath = path;
    
    const knownRoutes = ['dashboard', 'products', 'categories', 'addons', 'new-sale', 'sales-history', 'reports', 'tables', 'deliveries', 'user-management', 'customer-management', 'fiados', 'settings', 'payment', 'plan-management', 'my-plan', 'employee-management', 'support', 'affiliates', 'employee-consumption', 'employee-reports', 'kds', 'suppliers', 'financial-flow', 'reservations', 'reset-password', 'demo'];
    
    if (pathParts.length > 0 && !knownRoutes.includes(pathParts[0])) {
      normalizedPath = '/' + pathParts.slice(1).join('/');
    }

    if (normalizedPath === '/reset-password') {
      setCurrentView('reset-password' as any);
    } else if (normalizedPath !== '/' && normalizedPath !== '' && !normalizedPath.startsWith('/demo/painel/') && normalizedPath !== '/index.html') {
      setCurrentView('not-found');
    }
  }, []);

  // Aplicar Favicon do Sistema
  useEffect(() => {
    if (settings.faviconUrl) {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = settings.faviconUrl;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  }, [settings.faviconUrl]);

  const isDemo = user?.role === 'demo';
  const isDemoViewer = user?.isDemoViewer;

  // Lógica de Tempo Restante para Conta Demo com Precisão de Segundos
  const demoStatus = useMemo(() => {
    if (!user?.expiresAt || user.role !== 'demo') return { text: '', isExpired: false, expiryStr: '' };
    
    const isExpired = checkExpired(user.expiresAt);
    const expiryStr = formatDisplayDate(user.expiresAt);

    if (isExpired) return { text: 'EXPIRADO', isExpired: true, expiryStr };

    // Para demo, ainda podemos querer o contador regressivo se for no mesmo dia ou algo assim
    // Mas para simplificar e manter consistência, vamos usar o status básico
    return { text: 'ATIVO', isExpired: false, expiryStr };
  }, [user]);

  const t = (key: string, def: string) => settings.customLabels?.[key] || def;

  const VIEW_LABELS: Record<View, string> = {
    'dashboard': t('menu_dashboard', 'PAINEL'),
    'products': t('menu_products', 'ESTOQUE'),
    'categories': t('menu_categories', 'CATEGORIAS'),
    'addons': t('menu_addons', 'COMPLEMENTOS'),
    'new-sale': t('menu_new-sale', 'VENDA DIRETA'),
    'sales-history': t('menu_sales-history', 'HISTÓRICO'),
    'reports': t('menu_reports', 'RELATÓRIOS'),
    'tables': t('menu_tables', 'MESAS'),
    'deliveries': t('menu_deliveries', 'ENTREGAS'),
    'user-management': 'GESTÃO DE USUÁRIOS',
    'customer-management': 'GESTÃO DE LICENÇAS',
    'fiados': t('menu_fiados', 'CONTROLE DE FIADOS'),
    'settings': t('menu_settings', 'CONFIGURAÇÕES'),
    'payment': t('menu_payment', 'PAGAMENTOS'),
    'plan-management': 'PLANOS & OFERTAS',
    'my-plan': t('menu_my-plan', 'MEU PLANO'),
    'employee-management': t('menu_employee-management', 'FUNCIONÁRIOS'),
    'support': t('menu_support', 'SUPORTE'),
    'affiliates': 'AFILIADOS',
    'employee-consumption': t('menu_employee-consumption', 'CONSUMO DE FUNCIONÁRIOS'),
    'employee-reports': t('menu_employee-reports', 'RELATÓRIOS DE EQUIPE'),
    'kds': 'KDS - COZINHA',
    'suppliers': 'FORNECEDORES',
    'financial-flow': 'FLUXO FINANCEIRO',
    'reservations': 'RESERVAS',
    'not-found': 'PÁGINA NÃO ENCONTRADA',
  };

  const handleNavigate = useCallback((view: View, tab?: any) => {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    // Restrição para Afiliados: só podem acessar a aba de afiliados e suporte
    if (currentUser.role === 'affiliate' && view !== 'affiliates' && view !== 'support' && !currentUser.isDemoViewer) return;

    if (view === 'affiliates' && settings.affiliateSystemEnabled === false) return;

    if (view === 'tables') {
      const globalEnabled = settings.tablesSystemEnabled !== false;
      const userEnabled = currentUser.canAccessTables !== false;
      if (!globalEnabled || !userEnabled) return;
    }

    const isMasterArea = ['user-management', 'customer-management', 'plan-management'].includes(view);
    if (isMasterArea && currentUser.tenantId !== 'MASTER') return;

    // Restrição para Funcionários: só podem acessar o que tem permissão explícita
    if (currentUser.role === 'employee' && currentUser.permissions && !currentUser.permissions.includes(view)) {
      // Se não tiver permissão, não navega
      return;
    }
    
    setSettingsTab(tab || null);
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  }, [settings.affiliateSystemEnabled]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const shortcuts = settings.menuShortcuts || {};
      
      // Map views to their configured shortcuts
      const viewByShortcut: Record<string, View> = {};
      Object.entries(shortcuts).forEach(([view, key]) => {
        if (typeof key === 'string') {
          viewByShortcut[key.toUpperCase()] = view as View;
        }
      });

      const pressedKey = e.key.toUpperCase();
      
      // If the pressed key is one of our shortcuts, handle it
      if (viewByShortcut[pressedKey]) {
        const activeElement = document.activeElement;
        const isTyping = activeElement instanceof HTMLInputElement || 
                         activeElement instanceof HTMLTextAreaElement ||
                         (activeElement as HTMLElement)?.isContentEditable;

        // Se for uma tecla de função (F1-F12), sempre permite e previne o padrão
        const isFunctionKey = /^F\d+$/.test(pressedKey);
        
        // Se estiver digitando, só permite atalhos que sejam teclas de função
        // Isso evita que digitar "A" em um campo de busca dispare um atalho mapeado para "A"
        if (isTyping && !isFunctionKey) return;

        e.preventDefault();
        handleNavigate(viewByShortcut[pressedKey]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNavigate, settings.menuShortcuts]);

  const handleLogout = useCallback(() => {
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.role !== 'admin' && currentUser.cashierStatus === 'Aberto') {
        setLogoutError('Por segurança, realize o fechamento do seu caixa antes de sair.');
        setTimeout(() => setLogoutError(null), 5000);
        return;
    }
    setCurrentUser(null);
    setUser(null);
    setHasShownGlobalMessage(false);
  }, []);

  // Bloqueio Automático de Demo Expirada
  useEffect(() => {
    if (user?.role === 'demo' && demoStatus.isExpired && user.active) {
      const handleExpire = async () => {
        const allUsers = await getUsers();
        const updatedUsers = allUsers.map(u => {
          if (u.id === user.id) {
            return { ...u, active: false, deactivatedMessage: 'DEMO_EXPIRADA' };
          }
          return u;
        });
        await saveUsers(updatedUsers);
        // alert removido por diretriz, mas aqui é um caso crítico de bloqueio.
        // O ideal seria um modal, mas como o handleLogout vai ser chamado, o usuário será deslogado.
        handleLogout();
      };
      handleExpire();
    }

    // Bloqueio de Clientes após Período de Carência (10 dias padrão)
    if (user?.role === 'customer' && user.expiresAt && user.active && !user.isDemoViewer) {
      const grace = user.gracePeriod ?? settings.defaultGracePeriod ?? 10;

      if (checkExpired(user.expiresAt, grace)) {
        const handleGraceExpire = async () => {
          const allUsers = await getUsers();
          const updatedUsers = allUsers.map(u => {
            if (u.id === user.id) {
              return { ...u, active: false, deactivatedMessage: 'LICENÇA EXPIRADA – PERÍODO DE CARÊNCIA ENCERRADO' };
            }
            return u;
          });
          await saveUsers(updatedUsers);
          handleLogout();
        };
        handleGraceExpire();
      }
    }
  }, [user, demoStatus.isExpired, handleLogout, settings.defaultGracePeriod]);

  const refreshData = useCallback(async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        setIsLoading(false);
        return;
    }
    
    try {
      const [
        localSetts, 
        prods, 
        sls, 
        exps, 
        cons,
        dels, 
        accReqs, 
        payReqs,
        openShift,
        fiadosData,
        affPayReqs,
        supportTickets,
        addonsData,
        categoriesData,
        tablesData,
        customersData
      ] = await Promise.all([
        getAppSettings(currentUser.tenantId || 'MASTER'),
        getProducts(),
        getSales(),
        getExpenses(),
        getConsumptions(),
        getDeliveries(),
        getAccessRequests(),
        getPaymentRequests(),
        getOpenShift(currentUser.id),
        getFiados(),
        getAffiliatePaymentRequests(),
        getSupportTickets(),
        getAddons(),
        getCategories(),
        getTables(),
        getCustomers(currentUser.tenantId || 'MASTER')
      ]);

      setProducts(prods.filter(p => p.active !== false));
      setAddons(addonsData);
      setCategories(categoriesData.filter(c => c.active !== false));
      setTables(tablesData);
      setCustomers(customersData);
      setLowStockCount(prods.filter(p => p.active !== false && p.stock < LOW_STOCK_LIMIT).length);
      setLowAddonsCount(addonsData.filter(a => a.totalQuantity < 50).length);
      const usedCategoryIds = new Set(prods.filter(p => p.active !== false).map(p => p.categoryId).filter(id => !!id));
      const usedCategoryNames = new Set(prods.filter(p => p.active !== false).map(p => (p.category || '').toUpperCase()));
      setInactiveCategoriesCount(categoriesData.filter(c => 
        c.active === false && (usedCategoryIds.has(c.id) || usedCategoryNames.has(c.name.toUpperCase()))
      ).length);
      setInactiveProductsCount(prods.filter(p => p.active === false).length);
      setSales(sls);
      setExpenses(exps);
      setFiados(fiadosData);
      setConsumptions(cons);
      setPendingDeliveriesCount(dels.filter(d => d.deliveryStage !== 'paused').length);
      setPendingAccessRequestsCount(accReqs.filter(r => r && r.status === 'pending' && !r.affiliateId).length);
      setPendingAffiliateAccessRequestsCount(accReqs.filter(r => r && r.status === 'pending' && r.affiliateId).length);
      setPendingPaymentRequestsCount(payReqs.filter(p => p.status === 'pending').length);
      setPendingAffiliatePayoutsCount(affPayReqs.filter(r => r.status === 'pending').length);
      setPendingSupportResponsesCount(supportTickets.filter(t => t.userId === currentUser.id && t.status === 'replied' && !t.isReadByCustomer).length);
      
      setActiveShift(openShift);

      // Correção do Loop Infinito: Só abre o modal se não estiver fechando, processando ou se já não tiver fechado nesta sessão
      if (!openShift && 
          currentUser.role === 'employee' && 
          !currentUser.skipCashierClosure && 
          !isCashierOpening && 
          !isCashierClosing && 
          !isProcessingShift && 
          currentUser.cashierStatus !== 'Fechado'
      ) {
        setIsCashierOpening(true);
      }

      const menuStructure = localSetts.menuStructure || DEFAULT_MENU_STRUCTURE;
      
      // Ensure 'addons' is present in the inventory section if it's missing
      const updatedMenuStructure = menuStructure.map(cat => {
        if (cat.id === 'inventory' && !cat.items.includes('addons')) {
          return { ...cat, items: [...cat.items, 'addons'] };
        }
        return cat;
      });

      setSettings({
        ...localSetts,
        menuStructure: updatedMenuStructure
      });
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isCashierOpening, isCashierClosing, isProcessingShift]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000);
    
    const handleUpdate = () => refreshData();
    window.addEventListener('p4zz_data_updated', handleUpdate);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('p4zz_data_updated', handleUpdate);
    };
  }, [refreshData, user?.id]);

  const handleOpenShift = async () => {
    if (!user || isProcessingShift) return;
    const cash = parseFloat(initialCashInput);
    if (isNaN(cash) || cash < 0) {
        alert("Valor inválido.");
        return;
    }
    setIsProcessingShift(true);
    try {
        const shift = await openCashierShift(user.id, user.tenantId, user.name, cash);
        setActiveShift(shift);
        setIsCashierOpening(false);
        setInitialCashInput('');
        const updatedUser = { ...user, cashierStatus: 'Aberto' as const };
        setCurrentUser(updatedUser);
        setUser(updatedUser);
    } finally {
        setIsProcessingShift(false);
    }
  };

  const cashierSummary = useMemo(() => {
    if (!activeShift) return { pix: 0, card: 0, cash: 0, totalExpected: 0 };
    const shiftSales = sales.filter(s => 
        s.userId === activeShift.userId && 
        s.status === 'Concluída' && 
        new Date(s.date) >= new Date(activeShift.openDate)
    );
    const pix = shiftSales.filter(s => s.paymentMethod === 'Pix').reduce((acc, s) => acc + s.total, 0);
    const card = shiftSales.filter(s => s.paymentMethod === 'Cartão').reduce((acc, s) => acc + s.total, 0);
    const cash = shiftSales.filter(s => s.paymentMethod === 'Dinheiro').reduce((acc, s) => acc + s.total, 0);
    return { 
        pix, card, cash, 
        totalExpected: activeShift.initialCash + cash 
    };
  }, [sales, activeShift]);

  const handleCloseShift = async () => {
    if (!user || !activeShift || isProcessingShift) return;
    const finalCash = parseFloat(finalCashInput);
    if (isNaN(finalCash) || finalCash < 0) {
        alert("Informe o valor contado.");
        return;
    }
    setIsProcessingShift(true);
    try {
        const metrics = cashierSummary;
        const totalInformed = metrics.pix + metrics.card + finalCash;
        const closure: CashierClosure = {
            id: Math.random().toString(36).substr(2, 9),
            userId: user.id, userName: user.name, tenantId: user.tenantId,
            date: new Date().toISOString(),
            systemPix: metrics.pix, systemCard: metrics.card, systemCash: metrics.cash,
            informedPix: metrics.pix, informedCard: metrics.card, informedCash: finalCash,
            totalSystem: metrics.totalExpected, totalInformed: totalInformed,
            difference: totalInformed - metrics.totalExpected
        };
        await saveCashierClosure(closure);
        await closeCashierShift(activeShift.id, finalCash);
        
        const updatedUser = { ...user, cashierStatus: 'Fechado' as const };
        setCurrentUser(updatedUser);
        setUser(updatedUser);
        setActiveShift(null);
        setIsCashierClosing(false);
        setFinalCashInput('');
        alert("Caixa fechado com sucesso.");
    } catch (err) {
        alert("Erro ao fechar o caixa.");
    } finally {
        setIsProcessingShift(false);
    }
  };

  const workspaceContrastColor = useMemo(() => {
    const isCustomBg = settings.workspaceBgColorEnabled;
    
    // A cor de fundo base real que o usuário está vendo
    const bgColor = isCustomBg 
      ? (settings.workspaceBgColor || (settings.themeMode === 'dark' ? '#020617' : '#f8fafc')) 
      : (settings.themeMode === 'dark' ? '#020617' : '#f8fafc');
    
    const color = bgColor.replace('#', '');
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#0f172a' : '#ffffff';
  }, [settings.workspaceBgColor, settings.workspaceBgColorEnabled, settings.themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    if (settings.themeMode === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    
    const isCustomBg = settings.workspaceBgColorEnabled;
    
    const finalBg = isCustomBg 
      ? (settings.workspaceBgColor || (settings.themeMode === 'dark' ? '#020617' : '#f8fafc')) 
      : (settings.themeMode === 'dark' ? '#020617' : '#f8fafc');

    const finalPrimary = settings.primaryColor || '#4f46e5';

    root.style.setProperty('--sidebar-width', isSidebarExpanded ? `${settings.sidebarWidth || 255}px` : '80px');
    root.style.setProperty('--workspace-bg', finalBg);
    root.style.setProperty('--workspace-text', workspaceContrastColor);
    root.style.setProperty('--primary-color', finalPrimary);
    
    // Injetar tons da cor primária para o Tailwind
    root.style.setProperty('--primary-600', finalPrimary);
    root.style.setProperty('--primary-500', finalPrimary); // Simplificado: usa a mesma cor
    root.style.setProperty('--primary-700', finalPrimary); // Simplificado
    root.style.setProperty('--primary-100', `${finalPrimary}20`); // 12% opacidade para tons claros
    root.style.setProperty('--primary-50', `${finalPrimary}10`);  // 6% opacidade
  }, [settings, isSidebarExpanded, workspaceContrastColor]);

  useEffect(() => {
    if (user?.role === 'affiliate' && currentView !== 'affiliates' && currentView !== 'support') {
      setCurrentView('affiliates');
    }
  }, [user, currentView]);

  if (window.location.pathname === '/cozinha/monitor') {
    return <KitchenMonitor />;
  }

  if (!user) {
    if (currentView === ('reset-password' as any)) {
      return <ResetPassword settings={settings} />;
    }
    return <Login settings={settings} onLoginSuccess={(u) => { 
      setCurrentView(u.role === 'affiliate' ? 'affiliates' : 'dashboard'); 
      setUser(u); 
      setHasShownGlobalMessage(false);
      refreshData(); 
    }} />;
  }

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className={`flex min-h-screen ${(isDemo || isDemoViewer) ? 'pt-8' : ''} ${isDemoViewer ? 'is-demo-viewer' : ''} relative`} style={{ color: 'var(--workspace-text)' }}>
       {/* Fundo Dinâmico do Workspace */}
       <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" style={{ backgroundColor: 'var(--workspace-bg)' }}>
         {settings.workspaceTheme && settings.workspaceTheme !== 'none' && (
           <LoginEffects 
             effect={settings.workspaceTheme} 
             color={settings.workspaceThemeColorEnabled ? (settings.workspaceThemeColor || settings.primaryColor) : settings.primaryColor} 
           />
         )}
       </div>

       {(isDemo || isDemoViewer) && (
         <div className={`fixed top-0 left-0 right-0 h-8 ${isDemoViewer ? 'bg-indigo-600' : 'bg-amber-400'} text-white z-[9999] flex items-center justify-center font-black text-[10px] uppercase tracking-[0.2em] shadow-md border-b ${isDemoViewer ? 'border-indigo-700' : 'border-amber-500'}`}>
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeWidth={2.5}/></svg>
              {isDemoViewer ? 'Modo Demonstração – Este painel é apenas para visualização. Nenhuma alteração será salva.' : `CONTA DEMO ATIVA — EXPIRA EM: ${demoStatus.expiryStr} (${demoStatus.text})`}
            </span>
         </div>
       )}

       <Sidebar 
        currentView={currentView} onNavigate={handleNavigate} user={user} onLogout={handleLogout} settings={settings}
        onToggleTheme={() => setSettings({...settings, themeMode: settings.themeMode === 'light' ? 'dark' : 'light'})}
        isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} isExpanded={isSidebarExpanded}
        onToggleExpand={() => setIsSidebarExpanded(!isSidebarExpanded)}
        pendingDeliveriesCount={pendingDeliveriesCount} pendingAccessRequestsCount={pendingAccessRequestsCount}
        pendingPaymentRequestsCount={pendingPaymentRequestsCount} 
        pendingAffiliatePayoutsCount={pendingAffiliatePayoutsCount + pendingAffiliateAccessRequestsCount} 
        pendingSupportResponsesCount={pendingSupportResponsesCount}
        lowStockCount={lowStockCount}
        lowAddonsCount={lowAddonsCount}
        inactiveCategoriesCount={inactiveCategoriesCount}
        inactiveProductsCount={inactiveProductsCount}
      />

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[60] lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      <div 
        className={`flex-1 flex flex-col transition-all duration-300 min-w-0 relative z-10
          ${isSidebarExpanded ? 'lg:ml-[var(--sidebar-width)]' : 'lg:ml-20'} 
          ml-0`}
      >
        <header className="p-4 md:p-6 border-b dark:border-slate-800 flex justify-between items-center no-print sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-sm">
           <div className="flex items-center gap-3 md:gap-4">
             <button 
               onClick={() => setIsMobileMenuOpen(true)}
               className="p-2.5 lg:hidden text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all active:scale-90 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-sm"
               aria-label="Abrir Menu"
             >
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 8h16M4 16h16" />
               </svg>
             </button>
             <div className="flex flex-col">
               <h1 className="text-xs md:text-xl font-black uppercase pr-2 md:pr-4 truncate max-w-[150px] md:max-w-none tracking-tight">{VIEW_LABELS[currentView]}</h1>
               <span className="lg:hidden text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em] -mt-0.5">{settings.systemName}</span>
             </div>
           </div>
           <div className="flex items-center gap-2">
             {user.role === 'employee' && !user.skipCashierClosure && user.cashierStatus === 'Aberto' && (
               <button onClick={() => setIsCashierClosing(true)} className="px-3 md:px-4 py-2 md:py-2.5 bg-rose-600 text-white rounded-xl font-black text-[9px] md:text-xs uppercase shadow-lg active:scale-95 transition-all">Fechar Caixa</button>
             )}
             <div className="w-9 h-9 md:w-10 md:h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-sm">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="User" className="w-full h-full object-cover p-1" />
                ) : (
                  <span className="text-xs font-black italic text-slate-400">{user.name.substring(0, 1)}</span>
                )}
             </div>
           </div>
        </header>

        <main className="p-4 md:p-6 flex-1 overflow-y-auto">
          {currentView === 'dashboard' && (
            <Dashboard 
              products={products} 
              addons={addons}
              sales={sales} 
              expenses={expenses} 
              tables={tables}
              customers={customers}
              categories={categories}
              onNavigate={handleNavigate}
              settings={settings}
            />
          )}
          {currentView === 'products' && <ProductList products={products} addons={addons} onUpdate={refreshData} />}
          {currentView === 'addons' && <ProductList products={products} addons={addons} onUpdate={refreshData} initialTab="addons" />}
          {currentView === 'categories' && <CategoryManagement />}
          {currentView === 'new-sale' && <NewSale products={products} onSaleComplete={refreshData} onBack={() => handleNavigate('dashboard')} onNavigate={handleNavigate} />}
          {currentView === 'sales-history' && <SalesHistory sales={sales} onRefresh={refreshData} />}
          {currentView === 'reports' && <Reports sales={sales} products={products} expenses={expenses} consumptions={consumptions} user={user} />}
          {currentView === 'tables' && <Tables products={products} onBack={() => handleNavigate('dashboard')} onUpdate={refreshData} />}
          {currentView === 'deliveries' && <Deliveries products={products} onRefresh={refreshData} />}
          {currentView === 'user-management' && <UserManagement />}
          {currentView === 'customer-management' && <CustomerManagement />}
          {currentView === 'fiados' && <FiadoManagement fiados={fiados} onUpdate={refreshData} />}
          {currentView === 'settings' && <AdminSettings settings={settings} onUpdateSettings={setSettings} initialTab={settingsTab} />}
          {currentView === 'payment' && <Payment onUpdate={refreshData} onNavigate={handleNavigate} />}
          {currentView === 'plan-management' && <PlanManagement />}
          {currentView === 'my-plan' && <MyPlan />}
          {currentView === 'employee-management' && <EmployeeManagement onNavigate={handleNavigate} />}
          {currentView === 'support' && <Support onUpdate={refreshData} />}
          {currentView === 'affiliates' && <AffiliateManagement />}
          {currentView === 'employee-reports' && <EmployeeReports />}
          {currentView === 'kds' && <KDS settings={settings} />}
          {currentView === 'suppliers' && <SupplierManagement settings={settings} />}
          {currentView === 'financial-flow' && <FinancialFlow settings={settings} />}
          {currentView === 'reservations' && <Reservations settings={settings} />}
          {currentView === ('reset-password' as any) && <ResetPassword settings={settings} />}
          {currentView === 'not-found' && <NotFound settings={settings} onBack={() => handleNavigate('dashboard')} />}
        </main>
        {settings.footerText && (
          <footer className="p-6 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400 opacity-60 no-print">
            {settings.footerText}
          </footer>
        )}
      </div>

      {isCashierOpening && (
         <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl text-center">
                <h3 className="text-xl font-black uppercase italic mb-4">Abertura de Caixa</h3>
                <input autoFocus type="number" value={initialCashInput} onChange={e => setInitialCashInput(e.target.value)} className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-2xl font-black text-center mb-6 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="R$ 0.00" />
                <div className="space-y-3">
                  <button onClick={handleOpenShift} disabled={isProcessingShift} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg">Abrir Turno</button>
                  <button onClick={handleLogout} className="w-full py-3 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-rose-600 transition-colors">Sair da Conta</button>
                </div>
            </div>
         </div>
      )}

      {isCashierClosing && (
         <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-black uppercase italic mb-4 text-center">Fechamento</h3>
                <div className="space-y-3 mb-6 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl">
                    <div className="flex justify-between text-xs font-bold uppercase"><span>Entradas Dinheiro:</span><span>R$ {cashierSummary.cash.toFixed(2)}</span></div>
                    <div className="flex justify-between font-black border-t dark:border-slate-700 pt-2 mt-2"><span>Esperado:</span><span className="text-indigo-600">R$ {cashierSummary.totalExpected.toFixed(2)}</span></div>
                </div>
                <input autoFocus type="number" value={finalCashInput} onChange={e => setFinalCashInput(e.target.value)} className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl text-2xl font-black text-center mb-6 outline-none focus:ring-2 focus:ring-rose-500" placeholder="R$ 0.00" />
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setIsCashierClosing(false)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black uppercase text-xs">Voltar</button>
                    <button onClick={handleCloseShift} disabled={isProcessingShift} className="py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg">Fechar</button>
                </div>
            </div>
         </div>
      )}

      {logoutError && (
        <div className="fixed bottom-10 right-10 bg-rose-600 text-white p-4 rounded-xl shadow-2xl z-[1000] font-black uppercase text-xs animate-in slide-in-from-bottom-4">
            {logoutError}
        </div>
      )}

      {settings.globalMessageEnabled && settings.globalMessageText && !hasShownGlobalMessage && user && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[3rem] w-full max-w-2xl shadow-2xl relative border border-slate-100 dark:border-white/5 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
            <button 
              onClick={() => setHasShownGlobalMessage(true)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-rose-500 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center text-indigo-600 shadow-inner">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">Aviso do Sistema</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">Informação Importante</p>
              </div>
              
              <div className="w-full bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[2rem] border border-slate-100 dark:border-white/5">
                <p className="text-sm md:text-base font-bold text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {settings.globalMessageText}
                </p>
              </div>
              
              <button 
                onClick={() => setHasShownGlobalMessage(true)}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[12px] shadow-xl shadow-indigo-500/20 active:scale-95 transition-all hover:brightness-110"
              >
                Entendido e Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;