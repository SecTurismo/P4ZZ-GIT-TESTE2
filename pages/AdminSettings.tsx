import React, { useState, useRef, useEffect } from 'react';
import { Upload, QrCode, Download, Save, Trash2, FileText, Search, Link as LinkIcon, Home, MessageSquare, Facebook, Instagram, Twitter, Linkedin, Youtube, Mail, Palette, Layers, Plus, X, ShieldAlert, Monitor, DollarSign, Calendar, Truck, Bell, Type as TypeIcon, User as UserIcon, Lock, Clock, Tv, Square, Play } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { uploadFile } from '../services/upload';
import { AppSettings, View, MenuCategory } from '../types';
import { MarketingSection } from '../src/components/MarketingSection';
import { 
  saveAppSettings, exportFullBackup, exportTenantBackup, 
  importFullBackup, getCurrentUser, DEFAULT_MENU_STRUCTURE, getAppSettings,
  notifyDataChanged, saveMenuBackup, getMenuBackup, DEFAULT_SETTINGS
} from '../services/storage';

const AdminSettings: React.FC<{ 
  settings: AppSettings; 
  onUpdateSettings: (settings: AppSettings) => void;
  initialTab?: 'workspace' | 'marketing' | 'menu' | 'loginButtons' | 'data' | 'payments' | 'hosting' | 'ia' | 'printing' | 'demo' | 'modules' | 'personal';
}> = ({ settings, onUpdateSettings, initialTab }) => {
  const user = getCurrentUser();
  const isMaster = user?.tenantId === 'MASTER' && user?.role === 'admin';
  const isDemoViewer = user?.isDemoViewer;
  const isCustomerOrDemo = user?.role === 'customer' || user?.role === 'demo';
  const canSeeModules = isMaster || isCustomerOrDemo;
  
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());
  const lastSettingsRef = useRef(JSON.stringify(settings));
  const [activeTab, setActiveTab] = useState<'workspace' | 'marketing' | 'menu' | 'loginButtons' | 'data' | 'payments' | 'hosting' | 'ia' | 'printing' | 'demo' | 'errorPages' | 'modules' | 'personal'>(initialTab || 'workspace');
  const [showSuccessToast, setShowToast] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<string | null>(null);
  const [testAudio, setTestAudio] = useState<HTMLAudioElement | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [showMenuConfirm, setShowMenuConfirm] = useState<{
    show: boolean;
    title: string;
    action: () => void;
    color: string;
  }>({
    show: false,
    title: '',
    action: () => {},
    color: 'bg-indigo-600'
  });

  // Sincronizar localSettings apenas quando settings mudar de fato (ex: via save ou outro tenant)
  useEffect(() => {
    const currentSettingsStr = JSON.stringify(settings);
    if (currentSettingsStr !== lastSettingsRef.current) {
      setLocalSettings(settings);
      lastSettingsRef.current = currentSettingsStr;
    }
  }, [settings]);
  
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Por favor, selecione um arquivo PDF válido.');
        return;
      }
      // Limite de 1MB conforme solicitado
      if (file.size > 1 * 1024 * 1024) {
        alert('O arquivo PDF deve ter no máximo 1MB.');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      if (localSettings.qrCodeMenuPdf) {
        formData.append('oldPath', localSettings.qrCodeMenuPdf);
      }

      try {
        const url = await uploadFile(file, 'menu_pdfs');
        handleUpdate({ qrCodeMenuPdf: url });
      } catch (error) {
        console.error('Erro no upload do PDF:', error);
        alert('Erro ao fazer upload do PDF para o Firebase Storage.');
      } finally {
        e.target.value = '';
      }
    }
  };

  const handleSaleSoundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg'];
      if (!allowedTypes.includes(file.type)) {
        alert('Por favor, selecione um arquivo de áudio válido (MP3, WAV ou OGG).');
        return;
      }
      // Limite de 1MB conforme solicitado
      if (file.size > 1 * 1024 * 1024) {
        alert('O arquivo de áudio deve ter no máximo 1MB.');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      if (localSettings.saleConfirmationSoundUpload) {
        formData.append('oldPath', localSettings.saleConfirmationSoundUpload);
      }

      try {
        const url = await uploadFile(file, 'sounds');
        handleUpdate({ saleConfirmationSoundUpload: url });
      } catch (error) {
        console.error('Erro no upload do áudio:', error);
        alert('Erro ao fazer upload do áudio para o Firebase Storage.');
      } finally {
        e.target.value = '';
      }
    }
  };

  const validateAudioUrl = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!url || url.trim() === '') {
        setAudioError(null);
        resolve(true);
        return;
      }
      const audio = new Audio();
      
      const timeout = setTimeout(() => {
        setAudioError('Tempo limite de carregamento excedido. Verifique o link.');
        resolve(false);
      }, 5000);

      audio.oncanplaythrough = () => {
        clearTimeout(timeout);
        setAudioError(null);
        resolve(true);
      };
      audio.onerror = () => {
        clearTimeout(timeout);
        setAudioError('O link informado não contém um arquivo de áudio válido.');
        resolve(false);
      };
      audio.src = url;
    });
  };

  const testSaleSound = () => {
    if (testAudio) {
      testAudio.pause();
      testAudio.currentTime = 0;
      setTestAudio(null);
      return;
    }

    let soundUrl = localSettings.saleConfirmationSoundUpload || localSettings.saleConfirmationSoundUrl;
    
    if (!soundUrl || soundUrl.trim() === '') {
      soundUrl = 'https://assets.mixkit.co/active_storage/sfx/2431/2431-preview.mp3';
    }

    try {
      const audio = new Audio(soundUrl);
      
      // Adicionar listener para erro antes de tentar tocar
      audio.onerror = () => {
        setTestAudio(null);
        alert('Erro: O link informado não contém um arquivo de áudio válido ou o formato não é suportado.');
      };

      audio.oncanplaythrough = () => {
        audio.play().catch(err => {
          setTestAudio(null);
          console.error('Erro ao reproduzir som de teste:', err);
          if (err.name === 'NotAllowedError') {
            alert('Erro: A reprodução automática foi bloqueada pelo navegador. Interaja com a página e tente novamente.');
          } else {
            alert('Erro ao reproduzir som. Verifique se a URL é válida ou se o arquivo foi carregado corretamente.');
          }
        });
      };

      setTestAudio(audio);
      
      audio.onended = () => {
        setTestAudio(null);
      };
    } catch (err) {
      console.error('Erro ao criar objeto de áudio:', err);
      alert('Erro ao carregar o áudio. Verifique o link ou o arquivo.');
    }
  };

  const downloadQRCode = (id: string, fileName: string) => {
    const canvas = document.getElementById(id) as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const plansIconRef = useRef<HTMLInputElement>(null);
  const requestIconRef = useRef<HTMLInputElement>(null);
  const regularizeIconRef = useRef<HTMLInputElement>(null);
  const supportIconRef = useRef<HTMLInputElement>(null);
  const marketingImageInputRef = useRef<HTMLInputElement>(null);
  const saleSoundInputRef = useRef<HTMLInputElement>(null);

  const [loginBoxSpecs, setLoginBoxSpecs] = useState({ width: 360, height: 700, borderRadius: 72, padding: 40 });

  useEffect(() => {
    const el = document.getElementById('login-box-preview');
    if (!el) return;

    const measure = () => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      
      // O transform: scale(0.8) afeta o getBoundingClientRect, mas não o getComputedStyle (width/height)
      // No entanto, se o elemento tiver max-width ou flexbox, o getComputedStyle.width pode ser 'auto' ou o valor resolvido.
      // Para garantir a precisão do que está renderizado, usamos rect e dividimos pela escala.
      
      setLoginBoxSpecs({
        width: Math.round(rect.width / 0.8),
        height: Math.round(rect.height / 0.8),
        borderRadius: parseInt(style.borderRadius) || 0,
        padding: parseInt(style.padding) || 0
      });
    };

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    
    // Medição inicial e após um pequeno delay para garantir que estilos inline/classes foram aplicados
    measure();
    const timer = setTimeout(measure, 100);
    
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [localSettings.loginBorderRadius, localSettings.loginBoxPadding, localSettings.loginBoxBgColor, localSettings.loginBoxScale]);

  const sidebarThemes = [
    { id: 'dark', label: 'Escuro' },
    { id: 'light', label: 'Claro' },
    { id: 'glacier', label: 'Minimalista' },
    { id: 'colored', label: 'Personalizado' }
  ];

  const allPossibleViews: {id: View, label: string}[] = [
    { id: 'dashboard', label: 'Painel Principal' },
    { id: 'new-sale', label: 'Venda Direta' },
    { id: 'tables', label: 'Mesas' },
    { id: 'deliveries', label: 'Entregas' },
    { id: 'products', label: 'Estoque' },
    { id: 'categories', label: 'Categorias' },
    { id: 'fiados', label: 'Fiados' },
    { id: 'sales-history', label: 'Histórico' },
    { id: 'reports', label: 'Relatórios' },
    { id: 'my-plan', label: 'Meu Plano' },
    { id: 'employee-management', label: 'Funcionários' },
    { id: 'support', label: 'Suporte' },
    { id: 'payment', label: 'Pagamentos' },
    { id: 'user-management', label: 'Usuários' },
    { id: 'customer-management', label: 'Licenças' },
    { id: 'plan-management', label: 'Planos' },
    { id: 'affiliates', label: 'Afiliados' },
    { id: 'addons', label: 'Insumos / Adicionais' },
    { id: 'employee-consumption', label: 'Consumo Funcionários' },
    { id: 'employee-reports', label: 'Relatórios Funcionários' },
    { id: 'kds', label: 'Monitor de Cozinha (KDS)' },
    { id: 'suppliers', label: 'Fornecedores' },
    { id: 'financial-flow', label: 'Fluxo de Caixa / DRE' },
    { id: 'reservations', label: 'Reservas de Mesas' },
    { id: 'settings', label: 'Configurações do Menu' }
  ];

  const getContrastColor = (hexColor: string) => {
    const color = hexColor.replace('#', '');
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#0f172a' : '#ffffff';
  };

  const workspaceContrast = getContrastColor(
    localSettings.workspaceBgColorEnabled 
      ? (localSettings.workspaceBgColor || (localSettings.themeMode === 'dark' ? '#020617' : '#f8fafc')) 
      : (localSettings.themeMode === 'dark' ? '#020617' : '#f8fafc')
  );

  const handleUpdate = (updates: Partial<AppSettings>) => {
    setLocalSettings(prev => ({ ...prev, ...updates }));
    Object.keys(updates).forEach(key => {
      setChangedKeys(prev => new Set(prev).add(key));
    });
  };

  const saveToStorage = async () => {
    if (localSettings.saleConfirmationSoundUrl) {
      const isValid = await validateAudioUrl(localSettings.saleConfirmationSoundUrl);
      if (!isValid) {
        alert('O link informado não contém um arquivo de áudio válido.');
        return;
      }
    }

    if (isMaster) {
      // Master salva tudo (Configuração Global)
      await saveAppSettings(localSettings, 'MASTER');
    } else {
      // Cliente salva apenas o que foi alterado (Sobreposições)
      const overrides: any = {};
      changedKeys.forEach(key => {
        overrides[key] = (localSettings as any)[key];
      });
      await saveAppSettings(overrides, user?.tenantId);
    }
    onUpdateSettings(localSettings);
    window.dispatchEvent(new CustomEvent('p4zz_data_updated'));
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
    // Limpar chaves alteradas após salvar
    setChangedKeys(new Set());
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tamanho (1MB)
      if (file.size > 1 * 1024 * 1024) {
        alert('A logo deve ter no máximo 1MB.');
        e.target.value = '';
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      if (localSettings.logoUrl) {
        formData.append('oldPath', localSettings.logoUrl);
      }
      
      try {
        const url = await uploadFile(file, 'logos');
        handleUpdate({ logoUrl: url });
      } catch (error) {
        console.error('Erro no upload:', error);
        alert('Erro ao fazer upload da logo para o Firebase Storage.');
      } finally {
        e.target.value = '';
      }
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar formatos
      const allowedTypes = ['image/x-icon', 'image/png', 'image/svg+xml', 'image/vnd.microsoft.icon'];
      if (!allowedTypes.includes(file.type) && !file.name.endsWith('.ico')) {
        alert('Formatos aceitos: .ico, .png, .svg');
        return;
      }

      // Validar tamanho (1MB)
      if (file.size > 1 * 1024 * 1024) {
        alert('O arquivo deve ter no máximo 1MB.');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      if (localSettings.faviconUrl) {
        formData.append('oldPath', localSettings.faviconUrl);
      }
      
      try {
        const url = await uploadFile(file, 'favicons');
        handleUpdate({ faviconUrl: url });
        
        // Aplicar favicon imediatamente
        const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = url;
        document.getElementsByTagName('head')[0].appendChild(link);
      } catch (error) {
        console.error('Erro no upload:', error);
        alert('Erro ao fazer upload do favicon para o Firebase Storage.');
      } finally {
        e.target.value = '';
      }
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: keyof AppSettings) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamanho (1MB)
    if (file.size > 1 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 1MB.');
      e.target.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    const oldPath = (localSettings as any)[field];
    if (oldPath) {
      formData.append('oldPath', oldPath);
    }
    
    try {
      const url = await uploadFile(file, 'icons');
      handleUpdate({ [field]: url });
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao fazer upload da imagem para o Firebase Storage.');
    } finally {
      e.target.value = '';
    }
  };

  const handleMarketingImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo (PNG, JPEG, GIF ou MP4)
    const allowedTypes = ['image/png', 'image/gif', 'image/jpeg', 'video/mp4'];
    if (!allowedTypes.includes(file.type)) {
      alert('Apenas arquivos PNG, JPEG, GIF ou MP4 são permitidos.');
      e.target.value = '';
      return;
    }

    // Validar tamanho (1MB para imagens, 10MB para vídeos)
    const isVideo = file.type === 'video/mp4';
    const maxSize = isVideo ? 10 * 1024 * 1024 : 1 * 1024 * 1024;
    if (file.size > maxSize) {
      alert(`O tamanho máximo permitido é ${isVideo ? '10MB' : '1MB'}.`);
      e.target.value = '';
      return;
    }

    try {
      const url = await uploadFile(file, 'marketing');
      handleUpdate({ loginMarketingImageUrl: url });
    } catch (error: any) {
      console.error('Erro no upload:', error);
      alert(error.message || 'Erro ao fazer upload da imagem de marketing para o Firebase Storage.');
    } finally {
      e.target.value = '';
    }
  };

  const handleLoginBoxBorderImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'image/png') {
      alert('Apenas arquivos PNG transparentes são permitidos para a borda.');
      e.target.value = '';
      return;
    }

    // Limite de 1MB conforme solicitado
    if (file.size > 1 * 1024 * 1024) {
      alert('O arquivo deve ter no máximo 1MB.');
      e.target.value = '';
      return;
    }

    try {
      const url = await uploadFile(file, 'borders');
      handleUpdate({ loginBoxBorderImageUrl: url });
    } catch (error: any) {
      console.error('Erro no upload:', error);
      alert(error.message || 'Erro ao fazer upload da borda para o Firebase Storage.');
    } finally {
      e.target.value = '';
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (importFullBackup(content)) {
          alert('Backup restaurado com sucesso! O sistema será reinicializado.');
          window.location.reload();
        } else {
          alert('Erro crítico: O arquivo de backup é inválido.');
        }
      };
      reader.readAsText(file);
    }
  };

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const currentStructure = JSON.parse(JSON.stringify(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE));
    currentStructure.push({
      id: 'cat_' + Math.random().toString(36).substr(2, 5),
      label: newCatName.toUpperCase(),
      items: []
    });
    handleUpdate({ menuStructure: currentStructure });
    setNewCatName('');
  };

  const removeCategory = (id: string) => {
    if (id === 'master') return;
    const currentStructure = JSON.parse(JSON.stringify(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE)).filter((c: MenuCategory) => c.id !== id);
    handleUpdate({ menuStructure: currentStructure });
    setConfirmDeleteCat(null);
  };

  const moveCategory = (index: number, direction: 'up' | 'down') => {
    const struct = JSON.parse(JSON.stringify(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE));
    if (direction === 'up' && index > 0) {
      [struct[index], struct[index - 1]] = [struct[index - 1], struct[index]];
    } else if (direction === 'down' && index < struct.length - 1) {
      [struct[index], struct[index + 1]] = [struct[index + 1], struct[index]];
    }
    handleUpdate({ menuStructure: struct });
  };

  const moveItemOrder = (catIdx: number, itemIdx: number, direction: 'up' | 'down') => {
    const struct = JSON.parse(JSON.stringify(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE));
    const items = [...struct[catIdx].items];
    if (direction === 'up' && itemIdx > 0) {
      [items[itemIdx], items[itemIdx - 1]] = [items[itemIdx - 1], items[itemIdx]];
    } else if (direction === 'down' && itemIdx < items.length - 1) {
      [items[itemIdx], items[itemIdx + 1]] = [items[itemIdx + 1], items[itemIdx]];
    }
    struct[catIdx].items = items;
    handleUpdate({ menuStructure: struct });
  };

  const updateItemLabel = (id: string, label: string) => {
    const labels = { ...(localSettings.customLabels || {}) };
    labels[`menu_${id}`] = label.toUpperCase();
    handleUpdate({ customLabels: labels });
  };

  const updateItemShortcut = (id: string, key: string) => {
    const shortcuts = { ...(localSettings.menuShortcuts || {}) };
    if (!key) {
      delete shortcuts[id];
    } else {
      Object.keys(shortcuts).forEach(k => {
        if (shortcuts[k] === key) delete shortcuts[k];
      });
      shortcuts[id] = key;
    }
    handleUpdate({ menuShortcuts: shortcuts });
  };

  const moveItemToCategory = (viewId: View, fromCatId: string, toCatId: string) => {
    let struct = JSON.parse(JSON.stringify(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE));
    
    // Remover de todas as categorias primeiro para garantir que não haja duplicatas
    struct = struct.map((cat: MenuCategory) => ({
      ...cat,
      items: cat.items.filter(i => i !== viewId)
    }));

    // Se o destino não for 'none', adicionar à categoria de destino
    if (toCatId !== 'none') {
      struct = struct.map((cat: MenuCategory) => {
        if (cat.id === toCatId) {
          return { ...cat, items: [...cat.items, viewId] };
        }
        return cat;
      });
    }

    handleUpdate({ menuStructure: struct });
  };

  const restoreMenuStructure = async () => {
    setShowMenuConfirm({
      show: true,
      title: 'Restaurar Gestor de Menu',
      color: 'bg-rose-600',
      action: async () => {
        const defaultCopy = JSON.parse(JSON.stringify(DEFAULT_MENU_STRUCTURE));
        
        // Limpar labels customizados do menu para voltar aos nomes padrão
        const newLabels = { ...(localSettings.customLabels || {}) };
        Object.keys(newLabels).forEach(key => {
          if (key.startsWith('menu_')) delete newLabels[key];
        });

        const updatedSettings: AppSettings = { 
          ...localSettings, 
          menuStructure: defaultCopy,
          menuShortcuts: {},
          customLabels: newLabels
        };
        
        // Persistir e atualizar
        await saveAppSettings(updatedSettings, user?.tenantId || 'MASTER');
        setLocalSettings(updatedSettings);
        onUpdateSettings(updatedSettings);
        notifyDataChanged();
        
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        alert('Gestor de Menu restaurado para o padrão com sucesso!');
        setShowMenuConfirm(prev => ({ ...prev, show: false }));
      }
    });
  };

  const moveLoginButton = (index: number, direction: 'up' | 'down') => {
    const currentOrder = [...(localSettings.loginButtonsOrder || ['Plans', 'Request', 'Regularize', 'Support'])];
    if (direction === 'up' && index > 0) {
      [currentOrder[index], currentOrder[index - 1]] = [currentOrder[index - 1], currentOrder[index]];
    } else if (direction === 'down' && index < currentOrder.length - 1) {
      [currentOrder[index], currentOrder[index + 1]] = [currentOrder[index + 1], currentOrder[index]];
    }
    handleUpdate({ loginButtonsOrder: currentOrder });
  };

  const restoreMarketingSettings = () => {
    const marketingFields: (keyof AppSettings)[] = [
      'loginSalesTitle', 'loginSalesTitleSize', 'loginSalesTitleX', 'loginSalesTitleY', 'loginSalesTitleAnim', 'loginSalesTitleColor', 'loginSalesTitleFont', 'loginSalesTitleWidth', 'loginSalesTitleHeight',
      'loginSalesText', 'loginSalesTextSize', 'loginSalesTextX', 'loginSalesTextY', 'loginSalesTextAnim', 'loginSalesTextColor', 'loginSalesTextFont', 'loginSalesTextWidth', 'loginSalesTextHeight',
      'loginFeatures', 'loginFeaturesX', 'loginFeaturesY', 'loginFeaturesAnimSpeed', 'loginFeaturesColor', 'loginFeaturesTextColor', 'loginFeaturesBorderRadius', 'loginFeaturesPadding', 'loginFeaturesGap', 'loginFeaturesAnimType',
      'loginMarketingLeft', 'loginMarketingTop', 'loginMarketingScale', 'loginMarketingAlign', 'loginMarketingFontSize', 'loginMarketingTitleSize', 'loginMarketingTitleOpacity', 'loginMarketingFeatureFontSize', 'loginMarketingFeatureIconSize', 'loginMarketingFeatureGap', 'loginMarketingFeaturePadding', 'loginMarketingFeatureBorderRadius', 'loginMarketingTitleLetterSpacing', 'loginMarketingFeatureScale', 'loginMarketingFeatureOpacity', 'loginMarketingFeatureMoveX', 'loginMarketingFeatureAnim', 'loginMarketingFeatureAnimSpeed', 'loginMarketingFeatureWidth', 'loginMarketingFeaturesSideBySide',
      'loginBoxTop', 'loginBoxLeft', 'loginBoxScale', 'loginBoxPadding',
      'loginBoxBgColor', 'loginBoxBorderColor', 'loginBoxTitleColor', 'loginBoxBtnColor', 'loginBoxTextColor', 'loginBoxPlaceholderColor',
      'loginBoxBgColorEnabled', 'loginBoxBorderColorEnabled', 'loginBoxTitleColorEnabled', 'loginBoxBtnColorEnabled', 'loginBoxTextColorEnabled', 'loginBoxPlaceholderColorEnabled',
      'loginBalloonColor', 'loginBalloonHeight', 'loginEffect', 'loginEffectColor', 'loginEffectColorEnabled',
      'loginMarketingImageEnabled', 'loginMarketingImageUrl', 'loginMarketingImageX', 'loginMarketingImageY', 'loginMarketingImageScale', 'loginMarketingImageAnim', 'loginMarketingTextEnabled',
      'loginScreenBgColor', 'loginMarketingPrimaryColor', 'loginThematicBorder'
    ];

    const restored: Partial<AppSettings> = {};
    marketingFields.forEach(field => {
      if (field in DEFAULT_SETTINGS) {
        (restored as any)[field] = (DEFAULT_SETTINGS as any)[field];
      }
    });

    handleUpdate(restored);
    alert('Configurações de Marketing restauradas para o padrão original!');
  };

  const renderButtonConfigGroup = (type: 'Plans' | 'Request' | 'Regularize' | 'Support', index: number, total: number) => {
    const iconRef = type === 'Plans' ? plansIconRef : type === 'Request' ? requestIconRef : type === 'Regularize' ? regularizeIconRef : supportIconRef;
    const title = type === 'Plans' ? 'Botão: Nossos Planos' : type === 'Request' ? 'Botão: Solicitar Acesso' : type === 'Regularize' ? 'Botão: Regularização' : 'Botão: Suporte VIP';
    const themeColor = type === 'Plans' ? '#4f46e5' : type === 'Request' ? '#10b981' : type === 'Regularize' ? '#f59e0b' : '#059669';
    
    const enabledKey = `loginBtn${type}Enabled` as keyof AppSettings;
    const iconKey = `loginBtn${type}Icon` as keyof AppSettings;
    const showIconKey = `loginBtn${type}ShowIcon` as keyof AppSettings;
    const textKey = `loginBtn${type}Text` as keyof AppSettings;
    const subtextKey = `loginBtn${type}Subtext` as keyof AppSettings;
    const colorKey = `loginBtn${type}Color` as keyof AppSettings;
    const textColorKey = `loginBtn${type}TextColor` as keyof AppSettings;
    
    return (
      <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6 relative group/box">
        <div className="flex items-center justify-between border-b dark:border-white/5 pb-3">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox" 
              checked={localSettings[enabledKey] !== false} 
              onChange={e => handleUpdate({ [enabledKey]: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: themeColor }}></div>
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white italic">{title}</h4>
          </div>
          <div className="flex gap-1">
             <button onClick={() => moveLoginButton(index, 'up')} disabled={index === 0} className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm text-slate-400 disabled:opacity-0 transition-all" style={{ '--hover-color': localSettings.primaryColor || '#4f46e5' } as any} onMouseEnter={e => e.currentTarget.style.color = localSettings.primaryColor || '#4f46e5'} onMouseLeave={e => e.currentTarget.style.color = ''}>
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" strokeWidth={3}/></svg>
             </button>
             <button onClick={() => moveLoginButton(index, 'down')} disabled={index === total - 1} className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm text-slate-400 disabled:opacity-0 transition-all" style={{ '--hover-color': localSettings.primaryColor || '#4f46e5' } as any} onMouseEnter={e => e.currentTarget.style.color = localSettings.primaryColor || '#4f46e5'} onMouseLeave={e => e.currentTarget.style.color = ''}>
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={3}/></svg>
             </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: localSettings.primaryColor || '#4f46e5' }}>1. Ícone</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className={`w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-opacity ${localSettings[showIconKey] === false ? 'opacity-30' : 'opacity-100'}`}>
                {localSettings[iconKey] ? <img src={localSettings[iconKey] as string} className="w-full h-full object-contain p-2" alt="icon" /> : <svg className="w-6 h-6 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 01-1.586-1.586a2 2 0 012.828 0L20 14" strokeWidth={2}/></svg>}
              </div>
              <div className="flex flex-col items-center gap-1">
                <button type="button" onClick={() => iconRef.current?.click()} className="text-[7px] font-black uppercase" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Escolher Imagem</button>
                {localSettings[iconKey] && (
                  <button type="button" onClick={() => handleUpdate({ [iconKey]: '' })} className="text-[7px] font-black uppercase text-rose-500">Remover Imagem</button>
                )}
              </div>
              <input type="file" ref={iconRef} className="hidden" accept="image/*" onChange={(e) => handleIconUpload(e, iconKey)} />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: localSettings.primaryColor || '#4f46e5' }}>2. Cores</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="color" value={localSettings[colorKey] as string || themeColor} onChange={e => handleUpdate({ [colorKey]: e.target.value })} className="w-8 h-8 min-w-[32px] min-h-[32px] shrink-0 rounded cursor-pointer border border-slate-200 dark:border-white/10 shadow-sm p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded" title="Cor de Fundo" />
              <input type="color" value={localSettings[textColorKey] as string || '#ffffff'} onChange={e => handleUpdate({ [textColorKey]: e.target.value })} className="w-8 h-8 min-w-[32px] min-h-[32px] shrink-0 rounded cursor-pointer border border-slate-200 dark:border-white/10 shadow-sm p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded" title="Cor do Texto" />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: localSettings.primaryColor || '#4f46e5' }}>3. Textos</p>
            <input value={localSettings[textKey] as string || ''} onChange={e => handleUpdate({ [textKey]: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl font-black text-[9px] uppercase outline-none focus:ring-1" style={{ '--tw-ring-color': localSettings.primaryColor || '#4f46e5' } as any} placeholder="TEXTO PRINCIPAL" />
            <input value={localSettings[subtextKey] as string || ''} onChange={e => handleUpdate({ [subtextKey]: e.target.value })} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-xl font-bold text-[8px] uppercase outline-none focus:ring-1" style={{ '--tw-ring-color': localSettings.primaryColor || '#4f46e5' } as any} placeholder="SUBTEXTO" />
          </div>
        </div>
      </div>
    );
  };

  const getTabBtnClass = (tabId: typeof activeTab) => `tab-btn px-6 md:px-8 py-3.5 md:py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${
    activeTab === tabId 
      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' 
      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
  }`;

  const handleTabClick = async (tabId: typeof activeTab) => {
    // Master admin tem acesso total
    if (isMaster) {
      setActiveTab(tabId);
      return;
    }

    setActiveTab(tabId);
  };

  return (
    <div className="max-w-[1400px] mx-auto pb-24 animate-in fade-in duration-500">
      {showSuccessToast && <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[150] bg-emerald-600 text-white px-8 py-4 rounded-full shadow-2xl font-black text-[9px] uppercase tracking-widest animate-in slide-in-from-top-4">Preferências Salvas</div>}

      <div className="flex flex-col items-center gap-2 mb-12 no-print">
        {/* Nível 1: (5 setores) */}
        <div className="bg-slate-200 dark:bg-slate-800 p-1.5 rounded-full flex shadow-sm whitespace-nowrap overflow-x-auto scrollbar-hide max-w-full border border-slate-300 dark:border-slate-700 z-10">
          <button onClick={() => handleTabClick('workspace')} className={getTabBtnClass('workspace')}>Workspace</button>
          {isMaster && <button onClick={() => handleTabClick('marketing')} className={getTabBtnClass('marketing')}>Marketing</button>}
          <button onClick={() => handleTabClick('menu')} className={getTabBtnClass('menu')}>Gestor Menu</button>
          {isMaster && <button onClick={() => handleTabClick('loginButtons')} className={getTabBtnClass('loginButtons')}>Botões Login</button>}
          {isMaster && <button onClick={() => handleTabClick('payments')} className={getTabBtnClass('payments')}>Faturamento</button>}
          <button onClick={() => handleTabClick('personal')} className={getTabBtnClass('personal')}>Pessoal</button>
        </div>

        {/* Nível 2: (7 setores) */}
        <div className="bg-slate-200 dark:bg-slate-800 p-1.5 rounded-full flex shadow-sm whitespace-nowrap overflow-x-auto scrollbar-hide max-w-full border border-slate-300 dark:border-slate-700 -mt-5 pt-6 z-0">
          <button onClick={() => handleTabClick('printing')} className={getTabBtnClass('printing')}>Impressão</button>
          {isMaster && <button onClick={() => handleTabClick('hosting')} className={getTabBtnClass('hosting')}>Hospedagem</button>}
          <button onClick={() => handleTabClick('data')} className={getTabBtnClass('data')}>Backup Dados</button>
          {isMaster && <button onClick={() => handleTabClick('errorPages')} className={getTabBtnClass('errorPages')}>Páginas de Erro</button>}
          {canSeeModules && <button onClick={() => handleTabClick('modules')} className={getTabBtnClass('modules')}>Módulos</button>}
          {isMaster && <button onClick={() => handleTabClick('ia')} className={getTabBtnClass('ia')}>Inteligência IA</button>}
          {isMaster && <button onClick={() => handleTabClick('demo')} className={getTabBtnClass('demo')}>Demo Viewer</button>}
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-900 p-6 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-xl no-print">
        {activeTab === 'printing' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-4">
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Configurações de Impressão</h3>
              </div>
              
              <div className="grid grid-cols-1 gap-10">
                {/* Recibo do Cliente */}
                <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
                  <div className="flex items-center justify-between border-b dark:border-white/5 pb-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>1. Recibo do Cliente (Venda/Mesa)</h4>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={localSettings.printSettings?.customerReceipt?.showItemsPrice ?? true} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, customerReceipt: { ...localSettings.printSettings!.customerReceipt, showItemsPrice: e.target.checked } } })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label className="text-[8px] font-black uppercase text-slate-400">Preço Itens</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={localSettings.printSettings?.customerReceipt?.showTotal ?? true} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, customerReceipt: { ...localSettings.printSettings!.customerReceipt, showTotal: e.target.checked } } })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label className="text-[8px] font-black uppercase text-slate-400">Total</label>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Cabeçalho</label>
                        <input 
                          value={localSettings.printSettings?.customerReceipt?.header || ''} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, customerReceipt: { ...localSettings.printSettings!.customerReceipt, header: e.target.value } } })}
                          className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Mensagem Personalizada</label>
                        <textarea 
                          value={localSettings.printSettings?.customerReceipt?.message || ''} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, customerReceipt: { ...localSettings.printSettings!.customerReceipt, message: e.target.value } } })}
                          className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          rows={2}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Rodapé</label>
                        <input 
                          value={localSettings.printSettings?.customerReceipt?.footer || ''} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, customerReceipt: { ...localSettings.printSettings!.customerReceipt, footer: e.target.value } } })}
                          className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Tamanho do Papel</label>
                        <select 
                          value={localSettings.printSettings?.customerReceipt?.paperSize || '80mm'} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, customerReceipt: { ...localSettings.printSettings!.customerReceipt, paperSize: e.target.value } } })}
                          className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="58mm">58mm (Pequena)</option>
                          <option value="80mm">80mm (Padrão)</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[7px] font-black uppercase text-slate-400 ml-1">Margem Superior (px)</label>
                          <input type="number" value={localSettings.printSettings?.customerReceipt?.margins?.top || 0} onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, customerReceipt: { ...localSettings.printSettings!.customerReceipt, margins: { ...localSettings.printSettings!.customerReceipt.margins, top: parseInt(e.target.value) } } } })} className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 font-bold text-[10px] outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[7px] font-black uppercase text-slate-400 ml-1">Margem Inferior (px)</label>
                          <input type="number" value={localSettings.printSettings?.customerReceipt?.margins?.bottom || 0} onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, customerReceipt: { ...localSettings.printSettings!.customerReceipt, margins: { ...localSettings.printSettings!.customerReceipt.margins, bottom: parseInt(e.target.value) } } } })} className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 font-bold text-[10px] outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[7px] font-black uppercase text-slate-400 ml-1">Margem Esquerda (px)</label>
                          <input type="number" value={localSettings.printSettings?.customerReceipt?.margins?.left || 0} onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, customerReceipt: { ...localSettings.printSettings!.customerReceipt, margins: { ...localSettings.printSettings!.customerReceipt.margins, left: parseInt(e.target.value) } } } })} className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 font-bold text-[10px] outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[7px] font-black uppercase text-slate-400 ml-1">Margem Direita (px)</label>
                          <input type="number" value={localSettings.printSettings?.customerReceipt?.margins?.right || 0} onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, customerReceipt: { ...localSettings.printSettings!.customerReceipt, margins: { ...localSettings.printSettings!.customerReceipt.margins, right: parseInt(e.target.value) } } } })} className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 font-bold text-[10px] outline-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Comanda da Cozinha */}
                <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
                  <div className="flex items-center justify-between border-b dark:border-white/5 pb-4">
                    <h4 className="text-[10px] font-black uppercase text-amber-500 tracking-widest italic">2. Comanda da Cozinha (Produção)</h4>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={localSettings.printSettings?.kitchenOrder?.showItemsPrice ?? false} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, kitchenOrder: { ...localSettings.printSettings!.kitchenOrder, showItemsPrice: e.target.checked } } })}
                          className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <label className="text-[8px] font-black uppercase text-slate-400">Preço Itens</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={localSettings.printSettings?.kitchenOrder?.showTotal ?? false} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, kitchenOrder: { ...localSettings.printSettings!.kitchenOrder, showTotal: e.target.checked } } })}
                          className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                        <label className="text-[8px] font-black uppercase text-slate-400">Total</label>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Cabeçalho</label>
                        <input 
                          value={localSettings.printSettings?.kitchenOrder?.header || ''} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, kitchenOrder: { ...localSettings.printSettings!.kitchenOrder, header: e.target.value } } })}
                          className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-amber-500" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Observações Padrão</label>
                        <textarea 
                          value={localSettings.printSettings?.kitchenOrder?.message || ''} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, kitchenOrder: { ...localSettings.printSettings!.kitchenOrder, message: e.target.value } } })}
                          className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                          rows={2}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Rodapé</label>
                        <input 
                          value={localSettings.printSettings?.kitchenOrder?.footer || ''} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, kitchenOrder: { ...localSettings.printSettings!.kitchenOrder, footer: e.target.value } } })}
                          className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-amber-500" 
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Tamanho do Papel</label>
                        <select 
                          value={localSettings.printSettings?.kitchenOrder?.paperSize || '80mm'} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, kitchenOrder: { ...localSettings.printSettings!.kitchenOrder, paperSize: e.target.value } } })}
                          className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="58mm">58mm (Pequena)</option>
                          <option value="80mm">80mm (Padrão)</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[7px] font-black uppercase text-slate-400 ml-1">Margem Superior (px)</label>
                          <input type="number" value={localSettings.printSettings?.kitchenOrder?.margins?.top || 0} onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, kitchenOrder: { ...localSettings.printSettings!.kitchenOrder, margins: { ...localSettings.printSettings!.kitchenOrder.margins, top: parseInt(e.target.value) } } } })} className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 font-bold text-[10px] outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[7px] font-black uppercase text-slate-400 ml-1">Margem Inferior (px)</label>
                          <input type="number" value={localSettings.printSettings?.kitchenOrder?.margins?.bottom || 0} onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, kitchenOrder: { ...localSettings.printSettings!.kitchenOrder, margins: { ...localSettings.printSettings!.kitchenOrder.margins, bottom: parseInt(e.target.value) } } } })} className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 font-bold text-[10px] outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[7px] font-black uppercase text-slate-400 ml-1">Margem Esquerda (px)</label>
                          <input type="number" value={localSettings.printSettings?.kitchenOrder?.margins?.left || 0} onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, kitchenOrder: { ...localSettings.printSettings!.kitchenOrder, margins: { ...localSettings.printSettings!.kitchenOrder.margins, left: parseInt(e.target.value) } } } })} className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 font-bold text-[10px] outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[7px] font-black uppercase text-slate-400 ml-1">Margem Direita (px)</label>
                          <input type="number" value={localSettings.printSettings?.kitchenOrder?.margins?.right || 0} onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, kitchenOrder: { ...localSettings.printSettings!.kitchenOrder, margins: { ...localSettings.printSettings!.kitchenOrder.margins, right: parseInt(e.target.value) } } } })} className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 font-bold text-[10px] outline-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Relatório A4 */}
                <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
                  <div className="flex items-center justify-between border-b dark:border-white/5 pb-4">
                    <h4 className="text-[10px] font-black uppercase text-emerald-500 tracking-widest italic">3. Relatório Principal (A4)</h4>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={localSettings.printSettings?.a4Report?.showItemsPrice ?? true} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, a4Report: { ...localSettings.printSettings!.a4Report, showItemsPrice: e.target.checked } } })}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <label className="text-[8px] font-black uppercase text-slate-400">Preço Itens</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={localSettings.printSettings?.a4Report?.showTotal ?? true} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, a4Report: { ...localSettings.printSettings!.a4Report, showTotal: e.target.checked } } })}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <label className="text-[8px] font-black uppercase text-slate-400">Total</label>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Título do Relatório</label>
                        <input 
                          value={localSettings.printSettings?.a4Report?.header || ''} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, a4Report: { ...localSettings.printSettings!.a4Report, header: e.target.value } } })}
                          className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Mensagem Adicional</label>
                        <textarea 
                          value={localSettings.printSettings?.a4Report?.message || ''} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, a4Report: { ...localSettings.printSettings!.a4Report, message: e.target.value } } })}
                          className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                          rows={2}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Rodapé</label>
                        <input 
                          value={localSettings.printSettings?.a4Report?.footer || ''} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, a4Report: { ...localSettings.printSettings!.a4Report, footer: e.target.value } } })}
                          className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500" 
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Tamanho do Papel</label>
                        <select 
                          value={localSettings.printSettings?.a4Report?.paperSize || 'A4'} 
                          onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, a4Report: { ...localSettings.printSettings!.a4Report, paperSize: e.target.value } } })}
                          className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="A4">A4 (Padrão)</option>
                          <option value="Letter">Carta</option>
                          <option value="A5">A5</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[7px] font-black uppercase text-slate-400 ml-1">Margem Superior (px)</label>
                          <input type="number" value={localSettings.printSettings?.a4Report?.margins?.top || 0} onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, a4Report: { ...localSettings.printSettings!.a4Report, margins: { ...localSettings.printSettings!.a4Report.margins, top: parseInt(e.target.value) } } } })} className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 font-bold text-[10px] outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[7px] font-black uppercase text-slate-400 ml-1">Margem Inferior (px)</label>
                          <input type="number" value={localSettings.printSettings?.a4Report?.margins?.bottom || 0} onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, a4Report: { ...localSettings.printSettings!.a4Report, margins: { ...localSettings.printSettings!.a4Report.margins, bottom: parseInt(e.target.value) } } } })} className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 font-bold text-[10px] outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[7px] font-black uppercase text-slate-400 ml-1">Margem Esquerda (px)</label>
                          <input type="number" value={localSettings.printSettings?.a4Report?.margins?.left || 0} onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, a4Report: { ...localSettings.printSettings!.a4Report, margins: { ...localSettings.printSettings!.a4Report.margins, left: parseInt(e.target.value) } } } })} className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 font-bold text-[10px] outline-none" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[7px] font-black uppercase text-slate-400 ml-1">Margem Direita (px)</label>
                          <input type="number" value={localSettings.printSettings?.a4Report?.margins?.right || 0} onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, a4Report: { ...localSettings.printSettings!.a4Report, margins: { ...localSettings.printSettings!.a4Report.margins, right: parseInt(e.target.value) } } } })} className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 font-bold text-[10px] outline-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Configurações Globais */}
                <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                  <h4 className="text-[9px] font-black uppercase text-slate-500 tracking-widest italic">Configurações Globais</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase text-slate-700 dark:text-white">Atraso na Impressão (ms)</p>
                        <p className="text-[7px] font-bold text-slate-400 uppercase italic">Tempo de espera antes de abrir a janela de impressão</p>
                      </div>
                      <input 
                        type="number" 
                        step="100"
                        value={localSettings.printSettings?.printDelay || 0} 
                        onChange={e => handleUpdate({ printSettings: { ...localSettings.printSettings!, printDelay: parseInt(e.target.value) } })}
                        className="w-24 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-3 py-2 font-bold text-xs outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                      <div className="space-y-0.5">
                        <p className="text-[9px] font-black uppercase text-slate-700 dark:text-white">Impressão Automática</p>
                        <p className="text-[7px] font-bold text-slate-400 uppercase italic">Ativar ao finalizar pagamentos</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleUpdate({ printSettings: { ...localSettings.printSettings!, autoPrint: !localSettings.printSettings?.autoPrint } })} 
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.printSettings?.autoPrint ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${localSettings.printSettings?.autoPrint ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'errorPages' && isMaster && (
          <div className="space-y-10 animate-in slide-in-from-bottom-4">
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Configuração de Páginas de Erro</h3>
              </div>
              
              <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
                <div className="flex items-center gap-3 border-b dark:border-white/5 pb-4">
                  <div className="w-1.5 h-6 bg-rose-500 rounded-full"></div>
                  <h4 className="text-[10px] font-black uppercase text-slate-700 dark:text-white tracking-widest italic">Personalização da Página 404</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Título do Erro</label>
                      <input 
                        value={localSettings.errorPage404Title || ''} 
                        onChange={e => handleUpdate({ errorPage404Title: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                        placeholder="Ex: OPS! PÁGINA NÃO ENCONTRADA"
                      />
                      <p className="text-[7px] font-bold text-slate-400 uppercase italic ml-2">Título principal exibido em destaque na página.</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Mensagem de Erro</label>
                      <textarea 
                        value={localSettings.errorPage404Message || ''} 
                        onChange={e => handleUpdate({ errorPage404Message: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        rows={3}
                        placeholder="Ex: A página que você está procurando não existe ou foi movida."
                      />
                      <p className="text-[7px] font-bold text-slate-400 uppercase italic ml-2">Texto explicativo sobre o erro ocorrido.</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Texto do Botão de Retorno</label>
                      <input 
                        value={localSettings.errorPage404ButtonText || ''} 
                        onChange={e => handleUpdate({ errorPage404ButtonText: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                        placeholder="Ex: VOLTAR AO INÍCIO"
                      />
                      <p className="text-[7px] font-bold text-slate-400 uppercase italic ml-2">Texto que aparece dentro do botão de ação.</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Cor de Fundo</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={localSettings.errorPage404BgColor || '#0f172a'} 
                            onChange={e => handleUpdate({ errorPage404BgColor: e.target.value })}
                            className="w-10 h-10 min-w-[40px] min-h-[40px] shrink-0 rounded-xl cursor-pointer border-2 border-slate-100 dark:border-white/10 shadow-sm p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" 
                          />
                          <input 
                            type="text" 
                            value={localSettings.errorPage404BgColor || ''} 
                            onChange={e => handleUpdate({ errorPage404BgColor: e.target.value })}
                            className="flex-1 bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 font-bold text-[10px] outline-none" 
                          />
                        </div>
                        <p className="text-[7px] font-bold text-slate-400 uppercase italic ml-2">Define a cor do fundo da página de erro.</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Cor do Texto</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={localSettings.errorPage404TextColor || '#ffffff'} 
                            onChange={e => handleUpdate({ errorPage404TextColor: e.target.value })}
                            className="w-10 h-10 min-w-[40px] min-h-[40px] shrink-0 rounded-xl cursor-pointer border-2 border-slate-100 dark:border-white/10 shadow-sm p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" 
                          />
                          <input 
                            type="text" 
                            value={localSettings.errorPage404TextColor || ''} 
                            onChange={e => handleUpdate({ errorPage404TextColor: e.target.value })}
                            className="flex-1 bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 font-bold text-[10px] outline-none" 
                          />
                        </div>
                        <p className="text-[7px] font-bold text-slate-400 uppercase italic ml-2">Define a cor das mensagens exibidas ao usuário.</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Cor do Botão</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="color" 
                          value={localSettings.errorPage404ButtonColor || '#4f46e5'} 
                          onChange={e => handleUpdate({ errorPage404ButtonColor: e.target.value })}
                          className="w-10 h-10 min-w-[40px] min-h-[40px] shrink-0 rounded-xl cursor-pointer border-2 border-slate-100 dark:border-white/10 shadow-sm p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" 
                        />
                        <input 
                          type="text" 
                          value={localSettings.errorPage404ButtonColor || ''} 
                          onChange={e => handleUpdate({ errorPage404ButtonColor: e.target.value })}
                          className="flex-1 bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 font-bold text-[10px] outline-none" 
                        />
                      </div>
                      <p className="text-[7px] font-bold text-slate-400 uppercase italic ml-2">Define a cor do botão de retorno ou ação da página.</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-2">URL da Imagem de Erro (Opcional)</label>
                      <div className="flex gap-2">
                        <input 
                          value={localSettings.errorPage404ImageUrl || ''} 
                          onChange={e => handleUpdate({ errorPage404ImageUrl: e.target.value })}
                          className="flex-1 bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                          placeholder="https://exemplo.com/imagem.png"
                        />
                        <button 
                          onClick={() => {
                            const fileInput = document.createElement('input');
                            fileInput.type = 'file';
                            fileInput.accept = 'image/*';
                            fileInput.onchange = async (e: any) => {
                              const file = e.target.files[0];
                              if (file) {
                                if (file.size > 1 * 1024 * 1024) {
                                  alert('A imagem deve ter no máximo 1MB.');
                                  return;
                                }
                                try {
                                  const url = await uploadFile(file, 'error-pages');
                                  handleUpdate({ errorPage404ImageUrl: url });
                                } catch (error) {
                                  console.error('Erro no upload:', error);
                                  alert('Erro ao fazer upload da imagem de erro.');
                                }
                              }
                            };
                            fileInput.click();
                          }}
                          className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg hover:brightness-110 transition-all"
                        >
                          <Upload className="w-5 h-5" />
                        </button>
                      </div>
                      <p className="text-[7px] font-bold text-slate-400 uppercase italic ml-2">Imagem ou ilustração personalizada para ilustrar o erro.</p>
                    </div>

                    {/* Preview da Página 404 */}
                    <div className="mt-4 p-4 bg-slate-200 dark:bg-slate-950 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
                      <p className="text-[7px] font-black uppercase text-slate-400 mb-2 text-center">Mini Preview</p>
                      <div 
                        className="aspect-video rounded-2xl flex flex-col items-center justify-center p-4 text-center overflow-hidden shadow-inner"
                        style={{ backgroundColor: localSettings.errorPage404BgColor, color: localSettings.errorPage404TextColor }}
                      >
                        {localSettings.errorPage404ImageUrl ? (
                          <img src={localSettings.errorPage404ImageUrl} className="w-12 h-12 object-contain mb-2" alt="error" />
                        ) : (
                          <div className="text-2xl font-black opacity-20 mb-1">404</div>
                        )}
                        <h5 className="text-[8px] font-black uppercase mb-1">{localSettings.errorPage404Title}</h5>
                        <p className="text-[6px] opacity-70 mb-2 max-w-[150px]">{localSettings.errorPage404Message}</p>
                        <div 
                          className="px-3 py-1 rounded-full text-[5px] font-black uppercase"
                          style={{ backgroundColor: localSettings.errorPage404ButtonColor || '#4f46e5', color: '#ffffff' }}
                        >
                          {localSettings.errorPage404ButtonText}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t dark:border-white/5">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Tema da Página</label>
                    <select 
                      value={localSettings.errorPage404Theme || 'modern'} 
                      onChange={e => handleUpdate({ errorPage404Theme: e.target.value as any })}
                      className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="minimal">Minimalista</option>
                      <option value="modern">Moderno (Padrão)</option>
                      <option value="glass">Glassmorphism</option>
                      <option value="brutalist">Brutalista</option>
                      <option value="retro">Retro / Arcade</option>
                      <option value="cyberpunk">Cyberpunk</option>
                      <option value="nature">Natureza</option>
                      <option value="space">Espaço Sideral</option>
                    </select>
                    <p className="text-[7px] font-bold text-slate-400 uppercase italic ml-2">Escolha o estilo visual geral da página.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Animação</label>
                    <select 
                      value={localSettings.errorPage404Animation || 'fade'} 
                      onChange={e => handleUpdate({ errorPage404Animation: e.target.value as any })}
                      className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="none">Nenhuma</option>
                      <option value="fade">Fade In</option>
                      <option value="bounce">Bounce (Pulo)</option>
                      <option value="slide">Slide Up</option>
                      <option value="glitch">Glitch (Erro)</option>
                      <option value="float">Flutuante</option>
                    </select>
                    <p className="text-[7px] font-bold text-slate-400 uppercase italic ml-2">Efeito de entrada dos elementos na tela.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Auto-Redirecionar (Segundos)</label>
                    <input 
                      type="number"
                      value={localSettings.errorPage404RedirectTime || 0} 
                      onChange={e => handleUpdate({ errorPage404RedirectTime: parseInt(e.target.value) })}
                      className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                      placeholder="0 = Desativado"
                      min="0"
                    />
                    <p className="text-[7px] font-bold text-slate-400 uppercase italic ml-2">Tempo para voltar automaticamente ao início (0 desativa).</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button 
                    onClick={() => handleUpdate({ errorPage404ShowSearch: !localSettings.errorPage404ShowSearch })}
                    className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${localSettings.errorPage404ShowSearch ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-100 dark:border-slate-800 opacity-50'}`}
                  >
                    <Search className="w-5 h-5" />
                    <span className="text-[8px] font-black uppercase">Barra de Busca</span>
                  </button>
                  <button 
                    onClick={() => handleUpdate({ errorPage404ShowLinks: !localSettings.errorPage404ShowLinks })}
                    className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${localSettings.errorPage404ShowLinks ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-100 dark:border-slate-800 opacity-50'}`}
                  >
                    <LinkIcon className="w-5 h-5" />
                    <span className="text-[8px] font-black uppercase">Links Rápidos</span>
                  </button>
                  <button 
                    onClick={() => handleUpdate({ errorPage404ShowHomeButton: !localSettings.errorPage404ShowHomeButton })}
                    className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${localSettings.errorPage404ShowHomeButton !== false ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-100 dark:border-slate-800 opacity-50'}`}
                  >
                    <Home className="w-5 h-5" />
                    <span className="text-[8px] font-black uppercase">Botão Início</span>
                  </button>
                  <button 
                    onClick={() => handleUpdate({ errorPage404ShowSupportButton: !localSettings.errorPage404ShowSupportButton })}
                    className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${localSettings.errorPage404ShowSupportButton ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-100 dark:border-slate-800 opacity-50'}`}
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span className="text-[8px] font-black uppercase">Botão Suporte</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t dark:border-white/5">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <Palette className="w-4 h-4 text-indigo-500" />
                      <h4 className="text-[10px] font-black uppercase text-slate-700 dark:text-white tracking-widest italic">Fundo e Efeitos</h4>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Ativar Gradiente</label>
                        <button 
                          onClick={() => handleUpdate({ errorPage404GradientEnabled: !localSettings.errorPage404GradientEnabled })}
                          className={`w-full p-3 rounded-2xl border-2 transition-all flex items-center justify-center gap-2 ${localSettings.errorPage404GradientEnabled ? '' : 'border-slate-100 dark:border-slate-800 opacity-50'}`}
                          style={localSettings.errorPage404GradientEnabled ? { borderColor: localSettings.primaryColor || '#4f46e5', backgroundColor: `${localSettings.primaryColor || '#4f46e5'}1A`, color: localSettings.primaryColor || '#4f46e5' } : {}}
                        >
                          <Layers className="w-4 h-4" />
                          <span className="text-[8px] font-black uppercase">{localSettings.errorPage404GradientEnabled ? 'Ativado' : 'Desativado'}</span>
                        </button>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Cor do Gradiente</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="color" 
                            value={localSettings.errorPage404GradientColor || '#4f46e5'} 
                            onChange={e => handleUpdate({ errorPage404GradientColor: e.target.value })}
                            className="w-10 h-10 min-w-[40px] min-h-[40px] shrink-0 rounded-xl cursor-pointer border-2 border-slate-100 dark:border-white/10 shadow-sm disabled:opacity-30 p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" 
                            disabled={!localSettings.errorPage404GradientEnabled}
                          />
                          <input 
                            type="text" 
                            value={localSettings.errorPage404GradientColor || ''} 
                            onChange={e => handleUpdate({ errorPage404GradientColor: e.target.value })}
                            className="flex-1 bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 font-bold text-[10px] outline-none disabled:opacity-30" 
                            disabled={!localSettings.errorPage404GradientEnabled}
                          />
                        </div>
                        <p className="text-[7px] font-bold text-slate-400 uppercase italic ml-2">Define a cor secundária para o efeito de gradiente.</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Padrão de Fundo</label>
                      <select 
                        value={localSettings.errorPage404Pattern || 'none'} 
                        onChange={e => handleUpdate({ errorPage404Pattern: e.target.value as any })}
                        className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="none">Nenhum</option>
                        <option value="dots">Pontos (Dots)</option>
                        <option value="grid">Grade (Grid)</option>
                        <option value="noise">Ruído (Noise)</option>
                        <option value="lines">Linhas Diagonais</option>
                      </select>
                      <p className="text-[7px] font-bold text-slate-400 uppercase italic ml-2">Adiciona uma textura sutil ao fundo da página.</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="w-4 h-4 text-rose-500" />
                      <h4 className="text-[10px] font-black uppercase text-slate-700 dark:text-white tracking-widest italic">Relato de Erros</h4>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase text-slate-700 dark:text-white">Botão "Relatar Erro"</p>
                          <p className="text-[8px] text-slate-400">Permite que usuários enviem um alerta de link quebrado.</p>
                        </div>
                        <button 
                          onClick={() => handleUpdate({ errorPage404ShowReportButton: !localSettings.errorPage404ShowReportButton })}
                          className={`w-12 h-6 rounded-full transition-all relative ${localSettings.errorPage404ShowReportButton ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localSettings.errorPage404ShowReportButton ? 'left-7' : 'left-1'}`}></div>
                        </button>
                      </div>

                      {localSettings.errorPage404ShowReportButton && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase text-slate-400 ml-2">E-mail para Receber Relatos</label>
                            <div className="relative">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                              <input 
                                value={localSettings.errorPage404ReportEmail || ''} 
                                onChange={e => handleUpdate({ errorPage404ReportEmail: e.target.value })}
                                className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl pl-12 pr-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                                placeholder="suporte@exemplo.com"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Mensagem de Sucesso ao Relatar</label>
                            <input 
                              value={localSettings.errorPage404ReportSuccessMessage || ''} 
                              onChange={e => handleUpdate({ errorPage404ReportSuccessMessage: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                              placeholder="Ex: Obrigado! Nossa equipe foi notificada."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <LinkIcon className="w-4 h-4 text-indigo-500" />
                      <h4 className="text-[10px] font-black uppercase text-slate-700 dark:text-white tracking-widest italic">Redes Sociais na Página de Erro</h4>
                    </div>
                    <button 
                      onClick={() => {
                        const links = [...(localSettings.errorPage404SocialLinks || [])];
                        links.push({ platform: 'instagram', url: '' });
                        handleUpdate({ errorPage404SocialLinks: links });
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                    >
                      <Plus className="w-3 h-3" />
                      Adicionar Link
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(localSettings.errorPage404SocialLinks || []).map((link, idx) => (
                      <div key={idx} className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center gap-3 group">
                        <select 
                          value={link.platform}
                          onChange={e => {
                            const links = [...(localSettings.errorPage404SocialLinks || [])];
                            links[idx].platform = e.target.value as any;
                            handleUpdate({ errorPage404SocialLinks: links });
                          }}
                          className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-2 py-2 text-[10px] font-bold outline-none"
                        >
                          <option value="instagram">Instagram</option>
                          <option value="facebook">Facebook</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="twitter">Twitter / X</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="youtube">YouTube</option>
                        </select>
                        <input 
                          value={link.url}
                          onChange={e => {
                            const links = [...(localSettings.errorPage404SocialLinks || [])];
                            links[idx].url = e.target.value;
                            handleUpdate({ errorPage404SocialLinks: links });
                          }}
                          className="flex-1 bg-transparent border-none font-bold text-[10px] outline-none"
                          placeholder="URL ou número"
                        />
                        <button 
                          onClick={() => {
                            const links = (localSettings.errorPage404SocialLinks || []).filter((_, i) => i !== idx);
                            handleUpdate({ errorPage404SocialLinks: links });
                          }}
                          className="p-2 text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {(localSettings.errorPage404SocialLinks || []).length === 0 && (
                      <div className="col-span-full py-8 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem]">
                        <p className="text-[8px] font-black uppercase text-slate-400">Nenhuma rede social adicionada</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase text-slate-400 ml-2">HTML/CSS Customizado (Opcional)</label>
                  <textarea 
                    value={localSettings.errorPage404CustomHtml || ''} 
                    onChange={e => handleUpdate({ errorPage404CustomHtml: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-4 py-3 font-mono text-[10px] outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    rows={4}
                    placeholder="<style>...</style><div>...</div>"
                  />
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'demo' && isMaster && (
          <div className="p-12 text-center max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-4">
            <div className="w-24 h-24 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-8">
              <svg className="w-12 h-12 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <h3 className="text-2xl font-black uppercase italic text-slate-900 dark:text-white mb-4">Ambiente de Demonstração</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-10 leading-relaxed">
              O Demo Viewer permite que você visualize o sistema exatamente como ele está agora, mas em um ambiente seguro onde nenhuma alteração é salva permanentemente. 
              Ideal para mostrar o sistema para novos clientes sem comprometer seus dados reais.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="/demo.html" 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Abrir Demo Viewer
              </a>
              
              <button 
                onClick={() => {
                  const url = window.location.origin + '/demo.html';
                  navigator.clipboard.writeText(url);
                  alert('Link da Demo copiado com sucesso!');
                }}
                className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-md hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all flex items-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copiar Link
              </button>
            </div>
            
            <p className="mt-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Dica: Você também pode usar o link direto: <span className="select-all" style={{ color: localSettings.primaryColor || '#4f46e5' }}>{window.location.origin}/demo.html</span>
            </p>
          </div>
        )}

        {activeTab === 'workspace' && (
          <div className="space-y-10 animate-in slide-in-from-left-4">
            <section className="space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic text-slate-400">Identidade Visual</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Texto da Logo / Sistema</label>
                    <input value={localSettings.systemName} onChange={e => handleUpdate({ systemName: e.target.value.toUpperCase() })} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-black text-sm outline-none focus:ring-2" style={{ '--tw-ring-color': localSettings.primaryColor || '#4f46e5' } as any} />
                  </div>
                    <div className="space-y-3">
                    <div className="flex items-center gap-3 ml-2">
                      <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: localSettings.primaryColor || '#4f46e5' }}></div>
                      <label className="text-[9px] font-black uppercase italic tracking-widest" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Cor Principal do Sistema</label>
                    </div>
                    <div className="flex flex-col gap-4 bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-inner">
                        <div className="flex items-center gap-4">
                          <input type="color" value={localSettings.primaryColor || '#4f46e5'} onChange={e => handleUpdate({ primaryColor: e.target.value })} className="w-16 h-16 min-w-[64px] min-h-[64px] shrink-0 rounded-2xl cursor-pointer border-2 border-slate-100 dark:border-white/10 shadow-sm p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-xl" />
                          <div className="flex-1">
                             <p className="text-[11px] font-black uppercase text-slate-700 dark:text-white">Seletor de Cor</p>
                             <p className="text-[9px] font-bold text-slate-400 uppercase italic leading-relaxed">Esta cor será aplicada em botões, ícones, destaques e menus em todo o sistema.</p>
                          </div>
                        </div>
                        <div className="p-4 rounded-2xl border" style={{ backgroundColor: `${localSettings.primaryColor || '#4f46e5'}0D`, borderColor: `${localSettings.primaryColor || '#4f46e5'}1A` }}>
                          <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Dica de Design</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase italic">Escolha uma cor que represente sua marca. O sistema ajustará os tons automaticamente.</p>
                        </div>
                    </div>
                  </div>
                  <div className="space-y-8">
                    {/* Modo de Exibição */}
                    <div className="space-y-4">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Modo de Exibição do Painel</label>
                      <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl shadow-inner h-14 w-full md:w-64">
                        <button onClick={() => handleUpdate({ themeMode: 'light' })} className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-[9px] font-black uppercase transition-all ${localSettings.themeMode === 'light' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-400'}`}><span className="text-sm">☀️</span> Claro</button>
                        <button onClick={() => handleUpdate({ themeMode: 'dark' })} className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-[9px] font-black uppercase transition-all ${localSettings.themeMode === 'dark' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-400'}`}><span className="text-sm">🌙</span> Escuro</button>
                      </div>
                    </div>

                    {/* Cor de Fundo Personalizada */}
                    <div className="space-y-4 pt-6 border-t dark:border-white/5">
                      <div className="flex items-center gap-3 ml-2">
                        <input 
                          type="checkbox" 
                          id="workspaceBgColorEnabled"
                          checked={localSettings.workspaceBgColorEnabled || false} 
                          onChange={e => handleUpdate({ workspaceBgColorEnabled: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="workspaceBgColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Ativar Cor de Fundo Personalizada</label>
                      </div>
                      
                      {localSettings.workspaceBgColorEnabled && (
                        <div className="space-y-4">
                          <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-inner animate-in zoom-in-95">
                            <input type="color" value={localSettings.workspaceBgColor || (localSettings.themeMode === 'dark' ? '#020617' : '#f8fafc')} onChange={e => handleUpdate({ workspaceBgColor: e.target.value })} className="w-12 h-12 min-w-[48px] min-h-[48px] shrink-0 rounded-xl cursor-pointer border-2 border-slate-100 dark:border-white/10 shadow-sm p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" />
                            <div className="flex-1">
                               <p className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">Cor de Fundo do Painel</p>
                               <p className="text-[8px] font-bold text-slate-400 uppercase italic">Altera apenas o fundo, sem afetar o tema</p>
                            </div>
                          </div>
                          
                          {/* Preview de Contraste */}
                          <div 
                            className="p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center gap-2 transition-all duration-500"
                            style={{ backgroundColor: localSettings.workspaceBgColor || (localSettings.themeMode === 'dark' ? '#020617' : '#f8fafc') }}
                          >
                            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: workspaceContrast }}>Exemplo de Texto Legível</p>
                            <p className="text-[8px] font-bold uppercase italic opacity-60" style={{ color: workspaceContrast }}>O sistema ajusta o contraste automaticamente</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Temas do Site */}
                    <div className="space-y-6 pt-6 border-t dark:border-white/5">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Temas do Site (Animações)</label>
                        <select 
                          value={localSettings.workspaceTheme || 'none'} 
                          onChange={e => handleUpdate({ workspaceTheme: e.target.value as any })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-black text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="none">NENHUM</option>
                          <option value="aurora">AURORA BOREAL</option>
                          <option value="particles">PARTÍCULAS FLUTUANTES</option>
                          <option value="matrix">DIGITAL MATRIX</option>
                          <option value="rain">CHUVA DIGITAL</option>
                          <option value="stars">ESTRELAS CADENTES</option>
                          <option value="universe">UNIVERSO PROFUNDO</option>
                          <option value="galaxy">GALÁXIA ESPIRAL</option>
                          <option value="cosmos">COSMOS INFINITO</option>
                          <option value="techno">TECHNO GRID</option>
                          <option value="cyber">CYBERPUNK CITY</option>
                          <option value="neon">NEON PULSE</option>
                        </select>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-3 ml-2">
                          <input 
                            type="checkbox" 
                            id="workspaceThemeColorEnabled"
                            checked={localSettings.workspaceThemeColorEnabled || false} 
                            onChange={e => handleUpdate({ workspaceThemeColorEnabled: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <label htmlFor="workspaceThemeColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Ativar Cor Personalizada do Tema</label>
                        </div>
                        {localSettings.workspaceThemeColorEnabled && (
                          <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-inner animate-in zoom-in-95">
                            <input type="color" value={localSettings.workspaceThemeColor || '#4f46e5'} onChange={e => handleUpdate({ workspaceThemeColor: e.target.value })} className="w-12 h-12 min-w-[48px] min-h-[48px] shrink-0 rounded-xl cursor-pointer border-2 border-slate-100 dark:border-white/10 shadow-sm p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" />
                            <div className="flex-1">
                               <p className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">Cor de Destaque do Tema</p>
                               <p className="text-[8px] font-bold text-slate-400 uppercase italic">Altera apenas a cor das animações</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-8">
                  <div className="flex flex-col items-center gap-4 p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm group">
                    <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-center w-full">Imagem da Logo</label>
                    <div className="relative">
                      <div onClick={() => logoInputRef.current?.click()} className="w-28 h-28 md:w-32 md:h-32 bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-inner transition-all group-hover:border-indigo-500 cursor-pointer">
                        {localSettings.logoUrl ? <img src={localSettings.logoUrl} className="w-full h-full object-contain p-4" alt="logo preview" /> : <svg className="w-10 h-10 text-slate-200 dark:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 01-1.586-1.586a2 2 0 012.828 0L20 14" /></svg>}
                      </div>
                      <button type="button" onClick={() => logoInputRef.current?.click()} className="absolute -bottom-2 -right-2 w-12 h-12 md:w-10 md:h-10 bg-indigo-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:scale-110 transition-transform active:scale-95 z-10"><svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" strokeWidth={3}/></svg></button>
                      <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    </div>
                    {localSettings.logoUrl && <button onClick={() => { handleUpdate({ logoUrl: '' }); if(logoInputRef.current) logoInputRef.current.value = ''; }} className="text-[8px] font-black uppercase text-rose-500 hover:text-rose-600 transition-colors">Remover Logo</button>}
                  </div>

                  {isMaster && (
                    <div className="flex flex-col items-center gap-4 p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm group">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-center w-full">Favicon do Site</label>
                      <div className="relative">
                        <div onClick={() => faviconInputRef.current?.click()} className="w-20 h-20 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-inner transition-all group-hover:border-indigo-500 cursor-pointer">
                          {localSettings.faviconUrl ? <img src={localSettings.faviconUrl} className="w-full h-full object-contain p-2" alt="favicon preview" /> : <Monitor className="w-8 h-8 text-slate-200 dark:text-slate-700" />}
                        </div>
                        <button type="button" onClick={() => faviconInputRef.current?.click()} className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:scale-110 transition-transform active:scale-95 z-10"><Plus className="w-5 h-5" /></button>
                        <input type="file" ref={faviconInputRef} className="hidden" accept=".ico,.png,.svg" onChange={handleFaviconUpload} />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-[7px] font-bold text-slate-400 uppercase italic">Formatos: .ico, .png, .svg</p>
                        <p className="text-[7px] font-bold text-slate-400 uppercase italic">Máx: 128x128px</p>
                      </div>
                      {localSettings.faviconUrl && <button onClick={() => { handleUpdate({ faviconUrl: '' }); if(faviconInputRef.current) faviconInputRef.current.value = ''; }} className="text-[8px] font-black uppercase text-rose-500 hover:text-rose-600 transition-colors">Remover Favicon</button>}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* QR Code Master - Apenas para Master Admin */}
            {isMaster && (
              <section className="space-y-6 pt-10 border-t dark:border-white/5">
                <div className="flex items-center gap-3">
                  <QrCode className="w-5 h-5" style={{ color: localSettings.primaryColor || '#4f46e5' }} />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>QR Code Master (Redirecionamento)</h3>
                </div>
                <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">URL de Redirecionamento</label>
                        <input 
                          value={localSettings.qrCodeMasterUrl || ''} 
                          onChange={e => handleUpdate({ qrCodeMasterUrl: e.target.value })}
                          placeholder="https://seusite.com"
                          className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Tipo de Expiração</label>
                        <select 
                          value={localSettings.qrCodeMasterExpiration || 'none'} 
                          onChange={e => handleUpdate({ qrCodeMasterExpiration: e.target.value as any })}
                          className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-6 py-4 font-black text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="none">FIXO (SEM EXPIRAÇÃO)</option>
                          <option value="monthly">EXPIRAÇÃO MENSAL</option>
                        </select>
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button 
                          onClick={saveToStorage}
                          className="flex-1 bg-indigo-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          Salvar URL
                        </button>
                        <button 
                          onClick={() => downloadQRCode('master-qr', 'QR_CODE_MASTER')}
                          disabled={!localSettings.qrCodeMasterUrl}
                          className="flex-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-md hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Download className="w-4 h-4" />
                          Baixar QR
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-inner">
                      {localSettings.qrCodeMasterUrl ? (
                        <div className="p-4 bg-white rounded-2xl">
                          <QRCodeCanvas 
                            id="master-qr"
                            value={`${window.location.origin}/api.php?action=redirect_master`} 
                            size={200}
                            level="H"
                            includeMargin={true}
                          />
                        </div>
                      ) : (
                        <div className="w-48 h-48 flex flex-col items-center justify-center text-slate-300 italic text-[10px] uppercase font-black text-center">
                          <QrCode className="w-12 h-12 mb-2 opacity-20" />
                          Insira uma URL para gerar o QR Code
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* QR Code Cardápio - Master, Pagantes e Demo */}
            {(isMaster || !isDemoViewer || user?.role === 'demo') && (
              <section className="space-y-6 pt-10 border-t dark:border-white/5">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-emerald-500" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic text-emerald-500">QR Code Cardápio Dinâmico</h3>
                </div>
                <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Tipo de Redirecionamento</label>
                        <div className="flex gap-2 p-1 bg-white dark:bg-slate-900 rounded-2xl shadow-inner">
                          <button 
                            onClick={() => handleUpdate({ qrRedirectType: 'pdf' })}
                            className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${localSettings.qrRedirectType === 'pdf' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                          >
                            Arquivo PDF
                          </button>
                          <button 
                            onClick={() => handleUpdate({ qrRedirectType: 'url' })}
                            className={`flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${localSettings.qrRedirectType === 'url' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                          >
                            Link Externo (URL)
                          </button>
                        </div>
                      </div>

                      {localSettings.qrRedirectType === 'pdf' ? (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                          <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Upload do Cardápio (PDF)</label>
                          <div 
                            onClick={() => document.getElementById('pdf-upload')?.click()}
                            className="w-full bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-emerald-500 transition-all group"
                          >
                            {localSettings.qrCodeMenuPdf ? (
                              <>
                                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600">
                                  <FileText className="w-6 h-6" />
                                </div>
                                <p className="text-[10px] font-black uppercase text-emerald-600">PDF Carregado com Sucesso</p>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleUpdate({ qrCodeMenuPdf: '' }); }}
                                  className="text-[8px] font-black uppercase text-rose-500 hover:text-rose-600"
                                >
                                  Remover Arquivo
                                </button>
                              </>
                            ) : (
                              <>
                                <Upload className="w-8 h-8 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                                <p className="text-[9px] font-black uppercase text-slate-400 text-center">Clique ou arraste o PDF do seu cardápio aqui</p>
                                <p className="text-[7px] font-bold text-slate-300 uppercase">Máximo: 10MB</p>
                              </>
                            )}
                          </div>
                          <input 
                            type="file" 
                            id="pdf-upload" 
                            className="hidden" 
                            accept="application/pdf" 
                            onChange={handlePdfUpload} 
                          />
                        </div>
                      ) : (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                          <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">URL do Cardápio Digital</label>
                          <input 
                            type="url" 
                            value={localSettings.qrRedirectUrl || ''} 
                            onChange={e => handleUpdate({ qrRedirectUrl: e.target.value })}
                            placeholder="https://instagram.com/seu-perfil"
                            className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-6 py-4 font-black text-xs outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                          />
                        </div>
                      )}

                      <div className="flex gap-3 pt-2">
                        <button 
                          onClick={saveToStorage}
                          className="flex-1 bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          Salvar Configurações
                        </button>
                        <button 
                          onClick={() => downloadQRCode('menu-qr', 'QR_CODE_CARDAPIO')}
                          className="flex-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-md hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          Baixar QR
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-inner">
                      <div className="p-4 bg-white rounded-2xl">
                        <QRCodeCanvas 
                          id="menu-qr"
                          value={`${window.location.origin}/api.php?action=go&tenant=${user?.tenantId || 'MASTER'}`} 
                          size={200}
                          level="H"
                          includeMargin={true}
                        />
                      </div>
                      <p className="mt-4 text-[8px] font-black uppercase text-slate-400 tracking-widest text-center max-w-[200px]">
                        Este QR Code é fixo. Você pode mudar o destino acima sem precisar imprimi-lo novamente.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Som de Finalização de Venda - Apenas para Master Admin */}
            {isMaster && (
              <section className="space-y-6 pt-10 border-t dark:border-white/5">
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5" style={{ color: localSettings.primaryColor || '#4f46e5' }} />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Som de Finalização de Venda</h3>
                </div>
                <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                  <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <div className="space-y-0.5">
                      <p className="text-[9px] font-black uppercase text-slate-700 dark:text-white">Ativar Som de Confirmação</p>
                      <p className="text-[7px] font-bold text-slate-400 uppercase italic">Reproduzir som automaticamente ao finalizar uma venda</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleUpdate({ saleConfirmationSoundEnabled: !localSettings.saleConfirmationSoundEnabled })} 
                      className={`w-12 h-6 rounded-full transition-all relative ${localSettings.saleConfirmationSoundEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${localSettings.saleConfirmationSoundEnabled ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">URL do Áudio (MP3, WAV, OGG)</label>
                        <input 
                          type="url" 
                          value={localSettings.saleConfirmationSoundUrl || ''} 
                          onChange={e => {
                            handleUpdate({ saleConfirmationSoundUrl: e.target.value });
                            setAudioError(null);
                          }}
                          onBlur={e => validateAudioUrl(e.target.value)}
                          placeholder="https://exemplo.com/som.mp3"
                          className={`w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 shadow-inner ${audioError ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`}
                        />
                        {audioError && <p className="text-[7px] font-bold text-rose-500 uppercase ml-2 italic">{audioError}</p>}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Ou Upload de Arquivo</label>
                        <div 
                          onClick={() => saleSoundInputRef.current?.click()}
                          className="w-full bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-500 transition-all group"
                        >
                          {localSettings.saleConfirmationSoundUpload ? (
                            <>
                              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600">
                                <MessageSquare className="w-5 h-5" />
                              </div>
                              <p className="text-[9px] font-black uppercase text-indigo-600">Áudio Carregado</p>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleUpdate({ saleConfirmationSoundUpload: '' }); }}
                                className="text-[7px] font-black uppercase text-rose-500 hover:text-rose-600"
                              >
                                Remover Arquivo
                              </button>
                            </>
                          ) : (
                            <>
                              <Upload className="w-6 h-6 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                              <p className="text-[8px] font-black uppercase text-slate-400 text-center">Clique para fazer upload</p>
                              <p className="text-[6px] font-bold text-slate-300 uppercase">MP3, WAV, OGG (Máx: 5MB)</p>
                            </>
                          )}
                        </div>
                        <input 
                          type="file" 
                          ref={saleSoundInputRef} 
                          className="hidden" 
                          accept="audio/mpeg,audio/wav,audio/ogg" 
                          onChange={handleSaleSoundUpload} 
                        />
                      </div>
                    </div>

                    <div className="flex flex-col justify-center space-y-6">
                      <div className="p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-inner space-y-4">
                        <p className="text-[8px] font-bold text-slate-400 uppercase italic leading-relaxed">
                          Encontre diversos efeitos sonoros gratuitos no site abaixo:
                        </p>
                        <a 
                          href="https://www.myinstants.com/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-600 hover:underline"
                        >
                          <LinkIcon className="w-4 h-4" />
                          MyInstants - Efeitos Sonoros
                        </a>
                        <button 
                          onClick={testSaleSound}
                          className={`w-full px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-2 ${testAudio ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white'}`}
                        >
                          {testAudio ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {testAudio ? 'Parar Teste' : 'Testar Som'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="space-y-6 pt-10 border-t dark:border-white/5">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Tema Base do Sistema</h3>
              </div>
              
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Escolher Tema</label>
                <select value={localSettings.sidebarTheme} onChange={e => handleUpdate({ sidebarTheme: e.target.value as any })} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-black text-xs uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner">
                    {sidebarThemes.map(t => (
                      <option key={t.id} value={t.id}>{t.label.toUpperCase()}</option>
                    ))}
                </select>
              </div>

              {localSettings.sidebarTheme === 'colored' && (
                <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-8 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 ml-1">
                        <input 
                          type="checkbox" 
                          id="sidebarMainColorEnabled"
                          checked={localSettings.sidebarMainColorEnabled || false} 
                          onChange={e => handleUpdate({ sidebarMainColorEnabled: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="sidebarMainColorEnabled" className="text-[9px] font-black uppercase text-slate-500 tracking-widest cursor-pointer">Cor do Fundo (Menu Lateral)</label>
                      </div>
                      {localSettings.sidebarMainColorEnabled && (
                        <input type="color" value={localSettings.sidebarMainColor || '#0f172a'} onChange={e => handleUpdate({ sidebarMainColor: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer border-2 border-white/10 shadow-sm animate-in zoom-in-95 p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 ml-1">
                        <input 
                          type="checkbox" 
                          id="sidebarTextColorEnabled"
                          checked={localSettings.sidebarTextColorEnabled || false} 
                          onChange={e => handleUpdate({ sidebarTextColorEnabled: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="sidebarTextColorEnabled" className="text-[9px] font-black uppercase text-slate-500 tracking-widest cursor-pointer">Cor do Texto</label>
                      </div>
                      {localSettings.sidebarTextColorEnabled && (
                        <input type="color" value={localSettings.sidebarTextColor || '#ffffff'} onChange={e => handleUpdate({ sidebarTextColor: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer border-2 border-white/10 shadow-sm animate-in zoom-in-95" />
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pt-2">
                        <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Ativar Degradê</label>
                        <button type="button" onClick={() => handleUpdate({ sidebarGradientEnabled: !localSettings.sidebarGradientEnabled })} className={`w-12 h-6 rounded-full transition-all relative ${localSettings.sidebarGradientEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${localSettings.sidebarGradientEnabled ? 'left-7' : 'left-1'}`}></div></button>
                      </div>
                      {localSettings.sidebarGradientEnabled && (
                        <div className="animate-in slide-in-from-top-2 space-y-2">
                          <div className="flex items-center gap-3 ml-1">
                            <input 
                              type="checkbox" 
                              id="sidebarSecondaryColorEnabled"
                              checked={localSettings.sidebarSecondaryColorEnabled || false} 
                              onChange={e => handleUpdate({ sidebarSecondaryColorEnabled: e.target.checked })}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="sidebarSecondaryColorEnabled" className="text-[9px] font-black uppercase text-slate-500 tracking-widest cursor-pointer">Cor Secundária</label>
                          </div>
                          {localSettings.sidebarSecondaryColorEnabled && (
                            <input type="color" value={localSettings.sidebarSecondaryColor || '#020617'} onChange={e => handleUpdate({ sidebarSecondaryColor: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer border-2 border-white/10 shadow-sm animate-in zoom-in-95" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Sistema de Mesas */}
            {isMaster && (
              <section className="space-y-6 pt-10 border-t dark:border-white/5">
                  <h4 className="text-[9px] font-black uppercase tracking-widest italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Módulos Adicionais</h4>
                  <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase text-slate-700 dark:text-white">Sistema de Mesas</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase italic">Habilita ou desabilita completamente o sistema de mesas</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleUpdate({ tablesSystemEnabled: !localSettings.tablesSystemEnabled })} 
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.tablesSystemEnabled !== false ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${localSettings.tablesSystemEnabled !== false ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase text-slate-700 dark:text-white">KDS (Kitchen Display System)</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase italic">Monitor de preparo para cozinha</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleUpdate({ kdsEnabled: !localSettings.kdsEnabled })} 
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.kdsEnabled !== false ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${localSettings.kdsEnabled !== false ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase text-slate-700 dark:text-white">Gestão de Compras & Fornecedores</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase italic">Controle de fornecedores e pedidos de compra</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleUpdate({ suppliersEnabled: !localSettings.suppliersEnabled })} 
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.suppliersEnabled !== false ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${localSettings.suppliersEnabled !== false ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase text-slate-700 dark:text-white">Fluxo de Caixa Detalhado (DRE)</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase italic">Análise financeira avançada e DRE</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleUpdate({ financialFlowEnabled: !localSettings.financialFlowEnabled })} 
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.financialFlowEnabled !== false ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${localSettings.financialFlowEnabled !== false ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase text-slate-700 dark:text-white">Sistema de Reservas</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase italic">Gestão de agendamentos de mesas</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleUpdate({ reservationsEnabled: !localSettings.reservationsEnabled })} 
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.reservationsEnabled !== false ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${localSettings.reservationsEnabled !== false ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                  </div>
              </section>
            )}

            {/* Afiliados */}
            {isMaster && (
              <section className="space-y-6 pt-10 border-t dark:border-white/5">
                  <h4 className="text-[9px] font-black uppercase tracking-widest italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Afiliados</h4>
                  <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase text-slate-700 dark:text-white">Ativar sistema de afiliados</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase italic">Habilita ou desabilita completamente o sistema de afiliados</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleUpdate({ affiliateSystemEnabled: !localSettings.affiliateSystemEnabled })} 
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.affiliateSystemEnabled !== false ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${localSettings.affiliateSystemEnabled !== false ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                  </div>
              </section>
            )}

            {/* Ajustes de Dimensões - FIXO E SEMPRE VISÍVEL ABAIXO DOS TEMAS */}
            <section className="space-y-6 pt-10 border-t dark:border-white/5">
                <h4 className="text-[9px] font-black uppercase tracking-widest italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Ajustes de Dimensões</h4>
                <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                          <div className="flex justify-between text-[9px] font-black uppercase text-slate-400"><span>Largura da Barra: {localSettings.sidebarWidth || 260}px</span></div>
                          <input type="range" min="200" max="350" step="5" value={localSettings.sidebarWidth || 260} onChange={e => handleUpdate({ sidebarWidth: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                      </div>
                      <div className="space-y-2">
                          <div className="flex justify-between text-[9px] font-black uppercase text-slate-400"><span>Espaçamento Item: {localSettings.sidebarItemPadding || 12}px</span></div>
                          <input type="range" min="8" max="24" step="1" value={localSettings.sidebarItemPadding || 12} onChange={e => handleUpdate({ sidebarItemPadding: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                      </div>
                      <div className="space-y-2">
                          <div className="flex justify-between text-[9px] font-black uppercase text-slate-400"><span>Tamanho da Fonte: {localSettings.sidebarFontSize || 11}px</span></div>
                          <input type="range" min="9" max="14" step="1" value={localSettings.sidebarFontSize || 11} onChange={e => handleUpdate({ sidebarFontSize: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                      </div>
                      <div className="space-y-2">
                          <div className="flex justify-between text-[9px] font-black uppercase text-slate-400"><span>Tamanho do Ícone: {localSettings.sidebarIconSize || 22}px</span></div>
                          <input type="range" min="16" max="32" step="1" value={localSettings.sidebarIconSize || 22} onChange={e => handleUpdate({ sidebarIconSize: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                      </div>
                      <div className="space-y-2">
                          <div className="flex justify-between text-[9px] font-black uppercase text-slate-400"><span>Arredondamento do item selecionado do menu lateral: {localSettings.sidebarActiveItemRadius ?? 12}px</span></div>
                          <input type="range" min="0" max="32" step="1" value={localSettings.sidebarActiveItemRadius ?? 12} onChange={e => handleUpdate({ sidebarActiveItemRadius: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                      </div>
                  </div>
                </div>
            </section>

            {/* Mensagem Global do Sistema */}
            {isMaster && (
              <section className="space-y-6 pt-10 border-t dark:border-white/5">
                  <h4 className="text-[9px] font-black uppercase tracking-widest italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Mensagem Global do Sistema</h4>
                  <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase text-slate-700 dark:text-white">Ativar mensagem global</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase italic">Exibe um pop-up obrigatório para todos os usuários ao logar</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleUpdate({ globalMessageEnabled: !localSettings.globalMessageEnabled })} 
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.globalMessageEnabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${localSettings.globalMessageEnabled ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                    
                    {localSettings.globalMessageEnabled && (
                      <div className="space-y-3 animate-in slide-in-from-top-2">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Conteúdo da Mensagem</label>
                        <textarea 
                          value={localSettings.globalMessageText || ''} 
                          onChange={e => handleUpdate({ globalMessageText: e.target.value })} 
                          className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px] resize-none" 
                          placeholder="Escreva aqui o aviso importante..."
                        />
                      </div>
                    )}
                  </div>
              </section>
            )}

            {isMaster && (
              <>
                <section className="space-y-6 pt-10 border-t dark:border-white/5">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic text-slate-400">Rodapé & WhatsApp</h3>
                  <div className="space-y-6">
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Mensagem de Rodapé</label><input value={localSettings.footerText || ''} onChange={e => handleUpdate({ footerText: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                    <div className="space-y-1 pt-6 border-t dark:border-white/5"><label className="text-[9px] font-black uppercase text-emerald-500 ml-2 tracking-widest italic">Link do WhatsApp (Suporte)</label><input value={localSettings.whatsappLink || ''} onChange={e => handleUpdate({ whatsappLink: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500" placeholder="https://wa.me/55..." /></div>
                  </div>
                </section>

                <section className="space-y-6 pt-10 border-t dark:border-white/5">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic text-rose-500">Mensagens de Bloqueio</h3>
                  <div className="space-y-6">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Mensagem de Suspensão</label>
                        <textarea 
                            value={localSettings.globalSuspensionMessage || ''} 
                            onChange={e => handleUpdate({ globalSuspensionMessage: e.target.value })} 
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-amber-500 resize-none" 
                            rows={2}
                            placeholder="ACESSO SUSPENSO: Regularize sua fatura para reativar o acesso ao sistema."
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Mensagem de Banimento</label>
                        <textarea 
                            value={localSettings.globalBanMessage || ''} 
                            onChange={e => handleUpdate({ globalBanMessage: e.target.value })} 
                            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-rose-500 resize-none" 
                            rows={2}
                            placeholder="ACESSO BLOQUEADO: Este terminal foi banido por violação dos termos de uso."
                        />
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        )}

        {activeTab === 'menu' && (
          <div className="space-y-10 animate-in slide-in-from-right-4">
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Organização do Menu Lateral</h3>
                <div className="flex gap-2">
                  <input 
                    value={newCatName} 
                    onChange={e => setNewCatName(e.target.value)} 
                    placeholder="NOVA CATEGORIA" 
                    className="px-4 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl font-black text-[9px] uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button onClick={addCategory} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase shadow-lg transition-all active:scale-95">+</button>
                </div>
              </div>

              <div className="space-y-6">
                {(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE).map((cat, catIdx) => (
                  <div key={cat.id} className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4 animate-in slide-in-from-bottom-2">
                    <div className="flex items-center justify-between border-b dark:border-white/5 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                        <input 
                          value={cat.label} 
                          onChange={e => {
                            const struct = JSON.parse(JSON.stringify(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE));
                            struct[catIdx].label = e.target.value.toUpperCase();
                            handleUpdate({ menuStructure: struct });
                          }}
                          className="bg-transparent font-black text-[10px] uppercase tracking-widest text-[var(--workspace-text)] outline-none focus:border-b-2 border-indigo-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => moveCategory(catIdx, 'up')} disabled={catIdx === 0} className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm text-slate-400 disabled:opacity-30 transition-all" onMouseEnter={e => e.currentTarget.style.color = localSettings.primaryColor || '#4f46e5'} onMouseLeave={e => e.currentTarget.style.color = ''}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" strokeWidth={3}/></svg>
                        </button>
                        <button onClick={() => moveCategory(catIdx, 'down')} disabled={catIdx === (localSettings.menuStructure || DEFAULT_MENU_STRUCTURE).length - 1} className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm text-slate-400 disabled:opacity-30 transition-all" onMouseEnter={e => e.currentTarget.style.color = localSettings.primaryColor || '#4f46e5'} onMouseLeave={e => e.currentTarget.style.color = ''}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={3}/></svg>
                        </button>
                        {cat.id !== 'master' && (
                          <button onClick={() => setConfirmDeleteCat(cat.id)} className="p-2 bg-rose-50 text-rose-500 rounded-lg shadow-sm transition-all hover:bg-rose-100">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {cat.items.filter(itemId => {
                        // Regras de visibilidade no editor
                        if (!isMaster) {
                          if (itemId === 'payment' || itemId === 'settings') return false;
                          if (itemId === 'user-management' || itemId === 'customer-management' || itemId === 'plan-management') return false;
                        }
                        return true;
                      }).map((itemId, itemIdx) => {
                        const viewInfo = allPossibleViews.find(v => v.id === itemId);
                        return (
                          <div key={itemId} className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 group/item">
                            <div className="flex gap-1 shrink-0">
                                <button onClick={() => moveItemOrder(catIdx, itemIdx, 'up')} disabled={itemIdx === 0} className="p-1 text-slate-300 disabled:opacity-0 transition-colors" onMouseEnter={e => e.currentTarget.style.color = localSettings.primaryColor || '#4f46e5'} onMouseLeave={e => e.currentTarget.style.color = ''}><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" strokeWidth={4}/></svg></button>
                                <button onClick={() => moveItemOrder(catIdx, itemIdx, 'down')} disabled={itemIdx === cat.items.length - 1} className="p-1 text-slate-300 disabled:opacity-0 transition-colors" onMouseEnter={e => e.currentTarget.style.color = localSettings.primaryColor || '#4f46e5'} onMouseLeave={e => e.currentTarget.style.color = ''}><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth={4}/></svg></button>
                            </div>
                            <div className="flex-1 space-y-1">
                              <label className="text-[7px] font-black uppercase text-slate-400 block ml-1">Nome no Menu</label>
                              <input 
                                value={localSettings.customLabels?.[`menu_${itemId}`] || (viewInfo?.label.toUpperCase())} 
                                onChange={e => updateItemLabel(itemId, e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-black text-[9px] uppercase outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="w-full md:w-32 space-y-1">
                              <label className="text-[7px] font-black uppercase text-slate-400 block ml-1">Atalho</label>
                              <select 
                                value={localSettings.menuShortcuts?.[itemId] || ''} 
                                onChange={e => updateItemShortcut(itemId, e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-black text-[9px] uppercase outline-none cursor-pointer"
                              >
                                <option value="">NENHUM</option>
                                {[1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12].map(num => (
                                  <option key={num} value={`F${num}`}>F{num}</option>
                                ))}
                              </select>
                            </div>
                            <div className="w-full md:w-40 space-y-1">
                              <label className="text-[7px] font-black uppercase text-slate-400 block ml-1">Mover para</label>
                              <select 
                                onChange={e => moveItemToCategory(itemId as View, cat.id, e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-black text-[9px] uppercase outline-none cursor-pointer"
                                value={cat.id}
                              >
                                {(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE).map(c => (
                                  <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                                <option value="none">NENHUM (OCULTAR)</option>
                              </select>
                            </div>
                          </div>
                        );
                      })}
                      {cat.items.length === 0 && (
                        <p className="text-[8px] font-black text-slate-300 text-center py-4 uppercase italic">Categoria Vazia</p>
                      )}
                    </div>
                  </div>
                ))}

                {/* Itens Ocultos (Nenhum) */}
                {(() => {
                  const allVisibleItems = (localSettings.menuStructure || DEFAULT_MENU_STRUCTURE).flatMap(c => c.items);
                  const hiddenItems = allPossibleViews.filter(v => {
                    // Se já estiver visível em alguma categoria, não é um item oculto
                    if (allVisibleItems.includes(v.id)) return false;
                    
                    // Regras de visibilidade no editor (mesmas do loop principal)
                    if (!isMaster) {
                      if (v.id === 'payment' || v.id === 'settings') return false;
                      if (v.id === 'user-management' || v.id === 'customer-management' || v.id === 'plan-management') return false;
                    }
                    return true;
                  });
                  
                  if (hiddenItems.length === 0) return null;

                  return (
                    <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                      <div className="flex items-center gap-3 border-b dark:border-white/5 pb-3">
                        <div className="w-1.5 h-6 bg-slate-400 rounded-full"></div>
                        <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">Itens Ocultos (Nenhum)</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {hiddenItems.map(item => (
                          <div key={item.id} className="flex flex-col md:flex-row items-start md:items-center gap-4 bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 opacity-60 hover:opacity-100 transition-opacity">
                            <div className="flex-1">
                              <span className="font-black text-[9px] uppercase tracking-widest text-slate-600 dark:text-slate-300">{item.label}</span>
                            </div>
                            <div className="w-full md:w-40 space-y-1">
                              <label className="text-[7px] font-black uppercase text-slate-400 block ml-1">Mover para</label>
                              <select 
                                onChange={e => moveItemToCategory(item.id as View, 'none', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-black text-[9px] uppercase outline-none cursor-pointer"
                                value="none"
                              >
                                <option value="none">NENHUM (OCULTAR)</option>
                                {(localSettings.menuStructure || DEFAULT_MENU_STRUCTURE).map(c => (
                                  <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="pt-6 border-t dark:border-white/5 flex flex-wrap justify-center gap-4">
                <button 
                  onClick={restoreMenuStructure}
                  className="px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Restaurar Gestor de Menu
                </button>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'marketing' && isMaster && (
          <div className="animate-in slide-in-from-right-4 space-y-10 max-w-4xl mx-auto">
            <div className="space-y-12 pb-20 flex flex-col items-center">
              <div className="grid grid-cols-1 gap-12 w-full max-w-4xl mx-auto">
                {/* --- IMAGEM DE MARKETING & FUNDO --- */}
                <section className="space-y-8 bg-slate-50 dark:bg-slate-800/40 p-8 md:p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="text-center space-y-2">
                    <h3 className="text-[12px] font-black uppercase tracking-[0.4em] italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Imagem de Marketing & Fundo</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Defina as imagens e o ambiente visual de fundo</p>
                  </div>

                  {/* Seletores de Ativação Elaborados */}
                  <div className="flex flex-col md:flex-row gap-6 justify-center items-center pb-8 border-b dark:border-white/5">
                    <button 
                      onClick={() => handleUpdate({ loginMarketingTextEnabled: true, loginMarketingImageEnabled: false })}
                      className={`flex items-center gap-4 p-6 rounded-[2rem] border-2 transition-all w-full md:w-auto min-w-[280px] group ${localSettings.loginMarketingTextEnabled !== false && !localSettings.loginMarketingImageEnabled ? 'shadow-lg' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 opacity-60 hover:opacity-100'}`}
                      style={localSettings.loginMarketingTextEnabled !== false && !localSettings.loginMarketingImageEnabled ? { backgroundColor: localSettings.primaryColor || '#4f46e5', borderColor: `${localSettings.primaryColor || '#4f46e5'}80`, boxShadow: `0 10px 15px -3px ${localSettings.primaryColor || '#4f46e5'}33` } : {}}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-colors ${localSettings.loginMarketingTextEnabled !== false && !localSettings.loginMarketingImageEnabled ? 'bg-white/20 text-white' : 'bg-white dark:bg-slate-900 text-slate-400'}`}>
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className={`text-[11px] font-black uppercase tracking-widest ${localSettings.loginMarketingTextEnabled !== false && !localSettings.loginMarketingImageEnabled ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>Marketing de Texto</p>
                        <p className={`text-[8px] font-bold uppercase italic ${localSettings.loginMarketingTextEnabled !== false && !localSettings.loginMarketingImageEnabled ? 'text-white/80' : 'text-slate-400'}`}>Textos e Balões de Recursos</p>
                      </div>
                      <div className={`ml-auto w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${localSettings.loginMarketingTextEnabled !== false && !localSettings.loginMarketingImageEnabled ? 'border-white bg-white' : 'border-slate-300 dark:border-slate-600'}`}>
                        {localSettings.loginMarketingTextEnabled !== false && !localSettings.loginMarketingImageEnabled && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: localSettings.primaryColor || '#4f46e5' }}></div>}
                      </div>
                    </button>

                    <button 
                      onClick={() => handleUpdate({ loginMarketingImageEnabled: true, loginMarketingTextEnabled: false })}
                      className={`flex items-center gap-4 p-6 rounded-[2rem] border-2 transition-all w-full md:w-auto min-w-[280px] group ${localSettings.loginMarketingImageEnabled ? 'shadow-lg' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 opacity-60 hover:opacity-100'}`}
                      style={localSettings.loginMarketingImageEnabled ? { backgroundColor: localSettings.primaryColor || '#4f46e5', borderColor: `${localSettings.primaryColor || '#4f46e5'}80`, boxShadow: `0 10px 15px -3px ${localSettings.primaryColor || '#4f46e5'}33` } : {}}
                    >
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-colors ${localSettings.loginMarketingImageEnabled ? 'bg-white/20 text-white' : 'bg-white dark:bg-slate-900 text-slate-400'}`}>
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <p className={`text-[11px] font-black uppercase tracking-widest ${localSettings.loginMarketingImageEnabled ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>Imagem Lateral</p>
                        <p className={`text-[8px] font-bold uppercase italic ${localSettings.loginMarketingImageEnabled ? 'text-white/80' : 'text-slate-400'}`}>Banner ou Vídeo de Marketing</p>
                      </div>
                      <div className={`ml-auto w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${localSettings.loginMarketingImageEnabled ? 'border-white bg-white' : 'border-slate-300 dark:border-slate-600'}`}>
                        {localSettings.loginMarketingImageEnabled && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: localSettings.primaryColor || '#4f46e5' }}></div>}
                      </div>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full">
                    {/* Imagem de Marketing (ao lado do box) */}
                    {localSettings.loginMarketingImageEnabled && (
                    <div className="space-y-4 p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm group animate-in zoom-in-95">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-center w-full block">Configuração da Imagem Lateral</label>
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                          <div className="w-28 h-28 bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-inner transition-all group-hover:border-indigo-500">
                            {localSettings.loginMarketingImageUrl ? (
                              localSettings.loginMarketingImageUrl.startsWith('data:video') ? (
                                <video src={localSettings.loginMarketingImageUrl} className="w-full h-full object-contain p-4" muted />
                              ) : (
                                <img src={localSettings.loginMarketingImageUrl} className="w-full h-full object-contain p-4" alt="marketing preview" />
                              )
                            ) : (
                              <svg className="w-10 h-10 text-slate-200 dark:text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 01-1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
                            )}
                          </div>
                          <button 
                            type="button" 
                            onClick={() => marketingImageInputRef.current?.click()} 
                            className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:scale-110 transition-transform active:scale-95 z-10"
                          >
                            <Upload className="w-5 h-5" />
                          </button>
                          <input type="file" ref={marketingImageInputRef} className="hidden" accept="image/png,image/gif,image/jpeg,video/mp4" onChange={handleMarketingImageUpload} />
                        </div>
                        {localSettings.loginMarketingImageUrl && (
                          <button onClick={() => handleUpdate({ loginMarketingImageUrl: '' })} className="text-[8px] font-black uppercase text-rose-500 hover:text-rose-600 transition-colors">Remover Imagem</button>
                        )}
                      </div>

                      <div className="space-y-6 p-6 bg-white/50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-100 dark:border-white/5 mt-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] italic text-center" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Coordenadas da Imagem</p>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-widest"><span>Eixo X: {localSettings.loginMarketingImageX ?? -350}px</span></div>
                            <input type="range" min="-1600" max="1600" step="10" value={localSettings.loginMarketingImageX ?? -350} onChange={e => handleUpdate({ loginMarketingImageX: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-widest"><span>Eixo Y: {localSettings.loginMarketingImageY ?? 0}px</span></div>
                            <input type="range" min="-1600" max="1600" step="10" value={localSettings.loginMarketingImageY ?? 0} onChange={e => handleUpdate({ loginMarketingImageY: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-widest"><span>Escala: {localSettings.loginMarketingImageScale ?? 1.0}x</span></div>
                            <input type="range" min="0.1" max="5.0" step="0.1" value={localSettings.loginMarketingImageScale ?? 1.0} onChange={e => handleUpdate({ loginMarketingImageScale: parseFloat(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                          </div>
                        </div>
                      </div>
                    </div>
                    )}

                    {/* Marketing de Texto (ao lado do box) */}
                    {localSettings.loginMarketingTextEnabled !== false && !localSettings.loginMarketingImageEnabled && (
                    <div className="space-y-6 p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm animate-in zoom-in-95">
                      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest text-center w-full block">Configuração do Marketing de Texto</label>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Título Principal</label>
                          <input 
                            value={localSettings.loginSalesTitle || ''} 
                            onChange={e => handleUpdate({ loginSalesTitle: e.target.value })}
                            className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-4 py-3 font-black text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner" 
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Tamanho Título</label>
                            <input type="number" value={localSettings.loginSalesTitleSize || 72} onChange={e => handleUpdate({ loginSalesTitleSize: parseInt(e.target.value) })} className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-4 py-3 font-bold text-[10px] outline-none shadow-inner" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Animação Título</label>
                            <select 
                              value={localSettings.loginSalesTitleAnim || 'slide'} 
                              onChange={e => handleUpdate({ loginSalesTitleAnim: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-4 py-3 font-bold text-[10px] outline-none shadow-inner"
                            >
                              <option value="none">Nenhuma</option>
                              <option value="fade-in">Fade In</option>
                              <option value="slide">Slide</option>
                              <option value="bounce">Bounce</option>
                              <option value="pulse">Pulse</option>
                              <option value="glitch">Glitch</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Cor Título</label>
                            <input type="color" value={localSettings.loginSalesTitleColor || '#ffffff'} onChange={e => handleUpdate({ loginSalesTitleColor: e.target.value })} className="w-full h-10 rounded-xl cursor-pointer border-2 border-white/10 shadow-sm p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Animação Subtexto</label>
                            <select 
                              value={localSettings.loginSalesTextAnim || 'typing'} 
                              onChange={e => handleUpdate({ loginSalesTextAnim: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-4 py-3 font-bold text-[10px] outline-none shadow-inner"
                            >
                              <option value="none">Nenhuma</option>
                              <option value="fade-in">Fade In</option>
                              <option value="slide">Slide</option>
                              <option value="bounce">Bounce</option>
                              <option value="pulse">Pulse</option>
                              <option value="glitch">Glitch</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Subtexto de Marketing</label>
                          <textarea 
                            value={localSettings.loginSalesText || ''} 
                            onChange={e => handleUpdate({ loginSalesText: e.target.value })}
                            rows={2}
                            className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-4 py-3 font-bold text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner resize-none" 
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Recursos (Um por linha)</label>
                          <textarea 
                            value={localSettings.loginFeatures || ''} 
                            onChange={e => handleUpdate({ loginFeatures: e.target.value })}
                            rows={3}
                            placeholder="EX: SUPORTE 24H&#10;GESTÃO COMPLETA"
                            className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-4 py-3 font-bold text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner resize-none" 
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Cor Balões</label>
                            <input type="color" value={localSettings.loginBalloonColor || '#0f172a'} onChange={e => handleUpdate({ loginBalloonColor: e.target.value })} className="w-full h-10 rounded-xl cursor-pointer border-2 border-white/10 shadow-sm p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Animação Balões</label>
                            <select 
                              value={localSettings.loginFeaturesAnimType || 'bounce'} 
                              onChange={e => handleUpdate({ loginFeaturesAnimType: e.target.value })}
                              className="w-full bg-white dark:bg-slate-900 border-none rounded-xl px-4 py-3 font-bold text-[10px] outline-none shadow-inner"
                            >
                              <option value="none">Nenhuma</option>
                              <option value="bounce">Bounce</option>
                              <option value="pulse">Pulse</option>
                              <option value="floating">Flutuar</option>
                              <option value="wave">Onda</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Cor Texto Balões</label>
                          <input type="color" value={localSettings.loginFeaturesTextColor || '#ffffff'} onChange={e => handleUpdate({ loginFeaturesTextColor: e.target.value })} className="w-full h-10 rounded-xl cursor-pointer border-2 border-white/10 shadow-sm p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" />
                        </div>
                      </div>

                      <div className="space-y-6 p-6 bg-white/50 dark:bg-slate-900/50 rounded-[2rem] border border-slate-100 dark:border-white/5 mt-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] italic text-center" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Posicionamento do Texto</p>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-widest"><span>Eixo X: {localSettings.loginMarketingLeft ?? -350}px</span></div>
                            <input type="range" min="-1600" max="1600" step="10" value={localSettings.loginMarketingLeft ?? -350} onChange={e => handleUpdate({ loginMarketingLeft: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-widest"><span>Eixo Y: {localSettings.loginMarketingTop ?? 0}px</span></div>
                            <input type="range" min="-1600" max="1600" step="10" value={localSettings.loginMarketingTop ?? 0} onChange={e => handleUpdate({ loginMarketingTop: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-widest"><span>Escala: {localSettings.loginMarketingScale ?? 1.0}x</span></div>
                            <input type="range" min="0.1" max="3.0" step="0.1" value={localSettings.loginMarketingScale ?? 1.0} onChange={e => handleUpdate({ loginMarketingScale: parseFloat(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                          </div>
                        </div>
                      </div>
                    </div>
                    )}

                    {/* Fundo da Tela */}
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Tipo de Fundo da Tela</label>
                        <select 
                          value={localSettings.loginScreenBgType || 'color'} 
                          onChange={e => handleUpdate({ loginScreenBgType: e.target.value as any })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-black text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                        >
                          <option value="color">COR SÓLIDA</option>
                          <option value="image">IMAGEM (JPEG/PNG)</option>
                          <option value="gif">GIF ANIMADO</option>
                          <option value="video">VÍDEO CURTO (MP4)</option>
                        </select>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Tema Animado (Efeito)</label>
                        <select 
                          value={localSettings.loginEffect || 'none'} 
                          onChange={e => handleUpdate({ loginEffect: e.target.value as any })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-black text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                        >
                          <option value="none">NENHUM EFEITO</option>
                          <option value="aurora">AURORA BOREAL</option>
                          <option value="particles">PARTÍCULAS FLUTUANTES</option>
                          <option value="stars">ESTRELAS CADENTES</option>
                          <option value="rain">CHUVA DIGITAL</option>
                          <option value="matrix">MATRIX CODE</option>
                          <option value="cyber">CYBERPUNK GRID</option>
                        </select>
                        <div className="flex items-center gap-3 ml-2 mt-2">
                          <input 
                            type="checkbox" 
                            id="loginEffectColorEnabled"
                            checked={localSettings.loginEffectColorEnabled || false} 
                            onChange={e => handleUpdate({ loginEffectColorEnabled: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <label htmlFor="loginEffectColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Personalizar Cor do Efeito</label>
                        </div>
                        {localSettings.loginEffectColorEnabled && (
                          <div className="flex gap-4 items-center animate-in zoom-in-95 mt-2">
                            <input type="color" value={localSettings.loginEffectColor || localSettings.primaryColor || '#4f46e5'} onChange={e => handleUpdate({ loginEffectColor: e.target.value })} className="w-12 h-12 min-w-[48px] min-h-[48px] shrink-0 rounded-xl cursor-pointer border-2 border-slate-100 dark:border-white/10 shadow-sm p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" />
                            <p className="text-[8px] font-bold text-slate-400 uppercase italic">A cor do efeito se adapta a esta escolha</p>
                          </div>
                        )}
                      </div>

                      {localSettings.loginScreenBgType === 'color' && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 ml-2">
                            <input 
                              type="checkbox" 
                              id="loginScreenBgColorEnabled"
                              checked={localSettings.loginScreenBgColorEnabled || false} 
                              onChange={e => handleUpdate({ loginScreenBgColorEnabled: e.target.checked })}
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="loginScreenBgColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Personalizar Cor de Fundo</label>
                          </div>
                          {localSettings.loginScreenBgColorEnabled && (
                            <div className="flex gap-4 items-center animate-in zoom-in-95">
                              <input 
                                type="color" 
                                value={localSettings.loginScreenBgColor || '#0a0f1e'} 
                                onChange={e => handleUpdate({ loginScreenBgColor: e.target.value })} 
                                className="w-16 h-16 min-w-[64px] min-h-[64px] shrink-0 rounded-2xl cursor-pointer border-2 border-slate-100 dark:border-white/10 shadow-sm p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-xl" 
                              />
                              <input type="text" value={localSettings.loginScreenBgColor || ''} onChange={e => handleUpdate({ loginScreenBgColor: e.target.value })} className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-mono text-xs outline-none" />
                            </div>
                          )}
                        </div>
                      )}
                      {localSettings.loginScreenBgType !== 'color' && (
                        <div className="space-y-3">
                          <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Arquivo de Fundo (Upload/URL)</label>
                          <div className="flex gap-2">
                            <input 
                              value={localSettings.loginScreenBgUrl || ''} 
                              onChange={e => handleUpdate({ loginScreenBgUrl: e.target.value })} 
                              placeholder="https://..."
                              className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-[10px] outline-none"
                            />
                            <button 
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = localSettings.loginScreenBgType === 'video' ? 'video/mp4' : 'image/*';
                                input.onchange = async (e: any) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    const isVideo = localSettings.loginScreenBgType === 'video';
                                    const limit = isVideo ? 10 * 1024 * 1024 : 1 * 1024 * 1024;
                                    if (file.size > limit) {
                                      alert(`O arquivo deve ter no máximo ${isVideo ? '10MB' : '1MB'}.`);
                                      return;
                                    }

                                    try {
                                      const url = await uploadFile(file, 'login-bg');
                                      handleUpdate({ loginScreenBgUrl: url });
                                    } catch (err) {
                                      console.error('Erro no upload:', err);
                                      alert('Erro ao fazer upload do fundo para o Firebase Storage.');
                                    }
                                  }
                                };
                                input.click();
                              }}
                              className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {/* Especificações de Tamanho e Looping */}
                          <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100/50 dark:border-indigo-500/10">
                              <p className="text-[8px] font-black uppercase mb-1 tracking-widest" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Tamanho Recomendado</p>
                              <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Full HD: 1920×1080</p>
                              <p className="text-[8px] font-medium text-slate-400 uppercase mt-1">Compatível com outros tamanhos proporcionais</p>
                            </div>
                            
                            {(localSettings.loginScreenBgType === 'gif' || localSettings.loginScreenBgType === 'video') && (
                              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-white/5">
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-black uppercase text-slate-700 dark:text-white">Ativar Looping</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase italic">Repetir automaticamente</p>
                                </div>
                                <button 
                                  type="button" 
                                  onClick={() => handleUpdate({ loginScreenBgLoop: !localSettings.loginScreenBgLoop })} 
                                  className={`w-10 h-5 rounded-full transition-all relative ${localSettings.loginScreenBgLoop ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                                >
                                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${localSettings.loginScreenBgLoop ? 'left-5.5' : 'left-0.5'}`}></div>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-3 pt-4 border-t dark:border-white/5">
                        <div className="flex items-center gap-3 ml-2">
                          <input 
                            type="checkbox" 
                            id="loginMarketingPrimaryColorEnabled"
                            checked={localSettings.loginMarketingPrimaryColorEnabled || false} 
                            onChange={e => handleUpdate({ loginMarketingPrimaryColorEnabled: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <label htmlFor="loginMarketingPrimaryColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Personalizar Destaque Marketing (Hover)</label>
                        </div>
                        {localSettings.loginMarketingPrimaryColorEnabled && (
                          <div className="flex gap-4 items-center animate-in zoom-in-95">
                            <input type="color" value={localSettings.loginMarketingPrimaryColor || '#6366f1'} onChange={e => handleUpdate({ loginMarketingPrimaryColor: e.target.value })} className="w-16 h-16 min-w-[64px] min-h-[64px] shrink-0 rounded-2xl cursor-pointer border-2 border-slate-100 dark:border-white/10 shadow-sm p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-xl" />
                            <div className="flex-1">
                              <p className="text-[10px] font-black uppercase text-slate-500">Cor de Destaque</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase italic">Usada em efeitos de hover nos balões</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 pt-4 border-t dark:border-white/5">
                        <div className="flex items-center gap-3 ml-2">
                          <input 
                            type="checkbox" 
                            id="loginTextColorEnabled"
                            checked={localSettings.loginTextColorEnabled || false} 
                            onChange={e => handleUpdate({ loginTextColorEnabled: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <label htmlFor="loginTextColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Personalizar Cor dos Textos (Links)</label>
                        </div>
                        {localSettings.loginTextColorEnabled && (
                          <div className="flex gap-4 items-center animate-in zoom-in-95">
                            <input type="color" value={localSettings.loginTextColor || '#6366f1'} onChange={e => handleUpdate({ loginTextColor: e.target.value })} className="w-16 h-16 min-w-[64px] min-h-[64px] shrink-0 rounded-2xl cursor-pointer border-2 border-slate-100 dark:border-white/10 shadow-sm p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-xl" />
                            <div className="flex-1">
                              <p className="text-[10px] font-black uppercase text-slate-500">Cor do Texto da Tela de Login</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase italic">Aplicada em "Esqueci minha senha" e outros links</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3 pt-4 border-t dark:border-white/5">
                        <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-2">Tema da Tela de Login</label>
                        <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1.5 rounded-2xl gap-1">
                          <button 
                            onClick={() => handleUpdate({ loginTheme: 'light' })} 
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${localSettings.loginTheme === 'light' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                          >
                            <span className="text-sm">☀️</span> Claro
                          </button>
                          <button 
                            onClick={() => handleUpdate({ loginTheme: 'dark' })} 
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[9px] font-black uppercase transition-all ${localSettings.loginTheme === 'dark' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                          >
                            <span className="text-sm">🌙</span> Escuro
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* --- PERSONALIZAÇÃO DO BOX DE LOGIN --- */}
                <section className="space-y-8 bg-slate-50 dark:bg-slate-800/40 p-8 md:p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="text-center space-y-2">
                    <h3 className="text-[12px] font-black uppercase tracking-[0.4em] italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Personalização do Box de Login</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ajuste as cores e o estilo do box</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 ml-2">
                        <input 
                          type="checkbox" 
                          id="loginBoxBgColorEnabled"
                          checked={localSettings.loginBoxBgColorEnabled || false} 
                          onChange={e => handleUpdate({ loginBoxBgColorEnabled: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="loginBoxBgColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Fundo do Box</label>
                      </div>
                      {localSettings.loginBoxBgColorEnabled && (
                        <input type="color" value={localSettings.loginBoxBgColor || '#0f172a'} onChange={e => handleUpdate({ loginBoxBgColor: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer border-2 border-white/10 shadow-sm animate-in zoom-in-95 p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 ml-2">
                        <input 
                          type="checkbox" 
                          id="loginBoxBorderColorEnabled"
                          checked={localSettings.loginBoxBorderColorEnabled || false} 
                          onChange={e => handleUpdate({ loginBoxBorderColorEnabled: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="loginBoxBorderColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Borda do Box</label>
                      </div>
                      {localSettings.loginBoxBorderColorEnabled && (
                        <input type="color" value={localSettings.loginBoxBorderColor || '#ffffff'} onChange={e => handleUpdate({ loginBoxBorderColor: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer border-2 border-white/10 shadow-sm animate-in zoom-in-95 p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 ml-2">
                        <input 
                          type="checkbox" 
                          id="loginBoxTitleColorEnabled"
                          checked={localSettings.loginBoxTitleColorEnabled || false} 
                          onChange={e => handleUpdate({ loginBoxTitleColorEnabled: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="loginBoxTitleColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Título do Box</label>
                      </div>
                      {localSettings.loginBoxTitleColorEnabled && (
                        <input type="color" value={localSettings.loginBoxTitleColor || '#ffffff'} onChange={e => handleUpdate({ loginBoxTitleColor: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer border-2 border-white/10 shadow-sm animate-in zoom-in-95 p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 ml-2">
                        <input 
                          type="checkbox" 
                          id="loginBoxBtnColorEnabled"
                          checked={localSettings.loginBoxBtnColorEnabled || false} 
                          onChange={e => handleUpdate({ loginBoxBtnColorEnabled: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="loginBoxBtnColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Botão "Entrar"</label>
                      </div>
                      {localSettings.loginBoxBtnColorEnabled && (
                        <input type="color" value={localSettings.loginBoxBtnColor || '#4f46e5'} onChange={e => handleUpdate({ loginBoxBtnColor: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer border-2 border-white/10 shadow-sm animate-in zoom-in-95 p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 ml-2">
                        <input 
                          type="checkbox" 
                          id="loginBoxTextColorEnabled"
                          checked={localSettings.loginBoxTextColorEnabled || false} 
                          onChange={e => handleUpdate({ loginBoxTextColorEnabled: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="loginBoxTextColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Texto do Box</label>
                      </div>
                      {localSettings.loginBoxTextColorEnabled && (
                        <input type="color" value={localSettings.loginBoxTextColor || '#94a3b8'} onChange={e => handleUpdate({ loginBoxTextColor: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer border-2 border-white/10 shadow-sm animate-in zoom-in-95 p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 ml-2">
                        <input 
                          type="checkbox" 
                          id="loginBoxPlaceholderColorEnabled"
                          checked={localSettings.loginBoxPlaceholderColorEnabled || false} 
                          onChange={e => handleUpdate({ loginBoxPlaceholderColorEnabled: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <label htmlFor="loginBoxPlaceholderColorEnabled" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Cor do Placeholder</label>
                      </div>
                      {localSettings.loginBoxPlaceholderColorEnabled && (
                        <input type="color" value={localSettings.loginBoxPlaceholderColor || '#64748b'} onChange={e => handleUpdate({ loginBoxPlaceholderColor: e.target.value })} className="w-full h-12 rounded-xl cursor-pointer border-2 border-white/10 shadow-sm animate-in zoom-in-95 p-0 overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg" />
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-black uppercase text-slate-400 tracking-widest px-2"><span>Raio da Borda: {localSettings.loginBoxBorderRadius ?? 72}px</span></div>
                      <input type="range" min="0" max="150" step="1" value={localSettings.loginBoxBorderRadius ?? 72} onChange={e => handleUpdate({ loginBoxBorderRadius: parseInt(e.target.value) })} className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-black uppercase text-slate-400 tracking-widest px-2"><span>Padding Interno: {localSettings.loginBoxPadding ?? 40}px</span></div>
                      <input type="range" min="10" max="100" step="1" value={localSettings.loginBoxPadding ?? 40} onChange={e => handleUpdate({ loginBoxPadding: parseInt(e.target.value) })} className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    </div>
                  </div>
                </section>

                <section className="space-y-8 bg-slate-50 dark:bg-slate-800/40 p-8 md:p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="text-center space-y-2">
                    <h3 className="text-[12px] font-black uppercase tracking-[0.4em] italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Alinhamento & Posição</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Ajustes de layout estrutural</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full">
                    <div className="space-y-3">
                       <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Alinhamento Marketing</label>
                       <select value={localSettings.loginMarketingAlign || 'center'} onChange={e => handleUpdate({ loginMarketingAlign: e.target.value as any })} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.8rem] px-6 py-5 font-black text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner">
                          <option value="left">ESQUERDA</option>
                          <option value="center">CENTRO</option>
                          <option value="right">DIREITA</option>
                       </select>
                    </div>
                    <div className="space-y-3">
                       <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Alinhamento do Box</label>
                       <select value={localSettings.loginBoxPosition || 'center'} onChange={e => handleUpdate({ loginBoxPosition: e.target.value as any })} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.8rem] px-6 py-5 font-black text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner">
                          <option value="left">ESQUERDA</option>
                          <option value="center">CENTRO</option>
                          <option value="right">DIREITA</option>
                       </select>
                    </div>
                    <div className="space-y-3 flex items-center gap-3 pt-6">
                      <input 
                        type="checkbox" 
                        id="showDemoLink"
                        checked={localSettings.showDemoLink || false} 
                        onChange={e => handleUpdate({ showDemoLink: e.target.checked })}
                        className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="showDemoLink" className="text-[10px] font-black uppercase italic tracking-widest cursor-pointer" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Mostrar link de demonstração na tela de login</label>
                    </div>
                    {localSettings.showDemoLink && (
                      <div className="space-y-3 pt-2">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Texto do link da demonstração</label>
                        <input 
                          type="text" 
                          value={localSettings.demoLinkText || ''} 
                          onChange={e => handleUpdate({ demoLinkText: e.target.value })}
                          placeholder="EX: VER DEMONSTRAÇÃO DO SISTEMA"
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-[1.8rem] px-6 py-5 font-black text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                        />
                        <p className="text-[8px] font-bold text-slate-400 uppercase ml-2 italic">Se vazio, usará: "Ver demonstração do sistema"</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center w-full">
                    <div className="w-full max-w-md space-y-6 p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] italic text-center" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Coordenadas Box</p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-widest"><span>Eixo X: {localSettings.loginBoxLeft ?? 550}px</span></div>
                          <input type="range" min="-1600" max="1600" step="10" value={localSettings.loginBoxLeft ?? 550} onChange={e => handleUpdate({ loginBoxLeft: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-widest"><span>Eixo Y: {localSettings.loginBoxTop ?? 0}px</span></div>
                          <input type="range" min="-1600" max="1600" step="10" value={localSettings.loginBoxTop ?? 0} onChange={e => handleUpdate({ loginBoxTop: parseInt(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[9px] font-black uppercase text-slate-500 tracking-widest"><span>Escala: {localSettings.loginBoxScale ?? 1.0}x</span></div>
                          <input type="range" min="0.1" max="3.0" step="0.1" value={localSettings.loginBoxScale ?? 1.0} onChange={e => handleUpdate({ loginBoxScale: parseFloat(e.target.value) })} className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'loginButtons' && isMaster && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4">
            {(localSettings.loginButtonsOrder || ['Plans', 'Request', 'Regularize', 'Support']).map((type, idx, arr) => (
               <React.Fragment key={type}>
                  {renderButtonConfigGroup(type as any, idx, arr.length)}
               </React.Fragment>
            ))}
          </div>
        )}

        {activeTab === 'ia' && isMaster && (
          <div className="space-y-10 animate-in slide-in-from-right-4">
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Configurações de Inteligência Artificial</h3>
              </div>
              
              <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-8">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase text-slate-700 dark:text-white">Ativar Sistema de IA</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase italic">Habilita ou desabilita as previsões e análises inteligentes no painel</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => handleUpdate({ aiSettings: { ...(localSettings.aiSettings || DEFAULT_SETTINGS.aiSettings!), enabled: !localSettings.aiSettings?.enabled } })} 
                    className={`w-12 h-6 rounded-full transition-all relative ${localSettings.aiSettings?.enabled !== false ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${localSettings.aiSettings?.enabled !== false ? 'left-7' : 'left-1'}`}></div>
                  </button>
                </div>

                {localSettings.aiSettings?.enabled !== false && (
                  <div className="space-y-6 pt-6 border-t dark:border-white/5 animate-in slide-in-from-top-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-700 dark:text-white">Previsão de Movimento</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase italic">Analisa horários de pico e fluxo de clientes</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleUpdate({ aiSettings: { ...(localSettings.aiSettings || DEFAULT_SETTINGS.aiSettings!), movementPredictionEnabled: !localSettings.aiSettings?.movementPredictionEnabled } })} 
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.aiSettings?.movementPredictionEnabled !== false ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${localSettings.aiSettings?.movementPredictionEnabled !== false ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-700 dark:text-white">Previsão de Reposição de Estoque</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase italic">Analisa ritmo de vendas e alerta sobre esgotamento de itens</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleUpdate({ aiSettings: { ...(localSettings.aiSettings || DEFAULT_SETTINGS.aiSettings!), stockPredictionEnabled: !localSettings.aiSettings?.stockPredictionEnabled } })} 
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.aiSettings?.stockPredictionEnabled !== false ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${localSettings.aiSettings?.stockPredictionEnabled !== false ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
                        <span>Mínimo de Vendas para Análise: {localSettings.aiSettings?.minSalesForAnalysis || 5}</span>
                      </div>
                      <input 
                        type="range" 
                        min="1" 
                        max="50" 
                        step="1" 
                        value={localSettings.aiSettings?.minSalesForAnalysis || 5} 
                        onChange={e => handleUpdate({ aiSettings: { ...(localSettings.aiSettings || DEFAULT_SETTINGS.aiSettings!), minSalesForAnalysis: parseInt(e.target.value) } })} 
                        className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600" 
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm flex gap-4 items-start">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl text-amber-600 dark:text-amber-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2}/></svg>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-200">Sobre o Aprendizado Contínuo</p>
                  <p className="text-[8px] font-bold text-amber-700 dark:text-amber-300 uppercase italic">A IA aprende automaticamente com cada venda registrada. Quanto mais dados o sistema tiver, mais precisas serão as previsões de movimento e estoque.</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="space-y-12 animate-in slide-in-from-bottom-4">
             <section className="space-y-8">
                <div className="flex items-center gap-3">
                   <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100 dark:border-indigo-900/40">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                   </div>
                   <div>
                      <h3 className="text-sm font-black uppercase italic tracking-tighter leading-none" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Gestão de Dados</h3>
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">Snapshot e Restauração do Terminal</p>
                   </div>
                </div>
                <div className="flex flex-col items-center justify-center py-12 space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
                    <button 
                       type="button" 
                       onClick={isMaster ? exportFullBackup : () => exportTenantBackup(user?.tenantId || '')} 
                       className="flex flex-col items-center gap-4 p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-700 transition-all group"
                    >
                       <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform shadow-inner">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                       </div>
                       <div className="text-center">
                         <span className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white block">Baixar backup</span>
                         <span className="text-[7px] font-bold text-slate-400 uppercase mt-1">Exportar arquivo .json</span>
                       </div>
                    </button>

                    <button 
                       type="button" 
                       onClick={() => importInputRef.current?.click()} 
                       className="flex flex-col items-center gap-4 p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:border-emerald-500 hover:bg-white dark:hover:bg-slate-700 transition-all group"
                    >
                       <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform shadow-inner">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 17l-4 4m0 0l-4-4m4 4V3" /></svg>
                       </div>
                       <div className="text-center">
                         <span className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white block">Restaurar</span>
                         <span className="text-[7px] font-bold text-slate-400 uppercase mt-1">Importar arquivo de dados</span>
                       </div>
                       <input type="file" ref={importInputRef} onChange={handleImportBackup} className="hidden" accept=".json" />
                    </button>
                   </div>
                </div>
             </section>

             {/* SMTP Settings */}
             {isMaster && (
             <section className="space-y-8 pt-8 border-t dark:border-white/5">
                <div className="flex items-center gap-3">
                   <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100 dark:border-indigo-900/40">
                      <Mail className="w-6 h-6" />
                   </div>
                   <div>
                      <h3 className="text-sm font-black uppercase italic tracking-tighter leading-none" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Configurações de E-mail (SMTP)</h3>
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">Para redefinição de senha e notificações</p>
                   </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Servidor SMTP (Host)</label>
                        <input 
                          value={localSettings.smtpHost || ''} 
                          onChange={e => handleUpdate({ smtpHost: e.target.value })} 
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                          placeholder="smtp.gmail.com"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Porta SMTP</label>
                        <input 
                          type="number"
                          value={localSettings.smtpPort || 465} 
                          onChange={e => handleUpdate({ smtpPort: parseInt(e.target.value) })} 
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                          placeholder="465"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Usuário (E-mail)</label>
                        <input 
                          value={localSettings.smtpUser || ''} 
                          onChange={e => handleUpdate({ smtpUser: e.target.value })} 
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                          placeholder="seu-email@gmail.com"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Senha de App</label>
                        <input 
                          type="password"
                          value={localSettings.smtpPass || ''} 
                          onChange={e => handleUpdate({ smtpPass: e.target.value })} 
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                          placeholder="••••••••••••••••"
                        />
                    </div>
                    <div className="flex items-center gap-3 ml-2">
                      <input 
                        type="checkbox" 
                        id="smtpSecure"
                        checked={localSettings.smtpSecure !== false} 
                        onChange={e => handleUpdate({ smtpSecure: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="smtpSecure" className="text-[9px] font-black uppercase text-slate-400 tracking-widest cursor-pointer">Usar SSL/TLS (Seguro)</label>
                    </div>
                </div>
             </section>
             )}
          </div>
        )}

        {activeTab === 'payments' && isMaster && (
          <div className="space-y-10 animate-in fade-in">
             <section className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic border-b dark:border-white/5 pb-2" style={{ color: localSettings.primaryColor || '#4f46e5' }}>1. Integração Mercado Pago</h3>
                <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Access Token (Produção)</label>
                    <input 
                      type="password" 
                      value={localSettings.mercadoPagoAccessToken || ''} 
                      onChange={e => handleUpdate({ mercadoPagoAccessToken: e.target.value })} 
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                      placeholder="APP_USR-..."
                    />
                </div>
             </section>
             <section className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6 pt-10 border-t dark:border-white/5">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic border-b dark:border-white/5 pb-2" style={{ color: localSettings.primaryColor || '#4f46e5' }}>2. Pagamento Manual</h3>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Instruções de Pagamento</label>
                        <textarea 
                          value={localSettings.paymentInstructions || ''} 
                          onChange={e => handleUpdate({ paymentInstructions: e.target.value })} 
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-300 dark:placeholder:text-slate-600" 
                          rows={3} 
                          placeholder="Chave PIX: 00.000.000/0001-00 (CNPJ)"
                        />
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Mensagem: Recebimento Manual</label>
                        <input 
                          value={localSettings.billingManualPendingMessage || ''} 
                          onChange={e => handleUpdate({ billingManualPendingMessage: e.target.value })} 
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500" 
                          placeholder="Parabéns, o administrador irá verificar seu pagamento"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Mensagem: Pagamento Aprovado</label>
                        <input 
                          value={localSettings.billingApprovedMessage || ''} 
                          onChange={e => handleUpdate({ billingApprovedMessage: e.target.value })} 
                          className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500" 
                          placeholder="Parabéns, pagamento aprovado!"
                        />
                    </div>
                </div>
             </section>
          </div>
        )}

        {activeTab === 'modules' && canSeeModules && (
          <div className="space-y-10 animate-in slide-in-from-bottom-4">
            <section className="space-y-6">
              <div className="flex items-center justify-between border-b dark:border-white/5 pb-4">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Configurações dos Módulos</h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                    {isMaster ? 'Ajuste o comportamento de cada funcionalidade adicional' : 'Ajuste as configurações do seu monitor de cozinha'}
                  </p>
                </div>
              </div>

              {/* KDS - Kitchen Display System */}
              <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                <div className="flex items-center gap-4 border-b dark:border-white/5 pb-4">
                  <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600">
                    <Monitor className="w-6 h-6" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>1. Monitor de Cozinha (KDS)</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Atualização Automática</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Intervalo em segundos</p>
                      </div>
                      <input 
                        type="number" 
                        value={localSettings.kdsAutoRefreshInterval || 10} 
                        onChange={e => handleUpdate({ kdsAutoRefreshInterval: parseInt(e.target.value) })}
                        className="w-20 px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-black text-[10px] text-center outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Notificação Sonora</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Avisar novos pedidos</p>
                      </div>
                      <button 
                        onClick={() => handleUpdate({ kdsSoundNotification: !localSettings.kdsSoundNotification })}
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.kdsSoundNotification ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localSettings.kdsSoundNotification ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Tamanho da Fonte</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Visualização dos pedidos</p>
                      </div>
                      <select 
                        value={localSettings.kdsFontSize || 'medium'}
                        onChange={e => handleUpdate({ kdsFontSize: e.target.value as any })}
                        className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-3 py-2 font-black text-[9px] uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="small">Pequeno</option>
                        <option value="medium">Médio</option>
                        <option value="large">Grande</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Exibir Entregues</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Mostrar histórico recente</p>
                      </div>
                      <button 
                        onClick={() => handleUpdate({ kdsShowDeliveredOrders: !localSettings.kdsShowDeliveredOrders })}
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.kdsShowDeliveredOrders ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localSettings.kdsShowDeliveredOrders ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Enviar ao Imprimir</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Enviar para KDS ao imprimir comanda</p>
                      </div>
                      <button 
                        onClick={() => handleUpdate({ kdsSendOnPrint: !localSettings.kdsSendOnPrint })}
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.kdsSendOnPrint ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localSettings.kdsSendOnPrint ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <input type="checkbox" checked={localSettings.kdsShowOrderNumber || false} onChange={e => handleUpdate({ kdsShowOrderNumber: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
                    <span className="text-[8px] font-black uppercase text-slate-500">Nº Pedido</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <input type="checkbox" checked={localSettings.kdsShowTableOrDirect || false} onChange={e => handleUpdate({ kdsShowTableOrDirect: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
                    <span className="text-[8px] font-black uppercase text-slate-500">Mesa/Venda</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <input type="checkbox" checked={localSettings.kdsShowOrderTime || false} onChange={e => handleUpdate({ kdsShowOrderTime: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
                    <span className="text-[8px] font-black uppercase text-slate-500">Hora Pedido</span>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <input type="checkbox" checked={localSettings.kdsFullscreenMode || false} onChange={e => handleUpdate({ kdsFullscreenMode: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-indigo-600" />
                    <span className="text-[8px] font-black uppercase text-slate-500">Modo Tela Cheia</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Tamanho do Card</label>
                    <select value={localSettings.kdsCardSize || 'medium'} onChange={e => handleUpdate({ kdsCardSize: e.target.value as any })} className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 font-black text-[9px] uppercase outline-none">
                      <option value="small">Pequeno</option>
                      <option value="medium">Médio</option>
                      <option value="large">Grande</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Cards por Linha</label>
                    <input type="number" value={localSettings.kdsOrdersPerRow || 4} onChange={e => handleUpdate({ kdsOrdersPerRow: parseInt(e.target.value) })} className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 font-black text-[9px] outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Tema da Tela da Cozinha</label>
                    <select value={localSettings.kdsTheme || 'dark'} onChange={e => handleUpdate({ kdsTheme: e.target.value as any })} className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 font-black text-[9px] uppercase outline-none">
                      <option value="light">Tema Claro</option>
                      <option value="dark">Tema Escuro</option>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-2">Título da Tela da Cozinha</label>
                    <input 
                      type="text" 
                      placeholder="Digite o nome do seu estabelecimento"
                      value={localSettings.kdsTitle || ''} 
                      onChange={e => handleUpdate({ kdsTitle: e.target.value })} 
                      className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 font-black text-[9px] outline-none uppercase" 
                    />
                    <p className="text-[7px] font-bold text-slate-400 uppercase ml-2 italic">Deixe vazio para usar o nome da conta automaticamente</p>
                  </div>
                </div>

                {/* Preview e Instruções do Monitor de Cozinha */}
                <div className="mt-12 pt-12 border-t dark:border-white/5 space-y-8">
                  <div className="space-y-2">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white italic">Preview do Monitor de Cozinha</h5>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">Simulação visual da tela que será exibida na TV</p>
                  </div>

                  {/* Preview Simulator */}
                  <div className={`${localSettings.kdsTheme === 'light' ? 'bg-slate-50' : 'bg-slate-950'} rounded-[2rem] p-6 border ${localSettings.kdsTheme === 'light' ? 'border-slate-200' : 'border-white/10'} shadow-2xl overflow-hidden relative transition-all duration-500`}>
                    <div className={`absolute inset-0 ${localSettings.kdsTheme === 'light' ? 'bg-gradient-to-br from-indigo-500/5 to-transparent' : 'bg-gradient-to-br from-indigo-500/5 to-transparent'} pointer-events-none`}></div>
                    
                    {/* Fake Header */}
                    <div className={`flex items-center justify-between mb-6 border-b ${localSettings.kdsTheme === 'light' ? 'border-slate-200' : 'border-white/5'} pb-4`}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center">
                          <Monitor className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-tighter ${localSettings.kdsTheme === 'light' ? 'text-slate-800' : 'text-white'} italic`}>
                          {localSettings.kdsTitle || settings.systemName || 'COZINHA'} - MONITOR
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-[9px] font-black ${localSettings.kdsTheme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>20:45</span>
                        <div className={`px-3 py-1 ${localSettings.kdsTheme === 'light' ? 'bg-slate-100' : 'bg-slate-800'} rounded-lg border ${localSettings.kdsTheme === 'light' ? 'border-slate-200' : 'border-white/5'}`}>
                          <span className="text-[7px] font-black uppercase text-indigo-400">Fila: 03</span>
                        </div>
                      </div>
                    </div>

                    {/* Fake Cards Grid */}
                    <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${Math.min(localSettings.kdsOrdersPerRow || 2, 2)}, 1fr)` }}>
                      {/* Card 1: Preparing */}
                      <div className={`${localSettings.kdsTheme === 'light' ? 'bg-white' : 'bg-slate-900'} rounded-2xl border ${localSettings.kdsTheme === 'light' ? 'border-slate-200' : 'border-white/5'} overflow-hidden flex flex-col scale-95 shadow-sm`}>
                        <div className="p-2 bg-amber-500 flex justify-between items-center">
                          <div className="flex items-center gap-1.5 text-white">
                            <Clock className="w-2.5 h-2.5" />
                            <span className="text-[7px] font-black uppercase">12 min</span>
                          </div>
                          {localSettings.kdsShowTableOrDirect && (
                            <span className="text-[7px] font-black uppercase bg-black/20 px-1.5 py-0.5 rounded-md text-white">MESA 04</span>
                          )}
                        </div>
                        <div className={`p-4 space-y-3 ${localSettings.kdsCardSize === 'small' ? 'scale-90' : localSettings.kdsCardSize === 'large' ? 'scale-110' : ''}`}>
                          <div className="flex justify-between items-center">
                            {localSettings.kdsShowOrderNumber && (
                              <span className={`text-[7px] font-black ${localSettings.kdsTheme === 'light' ? 'text-slate-400' : 'text-slate-500'} uppercase`}>#8821</span>
                            )}
                            <span className="text-[6px] font-black text-amber-500 uppercase">EM PREPARAÇÃO</span>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex gap-2">
                              <span className="text-[8px] font-black text-white bg-indigo-600 px-1 rounded">1x</span>
                              <p className={`text-[8px] font-black uppercase ${localSettings.kdsTheme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>Hambúrguer Artesanal</p>
                            </div>
                            <div className="flex gap-2">
                              <span className="text-[8px] font-black text-white bg-indigo-600 px-1 rounded">2x</span>
                              <p className={`text-[8px] font-black uppercase ${localSettings.kdsTheme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>Batata Frita G</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Ready */}
                      <div className={`${localSettings.kdsTheme === 'light' ? 'bg-white' : 'bg-slate-900'} rounded-2xl border ${localSettings.kdsTheme === 'light' ? 'border-slate-200' : 'border-white/5'} overflow-hidden flex flex-col scale-95 opacity-80 shadow-sm`}>
                        <div className="p-2 bg-emerald-500 flex justify-between items-center">
                          <div className="flex items-center gap-1.5 text-white">
                            <Clock className="w-2.5 h-2.5" />
                            <span className="text-[7px] font-black uppercase">05 min</span>
                          </div>
                          {localSettings.kdsShowTableOrDirect && (
                            <span className="text-[7px] font-black uppercase bg-black/20 px-1.5 py-0.5 rounded-md text-white">ENTREGA</span>
                          )}
                        </div>
                        <div className={`p-4 space-y-3 ${localSettings.kdsCardSize === 'small' ? 'scale-90' : localSettings.kdsCardSize === 'large' ? 'scale-110' : ''}`}>
                          <div className="flex justify-between items-center">
                            {localSettings.kdsShowOrderNumber && (
                              <span className={`text-[7px] font-black ${localSettings.kdsTheme === 'light' ? 'text-slate-400' : 'text-slate-500'} uppercase`}>#8825</span>
                            )}
                            <span className="text-[6px] font-black text-emerald-500 uppercase">PRONTO</span>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex gap-2">
                              <span className="text-[8px] font-black text-white bg-indigo-600 px-1 rounded">1x</span>
                              <p className={`text-[8px] font-black uppercase ${localSettings.kdsTheme === 'light' ? 'text-slate-700' : 'text-slate-200'}`}>Pizza Calabresa</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="flex flex-col items-center gap-4">
                    <button 
                      onClick={() => window.open('/cozinha/monitor', '_blank')}
                      className="group relative px-10 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-3"
                    >
                      <Tv className="w-5 h-5 group-hover:animate-bounce" />
                      Abrir Monitor de Cozinha
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[7px] px-3 py-1.5 rounded-full animate-pulse shadow-lg whitespace-nowrap">LINK EXCLUSIVO</div>
                    </button>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">O monitor abrirá em uma nova aba otimizada para TVs</p>
                  </div>

                  {/* Instructions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4">
                      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-600">
                        <Monitor className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h6 className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Smart TV</h6>
                        <p className="text-[8px] font-medium text-slate-400 leading-relaxed">Abra o navegador da sua TV e acesse o link gerado pelo botão acima. Use o modo "Tela Cheia" do navegador.</p>
                      </div>
                    </div>

                    <div className="p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4">
                      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-600">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h6 className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Computador + TV</h6>
                        <p className="text-[8px] font-medium text-slate-400 leading-relaxed">Conecte um PC à TV via HDMI. Abra o link no Chrome e pressione F11 para ativar o modo tela cheia.</p>
                      </div>
                    </div>

                    <div className="p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4">
                      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-600">
                        <Tv className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <h6 className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">TV Box / Android</h6>
                        <p className="text-[8px] font-medium text-slate-400 leading-relaxed">Instale um navegador (como Puffin ou Chrome) no seu TV Box e acesse o link. Ideal para TVs não-smart.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isMaster && (
                <>
                  {/* Fluxo Financeiro */}
              <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                <div className="flex items-center gap-4 border-b dark:border-white/5 pb-4">
                  <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>2. Fluxo Financeiro & DRE</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Período Padrão</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Ao abrir o módulo</p>
                      </div>
                      <select 
                        value={localSettings.financialFlowDefaultPeriod || '30d'}
                        onChange={e => handleUpdate({ financialFlowDefaultPeriod: e.target.value as any })}
                        className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-3 py-2 font-black text-[9px] uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="today">Hoje</option>
                        <option value="7d">7 Dias</option>
                        <option value="30d">30 Dias</option>
                        <option value="month">Mês Atual</option>
                        <option value="all">Tudo</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Incluir Fiados Pendentes</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Considerar como receita</p>
                      </div>
                      <button 
                        onClick={() => handleUpdate({ financialFlowIncludePendingFiados: !localSettings.financialFlowIncludePendingFiados })}
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.financialFlowIncludePendingFiados ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localSettings.financialFlowIncludePendingFiados ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Exibir Projeções</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Gráficos de tendência</p>
                      </div>
                      <button 
                        onClick={() => handleUpdate({ financialFlowShowProjections: !localSettings.financialFlowShowProjections })}
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.financialFlowShowProjections ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localSettings.financialFlowShowProjections ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reservas */}
              <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                <div className="flex items-center gap-4 border-b dark:border-white/5 pb-4">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>3. Sistema de Reservas</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Duração Padrão</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Em minutos</p>
                      </div>
                      <input 
                        type="number" 
                        value={localSettings.reservationsDefaultDuration || 120} 
                        onChange={e => handleUpdate({ reservationsDefaultDuration: parseInt(e.target.value) })}
                        className="w-20 px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-black text-[10px] text-center outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Tempo de Margem</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Entre reservas (min)</p>
                      </div>
                      <input 
                        type="number" 
                        value={localSettings.reservationsBufferTime || 15} 
                        onChange={e => handleUpdate({ reservationsBufferTime: parseInt(e.target.value) })}
                        className="w-20 px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-black text-[10px] text-center outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Confirmação Automática</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Aprovar sem revisão</p>
                      </div>
                      <button 
                        onClick={() => handleUpdate({ reservationsAutoConfirm: !localSettings.reservationsAutoConfirm })}
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.reservationsAutoConfirm ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localSettings.reservationsAutoConfirm ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Notas no Card</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Exibir observações</p>
                      </div>
                      <button 
                        onClick={() => handleUpdate({ reservationsShowNotesOnCard: !localSettings.reservationsShowNotesOnCard })}
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.reservationsShowNotesOnCard ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localSettings.reservationsShowNotesOnCard ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fornecedores */}
              <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                <div className="flex items-center gap-4 border-b dark:border-white/5 pb-4">
                  <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-xl flex items-center justify-center text-rose-600">
                    <Truck className="w-6 h-6" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>4. Gestão de Fornecedores</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Atualização de Estoque</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Automático ao receber</p>
                      </div>
                      <button 
                        onClick={() => handleUpdate({ suppliersAutoUpdateStock: !localSettings.suppliersAutoUpdateStock })}
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.suppliersAutoUpdateStock ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localSettings.suppliersAutoUpdateStock ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-white">Notificar Estoque Baixo</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Alertas de reposição</p>
                      </div>
                      <button 
                        onClick={() => handleUpdate({ suppliersNotifyLowStock: !localSettings.suppliersNotifyLowStock })}
                        className={`w-12 h-6 rounded-full transition-all relative ${localSettings.suppliersNotifyLowStock ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${localSettings.suppliersNotifyLowStock ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              </>)}
            </section>
          </div>
        )}

        {activeTab === 'personal' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-4">
            <section className="space-y-6">
              <div className="flex items-center gap-4 border-b dark:border-white/5 pb-4">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100 dark:border-indigo-900/40">
                  <UserIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase italic tracking-tighter leading-none" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Informações Pessoais</h3>
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">Dados da sua conta e acesso</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Nome Completo</label>
                    <div className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-sm text-slate-700 dark:text-slate-300">
                      {user?.name || 'NÃO INFORMADO'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">E-mail de Acesso</label>
                    <div className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-sm text-slate-700 dark:text-slate-300">
                      {user?.email || 'NÃO INFORMADO'}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Cargo / Permissão</label>
                    <div className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-sm text-slate-700 dark:text-slate-300">
                      {user?.role === 'admin' ? 'ADMINISTRADOR' : 'OPERADOR'}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Tenant ID (Workspace)</label>
                    <div className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-sm text-slate-700 dark:text-slate-300">
                      {user?.tenantId || 'NÃO INFORMADO'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm mt-8">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 bg-rose-100 dark:bg-rose-900/30 rounded-xl flex items-center justify-center text-rose-600">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest italic text-rose-600">Segurança da Conta</h4>
                </div>
                <p className="text-[9px] font-bold text-slate-500 uppercase italic leading-relaxed mb-6">
                  Para alterar sua senha ou dados de perfil, entre em contato com o administrador do sistema ou utilize a função de recuperação de senha na tela de login.
                </p>
                <button 
                  disabled
                  className="px-8 py-4 bg-slate-200 dark:bg-slate-700 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed"
                >
                  Alterar Senha (Em breve)
                </button>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'hosting' && isMaster && (
          <div className="space-y-10 animate-in fade-in">
             <section className="space-y-6">
                <div className="flex items-center justify-between border-b dark:border-white/5 pb-4">
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Configuração de IA (Gemini)</h3>
                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Configure sua chave de API para as funções inteligentes</p>
                  </div>
                  <div className="px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest" style={{ backgroundColor: `${localSettings.primaryColor || '#4f46e5'}1A`, color: localSettings.primaryColor || '#4f46e5' }}>IA Ativa</div>
                </div>

                <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                  {!isMaster && (
                    <div className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl border border-indigo-100 dark:border-indigo-900/30 space-y-4">
                      <div className="flex gap-4">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2}/></svg>
                        </div>
                        <div>
                          <h5 className="text-[10px] font-black uppercase tracking-widest" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Como obter sua chave de API?</h5>
                          <p className="text-[9px] font-medium mt-1 leading-relaxed" style={{ color: localSettings.primaryColor || '#4f46e5' }}>
                            Para usar as funções de IA (geração de ícones e descrições), você precisa de uma chave gratuita do Google Gemini.
                          </p>
                        </div>
                      </div>
                      <div className="pl-14 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black">1</div>
                          <p className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                            Acesse o <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-black italic">Google AI Studio aqui</a> para gerar sua chave.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black">2</div>
                          <p className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase">Clique em "Create API key" e copie o código gerado.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black">3</div>
                          <p className="text-[9px] font-bold text-slate-600 dark:text-slate-300 uppercase">Cole a chave no campo abaixo e clique em Salvar.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">Chave de API Gemini (Manual)</label>
                    <div className="flex gap-3">
                      <input 
                        type="password" 
                        value={localSettings.geminiApiKey || ''} 
                        onChange={e => handleUpdate({ geminiApiKey: e.target.value })} 
                        className="flex-1 bg-white dark:bg-slate-900 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner" 
                        placeholder="Insira sua chave de API aqui..."
                      />
                    </div>
                    <p className="text-[8px] font-bold text-slate-400 uppercase ml-2 italic">
                      {isMaster 
                        ? "Como Master, esta chave servirá como fallback global para todos os seus clientes que não possuírem uma chave própria."
                        : "Esta chave é exclusiva para sua conta e garante que você tenha sua própria cota de uso da IA."}
                    </p>
                  </div>
                </div>
             </section>

             {isMaster && (
               <section className="space-y-6">
                <div className="flex items-center justify-between border-b dark:border-white/5 pb-4">
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic" style={{ color: localSettings.primaryColor || '#4f46e5' }}>Configuração de Hospedagem</h3>
                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Siga os passos para hospedar seu sistema</p>
                  </div>
                  <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[8px] font-black uppercase tracking-widest">Compatível</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                      <span className="text-xl font-black">1</span>
                    </div>
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Criar Banco de Dados</h4>
                    <p className="text-[10px] font-medium text-slate-500 leading-relaxed">
                      Acesse o painel de controle da sua hospedagem, vá em <b>Bancos de Dados MySQL</b> e crie um novo banco. Anote o nome, usuário e senha.
                    </p>
                  </div>

                  <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                      <span className="text-xl font-black">2</span>
                    </div>
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Baixar API Bridge</h4>
                    <p className="text-[10px] font-medium text-slate-500 leading-relaxed">
                      Baixe o arquivo <b>api.php</b> e edite as linhas 28-31 com os dados do banco que você criou no seu servidor.
                    </p>
                    <button 
                      onClick={() => window.open('./api.php', '_blank')}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Download api.php
                    </button>
                  </div>

                  <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                      <span className="text-xl font-black">3</span>
                    </div>
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Build e Upload</h4>
                    <p className="text-[10px] font-medium text-slate-500 leading-relaxed">
                      Execute <code>npm run build</code>. Envie o conteúdo da pasta <b>dist</b> e o arquivo <b>api.php</b> para a pasta raiz (geralmente <code>public_html</code> ou <code>www</code>) do seu servidor.
                    </p>
                  </div>

                  <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900 dark:text-white">Pronto!</h4>
                    <p className="text-[10px] font-medium text-slate-500 leading-relaxed">
                      O sistema detectará automaticamente o servidor e começará a salvar os dados no seu banco MySQL.
                    </p>
                  </div>
                </div>

                <div className="p-8 bg-slate-50 dark:bg-slate-800/40 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <div>
                      <h5 className="text-[10px] font-black uppercase tracking-widest text-amber-900 dark:text-amber-200">Nota sobre Armazenamento</h5>
                      <p className="text-[9px] font-medium text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                        Seu plano de 10GB é <b>extremamente generoso</b> para este sistema. O código e o banco de dados ocupam menos de 100MB inicialmente. Você terá espaço de sobra para anos de uso e milhares de registros.
                      </p>
                    </div>
                  </div>
                </div>
             </section>
             )}
          </div>
        )}

        <div className="pt-10 border-t border-slate-50 dark:border-slate-800 mt-10">
          <button 
            onClick={saveToStorage} 
            style={{ backgroundColor: localSettings.primaryColor }} 
            className={`w-full py-6 rounded-2xl font-black text-[11px] uppercase tracking-[0.4em] shadow-2xl active:scale-95 transition-all`}
          >
            Salvar Preferências
          </button>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão de Categoria */}
      {confirmDeleteCat && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[2rem] p-8 shadow-2xl border border-white/10 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl text-rose-500 border border-rose-100 dark:border-rose-900/50">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2 text-[var(--workspace-text)]">Excluir Categoria?</h3>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase mb-8 leading-relaxed px-4">Esta ação irá remover a categoria. Os itens dentro dela não serão apagados, apenas perderão o vínculo.</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setConfirmDeleteCat(null)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={() => removeCategory(confirmDeleteCat)} className="py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação Genérico para Gestor de Menu */}
      {showMenuConfirm.show && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[2rem] p-8 shadow-2xl border border-white/10 text-center animate-in zoom-in-95">
            <div className={`w-16 h-16 ${showMenuConfirm.color} rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl text-white`}>
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2 text-[var(--workspace-text)] leading-tight">{showMenuConfirm.title}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase mb-8 leading-relaxed px-4">Tem certeza que deseja continuar?</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setShowMenuConfirm(prev => ({ ...prev, show: false }))} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={showMenuConfirm.action} className={`py-4 ${showMenuConfirm.color} text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all active:scale-95`}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;