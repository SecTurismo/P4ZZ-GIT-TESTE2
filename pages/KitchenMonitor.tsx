
import React, { useState, useEffect, useCallback } from 'react';
import { KDSOrder, AppSettings } from '../types';
import { getKDSOrders, getAppSettings, notifyDataChanged } from '../services/storage';
import { Clock, Timer, Monitor, Tv, Info, Maximize, Minimize } from 'lucide-react';

const KitchenMonitor: React.FC = () => {
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const loadData = useCallback(async () => {
    const kdsOrders = await getKDSOrders();
    const appSettings = await getAppSettings(); // Uses active tenant
    
    setSettings(appSettings);
    
    // Filter out delivered orders if configured
    const filteredOrders = kdsOrders.filter(o => 
      appSettings.kdsShowDeliveredOrders ? true : o.status !== 'delivered'
    );
    
    // Priority sorting: 1. pending, 2. preparing, 3. ready, 4. delivered
    // Within same status, oldest first
    const statusPriority = {
      'pending': 1,
      'preparing': 2,
      'ready': 3,
      'delivered': 4
    };

    const sortedOrders = filteredOrders.sort((a, b) => {
      const pA = statusPriority[a.status] || 99;
      const pB = statusPriority[b.status] || 99;
      
      if (pA !== pB) return pA - pB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    
    // Sound notification for new orders
    if (appSettings.kdsSoundNotification && orders.length > 0 && sortedOrders.length > orders.length) {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2431/2431-preview.mp3');
      audio.play().catch(() => {});
    }

    setOrders(sortedOrders);
    setIsLoading(false);
  }, [orders.length]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Faster refresh for monitor
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    
    const handleUpdate = () => loadData();
    window.addEventListener('p4zz_data_updated', handleUpdate);

    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
      window.removeEventListener('p4zz_data_updated', handleUpdate);
    };
  }, [loadData]);

  const getFontSizeClass = () => {
    if (!settings) return 'text-xl';
    switch (settings.kdsFontSize) {
      case 'small': return 'text-lg';
      case 'large': return 'text-3xl';
      default: return 'text-2xl';
    }
  };

  const getTimeElapsed = (date: string) => {
    const start = new Date(date).getTime();
    const now = new Date().getTime();
    const diff = Math.floor((now - start) / 60000);
    return `${diff} min`;
  };

  const getStatusColor = (status: KDSOrder['status']) => {
    switch (status) {
      case 'preparing': return 'bg-amber-500';
      case 'ready': return 'bg-emerald-500';
      case 'delivered': return 'bg-indigo-500';
      default: return 'bg-slate-600';
    }
  };

  const getGridCols = () => {
    if (!settings) return 'grid-cols-4';
    const cols = settings.kdsOrdersPerRow || 4;
    return `grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(cols, 4)} xl:grid-cols-${cols}`;
  };

  if (isLoading || !settings) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-500"></div>
        <p className="text-sm font-black uppercase tracking-[0.3em] animate-pulse">Iniciando Monitor de Cozinha...</p>
      </div>
    );
  }

  const isDark = settings.kdsTheme !== 'light';

  return (
    <div className={`fixed inset-0 ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'} overflow-hidden flex flex-col font-sans transition-colors duration-500`}>
      {/* Header */}
      <header className={`h-20 ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-200'} border-b flex items-center justify-between px-8 shrink-0 shadow-sm`}>
        <div className="flex items-center gap-4">
          {settings.logoUrl ? (
            <img 
              src={settings.logoUrl} 
              alt="Logo" 
              className="h-12 w-auto object-contain rounded-lg"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Monitor className="w-7 h-7 text-white" />
            </div>
          )}
          <div>
            <h1 className={`text-2xl font-black uppercase tracking-tighter italic ${isDark ? 'text-white' : 'text-slate-800'}`}>
              {settings.kdsTitle 
                ? `${settings.kdsTitle} - Monitor de Pedidos` 
                : settings.systemName}
            </h1>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Monitor de Pedidos em Tempo Real</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className={`text-2xl font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-800'}`}>{currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{currentTime.toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
          </div>
          <div className={`h-10 w-px ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}></div>
          <div className={`${isDark ? 'bg-slate-800 border-white/5' : 'bg-slate-100 border-slate-200'} px-6 py-2 rounded-2xl border`}>
            <p className="text-[10px] font-black uppercase text-slate-400 mb-0.5">Pedidos em Fila</p>
            <p className="text-xl font-black text-indigo-400">{orders.filter(o => o.status !== 'delivered').length}</p>
          </div>
          {settings.kdsFullscreenMode && (
            <button 
              onClick={toggleFullscreen}
              className={`${isDark ? 'bg-slate-800 border-white/5 hover:bg-slate-700' : 'bg-white border-slate-200 hover:bg-slate-50'} p-3 rounded-2xl border transition-all active:scale-95 shadow-sm`}
              title={isFullscreen ? "Sair da Tela Cheia" : "Entrar em Tela Cheia"}
            >
              {isFullscreen ? <Minimize className={`w-6 h-6 ${isDark ? 'text-white' : 'text-slate-600'}`} /> : <Maximize className={`w-6 h-6 ${isDark ? 'text-white' : 'text-slate-600'}`} />}
            </button>
          )}
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 p-6 overflow-y-auto scrollbar-hide">
        <div className={`grid gap-6 ${getGridCols()}`}>
          {orders.map(order => (
            <div key={order.id} className={`${isDark ? 'bg-slate-900 border-white/5 shadow-2xl' : 'bg-white border-slate-200 shadow-lg'} rounded-[2.5rem] border overflow-hidden flex flex-col animate-in zoom-in-95 duration-300`}>
              <div className={`p-5 flex items-center justify-between ${getStatusColor(order.status)}`}>
                <div className="flex items-center gap-3 text-white">
                  <Clock className="w-5 h-5" />
                  <span className="text-lg font-black uppercase tracking-widest">{getTimeElapsed(order.createdAt)}</span>
                </div>
                {settings.kdsShowTableOrDirect && (
                  <span className="text-xs font-black uppercase tracking-widest bg-black/20 px-4 py-1.5 rounded-xl text-white">
                    {order.type === 'table' ? `MESA ${order.tableLabel}` : 'VENDA DIRETA'}
                  </span>
                )}
              </div>

              <div className="p-8 flex-1 space-y-6">
                <div className={`flex justify-between items-center border-b ${isDark ? 'border-white/5' : 'border-slate-100'} pb-4`}>
                  {settings.kdsShowOrderNumber && (
                    <span className={`text-sm font-black ${isDark ? 'text-slate-500' : 'text-slate-400'} uppercase`}>Pedido #{order.orderNumber || order.id.slice(0, 6)}</span>
                  )}
                  <span className={`px-3 py-1 ${isDark ? 'bg-white/5' : 'bg-slate-50'} rounded-lg text-[10px] font-black text-indigo-400 uppercase tracking-widest`}>
                    {order.status === 'pending' ? 'NOVO PEDIDO' : order.status === 'preparing' ? 'EM PREPARAÇÃO' : 'PRONTO'}
                  </span>
                </div>

                <div className="space-y-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex gap-4 items-start">
                      <span className="text-2xl font-black text-white bg-indigo-600 px-2 rounded-lg mt-1">{item.quantity}x</span>
                      <div className="space-y-1">
                        <p className={`${getFontSizeClass()} font-black uppercase leading-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{item.productName}</p>
                        {item.observation && (
                          <div className="flex items-center gap-2 text-rose-500">
                            <Info className="w-4 h-4 shrink-0" />
                            <p className="text-xs font-black uppercase italic tracking-tight">{item.observation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Progress Bar simulation */}
              <div className={`h-1.5 ${isDark ? 'bg-white/5' : 'bg-slate-100'} w-full`}>
                <div 
                  className={`h-full transition-all duration-1000 ${order.status === 'preparing' ? 'bg-amber-500 animate-pulse' : order.status === 'ready' ? 'bg-emerald-500' : 'bg-slate-500'}`}
                  style={{ width: order.status === 'pending' ? '10%' : order.status === 'preparing' ? '60%' : '100%' }}
                ></div>
              </div>
            </div>
          ))}

          {orders.length === 0 && (
            <div className="col-span-full h-[60vh] flex flex-col items-center justify-center space-y-6 opacity-30">
              <div className={`w-32 h-32 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} rounded-full flex items-center justify-center`}>
                <Tv className={`w-16 h-16 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
              </div>
              <div className="text-center space-y-2">
                <p className={`text-2xl font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-800'}`}>Nenhum pedido na fila</p>
                <p className="text-sm font-bold uppercase italic text-slate-400">Aguardando novos pedidos...</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className={`h-12 ${isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-200'} border-t flex items-center justify-between px-8 shrink-0`}>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-600"></div>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Pendente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Em Preparo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Pronto</span>
          </div>
        </div>
        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-600">Sistema de Monitoramento de Cozinha v2.0</p>
      </footer>
    </div>
  );
};

export default KitchenMonitor;
