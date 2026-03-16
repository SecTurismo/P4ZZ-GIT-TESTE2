import React, { useState, useEffect } from 'react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  delaySeconds?: number;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Excluir',
  delaySeconds = 5
}) => {
  const [timeLeft, setTimeLeft] = useState(delaySeconds);

  useEffect(() => {
    if (isOpen) {
      setTimeLeft(delaySeconds);
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isOpen, delaySeconds]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[1000] p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-[340px] rounded-[2rem] p-8 shadow-2xl border border-white/10 animate-in zoom-in-95">
        <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter mb-1">{title}</h3>
        <p className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase leading-relaxed mb-6">
          {message}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={onClose} 
            className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-colors"
          >
            Voltar
          </button>
          <button 
            onClick={onConfirm} 
            disabled={timeLeft > 0}
            className={`py-3 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg transition-all ${
              timeLeft > 0 
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed' 
                : 'bg-rose-600 text-white hover:bg-rose-700 active:scale-95'
            }`}
          >
            {timeLeft > 0 ? `Aguarde ${timeLeft}s` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
