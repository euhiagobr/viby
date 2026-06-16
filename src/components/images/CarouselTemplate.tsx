'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { shortenTitle, formatTemplateDate, formatTemplateTime } from '@/lib/image-generator-utils';
import { QRCodeSVG } from 'qrcode.react';

interface CarouselTemplateProps {
  event: any;
  aspectRatio: '1:1' | '4:5';
  theme: 'viby' | 'claro' | 'escuro' | 'copa' | 'pride';
  logoUrl?: string;
  slideNumber?: number;
  totalSlides?: number;
}

export function CarouselTemplate({ event, aspectRatio, theme, logoUrl, slideNumber, totalSlides }: CarouselTemplateProps) {
  const config = {
    '1:1': { width: 1080, height: 1080, padding: 80 },
    '4:5': { width: 1080, height: 1350, padding: 80 }
  }[aspectRatio];

  const colors = {
    viby: { bg: 'linear-gradient(135deg, #000B26 0%, #2C52EE 100%)', text: '#FFFFFF', accent: '#2C52EE' },
    claro: { bg: '#F8FAFC', text: '#000000', accent: '#2C52EE' },
    escuro: { bg: '#000000', text: '#FFFFFF', accent: '#2C52EE' },
    copa: { bg: 'linear-gradient(135deg, #002776 0%, #009c3b 100%)', text: '#FFFFFF', accent: '#ffdf00' },
    pride: { bg: 'linear-gradient(45deg, #FF0000, #FF8B00, #FFD300, #008121, #004CFF, #760089)', text: '#FFFFFF', accent: '#FFFFFF' }
  }[theme];

  const qrUrl = `https://viby.club/${event.organizer?.username || 'evento'}/${event.slug || event.id}?vsrc=qr_carousel`;

  return (
    <div 
      className="viby-carousel-slide"
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
      {/* Background Decor */}
      <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: '400px', height: '400px', background: `${colors.accent}20`, borderRadius: '50%', filter: 'blur(80px)' }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '60px', position: 'relative', zIndex: 10, width: '100%', boxSizing: 'border-box' }}>
        {logoUrl ? <img src={logoUrl} style={{ height: '60px', maxWidth: '300px', objectFit: 'contain' }} alt="Logo" /> : <span style={{ fontSize: '32px', fontWeight: 900, fontStyle: 'italic' }}>VIBY</span>}
        {totalSlides && totalSlides > 1 && (
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 24px', borderRadius: '50px', fontSize: '18px', fontWeight: 900 }}>
             {slideNumber} / {totalSlides}
          </div>
        )}
      </div>

      {/* Image & Main Info Container */}
      <div style={{ display: 'flex', gap: '40px', flex: 1, alignItems: 'center', width: '100%', position: 'relative', zIndex: 10, boxSizing: 'border-box' }}>
        <div style={{ width: '450px', height: '450px', borderRadius: '40px', overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.3)', flexShrink: 0, border: '8px solid rgba(255,255,255,0.1)' }}>
          <img src={event.image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        </div>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, overflow: 'hidden' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span style={{ fontSize: '32px', fontWeight: 900, color: colors.accent, fontStyle: 'italic' }}>{formatTemplateDate(event.date)}</span>
              <span style={{ fontSize: '24px', fontWeight: 700, opacity: 0.6 }}>{formatTemplateTime(event.date)}</span>
           </div>
           
           <h2 style={{ 
             fontSize: '64px', 
             fontWeight: 900, 
             textTransform: 'uppercase', 
             fontStyle: 'italic', 
             lineHeight: 0.9, 
             margin: 0, 
             letterSpacing: '-3px',
             whiteSpace: 'nowrap',
             overflow: 'hidden',
             textOverflow: 'ellipsis'
           }}>
              {shortenTitle(event.title, 35)}
           </h2>

           <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.5 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                 <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                 <circle cx="12" cy="10" r="3" />
              </svg>
              <span style={{ fontSize: '20px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.city}</span>
           </div>
        </div>
      </div>

      {/* Footer / QR */}
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', position: 'relative', zIndex: 10, boxSizing: 'border-box' }}>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <p style={{ fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', margin: 0 }}>viby.club/{event.organizer?.username}</p>
            <p style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', opacity: 0.4, letterSpacing: '4px', margin: 0 }}>Garante o seu lugar agora</p>
         </div>
         <div style={{ padding: '12px', background: '#FFFFFF', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
            <QRCodeSVG value={qrUrl} size={110} level="H" />
         </div>
      </div>
    </div>
  );
}
