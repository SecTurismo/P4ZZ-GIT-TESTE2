import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Fiado, FiadoItem, Product, AppSettings } from '../types';
import { 
  saveFiado, 
  deleteFiado as storageDeleteFiado, 
  getAppSettings, 
  getProducts,
  getCurrentUser,
  DEFAULT_SETTINGS
} from '../services/storage';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { CheckCircle2, Sparkles, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FiadoManagementProps {
  fiados: Fiado[];
  onUpdate: () => void;
}

const FiadoManagement: React.FC<FiadoManagementProps> = ({ fiados: initialFiados, onUpdate }) => {
  const [localFiados, setLocalFiados] = useState<Fiado[]>(initialFiados);
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [printingFiado, setPrintingFiado] = useState<Fiado | null>(null);
  const [editingFiado, setEditingFiado] = useState<Fiado | null>(null);
  
  const [customerName, setCustomerName] = useState('');
  const [selectedItems, setSelectedItems] = useState<FiadoItem[]>([]);
  
  const [searchProduct, setSearchProduct] = useState('');
  const [listSearch, setListSearch] = useState('');
  
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const listSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalFiados(initialFiados);
    getAppSettings().then(setSettings);
    getProducts().then(prods => setProducts(prods.filter(p => p.active !== false)));

    // Auto-focus on list search when entering the page
    setTimeout(() => {
      listSearchRef.current?.focus();
    }, 300);
  }, [initialFiados]);

  const handleAddItem = (product: Product) => {
    const existingIndex = selectedItems.findIndex(item => item.productId === product.id);
    
    if (existingIndex !== -1) {
      const updatedItems = [...selectedItems];
      updatedItems[existingIndex].quantity += 1;
      setSelectedItems(updatedItems);
    } else {
      const newItem: FiadoItem = {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        price: product.price
      };
      setSelectedItems([...selectedItems, newItem]);
    }
  };

  const updateItemQuantity = (index: number, delta: number) => {
    const updatedItems = [...selectedItems];
    const newQty = Math.max(1, updatedItems[index].quantity + delta);
    
    // Check stock if needed, but for Fiado usually we just allow it or check at save
    updatedItems[index].quantity = newQty;
    setSelectedItems(updatedItems);
  };

  const filteredSearchProducts = useMemo(() => {
    if (searchProduct.length < 1) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(searchProduct.toLowerCase()) || 
      (p.barcode && p.barcode.includes(searchProduct))
    );
  }, [products, searchProduct]);

  const handleRemoveItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const filteredFiados = useMemo(() => {
    if (!listSearch.trim()) return localFiados;
    return localFiados.filter(f => 
      f.customerName.toLowerCase().includes(listSearch.toLowerCase()) ||
      f.items.some(i => i.productName.toLowerCase().includes(listSearch.toLowerCase()))
    );
  }, [localFiados, listSearch]);

  const total = selectedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || selectedItems.length === 0) return;

    const user = getCurrentUser();
    const fiadoData: Fiado = {
      id: editingFiado ? editingFiado.id : `fiado-${Math.random().toString(36).substr(2, 9)}`,
      customerName: customerName.toUpperCase(),
      items: selectedItems,
      total: total,
      date: editingFiado ? editingFiado.date : new Date().toISOString(),
      status: editingFiado ? editingFiado.status : 'Pendente',
      userId: user?.id || 'unknown',
      userName: user?.name || 'Sistema'
    };

    const success = await saveFiado(fiadoData);
    if (success) {
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      setCustomerName('');
      setSelectedItems([]);
      setEditingFiado(null);
      setIsModalOpen(false);
      onUpdate();
    } else {
      alert('Erro ao salvar fiado. Verifique o estoque.');
    }
  };

  const handleEdit = (fiado: Fiado) => {
    setEditingFiado(fiado);
    setCustomerName(fiado.customerName);
    setSelectedItems(fiado.items);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await storageDeleteFiado(deletingId);
    setDeletingId(null);
    setSelectedIds(prev => prev.filter(id => id !== deletingId));
    onUpdate();
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === localFiados.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(localFiados.map(f => f.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await storageDeleteFiado(id);
    }
    setSelectedIds([]);
    setConfirmBulkDelete(false);
    onUpdate();
  };

  const handlePrint = async (fiado: Fiado) => {
    setPrintingFiado(fiado);
    const delay = settings.printSettings?.printDelay || 500;
    setTimeout(() => {
      window.print();
      setPrintingFiado(null);
    }, delay);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24 md:pb-0">
      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-8 py-4 rounded-full shadow-2xl font-black text-[9px] uppercase tracking-widest animate-in slide-in-from-top-4">
          Fiado Registrado com Sucesso
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 no-print">
            <input 
              type="checkbox" 
              checked={selectedIds.length === localFiados.length && localFiados.length > 0}
              onChange={toggleSelectAll}
              className="w-5 h-5 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
            />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Todos</span>
          </div>
          <div>
            <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">Controle de Fiados</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Gerencie saídas de produtos para pagamento posterior</p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input 
              ref={listSearchRef}
              type="text"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="BUSCAR CLIENTE OU ITEM..."
              className="w-full pl-10 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-bold text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
          {selectedIds.length > 0 && (
            <button 
              onClick={() => setConfirmBulkDelete(true)}
              className="flex-1 md:flex-none bg-rose-50 dark:bg-rose-900/20 text-rose-600 px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-rose-100 shadow-sm hover:bg-rose-100 transition active:scale-95"
            >
              Excluir ({selectedIds.length})
            </button>
          )}
          <button 
            onClick={() => {
              setEditingFiado(null);
              setCustomerName('');
              setSelectedItems([]);
              setIsModalOpen(true);
            }} 
            style={{ backgroundColor: settings.primaryColor }}
            className="flex-1 md:flex-none text-white px-10 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:brightness-110 active:scale-95 transition-all"
          >
            + Novo Fiado
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800">
              <tr>
                <th className="px-8 py-5 w-10"></th>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Data / Hora</th>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Itens</th>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredFiados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center opacity-30 italic font-black uppercase text-[10px] tracking-widest">Nenhum fiado encontrado</td>
                </tr>
              ) : (
                [...filteredFiados].reverse().map(fiado => (
                  <tr key={fiado.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all ${selectedIds.includes(fiado.id) ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                    <td className="px-8 py-4">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(fiado.id)}
                        onChange={() => toggleSelect(fiado.id)}
                        className="w-5 h-5 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                      />
                    </td>
                    <td className="px-8 py-4">
                      <div className="text-[10px] font-bold text-slate-500">{new Date(fiado.date).toLocaleDateString('pt-BR')}</div>
                      <div className="text-[8px] text-slate-400 font-black">{new Date(fiado.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="px-8 py-4">
                      <span className="text-[11px] font-black uppercase text-slate-900 dark:text-white italic">{fiado.customerName}</span>
                    </td>
                    <td className="px-8 py-4">
                      <div className="text-[9px] text-slate-500 font-bold uppercase truncate max-w-[200px]">
                        {fiado.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                      </div>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 italic">R$ {fiado.total.toFixed(2)}</span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handlePrint(fiado)}
                          className="p-2 text-slate-300 hover:text-indigo-500 transition-colors"
                          title="Imprimir Nota"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" strokeWidth={2.5}/></svg>
                        </button>
                        <button 
                          onClick={() => handleEdit(fiado)}
                          className="p-2 text-slate-300 hover:text-emerald-500 transition-colors"
                          title="Editar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" strokeWidth={2.5}/></svg>
                        </button>
                        <button 
                          onClick={() => setDeletingId(fiado.id)}
                          className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                          title="Excluir"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            {/* HEADER COM BOTÃO VOLTAR PARA MOBILE */}
            <div className="md:hidden flex items-center justify-between mb-6 pb-4 border-b dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingFiado(null);
                  setCustomerName('');
                  setSelectedItems([]);
                }}
                className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px] tracking-widest"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
                Voltar
              </button>
              <span className="text-[10px] font-black uppercase text-indigo-500 italic">
                {editingFiado ? 'Editar Fiado' : 'Novo Fiado'}
              </span>
            </div>

            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">{editingFiado ? 'Editar Fiado' : 'Novo Fiado'}</h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingFiado(null);
                  setCustomerName('');
                  setSelectedItems([]);
                }} 
                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3} /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Nome do Cliente</label>
                <input 
                  autoFocus 
                  required 
                  value={customerName} 
                  onChange={e => setCustomerName(e.target.value)} 
                  className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl font-bold text-sm uppercase outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" 
                  placeholder="Nome do cliente" 
                />
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2.5rem] space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-end mb-1">
                    <label className="text-[10px] font-black uppercase text-indigo-500 ml-2 block tracking-widest italic">1. Pesquisar Itens no Cardápio</label>
                    {searchProduct.trim() !== '' && (
                      <button 
                        type="button"
                        onClick={() => setSearchProduct('')}
                        className="text-[9px] font-black text-slate-400 uppercase hover:text-rose-500 transition-colors"
                      >
                        Limpar Pesquisa
                      </button>
                    )}
                  </div>
                  <div className="relative group">
                    <input 
                      value={searchProduct} 
                      onChange={e => setSearchProduct(e.target.value)} 
                      placeholder="BUSCAR NOME OU BIPAR CÓDIGO..." 
                      className="w-full px-12 py-5 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-[2rem] font-black uppercase text-xs outline-none transition-all dark:text-white shadow-inner"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5" />
                  </div>
                  
                  {searchProduct.trim() !== '' && (
                    <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-[2rem] shadow-2xl max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 z-10 relative">
                      {filteredSearchProducts.map(p => {
                        const isSelected = selectedItems.some(item => item.productId === p.id);
                        return (
                          <button 
                            key={p.id} 
                            type="button"
                            onClick={() => handleAddItem(p)} 
                            className={`w-full px-6 py-4 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border-b dark:border-white/5 last:border-0 flex justify-between items-center transition-all group ${isSelected ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden border ${isSelected ? 'border-indigo-200 dark:border-indigo-800' : 'border-slate-200 dark:border-slate-700'}`}>
                                {p.icon ? (
                                  <img src={p.icon} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <span className="text-[10px] font-black text-slate-300">{p.name.substring(0, 2)}</span>
                                )}
                              </div>
                              <div>
                                <p className={`text-[11px] font-black uppercase italic tracking-tighter ${isSelected ? 'text-indigo-600' : 'text-slate-800 dark:text-white'}`}>{p.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{p.category}</span>
                                  <span className="text-[8px] font-black text-emerald-600 italic">R$ {p.price.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 dark:border-slate-700'}`}>
                              {isSelected ? <CheckCircle2 className="w-4 h-4 text-white" /> : <span className="text-[10px] font-black text-slate-300">+</span>}
                            </div>
                          </button>
                        );
                      })}
                      {filteredSearchProducts.length === 0 && (
                        <div className="px-6 py-10 text-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum produto encontrado</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest italic">2. Itens Selecionados ({selectedItems.length})</p>
                    {selectedItems.length > 0 && (
                      <button 
                        type="button"
                        onClick={() => setSelectedItems([])}
                        className="text-[9px] font-black text-rose-500 uppercase hover:underline"
                      >
                        Limpar Tudo
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                    <AnimatePresence mode="popLayout">
                      {selectedItems.map((item, idx) => (
                        <motion.div 
                          layout
                          initial={{ opacity: 0, scale: 0.9, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: -10 }}
                          key={item.productId} 
                          className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 shadow-sm group hover:border-indigo-100 dark:hover:border-indigo-900/50 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800">
                              {products.find(p => p.id === item.productId)?.icon ? (
                                <img src={products.find(p => p.id === item.productId)?.icon} alt={item.productName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-[10px] font-black text-slate-300">{item.productName.substring(0, 2)}</span>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase italic tracking-tighter text-slate-900 dark:text-white">{item.productName}</span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Unitário: R$ {item.price.toFixed(2)}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex items-center bg-slate-50 dark:bg-slate-800 rounded-xl p-1 border border-slate-100 dark:border-slate-700 shadow-inner">
                              <button 
                                type="button" 
                                onClick={() => updateItemQuantity(idx, -1)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-rose-500 transition-all font-black"
                              >
                                -
                              </button>
                              <span className="w-8 text-center text-[11px] font-black text-slate-900 dark:text-white italic">{item.quantity}</span>
                              <button 
                                type="button" 
                                onClick={() => updateItemQuantity(idx, 1)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-700 text-slate-400 hover:text-emerald-500 transition-all font-black"
                              >
                                +
                              </button>
                            </div>
                            
                            <div className="text-right min-w-[70px]">
                              <span className="text-[11px] font-black text-indigo-600 italic block">R$ {(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                            
                            <button 
                              type="button" 
                              onClick={() => handleRemoveItem(idx)} 
                              className="p-2 text-slate-300 hover:text-rose-500 transition-colors bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-700 shadow-sm"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    
                    {selectedItems.length === 0 && (
                      <div className="text-center py-12 bg-white dark:bg-slate-900/30 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm">
                          <Sparkles className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest max-w-[200px] leading-relaxed">Pesquise e selecione produtos acima para registrar no fiado</p>
                      </div>
                    )}
                  </div>

                  {selectedItems.length > 0 && (
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                      <div className="bg-slate-950 p-6 rounded-[2rem] border-b-4 border-rose-600 flex justify-between items-center shadow-2xl animate-in slide-in-from-bottom-2">
                        <div>
                          <span className="font-black text-rose-400 uppercase tracking-widest" style={{ fontSize: '10px' }}>Total do Fiado</span>
                          <p className="text-3xl font-black text-white italic tracking-tighter leading-none mt-1">R$ {total.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-black text-slate-500 uppercase tracking-widest block" style={{ fontSize: '8px' }}>Itens Totais</span>
                          <span className="text-xl font-black text-white italic">{selectedItems.reduce((acc, i) => acc + i.quantity, 0)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={selectedItems.length === 0}
                style={{ backgroundColor: settings.primaryColor }}
                className="w-full py-5 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl active:scale-95 transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar Fiado
              </button>
            </form>
          </div>
        </div>
      )}

      {deletingId && (
        <DeleteConfirmationModal 
          isOpen={!!deletingId}
          onClose={() => setDeletingId(null)}
          onConfirm={handleDelete}
          title="Excluir Fiado?"
          message="Esta ação irá remover o registro e estornar o estoque permanentemente."
        />
      )}

      {confirmBulkDelete && (
        <DeleteConfirmationModal 
          isOpen={confirmBulkDelete}
          onClose={() => setConfirmBulkDelete(false)}
          onConfirm={handleBulkDelete}
          title="Excluir Selecionados?"
          message={`Deseja remover ${selectedIds.length} fiados permanentemente? Esta ação irá estornar o estoque.`}
        />
      )}

      {/* ÁREA DE IMPRESSÃO (OTIMIZADA PARA TÉRMICA) */}
      {printingFiado && (
        <div className="fixed inset-0 bg-white z-[9999] p-2 text-black font-mono text-[10px] print-only block leading-tight">
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
                padding: 5mm;
              }
              .no-print { display: none !important; }
            }
          `}} />
          <div className="text-center border-b border-dashed border-black pb-2 mb-2">
            <h2 className="text-sm font-bold uppercase">{settings.printSettings?.receiptHeader || settings.systemName}</h2>
            {settings.printSettings?.receiptMessage && <p className="text-[8px] font-bold uppercase italic">{settings.printSettings.receiptMessage}</p>}
            <p className="text-[8px] uppercase">Comprovante de Fiado</p>
          </div>
          
          <div className="space-y-1 mb-2 text-[9px]">
            <p><strong>DATA:</strong> {new Date(printingFiado.date).toLocaleDateString('pt-BR')} {new Date(printingFiado.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
            <p><strong>CLIENTE:</strong> {printingFiado.customerName}</p>
            <p><strong>VENDEDOR:</strong> {printingFiado.userName}</p>
          </div>

          <div className="border-b border-dashed border-black mb-2">
            <table className="w-full text-left text-[9px]">
              <thead>
                <tr className="border-b border-black">
                  <th className="py-1">ITEM</th>
                  <th className="py-1 text-center">QTD</th>
                  <th className="py-1 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {printingFiado.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-1 uppercase max-w-[80px] truncate">{item.productName}</td>
                    <td className="py-1 text-center">{item.quantity}</td>
                    <td className="py-1 text-right">R${(item.price * item.quantity).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-right text-xs font-bold mb-4">
            TOTAL: R$ {printingFiado.total.toFixed(2)}
          </div>

          <div className="mt-6 text-center border-t border-dashed border-black pt-2">
            <p className="text-[8px] uppercase italic">Assinatura do Cliente</p>
            <div className="mt-8 border-b border-black w-32 mx-auto"></div>
          </div>
          
          <div className="mt-4 text-center text-[7px] opacity-50">
            <p>{settings.printSettings?.receiptFooter || ''}</p>
            <p>{new Date().toLocaleString('pt-BR')}</p>
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
            padding: 5mm;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default FiadoManagement;
