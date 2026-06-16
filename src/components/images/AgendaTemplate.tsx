'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { shortenTitle, formatTemplateDate, formatTemplateTime } from '@/lib/image-generator-utils';

interface EventItem {
  id: string;
  title: string;
  image: string;
  date: any;
  endDate?: any;
  city: string;
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
  const containerRef = React.useRef<HTMLDivElement>(null);

  const config = {
    stories: { 
      width: 1080, 
      height: 1920, 
      itemHeight: 180, 
      headerHeight: 250, 
      footerHeight: 120, 
      padding: 80, 
      gap: 20 
    },
    instagram: { 
      width: 1080, 
      height: 1350, 
      itemHeight: 210, 
      headerHeight: 200, 
      footerHeight: 100, 
      padding: 60, 
      gap: 25 
    },
    A4: { 
      width: 1240, 
      height: 1754, 
      itemHeight: 210, 
      headerHeight: 300, 
      footerHeight: 150, 
      padding: 100, 
      gap: 25 
    }
  }[format];

  const colors = {
    viby: { bg: 'linear-gradient(135deg, #000B26 0%, #2C52EE 100%)', text: '#FFFFFF', itemBg: 'rgba(255,255,255,0.05)', accent: '#2C52EE' },
    claro: { bg: '#F8FAFC', text: '#000000', itemBg: '#FFFFFF', accent: '#2C52EE' },
    escuro: { bg: '#000000', text: '#FFFFFF', itemBg: '#111111', accent: '#2C52EE' },
    copa: { bg: 'linear-gradient(135deg, #002776 0%, #009c3b 100%)', text: '#FFFFFF', itemBg: 'rgba(255,255,255,0.1)', accent: '#ffdf00' },
    pride: { bg: 'linear-gradient(45deg, #FF0000, #FF8B00, #FFD300, #008121, #004CFF, #760089)', text: '#FFFFFF', itemBg: 'rgba(0,0,0,0.5)', accent: '#FFFFFF' }
  }[theme];

  const availableHeight = config.height - config.headerHeight - config.footerHeight - (config.padding * 2);
  const cardHeight = config.itemHeight;
  const gap = config.gap;
  
  // Cálculo determinístico de capacidade para evitar transbordamento
  const maxCards = Math.floor((availableHeight + gap) / (cardHeight + gap));
  const visibleEvents = events.slice(0, maxCards);

  const siteUrl = theme === 'copa' ? 'viby.club/copa-do-mundo' : theme === 'pride' ? 'viby.club/lgbt' : 'viby.club';
  const subTitleText = theme === 'pride' ? 'DIVERSIDADE' : 'SEMANA';

  return (
    <div 
      className="viby-template-root"
      style={{ 
        width: `${config.width}px`, 
        height: `${config.height}px`, 
        background: colors.bg,
        color: colors.text,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: `${config.padding}px`,
        fontFamily: 'Poppins, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '600px', height: '600px', background: `${colors.accent}15`, borderRadius: '50%', filter: 'blur(100px)' }} />

      <div 
        className="viby-header"
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-end', 
          height: `${config.headerHeight}px`,
          width: '100%', 
          marginBottom: '20px',
          boxSizing: 'border-box',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
           <div style={{ background: colors.accent, color: (theme === 'copa' || theme === 'pride') ? '#000000' : '#FFFFFF', padding: '8px 24px', borderRadius: '50px', width: 'fit-content', fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '4px' }}>
              Agenda
           </div>
           <h1 style={{ fontSize: '90px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', margin: 0, lineHeight: 0.8, letterSpacing: '-4px' }}>
              DA <span style={{ opacity: 0.4 }}>{subTitleText}</span>
           </h1>
        </div>
        {logoUrl && (
          <img src={logoUrl} style={{ height: '70px', maxWidth: '300px', objectFit: 'contain', marginBottom: '10px' }} alt="Logo" />
        )}
      </div>

      <div 
        ref={containerRef}
        className="viby-events-container"
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: `${config.gap}px`, 
          width: '100%',
          maxWidth: '100%',
          height: `${maxCards * config.itemHeight + (maxCards - 1) * config.gap}px`,
          overflow: 'hidden',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 10
        }}
      >
        {visibleEvents.map((ev) => (
          <div 
            key={ev.id} 
            className="viby-card"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '30px', 
              background: colors.itemBg, 
              padding: '24px', 
              borderRadius: '40px',
              width: '100%',
              maxWidth: '100%',
              height: `${config.itemHeight}px`,
              flexShrink: 0,
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}
          >
             <div className="viby-card-image" style={{ width: '130px', height: '130px', borderRadius: '25px', overflow: 'hidden', flexShrink: 0 }}>
                <img src={ev.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
             </div>
             
             <div className="viby-card-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
                <div className="viby-card-date" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                   <span style={{ fontSize: '20px', fontWeight: 900, color: colors.accent, fontStyle: 'italic' }}>{formatTemplateDate(ev.date)}</span>
                   <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.text, opacity: 0.3 }} />
                   <span style={{ fontSize: '16px', fontWeight: 700, opacity: 0.6, textTransform: 'uppercase' }}>{formatTemplateTime(ev.date, ev.endDate)}</span>
                </div>
                
                <h2 className="viby-card-title" style={{ fontSize: '36px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', lineHeight: 1.1, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', boxSizing: 'border-box' }}>
                   {shortenTitle(ev.title, 45)}
                </h2>
                
                <div className="viby-card-location" style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.5, overflow: 'hidden', boxSizing: 'border-box' }}>
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                   </svg>
                   <span style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.city}</span>
                </div>
             </div>
          </div>
        ))}
      </div>

      <div 
        className="viby-footer"
        style={{ 
          marginTop: 'auto', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          gap: '40px', 
          height: `${config.footerHeight}px`,
          width: '100%',
          maxWidth: '100%',
          flexShrink: 0,
          boxSizing: 'border-box'
        }}
      >
         <div style={{ flex: 1, height: '2px', background: colors.text, opacity: 0.1 }} />
         <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <p style={{ fontSize: '24px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', margin: 0 }}>{siteUrl}</p>
            <p style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '4px', margin: 0 }}>O AGORA É AQUI</p>
         </div>
         <div style={{ flex: 1, height: '2px', background: colors.text, opacity: 0.1 }} />
      </div>
    </div>
  );
}
