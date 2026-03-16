import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, Category, Addon, AppSettings } from '../types';
import { saveProducts, getCategories, getProducts, getAddons, saveAddons, saveCategories, getAppSettings, getCurrentUser } from '../services/storage';
import { LOW_STOCK_LIMIT } from '@/constants';
import { ChevronDown, ChevronUp, AlertTriangle, GripVertical, CheckCircle2, XCircle, Sparkles, Loader2, QrCode, Download } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import * as XLSX from 'xlsx';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { suggestCategoryIcon, generateRealisticProductIcon } from '../services/geminiService';
import { getCategoryIcon } from '@/utils/categoryIcons';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableProductRowProps {
  product: Product;
  isInactive: boolean;
  selectedIds: string[];
  toggleSelect: (id: string) => void;
  openModal: (product: Product) => void;
  setConfirmDelete: (data: { id: string, name: string }) => void;
}

const SortableProductRow: React.FC<SortableProductRowProps> = ({
  product, isInactive, selectedIds, toggleSelect, openModal, setConfirmDelete
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    position: isDragging ? 'relative' as const : 'static' as const,
  };

  return (
    <tr 
      ref={setNodeRef}
      style={style}
      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition group animate-in slide-in-from-top-1 duration-200 ${isInactive ? 'bg-yellow-50/30 dark:bg-yellow-900/10' : ''} ${selectedIds.includes(product.id) ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''} ${isDragging ? 'opacity-50 shadow-2xl bg-white dark:bg-slate-900' : ''}`}
    >
      <td className="px-8 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors group/grip">
              <GripVertical className="w-4 h-4 text-slate-300 group-hover/grip:text-indigo-500 transition-colors" />
            </div>
            <input 
              type="checkbox" 
              checked={selectedIds.includes(product.id)}
              onChange={(e) => { e.stopPropagation(); toggleSelect(product.id); }}
              className="w-5 h-5 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
            />
          </div>
          
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
            {product.icon ? (
              <img src={product.icon} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="text-slate-300 uppercase font-black text-[10px]">{product.name.substring(0, 2)}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-8 py-4">
        <div className="flex flex-col">
          <div className="font-black text-slate-900 dark:text-white text-[11px] uppercase italic tracking-tighter leading-tight">{product.name}</div>
          <div className="flex items-center gap-2 mt-1">
            {product.barcode && <span className="text-[8px] text-indigo-500 font-bold uppercase">EAN: {product.barcode}</span>}
            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">• Arraste para reordenar</span>
          </div>
        </div>
      </td>
      <td className="px-8 py-4 text-center">
        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase ${product.stock < 10 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
          {product.stock} un.
        </span>
      </td>
      <td className="px-8 py-4 text-right font-black italic text-slate-900 dark:text-white text-sm">R$ {product.price.toFixed(2)}</td>
      <td className="px-8 py-4 text-right">
        <div className="flex justify-end gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); openModal(product); }} 
              className={`p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 dark:bg-slate-800 rounded-xl transition-all shadow-sm`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2}/></svg>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: product.id, name: product.name }); }} 
              className={`p-2 text-slate-400 hover:text-rose-600 bg-slate-50 dark:bg-slate-800 rounded-xl transition-all shadow-sm`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2}/></svg>
            </button>
        </div>
      </td>
    </tr>
  );
};

const SortableMobileProductCard: React.FC<SortableProductRowProps> = ({
  product, isInactive, selectedIds, toggleSelect, openModal, setConfirmDelete
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    position: isDragging ? 'relative' as const : 'static' as const,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`p-5 rounded-[2rem] shadow-sm border flex flex-col gap-4 ${isInactive ? 'bg-yellow-50/30 dark:bg-yellow-900/10 border-yellow-100' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'} ${isDragging ? 'opacity-50 shadow-2xl scale-95' : ''}`}
    >
        <div className="flex justify-between items-start">
            <div className="flex items-start gap-3 flex-1">
              <div className="flex flex-col gap-2">
                <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors group/grip">
                  <GripVertical className="w-4 h-4 text-slate-300 group-hover/grip:text-indigo-500 transition-colors" />
                </div>
                <input 
                  type="checkbox" 
                  checked={selectedIds.includes(product.id)}
                  onChange={() => toggleSelect(product.id)}
                  className="w-5 h-5 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer mt-1"
                />
              </div>
              
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
                {product.icon ? (
                  <img src={product.icon} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="text-slate-300 uppercase font-black text-[10px]">{product.name.substring(0, 2)}</div>
                )}
              </div>

              <div className="flex-1 pr-4">
                  <h4 className="font-black text-xs uppercase italic text-slate-900 dark:text-white leading-tight">{product.name}</h4>
                  <p className="text-[8px] font-black text-indigo-500 uppercase mt-1">EAN: {product.barcode || 'N/A'}</p>
              </div>
            </div>
            <span className="text-sm font-black text-indigo-600 italic">R$ {product.price.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between py-3 border-y border-slate-50 dark:border-slate-800">
            <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Estoque</span>
                <span className={`text-[10px] font-black uppercase ${product.stock < 10 ? 'text-rose-600' : 'text-emerald-600'}`}>{product.stock} Unidades</span>
            </div>
            <div className="flex flex-col text-right">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Categoria</span>
                <span className="text-[10px] font-black uppercase text-slate-600 dark:text-slate-300">{product.category}</span>
            </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <button onClick={() => openModal(product)} className="py-3 bg-slate-50 dark:bg-slate-800 text-indigo-600 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-sm flex items-center justify-center gap-2 min-h-[44px]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2.5}/></svg> Editar
            </button>
            <button onClick={() => setConfirmDelete({ id: product.id, name: product.name })} className="py-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-sm flex items-center justify-center gap-2 min-h-[44px]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg> Excluir
            </button>
        </div>
    </div>
  );
};

interface ProductListProps {
  products: Product[];
  addons?: Addon[];
  onUpdate: () => void;
  initialTab?: 'products' | 'low-stock' | 'addons';
}

export const ProductList: React.FC<ProductListProps> = ({ products: initialProducts, addons: propAddons = [], onUpdate, initialTab = 'products' }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCostField, setShowCostField] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'low-stock' | 'addons'>(initialTab);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [isAddonModalOpen, setIsAddonModalOpen] = useState(false);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);
  const [addonFormData, setAddonFormData] = useState<Partial<Addon>>({
    name: '', unit: 'g', linkedProducts: []
  });
  const [confirmDeleteAddon, setConfirmDeleteAddon] = useState<{ id: string, name: string } | null>(null);
  const [addonSearchTerm, setAddonSearchTerm] = useState('');
  const [globalUsage, setGlobalUsage] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, name: string } | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', categoryId: '', category: '', price: 0, cost: 0, stock: 0, description: '', barcode: ''
  });

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  useEffect(() => {
    getAppSettings().then(setSettings);
  }, []);

  const downloadQRCode = () => {
    const canvas = document.getElementById('menu-qr-hidden') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `QR_CODE_CARDAPIO.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const loadCategories = () => {
      getCategories().then(cats => {
        // No estoque, mostramos apenas categorias ativas
        const activeCats = cats.filter(c => c.active !== false);
        const sortedCats = [...activeCats].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        setCategories(sortedCats);
      });
    };

    loadCategories();
    window.addEventListener('p4zz_data_updated', loadCategories);
    return () => window.removeEventListener('p4zz_data_updated', loadCategories);
  }, []);

  useEffect(() => {
    if (propAddons.length > 0) {
      setAddons(propAddons);
    }
  }, [propAddons]);

  useEffect(() => {
    if (isModalOpen) {
      getCategories().then(cats => setCategories(cats.filter(c => c.active !== false)));
    }
  }, [isModalOpen]);

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem('p4zz_session_user') || '{}'), []);
  const isDemoViewer = currentUser.isDemoViewer;

  const openModal = (product?: Product) => {
    setErrors({});
    if (product) {
      setEditingProduct(product);
      setFormData(product);
      setShowCostField(!!product.cost && product.cost > 0);
    } else {
      setEditingProduct(null);
      setFormData({ 
        name: '', 
        categoryId: categories[0]?.id || '', 
        category: categories[0]?.name || '', 
        price: 0, 
        cost: 0, 
        stock: 0, 
        description: '', 
        barcode: '' 
      });
      setShowCostField(false);
    }
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) newErrors.name = "O nome do item é obrigatório.";
    if (!formData.categoryId) newErrors.categoryId = "Selecione uma categoria.";
    if (!formData.price || formData.price <= 0) newErrors.price = "Informe um preço de venda válido.";
    if (formData.stock === undefined || formData.stock < 0) newErrors.stock = "Estoque não pode ser negativo.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSavingProduct(true);
    try {
      const selectedCat = categories.find(c => c.id === formData.categoryId);
      
      // Gerar ícone se for novo produto ou se o nome mudou e não tem ícone
      let productIcon = formData.icon;
      if (!editingProduct || (editingProduct.name !== formData.name && !formData.icon)) {
        productIcon = await generateRealisticProductIcon(formData.name || '');
      }

      const finalData = {
        ...formData,
        price: Number(formData.price) || 0,
        cost: showCostField ? (Number(formData.cost) || 0) : 0,
        stock: Number(formData.stock) || 0,
        category: selectedCat ? selectedCat.name : (formData.category || 'GERAL'),
        barcode: formData.barcode?.trim() || '',
        icon: productIcon
      };

      const currentProducts = await getProducts();
      let newProducts = [...currentProducts];
      if (editingProduct) {
        newProducts = newProducts.map(p => p.id === editingProduct.id ? { ...editingProduct, ...finalData } as Product : p);
      } else {
        const newProd: Product = { 
          ...finalData, 
          id: Math.random().toString(36).substr(2, 9),
          sortOrder: currentProducts.filter(p => p.categoryId === finalData.categoryId).length
        } as Product;
        newProducts.push(newProd);
      }
      await saveProducts(newProducts);
      onUpdate();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      alert('Ocorreu um erro ao salvar o produto.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const currentProducts = await getProducts();
    const updatedList = currentProducts.filter(p => p.id !== confirmDelete.id);
    await saveProducts(updatedList);
    onUpdate();
    setConfirmDelete(null);
    setSelectedIds(prev => prev.filter(id => id !== confirmDelete.id));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === allItemsFiltered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allItemsFiltered.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    const currentProducts = await getProducts();
    const updatedList = currentProducts.filter(p => !selectedIds.includes(p.id));
    await saveProducts(updatedList);
    onUpdate();
    setSelectedIds([]);
    setConfirmBulkDelete(false);
  };

  const hasLowStockAddons = useMemo(() => {
    return addons.some(addon => addon.totalQuantity < 50);
  }, [addons]);

  const { regularGroups, allItemsFiltered } = useMemo(() => {
    const baseFiltered = (initialProducts || []).filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.barcode && p.barcode.includes(searchTerm))
    );

    const filteredByTab = baseFiltered.filter(p => {
      if (activeTab === 'low-stock') return p.stock < LOW_STOCK_LIMIT;
      return p.stock >= LOW_STOCK_LIMIT;
    });

    const sorted = [...filteredByTab].sort((a, b) => {
      const orderA = a.sortOrder ?? 999999;
      const orderB = b.sortOrder ?? 999999;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

    const groups: Record<string, Product[]> = {};
    sorted.forEach(p => {
      const catName = (p.category || 'GERAL').toUpperCase();
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(p);
    });

    return { regularGroups: groups, allItemsFiltered: sorted };
  }, [initialProducts, searchTerm, activeTab, categories]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeId = active.id as string;
      const overId = over.id as string;

      const activeProduct = initialProducts.find(p => p.id === activeId);
      const overProduct = initialProducts.find(p => p.id === overId);

      if (!activeProduct || !overProduct) return;

      // Only allow reordering within the same category for now to keep it simple
      if (activeProduct.categoryId !== overProduct.categoryId) return;

      const categoryProducts = initialProducts
        .filter(p => p.categoryId === activeProduct.categoryId)
        .sort((a, b) => {
          const orderA = a.sortOrder ?? 999999;
          const orderB = b.sortOrder ?? 999999;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name);
        });

      const oldIndex = categoryProducts.findIndex(p => p.id === activeId);
      const newIndex = categoryProducts.findIndex(p => p.id === overId);

      const reorderedCategoryProducts = arrayMove(categoryProducts, oldIndex, newIndex);

      // Update sortOrder for products in this category
      const updatedCategoryProducts = reorderedCategoryProducts.map((p: Product, index: number) => ({
        ...p,
        sortOrder: index
      }));

      // Merge back into all products
      const allProducts = await getProducts();
      const updatedAll = allProducts.map((p: Product) => {
        const found = updatedCategoryProducts.find(up => up.id === p.id);
        if (found) return { ...p, sortOrder: found.sortOrder };
        return p;
      });

      await saveProducts(updatedAll);
      onUpdate();
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const openAddonModal = (addon?: Addon) => {
    if (addon) {
      setEditingAddon(addon);
      setAddonFormData(addon);
    } else {
      setEditingAddon(null);
      setAddonFormData({ name: '', unit: 'g', linkedProducts: [] });
    }
    setIsAddonModalOpen(true);
  };

  const handleSaveAddon = async () => {
    if (!addonFormData.name?.trim()) return;
    const currentAddons = await getAddons();
    let newAddons = [...currentAddons];

    const finalData = {
      ...addonFormData,
      totalQuantity: Number(addonFormData.totalQuantity) || 0,
      linkedProducts: (addonFormData.linkedProducts || []).map(lp => ({
        ...lp,
        usagePerSale: Number(lp.usagePerSale) || 0
      }))
    };

    if (editingAddon) {
      newAddons = newAddons.map(a => a.id === editingAddon.id ? { ...editingAddon, ...finalData } as Addon : a);
    } else {
      const newAddon: Addon = { ...finalData, id: Math.random().toString(36).substr(2, 9) } as Addon;
      newAddons.push(newAddon);
    }
    await saveAddons(newAddons);
    setAddons(newAddons);
    onUpdate();
    setIsAddonModalOpen(false);
  };

  const executeDeleteAddon = async () => {
    if (!confirmDeleteAddon) return;
    const currentAddons = await getAddons();
    const updatedList = currentAddons.filter(a => a.id !== confirmDeleteAddon.id);
    await saveAddons(updatedList);
    setAddons(updatedList);
    onUpdate();
    setConfirmDeleteAddon(null);
  };

  const handleAddLink = (productId: string) => {
    const product = initialProducts.find(p => p.id === productId);
    if (!product) return;
    const linkedProducts = [...(addonFormData.linkedProducts || [])];
    if (linkedProducts.find(lp => lp.productId === productId)) return;
    linkedProducts.push({ productId, productName: product.name, usagePerSale: 0 });
    setAddonFormData({ ...addonFormData, linkedProducts });
  };

  const handleRemoveLink = (productId: string) => {
    const linkedProducts = (addonFormData.linkedProducts || []).filter(lp => lp.productId !== productId);
    setAddonFormData({ ...addonFormData, linkedProducts });
  };

  const handleUsageChange = (productId: string, usage: number | undefined) => {
    const linkedProducts = (addonFormData.linkedProducts || []).map(lp => 
      lp.productId === productId ? { ...lp, usagePerSale: usage } : lp
    ) as any;
    setAddonFormData({ ...addonFormData, linkedProducts });
  };

  const applyGlobalUsage = () => {
    const usage = Number(globalUsage);
    if (isNaN(usage) || usage <= 0) return;
    
    const linkedProducts = (addonFormData.linkedProducts || []).map(lp => ({
      ...lp,
      usagePerSale: usage
    }));
    setAddonFormData({ ...addonFormData, linkedProducts });
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-900/50 p-1.5 rounded-2xl w-full md:w-fit no-print overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveTab('products')}
          className={`tab-btn px-4 md:px-6 py-3 md:py-2.5 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap ${activeTab === 'products' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Produtos
        </button>
        <button
          onClick={() => setActiveTab('low-stock')}
          className={`tab-btn px-4 md:px-6 py-3 md:py-2.5 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap ${activeTab === 'low-stock' ? 'bg-white dark:bg-slate-800 text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Estoque Baixo
          {(initialProducts.filter(p => p.stock < LOW_STOCK_LIMIT).length > 0 || hasLowStockAddons) && (
            <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('addons')}
          className={`tab-btn px-4 md:px-6 py-3 md:py-2.5 rounded-xl font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap ${activeTab === 'addons' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Complementos
          {hasLowStockAddons && (
            <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span>
          )}
        </button>
      </div>

      {activeTab !== 'addons' ? (
        <>
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 md:gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center gap-2 no-print">
                <input 
                  type="checkbox" 
                  checked={selectedIds.length === allItemsFiltered.length && allItemsFiltered.length > 0}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Todos</span>
              </div>
              <div className="relative flex-1">
                 <input 
                  type="text" 
                  placeholder="PROCURAR ITEM..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 md:pl-12 pr-4 py-3.5 md:py-4 rounded-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white font-black text-[10px] md:text-xs uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner min-h-[48px] md:min-h-[52px]"
                />
                <svg className="w-4 h-4 md:w-5 md:h-5 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            <div className="flex gap-2">
              {selectedIds.length > 0 && (
                <button 
                  onClick={() => setConfirmBulkDelete(true)}
                  className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 px-6 py-3.5 md:py-4 rounded-2xl font-black shadow-sm hover:bg-rose-100 transition active:scale-95 text-[10px] uppercase tracking-widest border border-rose-100 min-h-[48px] md:min-h-[52px]"
                >
                  Excluir ({selectedIds.length})
                </button>
              )}
              {settings?.qrCodeMenuPdf && (
                <button 
                  onClick={downloadQRCode}
                  className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 px-6 py-3.5 md:py-4 rounded-2xl font-black shadow-sm hover:bg-emerald-100 transition active:scale-95 text-[10px] uppercase tracking-widest border border-emerald-100 min-h-[48px] md:min-h-[52px] flex items-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  QR Cardápio
                </button>
              )}
              <button 
                onClick={() => openModal()}
                className={`bg-indigo-600 text-white px-6 md:px-8 py-3.5 md:py-4 rounded-2xl font-black shadow-lg uppercase text-[10px] tracking-widest min-h-[48px] md:min-h-[52px] active:scale-95 transition-all`}
              >
                + Novo Produto
              </button>
            </div>
          </div>

          {/* Hidden QR Code for Download */}
          {settings?.qrCodeMenuPdf && (
            <div className="hidden">
              <QRCodeCanvas 
                id="menu-qr-hidden"
                value={`${window.location.origin}/api.php?action=get_pdf&tenant=${getCurrentUser()?.tenantId || 'MASTER'}`} 
                size={1024} // High quality for printing
                level="H"
                includeMargin={true}
              />
            </div>
          )}

          <div className="hidden md:block bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 border-b">
                    <tr>
                      <th className="px-8 py-5 w-10"></th>
                      <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Produto / EAN</th>
                      <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Estoque</th>
                      <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Preço</th>
                      <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {categories.map(category => {
                      const catName = category.name.toUpperCase();
                      const items = regularGroups[catName] || [];
                      if (items.length === 0 && searchTerm) return null; // Hide empty categories when searching
                      if (items.length === 0 && !searchTerm && category.active === false) return null; // Hide empty inactive categories
                      
                      const isExpanded = !!expandedCategories[catName];
                      const isInactive = category.active === false;

                      return (
                        <React.Fragment key={category.id}>
                          <tr 
                            className={`${isInactive ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-slate-50 dark:bg-slate-800/40'} cursor-pointer hover:brightness-95 transition-all`}
                            onClick={() => toggleCategory(catName)}
                          >
                            <td colSpan={5} className={`px-8 py-3 text-[10px] font-black ${isInactive ? 'text-yellow-700 dark:text-yellow-500' : 'text-indigo-500'} uppercase tracking-widest italic border-y dark:border-slate-800`}>
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-3">
                                  {isInactive ? (
                                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                                  ) : (
                                    <motion.div 
                                      initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                      transition={{ duration: 0.5, ease: "easeOut" }}
                                      className={`w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-indigo-500 ${category.icon?.startsWith('data:image') ? '' : 'p-2'} border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden`}
                                    >
                                      {getCategoryIcon(category.name, category.icon)}
                                    </motion.div>
                                  )}
                                  <span className="flex items-center gap-2">
                                    {catName} 
                                    <span className="text-slate-400 not-italic ml-2">({items.length} itens)</span>
                                  </span>
                                  {isInactive && (
                                    <span className="ml-4 bg-yellow-200 dark:bg-yellow-900/40 px-2 py-0.5 rounded text-[8px] normal-case font-bold flex items-center gap-1 group/tooltip relative">
                                      <AlertTriangle className="w-3 h-3" />
                                      Categoria Inativa
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[8px] rounded shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">
                                        Esta categoria foi excluída e está inativa. Revise os produtos vinculados.
                                      </div>
                                    </span>
                                  )}
                                </span>
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && items.length > 0 && (
                            <SortableContext 
                              items={items.map(p => p.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {items.map(product => (
                                <SortableProductRow 
                                  key={product.id}
                                  product={product}
                                  isInactive={isInactive}
                                  selectedIds={selectedIds}
                                  toggleSelect={toggleSelect}
                                  openModal={openModal}
                                  setConfirmDelete={setConfirmDelete}
                                />
                              ))}
                            </SortableContext>
                          )}
                          {isExpanded && items.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-8 py-4 text-center text-[10px] font-bold text-slate-400 uppercase italic">
                                Nenhum produto nesta categoria
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </DndContext>
            </div>
          </div>

          <div className="md:hidden space-y-4">
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              {categories.map(category => {
                const catName = category.name.toUpperCase();
                const items = regularGroups[catName] || [];
                if (items.length === 0 && searchTerm) return null;
                if (items.length === 0 && !searchTerm && category.active === false) return null;

                const isExpanded = !!expandedCategories[catName];
                const isInactive = category.active === false;

                return (
                  <div key={category.id} className="space-y-3">
                    <button 
                      onClick={() => toggleCategory(catName)}
                      className={`w-full flex items-center justify-between p-4 ${isInactive ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200'} rounded-2xl border dark:border-slate-800`}
                    >
                      <div className="flex items-center gap-3">
                        {isInactive ? (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-indigo-500 ${category.icon?.startsWith('data:image') ? '' : 'p-2'} border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden`}
                          >
                            {getCategoryIcon(category.name, category.icon)}
                          </motion.div>
                        )}
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isInactive ? 'text-yellow-600' : 'text-indigo-500'} italic`}>
                          {catName}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">({items.length})</span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                    </button>

                    {isExpanded && items.length > 0 && (
                      <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                        <SortableContext 
                          items={items.map(p => p.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {items.map(product => (
                            <SortableMobileProductCard 
                              key={product.id}
                              product={product}
                              isInactive={isInactive}
                              selectedIds={selectedIds}
                              toggleSelect={toggleSelect}
                              openModal={openModal}
                              setConfirmDelete={setConfirmDelete}
                            />
                          ))}
                        </SortableContext>
                      </div>
                    )}
                    {isExpanded && items.length === 0 && (
                      <div className="p-4 text-center text-[10px] font-bold text-slate-400 uppercase italic">
                        Nenhum produto nesta categoria
                      </div>
                    )}
                  </div>
                );
              })}
            </DndContext>
          </div>
        </>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">Gestão de Complementos</h3>
            <button 
              onClick={() => openAddonModal()}
              className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-lg uppercase text-[10px] tracking-widest active:scale-95 transition-all"
            >
              + Novo Complemento
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {addons.map(addon => {
              const minUsage = Math.min(...addon.linkedProducts.map(lp => lp.usagePerSale).filter(u => u > 0), Infinity);
              const estimate = minUsage === Infinity ? 0 : Math.floor(addon.totalQuantity / minUsage);
              const isLow = addon.totalQuantity < 50;

              return (
                <div key={addon.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h4 className="font-black text-lg uppercase italic tracking-tighter text-slate-900 dark:text-white mb-1 leading-none">
                        {addon.name}
                      </h4>
                      <div className="flex items-baseline gap-1 mt-2">
                        <span className={`text-3xl font-black italic tracking-tighter ${isLow ? 'text-rose-600' : 'text-indigo-600'}`}>
                          {addon.totalQuantity}
                        </span>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{addon.unit}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openAddonModal(addon)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 dark:bg-slate-800 rounded-xl transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" strokeWidth={2.5}/></svg>
                      </button>
                      <button onClick={() => setConfirmDeleteAddon({ id: addon.id, name: addon.name })} className="p-2 text-slate-400 hover:text-rose-600 bg-slate-50 dark:bg-slate-800 rounded-xl transition-all">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeWidth={2.5}/></svg>
                      </button>
                    </div>
                  </div>

                  {isLow && (
                    <div className="mb-4 p-4 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-900/30 flex items-center gap-3 animate-pulse">
                      <div className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg">
                        <span className="text-xl">⚠️</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest leading-tight">Estoque Crítico</p>
                        <p className="text-[9px] font-bold text-rose-500 uppercase tracking-tighter">
                          Reposição necessária para {addon.name}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-2">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Produtos Vinculados</span>
                      <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">Uso / Venda</span>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar pr-1">
                      {addon.linkedProducts.map(lp => (
                        <div key={lp.productId} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                          <span className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase truncate max-w-[120px]">{lp.productName}</span>
                          <span className="text-[9px] font-black text-indigo-600">{lp.usagePerSale} {addon.unit}</span>
                        </div>
                      ))}
                      {addon.linkedProducts.length === 0 && (
                        <p className="text-[8px] font-bold text-slate-400 uppercase italic text-center py-2">Nenhum produto vinculado</p>
                      )}
                    </div>
                    {addon.linkedProducts.length > 0 && (
                      <div className="pt-4 border-t dark:border-slate-800">
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl flex flex-col items-center justify-center border border-slate-100 dark:border-slate-800">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Capacidade de Venda</span>
                          <span className="text-lg font-black italic text-indigo-600 tracking-tighter">
                            ~ {estimate} <span className="text-[10px] uppercase not-italic text-slate-400 ml-1">Vendas</span>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 max-h-[95vh] overflow-y-auto custom-scrollbar">
            {/* HEADER COM BOTÃO VOLTAR PARA MOBILE */}
            <div className="md:hidden flex items-center justify-between p-4 border-b dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px] tracking-widest"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                </svg>
                Voltar
              </button>
              <span className="text-[10px] font-black uppercase text-indigo-500 italic">
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </span>
            </div>

            <div className="p-6 md:p-8 border-b dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
              <h3 className="text-xl font-black text-slate-950 dark:text-white uppercase italic tracking-tighter leading-none">
                {editingProduct ? 'Editar Produto' : 'Cadastrar Novo Item'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-rose-500 rounded-xl bg-white dark:bg-slate-800 shadow-sm min-h-[44px] min-w-[44px] flex items-center justify-center transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 md:p-10 space-y-10">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Identificação Básica</h4>
                    </div>
                    <div className="space-y-1">
                      <label className={`text-[9px] font-black uppercase ml-2 ${errors.name ? 'text-rose-500' : 'text-slate-400'}`}>Nome do Item *</label>
                      <input 
                        autoFocus
                        value={formData.name}
                        disabled={isSavingProduct}
                        onChange={e => handleInputChange('name', e.target.value.toUpperCase())}
                        className={`w-full px-6 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 dark:text-white border-2 outline-none transition-all font-bold text-sm min-h-[56px] shadow-inner ${errors.name ? 'border-rose-500' : 'border-transparent focus:border-indigo-500'} disabled:opacity-50`}
                        placeholder="Digite o nome completo do produto"
                      />
                      {errors.name && <p className="text-[8px] font-black text-rose-500 uppercase ml-2 mt-1">{errors.name}</p>}
                    </div>
                  </div>

                  <div className="w-full md:w-32 space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Ícone do Produto</label>
                    <div className="w-32 h-32 rounded-3xl bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden relative group">
                      {formData.icon ? (
                        <img src={formData.icon} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="text-center p-4">
                          <Sparkles className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">IA gerará ao salvar</p>
                        </div>
                      )}
                      {isSavingProduct && (
                        <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Dados de Logística</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Código de Barras (EAN)</label>
                          <div className="relative">
                            <input 
                              value={formData.barcode} 
                              disabled={isSavingProduct}
                              onChange={e => handleInputChange('barcode', e.target.value)} 
                              className="w-full pl-12 pr-6 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border-none font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white shadow-inner min-h-[56px] disabled:opacity-50" 
                              placeholder="Bipe o código ou digite" 
                            />
                            <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" strokeWidth={2}/></svg>
                          </div>
                      </div>
                      <div className="space-y-1">
                        <label className={`text-[9px] font-black uppercase ml-2 ${errors.categoryId ? 'text-rose-500' : 'text-slate-400'}`}>Categoria *</label>
                        <select 
                          value={formData.categoryId}
                          disabled={isSavingProduct}
                          onChange={e => handleInputChange('categoryId', e.target.value)}
                          className={`w-full px-6 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 dark:text-white border-2 outline-none transition-all font-black uppercase text-xs min-h-[56px] shadow-inner cursor-pointer ${errors.categoryId ? 'border-rose-500' : 'border-transparent focus:border-indigo-500'} disabled:opacity-50`}
                        >
                          <option value="" disabled>SELECIONE A CATEGORIA...</option>
                          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                        </select>
                      </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Valores e Quantidades</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-1">
                        <label className={`text-[9px] font-black uppercase ml-2 ${errors.price ? 'text-rose-500' : 'text-slate-400'}`}>Preço de Venda *</label>
                        <div className="relative">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-indigo-500">R$</span>
                            <input 
                              type="number" 
                              step="0.01" 
                              value={formData.price || ''} 
                              disabled={isSavingProduct}
                              onChange={e => handleInputChange('price', Number(e.target.value))} 
                              className={`w-full pl-14 pr-6 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 font-black text-xl text-indigo-600 outline-none border-2 transition-all min-h-[56px] shadow-inner ${errors.price ? 'border-rose-500' : 'border-transparent focus:border-indigo-500'} disabled:opacity-50`} 
                              placeholder="Valor de venda" 
                            />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className={`text-[9px] font-black uppercase ml-2 ${errors.stock ? 'text-rose-500' : 'text-slate-400'}`}>Estoque Atual *</label>
                        <input 
                          type="number" 
                          value={formData.stock || ''} 
                          disabled={isSavingProduct}
                          onChange={e => handleInputChange('stock', Number(e.target.value))} 
                          className={`w-full px-6 py-5 rounded-2xl bg-slate-50 dark:bg-slate-800 font-black text-xl dark:text-white outline-none border-2 transition-all min-h-[56px] shadow-inner ${errors.stock ? 'border-rose-500' : 'border-transparent focus:border-indigo-500'} disabled:opacity-50`} 
                          placeholder="Quantidade disponível" 
                        />
                      </div>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <label className="flex items-center gap-3 group cursor-pointer w-fit">
                    <div className="relative flex items-center justify-center">
                       <input 
                        type="checkbox" 
                        checked={showCostField}
                        onChange={e => setShowCostField(e.target.checked)}
                        className="peer h-6 w-6 cursor-pointer appearance-none rounded-lg border-2 border-slate-200 bg-white dark:bg-slate-800 transition-all checked:bg-indigo-600 checked:border-indigo-600"
                       />
                       <svg className="pointer-events-none absolute h-4 w-4 text-white opacity-0 transition-opacity peer-checked:opacity-100" fill="none" stroke="currentColor" strokeWidth={4} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-[10px] font-black uppercase text-slate-500 group-hover:text-indigo-500 transition-colors tracking-widest">Informar preço de custo</span>
                  </label>

                  {showCostField && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-emerald-600 ml-2 italic tracking-widest">Preço de Custo (Opcional)</label>
                        <div className="relative">
                            <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-emerald-500">R$</span>
                            <input type="number" step="0.01" value={formData.cost || ''} onChange={e => handleInputChange('cost', Number(e.target.value))} className="w-full pl-14 pr-6 py-5 rounded-2xl bg-emerald-50/30 dark:bg-emerald-900/10 font-black text-xl text-emerald-600 outline-none border-2 border-emerald-100 dark:border-emerald-900/30 focus:border-emerald-500 min-h-[56px] shadow-inner" placeholder="Ex: 150.00" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
            </div>

            <div className="p-8 bg-white dark:bg-slate-900 border-t dark:border-slate-800 flex flex-col sm:flex-row justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)} 
                disabled={isSavingProduct}
                className="px-8 py-5 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 dark:hover:bg-slate-900 rounded-2xl transition min-h-[52px] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave} 
                disabled={isSavingProduct}
                className="bg-slate-950 dark:bg-white dark:text-slate-950 text-white px-16 py-5 rounded-2xl font-black shadow-2xl uppercase text-[11px] tracking-[0.2em] min-h-[52px] active:scale-95 transition-all hover:scale-[1.02] hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isSavingProduct ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white dark:border-slate-950/30 dark:border-t-slate-950 rounded-full animate-spin"></div>
                    <span>Gerando Ícone...</span>
                  </>
                ) : (
                  'Salvar Produto'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <DeleteConfirmationModal 
          isOpen={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={executeDelete}
          title="Excluir Produto?"
          message={`Você está prestes a remover "${confirmDelete.name}" permanentemente. Esta ação não pode ser desfeita.`}
        />
      )}

      {confirmBulkDelete && (
        <DeleteConfirmationModal 
          isOpen={confirmBulkDelete}
          onClose={() => setConfirmBulkDelete(false)}
          onConfirm={handleBulkDelete}
          title="Excluir Selecionados?"
          message={`Deseja remover ${selectedIds.length} produtos permanentemente? Esta ação não pode ser desfeita.`}
        />
      )}

      {isAddonModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 max-h-[95vh] overflow-y-auto custom-scrollbar">
            <div className="p-6 md:p-8 border-b dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
              <h3 className="text-xl font-black text-slate-950 dark:text-white uppercase italic tracking-tighter leading-none">
                {editingAddon ? 'Editar Complemento' : 'Novo Complemento'}
              </h3>
              <button onClick={() => setIsAddonModalOpen(false)} className="p-2 text-slate-400 hover:text-rose-500 rounded-xl bg-white dark:bg-slate-800 shadow-sm transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 md:p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Nome do Complemento *</label>
                  <input 
                    value={addonFormData.name}
                    onChange={e => setAddonFormData({ ...addonFormData, name: e.target.value.toUpperCase() })}
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 dark:text-white border-none outline-none font-bold text-sm shadow-inner"
                    placeholder="EX: GRANOLA"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Qtd Total *</label>
                    <input 
                      type="number"
                      value={addonFormData.totalQuantity ?? ''}
                      onChange={e => {
                        const val = e.target.value;
                        setAddonFormData({ ...addonFormData, totalQuantity: val === '' ? undefined : Number(val) });
                      }}
                      className="w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 dark:text-white border-none outline-none font-bold text-sm shadow-inner"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Unidade *</label>
                    <select 
                      value={addonFormData.unit}
                      onChange={e => setAddonFormData({ ...addonFormData, unit: e.target.value })}
                      className="w-full px-4 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 dark:text-white border-none outline-none font-black text-[10px] uppercase shadow-inner"
                    >
                      <option value="g">GRAMAS (g)</option>
                      <option value="kg">QUILOS (kg)</option>
                      <option value="ml">MILILITROS (ml)</option>
                      <option value="l">LITROS (l)</option>
                      <option value="un">UNIDADE (un)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-end mb-1">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-500 italic ml-2">Vincular Produtos</h4>
                    {addonSearchTerm.trim() !== '' && (
                      <button 
                        onClick={() => setAddonSearchTerm('')}
                        className="text-[9px] font-black text-slate-400 uppercase hover:text-rose-500 transition-colors"
                      >
                        Limpar Pesquisa
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="PESQUISAR PRODUTO PARA VINCULAR..."
                      value={addonSearchTerm}
                      onChange={e => setAddonSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 dark:text-white border-none outline-none font-bold text-xs shadow-inner"
                    />
                    <svg className="w-4 h-4 text-slate-300 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  
                  {addonSearchTerm.trim() !== '' && (
                    <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-xl max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 z-10 relative">
                      {initialProducts
                        .filter(p => 
                          p.name.toLowerCase().includes(addonSearchTerm.toLowerCase()) ||
                          (p.category && p.category.toLowerCase().includes(addonSearchTerm.toLowerCase()))
                        )
                        .map(p => {
                          const isSelected = (addonFormData.linkedProducts || []).some(lp => lp.productId === p.id);
                          return (
                            <button
                              key={p.id}
                              onClick={() => {
                                if (isSelected) {
                                  handleRemoveLink(p.id);
                                } else {
                                  handleAddLink(p.id);
                                }
                              }}
                              className={`w-full text-left px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all border-b last:border-none dark:border-slate-700 flex items-center justify-between group ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}
                            >
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden border ${isSelected ? 'border-indigo-200 dark:border-indigo-800' : 'border-slate-200 dark:border-slate-700'}`}>
                                  {p.icon ? (
                                    <img src={p.icon} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <span className="text-[10px] font-black text-slate-300">{p.name.substring(0, 2)}</span>
                                  )}
                                </div>
                                <div>
                                  <p className={`text-[11px] font-black uppercase italic tracking-tighter ${isSelected ? 'text-indigo-600' : 'text-slate-700 dark:text-white'}`}>{p.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{p.category}</span>
                                    <span className="text-[8px] font-black text-emerald-600 italic">R$ {p.price.toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 dark:border-slate-700'}`}>
                                {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                              </div>
                            </button>
                          );
                        })}
                      {initialProducts.filter(p => 
                        p.name.toLowerCase().includes(addonSearchTerm.toLowerCase())
                      ).length === 0 && (
                        <div className="px-6 py-8 text-center">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nenhum produto encontrado</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Produtos Vinculados ({addonFormData.linkedProducts?.length || 0})</p>
                    
                    {(addonFormData.linkedProducts?.length || 0) > 0 && (
                      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                        <div className="relative w-32">
                          <input 
                            type="number"
                            placeholder="GRAMATURA PADRÃO"
                            value={globalUsage}
                            onChange={e => setGlobalUsage(e.target.value)}
                            className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-[9px] font-black outline-none focus:ring-1 focus:ring-indigo-500 border-none shadow-inner"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400 uppercase">{addonFormData.unit}</span>
                        </div>
                        <button 
                          onClick={applyGlobalUsage}
                          className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-[8px] font-black uppercase tracking-widest shadow-sm active:scale-95 transition-all"
                        >
                          Aplicar a Todos
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                    {addonFormData.linkedProducts?.map(lp => (
                      <div key={lp.productId} className="flex items-center gap-4 bg-white dark:bg-slate-800/50 p-4 rounded-[1.5rem] border border-slate-100 dark:border-slate-800 group/link hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all shadow-sm">
                        <div className="flex-1 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800">
                            {initialProducts.find(p => p.id === lp.productId)?.icon ? (
                              <img src={initialProducts.find(p => p.id === lp.productId)?.icon} alt={lp.productName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="text-[10px] font-black text-slate-300">{lp.productName.substring(0, 2)}</span>
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase italic tracking-tighter text-slate-700 dark:text-white">{lp.productName}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{initialProducts.find(p => p.id === lp.productId)?.category}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-end">
                            <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Uso por venda</span>
                            <div className="relative w-24">
                              <input 
                                type="number"
                                value={lp.usagePerSale ?? ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  handleUsageChange(lp.productId, val === '' ? undefined : Number(val));
                                }}
                                className="w-full pl-3 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-[10px] font-black outline-none focus:ring-2 focus:ring-indigo-500 border-none shadow-inner"
                                placeholder="0"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-400">{addonFormData.unit}</span>
                            </div>
                          </div>
                          <button onClick={() => handleRemoveLink(lp.productId)} className="p-2.5 text-slate-300 hover:text-rose-500 transition-colors bg-slate-50 dark:bg-slate-900 rounded-xl border dark:border-slate-700 shadow-sm mt-3">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={3}/></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                    {(!addonFormData.linkedProducts || addonFormData.linkedProducts.length === 0) && (
                      <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/30 rounded-[2.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm">
                          <Sparkles className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest max-w-[200px] leading-relaxed">Use o campo de pesquisa acima para vincular produtos a este complemento</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-white dark:bg-slate-900 border-t dark:border-slate-800 flex justify-end gap-3">
              <button onClick={() => setIsAddonModalOpen(false)} className="px-8 py-4 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 rounded-2xl transition">Cancelar</button>
              <button 
                onClick={handleSaveAddon} 
                className="bg-indigo-600 text-white px-12 py-4 rounded-2xl font-black shadow-lg uppercase text-[10px] tracking-widest active:scale-95 transition-all"
              >
                Salvar Complemento
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteAddon && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[600] p-4 animate-in fade-in duration-200">
           <div className="bg-white dark:bg-slate-900 w-full max-w-[360px] rounded-[3rem] p-10 shadow-2xl border border-white/10 animate-in zoom-in-95 text-center">
              <div className="w-16 h-16 bg-rose-500 text-white rounded-2xl flex items-center justify-center mb-8 shadow-lg mx-auto">
                 <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter mb-2 leading-none">Excluir Complemento?</h3>
              <p className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase leading-relaxed mb-10">
                Você está prestes a remover <span className="text-rose-500">"{confirmDeleteAddon.name}"</span> permanentemente.
              </p>
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => setConfirmDeleteAddon(null)} className="py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200">Voltar</button>
                 <button onClick={executeDeleteAddon} className="py-4 bg-rose-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all hover:bg-rose-700">Confirmar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ProductList;
