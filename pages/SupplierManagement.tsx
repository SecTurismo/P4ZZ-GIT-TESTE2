
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Supplier, PurchaseOrder, Product, AppSettings } from '../types';
import { getSuppliers, saveSuppliers, getPurchaseOrders, savePurchaseOrders, getProducts, saveProducts } from '../services/storage';
import { Plus, Search, Truck, ShoppingBag, Trash2, Edit2, CheckCircle, XCircle, Package, History } from 'lucide-react';

interface SupplierManagementProps {
  settings: AppSettings;
}

const SupplierManagement: React.FC<SupplierManagementProps> = ({ settings }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'suppliers' | 'purchases'>('suppliers');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '', cnpj: '', phone: '', email: '', address: '', category: '', notes: '', active: true
  });

  const maskCPF_CNPJ = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length <= 11) {
      return cleanValue
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .slice(0, 14);
    } else {
      return cleanValue
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})/, '$1-$2')
        .slice(0, 18);
    }
  };

  const maskPhone = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length <= 10) {
      return cleanValue
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .slice(0, 14);
    } else {
      return cleanValue
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .slice(0, 15);
    }
  };

  const [purchaseData, setPurchaseData] = useState<Partial<PurchaseOrder>>({
    supplierId: '', items: [], total: 0, status: 'pending', paymentStatus: 'pending'
  });

  const loadData = useCallback(async () => {
    const [s, p, pr] = await Promise.all([getSuppliers(), getPurchaseOrders(), getProducts()]);
    setSuppliers(s);
    setPurchaseOrders(p);
    setProducts(pr);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveSupplier = async () => {
    const errors: Record<string, string> = {};
    if (!formData.name?.trim()) errors.name = 'Nome é obrigatório';
    if (!formData.cnpj?.trim()) errors.cnpj = 'CPF ou CNPJ é obrigatório';
    if (!formData.phone?.trim()) errors.phone = 'Telefone é obrigatório';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const newSuppliers = [...suppliers];
    if (editingSupplier) {
      const idx = newSuppliers.findIndex(s => s.id === editingSupplier.id);
      newSuppliers[idx] = { ...editingSupplier, ...formData } as Supplier;
    } else {
      newSuppliers.push({
        id: Math.random().toString(36).substr(2, 9),
        ...formData,
        active: true
      } as Supplier);
    }
    await saveSuppliers(newSuppliers);
    setSuppliers(newSuppliers);
    setIsModalOpen(false);
    setEditingSupplier(null);
    setFormData({ name: '', cnpj: '', phone: '', email: '', address: '', category: '', notes: '', active: true });
  };

  const handleDeleteSupplier = async (id: string) => {
    const newSuppliers = suppliers.filter(s => s.id !== id);
    await saveSuppliers(newSuppliers);
    setSuppliers(newSuppliers);
  };

  const handleAddPurchaseItem = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const items = [...(purchaseData.items || [])];
    const existing = items.find(i => i.productId === productId);
    if (existing) {
      existing.quantity += 1;
      existing.totalPrice = existing.quantity * existing.unitPrice;
    } else {
      items.push({
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: product.cost || 0,
        totalPrice: product.cost || 0
      });
    }
    const total = items.reduce((acc, i) => acc + i.totalPrice, 0);
    setPurchaseData({ ...purchaseData, items, total });
  };

  const handleSavePurchase = async () => {
    if (!purchaseData.supplierId || !purchaseData.items?.length) return;
    const supplier = suppliers.find(s => s.id === purchaseData.supplierId);
    const newOrders = [...purchaseOrders];
    const newOrder: PurchaseOrder = {
      id: Math.random().toString(36).substr(2, 9),
      supplierId: purchaseData.supplierId,
      supplierName: supplier?.name || 'Desconhecido',
      date: new Date().toISOString(),
      items: purchaseData.items as any,
      total: purchaseData.total || 0,
      status: 'pending',
      paymentStatus: purchaseData.paymentStatus as any
    };
    newOrders.push(newOrder);
    await savePurchaseOrders(newOrders);
    setPurchaseOrders(newOrders);
    setIsPurchaseModalOpen(false);
    setPurchaseData({ supplierId: '', items: [], total: 0, status: 'pending', paymentStatus: 'pending' });
  };

  const handleReceivePurchase = async (orderId: string) => {
    const orders = [...purchaseOrders];
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1 && orders[idx].status === 'pending') {
      orders[idx].status = 'received';
      orders[idx].receivedAt = new Date().toISOString();
      
      // Atualizar estoque se a configuração permitir
      if (settings.suppliersAutoUpdateStock) {
        const currentProducts = [...products];
        orders[idx].items.forEach(item => {
          const pIdx = currentProducts.findIndex(p => p.id === item.productId);
          if (pIdx !== -1) {
            currentProducts[pIdx].stock += item.quantity;
            currentProducts[pIdx].cost = item.unitPrice; // Atualiza preço de custo
          }
        });
        await saveProducts(currentProducts);
        setProducts(currentProducts);
      }
      
      await savePurchaseOrders(orders);
      setPurchaseOrders(orders);
    }
  };

  const lowStockProducts = useMemo(() => {
    if (!settings.suppliersNotifyLowStock) return [];
    return products.filter(p => p.stock <= (p.minStock || 5));
  }, [products, settings.suppliersNotifyLowStock]);

  const filteredSuppliers = suppliers.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white flex items-center gap-3">
            <Truck className="w-8 h-8 text-indigo-600" />
            Compras & Fornecedores
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Gestão de suprimentos e entrada de mercadorias</p>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
          <button onClick={() => setActiveTab('suppliers')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'suppliers' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Fornecedores</button>
          <button onClick={() => setActiveTab('purchases')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'purchases' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Pedidos de Compra</button>
        </div>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl flex items-center gap-4 animate-pulse">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl">
            <Package className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300 tracking-widest">Alerta de Estoque Baixo</p>
            <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase">{lowStockProducts.length} produtos estão com estoque abaixo do mínimo recomendado.</p>
          </div>
        </div>
      )}

      {activeTab === 'suppliers' ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input 
                type="text" 
                placeholder="PESQUISAR FORNECEDOR..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
            <button onClick={() => { setEditingSupplier(null); setFormData({ name: '', active: true }); setIsModalOpen(true); }} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
              <Plus className="w-4 h-4" />
              Novo Fornecedor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSuppliers.map(supplier => (
              <div key={supplier.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 transition-colors">
                    <Truck className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingSupplier(supplier); setFormData(supplier); setIsModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteSupplier(supplier.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase text-slate-700 dark:text-white">{supplier.name}</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{supplier.category || 'Sem Categoria'}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    {supplier.phone || 'Sem Telefone'}
                  </div>
                  <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 uppercase">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                    {supplier.email || 'Sem Email'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button onClick={() => setIsPurchaseModalOpen(true)} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
              <ShoppingBag className="w-4 h-4" />
              Novo Pedido de Compra
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Data</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Fornecedor</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Total</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Status</th>
                  <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {purchaseOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">{new Date(order.date).toLocaleDateString('pt-BR')}</td>
                    <td className="px-6 py-4 text-[10px] font-black text-slate-700 dark:text-white uppercase">{order.supplierName}</td>
                    <td className="px-6 py-4 text-[10px] font-black text-indigo-600 uppercase">R$ {order.total.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest ${order.status === 'received' ? 'bg-emerald-100 text-emerald-700' : order.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {order.status === 'received' ? 'Recebido' : order.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {order.status === 'pending' && (
                        <button onClick={() => handleReceivePurchase(order.id)} className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all" title="Confirmar Recebimento">
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL FORNECEDOR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden border border-white/10">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">{editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><XCircle className="w-6 h-6 text-slate-400" /></button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Nome / Razão Social</label>
                  <input 
                    type="text" 
                    value={formData.name} 
                    onChange={e => {
                      setFormData({...formData, name: e.target.value.toUpperCase()});
                      if (formErrors.name) setFormErrors({...formErrors, name: ''});
                    }} 
                    placeholder="Digite o nome ou razão social do fornecedor"
                    className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 ${formErrors.name ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`} 
                  />
                  {formErrors.name && <p className="text-[9px] font-black text-rose-500 uppercase ml-2">{formErrors.name}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">CPF ou CNPJ</label>
                    <input 
                      type="text" 
                      value={formData.cnpj} 
                      onChange={e => {
                        setFormData({...formData, cnpj: maskCPF_CNPJ(e.target.value)});
                        if (formErrors.cnpj) setFormErrors({...formErrors, cnpj: ''});
                      }} 
                      placeholder="Digite CPF ou CNPJ"
                      className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 ${formErrors.cnpj ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`} 
                    />
                    {formErrors.cnpj && <p className="text-[9px] font-black text-rose-500 uppercase ml-2">{formErrors.cnpj}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Telefone</label>
                    <input 
                      type="text" 
                      value={formData.phone} 
                      onChange={e => {
                        setFormData({...formData, phone: maskPhone(e.target.value)});
                        if (formErrors.phone) setFormErrors({...formErrors, phone: ''});
                      }} 
                      placeholder="(00) 00000-0000"
                      className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 ${formErrors.phone ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`} 
                    />
                    {formErrors.phone && <p className="text-[9px] font-black text-rose-500 uppercase ml-2">{formErrors.phone}</p>}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Email</label>
                  <input 
                    type="email" 
                    value={formData.email} 
                    onChange={e => setFormData({...formData, email: e.target.value.toLowerCase()})} 
                    placeholder="exemplo@email.com"
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500" 
                  />
                </div>
              </div>

              <button onClick={handleSaveSupplier} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-500/20">Salvar Fornecedor</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PEDIDO DE COMPRA */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/10">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">Novo Pedido de Compra</h3>
                <button onClick={() => setIsPurchaseModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><XCircle className="w-6 h-6 text-slate-400" /></button>
              </div>

              <div className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Fornecedor</label>
                  <select value={purchaseData.supplierId} onChange={e => setPurchaseData({...purchaseData, supplierId: e.target.value})} className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">SELECIONE UM FORNECEDOR</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                  </select>
                </div>

                <div className="space-y-4">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Adicionar Produtos</label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                    {products.map(p => (
                      <button key={p.id} onClick={() => handleAddPurchaseItem(p.id)} className="flex items-center gap-3 p-3 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all text-left group">
                        <Package className="w-4 h-4 text-slate-400 group-hover:text-indigo-500" />
                        <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">{p.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Itens do Pedido</label>
                  <div className="space-y-2">
                    {purchaseData.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase text-slate-700 dark:text-white">{item.productName}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">Qtd: {item.quantity} | Unit: R$ {item.unitPrice.toFixed(2)}</span>
                        </div>
                        <span className="text-[10px] font-black text-indigo-600">R$ {item.totalPrice.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-widest">Total do Pedido</span>
                  <span className="text-xl font-black text-indigo-600">R$ {purchaseData.total?.toFixed(2)}</span>
                </div>
              </div>

              <button onClick={handleSavePurchase} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-500/20">Gerar Pedido</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierManagement;
