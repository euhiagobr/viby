'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { shortenTitle, formatTemplateDate, formatTemplateTime } from '@/lib/image-generator-utils';
import { QRCodeSVG } from 'qrcode.react';

interface StoryTemplateProps {
  event: any;
  theme: 'viby' | 'claro' | 'escuro' | 'copa' | 'pride';
  logoUrl?: string;
}

export function StoryTemplate({ event, theme, logoUrl }: StoryTemplateProps) {
  const colors = {
    viby: { bg: 'linear-gradient(135deg, #000B26 0%, #2C52EE 60%, #8b5cf6 100%)', text: '#FFFFFF', accent: '#2C52EE', qrBg: '#FFFFFF' },
    claro: { bg: '#F8FAFC', text: '#000000', accent: '#2C52EE', qrBg: '#FFFFFF' },
    escuro: { bg: '#000000', text: '#FFFFFF', accent: '#2C52EE', qrBg: '#111111' },
    copa: { bg: 'linear-gradient(135deg, #002776 0%, #009c3b 100%)', text: '#FFFFFF', accent: '#ffdf00', qrBg: '#FFFFFF' },
    pride: { bg: 'linear-gradient(45deg, #FF0000, #FF8B00, #FFD300, #008121, #004CFF, #760089)', text: '#FFFFFF', accent: '#FFFFFF', qrBg: '#FFFFFF' }
  }[theme];

  const siteUrl = theme === 'copa' ? 'viby.club/copa-do-mundo' : theme === 'pride' ? 'viby.club/lgbt' : 'viby.club';
  const qrUrl = `https://viby.club/${event.organizer?.username || 'evento'}/${event.slug || event.id}?vsrc=qr_story`;

  return (
    <div 
      className="viby-export-page"
      style={{ 
        width: '1080px', 
        height: '1920px', 
        background: colors.bg,
        color: colors.text,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center', 
        fontFamily: 'Poppins, sans-serif',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Imagem de Fundo (Blur) */}
      <img 
        src={event.image} 
        style={{ 
          position: 'absolute', inset: 0, width: '100%', height: '100%', 
          objectFit: 'cover', filter: 'blur(40px) brightness(0.4)', opacity: 0.5 
        }} 
        alt="" 
      />

      {/* Header */}
      <div style={{ width: '100%', padding: '80px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10, boxSizing: 'border-box' }}>
        <div style={{ background: colors.accent, color: (theme === 'copa' || theme === 'pride') ? '#000000' : '#FFFFFF', padding: '12px 36px', borderRadius: '50px', fontSize: '24px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '4px' }}>
          Destaque
        </div>
        {logoUrl && <img src={logoUrl} style={{ height: '70px', maxWidth: '300px', objectFit: 'contain' }} alt="Logo" />}
      </div>

      {/* Main Image */}
      <div style={{ width: '100%', padding: '0 80px', position: 'relative', zIndex: 10, boxSizing: 'border-box', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: '60px', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.5)', border: '12px solid rgba(255,255,255,0.1)' }}>
          <img src={event.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        </div>
      </div>

      {/* Content */}
      <div style={{ width: '100%', padding: '60px 80px', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '30px', boxSizing: 'border-box' }}>
         <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span style={{ fontSize: '46px', fontWeight: 900, color: colors.accent, fontStyle: 'italic' }}>{formatTemplateDate(event.date)}</span>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors.accent }} />
            <span style={{ fontSize: '32px', fontWeight: 700, opacity: 0.8 }}>{formatTemplateTime(event.date, event.endDate)}</span>
         </div>

         <h1 style={{ 
           fontSize: '110px', 
           fontWeight: 900, 
           textTransform: 'uppercase', 
           fontStyle: 'italic', 
           lineHeight: 0.85, 
           margin: 0, 
           letterSpacing: '-6px',
           width: '100%',
           overflow: 'hidden',
           whiteSpace: 'nowrap',
           textOverflow: 'ellipsis'
         }}>
           {shortenTitle(event.title, 30)}
         </h1>

         <div style={{ display: 'flex', alignItems: 'center', gap: '15px', opacity: 0.7 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span style={{ fontSize: '32px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.city}</span>
         </div>
      </div>

      {/* QR Code Footer */}
      <div style={{ width: '100%', marginTop: 'auto', padding: '80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 10, background: 'rgba(0,0,0,0.2)', backdropBlur: '10px', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
           <p style={{ fontSize: '32px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', margin: 0 }}>{siteUrl}</p>
           <p style={{ fontSize: '16px', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '6px', margin: 0 }}>Escaneie para acessar</p>
        </div>
        <div style={{ padding: '15px', background: '#FFFFFF', borderRadius: '30px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
           <QRCodeSVG value={qrUrl} size={160} level="H" />
        </div>
      </div>
    </div>
  );
}
