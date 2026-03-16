
import React, { useState, useEffect, useCallback } from 'react';
import { KDSOrder, AppSettings } from '../types';
import { getKDSOrders, saveKDSOrder, deleteKDSOrder, notifyDataChanged } from '../services/storage';
import { Clock, CheckCircle2, PlayCircle, Package, Timer } from 'lucide-react';

interface KDSProps {
  settings: AppSettings;
}

const KDS: React.FC<KDSProps> = ({ settings }) => {
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadOrders = useCallback(async () => {
    const kdsOrders = await getKDSOrders();
    
    // Filtrar entregues se configurado
    const filteredOrders = kdsOrders.filter(o => 
      settings.kdsShowDeliveredOrders ? true : o.status !== 'delivered'
    );
    
    const sortedOrders = filteredOrders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    // Notificação sonora se houver novos pedidos
    if (settings.kdsSoundNotification && orders.length > 0 && sortedOrders.length > orders.length) {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2431/2431-preview.mp3');
      audio.play().catch(() => {});
    }

    setOrders(sortedOrders);
    setIsLoading(false);
  }, [settings.kdsSoundNotification, settings.kdsShowDeliveredOrders, orders.length]);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, (settings.kdsAutoRefreshInterval || 10) * 1000);
    return () => clearInterval(interval);
  }, [loadOrders, settings.kdsAutoRefreshInterval]);

  const getFontSizeClass = () => {
    switch (settings.kdsFontSize) {
      case 'small': return 'text-[10px]';
      case 'large': return 'text-sm';
      default: return 'text-xs';
    }
  };

  const updateStatus = async (order: KDSOrder, newStatus: KDSOrder['status']) => {
    const updatedOrder = { ...order, status: newStatus };
    if (newStatus === 'preparing') {
      updatedOrder.preparationStartTime = new Date().toISOString();
    } else if (newStatus === 'ready') {
      updatedOrder.preparationEndTime = new Date().toISOString();
    }
    
    await saveKDSOrder(updatedOrder);
    loadOrders();
    notifyDataChanged();
  };

  const getStatusColor = (status: KDSOrder['status']) => {
    switch (status) {
      case 'preparing': return 'bg-amber-500';
      case 'ready': return 'bg-emerald-500';
      case 'delivered': return 'bg-indigo-500';
      default: return 'bg-slate-500';
    }
  };

  const getStatusLabel = (status: KDSOrder['status']) => {
    switch (status) {
      case 'preparing': return 'EM PREPARAÇÃO';
      case 'ready': return 'PRONTO';
      case 'delivered': return 'ENTREGUE';
      default: return 'NOVO PEDIDO';
    }
  };

  const getTimeElapsed = (date: string) => {
    const start = new Date(date).getTime();
    const now = new Date().getTime();
    const diff = Math.floor((now - start) / 60000);
    return `${diff} min`;
  };

  const getGridCols = () => {
    const cols = settings.kdsOrdersPerRow || 4;
    return `grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(cols, 4)} xl:grid-cols-${cols}`;
  };

  const getCardPadding = () => {
    switch (settings.kdsCardSize) {
      case 'small': return 'p-3';
      case 'large': return 'p-8';
      default: return 'p-6';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white flex items-center gap-3">
            <Timer className="w-8 h-8 text-indigo-600" />
            Monitor de Preparo (KDS)
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Gestão de pedidos em tempo real na cozinha</p>
        </div>
        <div className="flex gap-4">
          <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-black uppercase text-slate-500">Total em Fila: {orders.filter(o => o.status !== 'delivered').length}</span>
          </div>
        </div>
      </div>

      <div className={`grid gap-6 ${getGridCols()}`}>
        {orders.map(order => (
          <div key={order.id} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden flex flex-col">
            <div className={`p-4 flex items-center justify-between ${getStatusColor(order.status)}`}>
              <div className="flex items-center gap-2 text-white">
                <Clock className="w-4 h-4" />
                {settings.kdsShowOrderTime && (
                  <span className="text-[10px] font-black uppercase tracking-widest">{getTimeElapsed(order.createdAt)}</span>
                )}
              </div>
              {settings.kdsShowTableOrDirect && (
                <span className="text-[10px] font-black uppercase tracking-widest text-white bg-black/20 px-2 py-1 rounded-lg">
                  {order.type === 'table' ? `MESA ${order.tableLabel}` : 'VENDA DIRETA'}
                </span>
              )}
            </div>

            <div className={`${getCardPadding()} flex-1 space-y-4`}>
              <div className="flex justify-between items-start">
                {settings.kdsShowOrderNumber && (
                  <span className="text-[11px] font-black text-slate-400 uppercase">Pedido #{order.orderNumber || order.id.slice(0, 6)}</span>
                )}
                <span className="text-[10px] font-black text-indigo-600 uppercase">{getStatusLabel(order.status)}</span>
              </div>

              <div className="space-y-3">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start gap-4">
                    <div className="flex gap-2">
                      <span className="text-xs font-black text-white bg-indigo-600 px-1.5 rounded-md">{item.quantity}x</span>
                      <div className="space-y-0.5">
                        <p className={`${getFontSizeClass()} font-bold uppercase text-slate-700 dark:text-slate-200`}>{item.productName}</p>
                        {item.observation && (
                          <p className="text-[9px] font-bold text-rose-500 uppercase italic">Obs: {item.observation}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-2">
              {order.status === 'pending' && (
                <button 
                  onClick={() => updateStatus(order, 'preparing')}
                  className="col-span-2 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <PlayCircle className="w-4 h-4" />
                  Iniciar Preparo
                </button>
              )}
              {order.status === 'preparing' && (
                <button 
                  onClick={() => updateStatus(order, 'ready')}
                  className="col-span-2 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Marcar como Pronto
                </button>
              )}
              {order.status === 'ready' && (
                <button 
                  onClick={() => updateStatus(order, 'delivered')}
                  className="col-span-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  Entregar Pedido
                </button>
              )}
              {order.status === 'delivered' && (
                <button 
                  onClick={() => deleteKDSOrder(order.id).then(loadOrders)}
                  className="col-span-2 py-3 bg-slate-500 hover:bg-slate-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  Remover da Tela
                </button>
              )}
            </div>
          </div>
        ))}

        {orders.length === 0 && (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto">
              <Timer className="w-10 h-10 text-slate-300" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-black text-slate-400 uppercase">Nenhum pedido na fila</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase italic">Aguardando novos pedidos da frente de caixa...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default KDS;
