
import React, { useState } from 'react';
import { Sale, Table } from '../types';
import { deleteSale, getTables, saveTables, isDemoViewer } from '../services/storage';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import * as XLSX from 'xlsx';
import { FileDown } from 'lucide-react';

interface SalesHistoryProps {
  sales: Sale[];
  onRefresh?: () => void;
}

const SalesHistory: React.FC<SalesHistoryProps> = ({ sales, onRefresh }) => {
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [saleToReopen, setSaleToReopen] = useState<Sale | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const reversedSales = [...sales].reverse();

  const handleConfirmDelete = async () => {
    if (!saleToDelete) return;
    await deleteSale(saleToDelete.id);
    setSaleToDelete(null);
    setSelectedIds(prev => prev.filter(id => id !== saleToDelete.id));
    if (onRefresh) onRefresh();
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sales.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sales.map(s => s.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await deleteSale(id);
    }
    setSelectedIds([]);
    setConfirmBulkDelete(false);
    if (onRefresh) onRefresh();
  };

  const handleConfirmReopen = async () => {
    if (!saleToReopen || !saleToReopen.tableNumber) return;
    
    const tables = await getTables();
    const tableIdx = tables.findIndex(t => t.id === saleToReopen.tableNumber);
    
    if (tableIdx !== -1) {
      if (tables[tableIdx].status === 'Ocupada') {
        alert('Mesa já está em uso atualmente.');
        setSaleToReopen(null);
        return;
      }
      await deleteSale(saleToReopen.id);
      tables[tableIdx] = { 
        ...tables[tableIdx], 
        status: 'Ocupada', 
        items: saleToReopen.items, 
        startTime: saleToReopen.date 
      };
      await saveTables(tables);
      setSaleToReopen(null);
      if (onRefresh) onRefresh();
    }
  };

  const handleExportExcel = () => {
    const dataToExport = sales.map(s => ({
      'DATA': new Date(s.date).toLocaleDateString('pt-BR'),
      'HORA': new Date(s.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      'ORIGEM': s.tableNumber ? `MESA ${s.tableNumber}` : s.isDelivery ? `ENTREGA #${s.deliveryNumber}` : 'BALCÃO',
      'ITENS': s.items.map(i => `${i.quantity}x ${i.productName}`).join(', '),
      'PAGAMENTO': s.paymentMethod.toUpperCase(),
      'TOTAL': s.total
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendas");
    XLSX.writeFile(wb, `Relatorio_Vendas_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* DESKTOP TABLE VIEW */}
      <div className="hidden sm:block bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 no-print">
                <input 
                  type="checkbox" 
                  checked={selectedIds.length === sales.length && sales.length > 0}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Todos</span>
              </div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Logs de Transações</h3>
            </div>
            <div className="flex items-center gap-3">
              {selectedIds.length > 0 && (
                <button 
                  onClick={() => setConfirmBulkDelete(true)}
                  className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 px-4 py-2 rounded-xl font-black uppercase text-[9px] tracking-widest border border-rose-100 shadow-sm hover:bg-rose-100 transition active:scale-95"
                >
                  Excluir ({selectedIds.length})
                </button>
              )}
              <span className="text-[9px] font-bold text-slate-400 uppercase">{sales.length} Registros</span>
              <button 
                onClick={handleExportExcel}
                className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl font-black uppercase text-[9px] tracking-widest border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition active:scale-95 flex items-center gap-2"
              >
                <FileDown className="w-3.5 h-3.5" />
                Exportar
              </button>
            </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 w-10"></th>
                <th className="px-6 py-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">Data / Hora</th>
                <th className="px-6 py-4 text-[8px] font-black text-slate-500 uppercase tracking-widest">Origem e Itens</th>
                <th className="px-6 py-4 text-[8px] font-black text-slate-500 uppercase tracking-widest text-center">Pagto</th>
                <th className="px-6 py-4 text-[8px] font-black text-slate-500 uppercase tracking-widest text-right">Valor</th>
                <th className="px-6 py-4 text-[8px] font-black text-slate-500 uppercase tracking-widest text-right no-print">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {reversedSales.map(sale => (
                <tr key={sale.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition group ${selectedIds.includes(sale.id) ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.includes(sale.id)}
                      onChange={() => toggleSelect(sale.id)}
                      className="w-5 h-5 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[10px] font-black dark:text-white uppercase">{new Date(sale.date).toLocaleDateString('pt-BR')}</div>
                    <div className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">{new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      {sale.tableNumber ? <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Mesa {sale.tableNumber}</span> : sale.isDelivery ? <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded text-[8px] font-black uppercase">Entrega #{sale.deliveryNumber}</span> : <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-[8px] font-black uppercase">Balcão</span>}
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 truncate max-w-xs font-bold uppercase">{sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center"><span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[8px] font-black uppercase">{sale.paymentMethod}</span></td>
                  <td className="px-6 py-4 text-right font-black italic text-sm dark:text-white">R$ {sale.total.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right no-print">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {sale.tableNumber && (
                        <button 
                          onClick={() => setSaleToReopen(sale)} 
                          className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg text-indigo-500 bg-indigo-50`}
                        >
                          Reabrir
                        </button>
                      )}
                      <button 
                        onClick={() => setSaleToDelete(sale)} 
                        className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg text-rose-500 bg-rose-50`}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE LIST VIEW */}
      <div className="sm:hidden space-y-4">
          <div className="flex items-center justify-between px-4 mb-2">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={selectedIds.length === sales.length && sales.length > 0}
                onChange={toggleSelectAll}
                className="w-5 h-5 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
              />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Todos</span>
            </div>
            {selectedIds.length > 0 && (
              <button 
                onClick={() => setConfirmBulkDelete(true)}
                className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl font-black uppercase text-[9px] tracking-widest border border-rose-100 shadow-sm"
              >
                Excluir ({selectedIds.length})
              </button>
            )}
          </div>
          {reversedSales.map(sale => (
            <div key={sale.id} className={`p-5 rounded-[2rem] shadow-sm border flex flex-col gap-4 ${selectedIds.includes(sale.id) ? 'bg-indigo-50/30 dark:bg-indigo-900/10 border-indigo-100' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(sale.id)}
                          onChange={() => toggleSelect(sale.id)}
                          className="w-5 h-5 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer mt-1"
                        />
                        <div>
                            <div className="text-[10px] font-black dark:text-white uppercase">{new Date(sale.date).toLocaleDateString('pt-BR')} às {new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                            <div className="flex items-center gap-2 mt-2">
                               {sale.tableNumber ? <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[8px] font-black uppercase italic">Mesa {sale.tableNumber}</span> : sale.isDelivery ? <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[8px] font-black uppercase italic">Entrega</span> : <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[8px] font-black uppercase italic">Venda Balcão</span>}
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-lg font-black text-indigo-600 italic">R$ {sale.total.toFixed(2)}</div>
                        <span className="text-[8px] font-black text-slate-400 uppercase">{sale.paymentMethod}</span>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                    <p className="text-[9px] font-bold text-slate-500 uppercase line-clamp-2">{sale.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                    {sale.tableNumber ? (
                      <button 
                        onClick={() => setSaleToReopen(sale)} 
                        className={`py-3 rounded-xl font-black uppercase text-[9px] tracking-widest min-h-[44px] bg-indigo-50 text-indigo-600`}
                      >
                        Reabrir
                      </button>
                    ) : (
                      <div className="bg-transparent" />
                    )}
                    <button 
                      onClick={() => setSaleToDelete(sale)} 
                      className={`py-3 rounded-xl font-black uppercase text-[9px] tracking-widest min-h-[44px] bg-rose-50 text-rose-600`}
                    >
                      Excluir
                    </button>
                </div>
            </div>
          ))}
      </div>

      {reversedSales.length === 0 && (
          <div className="py-24 text-center bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
             <p className="text-[10px] font-black uppercase text-slate-300 italic tracking-[0.3em]">Nenhuma venda localizada</p>
          </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {saleToDelete && (
        <DeleteConfirmationModal 
          isOpen={!!saleToDelete}
          onClose={() => setSaleToDelete(null)}
          onConfirm={handleConfirmDelete}
          title="Excluir Venda?"
          message="Esta ação irá remover o registro e estornar o estoque permanentemente."
        />
      )}

      {confirmBulkDelete && (
        <DeleteConfirmationModal 
          isOpen={confirmBulkDelete}
          onClose={() => setConfirmBulkDelete(false)}
          onConfirm={handleBulkDelete}
          title="Excluir Selecionados?"
          message={`Deseja remover ${selectedIds.length} vendas permanentemente? Esta ação irá estornar o estoque.`}
        />
      )}

      {/* CONFIRM REOPEN MODAL */}
      {saleToReopen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[2rem] p-6 shadow-2xl text-center border border-white/10 animate-in zoom-in-95">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center mb-4 mx-auto shadow-lg text-indigo-500 border border-indigo-100">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" strokeWidth={2.5}/></svg>
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase italic tracking-tighter mb-2">Reabrir Mesa {saleToReopen.tableNumber}?</h3>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase mb-6 leading-relaxed">Os itens desta venda voltarão para a mesa e a venda será excluída.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setSaleToReopen(null)} className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-colors">Voltar</button>
              <button onClick={handleConfirmReopen} className="py-3 bg-indigo-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all active:scale-95">Reabrir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;
