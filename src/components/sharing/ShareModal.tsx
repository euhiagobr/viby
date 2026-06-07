'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Share2, 
  Download, 
  Loader2, 
  Smartphone, 
  Instagram,
  Monitor,
  X,
  Palette,
  Zap,
  ShieldCheck,
  Building2,
  Globe,
  Camera,
  MousePointer2,
  RefreshCw,
  Star,
  Layout,
  AlertTriangle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { toPng } from 'html-to-image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchImageAsBase64 } from '@/app/actions/image-proxy';

const VIBY_LOGO_OFFICIAL = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1780427858048?alt=media&token=5bf01a27-8521-4a59-a78b-70c888aa0417";

interface ShareModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    title: string;
    username: string;
    url: string;
    logoUrl?: string;
    bannerUrl?: string;
    type: 'organization' | 'event';
    organizationId: string;
    eventId?: string;
    verified?: boolean;
  };
}

type Format = 'A4' | 'A5' | 'A6' | 'instagram' | 'stories';
type Theme = 'viby' | 'claro' | 'escuro' | 'neon' | 'pride' | 'premium' | 'corporativo' | 'foto';

const FORMAT_CONFIGS: Record<Format, { width: number; height: number; label: string }> = {
  'A4': { width: 1240, height: 1754, label: 'Folha A4' },
  'A5': { width: 874, height: 1240, label: 'Folha A5' },
  'A6': { width: 620, height: 874, label: 'Folha A6' },
  'instagram': { width: 1080, height: 1080, label: 'Feed (1:1)' },
  'stories': { width: 1080, height: 1920, label: 'Stories (9:16)' }
};

const THEMES: { id: Theme; label: string; icon: any }[] = [
  { id: 'viby', label: 'Viby (Padrão)', icon: Zap },
  { id: 'claro', label: 'Visual Claro', icon: Globe },
  { id: 'escuro', label: 'Visual Escuro', icon: Monitor },
  { id: 'neon', label: 'Cena Neon', icon: Zap },
  { id: 'pride', label: 'Pride / Diversity', icon: Star },
  { id: 'premium', label: 'Black & Gold', icon: ShieldCheck },
  { id: 'corporativo', label: 'Corporativo', icon: Building2 },
  { id: 'foto', label: 'Foto da Marca', icon: Camera }
];

export function ShareModal({ isOpen, onOpenChange, data }: ShareModalProps) {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isAssetsLoaded, setIsAssetsLoaded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  
  const [orgLogoBase64, setOrgLogoBase64] = React.useState<string | null>(null);
  const [vibyLogoBase64, setVibyLogoBase64] = React.useState<string | null>(null);
  const [bannerBase64, setBannerBase64] = React.useState<string | null>(null);
  
  const [selectedTheme, setSelectedTheme] = React.useState<Theme>('viby');
  const [currentFormat, setCurrentFormat] = React.useState<Format>('stories');
  
  const renderRef = React.useRef<HTMLDivElement>(null);
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${data.url}${data.url.includes('?') ? '&' : '?'}vsrc=qr`;

  const loadAssets = React.useCallback(async () => {
    setIsAssetsLoaded(false);
    try {
      const [vibyRes, orgRes, bannerRes] = await Promise.all([
        fetchImageAsBase64(VIBY_LOGO_OFFICIAL),
        data.logoUrl ? fetchImageAsBase64(data.logoUrl) : Promise.resolve({ success: false, data: null }),
        data.bannerUrl ? fetchImageAsBase64(data.bannerUrl) : Promise.resolve({ success: false, data: null })
      ]);

      if (vibyRes.success && vibyRes.data) setVibyLogoBase64(vibyRes.data);
      if (orgRes.success && orgRes.data) setOrgLogoBase64(orgRes.data);
      if (bannerRes.success && bannerRes.data) setBannerBase64(bannerRes.data);

      setIsAssetsLoaded(true);
    } catch (e) {
      console.error("[SHARE-MODAL] Assets loading failed:", e);
      setIsAssetsLoaded(true); 
    }
  }, [data.logoUrl, data.bannerUrl]);

  React.useEffect(() => {
    if (isOpen) {
      loadAssets();
    } else {
      setOrgLogoBase64(null);
      setVibyLogoBase64(null);
      setBannerBase64(null);
    }
  }, [isOpen, loadAssets]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({ title: "Link copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: data.title,
          text: `Confira ${data.title} na Viby!`,
          url: shareUrl,
        });
      } catch (err) { /* ignore */ }
    } else {
      handleCopyLink();
    }
  };

  const handleDownload = async (format: Format) => {
    if (!renderRef.current || !isAssetsLoaded || isGenerating) return;

    setCurrentFormat(format);
    setIsGenerating(true);
    
    // Pequena pausa para garantir que o React renderizou as mudanças de formato no ref invisível
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const config = FORMAT_CONFIGS[format];
      const node = renderRef.current;

      const exportOptions = {
        cacheBust: true,
        backgroundColor: '#ffffff',
        width: config.width,
        height: config.height,
        pixelRatio: 1.5, // Melhorar nitidez
        style: {
          visibility: 'visible',
          opacity: '1'
        }
      };

      // Técnica de Captura Dupla para aquecer o canvas
      await toPng(node, exportOptions);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const dataUrl = await toPng(node, exportOptions);

      if (!dataUrl || dataUrl.length < 1000) {
        throw new Error("Falha na geração dos pixels da imagem.");
      }

      const link = document.createElement('a');
      link.download = `viby-${data.username}-${format}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: "Arte gerada!", description: `Download do formato ${format} concluído.` });
    } catch (err) {
      console.error("[Download Error]", err);
      toast({ variant: "destructive", title: "Erro ao gerar imagem", description: "O processador visual falhou. Tente novamente." });
    } finally {
      setIsGenerating(false);
    }
  };

  const getThemeStyle = (theme: Theme): React.CSSProperties => {
    switch (theme) {
      case 'viby':
        return { background: 'linear-gradient(135deg, #000B26 0%, #2C52EE 60%, #8b5cf6 100%)', color: '#ffffff' };
      case 'claro':
        return { background: '#ffffff', color: '#000000' };
      case 'escuro':
        return { background: '#000000', color: '#ffffff' };
      case 'neon':
        return { background: 'linear-gradient(to bottom, #000000, #1a0033)', color: '#ffffff' };
      case 'pride':
        return { background: 'linear-gradient(45deg, #ff0000, #ff8000, #ffff00, #008000, #0000ff, #8000ff)', color: '#ffffff' };
      case 'premium':
        return { background: '#000000', color: '#D4AF37' };
      case 'corporativo':
        return { background: 'linear-gradient(to bottom, #f8fafc, #e2e8f0)', color: '#1e293b' };
      case 'foto':
        return { background: '#000000', color: '#ffffff' };
      default:
        return { background: '#ffffff', color: '#000000' };
    }
  };

  const renderLogoSection = (size: number, theme: Theme) => {
    const isDark = theme !== 'claro' && theme !== 'corporativo';
    const name = data.title;
    let baseFontSize = size / 3.2;
    if (name.length > 15) baseFontSize = size / 4.2;
    if (name.length > 25) baseFontSize = size / 5.2;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px', width: '100%' }}>
        <div style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          borderRadius: '50%', 
          overflow: 'hidden', 
          backgroundColor: isDark ? '#ffffff' : '#f1f5f9',
          border: `8px solid ${theme === 'premium' ? '#D4AF37' : '#ffffff'}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {orgLogoBase64 ? (
            <img src={orgLogoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
          ) : (
            <div style={{ 
              width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
              backgroundColor: '#2C52EE', color: '#ffffff', fontSize: `${size/2}px`, fontWeight: 900
            }}>
              {data.title.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', width: '90%' }}>
           <h1 style={{ 
             fontSize: `${baseFontSize}px`, fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', 
             textAlign: 'center', margin: 0, letterSpacing: '-0.04em', lineHeight: 0.9, color: theme === 'premium' ? '#D4AF37' : (isDark ? '#ffffff' : '#000000')
           }}>
             {name}
           </h1>
           {data.verified && (
             <div style={{ shrink: 0, display: 'flex' }}>
                <svg width={baseFontSize * 0.7} height={baseFontSize * 0.7} viewBox="0 0 24 24" fill="none">
                   <path d="M12 2L15.09 5.26L19.54 5.9L20.18 10.35L23.44 13.44L20.18 16.53L19.54 20.98L15.09 21.62L12 24.88L8.91 21.62L4.46 20.98L3.82 16.53L0.56 13.44L3.82 10.35L4.46 5.9L8.91 5.26L12 2Z" fill="#3b82f6"/>
                   <path d="M9 12L11 14L15 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
             </div>
           )}
        </div>
      </div>
    );
  };

  const renderQRSection = (qrSize: number, fontSize: number, theme: Theme) => {
    const isDark = theme !== 'claro' && theme !== 'corporativo';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
        <div style={{ 
          padding: '30px', backgroundColor: '#ffffff', borderRadius: '50px', 
          boxShadow: '0 30px 80px rgba(0,0,0,0.3)', border: theme === 'premium' ? '10px solid #D4AF37' : 'none'
        }}>
          <QRCodeSVG value={shareUrl} size={qrSize} level="H" fgColor="#000000" includeMargin={false} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
           <p style={{ 
             fontSize: `${fontSize}px`, fontWeight: 900, color: theme === 'premium' ? '#D4AF37' : (isDark ? '#ffffff' : '#2C52EE'), 
             margin: 0, fontStyle: 'italic', padding: '10px 40px', borderRadius: '20px',
             backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'
           }}>
             viby.club/{data.username}
           </p>
           <p style={{ fontSize: `${fontSize/2.8}px`, fontWeight: 800, textTransform: 'uppercase', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)', margin: 0, letterSpacing: '0.4em' }}>
              Acesse a Agenda Oficial
           </p>
        </div>
      </div>
    );
  };

  const renderFooterSection = (logoHeight: number, theme: Theme) => {
    const isDark = theme !== 'claro' && theme !== 'corporativo';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px', width: '100%', opacity: 0.8 }}>
        <p style={{ fontSize: `${logoHeight/3.5}px`, fontWeight: 900, textTransform: 'uppercase', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)', margin: 0, letterSpacing: '0.5em' }}>
          Powered by
        </p>
        {vibyLogoBase64 ? (
          <img src={vibyLogoBase64} style={{ height: `${logoHeight}px`, objectFit: 'contain', filter: isDark ? 'brightness(0) invert(1)' : 'none' }} alt="Viby" />
        ) : (
          <span style={{ fontSize: `${logoHeight}px`, fontWeight: 900, color: isDark ? '#fff' : '#000', fontStyle: 'italic' }}>VIBY</span>
        )}
      </div>
    );
  };

  const renderFullArte = (format: Format, theme: Theme) => {
    const config = FORMAT_CONFIGS[format];
    const themeStyle = getThemeStyle(theme);
    
    let logoSize = 350;
    let qrSize = 480;
    let fontSize = 54;
    let footerLogo = 80;
    let padding = '180px 80px';

    if (format === 'instagram') {
      logoSize = 240; qrSize = 380; fontSize = 42; footerLogo = 70; padding = '100px 60px';
    }

    const containerStyle: React.CSSProperties = {
      ...themeStyle,
      width: `${config.width}px`,
      height: `${config.height}px`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding,
      fontFamily: 'sans-serif',
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box'
    };

    return (
      <div style={containerStyle}>
        {theme === 'foto' && bannerBase64 && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
            <img src={bannerBase64} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(30px) brightness(0.4)' }} alt="" />
          </div>
        )}
        <div style={{ position: 'relative', zIndex: 10, width: '100%', display: 'flex', justifyContent: 'center' }}>
          {renderLogoSection(logoSize, theme)}
        </div>
        <div style={{ position: 'relative', zIndex: 10, width: '100%', display: 'flex', justifyContent: 'center' }}>
          {renderQRSection(qrSize, fontSize, theme)}
        </div>
        <div style={{ position: 'relative', zIndex: 10, width: '100%', display: 'flex', justifyContent: 'center' }}>
          {renderFooterSection(footerLogo, theme)}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl p-0 overflow-hidden rounded-[2.5rem] bg-white border-none flex flex-col md:flex-row h-[95vh] max-h-[900px]">
        
        {/* Painel Lateral */}
        <div className="w-full md:w-96 flex flex-col bg-white border-r shrink-0">
          <div className="p-8 border-b bg-muted/10">
             <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                   <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><Palette className="w-5 h-5" /></div>
                   <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Artes de Divulgação</DialogTitle>
                </div>
                <DialogDescription className="font-bold text-[10px] uppercase opacity-60">Personalize e baixe seus materiais oficiais.</DialogDescription>
             </DialogHeader>
          </div>

          <ScrollArea className="flex-1">
             <div className="p-8 space-y-10">
                {!isAssetsLoaded && (
                  <div className="p-6 bg-secondary/5 rounded-2xl border border-dashed border-secondary/20 flex flex-col items-center gap-4 text-center">
                     <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                     <p className="text-[10px] font-black uppercase text-secondary">Preparando Materiais...</p>
                  </div>
                )}

                <div className="space-y-4">
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Visual / Tema</p>
                   <div className="grid grid-cols-2 gap-2">
                      {THEMES.map((t) => (
                        <Button 
                          key={t.id}
                          variant={selectedTheme === t.id ? 'secondary' : 'outline'}
                          className={cn(
                            "h-12 justify-start gap-2 rounded-xl text-[10px] font-black uppercase transition-all",
                            selectedTheme === t.id && "bg-secondary text-white shadow-lg shadow-secondary/10 border-none"
                          )}
                          onClick={() => setSelectedTheme(t.id)}
                        >
                           <t.icon className={cn("w-3.5 h-3.5", selectedTheme === t.id ? "text-white" : "text-secondary")} />
                           {t.label}
                        </Button>
                      ))}
                   </div>
                </div>

                <Separator className="border-dashed" />

                <div className="space-y-4">
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Exportar Redes Sociais</p>
                   <div className="grid grid-cols-1 gap-2">
                      <Button onClick={() => handleDownload('stories')} disabled={isGenerating || !isAssetsLoaded} className="h-16 rounded-2xl bg-secondary text-white font-black uppercase italic shadow-xl shadow-secondary/20 gap-3 group">
                         <Smartphone className="w-6 h-6 group-hover:scale-110 transition-transform" />
                         <div className="text-left">
                            <p className="text-sm">Stories Instagram</p>
                            <p className="text-[9px] opacity-60">1080x1920 nativo</p>
                         </div>
                      </Button>
                      <Button onClick={() => handleDownload('instagram')} disabled={isGenerating || !isAssetsLoaded} variant="outline" className="h-14 rounded-2xl font-black uppercase italic text-xs gap-3 border-2">
                         <Instagram className="w-5 h-5 text-pink-500" /> Post Feed (1:1)
                      </Button>
                   </div>
                </div>

                <div className="space-y-3">
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Impressão (PDF/PNG)</p>
                   <div className="grid grid-cols-3 gap-2">
                      {(['A4', 'A5', 'A6'] as Format[]).map(f => (
                        <Button key={f} variant="outline" onClick={() => handleDownload(f)} disabled={isGenerating || !isAssetsLoaded} className="h-12 rounded-xl text-[10px] font-black uppercase border-dashed">
                           {f}
                        </Button>
                      ))}
                   </div>
                </div>
             </div>
          </ScrollArea>

          <div className="p-8 border-t bg-muted/10 flex flex-col gap-3">
             <Button variant="ghost" onClick={handleNativeShare} className="w-full h-11 rounded-xl font-black uppercase text-[10px] gap-2 bg-white border shadow-sm hover:bg-muted">
                <Share2 className="w-4 h-4" /> Compartilhar Link
             </Button>
             <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full h-11 rounded-xl font-bold uppercase text-[10px] opacity-30">Fechar</Button>
          </div>
        </div>

        {/* Área de Preview */}
        <div className="flex-1 p-6 md:p-10 bg-[#e2e8f0] flex flex-col items-center justify-center relative overflow-hidden">
          {isGenerating && (
            <div className="absolute inset-0 z-[60] bg-primary/20 backdrop-blur-[2px] flex flex-col items-center justify-center">
               <div className="p-8 bg-white rounded-3xl shadow-2xl flex flex-col items-center gap-4">
                  <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Renderizando Arquivo...</p>
               </div>
            </div>
          )}

          {/* Renderizador Off-Screen (Técnico) */}
          <div style={{ position: 'absolute', left: '-9999px', top: 0, overflow: 'hidden' }}>
            <div ref={renderRef} style={{ width: 'fit-content', height: 'fit-content' }}>
               {renderFullArte(currentFormat, selectedTheme)}
            </div>
          </div>

          {/* Prévia Visual Proporcional */}
          <div className="scale-[0.25] md:scale-[0.28] lg:scale-[0.32] origin-center shadow-[0_60px_120px_rgba(0,0,0,0.4)] bg-white ring-[30px] ring-white shrink-0 rounded-sm">
             {renderFullArte('stories', selectedTheme)}
          </div>
          
          <div className="mt-12 flex flex-col items-center gap-4">
             <div className="flex items-center gap-3 px-6 py-2.5 bg-white/90 backdrop-blur-md rounded-full border shadow-xl">
                <Monitor className="w-4 h-4 text-secondary" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Prévia de Alta Resolução</p>
             </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
