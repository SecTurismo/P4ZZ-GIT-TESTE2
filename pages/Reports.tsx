
import React, { useState, useMemo, useEffect } from 'react';
import { Sale, Product, Expense, User, ConsumptionRecord, CashierClosure } from '../types';
import { getAppSettings, getTenantEmployees, getCashierClosures, getSales, getExpenses, getConsumptions, DEFAULT_SETTINGS } from '../services/storage';
import { 
  PieChart, Pie, Cell, 
  BarChart as ReBarChart, Bar as ReBar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';

interface ReportsProps {
  sales: Sale[];
  products: Product[];
  expenses: Expense[];
  consumptions?: ConsumptionRecord[];
  user: User | null;
}

const Reports: React.FC<ReportsProps> = ({ sales: initialSales, products, expenses: initialExpenses, consumptions: initialConsumptions = [], user }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [closures, setClosures] = useState<CashierClosure[]>([]);
  const [dbSales, setDbSales] = useState<Sale[]>(initialSales);
  const [dbExpenses, setDbExpenses] = useState<Expense[]>(initialExpenses);
  const [dbConsumptions, setDbConsumptions] = useState<ConsumptionRecord[]>(initialConsumptions);
  const [isLoading, setIsLoading] = useState(true);
  
  // Controle visual das margens
  const [showMargins, setShowMargins] = useState(false);
  
  const isEmployee = user?.role === 'employee';
  const today = useMemo(() => new Date().toLocaleDateString('en-CA'), []);
  
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [employees, setEmployees] = useState<User[]>([]);

  const forceResync = async () => {
      setIsLoading(true);
      if (user?.tenantId) {
          const [emps, setts, clos, freshSales, freshExpenses, freshCons] = await Promise.all([
              getTenantEmployees(user.tenantId),
              getAppSettings(user.tenantId),
              getCashierClosures(),
              getSales(),
              getExpenses(),
              getConsumptions()
          ]);
          setEmployees(emps);
          setSettings(setts);
          setClosures(clos);
          setDbSales(freshSales);
          setDbExpenses(freshExpenses);
          setDbConsumptions(freshCons);
      }
      setIsLoading(false);
  };

  useEffect(() => {
    forceResync();
  }, [user?.tenantId]);

  const setPeriod = (type: 'today' | 'month' | 'year') => {
    if (type === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (type === 'month') {
      const start = new Date();
      start.setDate(1);
      setStartDate(start.toLocaleDateString('en-CA'));
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      setEndDate(end.toLocaleDateString('en-CA'));
    } else if (type === 'year') {
      const year = new Date().getFullYear();
      setStartDate(`${year}-01-01`);
      setEndDate(`${year}-12-31`);
    }
  };

  const filteredData = useMemo(() => {
    const filterByDate = (item: { date: string }) => {
      if (!item.date) return false;
      const itemDateLocal = new Date(item.date).toLocaleDateString('en-CA');
      return itemDateLocal >= startDate && itemDateLocal <= endDate;
    };

    const sFiltered = dbSales.filter(s => s.status === 'Concluída' && filterByDate(s));
    const eFiltered = dbExpenses.filter(filterByDate);
    const cFiltered = dbConsumptions.filter(filterByDate);

    const applyUserFilter = (list: any[]) => {
      if (isEmployee) return list.filter(i => i.userId === user?.id);
      if (selectedEmployeeId !== 'all') return list.filter(i => i.userId === selectedEmployeeId);
      return list;
    };

    return {
      sales: applyUserFilter(sFiltered),
      expenses: eFiltered,
      consumptions: applyUserFilter(cFiltered)
    };
  }, [dbSales, dbExpenses, dbConsumptions, startDate, endDate, selectedEmployeeId, isEmployee, user?.id]);

  const stats = useMemo(() => {
    let totalRevenue = 0;
    const revenueByMethod = { Pix: 0, Cartão: 0, Dinheiro: 0 };
    const performanceByEmployee: Record<string, { name: string, total: number }> = {};
    const productSummary: Record<string, { qty: number, totalVal: number }> = {};

    const detailedItems: any[] = [];

    filteredData.sales.forEach(s => {
      const saleTotal = Number(s.total);
      totalRevenue += saleTotal;
      
      const method = s.paymentMethod as keyof typeof revenueByMethod;
      if (revenueByMethod.hasOwnProperty(method)) {
          revenueByMethod[method] += saleTotal;
      }

      const empId = s.userId || 'SISTEMA';
      if (!performanceByEmployee[empId]) { 
          performanceByEmployee[empId] = { name: (s.userName || 'SISTEMA').toUpperCase(), total: 0 }; 
      }
      performanceByEmployee[empId].total = Number((performanceByEmployee[empId].total + saleTotal).toFixed(2));

      const saleDate = new Date(s.date || s.createdAt);
      const dateStr = saleDate.toLocaleDateString('pt-BR');
      const timeStr = saleDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      s.items.forEach(item => { 
        const pName = item.productName.toUpperCase();
        if (!productSummary[pName]) productSummary[pName] = { qty: 0, totalVal: 0 };
        productSummary[pName].qty += item.quantity;
        productSummary[pName].totalVal += item.subtotal;

        detailedItems.push({
          name: pName,
          price: item.price,
          qty: item.quantity,
          date: dateStr,
          time: timeStr,
          timestamp: saleDate.getTime()
        });
      });
    });

    const totalOccasionalExpenses = Number(filteredData.expenses.reduce((acc, e) => acc + Number(e.amount), 0).toFixed(2));
    const totalEmployeeConsumption = Number(filteredData.consumptions.reduce((acc, c) => acc + Number(c.totalPrice), 0).toFixed(2));
    const totalOperationalExpenses = Number((totalOccasionalExpenses + totalEmployeeConsumption).toFixed(2));
    const netProfit = Number((totalRevenue - totalOperationalExpenses).toFixed(2));

    // Cálculos de Margens
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const expenseWeight = totalRevenue > 0 ? (totalOperationalExpenses / totalRevenue) * 100 : 0;

    const pieData = [
        { name: 'Pix', value: revenueByMethod.Pix, color: '#6366f1' },
        { name: 'Cartão', value: revenueByMethod.Cartão, color: '#3b82f6' },
        { name: 'Dinheiro', value: revenueByMethod.Dinheiro, color: '#10b981' }
    ].filter(d => d.value > 0);

    return {
      totalRevenue,
      totalOperationalExpenses,
      totalEmployeeConsumption,
      netProfit,
      profitMargin,
      expenseWeight,
      revenueByMethod,
      pieData,
      performance: Object.values(performanceByEmployee).sort((a, b) => b.total - a.total),
      productSummary: Object.entries(productSummary).sort((a, b) => b[1].qty - a[1].qty),
      detailedItems: detailedItems.sort((a, b) => b.timestamp - a.timestamp)
    };
  }, [filteredData]);

  if (isLoading) {
      return (
          <div className="h-96 flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gerando Relatório Auditoria...</p>
          </div>
      );
  }

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      <div className="no-print bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col xl:flex-row gap-6 items-end xl:items-center">
        <div className="flex flex-wrap gap-4 items-end flex-1">
          <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-indigo-500 ml-1">Início</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" /></div>
          <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-indigo-500 ml-1">Término</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" /></div>
          {!isEmployee && (<div className="space-y-1.5 flex-1 min-w-[200px]"><label className="text-[9px] font-black uppercase text-indigo-500 ml-1">Filtrar Equipe</label><select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-xs font-bold outline-none uppercase"><option value="all">TODOS</option>{employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}</select></div>)}
        </div>
        
        {/* BOTÃO EXIBIR MARGENS */}
        <button 
          onClick={() => setShowMargins(!showMargins)} 
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all ${showMargins ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={showMargins ? "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" : "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"} />
          </svg>
          {showMargins ? 'Ocultar Margens' : 'Exibir Margens'}
        </button>

        <button onClick={forceResync} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-indigo-500 transition-colors shadow-inner"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeWidth={2.5}/></svg></button>
        <button onClick={() => window.print()} style={{ backgroundColor: settings.primaryColor }} className="text-white px-8 py-2.5 rounded-xl font-black shadow-lg uppercase text-[9px] tracking-widest hover:brightness-110 active:scale-95 transition-all">Imprimir</button>
      </div>

      <div className="bg-white p-8 md:p-12 shadow-2xl border border-slate-200 flex flex-col text-slate-950 mx-auto max-w-[1100px] rounded-[3rem] print:m-0 print:p-0 print:shadow-none print:max-w-none print:rounded-none print:border-none print:w-full print:text-black">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            .compact-table { font-size: 8px !important; width: 100% !important; border-spacing: 0 !important; }
            .compact-table th, .compact-table td { padding: 4px 8px !important; line-height: 1.2 !important; border-bottom: 0.5pt solid #e2e8f0 !important; }
            .compact-table thead { display: table-header-group !important; background-color: #f8fafc !important; }
            .compact-table tr { page-break-inside: avoid !important; }
            .print-only-header { display: table-header-group !important; }
            .abc-container { column-count: 1 !important; }
            @page { 
              margin-top: ${settings.printSettings?.a4Report?.margins?.top ?? 20}px;
              margin-bottom: ${settings.printSettings?.a4Report?.margins?.bottom ?? 20}px;
              margin-left: ${settings.printSettings?.a4Report?.margins?.left ?? 20}px;
              margin-right: ${settings.printSettings?.a4Report?.margins?.right ?? 20}px;
              size: ${settings.printSettings?.a4Report?.paperSize || 'A4'};
            }
          }
        `}} />

        <div className="flex justify-between items-center border-b-2 border-slate-950 pb-6 mb-8">
          <div className="flex items-center gap-4">
            {settings.logoUrl && <img src={settings.logoUrl} className="w-12 h-12 object-contain" alt="logo" />}
            <div>
              <h1 className="text-2xl font-black italic uppercase tracking-tighter text-black">{settings.printSettings?.a4Report?.header || settings.systemName}</h1>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.4em]">{settings.printSettings?.a4Report?.message || 'Relatório Consolidado de Auditoria'}</p>
            </div>
          </div>
          <div className="text-right"><p className="text-[9px] font-black text-black uppercase tracking-widest">Período: {new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR')} - {new Date(endDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p></div>
        </div>

        {/* FINANCIAL SUMMARY - GRID DINÂMICO */}
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${showMargins ? '4' : '3'} print:grid-cols-3 gap-4 mb-6 transition-all duration-500`}>
           <div className="p-6 bg-slate-50 border border-slate-200 rounded-[2rem] print:p-4 print-break-avoid"><span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Faturamento Bruto</span><span className="text-2xl font-black italic text-black print:text-xl">R$ {stats.totalRevenue.toFixed(2)}</span></div>
           
           <div className="p-6 bg-slate-50 border border-slate-200 rounded-[2rem] print:p-4 print-break-avoid">
              <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Despesas e Saídas</span>
              <span className="text-2xl font-black italic text-rose-600 print:text-xl">R$ {stats.totalOperationalExpenses.toFixed(2)}</span>
              <p className="text-[7px] font-bold text-slate-400 uppercase mt-1">Inclui gastos de equipe</p>
           </div>

           {/* BLOCO DE MARGENS (CONDICIONAL) */}
           {showMargins && (
             <div className="p-6 bg-slate-50 border-2 border-indigo-100 rounded-[2rem] animate-in fade-in slide-in-from-left-4 duration-500 print:hidden print-break-avoid">
                <span className="text-[8px] font-black text-indigo-500 uppercase block mb-3 tracking-widest">Margens Operacionais</span>
                <div className="space-y-3">
                   <div className="flex justify-between items-end border-b border-indigo-50 pb-2">
                      <span className="text-[7px] font-black text-slate-400 uppercase">Margem de Lucro</span>
                      <span className={`text-sm font-black italic ${stats.profitMargin > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{stats.profitMargin.toFixed(1)}%</span>
                   </div>
                   <div className="flex justify-between items-end">
                      <span className="text-[7px] font-black text-slate-400 uppercase">Peso Despesas</span>
                      <span className="text-sm font-black text-rose-500 italic">{stats.expenseWeight.toFixed(1)}%</span>
                   </div>
                </div>
             </div>
           )}

           <div className="p-6 bg-slate-900 rounded-[2rem] shadow-xl print:p-4 print-break-avoid"><span className="text-[8px] font-black text-white/60 uppercase block mb-1">Resultado Líquido</span><span className="text-2xl font-black italic text-white print:text-xl">R$ {stats.netProfit.toFixed(2)}</span></div>
        </div>

        {/* PAYMENT METHODS SECTION */}
        <div className="space-y-4 mb-6">
            <div className="flex items-center gap-3 border-l-4 border-indigo-600 pl-4 print:mb-2">
                <h3 className="text-[11px] font-black uppercase text-indigo-600 tracking-widest italic">Análise de Meios de Pagamento</h3>
            </div>
            
            {/* Payment Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:gap-2">
                <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-[2.5rem] group hover:bg-indigo-600 transition-all duration-300 print:p-3">
                    <span className="text-[8px] font-black text-indigo-400 group-hover:text-indigo-200 uppercase block mb-1">Total via Pix</span>
                    <span className="text-xl font-black italic text-indigo-700 group-hover:text-white print:text-lg">R$ {stats.revenueByMethod.Pix.toFixed(2)}</span>
                </div>
                <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-[2.5rem] group hover:bg-indigo-600 transition-all duration-300 print:p-3">
                    <span className="text-[8px] font-black text-indigo-400 group-hover:text-indigo-200 uppercase block mb-1">Total em Cartão</span>
                    <span className="text-xl font-black italic text-indigo-700 group-hover:text-white print:text-lg">R$ {stats.revenueByMethod.Cartão.toFixed(2)}</span>
                </div>
                <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[2.5rem] group hover:bg-emerald-600 transition-all duration-300 print:p-3">
                    <span className="text-[8px] font-black text-emerald-400 group-hover:text-emerald-200 uppercase block mb-1">Total em Dinheiro</span>
                    <span className="text-xl font-black italic text-emerald-700 group-hover:text-white print:text-lg">R$ {stats.revenueByMethod.Dinheiro.toFixed(2)}</span>
                </div>
            </div>

            {/* Visual Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 print:grid-cols-2 gap-8 pt-4 print:gap-4 print:pt-0">
                <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col h-[350px] print:h-[220px] print:p-2 print-break-avoid chart-container-print">
                    <h4 className="text-[9px] font-black uppercase text-slate-400 text-center mb-4 print:mb-1">Proporção de Recebimento</h4>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={stats.pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={60}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            >
                                {stats.pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <RechartsTooltip 
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                            />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                
                <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col h-[350px] print:h-[220px] print:p-2 print-break-avoid chart-container-print">
                    <h4 className="text-[9px] font-black uppercase text-slate-400 text-center mb-4 print:mb-1">Volume por Modalidade</h4>
                    <ResponsiveContainer width="100%" height="100%">
                        <ReBarChart data={stats.pieData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 8, fontWeight: 900, fill: '#94a3b8'}} />
                            <YAxis hide />
                            <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '16px', border: 'none', fontSize: '10px', fontWeight: 900}} />
                            <ReBar dataKey="value" radius={[5, 5, 0, 0]}>
                                {stats.pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </ReBar>
                        </ReBarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        <div className="space-y-6 mb-6 print:mb-0">
            <div className="print-break-avoid">
              <h3 className="text-[11px] font-black uppercase border-l-4 border-slate-900 pl-3 text-black mb-4">Performance Consolidada</h3>
              <div className="border rounded-[2rem] overflow-hidden border-slate-200 print:border-slate-300">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-black text-[8px] font-black uppercase print:bg-slate-200">
                    <tr><th className="px-6 py-4 print:py-2">Ranking</th><th className="px-6 py-4 print:py-2">Vendedor</th><th className="px-6 py-4 print:py-2 text-right">Total</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[10px] font-bold uppercase text-black print:divide-slate-200">
                    {stats.performance.length === 0 ? (
                      <tr><td colSpan={3} className="px-6 py-12 text-center opacity-20 italic">Vazio</td></tr>
                    ) : (
                      stats.performance.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50 print-break-avoid"><td className="px-6 py-4 print:py-2">{i+1}º</td><td className="px-6 py-4 print:py-2 font-black">{p.name}</td><td className="px-6 py-4 print:py-2 text-right">R$ {p.total.toFixed(2)}</td></tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
        </div>

        <div className="space-y-4 print:break-before-page print:mt-0 print:pt-6 print:w-full">
          <h3 className="text-[11px] font-black uppercase border-l-4 border-indigo-600 pl-3 text-black print:mb-4 print:text-[10px] italic">Relatório Detalhado de Produtos Vendidos</h3>
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 min-h-[100px] space-y-1.5 print:border-none print:p-0 abc-container">
            {stats.detailedItems.length === 0 ? (
              <p className="text-center opacity-20 italic font-black uppercase text-[10px] py-10">Sem vendas no período</p>
            ) : (
              <table className="w-full text-left compact-table border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-900 bg-slate-50">
                    <th className="py-3 px-4 font-black uppercase text-[10px] print:text-[8px]">Produto</th>
                    <th className="py-3 px-4 font-black uppercase text-[10px] print:text-[8px] text-center">Qtd</th>
                    <th className="py-3 px-4 font-black uppercase text-[10px] print:text-[8px] text-right">Preço Un.</th>
                    <th className="py-3 px-4 font-black uppercase text-[10px] print:text-[8px] text-center">Data</th>
                    <th className="py-3 px-4 font-black uppercase text-[10px] print:text-[8px] text-right">Horário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.detailedItems.map((item, idx) => (
                    <tr key={idx} className="text-[10px] font-bold uppercase text-black print:text-[8px] hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-black">{item.name}</td>
                      <td className="py-3 px-4 text-center font-black">{item.qty}</td>
                      <td className="py-3 px-4 text-right font-black">R$ {item.price.toFixed(2)}</td>
                      <td className="py-3 px-4 text-center font-medium text-slate-500">{item.date}</td>
                      <td className="py-3 px-4 text-right font-medium text-slate-500">{item.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="text-center italic opacity-30 mt-20 border-t pt-6 print:block">
          <p className="text-[8px] font-black uppercase tracking-[0.4em] text-black">
            {settings.printSettings?.a4Report?.footer || `${settings.systemName} — ANALÍTICO DE INTELIGÊNCIA OPERACIONAL`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Reports;
