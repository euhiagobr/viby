'use client';

import * as React from 'react';
import { cn, safeParseDate } from '@/lib/utils';
import { shortenTitle, formatTemplateDate, formatTemplateTime } from '@/lib/image-generator-utils';

interface EventItem {
  id: string;
  title: string;
  image: string;
  date: any;
  endDate?: any;
  city: string;
  _additionalCount?: number;
}

interface AgendaTemplateProps {
  events: EventItem[];
  format: 'A4' | 'instagram' | 'stories';
  theme: 'viby' | 'claro' | 'escuro' | 'copa' | 'pride';
  logoUrl?: string;
  pageNumber?: number;
  totalPages?: number;
}

export function AgendaTemplate({ events, format, theme, logoUrl, pageNumber, totalPages }: AgendaTemplateProps) {
  const count = events.length;

  // REGRAS DE LAYOUT: 16:9 (Vertical) vs Square (Horizontal)
  // Feed: 1, 2, 3 -> Vertical | Stories: 1, 2, 3, 4 -> Vertical
  // NOVO: Feed 4 eventos agora também prioriza proporção retangular para a imagem
  const isVerticalLayout = (format === 'stories' && count <= 4) || (format === 'instagram' && count <= 3) || (format === 'A4' && count <= 3);
  
  const baseConfig = {
    stories: { 
      width: 1080, 
      height: 1920, 
      headerHeight: 220, 
      footerHeight: 120, 
      padding: 80, 
      gap: isVerticalLayout ? 40 : 25 
    },
    instagram: { 
      width: 1080, 
      height: 1080, 
      headerHeight: 180, 
      footerHeight: 100, 
      padding: 60, 
      gap: isVerticalLayout ? 30 : 20 
    },
    A4: { 
      width: 1240, 
      height: 1754, 
      headerHeight: 280, 
      footerHeight: 140, 
      padding: 100, 
      gap: isVerticalLayout ? 40 : 25 
    }
  }[format];

  const colors = {
    viby: { bg: 'linear-gradient(135deg, #000B26 0%, #2C52EE 100%)', text: '#FFFFFF', itemBg: 'rgba(255,255,255,0.05)', accent: '#2C52EE' },
    claro: { bg: '#F8FAFC', text: '#000000', itemBg: '#FFFFFF', accent: '#2C52EE' },
    escuro: { bg: '#000000', text: '#FFFFFF', itemBg: '#111111', accent: '#2C52EE' },
    copa: { bg: 'linear-gradient(135deg, #002776 0%, #009c3b 100%)', text: '#FFFFFF', itemBg: 'rgba(255,255,255,0.1)', accent: '#ffdf00' },
    pride: { bg: 'linear-gradient(45deg, #FF0000, #FF8B00, #FFD300, #008121, #004CFF, #760089)', text: '#FFFFFF', itemBg: 'rgba(0,0,0,0.5)', accent: '#FFFFFF' }
  }[theme];

  const siteUrl = theme === 'copa' ? 'viby.club/copa-do-mundo' : theme === 'pride' ? 'viby.club/lgbt' : 'viby.club';
  const isCopa = theme === 'copa';
  const isPride = theme === 'pride';
  
  const badgeText = isCopa ? 'COPA 2026' : 'Agenda';
  const mainTitleText = isCopa ? 'ONDE ASSISTIR' : 'AGENDA';
  const subTitleText = isPride ? 'DIVERSIDADE' : isCopa ? 'O BRASIL' : 'DA SEMANA';

  // Dinâmica de fontes baseada na quantidade de itens
  const getTitleSize = () => {
    if (!isVerticalLayout) return '28px'; // Reduzido ligeiramente para 4 eventos em linha
    if (count === 1) return '82px';
    if (count === 2) return '64px';
    if (count === 3) return '48px';
    return '42px';
  };

  return (
    <div 
      className="viby-template-root"
      style={{ 
        width: `${baseConfig.width}px`, 
        height: `${baseConfig.height}px`, 
        background: colors.bg,
        color: colors.text,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: `${baseConfig.padding}px`,
        fontFamily: 'Poppins, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '600px', height: '600px', background: `${colors.accent}15`, borderRadius: '50%', filter: 'blur(100px)' }} />

      {/* HEADER */}
      <div 
        className="viby-header"
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-end', 
          height: `${baseConfig.headerHeight}px`,
          width: '100%', 
          marginBottom: '30px',
          boxSizing: 'border-box',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
           <div style={{ background: colors.accent, color: (isCopa || isPride) ? '#000000' : '#FFFFFF', padding: '6px 20px', borderRadius: '50px', width: 'fit-content', fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '4px' }}>
              {badgeText}
           </div>
           <h1 style={{ fontSize: count === 1 ? '100px' : '80px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', margin: 0, lineHeight: 0.85, letterSpacing: '-4px' }}>
              {mainTitleText} <br />
              <span style={{ opacity: 0.4, fontSize: '0.8em' }}>{subTitleText}</span>
           </h1>
        </div>
        {logoUrl && (
          <img src={logoUrl} crossOrigin="anonymous" style={{ width: '220px', height: '80px', objectFit: 'contain', marginBottom: '5px' }} alt="Logo" />
        )}
      </div>

      {/* EVENTS CONTAINER */}
      <div 
        className="viby-events-container"
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: isVerticalLayout ? 'center' : 'flex-start',
          gap: `${baseConfig.gap}px`, 
          width: '100%',
          flex: 1,
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 10
        }}
      >
        {events.map((ev) => (
          <div 
            key={ev.id} 
            className="viby-card"
            style={{ 
              display: 'flex', 
              flexDirection: isVerticalLayout ? 'column' : 'row',
              alignItems: isVerticalLayout ? 'flex-start' : 'center', 
              gap: isVerticalLayout ? '15px' : '25px', 
              background: isVerticalLayout ? 'transparent' : colors.itemBg, 
              padding: isVerticalLayout ? '0' : '20px', 
              borderRadius: isVerticalLayout ? '0' : '30px',
              width: '100%',
              flexShrink: 0,
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}
          >
             {/* IMAGE WRAPPER - PRIORIDADE: SEM CORTE (CONTAIN) */}
             <div 
               className="viby-card-image" 
               style={{ 
                 width: isVerticalLayout ? '100%' : '260px', // Aumentado para suportar 16:9 lateral
                 height: isVerticalLayout ? 'auto' : '146px', // Altura calculada para 16:9 em 260px width
                 aspectRatio: '16/9',
                 borderRadius: isVerticalLayout ? '35px' : '20px', 
                 overflow: 'hidden', 
                 flexShrink: 0,
                 border: isVerticalLayout ? '6px solid rgba(255,255,255,0.1)' : 'none',
                 background: 'rgba(0,0,0,0.2)', // Fundo neutro para contain
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center'
               }}
             >
                <img 
                  src={ev.image} 
                  crossOrigin="anonymous" 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'contain' // REGRA CRÍTICA: Nunca cortar informações
                  }} 
                  alt="" 
                />
             </div>
             
             {/* CONTENT WRAPPER */}
             <div 
               className="viby-card-content" 
               style={{ 
                 flex: 1, 
                 display: 'flex', 
                 flexDirection: 'column', 
                 gap: isVerticalLayout ? '12px' : '4px', 
                 minWidth: 0, 
                 width: '100%',
                 boxSizing: 'border-box' 
               }}
             >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                   <span style={{ fontSize: isVerticalLayout && count < 3 ? '32px' : '18px', fontWeight: 900, color: colors.accent, fontStyle: 'italic' }}>
                     {formatTemplateDate(ev.date)}
                   </span>
                   <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.text, opacity: 0.3 }} />
                   <span style={{ fontSize: isVerticalLayout && count < 3 ? '22px' : '14px', fontWeight: 700, opacity: 0.6, textTransform: 'uppercase' }}>
                     {formatTemplateTime(ev.date, ev.endDate)}
                   </span>
                </div>
                
                <h2 
                  className="viby-card-title" 
                  style={{ 
                    fontSize: getTitleSize(), 
                    fontWeight: 900, 
                    textTransform: 'uppercase', 
                    fontStyle: 'italic', 
                    lineHeight: 0.95, 
                    margin: 0, 
                    letterSpacing: '-2px',
                    wordBreak: 'break-word',
                    display: '-webkit-box',
                    WebkitLineClamp: isVerticalLayout ? 2 : 2, // Permite 2 linhas mesmo no horizontal para títulos longos
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                   {shortenTitle(ev.title, 50)}
                </h2>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.5 }}>
                   <svg width={isVerticalLayout ? "20" : "14"} height={isVerticalLayout ? "20" : "14"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                   </svg>
                   <span style={{ fontSize: isVerticalLayout ? '22px' : '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>
                     {ev.city}
                   </span>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div 
        className="viby-footer"
        style={{ 
          marginTop: '40px', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: '30px', 
          height: `${baseConfig.footerHeight}px`,
          width: '100%',
          flexShrink: 0,
          boxSizing: 'border-box'
        }}
      >
         <div style={{ flex: 1, height: '1px', background: colors.text, opacity: 0.15 }} />
         <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <p style={{ fontSize: '26px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', margin: 0, letterSpacing: '-1px' }}>{siteUrl}</p>
            <p style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '6px', margin: 0 }}>VIVA O AGORA</p>
         </div>
         <div style={{ flex: 1, height: '1px', background: colors.text, opacity: 0.15 }} />
      </div>
    </div>
  );
}
