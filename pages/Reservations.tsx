
import React, { useState, useEffect, useCallback } from 'react';
import { Reservation, Table, AppSettings } from '../types';
import { getReservations, saveReservations, getTables, saveTables } from '../services/storage';
import { Calendar, Clock, Users, Plus, Search, Trash2, CheckCircle, XCircle, User, Phone, MessageSquare, Edit } from 'lucide-react';

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
  return cleanValue
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .slice(0, 14);
};

const maskWhatsApp = (value: string) => {
  const cleanValue = value.replace(/\D/g, '');
  return cleanValue
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15);
};

interface ReservationsProps {
  settings: AppSettings;
}

const Reservations: React.FC<ReservationsProps> = ({ settings }) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<Reservation['status'] | 'all'>('all');
  
  const [formData, setFormData] = useState<Partial<Reservation>>({
    customerName: '', 
    customerWhatsApp: '',
    customerDocument: '',
    date: new Date().toISOString().split('T')[0], 
    time: '19:00', 
    guests: 2, 
    tableId: 0, 
    notes: '', 
    status: settings.reservationsAutoConfirm ? 'confirmed' : 'pending'
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    const [r, t] = await Promise.all([getReservations(), getTables()]);
    setReservations(r.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)));
    setTables(t);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    if (!formData.customerName?.trim()) errors.customerName = 'Nome é obrigatório';
    if (!formData.date) errors.date = 'Data é obrigatória';
    if (!formData.time) errors.time = 'Horário é obrigatório';
    if (!formData.tableId) errors.tableId = 'Mesa é obrigatória';
    if (!formData.guests || formData.guests <= 0) errors.guests = 'Informe a quantidade de pessoas da reserva.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    const table = tables.find(t => t.id === Number(formData.tableId));
    let newReservations = [...reservations];
    let updatedTables = [...tables];

    if (editingId) {
      const idx = newReservations.findIndex(r => r.id === editingId);
      if (idx !== -1) {
        // Se a mesa mudou, libera a antiga
        const oldTableId = newReservations[idx].tableId;
        if (oldTableId && oldTableId !== Number(formData.tableId)) {
          const oldTableIdx = updatedTables.findIndex(t => t.id === oldTableId);
          if (oldTableIdx !== -1 && updatedTables[oldTableIdx].status === 'Reservada') {
             updatedTables[oldTableIdx].status = 'Livre';
          }
        }
        
        newReservations[idx] = {
          ...newReservations[idx],
          ...formData,
          tableLabel: table?.label || '?',
        } as Reservation;
      }
    } else {
      newReservations.push({
        id: Math.random().toString(36).substr(2, 9),
        ...formData,
        tableLabel: table?.label || '?',
        createdAt: new Date().toISOString()
      } as Reservation);
    }
    
    // Atualiza status da mesa para Reservada se a reserva estiver confirmada ou pendente
    if (formData.status === 'confirmed' || formData.status === 'pending') {
      const tableIdx = updatedTables.findIndex(t => t.id === Number(formData.tableId));
      if (tableIdx !== -1) {
        updatedTables[tableIdx].status = 'Reservada';
      }
    }

    await Promise.all([
      saveReservations(newReservations),
      saveTables(updatedTables)
    ]);
    
    setReservations(newReservations);
    setTables(updatedTables);
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ 
      customerName: '', 
      customerWhatsApp: '',
      customerDocument: '',
      date: new Date().toISOString().split('T')[0], 
      time: '19:00', 
      guests: 2, 
      tableId: 0, 
      notes: '', 
      status: settings.reservationsAutoConfirm ? 'confirmed' : 'pending' 
    });
  };

  const updateStatus = async (id: string, status: Reservation['status']) => {
    const newReservations = [...reservations];
    const updatedTables = [...tables];
    const idx = newReservations.findIndex(r => r.id === id);
    
    if (idx !== -1) {
      newReservations[idx].status = status;
      
      // Se cancelada ou finalizada, libera a mesa
      if (status === 'cancelled' || status === 'no-show') {
        const tableIdx = updatedTables.findIndex(t => t.id === newReservations[idx].tableId);
        if (tableIdx !== -1) {
          updatedTables[tableIdx].status = 'Livre';
        }
      } else if (status === 'seated') {
         const tableIdx = updatedTables.findIndex(t => t.id === newReservations[idx].tableId);
         if (tableIdx !== -1) {
           updatedTables[tableIdx].status = 'Ocupada';
         }
      }
      
      await Promise.all([
        saveReservations(newReservations),
        saveTables(updatedTables)
      ]);
      setReservations(newReservations);
      setTables(updatedTables);
    }
  };

  const handleDelete = async (id: string) => {
    const res = reservations.find(r => r.id === id);
    const newReservations = reservations.filter(r => r.id !== id);
    const updatedTables = [...tables];
    
    if (res && (res.status === 'pending' || res.status === 'confirmed')) {
      const tableIdx = updatedTables.findIndex(t => t.id === res.tableId);
      if (tableIdx !== -1) {
        updatedTables[tableIdx].status = 'Livre';
      }
    }
    
    await Promise.all([
      saveReservations(newReservations),
      saveTables(updatedTables)
    ]);
    setReservations(newReservations);
    setTables(updatedTables);
  };

  const filteredReservations = reservations.filter(r => {
    const matchesSearch = r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || (r.customerWhatsApp && r.customerWhatsApp.includes(searchQuery));
    const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Reservation['status']) => {
    switch (status) {
      case 'confirmed': return <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[8px] font-black uppercase tracking-widest">Confirmada</span>;
      case 'cancelled': return <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-lg text-[8px] font-black uppercase tracking-widest">Cancelada</span>;
      case 'seated': return <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-[8px] font-black uppercase tracking-widest">Sentado</span>;
      case 'no-show': return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-[8px] font-black uppercase tracking-widest">Não Compareceu</span>;
      default: return <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[8px] font-black uppercase tracking-widest">Pendente</span>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800 dark:text-white flex items-center gap-3">
            <Calendar className="w-8 h-8 text-indigo-600" />
            Sistema de Reservas
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Gestão de agendamentos e ocupação de mesas</p>
        </div>

        <button onClick={() => setIsModalOpen(true)} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
          <Plus className="w-4 h-4" />
          Nova Reserva
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          <input 
            type="text" 
            placeholder="PESQUISAR RESERVA..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="px-6 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/20">
          <option value="all">TODOS OS STATUS</option>
          <option value="pending">PENDENTE</option>
          <option value="confirmed">CONFIRMADA</option>
          <option value="seated">SENTADO</option>
          <option value="cancelled">CANCELADA</option>
          <option value="no-show">NÃO COMPARECEU</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredReservations.map(res => (
          <div key={res.id} className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 transition-colors">
                  <Calendar className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-slate-700 dark:text-white">{res.customerName}</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{res.customerWhatsApp}</p>
                </div>
              </div>
              {getStatusBadge(res.status)}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-1">
                <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  <Clock className="w-3 h-3" />
                  Horário
                </div>
                <p className="text-xs font-black text-slate-700 dark:text-white">{new Date(res.date + 'T' + res.time).toLocaleDateString('pt-BR')} às {res.time}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-1">
                <div className="flex items-center gap-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  <Users className="w-3 h-3" />
                  Pessoas
                </div>
                <p className="text-xs font-black text-slate-700 dark:text-white">{res.guests} Pessoas</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl mb-6">
              <span className="text-[9px] font-black uppercase text-indigo-700 dark:text-indigo-300 tracking-widest">Mesa Reservada</span>
              <span className="text-sm font-black text-indigo-600">MESA {res.tableLabel}</span>
            </div>

            {settings.reservationsShowNotesOnCard && res.notes && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                <p className="text-[9px] font-bold text-amber-700 dark:text-amber-400 uppercase italic leading-relaxed">Obs: {res.notes}</p>
              </div>
            )}

            <div className="flex gap-2">
              {res.status === 'pending' && (
                <button onClick={() => updateStatus(res.id, 'confirmed')} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all">Confirmar</button>
              )}
              {res.status === 'confirmed' && (
                <button onClick={() => updateStatus(res.id, 'seated')} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all">Sentar</button>
              )}
              <button onClick={() => {
                setFormData(res);
                setEditingId(res.id);
                setIsModalOpen(true);
              }} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 rounded-xl transition-all"><Edit className="w-4 h-4" /></button>
              <button onClick={() => handleDelete(res.id)} className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-600 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL RESERVA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black uppercase tracking-tighter text-slate-800 dark:text-white">
                  {editingId ? 'Editar Reserva' : 'Nova Reserva'}
                </h3>
                <button onClick={() => {
                  setIsModalOpen(false);
                  setEditingId(null);
                  setFormData({ 
                    customerName: '', 
                    customerWhatsApp: '',
                    customerDocument: '',
                    date: new Date().toISOString().split('T')[0], 
                    time: '19:00', 
                    guests: 2, 
                    tableId: 0, 
                    notes: '', 
                    status: settings.reservationsAutoConfirm ? 'confirmed' : 'pending' 
                  });
                }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                  <XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Nome do Cliente</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Digite o nome do cliente"
                      value={formData.customerName || ''} 
                      onChange={e => {
                        setFormData({...formData, customerName: e.target.value.toUpperCase()});
                        if (formErrors.customerName) setFormErrors({...formErrors, customerName: ''});
                      }} 
                      className={`w-full pl-12 pr-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 ${formErrors.customerName ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`} 
                    />
                  </div>
                  {formErrors.customerName && <p className="text-[9px] font-black text-rose-500 uppercase ml-2">{formErrors.customerName}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">WhatsApp</label>
                  <div className="relative">
                    <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="(00) 00000-0000"
                      value={formData.customerWhatsApp || ''} 
                      onChange={e => setFormData({...formData, customerWhatsApp: maskWhatsApp(e.target.value)})} 
                      className="w-full pl-12 pr-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500" 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">CPF ou CNPJ</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Digite CPF ou CNPJ"
                      value={formData.customerDocument || ''} 
                      onChange={e => setFormData({...formData, customerDocument: maskCPF_CNPJ(e.target.value)})} 
                      className="w-full pl-12 pr-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500" 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Mesa</label>
                  <select 
                    value={formData.tableId || 0} 
                    onChange={e => {
                      setFormData({...formData, tableId: Number(e.target.value)});
                      if (formErrors.tableId) setFormErrors({...formErrors, tableId: ''});
                    }} 
                    className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 ${formErrors.tableId ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`}
                  >
                    <option value={0}>Selecione a mesa</option>
                    {tables.map(t => (
                      <option key={t.id} value={t.id} disabled={t.status !== 'Livre' && t.id !== formData.tableId}>
                        MESA {t.label} ({t.status})
                      </option>
                    ))}
                  </select>
                  {formErrors.tableId && <p className="text-[9px] font-black text-rose-500 uppercase ml-2">{formErrors.tableId}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Data da Reserva</label>
                    <input 
                      type="date" 
                      value={formData.date || ''} 
                      onChange={e => {
                        setFormData({...formData, date: e.target.value});
                        if (formErrors.date) setFormErrors({...formErrors, date: ''});
                      }} 
                      className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 ${formErrors.date ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`} 
                    />
                    {formErrors.date && <p className="text-[9px] font-black text-rose-500 uppercase ml-2">{formErrors.date}</p>}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Horário da Reserva</label>
                    <input 
                      type="time" 
                      value={formData.time || ''} 
                      onChange={e => {
                        setFormData({...formData, time: e.target.value});
                        if (formErrors.time) setFormErrors({...formErrors, time: ''});
                      }} 
                      className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 ${formErrors.time ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`} 
                    />
                    {formErrors.time && <p className="text-[9px] font-black text-rose-500 uppercase ml-2">{formErrors.time}</p>}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Quantidade de Pessoas</label>
                  <input 
                    type="number" 
                    value={formData.guests === undefined ? '' : formData.guests} 
                    onChange={e => {
                      const val = e.target.value === '' ? undefined : Number(e.target.value);
                      setFormData({...formData, guests: val as any});
                      if (formErrors.guests) setFormErrors({...formErrors, guests: ''});
                    }} 
                    className={`w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 ${formErrors.guests ? 'ring-2 ring-rose-500' : 'focus:ring-indigo-500'}`} 
                    placeholder="Ex: 2"
                  />
                  {formErrors.guests && <p className="text-[9px] font-black text-rose-500 uppercase ml-2">{formErrors.guests}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-slate-400 ml-2">Observações</label>
                  <textarea 
                    value={formData.notes || ''} 
                    onChange={e => setFormData({...formData, notes: e.target.value})} 
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px]" 
                  />
                </div>
              </div>

              <button 
                onClick={handleSave} 
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
              >
                {editingId ? 'Salvar Alterações' : 'Confirmar Reserva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reservations;
