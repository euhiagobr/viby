'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { shortenTitle, formatTemplateDate, formatTemplateTime } from '@/lib/image-generator-utils';

interface EventItem {
  id: string;
  title: string;
  image: string;
  date: any;
  city: string;
}

interface AgendaTemplateProps {
  events: EventItem[];
  format: 'A4' | 'instagram' | 'stories';
  theme: 'viby' | 'claro' | 'escuro' | 'copa';
  logoUrl?: string;
  pageNumber?: number;
  totalPages?: number;
}

/**
 * Template oficial "Agenda da Semana"
 * Suporta tema especial Copa do Mundo 2026.
 * Layout otimizado para evitar transbordamento com alturas fixas estritas.
 */
export function AgendaTemplate({ events, format, theme, logoUrl, pageNumber, totalPages }: AgendaTemplateProps) {
  const config = {
    stories: { width: 1080, height: 1920, itemHeight: 180, headerMargin: 40 },
    instagram: { width: 1080, height: 1350, itemHeight: 200, headerMargin: 30 },
    A4: { width: 1240, height: 1754, itemHeight: 210, headerMargin: 60 }
  }[format];

  const colors = {
    viby: { bg: 'linear-gradient(135deg, #000B26 0%, #2C52EE 100%)', text: '#FFFFFF', itemBg: 'rgba(255,255,255,0.05)', accent: '#2C52EE' },
    claro: { bg: '#F8FAFC', text: '#000000', itemBg: '#FFFFFF', accent: '#2C52EE' },
    escuro: { bg: '#000000', text: '#FFFFFF', itemBg: '#111111', accent: '#2C52EE' },
    copa: { bg: 'linear-gradient(135deg, #002776 0%, #009c3b 100%)', text: '#FFFFFF', itemBg: 'rgba(255,255,255,0.1)', accent: '#ffdf00' }
  }[theme];

  const siteUrl = theme === 'copa' ? 'viby.club/copa-do-mundo' : 'viby.club';

  return (
    <div 
      className="viby-export-page"
      style={{ 
        width: `${config.width}px`, 
        height: `${config.height}px`, 
        background: colors.bg,
        color: colors.text,
        display: 'flex',
        flexDirection: 'column',
        padding: '50px 80px',
        fontFamily: 'Poppins, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background Decor */}
      <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '600px', height: '600px', background: `${colors.accent}15`, borderRadius: '50%', filter: 'blur(100px)' }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: `${config.headerMargin}px`, position: 'relative', zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
           <div style={{ background: colors.accent, color: theme === 'copa' ? '#002776' : '#FFFFFF', padding: '8px 20px', borderRadius: '50px', width: 'fit-content', fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '4px' }}>
              Agenda
           </div>
           <h1 style={{ fontSize: '90px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', margin: 0, lineHeight: 0.8, letterSpacing: '-4px' }}>
              DA <span style={{ color: theme === 'claro' ? colors.accent : '#FFFFFF', opacity: theme === 'claro' ? 1 : 0.4 }}>SEMANA</span>
           </h1>
           {totalPages && totalPages > 1 && (
             <p style={{ fontSize: '18px', fontWeight: 800, opacity: 0.5, margin: '10px 0 0 5px' }}>PÁGINA {pageNumber} DE {totalPages}</p>
           )}
        </div>
        {logoUrl && (
          <img src={logoUrl} style={{ height: '70px', objectFit: 'contain' }} alt="Logo" />
        )}
      </div>

      {/* Events List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', flex: 1, position: 'relative', zIndex: 10, overflow: 'hidden' }}>
        {events.map((ev) => (
          <div 
            key={ev.id} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '30px', 
              background: colors.itemBg, 
              padding: '18px', 
              borderRadius: '35px',
              border: theme === 'claro' ? '1px solid #E2E8F0' : '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
              boxSizing: 'border-box',
              height: `${config.itemHeight}px`,
              maxHeight: `${config.itemHeight}px`,
              flexShrink: 0,
              overflow: 'hidden'
            }}
          >
             <div style={{ width: '120px', height: '120px', borderRadius: '25px', overflow: 'hidden', flexShrink: 0 }}>
                <img src={ev.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
             </div>
             
             <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                   <span style={{ fontSize: '18px', fontWeight: 900, color: colors.accent, fontStyle: 'italic' }}>{formatTemplateDate(ev.date)}</span>
                   <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.text, opacity: 0.3 }} />
                   <span style={{ fontSize: '14px', fontWeight: 700, opacity: 0.6, textTransform: 'uppercase' }}>{formatTemplateTime(ev.date)}</span>
                </div>
                
                <h2 style={{ fontSize: '32px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', lineHeight: 1, margin: 0, color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                   {shortenTitle(ev.title, 35)}
                </h2>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.5 }}>
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                   </svg>
                   <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>{ev.city}</span>
                </div>
             </div>
          </div>
        ))}
      </div>

      {/* Footer / CTA */}
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '30px', padding: '20px 0', position: 'relative', zIndex: 10, flexShrink: 0 }}>
         <div style={{ flex: 1, height: '2px', background: colors.text, opacity: 0.1 }} />
         <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <p style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', margin: 0 }}>{siteUrl}</p>
            <p style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '4px', margin: 0 }}>O AGORA É AQUI</p>
         </div>
         <div style={{ flex: 1, height: '2px', background: colors.text, opacity: 0.1 }} />
      </div>
    </div>
  );
}
