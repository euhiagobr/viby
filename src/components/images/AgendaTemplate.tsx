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
  
  // Cálculo de altura segura para a imagem (evita estouro de container e cortes)
  const getImageHeight = () => {
    if (!isVerticalLayout) return '160px'; // Layout horizontal (ex: 4 itens no feed)
    
    // Altura total disponível para os itens
    const availableHeight = baseConfig.height - baseConfig.headerHeight - baseConfig.footerHeight - (baseConfig.padding * 2) - (baseConfig.gap * (count - 1));
    const itemHeight = availableHeight / count;
    
    // Deduzir espaço aproximado do texto (Data, Título, Cidade)
    const textSpace = count === 1 ? 250 : count === 2 ? 180 : 120;
    
    return `${Math.max(120, itemHeight - textSpace)}px`;
  };

  const getTitleSize = () => {
    if (!isVerticalLayout) return '24px';
    if (count === 1) return '82px';
    if (count === 2) return '58px';
    if (count === 3) return '42px';
    return '34px';
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
          marginBottom: '40px',
          boxSizing: 'border-box',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
           <div style={{ background: colors.accent, color: (theme === 'copa' || theme === 'pride') ? '#000000' : '#FFFFFF', padding: '6px 20px', borderRadius: '50px', width: 'fit-content', fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '4px' }}>
              {theme === 'copa' ? 'COPA 2026' : 'AGENDA'}
           </div>
           <h1 style={{ fontSize: count === 1 ? '100px' : '80px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', margin: 0, lineHeight: 0.85, letterSpacing: '-4px' }}>
              {theme === 'copa' ? 'ONDE ASSISTIR' : 'AGENDA'} <br />
              <span style={{ opacity: 0.4, fontSize: '0.8em' }}>{theme === 'pride' ? 'DIVERSIDADE' : theme === 'copa' ? 'O BRASIL' : 'DA SEMANA'}</span>
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
          justifyContent: 'center',
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
              boxSizing: 'border-box'
            }}
          >
             {/* IMAGE WRAPPER - REGRA CRÍTICA: CONTAIN PARA NÃO CORTAR INFO */}
             <div 
               className="viby-card-image" 
               style={{ 
                 width: isVerticalLayout ? '100%' : '300px', 
                 height: getImageHeight(),
                 borderRadius: isVerticalLayout ? '35px' : '20px', 
                 overflow: 'hidden', 
                 flexShrink: 0,
                 background: 'rgba(0,0,0,0.2)', // Fundo para áreas não preenchidas pelo contain
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 border: isVerticalLayout ? 'none' : '2px solid rgba(255,255,255,0.1)'
               }}
             >
                <img 
                  src={ev.image} 
                  crossOrigin="anonymous" 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'contain' // NUNCA CORTAR
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
                 gap: isVerticalLayout ? '10px' : '4px', 
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
                    WebkitLineClamp: 2,
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
