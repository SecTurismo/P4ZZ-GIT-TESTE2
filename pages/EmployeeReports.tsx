
import React, { useState, useEffect, useMemo } from 'react';
import { User, CashierShift, Sale, ConsumptionRecord } from '../types';
import { getCurrentUser, getUsers, getCashierShifts, getSales, getConsumptions } from '../services/storage';

const EmployeeReports: React.FC = () => {
  const user = getCurrentUser();
  const [employees, setEmployees] = useState<User[]>([]);
  const [shifts, setShifts] = useState<CashierShift[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [consumptions, setConsumptions] = useState<ConsumptionRecord[]>([]);
  
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
        setIsLoading(true);
        try {
            const [allUsers, allShifts, allSales, allCons] = await Promise.all([ 
              getUsers(), 
              getCashierShifts(), 
              getSales(),
              getConsumptions()
            ]);
            setEmployees(allUsers.filter(u => u.tenantId === user.tenantId && u.role === 'employee'));
            setShifts(allShifts.filter(s => s.tenantId === user.tenantId));
            setSales(allSales);
            setConsumptions(allCons.filter(c => c.tenantId === user.tenantId));
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };
    loadData();
  }, [user?.tenantId]);

  const filteredShifts = useMemo(() => {
    return shifts.filter(s => {
        const matchesEmployee = !selectedEmployeeId || s.userId === selectedEmployeeId;
        const shiftDate = new Date(s.openDate).toLocaleDateString('en-CA');
        const matchesDate = !selectedDate || shiftDate === selectedDate;
        return matchesEmployee && matchesDate;
    }).sort((a, b) => new Date(b.openDate).getTime() - new Date(a.openDate).getTime());
  }, [shifts, selectedEmployeeId, selectedDate]);

  const getShiftDetails = (shift: CashierShift) => {
    const shiftOpen = new Date(shift.openDate);
    const shiftClose = shift.closeDate ? new Date(shift.closeDate) : new Date();

    // Vendas vinculadas ao turno
    const shiftSales = sales.filter(sale => 
        sale.userId === shift.userId && 
        sale.status === 'Concluída' &&
        new Date(sale.date) >= shiftOpen &&
        new Date(sale.date) <= shiftClose
    );

    // Gastos do funcionário no dia do turno
    const shiftDay = shiftOpen.toLocaleDateString('en-CA');
    const employeeDebts = consumptions.filter(c => 
        c.userId === shift.userId && 
        new Date(c.date).toLocaleDateString('en-CA') === shiftDay
    );

    const cashSales = shiftSales.filter(s => s.paymentMethod === 'Dinheiro').reduce((acc, s) => acc + s.total, 0);
    const pixSales = shiftSales.filter(s => s.paymentMethod === 'Pix').reduce((acc, s) => acc + s.total, 0);
    const cardSales = shiftSales.filter(s => s.paymentMethod === 'Cartão').reduce((acc, s) => acc + s.total, 0);
    const totalConsumption = employeeDebts.reduce((acc, c) => acc + c.totalPrice, 0);
    
    const expectedCash = shift.initialCash + cashSales;
    const reportedCash = shift.finalCash !== undefined ? shift.finalCash : 0;
    const difference = reportedCash - expectedCash;

    return { 
      cashSales, 
      pixSales, 
      cardSales, 
      expectedCash, 
      reportedCash,
      difference, 
      totalSales: cashSales + pixSales + cardSales, 
      totalConsumption,
      count: shiftSales.length,
      hasPendingDebts: totalConsumption > 0
    };
  };

  if (isLoading) return (
    <div className="h-96 flex flex-col items-center justify-center space-y-4">
      <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Processando Auditoria...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-24 animate-in fade-in duration-500 px-2 md:px-0">
      
      {/* FILTROS E PESQUISA */}
      <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row gap-6 items-stretch lg:items-end no-print">
        <div className="flex-1 space-y-2">
            <label className="text-[9px] font-black uppercase text-indigo-500 ml-2 tracking-widest">Selecionar Funcionário</label>
            <select 
              value={selectedEmployeeId} 
              onChange={e => setSelectedEmployeeId(e.target.value)} 
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-black text-[11px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner min-h-[52px] cursor-pointer"
            >
                <option value="">FILTRAR POR COLABORADOR</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
        </div>
        <div className="w-full lg:w-64 space-y-2">
            <label className="text-[9px] font-black uppercase text-indigo-500 ml-2 tracking-widest">Escolher Data</label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={e => setSelectedDate(e.target.value)} 
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-black text-xs outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner min-h-[52px]" 
            />
        </div>
        <button onClick={() => { setSelectedDate(''); setSelectedEmployeeId(''); }} className="px-10 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black uppercase text-[9px] tracking-widest hover:bg-slate-200 transition-colors shadow-sm min-h-[52px]">Limpar</button>
      </div>

      {/* LISTAGEM DE TURNOS AUDITADOS */}
      <div className="space-y-10">
        {filteredShifts.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 p-20 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800 text-center opacity-40">
                <p className="font-black uppercase text-[10px] tracking-[0.3em]">Nenhum registro de turno localizado para esta data</p>
            </div>
        ) : (
            filteredShifts.map(shift => {
                const metrics = getShiftDetails(shift);
                return (
                    <div key={shift.id} className="bg-white dark:bg-slate-900 rounded-[3rem] md:rounded-[4rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 transition-all duration-500">
                        {/* HEADER DO TURNO */}
                        <div className="p-8 md:p-10 border-b bg-slate-50 dark:bg-slate-950/50 flex flex-col sm:flex-row justify-between items-center gap-6">
                            <div className="flex items-center gap-6 w-full sm:w-auto">
                                <div className={`w-16 h-16 md:w-20 md:h-20 rounded-3xl flex items-center justify-center font-black text-xl shadow-2xl ${shift.status === 'aberto' ? 'bg-emerald-500 text-white animate-pulse' : 'bg-slate-900 text-white dark:bg-slate-800'}`}>
                                  {shift.userName.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white truncate leading-none">{shift.userName}</h4>
                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-4">
                                        <div className="flex flex-col">
                                          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                                          <span className={`text-[10px] font-black uppercase tracking-widest ${shift.status === 'aberto' ? 'text-emerald-500' : 'text-slate-500'}`}>
                                            {shift.status === 'aberto' ? '● CAIXA ABERTO' : '○ CAIXA FECHADO'}
                                          </span>
                                        </div>
                                        <div className="flex flex-col border-l dark:border-slate-800 pl-4">
                                          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Data</span>
                                          <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                                            {new Date(shift.openDate).toLocaleDateString('pt-BR')}
                                          </span>
                                        </div>
                                        <div className="flex flex-col border-l dark:border-slate-800 pl-4">
                                          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Abertura</span>
                                          <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                                            {new Date(shift.openDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                          </span>
                                        </div>
                                        {shift.closeDate && (
                                          <div className="flex flex-col border-l dark:border-slate-800 pl-4">
                                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Fechamento</span>
                                            <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">
                                              {new Date(shift.closeDate).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                            </span>
                                          </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex flex-col items-center sm:items-end w-full sm:w-auto gap-2">
                                {metrics.hasPendingDebts && (
                                  <div className="bg-amber-500 text-white px-5 py-2 rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg animate-bounce flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={3}/></svg>
                                    Funcionário com Débito Registrado
                                  </div>
                                )}
                            </div>
                        </div>

                        {/* CORPO DO RELATÓRIO */}
                        <div className="p-8 md:p-14">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 md:gap-14">
                                
                                {/* BLOCO 1: ENTRADAS POR MÉTODO */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 border-l-4 border-indigo-500 pl-4">
                                        <h5 className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-500">Fluxo de Entradas</h5>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/30 p-6 md:p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 space-y-4 shadow-inner">
                                        <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-500 uppercase">Vendas em Dinheiro</span><span className="text-sm font-black text-emerald-600">R$ {metrics.cashSales.toFixed(2)}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-500 uppercase">Vendas em Pix</span><span className="text-sm font-black text-indigo-500">R$ {metrics.pixSales.toFixed(2)}</span></div>
                                        <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-500 uppercase">Vendas em Cartão</span><span className="text-sm font-black text-blue-500">R$ {metrics.cardSales.toFixed(2)}</span></div>
                                        <div className="pt-4 border-t-2 border-dashed dark:border-slate-700 flex justify-between items-center">
                                          <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase">Bruto Total</span>
                                          <span className="text-lg font-black italic">R$ {metrics.totalSales.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* BLOCO 2: DÉBITOS DO FUNCIONÁRIO */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 border-l-4 border-rose-500 pl-4">
                                        <h5 className="text-[11px] font-black uppercase tracking-[0.3em] text-rose-500">Pendências Internas</h5>
                                    </div>
                                    <div className={`p-6 md:p-8 rounded-[2.5rem] border-2 transition-all flex flex-col justify-center gap-4 ${metrics.hasPendingDebts ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30' : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 opacity-40'}`}>
                                        <div className="flex justify-between items-center">
                                          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">Consumo Registrado</span>
                                          <span className={`text-xl font-black italic ${metrics.hasPendingDebts ? 'text-rose-600' : 'text-slate-400'}`}>R$ {metrics.totalConsumption.toFixed(2)}</span>
                                        </div>
                                        {metrics.hasPendingDebts && (
                                          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-rose-100 text-center">
                                            <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Valor deve ser retido ou descontado</p>
                                          </div>
                                        )}
                                        {!metrics.hasPendingDebts && (
                                          <p className="text-[9px] font-bold text-slate-400 uppercase text-center italic">Nenhum gasto pendente</p>
                                        )}
                                    </div>
                                </div>

                                {/* BLOCO 3: CONFERÊNCIA DE GAVETA */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 border-l-4 border-slate-900 dark:border-white pl-4">
                                        <h5 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-900 dark:text-white">Conferência Física</h5>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/30 p-6 md:p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 space-y-4 shadow-inner">
                                        <div className="flex justify-between items-center"><span className="text-[10px] font-bold text-slate-500 uppercase">Fundo (Valor Inicial)</span><span className="text-sm font-black">R$ {shift.initialCash.toFixed(2)}</span></div>
                                        <div className="flex justify-between items-center pt-2 border-t dark:border-slate-700">
                                          <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase">Esperado em Dinheiro</span>
                                          <span className="text-base font-black">R$ {metrics.expectedCash.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                          <span className="text-[10px] font-black text-indigo-500 uppercase">Informado (Fechamento)</span>
                                          <span className="text-lg font-black text-indigo-500 italic">{shift.status === 'fechado' ? `R$ ${metrics.reportedCash.toFixed(2)}` : 'CAIXA ABERTO'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* BLOCO FINAL: RESULTADO DA AUDITORIA (FULL WIDTH) */}
                                <div className="lg:col-span-3 pt-6">
                                    <div className={`relative p-10 md:p-12 rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8 ${metrics.difference === 0 ? 'bg-slate-900' : metrics.difference > 0 ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                                        <div className="absolute top-0 left-0 w-full h-2 bg-white/20"></div>
                                        <div className="text-center md:text-left space-y-2">
                                          <span className="text-[9px] font-black text-white/70 uppercase tracking-[0.4em]">Balanço Final da Auditoria</span>
                                          <h6 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white">
                                            {metrics.difference > 0 ? '+' : ''} R$ {metrics.difference.toFixed(2)}
                                          </h6>
                                        </div>
                                        
                                        <div className="flex flex-col items-center md:items-end gap-4">
                                            <div className="flex items-center gap-3 px-6 py-3 bg-white/10 rounded-full border border-white/20">
                                                <div className={`w-2.5 h-2.5 rounded-full ${metrics.difference === 0 ? 'bg-emerald-400' : 'bg-white shadow-lg animate-pulse'}`}></div>
                                                <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                                  {metrics.difference === 0 ? 'CAIXA CONFERIDO' : metrics.difference > 0 ? 'SOBRA DETECTADA' : 'FALTA DETECTADA'}
                                                </span>
                                            </div>
                                            <p className="text-[8px] font-black text-white/50 uppercase tracking-[0.3em] italic text-center md:text-right">
                                              Processado em {new Date().toLocaleDateString('pt-BR')} — Auditoria de Precisão P4ZZ
                                            </p>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                );
            })
        )}
      </div>
    </div>
  );
};

export default EmployeeReports;
