
import React, { useState, useMemo, useEffect } from 'react';
import { Product, Sale, Expense, ConsumptionRecord, Table, Customer, Category, View, AppSettings, Addon } from '../types';
import { getCurrentUser, getConsumptions } from '../services/storage';
import { getAIPredictions } from '../services/aiAnalysisService';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { Search, PlusCircle, ShoppingCart, Users, LayoutGrid, ArrowRight, Package, Table as TableIcon, Keyboard, LifeBuoy, BrainCircuit, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';
import { getCategoryIcon } from '../src/utils/categoryIcons';

interface DashboardProps {
  products: Product[];
  addons: Addon[];
  sales: Sale[];
  expenses: Expense[];
  tables: Table[];
  customers: Customer[];
  categories: Category[];
  onNavigate: (view: View) => void;
  settings: AppSettings;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  products, addons, sales, expenses, tables, customers, categories, onNavigate, settings 
}) => {
  const user = useMemo(() => getCurrentUser(), []);
  const isEmployee = user?.role === 'employee';
  
  const [period, setPeriod] = useState<'today' | 'yesterday' | '7d' | 'all'>('today');
  const [myConsumptions, setMyConsumptions] = useState<ConsumptionRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isEmployee && user) {
        getConsumptions().then(all => {
            const filtered = all.filter(c => c.userId === user.id);
            setMyConsumptions(filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        });
    }
  }, [isEmployee, user]);

  const filterByPeriod = (item: { date: string }) => {
    const itemDate = new Date(item.date);
    const itemDayStr = itemDate.toLocaleDateString('en-CA');
    const todayStr = new Date().toLocaleDateString('en-CA');

    if (period === 'today') return itemDayStr === todayStr;
    if (period === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return itemDayStr === yesterday.toLocaleDateString('en-CA');
    }
    if (period === '7d') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return itemDate >= weekAgo;
    }
    return true;
  };

  const filteredSales = sales.filter(filterByPeriod);
  const filteredExpenses = expenses.filter(filterByPeriod);
  const totalRevenue = filteredSales.reduce((acc, s) => acc + s.total, 0);
  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const totalProfit = totalRevenue - totalExpenses;
  const lowStock = products.filter(p => p.stock < 5).length;

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();

    const matchedProducts = products.filter(p => 
      p.name.toLowerCase().includes(query) || (p.barcode && p.barcode.includes(query))
    ).slice(0, 5);

    const matchedTables = (settings.tablesSystemEnabled !== false && user?.canAccessTables !== false) 
      ? tables.filter(t => 
          t.label.toLowerCase().includes(query) || t.id.toString() === query
        ).slice(0, 5)
      : [];

    const matchedSales = sales.filter(s => 
      s.id.toLowerCase().includes(query) || (s.deliveryInfo?.customerName || '').toLowerCase().includes(query)
    ).slice(0, 5);

    const matchedCustomers = customers.filter(c => 
      c.name.toLowerCase().includes(query) || c.phone.includes(query)
    ).slice(0, 5);

    const matchedCategories = categories.filter(c => 
      c.name.toLowerCase().includes(query)
    ).slice(0, 5);

    return {
      products: matchedProducts,
      tables: matchedTables,
      sales: matchedSales,
      customers: matchedCustomers,
      categories: matchedCategories,
      hasResults: matchedProducts.length > 0 || matchedTables.length > 0 || matchedSales.length > 0 || matchedCustomers.length > 0 || matchedCategories.length > 0
    };
  }, [searchQuery, products, tables, sales, customers, categories]);

  const chartData = useMemo(() => {
    if (period === 'today' || period === 'yesterday') {
      const targetDate = new Date();
      if (period === 'yesterday') targetDate.setDate(targetDate.getDate() - 1);
      const targetStr = targetDate.toLocaleDateString('en-CA');

      return Array.from({ length: 24 }, (_, i) => {
        const hourTotal = sales
          .filter(s => {
            const sDate = new Date(s.date);
            return sDate.toLocaleDateString('en-CA') === targetStr && sDate.getHours() === i;
          })
          .reduce((acc, s) => acc + s.total, 0);
        return { name: `${i}h`, vendas: hourTotal };
      });
    }

    if (period === '7d') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toLocaleDateString('en-CA');
        const daySales = sales.filter(s => new Date(s.date).toLocaleDateString('en-CA') === dateStr);
        return {
          name: d.toLocaleDateString('pt-BR', { weekday: 'short' }),
          vendas: daySales.reduce((acc, s) => acc + s.total, 0)
        };
      });
    }
    return [];
  }, [sales, period]);

  const DEFAULT_LABELS: Record<string, string> = {
    'dashboard': 'PAINEL',
    'tables': 'MESAS',
    'new-sale': 'VENDA DIRETA',
    'deliveries': 'ENTREGAS',
    'products': 'ESTOQUE',
    'categories': 'CATEGORIAS',
    'addons': 'COMPLEMENTOS',
    'fiados': 'FIADOS',
    'sales-history': 'HISTÓRICO',
    'reports': 'RELATÓRIOS',
    'my-plan': 'MEU PLANO',
    'payment': 'PAGAMENTO',
    'user-management': 'USUÁRIOS',
    'customer-management': 'LICENÇAS',
    'plan-management': 'PLANOS',
    'settings': 'CONFIGURAÇÕES',
    'employee-management': 'FUNCIONÁRIOS',
    'support': 'SUPORTE',
    'affiliates': 'AFILIADOS'
  };

  const t = (id: View | string, def: string) => settings.customLabels?.[`menu_${id}`] || def;

  const aiPredictions = useMemo(() => {
    return getAIPredictions(settings.aiSettings, products, sales, addons);
  }, [settings.aiSettings, products, sales, addons]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* PESQUISA GLOBAL */}
      <div className="relative z-50">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisa Global: Produtos, Mesas, Pedidos, Clientes..."
            className="block w-full pl-14 pr-4 py-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] text-sm font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
          />
        </div>

        {searchResults && searchResults.hasResults && (
          <div className="absolute mt-3 w-full bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in slide-in-from-top-2 duration-200 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="p-4 space-y-6">
              {searchResults.products.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-3 ml-2">Produtos</h5>
                  <div className="space-y-1">
                    {searchResults.products.map(p => (
                      <button key={p.id} onClick={() => onNavigate('products')} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
                            <Package className="w-4 h-4 text-slate-500" />
                          </div>
                          <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">{p.name}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.tables.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-3 ml-2">Mesas</h5>
                  <div className="space-y-1">
                    {searchResults.tables.map(t => (
                      <button key={t.id} onClick={() => onNavigate('tables')} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
                            <TableIcon className="w-4 h-4 text-slate-500" />
                          </div>
                          <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">Mesa {t.label}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.sales.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-3 ml-2">Pedidos</h5>
                  <div className="space-y-1">
                    {searchResults.sales.map(s => (
                      <button key={s.id} onClick={() => onNavigate('sales-history')} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
                            <ShoppingCart className="w-4 h-4 text-slate-500" />
                          </div>
                          <div className="flex flex-col items-start">
                            <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">Pedido #{s.id.slice(0, 6)}</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase">{s.deliveryInfo?.customerName || 'Venda Direta'}</span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.customers.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-3 ml-2">Clientes</h5>
                  <div className="space-y-1">
                    {searchResults.customers.map(c => (
                      <button key={c.id} onClick={() => onNavigate('customer-management')} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
                            <Users className="w-4 h-4 text-slate-500" />
                          </div>
                          <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">{c.name}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.categories.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-3 ml-2">Categorias</h5>
                  <div className="space-y-1">
                    {searchResults.categories.map(c => (
                      <button key={c.id} onClick={() => onNavigate('categories')} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
                            {getCategoryIcon(c.name, c.icon)}
                          </div>
                          <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">{c.name}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* AÇÕES RÁPIDAS */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-2 italic">Ações Rápidas</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { id: 'tables', icon: TableIcon, color: 'bg-amber-500' },
            { id: 'new-sale', icon: ShoppingCart, color: 'bg-indigo-600' },
            { id: 'deliveries', icon: Package, color: 'bg-emerald-600' },
            { id: 'support', icon: LifeBuoy, color: 'bg-blue-500' }
          ].filter(action => {
            if (action.id === 'tables') {
              return settings.tablesSystemEnabled !== false && user?.canAccessTables !== false;
            }
            return true;
          }).map((action, i) => {
            const label = t(action.id, DEFAULT_LABELS[action.id] || action.id);
            
            const shortcut = settings.menuShortcuts?.[action.id];

            return (
              <button
                key={i}
                onClick={() => onNavigate(action.id as View)}
                className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group"
              >
                <div className={`${action.color} p-4 rounded-2xl text-white mb-3 shadow-lg group-hover:scale-110 transition-transform`}>
                  <action.icon className="w-6 h-6" />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 text-center">{label}</span>
                  {shortcut && (
                    <span className="text-[9px] font-black text-indigo-500 uppercase mt-0.5 tracking-tighter opacity-70">{shortcut}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {isEmployee ? (
        <div className="space-y-6">
           <div className="bg-slate-900 p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl text-white relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="relative z-10 text-center md:text-left">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-2">Interface Operacional</h3>
                 <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter truncate max-w-xs md:max-w-none">Olá, {user?.name.split(' ')[0]}</h2>
              </div>
              <div className="flex gap-4 w-full md:w-auto">
                 <div className="flex-1 md:flex-none bg-white/10 p-6 rounded-[2rem] border border-white/5 backdrop-blur-sm text-center">
                    <p className="text-[8px] font-black uppercase tracking-widest text-indigo-300 mb-1">Seu Desempenho</p>
                    <p className="text-2xl font-black italic tracking-tighter text-emerald-400">R$ {filteredSales.filter(s => s.userId === user?.id).reduce((acc, s) => acc + s.total, 0).toFixed(2)}</p>
                 </div>
              </div>
           </div>

           <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="p-6 md:p-8 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Meus Gastos Internos</h4>
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                 <table className="w-full text-left min-w-[600px] md:min-w-full">
                    <thead className="bg-slate-50 dark:bg-slate-950 border-b">
                        <tr>
                            <th className="px-4 md:px-10 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Produto</th>
                            <th className="px-4 md:px-10 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Data e Hora</th>
                            <th className="px-4 md:px-10 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Qtd</th>
                            <th className="px-4 md:px-10 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {myConsumptions.length === 0 ? (
                            <tr><td colSpan={4} className="py-20 text-center opacity-30 italic font-black uppercase text-[10px] tracking-widest">Nenhum gasto registrado</td></tr>
                        ) : (
                            myConsumptions.map(c => (
                                <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                                    <td className="px-4 md:px-10 py-5">
                                        <p className="text-[11px] md:text-xs font-black uppercase text-slate-900 dark:text-white italic">{c.productName}</p>
                                    </td>
                                    <td className="px-4 md:px-10 py-5 text-center">
                                        <p className="text-[9px] md:text-[10px] font-bold text-slate-700 dark:text-slate-300">{new Date(c.date).toLocaleDateString()}</p>
                                        <p className="text-[8px] font-black text-indigo-500 uppercase">{new Date(c.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                    </td>
                                    <td className="px-4 md:px-10 py-5 text-center"><span className="text-[10px] font-black text-slate-500">{c.quantity}</span></td>
                                    <td className="px-4 md:px-10 py-5 text-right font-black italic text-emerald-600 text-[11px] md:text-sm">R$ {c.totalPrice.toFixed(2)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Vendas', val: `R$ ${totalRevenue.toFixed(2)}`, color: 'bg-emerald-600' },
              { label: 'Custos', val: `R$ ${totalExpenses.toFixed(2)}`, color: 'bg-rose-500' },
              { label: 'Saldo', val: `R$ ${totalProfit.toFixed(2)}`, color: 'bg-slate-900' },
              { label: 'Estoque', val: lowStock, color: 'bg-amber-500' }
            ].map((stat, i) => (
              <div key={i} className={`${stat.color} p-4 md:p-6 rounded-[2rem] shadow-lg text-white border border-white/10`}>
                <p className="text-[7px] md:text-[8px] font-black uppercase opacity-60 tracking-widest leading-none mb-1 truncate">{stat.label}</p>
                <h4 className="text-sm md:text-xl font-black italic tracking-tighter leading-none">{stat.val}</h4>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <h3 className="text-sm font-black uppercase tracking-widest italic text-slate-800 dark:text-white">Fluxo Financeiro</h3>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl w-full sm:w-auto overflow-x-auto whitespace-nowrap no-print scrollbar-hide">
                  {['today', '7d', 'all'].map(p => (
                    <button key={p} onClick={() => setPeriod(p as any)} className={`flex-1 sm:flex-none px-5 py-3 md:py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all active:scale-95 ${period === p ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-500'}`}>
                      {p === '7d' ? '7 Dias' : p === 'today' ? 'Hoje' : 'Tudo'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-64 w-full flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 700, fill: '#94a3b8'}} />
                    <YAxis hide />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 800}} />
                    <Bar dataKey="vendas" fill="var(--primary-color)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ANÁLISES DA IA */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 ml-2">
                <BrainCircuit className="w-4 h-4 text-indigo-500" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 italic">Análises da IA</h3>
              </div>
              
              {settings.aiSettings?.enabled !== false && aiPredictions.length > 0 ? (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {aiPredictions.map((prediction, idx) => (
                    <div 
                      key={idx} 
                      className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all relative overflow-hidden group cursor-pointer"
                    >
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        {prediction.type === 'movement' ? <TrendingUp className="w-8 h-8" /> : 
                         prediction.type === 'stock' ? <AlertTriangle className="w-8 h-8" /> : 
                         <Sparkles className="w-8 h-8" />}
                      </div>
                      
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-xl ${
                          prediction.type === 'movement' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' :
                          prediction.type === 'stock' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' :
                          'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                        }`}>
                          {prediction.type === 'movement' ? <TrendingUp className="w-3.5 h-3.5" /> : 
                           prediction.type === 'stock' ? <AlertTriangle className="w-3.5 h-3.5" /> : 
                           <Sparkles className="w-3.5 h-3.5" />}
                        </div>
                        <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-800 dark:text-white">{prediction.title}</h4>
                      </div>

                      <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                        {prediction.message}
                      </p>

                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                        <p className="text-[8px] font-black uppercase text-indigo-500 mb-0.5">Sugestão:</p>
                        <p className="text-[9px] font-bold text-slate-700 dark:text-slate-200 italic">
                          {prediction.suggestion}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800 text-center">
                  <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-3 opacity-50" />
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Aguardando novos dados para análise...</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
