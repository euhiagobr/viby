
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

/**
 * @fileOverview Template de Stories Único otimizado para UX.
 * 
 * - Área de imagem em 16:9 (Horizontal).
 * - Exibição completa de Local, Cidade e Endereço Resumido.
 * - Spacing otimizado entre conteúdo e rodapé.
 * - QR Code reposicionado para evitar conflitos visuais.
 */
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

  // Resolução de dados de localização conforme Auditoria UX
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
      {/* Background Blur Imersivo */}
      <img 
        src={event.image} 
        crossOrigin="anonymous"
        style={{ 
          position: 'absolute', inset: 0, width: '100%', height: '100%', 
          objectFit: 'cover', filter: 'blur(60px) brightness(0.3)', opacity: 0.7 
        }} 
        alt="" 
      />

      {/* 1. Header Section */}
      <div style={{ width: '100%', padding: '100px 80px 40px 80px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10, boxSizing: 'border-box' }}>
        <div style={{ background: colors.accent, color: (theme === 'copa' || theme === 'pride') ? '#000000' : '#FFFFFF', padding: '12px 36px', borderRadius: '50px', fontSize: '24px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '4px' }}>
          Destaque
        </div>
        {logoUrl && <img src={logoUrl} crossOrigin="anonymous" style={{ width: '320px', height: '80px', objectFit: 'contain' }} alt="Logo" />}
      </div>

      {/* 2. Main Image Section (Proporção 16:9 solicitada) */}
      <div style={{ width: '100%', padding: '0 80px', position: 'relative', zIndex: 10, boxSizing: 'border-box', display: 'flex', justifyContent: 'center' }}>
        <div style={{ 
          width: '920px', 
          height: '518px', 
          borderRadius: '40px', 
          overflow: 'hidden', 
          boxShadow: '0 50px 100px rgba(0,0,0,0.6)', 
          border: '12px solid rgba(255,255,255,0.15)' 
        }}>
          <img 
            src={event.image} 
            crossOrigin="anonymous" 
            style={{ width: '920px', height: '518px', objectFit: 'cover' }} 
            alt="Banner do Evento" 
          />
        </div>
      </div>

      {/* 3. Content Section (Tipografia e Hierarquia) */}
      <div style={{ width: '100%', padding: '80px 80px 40px 80px', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '35px', boxSizing: 'border-box' }}>
         <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span style={{ fontSize: '48px', fontWeight: 900, color: colors.accent, fontStyle: 'italic' }}>
              {formatTemplateDate(event.date, event._additionalCount)}
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

         {/* Localização Detalhada conforme auditoria UX */}
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

      {/* 4. Footer Section (Aumento de padding e reposicionamento do QR) */}
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
