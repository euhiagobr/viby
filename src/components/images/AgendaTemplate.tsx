
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
  const isSingle = events.length === 1;
  const isFew = events.length <= 3;

  const baseConfig = {
    stories: { 
      width: 1080, 
      height: 1920, 
      itemHeight: isSingle ? 500 : isFew ? 300 : 180, 
      headerHeight: 250, 
      footerHeight: 120, 
      padding: 80, 
      gap: 30 
    },
    instagram: { 
      width: 1080, 
      height: 1080, 
      itemHeight: isSingle ? 450 : isFew ? 280 : 210, 
      headerHeight: 200, 
      footerHeight: 100, 
      padding: 60, 
      gap: 25 
    },
    A4: { 
      width: 1240, 
      height: 1754, 
      itemHeight: isSingle ? 500 : isFew ? 300 : 210, 
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

  const siteUrl = theme === 'copa' ? 'viby.club/copa-do-mundo' : theme === 'pride' ? 'viby.club/lgbt' : 'viby.club';
  
  const isCopa = theme === 'copa';
  const isPride = theme === 'pride';
  
  const badgeText = isCopa ? 'COPA 2026' : 'Agenda';
  const mainTitle = isCopa ? 'ONDE ASSISTIR' : 'AGENDA';
  const subTitleText = isPride ? 'DIVERSIDADE' : isCopa ? 'O BRASIL' : 'DA SEMANA';

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

      <div 
        className="viby-header"
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-end', 
          height: `${baseConfig.headerHeight}px`,
          width: '100%', 
          marginBottom: '20px',
          boxSizing: 'border-box',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
           <div style={{ background: colors.accent, color: (isCopa || isPride) ? '#000000' : '#FFFFFF', padding: '8px 24px', borderRadius: '50px', width: 'fit-content', fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '4px' }}>
              {badgeText}
           </div>
           <h1 style={{ fontSize: isSingle ? '110px' : '90px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', margin: 0, lineHeight: 0.8, letterSpacing: '-4px' }}>
              {mainTitle} <span style={{ opacity: 0.4 }}>{subTitleText}</span>
           </h1>
        </div>
        {logoUrl && (
          <img src={logoUrl} crossOrigin="anonymous" style={{ width: '220px', height: '70px', objectFit: 'contain', marginBottom: '10px' }} alt="Logo" />
        )}
      </div>

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
              alignItems: 'center', 
              gap: isSingle ? '60px' : '30px', 
              background: colors.itemBg, 
              padding: isSingle ? '60px' : '24px', 
              borderRadius: isSingle ? '60px' : '40px',
              width: '100%',
              height: `${baseConfig.itemHeight}px`,
              flexShrink: 0,
              boxSizing: 'border-box',
              overflow: 'hidden',
              border: isSingle ? `4px solid ${colors.accent}40` : 'none'
            }}
          >
             <div className="viby-card-image" style={{ width: isSingle ? '380px' : '130px', height: isSingle ? '380px' : '130px', borderRadius: '25px', overflow: 'hidden', flexShrink: 0 }}>
                <img src={ev.image} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
             </div>
             
             <div className="viby-card-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, overflow: 'hidden', boxSizing: 'border-box' }}>
                <div className="viby-card-date" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                   <span style={{ fontSize: isSingle ? '36px' : '20px', fontWeight: 900, color: colors.accent, fontStyle: 'italic' }}>
                     {formatTemplateDate(ev.date)}
                   </span>
                   <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.text, opacity: 0.3 }} />
                   <span style={{ fontSize: isSingle ? '24px' : '16px', fontWeight: 700, opacity: 0.6, textTransform: 'uppercase' }}>{formatTemplateTime(ev.date, ev.endDate)}</span>
                </div>
                
                <h2 className="viby-card-title" style={{ fontSize: isSingle ? '72px' : '36px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', lineHeight: 1.1, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', boxSizing: 'border-box' }}>
                   {shortenTitle(ev.title, isSingle ? 25 : 45)}
                </h2>
                
                <div className="viby-card-location" style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.5, overflow: 'hidden', boxSizing: 'border-box' }}>
                   <svg width={isSingle ? "24" : "16"} height={isSingle ? "24" : "16"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                   </svg>
                   <span style={{ fontSize: isSingle ? '24px' : '16px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.city}</span>
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
          height: `${baseConfig.footerHeight}px`,
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
