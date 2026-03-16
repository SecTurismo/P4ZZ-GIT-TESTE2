
import React, { useState, useEffect, useMemo } from 'react';
import { Sale, Expense, AppSettings, CashFlowEntry, Fiado } from '../types';
import { getSales, getExpenses, getCashFlow, saveCashFlow, getFiados } from '../services/storage';
import { TrendingUp, TrendingDown, DollarSign, Calendar, PieChart, ArrowUpRight, ArrowDownRight, Filter, Download, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart as RePieChart, Pie, Line, ComposedChart } from 'recharts';

interface FinancialFlowProps {
  settings: AppSettings;
}

const FinancialFlow: React.FC<FinancialFlowProps> = ({ settings }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'month' | 'all'>(settings.financialFlowDefaultPeriod || '30d');
  const [activeTab, setActiveTab] = useState<'flow' | 'dre'>('flow');

  useEffect(() => {
    const loadData = async () => {
      const [s, e, f] = await Promise.all([getSales(), getExpenses(), getFiados()]);
      let processedSales = s.filter(sale => sale.status === 'Concluída');
      
      if (settings.financialFlowIncludePendingFiados) {
        const pendingFiados = f.filter(fiado => fiado.status === 'Pendente').map(fiado => ({
          ...fiado,
          total: fiado.total,
          status: 'Concluída' as const,
          items: []
        })) as any[];
        processedSales = [...processedSales, ...pendingFiados];
      }

      setSales(processedSales);
      setExpenses(e);
    };
    loadData();
  }, [settings.financialFlowIncludePendingFiados]);

  const filterByPeriod = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    if (period === 'today') return date.toLocaleDateString() === now.toLocaleDateString();
    if (period === '7d') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    }
    if (period === '30d') {
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      return date >= monthAgo;
    }
    if (period === 'month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    return true;
  };

  const filteredSales = sales.filter(s => filterByPeriod(s.date));
  const filteredExpenses = expenses.filter(e => filterByPeriod(e.date));

  const stats = useMemo(() => {
    const revenue = filteredSales.reduce((acc, s) => acc + s.total, 0);
    const costOfGoods = filteredSales.reduce((acc, s) => acc + s.items.reduce((sum, item) => sum + (item.cost * item.quantity), 0), 0);
    const grossProfit = revenue - costOfGoods;
    const totalExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
    const netProfit = grossProfit - totalExpenses;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return { revenue, costOfGoods, grossProfit, totalExpenses, netProfit, margin };
  }, [filteredSales, filteredExpenses]);

  const chartData = useMemo(() => {
    const days: Record<string, { date: string, revenue: number, expenses: number }> = {};
    
    filteredSales.forEach(s => {
      const d = new Date(s.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (!days[d]) days[d] = { date: d, revenue: 0, expenses: 0 };
      days[d].revenue += s.total;
    });

    filteredExpenses.forEach(e => {
      const d = new Date(e.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (!days[d]) days[d] = { date: d, revenue: 0, expenses: 0 };
      days[d].expenses += e.amount;
    });

    const data = Object.values(days).sort((a, b) => a.date.localeCompare(b.date));
    
    if (settings.financialFlowShowProjections && data.length >= 2) {
      const avgRevenue = data.reduce((acc, d) => acc + d.revenue, 0) / data.length;
      return data.map(d => ({ ...d, projection: avgRevenue }));
    }
    
    return data;
  }, [filteredSales, filteredExpenses, settings.financialFlowShowProjections]);

  const expenseCategories = useMemo(() => {
    const cats: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      cats[e.category] = (cats[e.category] || 0) + e.amount;
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [filteredExpenses]);

  const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-emerald-600" />
            Fluxo de Caixa & DRE
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Análise financeira detalhada do seu negócio</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
            <button onClick={() => setActiveTab('flow')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'flow' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Fluxo de Caixa</button>
            <button onClick={() => setActiveTab('dre')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'dre' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>DRE Simplificado</button>
          </div>
          
          <select value={period} onChange={e => setPeriod(e.target.value as any)} className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/20">
            <option value="today">Hoje</option>
            <option value="7d">Últimos 7 Dias</option>
            <option value="30d">Últimos 30 Dias</option>
            <option value="month">Este Mês</option>
            <option value="all">Todo Período</option>
          </select>
        </div>
      </div>

      {activeTab === 'flow' ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl">
                  <ArrowUpRight className="w-6 h-6 text-emerald-600" />
                </div>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Entradas</span>
              </div>
              <p className="text-2xl font-black text-slate-800 dark:text-white">R$ {stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Total de vendas no período</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-2xl">
                  <ArrowDownRight className="w-6 h-6 text-rose-600" />
                </div>
                <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Saídas</span>
              </div>
              <p className="text-2xl font-black text-slate-800 dark:text-white">R$ {stats.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Despesas fixas e variáveis</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl">
                  <DollarSign className="w-6 h-6 text-indigo-600" />
                </div>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Saldo Líquido</span>
              </div>
              <p className={`text-2xl font-black ${stats.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>R$ {stats.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Lucro real após custos</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl">
                  <TrendingUp className="w-6 h-6 text-amber-600" />
                </div>
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Margem</span>
              </div>
              <p className="text-2xl font-black text-slate-800 dark:text-white">{stats.margin.toFixed(1)}%</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Rentabilidade do negócio</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Evolução Financeira
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                      cursor={{ fill: '#f8fafc' }}
                    />
                    <Bar dataKey="revenue" name="Entradas" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="expenses" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                    {settings.financialFlowShowProjections && (
                      <Line type="monotone" dataKey="projection" name="Projeção Média" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Distribuição de Despesas
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={expenseCategories}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {expenseCategories.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 space-y-2">
                {expenseCategories.map((cat, i) => (
                  <div key={cat.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                      <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-400">{cat.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-slate-800 dark:text-white">R$ {cat.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-10">
          <div className="flex justify-between items-center border-b border-slate-50 dark:border-slate-800 pb-6">
            <h3 className="text-xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Demonstrativo de Resultado (DRE)</h3>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all">
              <Download className="w-4 h-4" />
              Exportar PDF
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center py-4 border-b border-slate-50 dark:border-slate-800">
              <span className="text-xs font-black uppercase text-slate-500 tracking-widest">(=) Receita Bruta de Vendas</span>
              <span className="text-sm font-black text-slate-800 dark:text-white">R$ {stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            
            <div className="flex justify-between items-center py-4 border-b border-slate-50 dark:border-slate-800">
              <span className="text-xs font-black uppercase text-rose-500 tracking-widest">(-) Custo das Mercadorias Vendidas (CMV)</span>
              <span className="text-sm font-black text-rose-500">R$ {stats.costOfGoods.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex justify-between items-center py-6 bg-slate-50 dark:bg-slate-800/50 px-6 rounded-2xl">
              <span className="text-xs font-black uppercase text-indigo-600 tracking-widest">(=) Lucro Bruto</span>
              <span className="text-lg font-black text-indigo-600">R$ {stats.grossProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="space-y-4 pt-4">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] ml-2">Despesas Operacionais</h4>
              {expenseCategories.map(cat => (
                <div key={cat.name} className="flex justify-between items-center py-3 border-b border-slate-50 dark:border-slate-800 px-2">
                  <span className="text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 italic">{cat.name}</span>
                  <span className="text-xs font-black text-rose-500">R$ {cat.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-4 border-b border-slate-50 dark:border-slate-800 px-2">
                <span className="text-xs font-black uppercase text-rose-500 tracking-widest">(-) Total de Despesas</span>
                <span className="text-sm font-black text-rose-500">R$ {stats.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="flex justify-between items-center py-8 bg-emerald-500 text-white px-8 rounded-[2rem] shadow-xl shadow-emerald-500/20">
              <div className="space-y-1">
                <span className="text-xs font-black uppercase tracking-[0.3em] opacity-80">(=) Lucro Líquido do Exercício</span>
                <p className="text-[10px] font-bold uppercase italic opacity-60">Resultado final do período selecionado</p>
              </div>
              <span className="text-3xl font-black">R$ {stats.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialFlow;
