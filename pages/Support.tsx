import React, { useState, useEffect, useMemo } from 'react';
import { AppSettings, SupportTicket, SupportMessage } from '../types';
import { getAppSettings, saveAppSettings, getCurrentUser, DEFAULT_SETTINGS, getSupportTickets, saveSupportTicket, notifyDataChanged } from '../services/storage';

interface SupportProps {
  onUpdate?: () => void;
}

const Support: React.FC<SupportProps> = ({ onUpdate }) => {
  const user = getCurrentUser();
  const isMaster = user?.tenantId === 'MASTER' && user?.role === 'admin';
  
  const [localSettings, setLocalSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'tickets'>('info');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const refreshData = async () => {
    const [settings, allTickets] = await Promise.all([
      getAppSettings('MASTER'),
      getSupportTickets()
    ]);
    setLocalSettings(settings);
    setTickets(allTickets);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const filteredTickets = useMemo(() => {
    if (isMaster) return tickets.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return tickets.filter(t => t.userId === user?.id).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [tickets, isMaster, user?.id]);

  const handleSaveSettings = () => {
    if (!isMaster) return;
    setIsSaving(true);
    setTimeout(async () => {
      await saveAppSettings(localSettings, 'MASTER');
      setIsSaving(false);
      setShowToast(true);
      if (onUpdate) onUpdate();
      setTimeout(() => setShowToast(false), 3000);
    }, 800);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketSubject.trim() || !newMessage.trim() || !user) return;

    const newTicket: SupportTicket = {
      id: 'tk-' + Math.random().toString(36).substr(2, 9),
      userId: user.id,
      userName: user.name,
      subject: newTicketSubject.toUpperCase(),
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [{
        id: 'msg-' + Math.random().toString(36).substr(2, 9),
        senderId: user.id,
        senderName: user.name,
        content: newMessage,
        createdAt: new Date().toISOString()
      }]
    };

    await saveSupportTicket(newTicket);
    setNewTicketSubject('');
    setNewMessage('');
    refreshData();
    notifyDataChanged();
    alert("Chamado aberto com sucesso!");
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTicket || !user) return;

    const updatedTicket: SupportTicket = {
      ...selectedTicket,
      status: isMaster ? 'replied' : 'open',
      isReadByCustomer: isMaster ? false : selectedTicket.isReadByCustomer,
      updatedAt: new Date().toISOString(),
      messages: [...selectedTicket.messages, {
        id: 'msg-' + Math.random().toString(36).substr(2, 9),
        senderId: user.id,
        senderName: user.name,
        content: newMessage,
        createdAt: new Date().toISOString()
      }]
    };

    await saveSupportTicket(updatedTicket);
    setNewMessage('');
    setSelectedTicket(updatedTicket);
    refreshData();
    notifyDataChanged();
  };

  const handleCloseTicket = async (ticket: SupportTicket) => {
    const updatedTicket: SupportTicket = {
      ...ticket,
      status: 'closed',
      updatedAt: new Date().toISOString()
    };
    await saveSupportTicket(updatedTicket);
    if (selectedTicket?.id === ticket.id) setSelectedTicket(updatedTicket);
    refreshData();
    notifyDataChanged();
  };

  return (
    <div className="max-w-6xl mx-auto pb-24 animate-in fade-in duration-500">
      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-8 py-4 rounded-full shadow-2xl font-black text-[9px] uppercase tracking-widest animate-in slide-in-from-top-4">
          Central de Suporte Atualizada
        </div>
      )}

      {/* Tabs */}
      <div className="flex justify-center mb-8">
        <div className="bg-slate-200/60 dark:bg-slate-800/60 p-1.5 rounded-full flex shadow-inner border border-slate-300/30 dark:border-slate-700/30">
          <button 
            onClick={() => { setActiveTab('info'); setSelectedTicket(null); }}
            className={`px-8 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'info' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' : 'text-slate-600 dark:text-slate-400'}`}
          >
            {isMaster ? 'Suporte' : 'Informações'}
          </button>
          <button 
            onClick={() => setActiveTab('tickets')}
            className={`px-8 py-3 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'tickets' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-md' : 'text-slate-600 dark:text-slate-400'}`}
          >
            {isMaster ? 'Gerenciar Chamados' : 'Meus Chamados'}
            {isMaster && tickets.filter(t => t.status === 'open').length > 0 && (
              <span className="ml-2 bg-rose-500 text-white w-4 h-4 rounded-full inline-flex items-center justify-center text-[8px]">{tickets.filter(t => t.status === 'open').length}</span>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {activeTab === 'info' ? (
          <div className="bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              {isMaster ? (
                <div className="space-y-8">
                  <div className="flex items-center gap-4 border-b dark:border-white/5 pb-6">
                    <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner overflow-hidden border border-slate-100 dark:border-slate-800">
                      {localSettings.logoUrl ? (
                        <img src={localSettings.logoUrl} className="w-full h-full object-contain p-2" alt="Sua Logo" />
                      ) : (
                        <div className="text-xl font-black italic">S</div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-none">Editor de Suporte</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Configure o que seus clientes verão nesta aba</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-indigo-500 ml-2 tracking-widest">Título da Página</label>
                      <input 
                        value={localSettings.supportPageTitle || ''} 
                        onChange={e => setLocalSettings({...localSettings, supportPageTitle: e.target.value.toUpperCase()})}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-black text-sm uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-indigo-500 ml-2 tracking-widest">Conteúdo (Mensagem)</label>
                      <textarea 
                        value={localSettings.supportPageContent || ''} 
                        onChange={e => setLocalSettings({...localSettings, supportPageContent: e.target.value})}
                        rows={8}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner resize-none"
                        placeholder="Descreva as instruções de suporte..."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-emerald-500 ml-2 tracking-widest">Mensagem Padrão</label>
                      <input 
                        value={localSettings.whatsappSupportMessage || ''} 
                        onChange={e => setLocalSettings({...localSettings, whatsappSupportMessage: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                        placeholder="Olá! Preciso de suporte."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase text-emerald-500 ml-2 tracking-widest">Link Direto (WhatsApp Suporte)</label>
                      <input 
                        value={localSettings.whatsappLink || ''} 
                        onChange={e => setLocalSettings({...localSettings, whatsappLink: e.target.value})}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
                        placeholder="https://wa.me/55..."
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleSaveSettings} 
                    disabled={isSaving}
                    style={{ backgroundColor: localSettings.primaryColor }}
                    className="w-full py-6 rounded-3xl text-white font-black uppercase text-[11px] tracking-[0.4em] shadow-2xl active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSaving ? 'SALVANDO...' : 'ATUALIZAR CENTRAL DE SUPORTE'}
                  </button>
                </div>
              ) : (
                <div className="space-y-10 text-center animate-in zoom-in-95 duration-500">
                  {localSettings.logoUrl && (
                    <div className="inline-flex w-32 h-32 items-center justify-center mb-4 overflow-hidden transition-transform hover:scale-105">
                      <img src={localSettings.logoUrl} className="w-full h-full object-contain drop-shadow-lg" alt="Logo Workspace" />
                    </div>
                  )}
                  
                  <div className={!localSettings.logoUrl ? "pt-12" : ""}>
                    <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900 dark:text-white leading-tight mb-4">
                      {localSettings.supportPageTitle || 'CENTRAL DE SUPORTE'}
                    </h2>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-inner max-w-2xl mx-auto">
                      <p className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase leading-relaxed whitespace-pre-line tracking-wide">
                        {localSettings.supportPageContent || 'Nossa equipe está disponível para lhe ajudar.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-6">
                    <a 
                      href={localSettings.whatsappLink || 'https://wa.me/5587981649139'} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center gap-4 bg-emerald-500 hover:bg-emerald-600 text-white px-12 py-7 rounded-3xl font-black uppercase text-[12px] tracking-[0.3em] shadow-2xl transition-all transform active:scale-95 group"
                    >
                      <svg className="w-6 h-6 animate-bounce" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338-11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                      Falar com Suporte VIP
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Ticket List */}
            <div className={`lg:col-span-1 space-y-4 ${selectedTicket ? 'hidden lg:block' : 'block'}`}>
              {!isMaster && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl">
                  <h4 className="text-xs font-black uppercase italic mb-4 text-slate-900 dark:text-white">Novo Chamado</h4>
                  <form onSubmit={handleCreateTicket} className="space-y-4">
                    <input 
                      placeholder="ASSUNTO" 
                      value={newTicketSubject}
                      onChange={e => setNewTicketSubject(e.target.value.toUpperCase())}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-[10px] uppercase outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <textarea 
                      placeholder="MENSAGEM..." 
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold text-[10px] outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                    <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg active:scale-95 transition-all">Abrir Chamado</button>
                  </form>
                </div>
              )}

              <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
                <div className="p-6 border-b dark:border-white/5">
                  <h4 className="text-xs font-black uppercase italic text-slate-900 dark:text-white">Histórico</h4>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  {filteredTickets.length === 0 ? (
                    <div className="p-12 text-center opacity-30 font-black uppercase text-[10px] italic">Nenhum chamado</div>
                  ) : (
                    filteredTickets.map(tk => (
                      <button 
                        key={tk.id}
                        onClick={async () => {
                          setSelectedTicket(tk);
                          if (!isMaster && tk.status === 'replied' && !tk.isReadByCustomer) {
                            const updated = { ...tk, isReadByCustomer: true };
                            await saveSupportTicket(updated);
                            refreshData();
                            notifyDataChanged();
                          }
                        }}
                        className={`w-full p-6 text-left border-b dark:border-white/5 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selectedTicket?.id === tk.id ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : ''}`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${
                            tk.status === 'open' ? 'bg-amber-100 text-amber-600' : 
                            tk.status === 'replied' ? 'bg-indigo-100 text-indigo-600' : 
                            'bg-slate-100 text-slate-500'
                          }`}>
                            {tk.status === 'open' ? 'ABERTO' : tk.status === 'replied' ? 'RESPONDIDO' : 'FECHADO'}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400">{new Date(tk.updatedAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <p className="font-black text-[10px] uppercase text-slate-900 dark:text-white truncate">{tk.subject}</p>
                        {isMaster && <p className="text-[8px] font-bold text-indigo-500 uppercase mt-1">{tk.userName}</p>}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Ticket Detail */}
            <div className={`lg:col-span-2 ${selectedTicket ? 'block' : 'hidden lg:flex items-center justify-center bg-slate-50/50 dark:bg-slate-900/50 rounded-[3.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800'}`}>
              {selectedTicket ? (
                <div className="bg-white dark:bg-slate-900 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-xl flex flex-col h-[700px]">
                  <div className="p-8 border-b dark:border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <button onClick={() => setSelectedTicket(null)} className="lg:hidden p-2 text-slate-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth={2.5} /></svg></button>
                      <div>
                        <h4 className="text-sm font-black uppercase italic text-slate-900 dark:text-white leading-none">{selectedTicket.subject}</h4>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">Chamado #{selectedTicket.id.split('-')[1]}</p>
                      </div>
                    </div>
                    {selectedTicket.status !== 'closed' && (
                      <button 
                        onClick={() => handleCloseTicket(selectedTicket)}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black uppercase text-[8px] tracking-widest hover:bg-rose-100 hover:text-rose-600 transition-all"
                      >
                        Finalizar Chamado
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                    {selectedTicket.messages.map(msg => (
                      <div key={msg.id} className={`flex flex-col ${msg.senderId === user?.id ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[80%] p-5 rounded-3xl text-xs font-bold leading-relaxed ${
                          msg.senderId === user?.id 
                          ? 'bg-indigo-600 text-white rounded-tr-none shadow-lg shadow-indigo-200 dark:shadow-none' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none'
                        }`}>
                          {msg.content}
                        </div>
                        <span className="text-[8px] font-bold text-slate-400 mt-2 uppercase">
                          {msg.senderName} • {new Date(msg.createdAt).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>

                  {selectedTicket.status !== 'closed' ? (
                    <div className="p-8 border-t dark:border-white/5">
                      <form onSubmit={handleSendMessage} className="flex gap-4">
                        <input 
                          placeholder="DIGITE SUA MENSAGEM..." 
                          value={newMessage}
                          onChange={e => setNewMessage(e.target.value)}
                          className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 py-4 font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <button type="submit" className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg active:scale-95 transition-all">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeWidth={2.5} /></svg>
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="p-8 border-t dark:border-white/5 text-center">
                      <p className="text-[10px] font-black uppercase text-slate-400 italic">Este chamado foi finalizado e não aceita novas mensagens.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center p-12">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" strokeWidth={2} /></svg>
                  </div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Selecione um chamado para visualizar a conversa</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-slate-50 dark:bg-slate-900/40 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 flex items-start gap-4">
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-500 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest italic leading-none">Informativo</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed mt-2">
              {isMaster 
                ? 'Como Administrador Master, você visualiza e responde todos os chamados abertos pelos parceiros e clientes do sistema.' 
                : 'O Administrador Master gerencia as informações de suporte. Você pode abrir chamados diretos ou utilizar os canais oficiais acima.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;