import React, { useState, useEffect, useRef } from 'react';
import { Category, Product } from '../types';
import { getCategories, saveCategories, getProducts, saveProducts } from '../services/storage';
import { getCategoryIcon } from '../src/utils/categoryIcons';
import { suggestCategoryIcon, generateRealisticProductIcon } from '../services/geminiService';
import * as XLSX from 'xlsx';
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';
import { GripVertical, FileDown, Sparkles, Loader2, XCircle, AlertTriangle } from 'lucide-react';
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

interface SortableCategoryRowProps {
  cat: Category;
  selectedIds: string[];
  toggleSelect: (id: string) => void;
  openModal: (cat: Category) => void;
  setConfirmDelete: (data: { id: string, name: string }) => void;
}

const SortableCategoryRow: React.FC<SortableCategoryRowProps> = ({ 
  cat, selectedIds, toggleSelect, openModal, setConfirmDelete 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: cat.id });

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
      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition group ${selectedIds.includes(cat.id) ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''} ${isDragging ? 'opacity-50 shadow-2xl bg-white dark:bg-slate-900' : ''}`}
    >
      <td className="px-5 py-2">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors group/grip">
            <GripVertical className="w-4 h-4 text-slate-300 group-hover/grip:text-indigo-500 transition-colors" />
          </div>
          <input 
            type="checkbox" 
            checked={selectedIds.includes(cat.id)}
            onChange={() => toggleSelect(cat.id)}
            className="w-5 h-5 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
          />
        </div>
      </td>
      <td className="px-5 py-2">
        <span className="text-[9px] font-mono text-indigo-500 font-black uppercase">{cat.idRef || '---'}</span>
      </td>
      <td className="px-5 py-2">
        <div className="flex items-center gap-3">
          <motion.div 
            initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-indigo-500 ${cat.icon?.startsWith('data:image') ? '' : 'p-1.5'} border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden`}
          >
            {getCategoryIcon(cat.name, cat.icon)}
          </motion.div>
          <div className="flex flex-col">
            <div className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight italic text-[11px] leading-tight">{cat.name}</div>
            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Arraste para reordenar</div>
          </div>
        </div>
      </td>
      <td className="px-5 py-2 text-right">
        <div className="flex justify-end gap-2 opacity-100 lg:opacity-40 lg:group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => openModal(cat)}
            className={`text-slate-500 hover:text-indigo-600 transition p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm`}
            title="Editar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
          <button 
            onClick={() => setConfirmDelete({ id: cat.id, name: cat.name })}
            className={`text-slate-500 hover:text-rose-600 transition p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm`}
            title="Apagar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2-0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </td>
    </tr>
  );
};

const CategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catIdRef, setCatIdRef] = useState('');
  const [iconDescription, setIconDescription] = useState('');
  const [currentIcon, setCurrentIcon] = useState('');
  const [isGeneratingIcon, setIsGeneratingIcon] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  
  // Estado para o modal de confirmação de exclusão
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, name: string } | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Estados para Seleção Múltipla
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  // Estados para Importação de Excel
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fix: Awaited asynchronous fetching of categories
  useEffect(() => {
    const loadCategories = () => {
      getCategories().then(cats => {
        const activeCats = cats.filter(c => c.active !== false);
        const sortedCats = [...activeCats].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        setCategories(sortedCats);
      });
    };

    loadCategories();

    window.addEventListener('p4zz_data_updated', loadCategories);
    return () => window.removeEventListener('p4zz_data_updated', loadCategories);
  }, []);

  const currentUser = JSON.parse(localStorage.getItem('p4zz_session_user') || '{}');
  const isDemoViewer = currentUser.isDemoViewer;

  const openModal = (cat?: Category) => {
    if (cat) {
      setEditingCategory(cat);
      setCatName(cat.name);
      setCatIdRef(cat.idRef || '');
      setCurrentIcon(cat.icon || '');
      setIconDescription('');
    } else {
      setEditingCategory(null);
      setCatName('');
      setCatIdRef('');
      setCurrentIcon('');
      setIconDescription('');
    }
    setIsModalOpen(true);
  };

  const handleGenerateCustomIcon = async () => {
    const prompt = iconDescription.trim() || catName.trim();
    if (!prompt) return;
    
    // Verificar se o usuário selecionou uma chave de API (necessário para modelos de imagem 3.1)
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      try {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          setGenerationStatus('Configuração necessária...');
          await (window as any).aistudio.openSelectKey();
          // Após abrir o seletor, o usuário precisará clicar novamente para gerar
          setGenerationStatus('Chave selecionada! Clique para gerar.');
          return;
        }
      } catch (e) {
        console.warn('Erro ao verificar chave de API:', e);
      }
    }

    setIsGeneratingIcon(true);
    setGenerationStatus('Conectando com a IA...');
    try {
      setGenerationStatus('Desenhando seu ícone...');
      const icon = await generateRealisticProductIcon(prompt);
      setCurrentIcon(icon);
      setGenerationStatus('Ícone gerado com sucesso!');
      setTimeout(() => setGenerationStatus(''), 3000);
    } catch (error: any) {
      console.error('Erro ao gerar ícone:', error);
      
      if (error.message?.includes('403') || error.message?.includes('permission')) {
        setGenerationStatus('Erro: Sem permissão (Chave de API)');
        // Tentar abrir o seletor de chave se der erro de permissão
        if (typeof window !== 'undefined' && (window as any).aistudio) {
          await (window as any).aistudio.openSelectKey();
        }
      } else {
        setGenerationStatus('Erro ao gerar. Tente novamente.');
      }
    } finally {
      setIsGeneratingIcon(false);
    }
  };

  /* Fix: Changed handleSave to be async to handle awaited getCategories() */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    setIsSaving(true);

    try {
      // Fix: Awaited getCategories()
      const currentCategories = await getCategories();
      let updated: Category[];
      let targetCatId: string;

      if (editingCategory) {
        targetCatId = editingCategory.id;
        updated = currentCategories.map(c => 
          c.id === editingCategory.id 
            ? { ...c, name: catName.toUpperCase(), idRef: catIdRef.toUpperCase(), active: true, icon: currentIcon } 
            : c
        );
      } else {
        targetCatId = 'cat-' + Math.random().toString(36).substr(2, 5);
        const newCat: Category = {
          id: targetCatId,
          name: catName.toUpperCase(),
          idRef: catIdRef.toUpperCase(),
          active: true,
          icon: currentIcon,
          sortOrder: currentCategories.length
        };
        updated = [...currentCategories, newCat];
      }

      await saveCategories(updated);
      setCategories(updated.filter(c => c.active !== false));
      setIsModalOpen(false);

      // Se não houver ícone definido, gerar um em segundo plano baseado no nome
      if (!currentIcon) {
        (async () => {
          try {
            const suggestedIcon = await generateRealisticProductIcon(catName);
            const catsWithIcons = await getCategories();
            const idx = catsWithIcons.findIndex(c => c.id === targetCatId);
            if (idx !== -1) {
              catsWithIcons[idx].icon = suggestedIcon;
              await saveCategories(catsWithIcons);
              setCategories(catsWithIcons.filter(c => c.active !== false));
            }
          } catch (e) {
            console.warn('Erro ao gerar ícone em segundo plano:', e);
          }
        })();
      }

    } catch (error) {
      console.error('Erro ao salvar categoria:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    
    const currentCategories = await getCategories();
    const updated = currentCategories.map(c => 
      c.id === confirmDelete.id ? { ...c, active: false } : c
    );
    
    await saveCategories(updated);
    setCategories(updated.filter(c => c.active !== false));
    setConfirmDelete(null);
    setSelectedIds(prev => prev.filter(id => id !== confirmDelete.id));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === categories.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(categories.map(c => c.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    const currentCategories = await getCategories();
    const updated = currentCategories.map(c => 
      selectedIds.includes(c.id) ? { ...c, active: false } : c
    );
    
    await saveCategories(updated);
    setCategories(updated.filter(c => c.active !== false));
    setSelectedIds([]);
    setConfirmBulkDelete(false);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = categories.findIndex((c) => c.id === active.id);
      const newIndex = categories.findIndex((c) => c.id === over.id);

      const newOrderedCategories = arrayMove(categories, oldIndex, newIndex);
      
      // Update sortOrder for all categories
      const updatedWithSortOrder = newOrderedCategories.map((cat: Category, index: number) => ({
        ...cat,
        sortOrder: index
      }));

      setCategories(updatedWithSortOrder);

      // Save to storage
      const allCategories = await getCategories();
      const updatedAll = allCategories.map((c: Category) => {
        const found = updatedWithSortOrder.find(uc => uc.id === c.id);
        if (found) return { ...c, sortOrder: found.sortOrder };
        return c;
      });

      await saveCategories(updatedAll);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { raw: false });
      
      // Normalização básica dos dados para pré-visualização
      const normalizedData = data.map((row: any) => {
        const findKey = (possibleKeys: string[]) => {
          const key = Object.keys(row).find(k => 
            possibleKeys.some(pk => k.toLowerCase().includes(pk.toLowerCase()))
          );
          return key ? row[key] : '';
        };

        return {
          categoria: findKey(['categoria', 'category', 'grupo']),
          produto: findKey(['produto', 'product', 'nome', 'item']),
          descricao: findKey(['descricao', 'descrição', 'description', 'obs']),
          preco: findKey(['preco', 'preço', 'price', 'valor']),
          estoque: findKey(['estoque', 'quantidade', 'stock', 'qtd', 'quant']),
          barcode: findKey(['barcode', 'barras', 'ean', 'código', 'codigo'])
        };
      }).filter(item => item.produto); // Filtrar linhas sem nome de produto

      setImportPreview(normalizedData);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const normalizeString = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .trim()
      .toUpperCase()
      .replace(/\s+/g, ' '); // Remove espaços extras
  };

  const processImport = async () => {
    if (!importPreview) return;
    setIsImporting(true);

    try {
      const currentCategories = await getCategories();
      const currentProducts = await getProducts();
      
      let updatedCategories = [...currentCategories];
      let updatedProducts = [...currentProducts];
      const newCategoriesCreated: Category[] = [];

      for (const item of importPreview) {
        // 1. Tratar Categoria
        const rawCatName = (item.categoria || 'GERAL').toString().trim();
        const normalizedCatName = normalizeString(rawCatName);
        let category = updatedCategories.find(c => normalizeString(c.name) === normalizedCatName);
        
        if (!category) {
          category = {
            id: 'cat-' + Math.random().toString(36).substr(2, 5),
            name: rawCatName.toUpperCase(),
            idRef: '',
            icon: '', // Sem ícone inicialmente para não bloquear
            active: true,
            sortOrder: updatedCategories.length
          };
          updatedCategories.push(category);
          newCategoriesCreated.push(category);
        }

        // 2. Tratar Produto
        const prodNameInput = item.produto.toString().trim().toUpperCase();
        const exists = updatedProducts.find(p => p.name === prodNameInput && p.categoryId === category!.id);

        if (!exists) {
          // Limpeza de valores numéricos
          const parseNum = (val: any) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            const cleaned = val.toString().replace(/[^\d,.-]/g, '').replace(',', '.');
            const num = parseFloat(cleaned);
            return isNaN(num) ? 0 : num;
          };

          const newProduct: Product = {
            id: 'prod-' + Math.random().toString(36).substr(2, 9),
            name: prodNameInput,
            categoryId: category.id,
            category: category.name,
            description: (item.descricao || '').toString(),
            price: parseNum(item.preco),
            stock: parseNum(item.estoque),
            barcode: (item.barcode || '').toString().trim(),
            cost: 0,
            active: true,
            icon: '',
            sortOrder: updatedProducts.filter(p => p.categoryId === category!.id).length
          };
          updatedProducts.push(newProduct);
        }
      }

      await saveCategories(updatedCategories);
      await saveProducts(updatedProducts);
      
      setCategories(updatedCategories.filter(c => c.active !== false));
      setImportPreview(null);
      alert('Importação concluída! Os ícones estão sendo gerados em segundo plano.');
      
      // Notificar outros componentes
      window.dispatchEvent(new CustomEvent('p4zz_data_updated'));

      // Processar ícones em segundo plano
      if (newCategoriesCreated.length > 0) {
        (async () => {
          const catsWithIcons = [...updatedCategories];
          for (const cat of newCategoriesCreated) {
            try {
              const icon = await generateRealisticProductIcon(cat.name);
              const idx = catsWithIcons.findIndex(c => c.id === cat.id);
              if (idx !== -1) {
                catsWithIcons[idx].icon = icon;
                await saveCategories(catsWithIcons);
                setCategories(catsWithIcons.filter(c => c.active !== false));
              }
            } catch (e) {
              console.warn(`Erro ao gerar ícone para categoria ${cat.name}:`, e);
            }
          }
        })();
      }
    } catch (error) {
      console.error('Erro na importação:', error);
      alert('Ocorreu um erro ao importar os dados.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportExcel = async () => {
    const allProducts = await getProducts();
    const dataToExport = allProducts.map(p => ({
      'PRODUTO': p.name.toUpperCase(),
      'CATEGORIA': (p.category || 'GERAL').toUpperCase(),
      'ESTOQUE': p.stock,
      'PREÇO': p.price,
      'CUSTO': p.cost || 0,
      'EAN': p.barcode || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque");
    XLSX.writeFile(wb, `Relatorio_Estoque_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center mb-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={selectedIds.length === categories.length && categories.length > 0}
              onChange={toggleSelectAll}
              className="w-5 h-5 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
            />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Todos</span>
          </div>
          <div className="h-8 w-px bg-slate-100 dark:bg-slate-800"></div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic leading-none">Organização do Catálogo</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1.5">{categories.length} categorias cadastradas.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <button 
              onClick={() => setConfirmBulkDelete(true)}
              className="bg-rose-50 dark:bg-rose-900/20 text-rose-600 px-5 py-2.5 rounded-xl font-black shadow-sm hover:bg-rose-100 dark:hover:bg-rose-900/40 transition active:scale-95 text-[9px] uppercase tracking-widest border border-rose-100 dark:border-rose-900/30"
            >
              Excluir ({selectedIds.length})
            </button>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-5 py-2.5 rounded-xl font-black shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition active:scale-95 text-[9px] uppercase tracking-widest border border-slate-200 dark:border-slate-700"
          >
            Importar Excel
          </button>
          <button 
            onClick={handleExportExcel}
            className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-5 py-2.5 rounded-xl font-black shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition active:scale-95 text-[9px] uppercase tracking-widest border border-slate-200 dark:border-slate-700 flex items-center gap-2"
          >
            <FileDown className="w-3.5 h-3.5" />
            Exportar
          </button>
          <button 
            onClick={() => openModal()}
            className={`bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-black shadow-lg hover:bg-indigo-700 transition active:scale-95 text-[9px] uppercase tracking-widest`}
          >
            + Nova Categoria
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={categories.map(c => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3 w-16"></th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">ID REF</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Nome da Categoria</th>
                  <th className="px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Gerenciar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {categories.map(cat => (
                  <SortableCategoryRow 
                    key={cat.id}
                    cat={cat}
                    selectedIds={selectedIds}
                    toggleSelect={toggleSelect}
                    openModal={openModal}
                    setConfirmDelete={setConfirmDelete}
                  />
                ))}
                {categories.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center opacity-30 italic font-black uppercase text-[10px] tracking-widest">Nenhuma categoria encontrada</td>
                  </tr>
                )}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
      </div>

      {/* MODAL DE EDIÇÃO/CRIAÇÃO */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
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
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </span>
            </div>

            <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-rose-500">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="flex flex-col items-center mb-6">
                  <div className="w-24 h-24 rounded-3xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 shadow-inner flex items-center justify-center overflow-hidden relative group p-2">
                    {getCategoryIcon(catName, currentIcon)}
                    {isGeneratingIcon && (
                      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-3">
                    {generationStatus || 'Pré-visualização do Ícone'}
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Nome da Categoria</label>
                  <input 
                    required autoFocus value={catName} onChange={e => setCatName(e.target.value)}
                    placeholder="EX: BEBIDAS, LANCHES..."
                    disabled={isSaving || isGeneratingIcon}
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 outline-none font-black text-lg uppercase focus:border-indigo-500 transition-colors disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Descrição para Gerar Ícone (Opcional)</label>
                  <div className="flex gap-2">
                    <input 
                      value={iconDescription} onChange={e => setIconDescription(e.target.value)}
                      placeholder="EX: Tigela com 3 bolas de sorvete"
                      disabled={isSaving || isGeneratingIcon}
                      className="flex-1 px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 outline-none font-bold text-sm focus:border-indigo-500 transition-colors disabled:opacity-50"
                    />
                    <button 
                      type="button"
                      onClick={handleGenerateCustomIcon}
                      disabled={isSaving || isGeneratingIcon || (!iconDescription && !catName)}
                      className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg hover:bg-indigo-700 disabled:opacity-50 active:scale-95 transition-all"
                      title="Gerar Ícone"
                    >
                      {isGeneratingIcon ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                    </button>
                  </div>
                  <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-2 ml-1">
                    * Deixe em branco para gerar baseado no nome da categoria.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">ID REF (Opcional)</label>
                  <input 
                    value={catIdRef} onChange={e => setCatIdRef(e.target.value)}
                    placeholder="EX: REF01"
                    disabled={isSaving || isGeneratingIcon}
                    className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 outline-none font-black text-sm uppercase focus:border-indigo-500 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>
              <button 
                type="submit" 
                disabled={isSaving || isGeneratingIcon}
                className="w-full bg-slate-950 dark:bg-white dark:text-slate-950 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  'Salvar Categoria'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE PRÉ-VISUALIZAÇÃO DE IMPORTAÇÃO */}
      {importPreview && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[500] p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-white/10 relative">
            
            {/* LOADING OVERLAY */}
            {isImporting && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-[210] flex flex-col items-center justify-center animate-in fade-in duration-500">
                <div className="relative">
                  <div className="w-24 h-24 border-4 border-indigo-100 dark:border-indigo-900/30 rounded-full"></div>
                  <div className="w-24 h-24 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-indigo-600 animate-pulse" />
                  </div>
                </div>
                <div className="mt-8 text-center space-y-2">
                  <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter">Processando Inteligência Artificial</h4>
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-400 animate-bounce">A IA está gerando os ícones, aguarde...</p>
                </div>
                
                {/* PROGRESS BARS ANIMATION */}
                <div className="mt-12 flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div 
                      key={i} 
                      className="w-1.5 h-8 bg-indigo-600 rounded-full animate-pulse" 
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase italic tracking-tighter">
                  Pré-visualização da Importação
                </h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Verifique os dados antes de confirmar</p>
              </div>
              <button 
                onClick={() => setImportPreview(null)} 
                disabled={isImporting}
                className="p-2 text-slate-400 hover:text-rose-500 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
                    <tr>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Código</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Produto</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Preço</th>
                      <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Estoque</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {importPreview.map((item, idx) => (
                      <tr key={idx} className="hover:bg-white dark:hover:bg-slate-900 transition-colors">
                        <td className="px-4 py-3 text-[10px] font-bold text-indigo-500 uppercase">{item.categoria || '---'}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-slate-500">{item.barcode || '---'}</td>
                        <td className="px-4 py-3 text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase italic">{item.produto}</td>
                        <td className="px-4 py-3 text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]">{item.descricao || '---'}</td>
                        <td className="px-4 py-3 text-[11px] font-black text-emerald-600">R$ {parseFloat(item.preco.toString().replace(',', '.') || '0').toFixed(2)}</td>
                        <td className="px-4 py-3 text-[11px] font-black text-slate-700 dark:text-slate-300">{item.estoque || '0'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button 
                onClick={() => setImportPreview(null)}
                className="px-8 py-4 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-300 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={processImport}
                disabled={isImporting}
                className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {isImporting ? 'Processando...' : `Confirmar Importação (${importPreview.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <DeleteConfirmationModal 
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={executeDelete}
        title="Apagar Categoria?"
        message={`Remover "${confirmDelete?.name}" permanentemente? Ela ficará inativa no estoque.`}
      />

      <DeleteConfirmationModal 
        isOpen={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={handleBulkDelete}
        title="Apagar Selecionados?"
        message={`Deseja remover ${selectedIds.length} categorias permanentemente? Elas ficarão inativas no estoque.`}
      />
    </div>
  );
};

export default CategoryManagement;