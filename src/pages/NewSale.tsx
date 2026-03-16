import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Product, Sale, SaleItem, Delivery, Category, Table, KDSOrder } from '../types';
import { 
  saveSale, getCategories, getAppSettings, 
  getCurrentUser, getNextDeliveryNumber, saveDelivery,
  getTables, saveTables, notifyDataChanged,
  DEFAULT_SETTINGS, saveKDSOrder
} from '../services/storage';
import { playSaleConfirmationSound, preloadSaleSound } from '../services/sound';
import { getCategoryIcon } from '../utils/categoryIcons';

interface NewSaleProps {
  products: Product[];
  onSaleComplete: () => void;
  onBack: () => void;
  onNavigate?: (view: any) => void;
}

const NewSale: React.FC<NewSaleProps> = ({ products, onSaleComplete, onBack, onNavigate }) => {
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [printMode, setPrintMode] = useState<'customer' | 'kitchen'>('customer');
  
  // Checkout e Pagamento
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<Sale['paymentMethod'] | null>(null);
  const [amountReceived, setAmountReceived] = useState<string>(''); // Vazio por padrão
  const [showCashFlow, setShowCashFlow] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showSafetyLock, setShowSafetyLock] = useState(false);
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [showDeliveryLock, setShowDeliveryLock] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Lançamento Avulso
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualObs, setManualObs] = useState('');
  const [mobileView, setMobileView] = useState<'catalog' | 'cart' | 'manual'>('catalog');

  // Entrega
  const [isDeliveryMode, setIsDeliveryMode] = useState(false);
  const [needsChange, setNeedsChange] = useState<boolean | null>(null);
  const [deliveryInfo, setDeliveryInfo] = useState({
    customerName: '', phone: '', address: '', reference: '', changeFor: '', isPaid: false
  });

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [isTableTransferOpen, setIsTableTransferOpen] = useState(false);
  const [selectedTransferTableId, setSelectedTransferTableId] = useState<number | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  
  // REFERÊNCIAS PARA FOCO
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Autofocus ao entrar (Atalho F2 ou clique)
    if (searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 150);
    }
    getAppSettings().then(setSettings);
    getCategories().then(cats => {
      setCategories(cats.filter(c => c.active !== false));
    });
    getTables().then(setTables);
    preloadSaleSound();
  }, []);

  // Focar no campo de dinheiro quando abrir o fluxo de caixa
  useEffect(() => {
    if (showCashFlow && cashInputRef.current) {
        setTimeout(() => cashInputRef.current?.focus(), 100);
    }
  }, [showCashFlow]);

  const total = cart.reduce((acc, i) => acc + i.subtotal, 0);
  const changeValue = Number(amountReceived) > total ? Number(amountReceived) - total : 0;

  const filteredProducts = useMemo(() => {
    if (search.trim()) {
      return products.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) || 
        (p.barcode && p.barcode.includes(search))
      );
    }
    if (selectedCategoryId === 'all') return [];
    return products.filter(p => p.categoryId === selectedCategoryId);
  }, [products, search, selectedCategoryId]);

  const formatPhone = (val: string) => {
    const v = val.replace(/\D/g, '').slice(0, 11);
    if (v.length <= 10) return v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
    return v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  };

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('p4zz_session_user') || '{}'), []);
  const isDemoViewer = currentUser.isDemoViewer;

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert("Estoque insuficiente para este item.");
      return;
    }
    const existing = cart.find(item => item.productId === product.id && !item.observation);
    if (existing) {
      if (existing.quantity >= product.stock) {
        alert("Estoque insuficiente para este item.");
        return;
      }
      setCart(cart.map(item => item === existing ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price } : item));
    } else {
      setCart([...cart, { productId: product.id, productName: product.name, quantity: 1, price: product.price, cost: product.cost || 0, subtotal: product.price }]);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const barcodeValue = search.trim();
      if (!barcodeValue) return;
      
      const matchedProduct = products.find(p => p.barcode === barcodeValue);
      if (matchedProduct) {
        e.preventDefault();
        addToCart(matchedProduct);
        setSearch(''); // Limpa o campo para a próxima leitura
      }
    }
  };

  const addManualItem = () => {
    if (!manualName.trim() || !manualPrice) return;
    const price = Number(manualPrice);
    if (isNaN(price)) return;
    
    const newItem: SaleItem = {
      productId: `manual-${Date.now()}`,
      productName: manualName.toUpperCase(),
      quantity: 1,
      price: price,
      cost: 0,
      subtotal: price,
      observation: manualObs.toUpperCase()
    };
    setCart([...cart, newItem]);
    setManualName(''); setManualPrice(''); setManualObs('');
  };

  const updateQty = (idx: number, delta: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i === idx) {
        const product = products.find(p => p.id === item.productId);
        if (delta > 0 && product && item.quantity >= product.stock) {
           alert("Estoque insuficiente para este item.");
           return item;
        }
        const newQty = Math.max(0, item.quantity + delta);
        return newQty === 0 ? null : { ...item, quantity: newQty, subtotal: newQty * item.price };
      }
      return item;
    }).filter((i): i is SaleItem => i !== null));
  };

  const executeReset = () => {
    setCart([]);
    setIsDeliveryMode(false);
    setDeliveryInfo({ customerName: '', phone: '', address: '', reference: '', changeFor: '', isPaid: false });
    setNeedsChange(null);
    resetModals();
    setShowResetConfirm(false);
  };

  const handlePrintAction = async (mode: 'customer' | 'kitchen') => {
    setPrintMode(mode);

    // Enviar para o KDS se for comanda de cozinha e a configuração estiver ativa
    if (mode === 'kitchen' && settings.kdsSendOnPrint && cart.length > 0) {
      const kdsOrder: KDSOrder = {
        id: Math.random().toString(36).substr(2, 9),
        orderNumber: Math.floor(1000 + Math.random() * 9000).toString(),
        type: 'direct',
        identifier: 'VENDA DIRETA',
        items: [...cart],
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      await saveKDSOrder(kdsOrder);
      notifyDataChanged();
    }

    const delay = settings.printSettings?.printDelay || 100;
    setTimeout(() => {
      window.print();
      setShowPrintConfirm(false);
    }, delay);
  };

  const handleFinalFinish = async () => {
    if (cart.length === 0 || !selectedMethod || isFinalizing) return;
    setIsFinalizing(true);
    
    try {
      const user = getCurrentUser();
      const sale: Sale = {
        id: Math.random().toString(36).substr(2, 9),
        date: new Date().toISOString(),
        items: [...cart],
        total,
        paymentMethod: selectedMethod,
        status: 'Concluída',
        userId: user?.id || 'unknown',
        userName: user?.name || 'Sistema'
      };

      setPrintMode('customer');
      const saved = await saveSale(sale);
      
      if (saved) {
        playSaleConfirmationSound();
        if (settings.printSettings?.autoPrint) {
          const delay = settings.printSettings?.printDelay || 100;
          setTimeout(() => {
            window.print();
          }, delay);
        }
        setCart([]);
        resetModals();
        onSaleComplete();
      }
    } catch (e) {
      console.error(e);
      alert("Falha crítica no salvamento.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleLaunchDelivery = async () => {
    if (cart.length === 0 || isFinalizing) return;
    if (!deliveryInfo.customerName || !deliveryInfo.address || !deliveryInfo.phone) {
      alert("Preencha Nome, WhatsApp e Endereço para entrega.");
      return;
    }
    if (needsChange === null) {
      alert("Por favor, selecione se o entregador deve levar troco.");
      return;
    }
    if (needsChange && !deliveryInfo.changeFor) {
      alert("Informe para quanto é o troco.");
      return;
    }
    
    setIsFinalizing(true);
    try {
      const user = getCurrentUser();
      const nextNum = await getNextDeliveryNumber();

      const newDelivery: Delivery = {
        id: Math.random().toString(36).substr(2, 9),
        displayId: nextNum,
        customerName: deliveryInfo.customerName,
        phone: deliveryInfo.phone,
        address: deliveryInfo.address,
        reference: deliveryInfo.reference,
        items: [...cart],
        total,
        createdAt: new Date().toISOString(),
        status: 'pending',
        deliveryStage: 'active',
        changeFor: deliveryInfo.changeFor ? Number(deliveryInfo.changeFor) : undefined,
        isPaid: deliveryInfo.isPaid,
        userId: user?.id,
        userName: user?.name
      };

      await saveDelivery(newDelivery);
      setCart([]);
      setIsDeliveryMode(false);
      setDeliveryInfo({ customerName: '', phone: '', address: '', reference: '', changeFor: '', isPaid: false });
      setNeedsChange(null);
      resetModals();
      onSaleComplete();
    } catch (e) {
      console.error(e);
      alert("Erro ao registrar logística de entrega.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleTransferToTable = async () => {
    if (cart.length === 0 || selectedTransferTableId === null || isTransferring) return;
    setIsTransferring(true);
    
    try {
      const currentTables = await getTables();
      const targetTable = currentTables.find(t => t.id === selectedTransferTableId);
      
      if (!targetTable) return;

      const updatedTablesList = currentTables.map(t => {
        if (t.id === selectedTransferTableId) {
          // Se a mesa já tiver itens, faz o merge. Se não, apenas define os itens.
          const mergedItems = [...t.items];
          cart.forEach(cartItem => {
            const existing = mergedItems.find(mi => mi.productId === cartItem.productId && mi.observation === cartItem.observation);
            if (existing) {
              existing.quantity += cartItem.quantity;
              existing.subtotal = existing.quantity * existing.price;
            } else {
              mergedItems.push({ ...cartItem });
            }
          });

          return {
            ...t,
            status: 'Ocupada',
            items: mergedItems,
            startTime: t.startTime || new Date().toISOString()
          } as Table;
        }
        return t;
      });

      await saveTables(updatedTablesList);
      notifyDataChanged();
      
      // Limpa o carrinho e fecha o modal
      setCart([]);
      setIsTableTransferOpen(false);
      setSelectedTransferTableId(null);
      alert("Pedido transferido para a mesa com sucesso!");
      if (onNavigate) onNavigate('tables');
      else onBack();
    } catch (e) {
      console.error(e);
      alert("Erro ao transferir para a mesa.");
    } finally {
      setIsTransferring(false);
    }
  };

  const resetModals = () => {
    setIsCheckoutOpen(false);
    setSelectedMethod(null);
    setAmountReceived('');
    setShowCashFlow(false);
    setShowSafetyLock(false);
    setShowPrintConfirm(false);
    setShowDeliveryLock(false);
    setShowResetConfirm(false);
  };

  const isDeliveryFormValid = deliveryInfo.customerName && deliveryInfo.phone && deliveryInfo.address && (needsChange !== null) && (!needsChange || (needsChange && deliveryInfo.changeFor));

  return (
    <div className="flex flex-col h-full">
      {/* HEADER COM BOTÃO VOLTAR PARA MOBILE */}
      <div className="xl:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b dark:border-slate-800 no-print">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px] tracking-widest">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
          Sair
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase text-indigo-500 italic">Venda Direta</span>
        </div>
      </div>

      {/* NAVEGAÇÃO MOBILE */}
      <div className="xl:hidden flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 no-print">
          <button onClick={() => setMobileView('catalog')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all ${mobileView === 'catalog' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-slate-400'}`}>Catálogo</button>
          <button onClick={() => setMobileView('manual')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all ${mobileView === 'manual' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-slate-400'}`}>Avulso</button>
          <button onClick={() => setMobileView('cart')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all ${mobileView === 'cart' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-slate-400'}`}>Carrinho ({cart.length})</button>
      </div>

      <div className={`flex flex-col xl:flex-row gap-4 xl:gap-6 animate-in fade-in duration-500 h-full xl:h-[calc(100vh-140px)] overflow-y-auto xl:overflow-hidden ${printMode === 'kitchen' ? 'print-mode-kitchen' : 'print-mode-customer'}`}>
        
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            margin-top: ${printMode === 'customer' ? (settings.printSettings?.customerReceipt?.margins?.top ?? 0) : (settings.printSettings?.kitchenOrder?.margins?.top ?? 0)}px;
            margin-bottom: ${printMode === 'customer' ? (settings.printSettings?.customerReceipt?.margins?.bottom ?? 0) : (settings.printSettings?.kitchenOrder?.margins?.bottom ?? 0)}px;
            margin-left: ${printMode === 'customer' ? (settings.printSettings?.customerReceipt?.margins?.left ?? 0) : (settings.printSettings?.kitchenOrder?.margins?.left ?? 0)}px;
            margin-right: ${printMode === 'customer' ? (settings.printSettings?.customerReceipt?.margins?.right ?? 0) : (settings.printSettings?.kitchenOrder?.margins?.right ?? 0)}px;
            size: ${printMode === 'customer' ? (settings.printSettings?.customerReceipt?.paperSize || '80mm') : (settings.printSettings?.kitchenOrder?.paperSize || '80mm')};
          }
          .thermal-receipt {
            width: ${printMode === 'customer' ? (settings.printSettings?.customerReceipt?.paperSize || '80mm') : (settings.printSettings?.kitchenOrder?.paperSize || '80mm')};
          }
          ${printMode === 'kitchen' ? '.item-price-col, .financial-footer { display: none !important; }' : ''}
        }
      `}} />

      {/* IMPRESSÃO (OCULTA) */}
      <div className="print-only thermal-receipt mx-auto text-black font-mono">
        {printMode === 'customer' ? (
          <div className="customer-header text-center mb-2 border-b border-dashed border-black pb-2">
            <h2 className="text-sm font-bold uppercase">{settings.printSettings?.customerReceipt?.header || settings.systemName}</h2>
            {settings.printSettings?.customerReceipt?.message && <p className="text-[8px] font-bold uppercase italic">{settings.printSettings.customerReceipt.message}</p>}
            <p className="text-[10px] font-black uppercase italic">Venda Direta</p>
            <p className="text-[8px]">{new Date().toLocaleString('pt-BR')}</p>
          </div>
        ) : (
          <div className="kitchen-only text-center mb-2 border-b border-dashed border-black pb-2">
            <h2 className="text-sm font-black uppercase">{settings.printSettings?.kitchenOrder?.header || 'COMANDA COZINHA'}</h2>
            {settings.printSettings?.kitchenOrder?.message && <p className="text-[8px] font-bold uppercase italic">{settings.printSettings.kitchenOrder.message}</p>}
            <p className="text-[8px]">{new Date().toLocaleString('pt-BR')}</p>
          </div>
        )}
        
        <table className="w-full text-[9px] mb-2">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-1">ITEM</th>
              <th className="text-center py-1">QTD</th>
              {printMode === 'customer' && settings.printSettings?.customerReceipt?.showItemsPrice && (
                <th className="text-right py-1 item-price-col">VALOR</th>
              )}
            </tr>
          </thead>
          <tbody>
            {cart.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1 uppercase">
                  <div className="item-name leading-tight">{item.productName}</div>
                  {item.observation && <div className="text-[7px] italic font-bold">OBS: {item.observation}</div>}
                </td>
                <td className="text-center font-bold align-top py-1">{item.quantity}</td>
                {printMode === 'customer' && settings.printSettings?.customerReceipt?.showItemsPrice && (
                  <td className="text-right item-price-col align-top py-1">R${item.subtotal.toFixed(2)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {printMode === 'customer' && settings.printSettings?.customerReceipt?.showTotal && (
          <div className="financial-footer pt-2 border-t border-black">
            <div className="flex justify-between font-bold text-xs">
              <span>TOTAL:</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
            {selectedMethod && (
              <div className="flex justify-between text-[8px] mt-1 uppercase">
                <span>PAGAMENTO:</span>
                <span>{selectedMethod}</span>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 text-center text-[7px] opacity-50 border-t border-dashed border-black pt-2">
          <p>{printMode === 'customer' ? (settings.printSettings?.customerReceipt?.footer || 'OBRIGADO PELA PREFERÊNCIA') : (settings.printSettings?.kitchenOrder?.footer || '')}</p>
        </div>
      </div>

        {/* COLUNA ESQUERDA: CATÁLOGO E MANUAL (OCULTA NO CARRINHO MOBILE) */}
        <div className={`flex-[2] flex flex-col min-h-0 bg-white dark:bg-slate-900 xl:rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden no-print ${mobileView !== 'catalog' && mobileView !== 'manual' ? 'hidden xl:flex' : 'flex'}`}>
          <div className="p-4 md:p-6 border-b dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col md:flex-row gap-4 shrink-0">
            <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center justify-center shrink-0 overflow-hidden" style={{ width: '21px', height: '21px' }}>
                    {settings.logoUrl ? (
                        <img src={settings.logoUrl} className="w-full h-full object-contain" alt="Logo" />
                    ) : (
                        <div className="w-full h-full rounded bg-slate-900 text-white flex items-center justify-center font-black italic text-[9px] shadow-sm" style={{ backgroundColor: settings.primaryColor }}>P</div>
                    )}
                </div>
                <h3 className="font-black uppercase italic tracking-tighter text-slate-900 dark:text-white" style={{ fontSize: '10px' }}>Catálogo</h3>
            </div>
            <div className="relative flex-1">
              <input 
                ref={searchInputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="BUSCAR PRODUTO (EX: COCA)..."
                className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl font-black text-[10px] md:text-xs uppercase outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
              />
              <svg className="w-4 h-4 md:w-5 md:h-5 absolute left-4 top-3 md:top-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={3}/></svg>
            </div>
        </div>

        {/* Barra de Categorias Horizontal */}
        <div className="px-4 xl:px-6 py-3 bg-white dark:bg-slate-900 border-b dark:border-slate-800 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
          <button 
            onClick={() => { setSelectedCategoryId('all'); setSearch(''); }}
            className={`px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest whitespace-nowrap transition-all border-2 ${selectedCategoryId === 'all' && search === '' ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg scale-105' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'}`}
          >
            Início / Categorias
          </button>
          {categories.map(c => (
            <button 
              key={c.id}
              onClick={() => { setSelectedCategoryId(c.id); setSearch(''); }}
              className={`px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest whitespace-nowrap transition-all border-2 flex items-center gap-2 ${selectedCategoryId === c.id && search === '' ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg scale-105' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'}`}
            >
              <span className="w-3 h-3 flex items-center justify-center">{getCategoryIcon(c.name, c.icon)}</span>
              {c.name}
            </button>
          ))}
        </div>

        <div className={`flex-1 overflow-y-auto p-4 xl:p-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 content-start custom-scrollbar bg-slate-50 dark:bg-slate-950/50 ${mobileView === 'manual' ? 'hidden xl:grid' : 'grid'}`}>
          {search.trim() === '' && selectedCategoryId === 'all' ? (
            categories.map(c => (
              <div 
                key={c.id} 
                onClick={() => setSelectedCategoryId(c.id)}
                className="p-6 bg-white dark:bg-slate-900 border-2 border-transparent rounded-[2rem] shadow-sm cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all flex flex-col items-center justify-center text-center group animate-in zoom-in-95"
              >
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform text-indigo-500 p-3">
                  {getCategoryIcon(c.name, c.icon)}
                </div>
                <h4 className="font-black text-[11px] uppercase text-slate-800 dark:text-white tracking-widest">{c.name}</h4>
                <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase">{products.filter(p => p.categoryId === c.id).length} Itens</span>
              </div>
            ))
          ) : (
            <>
              {/* Botão Voltar para Categorias (se não estiver buscando) */}
              {search.trim() === '' && (
                <div 
                  onClick={() => setSelectedCategoryId('all')}
                  className="p-4 bg-slate-100 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[1.5rem] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex flex-col items-center justify-center text-center group"
                >
                  <svg className="w-5 h-5 text-slate-400 mb-1 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                  <span className="text-[9px] font-black uppercase text-slate-400 group-hover:text-indigo-500 transition-colors">Voltar</span>
                </div>
              )}
              {filteredProducts.map(p => (
                <div 
                  key={p.id} 
                  onClick={() => addToCart(p)}
                  className="p-4 bg-white dark:bg-slate-900 border rounded-[1.5rem] shadow-sm cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all flex flex-col justify-between min-h-[130px] animate-in zoom-in-95"
                >
                  <h4 className="font-black text-[12px] uppercase text-slate-800 dark:text-white leading-tight mb-2 line-clamp-2 min-h-[2.5rem]">{p.name}</h4>
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[14px] font-black italic text-indigo-600 dark:text-indigo-400">R$ {p.price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-start">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider ${p.stock < 5 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                        Estoque: {p.stock}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {filteredProducts.length === 0 && search.trim() !== '' && (
                <div className="col-span-full py-20 text-center opacity-50 flex flex-col items-center">
                  <svg className="w-12 h-12 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={2}/></svg>
                  <p className="font-black uppercase text-xs tracking-widest">Nenhum produto encontrado</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className={`p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 space-y-4 ${mobileView === 'catalog' ? 'hidden xl:block' : 'block'}`}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-4">
              <div className="space-y-3">
                  <div className="flex items-center gap-2 ml-1">
                     <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 italic">Item Avulso</h4>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl space-y-3 border border-slate-100 dark:border-slate-800">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input 
                            placeholder="NOME DO ITEM" 
                            value={manualName} 
                            onChange={e => setManualName(e.target.value.toUpperCase())}
                            className="sm:col-span-2 px-4 py-3 bg-white dark:bg-slate-900 border-none rounded-xl text-[11px] font-black uppercase outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm" 
                          />
                          <input placeholder="PREÇO" type="number" value={manualPrice} onChange={e => setManualPrice(e.target.value)} className="px-4 py-3 bg-white dark:bg-slate-900 border-none rounded-xl text-[12px] font-black outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm text-emerald-600" />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                          <input 
                            placeholder="OBSERVAÇÃO..." 
                            value={manualObs} 
                            onChange={e => setManualObs(e.target.value.toUpperCase())}
                            className="flex-1 px-4 py-3 bg-white dark:bg-slate-900 border-none rounded-xl text-[11px] font-bold uppercase outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm" 
                          />
                          <button onClick={addManualItem} className="bg-slate-900 dark:bg-white dark:text-slate-950 text-white px-6 py-4 rounded-xl font-black text-[11px] uppercase shadow active:scale-95 transition-all">Lançar</button>
                      </div>
                  </div>
              </div>
              <div className="space-y-3">
                  <div className="flex items-center justify-between ml-1">
                      <div 
                        onClick={() => setIsDeliveryMode(!isDeliveryMode)}
                        className="flex items-center gap-2 cursor-pointer group"
                      >
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isDeliveryMode ? 'bg-emerald-50 border-emerald-500' : 'bg-white dark:bg-slate-800 border-slate-200'}`}>
                          {isDeliveryMode && <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={4}/></svg>}
                        </div>
                        <h4 className={`text-[10px] font-black uppercase tracking-widest italic transition-colors ${isDeliveryMode ? 'text-emerald-500' : 'text-slate-400 group-hover:text-emerald-500'}`}>Logística Entrega</h4>
                      </div>
                  </div>
                  {isDeliveryMode && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl space-y-3 border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input value={deliveryInfo.customerName || ''} onChange={e => setDeliveryInfo({...deliveryInfo, customerName: e.target.value.toUpperCase()})} placeholder="NOME" className="w-full px-4 py-3.5 bg-white dark:bg-slate-900 border-none rounded-xl text-[11px] font-bold uppercase outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm" />
                            <input value={deliveryInfo.phone || ''} onChange={e => setDeliveryInfo({...deliveryInfo, phone: formatPhone(e.target.value)})} placeholder="WHATSAPP" className="w-full px-4 py-3.5 bg-white dark:bg-slate-900 border-none rounded-xl text-[11px] font-bold uppercase outline-none focus:ring-1 focus:ring-emerald-500 shadow-sm" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input value={deliveryInfo.address || ''} onChange={e => setDeliveryInfo({...deliveryInfo, address: e.target.value.toUpperCase()})} placeholder="ENDEREÇO" className="sm:col-span-2 px-4 py-3.5 bg-white dark:bg-slate-900 border-none rounded-xl text-[11px] font-bold uppercase outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm" />
                            <input value={deliveryInfo.reference || ''} onChange={e => setDeliveryInfo({...deliveryInfo, reference: e.target.value.toUpperCase()})} placeholder="REF..." className="px-4 py-3.5 bg-white dark:bg-slate-900 border-none rounded-xl text-[11px] font-bold uppercase outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm" />
                        </div>
                        
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700/50 mt-1">
                            <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black uppercase text-slate-400">Troco?</span>
                                <div className="flex bg-white dark:bg-slate-900 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
                                    <button 
                                        onClick={() => { setNeedsChange(false); setDeliveryInfo({...deliveryInfo, changeFor: ''}); }}
                                        className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${needsChange === false ? 'bg-slate-800 text-white dark:bg-slate-600' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        Não
                                    </button>
                                    <button 
                                        onClick={() => setNeedsChange(true)}
                                        className={`px-4 py-1.5 rounded-md text-[9px] font-black uppercase transition-all ${needsChange === true ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        Sim
                                    </button>
                                </div>
                            </div>
                        </div>

                        {needsChange && (
                            <input 
                                type="number" 
                                value={deliveryInfo.changeFor} 
                                onChange={e => setDeliveryInfo({...deliveryInfo, changeFor: e.target.value})} 
                                placeholder="TROCO PARA QUANTO?" 
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 border-none rounded-xl text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm text-indigo-500 animate-in slide-in-from-top-1" 
                            />
                        )}

                        {/* BOTÃO DE LANÇAMENTO MOBILE/DIRETO */}
                        <div className="xl:hidden pt-2">
                            <button 
                                disabled={cart.length === 0 || !isDeliveryFormValid || isFinalizing}
                                onClick={() => setShowDeliveryLock(true)}
                                className="w-full py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all text-white bg-emerald-600 disabled:opacity-30"
                            >
                                {isFinalizing ? 'Gravando...' : 'Confirmar Entrega'}
                            </button>
                        </div>
                    </div>
                  )}
              </div>
            </div>
        </div>
      </div>

      <div className={`w-full xl:w-[420px] flex flex-col bg-white dark:bg-slate-900 h-full xl:rounded-[3rem] shadow-5xl border border-slate-200 dark:border-slate-800 overflow-hidden no-print ${mobileView !== 'cart' ? 'hidden xl:flex' : 'flex'}`}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0 bg-slate-50 dark:bg-slate-950/20">
            <div className="flex gap-2">
                <button 
                  onClick={() => setIsTableTransferOpen(true)}
                  disabled={cart.length === 0}
                  className="px-4 py-3 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl font-black text-[9px] uppercase tracking-widest border border-indigo-100 shadow-sm transition-all hover:scale-105 active:scale-95"
                >
                  Enviar para Mesa
                </button>
                <button 
                  onClick={() => { setPrintMode('kitchen'); setShowPrintConfirm(true); }} 
                  disabled={cart.length === 0} 
                  className="px-4 py-3 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl font-black text-[9px] uppercase tracking-widest border border-indigo-100 shadow-sm transition-all hover:scale-105 active:scale-95"
                >
                  Comanda
                </button>
                <button 
                  onClick={() => { setPrintMode('customer'); setShowPrintConfirm(true); }} 
                  disabled={cart.length === 0} 
                  className={`px-4 py-3 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl font-black text-[9px] uppercase tracking-widest border border-emerald-100 shadow-sm transition-all hover:scale-105 active:scale-95`}
                >
                  Recibo
                </button>
            </div>
            <button 
              onClick={() => setShowResetConfirm(true)} 
              className={`p-3 text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-2xl transition-all`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2-0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg>
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3 bg-white dark:bg-slate-900">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10 grayscale py-12">
               <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" strokeWidth={1.5}/></svg>
               <p className="font-black uppercase text-[10px] tracking-[0.2em] text-center">Carrinho Vazio</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-[1.8rem] border border-slate-100 dark:border-slate-800/50 flex flex-col shadow-sm animate-in slide-in-from-right-4 duration-300">
                 <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black uppercase leading-tight flex-1 pr-4 text-slate-800 dark:text-white">{item.productName}</span>
                    <span className="font-black text-[11px] italic shrink-0 text-slate-900 dark:text-indigo-400">R$ {item.subtotal.toFixed(2)}</span>
                 </div>
                 <div className="flex items-center justify-between mt-3.5 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl p-1 border shadow-inner">
                        <button onClick={() => updateQty(idx, -1)} className="w-8 h-8 flex items-center justify-center font-black text-slate-400">-</button>
                        <span className="px-4 text-[11px] font-black dark:text-white">{item.quantity}</span>
                        <button onClick={() => updateQty(idx, 1)} className="w-8 h-8 flex items-center justify-center font-black text-slate-400">+</button>
                    </div>
                    <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-rose-500 transition-colors p-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg></button>
                 </div>
              </div>
            ))
          )}
        </div>

        <div className="p-8 bg-slate-950 space-y-5 shrink-0 border-t border-white/5">
           <div className="flex justify-between items-end">
              <span className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest">Total</span>
              <span className="text-4xl font-black italic text-white tracking-tighter leading-none">R$ {total.toFixed(2)}</span>
           </div>
           
           {isDeliveryMode ? (
              <button 
                disabled={cart.length === 0 || !isDeliveryFormValid || isFinalizing}
                onClick={() => setShowDeliveryLock(true)}
                className="w-full py-6 rounded-3xl font-black uppercase text-[12px] tracking-[0.4em] shadow-6xl active:scale-95 transition-all text-white bg-emerald-600 disabled:opacity-20"
              >
                {isFinalizing ? 'Gravando...' : 'Lançar Entrega'}
              </button>
           ) : !isCheckoutOpen ? (
             <button 
               disabled={cart.length === 0 || isFinalizing}
               onClick={() => setIsCheckoutOpen(true)}
               style={{ backgroundColor: settings.primaryColor }}
               className="w-full py-6 rounded-3xl font-black uppercase text-[12px] tracking-[0.4em] shadow-6xl active:scale-95 transition-all text-white disabled:opacity-20"
             >
               Finalizar Venda
             </button>
           ) : (
             <div className="space-y-4 animate-in fade-in duration-300">
                {!showCashFlow ? (
                    <div className="grid grid-cols-1 gap-3">
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => { setSelectedMethod('Pix'); setShowSafetyLock(true); }} className="bg-white text-slate-900 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Pix</button>
                            <button onClick={() => { setSelectedMethod('Cartão'); setShowSafetyLock(true); }} className="bg-white text-slate-900 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Cartão</button>
                        </div>
                        <button onClick={() => { setSelectedMethod('Dinheiro'); setShowCashFlow(true); }} className="bg-emerald-600 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl">Dinheiro</button>
                        <button onClick={() => setIsCheckoutOpen(false)} className="w-full py-2 text-[8px] font-black uppercase text-slate-600 tracking-widest">Voltar</button>
                    </div>
                ) : (
                    <div className="space-y-4">
                       <div className="space-y-2 text-center">
                           <input ref={cashInputRef} type="number" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} className="w-full px-5 py-5 rounded-3xl bg-slate-900 text-white font-black text-3xl text-center border border-slate-700 outline-none focus:border-emerald-500 shadow-inner" placeholder="0,00" />
                       </div>
                       <div className="bg-emerald-950/20 p-5 rounded-[2rem] border border-emerald-900/30 text-center">
                           <span className="text-[10px] font-black uppercase text-emerald-500 block mb-1">Troco</span>
                           <span className="text-3xl font-black text-emerald-400 italic">R$ {changeValue.toFixed(2)}</span>
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                          <button onClick={() => { setShowCashFlow(false); setSelectedMethod(null); }} className="py-4 bg-slate-800 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest">Voltar</button>
                          <button onClick={() => setShowSafetyLock(true)} disabled={amountReceived === '' || Number(amountReceived) < total} className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Confirmar</button>
                       </div>
                    </div>
                )}
             </div>
           )}
        </div>
      </div>
    </div>

      {/* MODAIS DE CONFIRMAÇÃO COM LARGURA AJUSTADA (450px) */}
      {showPrintConfirm && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300 no-print">
            <div className="bg-white dark:bg-slate-900 w-[90%] max-w-[450px] rounded-[3rem] p-10 shadow-6xl border border-white/10 text-center animate-in zoom-in-95">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-white shadow-xl border ${printMode === 'customer' ? 'bg-emerald-50 border-emerald-400' : 'bg-blue-50 border-blue-400'}`}>
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2 text-slate-900 dark:text-white leading-none">Imprimir {printMode === 'customer' ? 'Recibo' : 'Comanda'}?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase mb-8 leading-relaxed px-4">Deseja prosseguir com a geração do documento?</p>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setShowPrintConfirm(false)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Voltar</button>
                    <button onClick={() => handlePrintAction(printMode)} className="py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl transition-all">Imprimir</button>
                </div>
            </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300 no-print">
            <div className="bg-white dark:bg-slate-900 w-[90%] max-w-[450px] rounded-[3rem] p-10 shadow-6xl border border-white/10 text-center animate-in zoom-in-95">
                <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6 text-rose-500 shadow-xl border border-rose-100">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={3}/></svg>
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2 text-slate-900 dark:text-white leading-none">Limpar Tudo?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase mb-8 leading-relaxed px-4">Deseja realmente remover todos os itens do carrinho e zerar o formulário?</p>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setShowResetConfirm(false)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Não</button>
                    <button onClick={executeReset} className="py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all">Limpar</button>
                </div>
            </div>
        </div>
      )}

      {showSafetyLock && (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300 no-print">
              <div className="bg-white dark:bg-slate-900 w-[90%] max-w-[450px] rounded-[3rem] p-10 shadow-6xl border border-white/10 text-center animate-in zoom-in-95">
                  <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-500 shadow-xl border border-emerald-100">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={3}/></svg>
                  </div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter mb-4 text-slate-900 dark:text-white leading-none">Confirmar Venda?</h3>
                  <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 mb-6 space-y-2 text-left">
                      <div className="flex justify-between text-[11px] font-black uppercase text-slate-400"><span>Valor Total:</span><span className="text-slate-900 dark:text-white font-bold">R$ {total.toFixed(2)}</span></div>
                      <div className="flex justify-between text-[11px] font-black uppercase text-slate-400"><span>Forma de Pagto:</span><span className="text-indigo-500">{selectedMethod}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => setShowSafetyLock(false)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Voltar</button>
                      <button onClick={handleFinalFinish} disabled={isFinalizing} className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all">{isFinalizing ? 'Gravando...' : 'Confirmar'}</button>
                  </div>
              </div>
          </div>
      )}

      {showDeliveryLock && (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300 no-print">
              <div className="bg-white dark:bg-slate-900 w-[90%] max-w-[450px] rounded-[3rem] p-10 shadow-6xl border border-white/10 text-center animate-in zoom-in-95"><div className="w-20 h-20 bg-amber-50 dark:bg-amber-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6 text-amber-500 shadow-xl border border-amber-100"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth={3}/></svg></div><h3 className="text-xl font-black uppercase italic tracking-tighter mb-4 text-slate-900 dark:text-white leading-none">Lançar Entrega?</h3><p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase mb-8 leading-relaxed px-4">O pedido será registrado e aparecerá no monitor de logística para acompanhamento.</p><div className="grid grid-cols-2 gap-4"><button onClick={() => setShowDeliveryLock(false)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Voltar</button><button onClick={handleLaunchDelivery} disabled={isFinalizing} className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all">{isFinalizing ? 'Gravando...' : 'Confirmar'}</button></div></div>
          </div>
      )}

      {isTableTransferOpen && (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300 no-print">
              <div className="bg-white dark:bg-slate-900 w-[90%] max-w-[450px] rounded-[3rem] p-8 shadow-6xl border border-white/10 text-center animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                  <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center mx-auto mb-4 text-indigo-500 shadow-xl border border-indigo-100 shrink-0">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  </div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2 text-slate-900 dark:text-white leading-none shrink-0">Enviar para Mesa</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase mb-6 leading-relaxed px-4 shrink-0">Selecione a mesa para transferir os itens do carrinho.</p>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar mb-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 p-2 grid grid-cols-3 gap-2 content-start">
                      {tables.filter(t => t.status !== 'Reservada').map(t => {
                          const isOccupied = t.status !== 'Livre' || t.items.length > 0;
                          return (
                            <button 
                                key={t.id} 
                                onClick={() => setSelectedTransferTableId(t.id)}
                                className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center h-20 ${selectedTransferTableId === t.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-md' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300'}`}
                            >
                                <span className="text-sm font-black italic uppercase tracking-tighter">{t.label}</span>
                                <span className={`text-[8px] font-bold uppercase mt-1 ${selectedTransferTableId === t.id ? 'text-indigo-100' : (isOccupied ? 'text-amber-500' : 'text-emerald-500')}`}>
                                    {isOccupied ? 'Ocupada' : 'Livre'}
                                </span>
                            </button>
                          );
                      })}
                  </div>

                  <div className="grid grid-cols-2 gap-4 shrink-0">
                      <button onClick={() => { setIsTableTransferOpen(false); setSelectedTransferTableId(null); }} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Cancelar</button>
                      <button onClick={handleTransferToTable} disabled={selectedTransferTableId === null || isTransferring} className="py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50">{isTransferring ? 'Transferindo...' : 'Confirmar'}</button>
                  </div>
              </div>
          </div>
      )}

      <style>{`
        @media print {
          @page {
            margin: 0;
            size: 80mm auto;
          }
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 80mm;
            padding: 4mm;
            display: block !important;
          }
          .no-print { display: none !important; }
          
          /* Kitchen vs Customer Print Modes */
          .print-mode-kitchen .customer-header,
          .print-mode-kitchen .financial-footer,
          .print-mode-kitchen .item-price-col {
            display: none !important;
          }
          .print-mode-customer .kitchen-only {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default NewSale;