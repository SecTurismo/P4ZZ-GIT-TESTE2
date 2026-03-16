
import React, { useState } from 'react';
import { AppSettings } from '../types';
import { saveAppSettings } from '../services/storage';

interface LabelCustomizationProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
}

const LabelCustomization: React.FC<LabelCustomizationProps> = ({ settings, onUpdateSettings }) => {
  const [localLabels, setLocalLabels] = useState<Record<string, string>>(settings.customLabels || {});
  const [activeCategory, setActiveCategory] = useState<'menus' | 'titles' | 'ui'>('menus');
  const [showToast, setShowToast] = useState(false);

  const categories = {
    menus: [
      { key: 'menu_dashboard', label: 'Dashboard', def: 'Painel' },
      { key: 'menu_tables', label: 'Monitoramento', def: 'Mesas' },
      { key: 'menu_new_sale', label: 'Lançamento Rápido', def: 'Venda Direta' },
      { key: 'menu_expenses', label: 'Saídas Financeiras', def: 'Custos Extras' },
      { key: 'menu_products', label: 'Gerenciamento de Itens', def: 'Estoque' },
      { key: 'menu_categories', label: 'Grupos de Itens', def: 'Categorias' },
      { key: 'menu_sales_history', label: 'Relatórios de Venda', def: 'Histórico' },
      { key: 'menu_reports', label: 'Analítico', def: 'Relatórios' },
    ],
    titles: [
      { key: 'view_dashboard', label: 'Título Dashboard', def: 'Painel de Controle' },
      { key: 'view_tables', label: 'Título Monitoramento', def: 'Gestão de Mesas' },
      { key: 'view_new_sale', label: 'Título Nova Venda', def: 'Nova Venda Direta' },
      { key: 'view_products', label: 'Título Estoque', def: 'Estoque de Produtos' },
      { key: 'view_expenses', label: 'Título Custos', def: 'Despesas Extras' },
      { key: 'view_reports', label: 'Título Relatórios', def: 'Relatórios Gerenciais' },
    ],
    ui: [
      { key: 'ui_new_record', label: 'Botão de Ação Rápida', def: 'Novo Registro' },
    ]
  };

  const handleUpdate = (key: string, value: string) => {
    setLocalLabels(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const updatedSettings = { ...settings, customLabels: localLabels };
    saveAppSettings(updatedSettings);
    onUpdateSettings(updatedSettings);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleReset = (key: string) => {
    const newLabels = { ...localLabels };
    delete newLabels[key];
    setLocalLabels(newLabels);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-8 py-4 rounded-full shadow-2xl font-black text-xs uppercase tracking-widest animate-in slide-in-from-top-4">
          Termos Atualizados com Sucesso
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Personalização de Linguagem</p>
          <p className="text-sm font-medium text-slate-500 mt-1">Adapte os nomes dos menus e botões ao seu nicho de negócio.</p>
        </div>
        <button 
          onClick={handleSave}
          style={{ backgroundColor: settings.primaryColor }}
          className="w-full md:w-auto text-white px-10 py-5 rounded-[2rem] font-black shadow-2xl hover:brightness-110 active:scale-95 transition-all uppercase text-[10px] tracking-widest"
        >
          Aplicar Novas Etiquetas
        </button>
      </div>

      <div className="flex bg-slate-200 dark:bg-slate-800 p-1.5 rounded-[2rem] w-fit mx-auto shadow-inner mb-8">
        {(['menus', 'titles', 'ui'] as const).map(cat => (
          <button 
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-8 py-4 rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeCategory === cat ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {cat === 'menus' ? 'Menus Laterais' : cat === 'titles' ? 'Títulos de Página' : 'Interface (Botões)'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {categories[activeCategory].map(item => (
          <div key={item.key} className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-6 group">
            <div className="flex-1 w-full space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{item.label}</p>
              <div className="relative">
                <input 
                  value={localLabels[item.key] || ''} 
                  onChange={e => handleUpdate(item.key, e.target.value)}
                  placeholder={item.def}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-black text-sm outline-none focus:ring-2 focus:ring-indigo-500 pr-16"
                />
                {localLabels[item.key] && (
                  <button 
                    onClick={() => handleReset(item.key)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-500 font-black text-[9px] uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 min-w-[150px]">
              <span className="text-[8px] font-black text-slate-400 uppercase mb-1">Padrão do Sistema</span>
              <span className="text-[10px] font-black text-slate-600 line-through opacity-50 uppercase tracking-widest">{item.def}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="p-8 bg-indigo-50 dark:bg-indigo-950/20 rounded-[3rem] border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 shrink-0">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest italic">Nota de Personalização</p>
          <p className="text-[10px] font-bold text-indigo-600/80 leading-relaxed uppercase">Ao trocar um termo no dicionário, ele será aplicado instantaneamente em todo o sistema para o seu terminal. Use isso para transformar o sistema em uma ferramenta específica para seu tipo de negócio.</p>
        </div>
      </div>
    </div>
  );
};

export default LabelCustomization;
