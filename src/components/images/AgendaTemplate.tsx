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
  theme: 'viby' | 'claro' | 'escuro';
  logoUrl?: string;
}

/**
 * Template oficial "Agenda da Semana"
 * Segue rigorosamente a identidade visual da Viby.
 */
export function AgendaTemplate({ events, format, theme, logoUrl }: AgendaTemplateProps) {
  const config = {
    stories: { width: 1080, height: 1920, items: 6, fontSize: 32 },
    instagram: { width: 1080, height: 1350, items: 5, fontSize: 28 },
    A4: { width: 1240, height: 1754, items: 7, fontSize: 36 }
  }[format];

  const colors = {
    viby: { bg: 'linear-gradient(135deg, #000B26 0%, #2C52EE 100%)', text: '#FFFFFF', itemBg: 'rgba(255,255,255,0.05)' },
    claro: { bg: '#F8FAFC', text: '#000000', itemBg: '#FFFFFF' },
    escuro: { bg: '#000000', text: '#FFFFFF', itemBg: '#111111' }
  }[theme];

  return (
    <div 
      style={{ 
        width: `${config.width}px`, 
        height: `${config.height}px`, 
        background: colors.bg,
        color: colors.text,
        display: 'flex',
        flexDirection: 'column',
        padding: '80px',
        fontFamily: 'Poppins, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Background Decor */}
      <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '600px', height: '600px', background: 'rgba(44, 82, 238, 0.1)', borderRadius: '50%', filter: 'blur(100px)' }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '80px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
           <div style={{ background: '#2C52EE', color: '#FFFFFF', padding: '10px 25px', borderRadius: '50px', width: 'fit-content', fontSize: '24px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '4px' }}>
              Agenda
           </div>
           <h1 style={{ fontSize: '100px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', margin: 0, lineHeight: 0.8, letterSpacing: '-4px' }}>
              DA <span style={{ color: theme === 'claro' ? '#2C52EE' : '#FFFFFF', opacity: theme === 'claro' ? 1 : 0.4 }}>SEMANA</span>
           </h1>
        </div>
        {logoUrl && (
          <img src={logoUrl} style={{ height: '80px', objectFit: 'contain', filter: theme === 'viby' || theme === 'escuro' ? 'brightness(0) invert(1)' : 'none' }} alt="Logo" />
        )}
      </div>

      {/* Events List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', flex: 1, position: 'relative', zIndex: 10 }}>
        {events.slice(0, config.items).map((ev) => (
          <div 
            key={ev.id} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '40px', 
              background: colors.itemBg, 
              padding: '30px', 
              borderRadius: '40px',
              border: theme === 'claro' ? '1px solid #E2E8F0' : '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.05)'
            }}
          >
             <div style={{ width: '180px', height: '180px', borderRadius: '30px', overflow: 'hidden', flexShrink: 0 }}>
                <img src={ev.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
             </div>
             
             <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                   <span style={{ fontSize: '24px', fontWeight: 900, color: '#2C52EE', fontStyle: 'italic' }}>{formatTemplateDate(ev.date)}</span>
                   <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: colors.text, opacity: 0.3 }} />
                   <span style={{ fontSize: '20px', fontWeight: 700, opacity: 0.6, textTransform: 'uppercase' }}>{formatTemplateTime(ev.date)}</span>
                </div>
                
                <h2 style={{ fontSize: '42px', fontWeight: 900, textTransform: 'uppercase', italic: 'italic', lineHeight: 1, margin: 0, color: colors.text }}>
                   {shortenTitle(ev.title, 40)}
                </h2>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.5 }}>
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                   </svg>
                   <span style={{ fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>{ev.city}</span>
                </div>
             </div>

             <div style={{ padding: '20px', background: '#2C52EE', borderRadius: '25px', color: '#FFF' }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                   <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
             </div>
          </div>
        ))}
      </div>

      {/* Footer / CTA */}
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '40px', padding: '40px 0', position: 'relative', zIndex: 10 }}>
         <div style={{ flex: 1, height: '2px', background: colors.text, opacity: 0.1 }} />
         <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
            <p style={{ fontSize: '24px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', margin: 0 }}>viby.club</p>
            <p style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '4px', margin: 0 }}>O AGORA É AQUI</p>
         </div>
         <div style={{ flex: 1, height: '2px', background: colors.text, opacity: 0.1 }} />
      </div>
    </div>
  );
}
