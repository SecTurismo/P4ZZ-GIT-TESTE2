import React, { useState, useEffect } from 'react';
import { AppSettings, SocialLink } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Home, MessageSquare, ArrowRight, Globe, LifeBuoy, ShieldCheck, Facebook, Instagram, Twitter, Linkedin, Youtube, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface NotFoundProps {
  settings: AppSettings;
  onBack: () => void;
}

const NotFound: React.FC<NotFoundProps> = ({ settings, onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [countdown, setCountdown] = useState(settings.errorPage404RedirectTime || 0);
  const [reportStatus, setReportStatus] = useState<'idle' | 'sending' | 'success'>('idle');

  const title = settings.errorPage404Title || 'OPS! PÁGINA NÃO ENCONTRADA';
  const message = settings.errorPage404Message || 'A página que você está procurando não existe ou foi movida.';
  const buttonText = settings.errorPage404ButtonText || 'VOLTAR AO INÍCIO';
  const buttonColor = settings.errorPage404ButtonColor || '#4f46e5';
  const imageUrl = settings.errorPage404ImageUrl;
  const bgColor = settings.errorPage404BgColor || '#0f172a';
  const textColor = settings.errorPage404TextColor || '#ffffff';
  const theme = settings.errorPage404Theme || 'modern';
  const animation = settings.errorPage404Animation || 'fade';
  const showSearch = settings.errorPage404ShowSearch;
  const showLinks = settings.errorPage404ShowLinks;
  const showHomeBtn = settings.errorPage404ShowHomeButton !== false;
  const showSupportBtn = settings.errorPage404ShowSupportButton;
  const customHtml = settings.errorPage404CustomHtml;
  
  const gradientEnabled = settings.errorPage404GradientEnabled;
  const gradientColor = settings.errorPage404GradientColor || '#4f46e5';
  const pattern = settings.errorPage404Pattern || 'none';
  const socialLinks = settings.errorPage404SocialLinks || [];
  const showReportBtn = settings.errorPage404ShowReportButton;
  const reportSuccessMsg = settings.errorPage404ReportSuccessMessage || 'Obrigado! Nossa equipe foi notificada.';

  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            onBack();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countdown, onBack]);

  const handleReportError = () => {
    setReportStatus('sending');
    setTimeout(() => {
      setReportStatus('success');
      setTimeout(() => setReportStatus('idle'), 5000);
    }, 1500);
  };

  const getAnimationProps = () => {
    switch (animation) {
      case 'fade': return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.8 } };
      case 'bounce': return { initial: { scale: 0.5, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { type: 'spring', damping: 10, stiffness: 100 } };
      case 'slide': return { initial: { y: 100, opacity: 0 }, animate: { y: 0, opacity: 1 }, transition: { type: 'spring', damping: 20 } };
      case 'glitch': return { 
        initial: { opacity: 0 }, 
        animate: { opacity: 1, x: [0, -2, 2, -2, 2, 0] }, 
        transition: { duration: 0.5, x: { repeat: Infinity, duration: 0.2 } } 
      };
      case 'float': return { 
        initial: { y: 0, opacity: 0 }, 
        animate: { y: [-10, 10, -10], opacity: 1 }, 
        transition: { y: { repeat: Infinity, duration: 4, ease: "easeInOut" }, opacity: { duration: 1 } } 
      };
      default: return { initial: { opacity: 1 }, animate: { opacity: 1 } };
    }
  };

  const getSocialIcon = (platform: SocialLink['platform']) => {
    switch (platform) {
      case 'facebook': return <Facebook className="w-5 h-5" />;
      case 'instagram': return <Instagram className="w-5 h-5" />;
      case 'twitter': return <Twitter className="w-5 h-5" />;
      case 'linkedin': return <Linkedin className="w-5 h-5" />;
      case 'youtube': return <Youtube className="w-5 h-5" />;
      case 'whatsapp': return <MessageSquare className="w-5 h-5" />;
      default: return <Globe className="w-5 h-5" />;
    }
  };

  const renderThemeContent = () => {
    switch (theme) {
      case 'glass':
        return (
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-[3rem] p-12 shadow-2xl max-w-2xl w-full">
            {content}
          </div>
        );
      case 'brutalist':
        return (
          <div className="bg-white text-black border-[4px] border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-12 max-w-2xl w-full text-left">
            {content}
          </div>
        );
      case 'retro':
        return (
          <div className="bg-black border-4 border-green-500 p-12 max-w-2xl w-full font-mono text-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
            <div className="mb-4 text-xs opacity-50">SYSTEM_ERROR_404_NOT_FOUND</div>
            {content}
            <div className="mt-8 animate-pulse">_</div>
          </div>
        );
      case 'cyberpunk':
        return (
          <div className="bg-slate-900 border-l-8 border-yellow-400 p-12 max-w-2xl w-full text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 bg-yellow-400 text-black text-[8px] font-black uppercase tracking-widest">CRITICAL_FAILURE</div>
            <div className="relative z-10">{content}</div>
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-indigo-500/20 blur-3xl -mr-16 -mb-16"></div>
          </div>
        );
      case 'nature':
        return (
          <div className="bg-emerald-950/80 backdrop-blur-md border border-emerald-500/30 rounded-[4rem] p-12 max-w-2xl w-full">
            <div className="mb-6 flex justify-center">
              <div className="w-16 h-1 bg-emerald-500/50 rounded-full"></div>
            </div>
            {content}
          </div>
        );
      case 'space':
        return (
          <div className="relative max-w-2xl w-full p-12">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/5 to-transparent rounded-full blur-3xl"></div>
            <div className="relative z-10">{content}</div>
          </div>
        );
      case 'minimal':
        return (
          <div className="max-w-xl w-full">
            {content}
          </div>
        );
      default: // modern
        return (
          <div className="relative z-10 max-w-2xl w-full">
            {content}
          </div>
        );
    }
  };

  const content = (
    <div className="space-y-8">
      {imageUrl ? (
        <motion.img 
          src={imageUrl} 
          alt="404" 
          className={`mx-auto object-contain ${theme === 'brutalist' ? 'w-64 h-64 border-4 border-black' : 'w-48 h-48 md:w-64 md:h-64'}`}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className={`font-black leading-none select-none ${theme === 'retro' ? 'text-6xl mb-8' : theme === 'cyberpunk' ? 'text-8xl text-yellow-400 mb-4' : 'text-[120px] md:text-[200px] opacity-20'}`}>
          404
        </div>
      )}

      <div className="space-y-4">
        <h1 className={`font-black uppercase italic tracking-tighter ${theme === 'brutalist' ? 'text-5xl' : theme === 'cyberpunk' ? 'text-4xl text-white' : 'text-3xl md:text-5xl'}`}>
          {title}
        </h1>
        <p className={`font-medium opacity-70 leading-relaxed ${theme === 'retro' ? 'text-xs uppercase' : theme === 'cyberpunk' ? 'text-xs text-indigo-300 uppercase tracking-widest' : 'text-sm md:text-lg'}`}>
          {message}
        </p>
      </div>

      {showSearch && (
        <div className="relative max-w-md mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" />
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="O que você está procurando?"
            className={`w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${theme === 'brutalist' ? 'border-black text-black bg-white rounded-none border-2' : theme === 'cyberpunk' ? 'bg-slate-800 border-yellow-400/50 text-white rounded-none' : ''}`}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-4">
        {showHomeBtn && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className={`px-8 py-4 flex items-center gap-3 font-black uppercase tracking-[0.2em] text-[10px] transition-all ${
              theme === 'brutalist' 
                ? 'bg-yellow-400 text-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' 
                : theme === 'retro'
                ? 'border-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-black'
                : theme === 'cyberpunk'
                ? 'bg-yellow-400 text-black rounded-none hover:bg-white'
                : 'text-white rounded-2xl shadow-xl hover:brightness-110'
            }`}
            style={theme === 'modern' || theme === 'minimal' || theme === 'glass' || theme === 'nature' || theme === 'space' ? { backgroundColor: buttonColor, boxShadow: `0 20px 25px -5px ${buttonColor}33` } : {}}
          >
            <Home className="w-4 h-4" />
            {buttonText}
          </motion.button>
        )}

        {showSupportBtn && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.open(settings.supportUrl || '#', '_blank')}
            className={`px-8 py-4 flex items-center gap-3 font-black uppercase tracking-[0.2em] text-[10px] transition-all ${
              theme === 'brutalist' 
                ? 'bg-white text-black border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' 
                : theme === 'retro'
                ? 'border-2 border-green-500/30 text-green-500/70 hover:bg-green-500/10'
                : theme === 'cyberpunk'
                ? 'border border-white/20 text-white rounded-none hover:bg-white/10'
                : 'bg-white/10 text-white rounded-2xl border border-white/20 hover:bg-white/20'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Suporte Técnico
          </motion.button>
        )}

        {showReportBtn && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleReportError}
            disabled={reportStatus !== 'idle'}
            className={`px-8 py-4 flex items-center gap-3 font-black uppercase tracking-[0.2em] text-[10px] transition-all ${
              reportStatus === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500/20 text-rose-500 border border-rose-500/30 hover:bg-rose-500/30'
            } rounded-2xl disabled:opacity-50`}
          >
            {reportStatus === 'idle' && <AlertTriangle className="w-4 h-4" />}
            {reportStatus === 'sending' && <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
            {reportStatus === 'success' && <CheckCircle2 className="w-4 h-4" />}
            {reportStatus === 'idle' ? 'Relatar Erro' : reportStatus === 'sending' ? 'Enviando...' : 'Relatado!'}
          </motion.button>
        )}
      </div>

      {reportStatus === 'success' && (
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest"
        >
          {reportSuccessMsg}
        </motion.p>
      )}

      {socialLinks.length > 0 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          {socialLinks.map((link, i) => (
            <motion.a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.2, rotate: 5 }}
              className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all text-current opacity-60 hover:opacity-100"
            >
              {getSocialIcon(link.platform)}
            </motion.a>
          ))}
        </div>
      )}

      {showLinks && (
        <div className="pt-8 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Globe, label: 'Website', href: '#' },
            { icon: LifeBuoy, label: 'Ajuda', href: '#' },
            { icon: ShieldCheck, label: 'Segurança', href: '#' },
            { icon: ArrowRight, label: 'Painel', onClick: onBack },
          ].map((link, i) => (
            <button 
              key={i}
              onClick={link.onClick}
              className="flex flex-col items-center gap-2 opacity-50 hover:opacity-100 transition-all group"
            >
              <div className="p-3 bg-white/5 rounded-xl group-hover:bg-white/10 transition-all">
                <link.icon className="w-4 h-4" />
              </div>
              <span className="text-[8px] font-black uppercase tracking-widest">{link.label}</span>
            </button>
          ))}
        </div>
      )}

      {countdown > 0 && (
        <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">
          Redirecionando em {countdown}s...
        </div>
      )}
    </div>
  );

  const getBackgroundStyle = () => {
    if (theme === 'brutalist') return { backgroundColor: '#f0f0f0' };
    if (theme === 'cyberpunk') return { backgroundColor: '#0f172a' };
    if (theme === 'nature') return { backgroundColor: '#064e3b' };
    if (theme === 'space') return { backgroundColor: '#020617' };
    
    if (gradientEnabled) {
      return {
        background: `linear-gradient(135deg, ${bgColor} 0%, ${gradientColor} 100%)`,
        color: textColor
      };
    }
    return { backgroundColor: bgColor, color: textColor };
  };

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center p-6 text-center overflow-auto ${theme === 'retro' ? 'scanlines' : ''}`}
      style={getBackgroundStyle()}
    >
      {/* Padrões de Fundo */}
      {pattern === 'dots' && (
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      )}
      {pattern === 'grid' && (
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
      )}
      {pattern === 'lines' && (
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg, currentColor 25%, transparent 25%, transparent 50%, currentColor 50%, currentColor 75%, transparent 75%, transparent)', backgroundSize: '40px 40px' }}></div>
      )}
      {pattern === 'noise' && (
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none noise-bg"></div>
      )}

      {/* Elementos Decorativos de Fundo */}
      {theme === 'modern' && !gradientEnabled && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500 rounded-full blur-3xl"></div>
        </div>
      )}

      {theme === 'retro' && (
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_transparent_0%,_rgba(0,0,0,0.4)_100%)]"></div>
      )}

      {theme === 'space' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div 
              key={i} 
              className="absolute bg-white rounded-full animate-pulse"
              style={{
                width: Math.random() * 3 + 'px',
                height: Math.random() * 3 + 'px',
                top: Math.random() * 100 + '%',
                left: Math.random() * 100 + '%',
                opacity: Math.random() * 0.5,
                animationDelay: Math.random() * 5 + 's'
              }}
            ></div>
          ))}
        </div>
      )}

      <motion.div {...getAnimationProps()}>
        {renderThemeContent()}
      </motion.div>

      {customHtml && (
        <div className="mt-8" dangerouslySetInnerHTML={{ __html: customHtml }} />
      )}

      {/* Marca d'água sutil */}
      <div className={`absolute bottom-10 left-0 right-0 text-[10px] font-black uppercase tracking-[0.5em] opacity-20 ${theme === 'retro' ? 'text-green-500' : theme === 'cyberpunk' ? 'text-yellow-400' : ''}`}>
        {settings.systemName}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .scanlines {
          position: relative;
          overflow: hidden;
        }
        .scanlines::after {
          content: " ";
          display: block;
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          right: 0;
          background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
          z-index: 2;
          background-size: 100% 2px, 3px 100%;
          pointer-events: none;
        }
        .noise-bg {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }
      `}} />
    </div>
  );
};

export default NotFound;
