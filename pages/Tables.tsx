import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Table, Product, SaleItem, Sale, Category, KDSOrder } from '../types';
import { 
  getTables, saveTables, saveSale, getCategories, 
  getAppSettings, getCurrentUser, DEFAULT_SETTINGS,
  notifyDataChanged, saveKDSOrder
} from '../services/storage';
import { playSaleConfirmationSound, preloadSaleSound } from '../services/sound';
import { getCategoryIcon } from '../src/utils/categoryIcons';

interface TablesProps {
  products: Product[];
  onBack: () => void;
  onUpdate: () => void;
}

const Tables: React.FC<TablesProps> = ({ products, onBack, onUpdate }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [printMode, setPrintMode] = useState<'customer' | 'kitchen'>('customer');
  const [isLoading, setIsLoading] = useState(true);
  
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [tempLabel, setTempLabel] = useState('');

  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualObs, setManualObs] = useState('');

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<Sale['paymentMethod'] | null>(null);
  const [amountReceived, setAmountReceived] = useState<string>(''); // Vazio por padrão
  const [showCashFlow, setShowCashFlow] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showSafetyLock, setShowSafetyLock] = useState(false);
  const [showPrintConfirm, setShowPrintConfirm] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [selectedTransferTableId, setSelectedTransferTableId] = useState<number | null>(null);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mobileView, setMobileView] = useState<'products' | 'cart' | 'manual'>('products');
  
  // REFERÊNCIAS PARA FOCO
  const tableSearchInputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const getTableDuration = (startTime?: string) => {
    if (!startTime) return null;
    const start = new Date(startTime).getTime();
    const now = currentTime.getTime();
    const diff = now - start;
    if (diff < 0) return '0m';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [t, s, c] = await Promise.all([
      getTables(),
      getAppSettings(),
      getCategories()
    ]);
    setTables(t);
    setSettings(s);
    setCategories(c.filter(cat => cat.active !== false));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    preloadSaleSound();
  }, [loadData]);

  // Foco automático no campo de busca ao selecionar uma mesa
  useEffect(() => {
    if (selectedTable && tableSearchInputRef.current) {
        setTimeout(() => tableSearchInputRef.current?.focus(), 250);
    }
  }, [selectedTable]);

  // Focar no campo de dinheiro quando abrir o fluxo de caixa
  useEffect(() => {
    if (showCashFlow && cashInputRef.current) {
        setTimeout(() => cashInputRef.current?.focus(), 100);
    }
  }, [showCashFlow]);

  const resetPaymentFlow = () => {
    setIsCheckoutOpen(false);
    setSelectedMethod(null);
    setAmountReceived('');
    setShowCashFlow(false);
    setIsFinalizing(false);
    setShowSafetyLock(false);
    setShowPrintConfirm(false);
  };

  const toggleTable = (table: Table) => {
    setSelectedTable(table);
    setTempLabel(table.label);
    setSelectedCategoryId('all');
    setManualName(''); setManualPrice(''); setManualObs('');
    setIsEditingLabel(false);
    setMobileView('products');
    resetPaymentFlow();
  };

  const handleAddTable = async () => {
    const newId = Math.max(0, ...tables.map(t => t.id)) + 1;
    const newT: Table = {
      id: newId,
      label: newId.toString().padStart(2, '0'),
      status: 'Livre',
      items: [],
      notes: ''
    };
    const updated = [...tables, newT];
    await saveTables(updated);
    setTables(updated);
  };

  const handlePrintAction = async (mode: 'customer' | 'kitchen') => {
    setPrintMode(mode);
    
    // Automatização: Se imprimir comanda (cliente), muda status para Aguardando Pagamento
    if (mode === 'customer' && selectedTable && selectedTable.status === 'Ocupada') {
        handleUpdateTableData({ status: 'Aguardando Pagamento' });
    }

    // Enviar para o KDS se for comanda de cozinha e a configuração estiver ativa
    if (mode === 'kitchen' && settings.kdsSendOnPrint && selectedTable && selectedTable.items.length > 0) {
      const kdsOrder: KDSOrder = {
        id: Math.random().toString(36).substr(2, 9),
        orderNumber: Math.floor(1000 + Math.random() * 9000).toString(),
        type: 'table',
        identifier: selectedTable.label,
        items: [...selectedTable.items],
        status: 'pending',
        createdAt: new Date().toISOString(),
        tableId: selectedTable.id
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

  const initiatePayment = (method: Sale['paymentMethod']) => {
    setSelectedMethod(method);
    if (method === 'Dinheiro') {
      setAmountReceived(''); 
      setShowCashFlow(true);
    }
    else setShowSafetyLock(true);
  };

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('p4zz_session_user') || '{}'), []);
  const isDemoViewer = currentUser.isDemoViewer;

  const handleUpdateTableData = useCallback(async (updates: Partial<Table>) => {
    if (!selectedTable) return;
    const updatedTable = { ...selectedTable, ...updates } as Table;
    
    if (updatedTable.items.length > 0 && updatedTable.status === 'Livre') {
        updatedTable.status = 'Ocupada';
        updatedTable.startTime = updatedTable.startTime || new Date().toISOString();
    }
    if (updatedTable.items.length === 0 && updatedTable.status !== 'Livre') {
        updatedTable.status = 'Livre';
        updatedTable.startTime = undefined;
    }

    const currentTables = await getTables();
    const updatedTablesList = currentTables.map(t => t.id === selectedTable.id ? updatedTable : t);
    
    await saveTables(updatedTablesList);
    setTables(updatedTablesList);
    setSelectedTable(updatedTable);
  }, [selectedTable]);

  const handleSaveLabel = async () => {
    if (!tempLabel.trim()) { setIsEditingLabel(false); return; }
    await handleUpdateTableData({ label: tempLabel.toUpperCase() });
    setIsEditingLabel(false);
  };

  const handleTransferTable = async () => {
    if (!selectedTable || selectedTransferTableId === null) return;
    
    const currentTables = await getTables();
    const targetTable = currentTables.find(t => t.id === selectedTransferTableId);
    
    if (!targetTable) return;

    // SEGURANÇA EXTRA: Validar se a mesa de destino está realmente livre
    if (targetTable.status !== 'Livre' || targetTable.items.length > 0) {
      alert("Não é possível transferir. A mesa selecionada já está ocupada.");
      setIsTransferOpen(false);
      setSelectedTransferTableId(null);
      return;
    }

    const newItems = [...selectedTable.items]; // Não faz merge, apenas move
    
    const updatedTablesList = currentTables.map(t => {
      if (t.id === selectedTransferTableId) {
        return {
          ...t,
          status: 'Ocupada',
          items: newItems,
          startTime: selectedTable.startTime || new Date().toISOString(),
          notes: selectedTable.notes || ''
        } as Table;
      }
      if (t.id === selectedTable.id) {
        return {
          ...t,
          status: 'Livre',
          items: [],
          startTime: undefined,
          notes: ''
        } as Table;
      }
      return t;
    });

    await saveTables(updatedTablesList);
    setTables(updatedTablesList);
    notifyDataChanged();
    
    const newSelectedTable = updatedTablesList.find(t => t.id === selectedTransferTableId);
    if (newSelectedTable) {
        setSelectedTable(newSelectedTable);
        setTempLabel(newSelectedTable.label);
    }
    
    setIsTransferOpen(false);
    setSelectedTransferTableId(null);
  };

  const addToTable = (product: Product) => {
    if (!selectedTable) return;
    if (product.stock <= 0) {
      alert("Estoque insuficiente para este item.");
      return;
    }
    const existing = selectedTable.items.find(i => i.productId === product.id && !i.observation);
    let newItems;
    if (existing) {
      if (existing.quantity >= product.stock) {
        alert("Estoque insuficiente para este item.");
        return;
      }
      newItems = selectedTable.items.map(i => i === existing ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price } : i);
    } else {
      newItems = [...selectedTable.items, { productId: product.id, productName: product.name, quantity: 1, price: product.price, cost: product.cost || 0, subtotal: product.price }];
    }
    handleUpdateTableData({ items: newItems });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const barcodeValue = search.trim();
      if (!barcodeValue) return;
      
      const matchedProduct = products.find(p => p.barcode === barcodeValue);
      if (matchedProduct) {
        e.preventDefault();
        addToTable(matchedProduct);
        setSearch(''); // Limpa o campo para a próxima leitura
      }
    }
  };

  const handleFinalFinish = async () => {
    if (!selectedTable || !selectedMethod || isFinalizing) return;
    setIsFinalizing(true);
    
    try {
      const totalVal = selectedTable.items.reduce((acc, i) => acc + i.subtotal, 0);
      const user = getCurrentUser();
      
      const saleToSave: Sale = { 
        id: Math.random().toString(36).substring(2, 11), 
        date: new Date().toISOString(), 
        items: [...selectedTable.items], 
        total: totalVal, 
        paymentMethod: selectedMethod, 
        status: 'Concluída', 
        tableNumber: selectedTable.id, 
        tableLabel: selectedTable.label,
        isDelivery: false,
        userId: user?.id || 'unknown',
        userName: user?.name || 'Sistema'
      };
      
      setPrintMode('customer');
      const saved = await saveSale(saleToSave);
      
      if (saved) {
        playSaleConfirmationSound();
        if (settings.printSettings?.autoPrint) {
          const delay = settings.printSettings?.printDelay || 100;
          setTimeout(() => {
            window.print();
          }, delay);
        }
        const currentTables = await getTables();
        const updatedTables = currentTables.map(t => t.id === selectedTable.id ? { ...t, status: 'Livre', items: [], startTime: undefined, notes: '' } as Table : t);
        await saveTables(updatedTables); 
        setTables(updatedTables); 
        setSelectedTable(null);
        if (onUpdate) onUpdate();
        resetPaymentFlow();
      }
    } catch (e) {
      console.error(e);
      alert("Falha ao encerrar conta.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const total = selectedTable ? selectedTable.items.reduce((acc, i) => acc + i.subtotal, 0) : 0;
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

  const addManualItem = async () => {
    if (!selectedTable || !manualName || !manualPrice) return;
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
    await handleUpdateTableData({ items: [...selectedTable.items, newItem] });
    setManualName(''); setManualPrice(''); setManualObs('');
  };

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 pb-24 md:pb-0 overflow-x-hidden ${printMode === 'kitchen' ? 'print-mode-kitchen' : 'print-mode-customer'}`}>
      
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

      {/* IMPRESSÃO TÉRMICA - OCULTA */}
      <div className="print-only thermal-receipt mx-auto text-black font-mono">
        {printMode === 'customer' ? (
          <div className="customer-header text-center mb-2 border-b border-dashed border-black pb-2">
            <h2 className="text-sm font-bold uppercase">{settings.printSettings?.customerReceipt?.header || settings.systemName}</h2>
            {settings.printSettings?.customerReceipt?.message && <p className="text-[8px] font-bold uppercase italic">{settings.printSettings.customerReceipt.message}</p>}
            <p className="text-[10px] font-black uppercase italic">Mesa: {selectedTable?.label}</p>
            <p className="text-[8px]">{new Date().toLocaleString('pt-BR')}</p>
          </div>
        ) : (
          <div className="kitchen-only text-center mb-2 border-b border-dashed border-black pb-2">
            <h2 className="text-sm font-black uppercase">{settings.printSettings?.kitchenOrder?.header || 'COMANDA'} - {selectedTable?.label}</h2>
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
            {selectedTable?.items.map((item, i) => (
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

      <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm no-print">
         <div className="flex flex-col"><h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 italic">Gestão de Mesas</h3><p className="text-[8px] font-bold text-slate-400 uppercase">{tables.length} Terminais Ativos</p></div>
          <div className="flex gap-2">
            <button onClick={async () => { if(tables.length > 0) { const updated = tables.slice(0, -1); await saveTables(updated); setTables(updated); } }} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-[9px] uppercase hover:bg-rose-50 transition-colors">- Remover</button>
            <button onClick={handleAddTable} className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-black text-[9px] uppercase hover:bg-indigo-100 transition-colors">+ Adicionar</button>
         </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 no-print pb-20">
        {tables.map(table => {
          const hasItems = table.items.length > 0;
          const duration = getTableDuration(table.startTime);
          const isAwaiting = table.status === 'Aguardando Pagamento';
          
          let bgColor = 'bg-white dark:bg-slate-900';
          let borderColor = 'border-slate-100 dark:border-slate-800';
          let textColor = 'text-slate-800 dark:text-slate-200';
          let statusColor = 'bg-slate-100 dark:bg-slate-800 text-slate-500';
          let statusLabel = 'Livre';

          if (table.status === 'Ocupada') {
            bgColor = 'bg-amber-500';
            borderColor = 'border-amber-400';
            textColor = 'text-white';
            statusColor = 'bg-white/20 text-white';
            statusLabel = 'Ocupada';
          } else if (table.status === 'Aguardando Pagamento') {
            bgColor = 'bg-rose-600';
            borderColor = 'border-rose-400';
            textColor = 'text-white';
            statusColor = 'bg-white/20 text-white';
            statusLabel = 'Pagamento';
          } else if (table.status === 'Reservada') {
            bgColor = 'bg-indigo-600';
            borderColor = 'border-indigo-400';
            textColor = 'text-white';
            statusColor = 'bg-white/20 text-white';
            statusLabel = 'Reservada';
          } else if (table.status === 'Livre') {
            borderColor = 'border-emerald-500/30';
            statusColor = 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';
          }

          return (
            <button 
              key={table.id} 
              onClick={() => {
                if (table.status === 'Reservada') {
                  alert('Esta mesa está reservada. Libere a reserva para fazer pedidos.');
                  return;
                }
                toggleTable(table);
              }} 
              className={`p-6 rounded-[2.5rem] border-2 transition-all h-36 flex flex-col items-center justify-center relative active:scale-95 group shadow-sm hover:shadow-md overflow-hidden
                ${bgColor} ${borderColor} ${textColor}
                ${isAwaiting ? 'animate-pulse ring-4 ring-rose-500/20' : ''}
              `}
            >
              {isAwaiting && (
                <div className="absolute top-2 right-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                </div>
              )}
              <span className="text-base font-black italic mb-1 uppercase tracking-tighter">{table.label}</span>
              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full mb-1 ${statusColor}`}>{statusLabel}</span>
              {duration && (
                <span className="text-[9px] font-bold opacity-80 uppercase tracking-widest">{duration}</span>
              )}
            </button>
          );
        })}
      </div>

      {selectedTable && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center z-[150] no-print animate-in fade-in duration-300 lg:p-4">
          <div className="bg-white dark:bg-slate-900 w-full lg:max-w-5xl h-full lg:h-[85vh] flex flex-col lg:rounded-t-[2rem] lg:rounded-b-[3rem] shadow-5xl border border-white/10 relative overflow-hidden">
            
            <div className="w-full p-4 lg:p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center justify-between w-full lg:w-auto gap-4">
                    <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setSelectedTable(null)} 
                          className="lg:hidden flex items-center gap-2 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px] tracking-widest"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                          </svg>
                          Voltar
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black italic text-lg shrink-0 shadow-lg" style={{ backgroundColor: settings.primaryColor }}>{selectedTable.id}</div>
                        <div className="flex flex-col">
                          {selectedTable.startTime && (
                            <div className="flex items-center gap-1.5">
                              <div className={`w-1.5 h-1.5 rounded-full ${selectedTable.status === 'Aguardando Pagamento' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`}></div>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Ocupada há {getTableDuration(selectedTable.startTime)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                              Status: <span className={selectedTable.status === 'Aguardando Pagamento' ? 'text-rose-500' : 'text-amber-500'}>{selectedTable.status}</span>
                          </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                           <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest hidden sm:inline">Comanda</span>
                           {isEditingLabel ? (
                             <input autoFocus value={tempLabel} onChange={e => setTempLabel(e.target.value)} onBlur={() => handleSaveLabel()} onKeyDown={e => e.key === 'Enter' && handleSaveLabel()} className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-2 py-1 font-black text-xs uppercase text-indigo-500 outline-none w-20" />
                           ) : (
                             <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => setIsEditingLabel(true)}>
                                <h3 className="font-black uppercase text-sm lg:text-base text-slate-900 dark:text-white italic tracking-tighter">{selectedTable.label}</h3>
                                <svg className="w-3 h-3 text-slate-400 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={3}/></svg>
                             </div>
                           )}
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto no-scrollbar pb-1 lg:pb-0">
                    <button 
                      onClick={() => handleUpdateTableData({ 
                        status: selectedTable.status === 'Aguardando Pagamento' ? 'Ocupada' : 'Aguardando Pagamento' 
                      })}
                      disabled={selectedTable.items.length === 0}
                      className={`flex-1 lg:flex-none px-3 lg:px-6 py-2.5 lg:py-3 rounded-xl hover:scale-105 transition-all shadow-sm border font-black text-[8px] lg:text-[9px] uppercase tracking-widest whitespace-nowrap ${selectedTable.status === 'Aguardando Pagamento' ? 'bg-rose-600 text-white border-rose-400 shadow-md ring-2 ring-rose-500/20' : 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 border-rose-100'}`}
                    >
                      {selectedTable.status === 'Aguardando Pagamento' ? 'Aguardando Pagamento' : 'Aguardar Pagamento'}
                    </button>
                    <button 
                      onClick={() => setIsTransferOpen(true)} 
                      className="flex-1 lg:flex-none px-3 lg:px-6 py-2.5 lg:py-3 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl hover:scale-105 transition-all shadow-sm border border-indigo-100 font-black text-[8px] lg:text-[9px] uppercase tracking-widest whitespace-nowrap"
                    >
                      Transferir
                    </button>
                    <button 
                      onClick={() => { setPrintMode('kitchen'); setShowPrintConfirm(true); }} 
                      className="flex-1 lg:flex-none px-3 lg:px-6 py-2.5 lg:py-3 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl hover:scale-105 transition-all shadow-sm border border-indigo-100 font-black text-[8px] lg:text-[9px] uppercase tracking-widest whitespace-nowrap"
                    >
                      Comanda
                    </button>
                    <button 
                      onClick={() => { setPrintMode('customer'); setShowPrintConfirm(true); }} 
                      className="flex-1 lg:flex-none px-3 lg:px-6 py-2.5 lg:py-3 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl hover:scale-105 transition-all shadow-sm border border-emerald-100 font-black text-[8px] lg:text-[9px] uppercase tracking-widest whitespace-nowrap"
                    >
                      Recibo
                    </button>
                    <button 
                      onClick={() => setSelectedTable(null)} 
                      className="flex-none p-2.5 lg:p-3 text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-xl hover:scale-105 transition-all shadow-sm border border-rose-100 flex items-center justify-center"
                      aria-label="Sair"
                    >
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg>
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-50 dark:bg-slate-950/20">
                {/* NAVEGAÇÃO MOBILE DENTRO DA MESA */}
                <div className="lg:hidden flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                    <button onClick={() => setMobileView('products')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all ${mobileView === 'products' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-slate-400'}`}>Produtos</button>
                    <button onClick={() => setMobileView('manual')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all ${mobileView === 'manual' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-slate-400'}`}>Avulso</button>
                    <button onClick={() => setMobileView('cart')} className={`flex-1 py-3 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all ${mobileView === 'cart' ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-slate-400'}`}>Carrinho ({selectedTable.items.length})</button>
                </div>

                <div className={`flex-1 flex flex-col border-r border-slate-200 dark:border-slate-800 overflow-hidden ${mobileView === 'cart' ? 'hidden lg:flex' : 'flex'}`}>
                    <div className={`p-4 bg-white dark:bg-slate-900 flex gap-2 shrink-0 ${mobileView === 'manual' ? 'hidden lg:flex' : 'flex'}`}>
                        <input 
                            ref={tableSearchInputRef}
                            value={search} 
                            onChange={e => setSearch(e.target.value)} 
                            onKeyDown={handleSearchKeyDown}
                            placeholder="BUSCAR PRODUTO (EX: COCA)..." 
                            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-black text-[10px] uppercase outline-none focus:ring-1 focus:ring-indigo-500" 
                        />
                    </div>
                    {/* Barra de Categorias Horizontal */}
                    <div className={`px-4 py-2 bg-white dark:bg-slate-900 border-b dark:border-slate-800 flex gap-2 overflow-x-auto no-scrollbar shrink-0 ${mobileView === 'manual' ? 'hidden lg:flex' : 'flex'}`}>
                        <button 
                            onClick={() => { setSelectedCategoryId('all'); setSearch(''); }}
                            className={`px-4 py-2 rounded-xl font-black text-[8px] uppercase tracking-widest whitespace-nowrap transition-all border-2 ${selectedCategoryId === 'all' && search === '' ? 'bg-indigo-600 text-white border-indigo-400 shadow-md scale-105' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        >
                            Início
                        </button>
                        {categories.map(c => (
                            <button 
                                key={c.id}
                                onClick={() => { setSelectedCategoryId(c.id); setSearch(''); }}
                                className={`px-4 py-2 rounded-xl font-black text-[8px] uppercase tracking-widest whitespace-nowrap transition-all border-2 flex items-center gap-2 ${selectedCategoryId === c.id && search === '' ? 'bg-indigo-600 text-white border-indigo-400 shadow-md scale-105' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                            >
                                <span className="w-3 h-3 flex items-center justify-center">{getCategoryIcon(c.name, c.icon)}</span>
                                {c.name}
                            </button>
                        ))}
                    </div>
                    <div className={`flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 gap-3 content-start custom-scrollbar ${mobileView === 'manual' ? 'hidden lg:grid' : 'grid'}`}>
                        {search.trim() === '' && selectedCategoryId === 'all' ? (
                            categories.map(c => (
                                <button 
                                    key={c.id} 
                                    onClick={() => setSelectedCategoryId(c.id)}
                                    className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-indigo-500 transition-all flex flex-col items-center justify-center text-center group animate-in zoom-in-95"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform text-indigo-500 p-2">
                                        {getCategoryIcon(c.name, c.icon)}
                                    </div>
                                    <span className="text-[9px] font-black uppercase text-slate-800 dark:text-white tracking-widest">{c.name}</span>
                                    <span className="text-[7px] font-bold text-slate-400 mt-1 uppercase">{products.filter(p => p.categoryId === c.id).length} Itens</span>
                                </button>
                            ))
                        ) : (
                            <>
                                {/* Botão Voltar para Categorias (se não estiver buscando) */}
                                {search.trim() === '' && (
                                    <button 
                                        onClick={() => setSelectedCategoryId('all')}
                                        className="p-3 bg-slate-100 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex flex-col items-center justify-center text-center group"
                                    >
                                        <svg className="w-4 h-4 text-slate-400 mb-1 group-hover:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                                        <span className="text-[8px] font-black uppercase text-slate-400 group-hover:text-indigo-500 transition-colors">Voltar</span>
                                    </button>
                                )}
                                {filteredProducts.map(p => (
                                    <button key={p.id} onClick={() => addToTable(p)} className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-indigo-500 transition-all text-left flex flex-col justify-between h-28 group animate-in zoom-in-95">
                                        <span className="text-[12px] font-black uppercase leading-tight line-clamp-2 dark:text-white">{p.name}</span>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[14px] font-black italic text-indigo-500">R$ {p.price.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-start">
                                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg uppercase tracking-wider ${p.stock < 5 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'}`}>
                                                    Estoque: {p.stock}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                                {filteredProducts.length === 0 && search.trim() !== '' && (
                                    <div className="col-span-full py-12 text-center opacity-50 flex flex-col items-center">
                                        <svg className="w-10 h-10 mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth={2}/></svg>
                                        <p className="font-black uppercase text-[10px] tracking-widest">Nenhum produto encontrado</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div className={`p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 space-y-3 ${mobileView === 'products' ? 'hidden lg:block' : 'block'}`}>
                        <h4 className="text-[10px] font-black uppercase text-indigo-500 ml-1 italic tracking-widest">Item Avulso</h4>
                        <div className="grid grid-cols-1 gap-2">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input value={manualName || ''} onChange={e => setManualName(e.target.value.toUpperCase())} placeholder="NOME DO ITEM" className="flex-[2] px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-[10px] uppercase outline-none" />
                                <input value={manualPrice || ''} onChange={e => setManualPrice(e.target.value)} type="number" placeholder="VALOR R$" className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-[11px] outline-none" />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input value={manualObs || ''} onChange={e => setManualObs(e.target.value.toUpperCase())} placeholder="OBSERVAÇÃO (EX: BEM PASSADO, SEM GELO)" className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-[10px] uppercase outline-none focus:ring-1 focus:ring-indigo-500" />
                                <button onClick={() => addManualItem()} className="px-6 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl font-black text-[10px] uppercase shadow-md active:scale-95 transition-all">Lançar</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`w-full lg:w-96 flex flex-col bg-white dark:bg-slate-900 shrink-0 overflow-hidden ${mobileView !== 'cart' ? 'hidden lg:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center shrink-0">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Carrinho da Mesa</span>
                        <button 
                            onClick={() => {
                                if(window.confirm('Tem certeza que deseja remover todos os itens da mesa?')) {
                                    handleUpdateTableData({ items: [] });
                                }
                            }} 
                            className="text-[9px] font-black uppercase text-rose-500 hover:scale-105 transition-all"
                        >
                            Limpar Tudo
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                        {selectedTable.items.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-10 grayscale py-10">
                                <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" strokeWidth={1.5}/></svg>
                                <p className="font-black text-[10px] uppercase">Mesa Vazia</p>
                            </div>
                        ) : (
                            selectedTable.items.map((item, idx) => (
                                <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/50 flex flex-col shadow-sm">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[10px] font-black uppercase leading-tight block dark:text-white truncate">{item.productName}</span>
                                            {item.observation && <span className="text-[8px] font-bold text-indigo-500 uppercase italic mt-1 block">Obs: {item.observation}</span>}
                                        </div>
                                        <span className="font-black text-[10px] italic shrink-0 dark:text-indigo-400">R$ {item.subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                                        <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg p-0.5 border">
                                            <button onClick={() => { 
                                              const newItems = [...selectedTable.items]; 
                                              if(newItems[idx].quantity > 1) { 
                                                newItems[idx].quantity--; 
                                                newItems[idx].subtotal = newItems[idx].quantity * newItems[idx].price; 
                                                handleUpdateTableData({ items: newItems }); 
                                              } else { 
                                                handleUpdateTableData({ items: selectedTable.items.filter((_, i) => i !== idx) }); 
                                              } 
                                            }} className="w-6 h-6 flex items-center justify-center font-black text-slate-400">-</button>
                                            <span className="px-2 text-[10px] font-black dark:text-white">{item.quantity}</span>
                                            <button onClick={() => { 
                                              const newItems = [...selectedTable.items]; 
                                              const product = products.find(p => p.id === item.productId);
                                              if (product && newItems[idx].quantity >= product.stock) {
                                                alert("Estoque insuficiente para este item.");
                                                return;
                                              }
                                              newItems[idx].quantity++; 
                                              newItems[idx].subtotal = newItems[idx].quantity * newItems[idx].price; 
                                              handleUpdateTableData({ items: newItems }); 
                                            }} className="w-6 h-6 flex items-center justify-center font-black text-slate-400">+</button>
                                        </div>
                                        <button onClick={() => handleUpdateTableData({ items: selectedTable.items.filter((_, i) => i !== idx) })} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-6 bg-slate-950 space-y-4 shrink-0 pb-10 lg:pb-6">
                        <div className="flex justify-between items-end"><span className="text-[9px] font-black text-slate-500 uppercase italic">Subtotal</span><span className="text-4xl font-black italic text-white tracking-tighter leading-none">R$ {total.toFixed(2)}</span></div>
                        
                        {!isCheckoutOpen ? (
                          <button disabled={selectedTable.items.length === 0} onClick={() => setIsCheckoutOpen(true)} style={{ backgroundColor: settings.primaryColor }} className="w-full py-5 rounded-2xl text-white font-black uppercase text-[11px] tracking-[0.3em] shadow-xl active:scale-95 transition-all disabled:opacity-30">Finalizar Venda</button>
                        ) : (
                          <div className="space-y-4 animate-in slide-in-from-bottom-2">
                             {!showCashFlow ? (
                               <div className="grid grid-cols-1 gap-2">
                                  <div className="grid grid-cols-2 gap-2">
                                     <button onClick={() => initiatePayment('Pix')} className="bg-white text-slate-900 py-4 rounded-xl font-black text-[9px] uppercase tracking-widest">Pix</button>
                                     <button onClick={() => initiatePayment('Cartão')} className="bg-white text-slate-900 py-4 rounded-xl font-black text-[9px] uppercase tracking-widest">Cartão</button>
                                  </div>
                                  <button onClick={() => initiatePayment('Dinheiro')} className="bg-emerald-600 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest">Dinheiro</button>
                                  <button onClick={() => setIsCheckoutOpen(false)} className="text-[8px] font-black text-slate-500 uppercase tracking-widest py-2">Voltar</button>
                               </div>
                             ) : (
                               <div className="space-y-4">
                                  <input ref={cashInputRef} type="number" value={amountReceived} onChange={e => setAmountReceived(e.target.value)} className="w-full py-4 bg-slate-900 text-white border border-slate-700 rounded-2xl font-black text-2xl text-center outline-none focus:border-emerald-500" placeholder="0,00" />
                                  <div className="bg-emerald-950/20 p-4 rounded-xl border border-emerald-900/30 flex justify-between items-center"><span className="text-[9px] font-black text-emerald-500 uppercase">Troco:</span><span className="text-xl font-black text-emerald-400 italic">R$ {changeValue.toFixed(2)}</span></div>
                                  <div className="grid grid-cols-2 gap-2">
                                     <button onClick={() => { setShowCashFlow(false); setSelectedMethod(null); }} className="py-3 bg-slate-800 text-slate-400 rounded-xl font-black text-[9px] uppercase">Voltar</button>
                                     <button onClick={() => setShowSafetyLock(true)} disabled={amountReceived === '' || Number(amountReceived) < total} className="py-3 bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase shadow-lg">Confirmar</button>
                                  </div>
                               </div>
                             )}
                          </div>
                        )}
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAIS DE CONFIRMAÇÃO COM LARGURA AJUSTADA (450px) */}
      {showPrintConfirm && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300 no-print">
            <div className="bg-white dark:bg-slate-900 w-[90%] max-w-[450px] rounded-[3rem] p-10 shadow-6xl border border-white/10 text-center animate-in zoom-in-95">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-white shadow-xl border ${printMode === 'customer' ? 'bg-emerald-50 border-emerald-400' : 'bg-blue-50 border-blue-400'}`}>
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2 text-slate-900 dark:text-white leading-none">Imprimir {printMode === 'customer' ? 'Recibo' : 'Comanda'}?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase mb-8 leading-relaxed px-4">Deseja gerar o documento de {printMode === 'customer' ? 'Recibo (Cliente)' : 'Comanda (Cozinha)'} agora?</p>
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setShowPrintConfirm(false)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Voltar</button>
                    <button onClick={() => handlePrintAction(printMode)} className="py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl transition-all">Imprimir</button>
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
                  <h3 className="text-xl font-black uppercase italic tracking-tighter mb-4 text-slate-900 dark:text-white leading-none">Finalizar Mesa?</h3>
                  <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 mb-6 space-y-2">
                      <div className="flex justify-between text-[11px] font-black uppercase text-slate-400"><span>Mesa:</span><span className="text-slate-900 dark:text-white">{selectedTable.label}</span></div>
                      <div className="flex justify-between text-[11px] font-black uppercase text-slate-400"><span>Total:</span><span className="text-slate-900 dark:text-white font-bold">R$ {total.toFixed(2)}</span></div>
                      <div className="flex justify-between text-[11px] font-black uppercase text-slate-400"><span>Pagamento:</span><span className="text-indigo-500">{selectedMethod}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => setShowSafetyLock(false)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Voltar</button>
                      <button onClick={() => { handleFinalFinish(); }} disabled={isFinalizing} className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all">{isFinalizing ? 'Gravando...' : 'Confirmar'}</button>
                  </div>
              </div>
          </div>
      )}

      {isTransferOpen && (
          <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex items-center justify-center z-[300] p-4 animate-in fade-in duration-300 no-print">
              <div className="bg-white dark:bg-slate-900 w-[90%] max-w-[450px] rounded-[3rem] p-8 shadow-6xl border border-white/10 text-center animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                  <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center mx-auto mb-4 text-indigo-500 shadow-xl border border-indigo-100 shrink-0">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  </div>
                  <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2 text-slate-900 dark:text-white leading-none shrink-0">Transferir Mesa</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase mb-6 leading-relaxed px-4 shrink-0">Selecione a mesa de destino para transferir os itens da mesa {selectedTable?.label}.</p>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar mb-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 p-2 grid grid-cols-3 gap-2 content-start">
                      {tables.filter(t => t.id !== selectedTable?.id && t.status === 'Livre' && t.items.length === 0).map(t => (
                          <button 
                              key={t.id} 
                              onClick={() => setSelectedTransferTableId(t.id)}
                              className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center h-20 ${selectedTransferTableId === t.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-md' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300'}`}
                          >
                              <span className="text-sm font-black italic uppercase tracking-tighter">{t.label}</span>
                              <span className={`text-[8px] font-bold uppercase mt-1 ${selectedTransferTableId === t.id ? 'text-indigo-100' : 'text-emerald-500'}`}>Livre</span>
                          </button>
                      ))}
                      {tables.filter(t => t.id !== selectedTable?.id && (t.status !== 'Livre' || t.items.length > 0)).length === tables.length - 1 && (
                        <div className="col-span-3 py-10 text-center">
                          <p className="text-[10px] font-black uppercase text-slate-400">Nenhuma mesa livre disponível</p>
                        </div>
                      )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 shrink-0">
                      <button onClick={() => { setIsTransferOpen(false); setSelectedTransferTableId(null); }} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Cancelar</button>
                      <button onClick={handleTransferTable} disabled={selectedTransferTableId === null} className="py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-2xl active:scale-95 transition-all disabled:opacity-50">Transferir</button>
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

export default Tables;
