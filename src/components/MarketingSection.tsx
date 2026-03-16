import React from 'react';
import { AppSettings } from '../types';

interface MarketingSectionProps {
  settings: AppSettings;
}

export const MarketingSection: React.FC<MarketingSectionProps> = ({ settings }) => {
  const isDark = settings.loginTheme !== 'light';
  const features = (settings.loginFeatures || '').split('\n').filter(f => f.trim() !== '');
  
  const getAnimClass = (type?: string) => {
    switch (type) {
      case 'fade-in': return 'animate-in fade-in duration-1000';
      case 'slide': return 'animate-in slide-in-from-left-12 duration-1000';
      case 'bounce': return 'animate-bounce';
      case 'pulse': return 'animate-pulse';
      case 'glitch': return 'animate-pulse skew-x-12';
      default: return '';
    }
  };

  const getFeatureAnimClass = (type?: string) => {
    switch (type) {
      case 'floating': return 'animate-bounce'; // Simplified for now
      case 'bounce': return 'animate-bounce';
      case 'pulse': return 'animate-pulse';
      case 'wave': return 'animate-pulse'; // Simplified
      default: return '';
    }
  };

  const alignment = settings.loginMarketingAlign || 'left'; // Default to left as requested
  const flexAlign = alignment === 'left' ? 'items-start' : alignment === 'right' ? 'items-end' : 'items-center';
  const textAlign = alignment === 'left' ? 'text-left' : alignment === 'right' ? 'text-right' : 'text-center';

  const getImageAnimClass = (type?: string) => {
    switch (type) {
      case 'floating': return 'animate-floating';
      case 'bounce': return 'animate-bounce';
      case 'pulse': return 'animate-pulse';
      case 'wave': return 'animate-wave';
      case 'spin-slow': return 'animate-[spin_8s_linear_infinite]';
      case 'shake': return 'animate-shake';
      case 'zoom': return 'animate-zoom';
      case 'slide-side': return 'animate-slide-side';
      case 'swing': return 'animate-swing';
      case 'heartbeat': return 'animate-heartbeat';
      case 'rubber-band': return 'animate-rubber-band';
      case 'rotate-y': return 'animate-rotate-y';
      default: return '';
    }
  };

  return (
    <>
      {/* Imagem de Marketing */}
      {settings.loginMarketingImageEnabled && settings.loginMarketingImageUrl && (
        <div 
          className={`hidden lg:block absolute left-1/2 top-1/2 z-40 transition-all duration-1000 ${getImageAnimClass(settings.loginMarketingImageAnim)}`}
          style={{ 
            transform: `translate(calc(-50% + ${settings.loginMarketingImageX ?? -350}px), calc(-50% + ${settings.loginMarketingImageY ?? 0}px)) scale(${settings.loginMarketingImageScale ?? 1.0})` 
          }}
        >
          {settings.loginMarketingImageUrl.startsWith('data:video') ? (
            <video 
              src={settings.loginMarketingImageUrl} 
              autoPlay 
              muted 
              loop 
              playsInline 
              className="max-w-none max-h-[80vh] w-auto object-contain"
            />
          ) : (
            <img 
              src={settings.loginMarketingImageUrl} 
              alt="Marketing" 
              className="max-w-none max-h-[80vh] w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
      )}

      <div 
        className={`hidden lg:flex absolute left-1/2 top-1/2 flex-col ${flexAlign} ${textAlign} justify-center space-y-10 z-50 transition-all duration-1000`}
        style={{ 
          transform: `translate(calc(-50% + ${settings.loginMarketingLeft ?? -350}px), calc(-50% + ${settings.loginMarketingTop ?? 0}px)) scale(${settings.loginMarketingScale ?? 1.0})` 
        }}
      >
        {/* Textos de Marketing */}
        {(settings.loginMarketingTextEnabled !== false && !settings.loginMarketingImageEnabled) && (
        <>
          <div className={`space-y-3 max-w-2xl ${flexAlign}`}>
            <h1 
              className={`font-black italic tracking-tighter leading-none ${getAnimClass(settings.loginSalesTitleAnim)} ${isDark ? 'text-white' : 'text-slate-900'}`}
              style={{ 
                color: settings.loginSalesTitleColor || (isDark ? '#ffffff' : '#0f172a'),
                fontSize: `${settings.loginSalesTitleSize || 64}px`, // Slightly smaller default
                transform: `translate(${settings.loginSalesTitleX || 0}px, ${settings.loginSalesTitleY || 0}px)`
              }}
            >
              {settings.loginSalesTitle || 'P4ZZ CONTROL'}
            </h1>
            <p 
              className={`font-bold uppercase tracking-[0.2em] max-w-lg leading-relaxed ${getAnimClass(settings.loginSalesTextAnim)} ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
              style={{ 
                color: settings.loginSalesTextColor || (isDark ? 'rgb(148, 163, 184)' : 'rgb(71, 85, 105)'),
                fontSize: `${settings.loginSalesTextSize || 12}px`, // Smaller text as requested
                transform: `translate(${settings.loginSalesTextX || 0}px, ${settings.loginSalesTextY || 0}px)`,
                textAlign: alignment as any
              }}
            >
              {settings.loginSalesText || 'O SISTEMA MAIS COMPLETO E INTELIGENTE PARA GESTÃO DE ESTABELECIMENTOS.'}
            </p>
          </div>

          <div 
            className={`flex flex-wrap ${alignment === 'left' ? 'justify-start' : alignment === 'right' ? 'justify-end' : 'justify-center'} gap-4 max-w-3xl ${getFeatureAnimClass(settings.loginFeaturesAnimType)}`}
            style={{ gap: `${settings.loginFeaturesGap ?? 12}px` }}
          >
            {features.map((feature, idx) => (
              <div 
                key={idx}
                className={`px-8 py-4 backdrop-blur-3xl border transition-all duration-300 cursor-default group hover:scale-110 shadow-2xl ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100/50 border-slate-200'}`}
                style={{ 
                  backgroundColor: settings.loginBalloonColor || settings.loginFeaturesColor || (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(241, 245, 249, 0.5)'),
                  borderRadius: `${settings.loginFeaturesBorderRadius ?? 32}px`,
                  padding: `${settings.loginFeaturesPadding ?? 16}px`,
                  height: settings.loginBalloonHeight ? `${settings.loginBalloonHeight}px` : 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  '--hover-bg': settings.loginMarketingPrimaryColorEnabled ? (settings.loginMarketingPrimaryColor || settings.primaryColor || '#6366f1') : (settings.primaryColor || '#6366f1')
                } as any}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = settings.loginMarketingPrimaryColorEnabled ? (settings.loginMarketingPrimaryColor || settings.primaryColor || '#6366f1') : (settings.primaryColor || '#6366f1');
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = settings.loginBalloonColor || settings.loginFeaturesColor || (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(241, 245, 249, 0.5)');
                }}
              >
                <span 
                  className={`text-[10px] font-black uppercase tracking-widest italic transition-all duration-300 group-hover:text-white group-hover:text-[12px] ${isDark ? 'text-white' : 'text-slate-900'}`}
                  style={{ color: settings.loginFeaturesTextColor || (isDark ? '#ffffff' : '#0f172a') }}
                >
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
    </>
  );
};
