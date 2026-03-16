
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Delivery, Sale, Product, SaleItem, AppSettings } from '../types';
import { getDeliveries, removeDelivery, saveSale, getAppSettings, saveDelivery, saveAllDeliveries, getCurrentUser, DEFAULT_SETTINGS } from '../services/storage';
import { Phone, MapPin, MessageCircle, ChevronDown, ChevronUp, Package, Clock, DollarSign, Search } from 'lucide-react';

interface DeliveriesProps {
  onRefresh?: () => void;
  products?: Product[];
}

interface Balloon {
  id: number;
  left: number;
  speed: number;
  color: string;
  delay: number;
  scale: number;
}

const Deliveries: React.FC<DeliveriesProps> = ({ onRefresh, products = [] }) => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  
  // States para o Modal de Pagamento
  const [deliveryToFinish, setDeliveryToFinish] = useState<Delivery | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<Sale['paymentMethod'] | null>(null);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [isFinishing, setIsFinishing] = useState(false);
  const [showCashFlow, setShowCashFlow] = useState(false);
  
  // State para Impressão
  const [deliveryToPrint, setDeliveryToPrint] = useState<Delivery | null>(null);

  // States para Edição de Entrega
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editReference, setEditReference] = useState('');
  const [editChangeFor, setEditChangeFor] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<Delivery['paymentMethod']>('Dinheiro');
  const [editCart, setEditCart] = useState<SaleItem[]>([]);
  const [editPaid, setEditPaid] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');

  const [expandedDeliveries, setExpandedDeliveries] = useState<Record<string, boolean>>({});
  const [celebrationBalloons, setCelebrationBalloons] = useState<Balloon[]>([]);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  
  // getAppSettings is asynchronous, using DEFAULT_SETTINGS initially.
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    // Fix: Await getAppSettings in useEffect to fetch actual settings object
    getAppSettings().then(setSettings);
    loadDeliveries();

    // Auto-focus on search when entering the page
    setTimeout(() => {
      searchRef.current?.focus();
    }, 300);
  }, []);

  const loadDeliveries = async () => {
    // Fix: Await getDeliveries as it is an asynchronous function
    const rawData = await getDeliveries();
    const processedData = rawData.map(d => ({
        ...d,
        deliveryStage: d.deliveryStage || 'active'
    }));
    const sorted = processedData.sort((a, b) => {
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
      if (a.deliveryStage === 'active' && b.deliveryStage !== 'active') return -1;
      if (a.deliveryStage !== 'active' && b.deliveryStage === 'active') return 1;
      return (a.displayId || 0) - (b.displayId || 0);
    });
    setDeliveries(sorted);
  };

  const filteredDeliveries = useMemo(() => {
    if (!search.trim()) return deliveries;
    return deliveries.filter(d => 
      d.customerName.toLowerCase().includes(search.toLowerCase()) ||
      d.address.toLowerCase().includes(search.toLowerCase()) ||
      d.phone?.includes(search) ||
      d.displayId?.toString().includes(search)
    );
  }, [deliveries, search]);

  const currentUser = JSON.parse(localStorage.getItem('p4zz_session_user') || '{}');
  const isDemoViewer = currentUser.isDemoViewer;

  const handleMove = async (e: React.MouseEvent, id: string, direction: 'up' | 'down') => {
    e.stopPropagation();
    const index = deliveries.findIndex(d => d.id === id);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= deliveries.length) return;
    const newDeliveries = [...deliveries];
    const temp = newDeliveries[index];
    newDeliveries[index] = newDeliveries[targetIndex];
    newDeliveries[targetIndex] = temp;
    const updated = newDeliveries.map((d, i) => ({ ...d, sortOrder: i }));
    // Fix: await storage call
    await saveAllDeliveries(updated);
    setDeliveries(updated);
  };

  const handleStartFinish = (e: React.MouseEvent, delivery: Delivery) => {
    e.stopPropagation();
    setDeliveryToFinish(delivery);
    setPaymentMethod(delivery.paymentMethod || null);
    setAmountReceived('');
    setShowCashFlow(delivery.paymentMethod === 'Dinheiro');
  };

  const closePaymentModal = () => {
    setDeliveryToFinish(null);
    setPaymentMethod(null);
    setAmountReceived('');
    setShowCashFlow(false);
    setIsFinishing(false);
  };

  const selectPayment = (method: Sale['paymentMethod']) => {
    setPaymentMethod(method);
    if (method === 'Dinheiro') setShowCashFlow(true);
    else setShowCashFlow(false);
  };

  const triggerCelebration = () => {
    const colors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#06b6d4'];
    const balloons: Balloon[] = Array.from({ length: 30 }).map((_, i) => ({
      id: Date.now() + i,
      left: Math.random() * 100,
      speed: 3 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 2,
      scale: 0.7 + Math.random() * 0.6
    }));
    setCelebrationBalloons(balloons);
  };

  const finalizeDelivery = async () => {
    if (!deliveryToFinish || !paymentMethod) return;
    setIsFinishing(true);
    try {
        const user = getCurrentUser();
        const sale: Sale = {
            id: Math.random().toString(36).substring(2, 11),
            date: new Date().toISOString(),
            items: deliveryToFinish.items,
            total: deliveryToFinish.total,
            paymentMethod: paymentMethod, 
            status: 'Concluída',
            isDelivery: true,
            deliveryInfo: {
              customerName: deliveryToFinish.customerName,
              address: deliveryToFinish.address,
              changeFor: deliveryToFinish.changeFor,
              paymentMethod: paymentMethod
            },
            userId: user?.id || 'unknown',
            userName: user?.name || 'Sistema'
        };
        // Fix: await storage call
        if (await saveSale(sale)) {
            if (settings.printSettings?.autoPrint) {
                setDeliveryToPrint(deliveryToFinish);
                const delay = settings.printSettings?.printDelay || 100;
                setTimeout(() => window.print(), delay);
            }
            // Fix: await storage call
            await removeDelivery(deliveryToFinish.id);
            loadDeliveries();
            if (onRefresh) onRefresh();
            closePaymentModal();
            triggerCelebration();
        }
    } catch (err) {
        setIsFinishing(false);
    }
  };

  const handleCancelDelivery = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmCancel === id) {
        // Fix: await storage call
        await removeDelivery(id);
        loadDeliveries();
        setConfirmCancel(null);
        if (onRefresh) onRefresh();
    } else {
        setConfirmCancel(id);
        setTimeout(() => setConfirmCancel(prev => (prev === id ? null : prev)), 4000);
    }
  };

  const toggleStatus = async (e: React.MouseEvent, delivery: Delivery) => {
    e.stopPropagation();
    const newStage = delivery.deliveryStage === 'active' ? 'paused' : 'active';
    const updatedDelivery: Delivery = { ...delivery, deliveryStage: newStage };
    // Fix: await storage call
    await saveDelivery(updatedDelivery);
    loadDeliveries();
    if (onRefresh) onRefresh();
  };

  const handlePrint = async (e: React.MouseEvent, delivery: Delivery) => {
    e.stopPropagation();
    setDeliveryToPrint(delivery);
    const delay = settings.printSettings?.printDelay || 50;
    setTimeout(() => window.print(), delay);
  };

  const handleEdit = (e: React.MouseEvent, delivery: Delivery) => {
    e.stopPropagation();
    setEditingDelivery(delivery);
    setEditName(delivery.customerName);
    setEditPhone(delivery.phone || '');
    setEditAddress(delivery.address);
    setEditReference(delivery.reference || '');
    setEditChangeFor(delivery.changeFor ? delivery.changeFor.toString() : '');
    setEditPaymentMethod(delivery.paymentMethod || 'Dinheiro');
    setEditCart([...delivery.items]);
    setEditPaid(delivery.isPaid || false);
    setProductSearch('');
    setManualName('');
    setManualPrice('');
  };

  const addToEditCart = (product: Product) => {
    const existing = editCart.find(item => item.productId === product.id && !item.observation);
    if (existing) {
      setEditCart(editCart.map(item => item === existing ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price } : item));
    } else {
      setEditCart([...editCart, { productId: product.id, productName: product.name, quantity: 1, price: product.price, cost: product.cost || 0, subtotal: product.price }]);
    }
    setProductSearch('');
  };

  const adjustEditQty = (productId: string, delta: number, observation?: string) => {
    setEditCart(prev => prev.map(item => {
      if (item.productId === productId && item.observation === observation) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty, subtotal: newQty * item.price } : null;
      }
      return item;
    }).filter(Boolean) as SaleItem[]);
  };

  const handleSaveEdit = async () => {
    if (!editingDelivery) return;
    const newTotal = editCart.reduce((acc, item) => acc + item.subtotal, 0);
    const updatedDelivery: Delivery = { 
        ...editingDelivery, 
        customerName: editName, 
        phone: editPhone.replace(/\D/g, ''), 
        address: editAddress, 
        reference: editReference,
        changeFor: editChangeFor ? Number(editChangeFor) : undefined, 
        paymentMethod: editPaymentMethod, 
        items: editCart, 
        total: newTotal, 
        isPaid: editPaid 
    };
    // Fix: await storage call
    await saveDelivery(updatedDelivery);
    loadDeliveries();
    setEditingDelivery(null);
    if (onRefresh) onRefresh();
  };

  const total = deliveryToFinish ? deliveryToFinish.total : 0;
  const change = Number(amountReceived) > total ? Number(amountReceived) - total : 0;
  const filteredProducts = productSearch.length > 1 ? products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())) : [];

  const formatWhatsAppLink = (phone?: string) => {
    if (!phone) return null;
    const cleanNumber = phone.replace(/\D/g, '');
    return `https://wa.me/55${cleanNumber}`;
  };

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedDeliveries(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6 pb-24" onClick={() => setConfirmCancel(null)}>
      {celebrationBalloons.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
          {celebrationBalloons.map((b) => (
            <div key={b.id} className="absolute bottom-[-150px]" style={{ left: `${b.left}%`, animation: `floatUp ${b.speed}s ease-in forwards`, animationDelay: `${b.delay}s`, transform: `scale(${b.scale})` }}>
              <div className="relative">
                <svg width="60" height="70" viewBox="0 0 60 70" fill="none" style={{ filter: 'drop-shadow(0px 10px 5px rgba(0,0,0,0.1))' }}>
                   <path d="M30 60 Q30 80 40 90" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" fill="none" />
                   <path d="M30 60 C50 60 60 40 60 25 C60 10 45 0 30 0 C15 0 0 10 0 25 C0 40 10 60 30 60 Z" fill={b.color} />
                   <path d="M26 60 L34 60 L30 64 Z" fill={b.color} />
                   <ellipse cx="18" cy="15" rx="6" ry="10" fill="rgba(255,255,255,0.3)" transform="rotate(-30 18 15)" />
                </svg>
              </div>
            </div>
          ))}
          <style>{`@keyframes floatUp { 0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(-120vh) translateX(0) rotate(0deg); opacity: 0; } }`}</style>
        </div>
      )}

      {/* IMPRESSÃO TÉRMICA */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            margin-top: ${settings.printSettings?.margins?.top || 0}px;
            margin-bottom: ${settings.printSettings?.margins?.bottom || 0}px;
            margin-left: ${settings.printSettings?.margins?.left || 0}px;
            margin-right: ${settings.printSettings?.margins?.right || 0}px;
            size: ${settings.printSettings?.thermalPaperSize === '58mm' ? '58mm' : settings.printSettings?.thermalPaperSize === '80mm' ? '80mm' : 'auto'};
          }
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: ${settings.printSettings?.thermalPaperSize === '58mm' ? '58mm' : settings.printSettings?.thermalPaperSize === '80mm' ? '80mm' : '100%'};
            padding: 4mm;
            display: block !important;
          }
          .no-print { display: none !important; }
        }
      `}} />

      <div className="print-only thermal-receipt mx-auto text-black font-mono">
        <div className="text-center mb-2 border-b border-dashed border-black pb-2">
          <h2 className="text-sm font-bold uppercase">{settings.printSettings?.receiptHeader || settings.systemName}</h2>
          {settings.printSettings?.receiptMessage && <p className="text-[8px] font-bold uppercase italic">{settings.printSettings.receiptMessage}</p>}
          <p className="text-[10px] font-black uppercase">Comanda de Entrega</p>
          <p className="text-[8px]">{new Date().toLocaleString('pt-BR')}</p>
        </div>
        
        {deliveryToPrint && (
          <div className="text-left mb-2 text-[9px] space-y-1">
            <p className="text-sm font-black uppercase">Pedido #{deliveryToPrint.displayId}</p>
            <p><strong>CLIENTE:</strong> {deliveryToPrint.customerName}</p>
            <p className="whitespace-normal"><strong>ENDEREÇO:</strong> {deliveryToPrint.address}</p>
            {deliveryToPrint.phone && <p><strong>FONE:</strong> {deliveryToPrint.phone}</p>}
            <p><strong>PAGTO:</strong> {deliveryToPrint.paymentMethod?.toUpperCase()}</p>
            <p className="font-bold">{deliveryToPrint.isPaid ? '✓ JÁ ESTÁ PAGO' : '✖ COBRAR NA ENTREGA'}</p>
          </div>
        )}

        <table className="w-full text-[9px] mb-2 border-t border-black pt-2">
          <thead>
            <tr className="border-b border-black">
              <th className="text-left py-1">ITEM</th>
              <th className="text-center py-1">QTD</th>
              <th className="text-right py-1">VALOR</th>
            </tr>
          </thead>
          <tbody>
            {deliveryToPrint?.items.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-1 uppercase">
                  <div className="leading-tight">{item.productName}</div>
                  {item.observation && <div className="text-[7px] italic">OBS: {item.observation}</div>}
                </td>
                <td className="text-center align-top py-1">{item.quantity}</td>
                <td className="text-right align-top py-1">R${item.subtotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between font-bold text-xs border-t border-black pt-2">
          <span>TOTAL:</span>
          <span>R$ {deliveryToPrint?.total.toFixed(2)}</span>
        </div>

        {!deliveryToPrint?.isPaid && deliveryToPrint?.changeFor && (
          <div className="mt-2 border-t border-dashed border-black pt-2 text-right text-[9px]">
            <p>TROCO PARA: R$ {deliveryToPrint.changeFor.toFixed(2)}</p>
            <p className="font-bold">TROCO: R$ {(deliveryToPrint.changeFor - deliveryToPrint.total).toFixed(2)}</p>
          </div>
        )}

        <div className="text-center mt-6 text-[7px] uppercase font-bold border-t border-black pt-2 opacity-50">
          {settings.printSettings?.receiptFooter || 'P4ZZ SYSTEM - LOGÍSTICA'}
        </div>
      </div>

      <div className="flex justify-between items-center mb-6 no-print">
        <div><h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Gestão de Logística</h3><p className="text-xs font-bold text-slate-500 uppercase mt-1">{deliveries.filter(d => d.deliveryStage === 'active').length} saindo • {deliveries.filter(d => d.deliveryStage === 'paused').length} aguardando</p></div>
        <div className="flex items-center gap-3">
          <div className="relative w-48 md:w-64">
            <input 
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="BUSCAR PEDIDO OU CLIENTE..."
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl font-bold text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-sm"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
          <button onClick={(e) => { e.stopPropagation(); loadDeliveries(); onRefresh && onRefresh(); }} className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition shadow-sm"><svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 no-print">
        {filteredDeliveries.map((delivery, index) => {
          const isPaused = delivery.deliveryStage === 'paused';
          const isConfirmingCancel = confirmCancel === delivery.id;
          const isExpanded = expandedDeliveries[delivery.id];
          const waLink = formatWhatsAppLink(delivery.phone);

          return (
            <div key={delivery.id} className={`relative rounded-[2.5rem] p-6 shadow-xl flex flex-col justify-between transition-all duration-300 ${isPaused ? 'bg-amber-50 dark:bg-slate-900/50 border-2 border-amber-200 dark:border-amber-900/30' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'} hover:shadow-2xl`}>
              <div className={`absolute top-0 left-0 w-full h-1.5 rounded-t-full ${isPaused ? 'bg-amber-400' : 'bg-emerald-500'}`}></div>
              
              <div className="space-y-5 flex-1 flex flex-col">
                {/* Header do Card */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3 w-full relative">
                    <div className="flex flex-col gap-1 mr-1 shrink-0">
                      <button onClick={(e) => handleMove(e, delivery.id, 'up')} disabled={index === 0} className="text-slate-300 hover:text-indigo-500 disabled:opacity-0 transition-colors p-1"><ChevronUp className="w-4 h-4" /></button>
                      <button onClick={(e) => handleMove(e, delivery.id, 'down')} disabled={index === deliveries.length - 1} className="text-slate-300 hover:text-indigo-500 disabled:opacity-0 transition-colors p-1"><ChevronDown className="w-4 h-4" /></button>
                    </div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base shadow-lg shrink-0 ${isPaused ? 'bg-amber-100 text-amber-700' : 'bg-slate-900 text-white dark:bg-slate-700'}`}>#{delivery.displayId}</div>
                    <div className="flex-1 min-w-0 pr-12">
                      <h4 className="font-black text-base uppercase text-slate-900 dark:text-white truncate leading-tight">{delivery.customerName}</h4>
                      <div className="flex items-center gap-1 text-slate-400 mt-1">
                        <Clock className="w-3 h-3" />
                        <span className="text-[9px] font-bold uppercase">{new Date(delivery.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <div className="absolute top-0 right-0 flex gap-2">
                      <button onClick={(e) => handleEdit(e, delivery)} className="p-2 text-slate-400 hover:text-amber-500 bg-slate-50 dark:bg-slate-800 rounded-xl transition-all border border-slate-100 dark:border-slate-700 shadow-sm active:scale-90"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2} /></svg></button>
                      <button onClick={(e) => handlePrint(e, delivery)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 dark:bg-slate-800 rounded-xl transition-all border border-slate-100 dark:border-slate-700 shadow-sm active:scale-90"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeWidth={2} /></svg></button>
                    </div>
                  </div>
                </div>

                {/* Status e Ações Rápidas */}
                <div className="flex justify-between items-center">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50">{delivery.paymentMethod || 'DINHEIRO'}</span>
                    {delivery.isPaid ? (
                      <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border border-emerald-200/50 dark:border-emerald-800/50 flex items-center gap-1">✓ PAGO</span>
                    ) : (
                      <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border border-rose-200/50 dark:border-rose-800/50 flex items-center gap-1">✖ COBRAR</span>
                    )}
                  </div>
                  <button 
                    onClick={(e) => toggleStatus(e, delivery)} 
                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all active:scale-95 ${isPaused ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}
                  >
                    {isPaused ? '▶ Ativar' : '⏸ Pausar'}
                  </button>
                </div>

                {/* Bloco de Endereço */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-3xl border border-slate-100 dark:border-slate-800/50 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Endereço de Entrega</p>
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-relaxed whitespace-normal">{delivery.address}</p>
                      {delivery.reference && (
                        <p className="text-[9px] font-medium text-slate-500 italic mt-1">Ref: {delivery.reference}</p>
                      )}
                    </div>
                  </div>

                  {/* Bloco de Telefone / WhatsApp */}
                  {delivery.phone && (
                    <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                          <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">{delivery.phone}</span>
                      </div>
                      {waLink && (
                        <a 
                          href={waLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Lista de Produtos */}
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800/50 overflow-hidden">
                  <button 
                    onClick={(e) => toggleExpand(e, delivery.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-slate-400" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Itens do Pedido ({delivery.items.length})</span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  
                  <div className={`px-4 pb-4 space-y-2 transition-all duration-300 ${isExpanded ? 'max-h-[500px] opacity-100 pt-1' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                    {delivery.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700/50 last:border-0 pb-1.5 last:pb-0">
                        <span className="flex-1 mr-2">{item.quantity}x {item.productName}</span>
                        <span className="text-slate-900 dark:text-slate-200">R$ {item.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  
                  {!isExpanded && delivery.items.length > 0 && (
                    <div className="px-4 pb-3">
                      <p className="text-[10px] font-bold text-slate-400 truncate uppercase">
                        {delivery.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Rodapé do Card */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
                <div className="flex justify-between items-end mb-5">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total do Pedido</span>
                    {delivery.changeFor && !delivery.isPaid && (
                      <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                        Troco p/ R$ {delivery.changeFor.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-black text-slate-900 dark:text-white italic tracking-tighter">R$ {delivery.total.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={(e) => handleCancelDelivery(e, delivery.id)} 
                    className={`py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${isConfirmingCancel ? 'bg-rose-600 text-white border-rose-600 shadow-lg shadow-rose-500/20' : 'border-rose-100 dark:border-rose-900/30 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30'}`}
                  >
                    {isConfirmingCancel ? 'Confirmar?' : 'Cancelar'}
                  </button>
                  <button 
                    onClick={(e) => handleStartFinish(e, delivery)} 
                    style={{ backgroundColor: settings.primaryColor }} 
                    className={`py-4 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all hover:brightness-110`}
                  >
                    Concluir
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE EDIÇÃO */}
      {editingDelivery && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[250] p-4 animate-in fade-in duration-300 no-print">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-5xl overflow-hidden border border-white/10 flex flex-col max-h-[90vh]">
              {/* HEADER COM BOTÃO VOLTAR PARA MOBILE */}
              <div className="md:hidden flex items-center justify-between p-4 border-b dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                <button 
                  onClick={() => setEditingDelivery(null)}
                  className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px] tracking-widest"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                  </svg>
                  Voltar
                </button>
                <span className="text-[10px] font-black uppercase text-indigo-500 italic">
                  Editar Pedido #{editingDelivery.displayId}
                </span>
              </div>
              <div className="p-6 border-b bg-slate-50 dark:bg-slate-950 flex justify-between items-center"><div><h3 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">Editar Pedido</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">#{editingDelivery.displayId}</p></div><button onClick={() => setEditingDelivery(null)} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100 dark:border-slate-700"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                 <div className="space-y-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-500 ml-2">Dados do Cliente</h4>
                     <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome do Cliente" className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500" />
                          <input 
                            value={editPhone} 
                            onChange={e => {
                                const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                                let formatted = v;
                                if (v.length > 0) {
                                    if (v.length <= 10) {
                                        formatted = v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
                                    } else {
                                        formatted = v.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
                                    }
                                }
                                setEditPhone(formatted);
                            }} 
                            placeholder="Telefone (WhatsApp)" 
                            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500" 
                          />
                        </div>
                        <input value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="Endereço Completo" className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500" />
                        <input value={editReference} onChange={e => setEditReference(e.target.value)} placeholder="Referência (Ex: Próximo ao mercado)" className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500" />
                        <div className="grid grid-cols-2 gap-3">
                            <select 
                                value={editPaymentMethod} 
                                onChange={e => setEditPaymentMethod(e.target.value as any)}
                                className="w-full px-4 py-3 bg-white dark:bg-slate-900 rounded-xl text-xs font-black uppercase outline-none border border-slate-200 dark:border-slate-700"
                            >
                                <option value="Dinheiro">DINHEIRO</option>
                                <option value="Pix">PIX</option>
                                <option value="Cartão">CARTÃO</option>
                            </select>
                            <input type="number" value={editChangeFor} onChange={e => setEditChangeFor(e.target.value)} placeholder="Troco Para" className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div onClick={() => setEditPaid(!editPaid)} className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${editPaid ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}><span className={`text-[10px] font-black uppercase tracking-widest ${editPaid ? 'text-emerald-500' : 'text-slate-400'}`}>Pedido já está pago?</span><div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${editPaid ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>{editPaid && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth={4}/></svg>}</div></div>
                    </div>
                 </div>
                 <div className="space-y-3"><h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-500 ml-2">Itens do Pedido</h4>{editCart.map((item, idx) => (<div key={idx} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800"><div className="flex-1 pr-2"><div className="text-[10px] font-black uppercase text-slate-900 dark:text-white leading-tight">{item.productName}</div><div className="text-[9px] font-bold text-slate-500 mt-0.5">R$ {item.subtotal.toFixed(2)}</div></div><div className="flex items-center gap-2"><div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border p-0.5"><button onClick={() => adjustEditQty(item.productId, -1, item.observation)} className="w-6 h-6 flex items-center justify-center font-black text-sm">-</button><span className="px-2 text-[10px] font-black">{item.quantity}</span><button onClick={() => adjustEditQty(item.productId, 1, item.observation)} className="w-6 h-6 flex items-center justify-center font-black text-sm">+</button></div></div></div>))}</div>
              </div>
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 space-y-4"><div className="flex justify-between items-end"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Novo Total</span><span className="text-3xl font-black text-slate-900 dark:text-white italic tracking-tighter">R$ {editCart.reduce((acc, item) => acc + item.subtotal, 0).toFixed(2)}</span></div><button onClick={handleSaveEdit} style={{ backgroundColor: settings.primaryColor }} className="w-full py-4 rounded-2xl text-white font-black uppercase text-[10px] tracking-[0.2em] shadow-xl active:scale-95 transition-all">Salvar Alterações</button></div>
           </div>
        </div>
      )}

      {/* Modal Pagamento */}
      {deliveryToFinish && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300 no-print">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-5xl overflow-hidden border border-white/10 flex flex-col max-h-[90vh]">
              {/* HEADER COM BOTÃO VOLTAR PARA MOBILE */}
              <div className="md:hidden flex items-center justify-between p-4 border-b dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                <button 
                  onClick={closePaymentModal}
                  className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px] tracking-widest"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                  </svg>
                  Voltar
                </button>
                <span className="text-[10px] font-black uppercase text-indigo-500 italic">
                  Finalizar Entrega #{deliveryToFinish.displayId}
                </span>
              </div>
              <div className="p-8 border-b bg-slate-50 dark:bg-slate-950 flex justify-between items-center"><div><h3 className="text-lg font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">Finalizar Entrega</h3><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pedido #{deliveryToFinish.displayId}</p></div><button onClick={closePaymentModal} className="p-3 bg-white dark:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500 shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button></div>
              <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                 <div className="text-center py-8 bg-slate-50 dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700"><span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-1">Valor Total</span><span className="text-5xl font-black italic tracking-tighter text-slate-900 dark:text-white">R$ {total.toFixed(2)}</span></div>
                 {!showCashFlow ? (
                    <div className="space-y-3"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Confirmar Forma de Pagamento</p><div className="grid grid-cols-1 gap-3">{['Pix', 'Cartão', 'Dinheiro'].map((m) => (<button key={m} onClick={() => selectPayment(m as any)} className={`flex items-center justify-between px-6 py-4 rounded-2xl border-2 font-black uppercase text-xs tracking-widest transition-all ${paymentMethod === m ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500'}`}>{m}{paymentMethod === m && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</button>))}</div></div>
                 ) : (
                    <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                       <div className="space-y-2"><label className="text-[10px] font-black text-slate-500 uppercase ml-4 tracking-widest">Valor Recebido</label><input type="number" autoFocus value={amountReceived} onChange={e => setAmountReceived(e.target.value)} className="w-full px-8 py-6 bg-slate-50 dark:bg-slate-800 rounded-[2.5rem] font-black text-4xl outline-none border-2 border-slate-100 dark:border-slate-700 focus:border-emerald-500 text-center" placeholder="0.00" /></div>
                       <div className="space-y-2 text-center"><label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Troco Calculado</label><div className="w-full py-6 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 font-black text-4xl rounded-[2.5rem] border-2 border-emerald-100 dark:border-emerald-900/40 italic tracking-tighter">R$ {change.toFixed(2)}</div></div><button onClick={() => { setShowCashFlow(false); setPaymentMethod(null); }} className="w-full py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600">Alterar Método</button>
                    </div>
                 )}
              </div>
              <div className="p-8 pt-0"><button onClick={finalizeDelivery} disabled={isFinishing || !paymentMethod || (paymentMethod === 'Dinheiro' && Number(amountReceived) < total)} style={{ backgroundColor: settings.primaryColor }} className="w-full py-6 rounded-[2rem] text-white font-black uppercase text-[11px] tracking-[0.2em] shadow-xl active:scale-95 transition-all disabled:opacity-50">{isFinishing ? 'Processando...' : 'Confirmar Recebimento'}</button></div>
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
        }
      `}</style>
    </div>
  );
};

export default Deliveries;
