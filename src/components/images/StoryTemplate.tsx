'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { shortenTitle, formatTemplateDate, formatTemplateTime } from '@/lib/image-generator-utils';
import { QRCodeSVG } from 'qrcode.react';

interface StoryTemplateProps {
  event: any;
  theme: 'viby' | 'claro' | 'escuro' | 'copa' | 'pride' | 'junina' | 'junina_noite';
  logoUrl?: string;
}

const Bandeirinhas = ({ color }: { color: string }) => (
  <svg width="100%" height="80" viewBox="0 0 1000 80" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, zIndex: 20 }}>
    {Array.from({ length: 15 }).map((_, i) => (
      <path 
        key={i} 
        d={`M${i * 67} 0 L${i * 67 + 33} 75 L${(i + 1) * 67} 0 Z`} 
        fill={i % 3 === 0 ? color : i % 3 === 1 ? '#ea580c' : '#facc15'} 
        stroke="rgba(0,0,0,0.1)"
        strokeWidth="1"
      />
    ))}
  </svg>
);

const BonfireSVG = () => (
  <svg viewBox="0 0 100 100" style={{ width: '300px', height: '300px', opacity: 0.4, filter: 'blur(2px)' }}>
    <path d="M50 10 Q 70 40 50 80 Q 30 40 50 10" fill="#facc15" />
    <path d="M50 30 Q 65 50 50 85 Q 35 50 50 30" fill="#ea580c" />
    <path d="M50 50 Q 55 60 50 90 Q 45 60 50 50" fill="#dc2626" />
  </svg>
);

/**
 * @fileOverview Template de Stories Único otimizado para UX.
 */
export function StoryTemplate({ event, theme, logoUrl }: StoryTemplateProps) {
  const colors = {
    viby: { bg: 'linear-gradient(135deg, #000B26 0%, #2C52EE 60%, #8b5cf6 100%)', text: '#FFFFFF', accent: '#2C52EE', qrBg: '#FFFFFF' },
    claro: { bg: '#F8FAFC', text: '#000000', accent: '#2C52EE', qrBg: '#FFFFFF' },
    escuro: { bg: '#000000', text: '#FFFFFF', accent: '#2C52EE', qrBg: '#111111' },
    copa: { bg: 'linear-gradient(135deg, #002776 0%, #009c3b 100%)', text: '#FFFFFF', accent: '#ffdf00', qrBg: '#FFFFFF' },
    pride: { bg: 'linear-gradient(45deg, #FF0000, #FF8B00, #FFD300, #008121, #004CFF, #760089)', text: '#FFFFFF', accent: '#FFFFFF', qrBg: '#FFFFFF' },
    junina: { bg: 'linear-gradient(135deg, #451a03 0%, #78350f 100%)', text: '#fefce8', accent: '#facc15', qrBg: '#fefce8' },
    junina_noite: { bg: 'linear-gradient(to bottom, #000000, #451a03)', text: '#fefce8', accent: '#ea580c', qrBg: '#fefce8' }
  }[theme];

  const siteUrl = theme === 'copa' ? 'viby.club/copa-do-mundo' : theme === 'pride' ? 'viby.club/lgbt' : (theme.includes('junina') ? 'viby.club/festa-junina' : 'viby.club');
  const qrUrl = `https://viby.club/${event.organizer?.username || 'evento'}/${event.slug || event.id}?vsrc=qr_story`;

  const venueName = event.address?.venueName || event.location || "Local a definir";
  const cityDisplay = event.city || event.address?.city || "";
  const shortAddress = event.address?.neighborhood || event.address?.addressLine1 || "";

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
      <img 
        src={event.image} 
        crossOrigin="anonymous"
        style={{ 
          position: 'absolute', inset: 0, width: '100%', height: '100%', 
          objectFit: 'cover', filter: 'blur(60px) brightness(0.3)', opacity: 0.7 
        }} 
        alt="" 
      />

      {theme.includes('junina') && <Bandeirinhas color="#dc2626" />}

      {theme === 'junina_noite' && (
        <div style={{ position: 'absolute', bottom: '150px', right: '-50px', transform: 'rotate(-10deg)' }}>
           <BonfireSVG />
        </div>
      )}

      <div style={{ width: '100%', padding: '120px 80px 40px 80px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10, boxSizing: 'border-box' }}>
        <div style={{ background: colors.accent, color: (theme === 'copa' || theme === 'pride' || theme.includes('junina')) ? '#000000' : '#FFFFFF', padding: '12px 36px', borderRadius: '50px', fontSize: '24px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '4px' }}>
          {theme.includes('junina') ? 'Arraiá' : 'Destaque'}
        </div>
        {logoUrl && <img src={logoUrl} crossOrigin="anonymous" style={{ width: '320px', height: '80px', objectFit: 'contain' }} alt="Logo" />}
      </div>

      <div style={{ width: '100%', padding: '0 80px', position: 'relative', zIndex: 10, boxSizing: 'border-box', display: 'flex', justifyContent: 'center' }}>
        <div style={{ 
          width: '920px', 
          height: '518px', 
          borderRadius: '40px', 
          overflow: 'hidden', 
          boxShadow: '0 50px 100px rgba(0,0,0,0.6)', 
          border: `12px solid ${theme.includes('junina') ? 'rgba(250, 204, 21, 0.2)' : 'rgba(255,255,255,0.15)'}` 
        }}>
          <img 
            src={event.image} 
            crossOrigin="anonymous" 
            style={{ width: '920px', height: '518px', objectFit: 'cover' }} 
            alt="Banner" 
          />
        </div>
      </div>

      <div style={{ width: '100%', padding: '80px 80px 40px 80px', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '35px', boxSizing: 'border-box' }}>
         <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span style={{ fontSize: '48px', fontWeight: 900, color: colors.accent, fontStyle: 'italic' }}>
              {formatTemplateDate(event.date)}
            </span>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: colors.accent }} />
            <span style={{ fontSize: '32px', fontWeight: 700, opacity: 0.8 }}>{formatTemplateTime(event.date, event.endDate)}</span>
         </div>

         <h1 style={{ 
           fontSize: '110px', 
           fontWeight: 900, 
           textTransform: 'uppercase', 
           fontStyle: 'italic', 
           lineHeight: 0.8, 
           margin: 0, 
           letterSpacing: '-6px',
           width: '100%',
           overflow: 'hidden',
           whiteSpace: 'nowrap',
           textOverflow: 'ellipsis'
         }}>
           {shortenTitle(event.title, 25)}
         </h1>

         <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', color: colors.accent }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span style={{ fontSize: '44px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-1px' }}>
                {venueName}
              </span>
            </div>
            <p style={{ fontSize: '28px', fontWeight: 800, textTransform: 'uppercase', opacity: 0.6, letterSpacing: '2px', marginLeft: '51px' }}>
              {cityDisplay} {shortAddress ? `• ${shortAddress}` : ""}
            </p>
         </div>
      </div>

      <div style={{ 
        width: '100%', 
        marginTop: 'auto', 
        padding: '120px 80px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        position: 'relative', 
        zIndex: 10, 
        background: 'rgba(0,0,0,0.3)', 
        boxSizing: 'border-box',
        borderTop: '2px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
           <p style={{ fontSize: '38px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', margin: 0, letterSpacing: '-1px' }}>{siteUrl}</p>
           <p style={{ fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', opacity: 0.5, letterSpacing: '8px', margin: 0 }}>Escaneie e viva o agora</p>
        </div>
        <div style={{ 
          padding: '20px', 
          background: '#FFFFFF', 
          borderRadius: '40px', 
          boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
          transform: 'rotate(-2deg)'
        }}>
           <QRCodeSVG value={qrUrl} size={180} level="H" />
        </div>
      </div>
    </div>
  );
}
