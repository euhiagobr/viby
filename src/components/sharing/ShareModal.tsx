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
import { 
  Share2, 
  Download, 
  Printer, 
  Copy, 
  Loader2, 
  Check, 
  Smartphone, 
  FileText,
  Instagram,
  QrCode,
  Info,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { toPng } from 'html-to-image';
import { Separator } from '@/components/ui/separator';

const VIBY_LOGO_OFFICIAL = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FiconUrl_1780427863977?alt=media&token=1ab99264-b05c-4d1d-ab5a-0c27b7bfb77b";

interface ShareModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  data: {
    title: string;
    username: string;
    url: string;
    logoUrl?: string;
    type: 'organization' | 'event';
    organizationId: string;
    eventId?: string;
  };
}

type Format = 'A4' | 'A5' | 'A6' | 'instagram' | 'stories';

const FORMAT_CONFIGS: Record<Format, { width: number; height: number; label: string }> = {
  'A4': { width: 1240, height: 1754, label: 'Folha A4' },
  'A5': { width: 874, height: 1240, label: 'Folha A5' },
  'A6': { width: 620, height: 874, label: 'Folha A6' },
  'instagram': { width: 1080, height: 1080, label: 'Post Feed' },
  'stories': { width: 1080, height: 1920, label: 'Stories' }
};

export function ShareModal({ isOpen, onOpenChange, data }: ShareModalProps) {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isAssetsLoaded, setIsAssetsLoaded] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [orgLogoBase64, setOrgLogoBase64] = React.useState<string | null>(null);
  const [vibyLogoBase64, setVibyLogoBase64] = React.useState<string | null>(null);
  const [currentFormat, setCurrentFormat] = React.useState<Format>('A4');
  
  const renderRef = React.useRef<HTMLDivElement>(null);
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${data.url}?vsrc=qr`;

  React.useEffect(() => {
    if (!isOpen) return;

    const convertToBase64 = async (url: string, name: string): Promise<string | null> => {
      try {
        console.log(`[VIBY-LOGO-AUDIT] Iniciando fetch: ${name}`);
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error(`Falha no fetch: ${response.status}`);
        const blob = await response.blob();
        console.log(`[VIBY-LOGO-AUDIT] Asset carregado: ${name}`);
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            console.log(`[VIBY-LOGO-AUDIT] Asset convertido para Base64: ${name}`);
            resolve(reader.result as string);
          };
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error(`[VIBY-LOGO-AUDIT] Erro crítico no asset ${name}:`, e);
        return null;
      }
    };

    const loadAllAssets = async () => {
      setIsAssetsLoaded(false);
      const [vibyLogo, orgLogo] = await Promise.all([
        convertToBase64(VIBY_LOGO_OFFICIAL, 'VIBY-OFFICIAL'),
        data.logoUrl ? convertToBase64(data.logoUrl, 'ORG-LOGO') : Promise.resolve(null)
      ]);

      setVibyLogoBase64(vibyLogo);
      setOrgLogoBase64(orgLogo);
      setIsAssetsLoaded(true);
      console.log(`[VIBY-LOGO-AUDIT] Todos os recursos visuais prontos.`);
    };

    loadAllAssets();
  }, [isOpen, data.logoUrl]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({ title: "Link copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (format: Format) => {
    if (!renderRef.current) return;
    if (!isAssetsLoaded) {
      toast({ variant: "destructive", title: "Aguarde", description: "Carregando recursos visuais..." });
      return;
    }

    setCurrentFormat(format);
    setIsGenerating(true);
    
    // Aguarda um frame para o React aplicar o estado do template antes de capturar
    setTimeout(async () => {
      try {
        const config = FORMAT_CONFIGS[format];
        console.log(`[FORMAT-LOG] Template selecionado: ${format}`);
        console.log(`[FORMAT-LOG] Dimensões renderizadas: ${config.width}x${config.height}`);

        const node = renderRef.current;
        if (!node) return;

        const options = {
          cacheBust: true,
          backgroundColor: '#ffffff',
          width: config.width,
          height: config.height,
          pixelRatio: 1,
          style: {
            margin: '0',
            padding: '0',
            width: `${config.width}px`,
            height: `${config.height}px`,
          }
        };

        const dataUrl = await toPng(node, options);
        console.log(`[FORMAT-LOG] Dimensões exportadas: ${config.width}x${config.height}`);
        
        const link = document.createElement('a');
        link.download = `viby-${data.username}-${format}.png`;
        link.href = dataUrl;
        link.click();
        
        toast({ title: "Imagem gerada!", description: `Formato ${config.label} salvo com sucesso.` });
      } catch (err) {
        console.error("[VIBY-EXPORT-ERROR]", err);
        toast({ 
          variant: "destructive", 
          title: "Não foi possível gerar a imagem", 
          description: "Verifique os recursos visuais da organização e tente novamente." 
        });
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: data.title,
          text: `Confira a agenda de ${data.title} na Viby!`,
          url: shareUrl,
        });
      } catch (err) {}
    } else {
      handleCopyLink();
    }
  };

  const renderTemplate = (format: Format) => {
    const config = FORMAT_CONFIGS[format];
    const isVertical = format === 'stories' || format === 'A4' || format === 'A5' || format === 'A6';
    const isSquare = format === 'instagram';

    return (
      <div 
        style={{ 
          width: config.width, 
          height: config.height,
          backgroundColor: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: format === 'stories' ? '120px 80px' : '80px',
          fontFamily: 'sans-serif'
        }}
      >
        {/* TOP: LOGO E NOME */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px', width: '100%' }}>
          <div style={{ 
            width: format === 'stories' ? '280px' : '220px', 
            height: format === 'stories' ? '280px' : '220px', 
            borderRadius: '40px', 
            backgroundColor: '#f1f5f9', 
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '4px solid #f8fafc',
            boxShadow: '0 20px 50px rgba(0,0,0,0.08)'
          }}>
            {orgLogoBase64 ? (
              <img src={orgLogoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Org Logo" />
            ) : (
              <div style={{ color: '#cbd5e1' }}><Building2 size={80} /></div>
            )}
          </div>
          <h1 style={{ 
            fontSize: format === 'stories' ? '86px' : '72px', 
            fontWeight: 900, 
            textTransform: 'uppercase', 
            fontStyle: 'italic', 
            letterSpacing: '-0.05em',
            color: '#000000',
            textAlign: 'center',
            lineHeight: 1,
            margin: 0
          }}>
            {data.title}
          </h1>
        </div>

        {/* CENTER: QR CODE */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
          <p style={{ 
            fontSize: '28px', 
            fontWeight: 800, 
            textTransform: 'uppercase', 
            letterSpacing: '0.2em', 
            color: '#64748b',
            margin: 0
          }}>
            Escaneie para acessar
          </p>
          
          <div style={{ 
            padding: '40px', 
            backgroundColor: '#ffffff', 
            borderRadius: '60px', 
            boxShadow: '0 40px 100px rgba(0,0,0,0.1)',
            border: '2px solid #f1f5f9'
          }}>
            <QRCodeSVG value={shareUrl} size={format === 'stories' ? 550 : 450} level="H" />
          </div>

          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <p style={{ 
              fontSize: '32px', 
              fontWeight: 900, 
              color: '#2C52EE', 
              fontFamily: 'monospace',
              margin: 0
            }}>
              viby.club/{data.username}
            </p>
          </div>
        </div>

        {/* BOTTOM: POWERED BY */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
          <div style={{ height: '2px', width: '100px', backgroundColor: '#f1f5f9' }} />
          <p style={{ 
            fontSize: '22px', 
            fontWeight: 800, 
            textTransform: 'uppercase', 
            letterSpacing: '0.4em', 
            color: '#94a3b8',
            margin: 0
          }}>
            Powered by Viby.Club
          </p>
          {vibyLogoBase64 && (
            <img src={vibyLogoBase64} style={{ height: '50px', width: 'auto', filter: 'grayscale(1)', opacity: 0.5 }} alt="Viby" />
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden rounded-[2.5rem] bg-white border-none flex flex-col md:flex-row h-[95vh] md:h-auto">
        
        {/* PREVIEW CONTAINER */}
        <div className="flex-1 p-8 bg-muted/20 flex flex-col items-center justify-center border-r border-dashed relative">
          {!isAssetsLoaded && (
            <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
               <Loader2 className="w-8 h-8 animate-spin text-secondary" />
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando Ativos...</p>
            </div>
          )}

          {/* ÁREA DE RENDERIZAÇÃO REAL (HIDDEN) */}
          <div style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
            <div ref={renderRef}>
              {renderTemplate(currentFormat)}
            </div>
          </div>

          {/* PREVIEW VISUAL (SCALED) */}
          <div className="scale-[0.4] md:scale-[0.5] origin-center shadow-2xl">
             {renderTemplate('instagram')}
          </div>
          
          <div className="mt-8 flex items-center gap-2 text-muted-foreground">
             <Info className="w-4 h-4" />
             <p className="text-[10px] font-black uppercase tracking-widest">Prévia em Baixa Resolução</p>
          </div>
        </div>

        {/* CONTROLES */}
        <div className="w-full md:w-96 p-10 space-y-10 overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                  <Share2 className="w-5 h-5" />
               </div>
               <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Gerador de Artes</DialogTitle>
            </div>
            <DialogDescription className="font-medium text-xs">Crie materiais de divulgação profissional em segundos.</DialogDescription>
          </DialogHeader>

          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-3">
              <Button onClick={handleNativeShare} disabled={isGenerating} className="h-14 rounded-2xl font-black uppercase italic text-xs gap-3 bg-secondary text-white shadow-lg shadow-secondary/20 hover:scale-[1.02] transition-transform">
                <Share2 className="w-4.5 h-4.5" /> Compartilhar Link
              </Button>
            </div>

            <Separator className="border-dashed" />

            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Redes Sociais (PNG)</p>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="ghost" 
                  onClick={() => handleDownload('instagram')} 
                  disabled={isGenerating || !isAssetsLoaded} 
                  className="h-20 flex-col gap-2 rounded-2xl border bg-white hover:bg-muted/30 hover:shadow-md transition-all"
                >
                  <Instagram className="w-5 h-5 text-pink-500" />
                  <span className="text-[9px] font-black uppercase">Post Feed</span>
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => handleDownload('stories')} 
                  disabled={isGenerating || !isAssetsLoaded} 
                  className="h-20 flex-col gap-2 rounded-2xl border bg-white hover:bg-muted/30 hover:shadow-md transition-all"
                >
                  <Smartphone className="w-5 h-5 text-purple-500" />
                  <span className="text-[9px] font-black uppercase">Stories</span>
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Impressão (PDF/PNG)</p>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="ghost" onClick={() => handleDownload('A4')} disabled={isGenerating} className="h-14 flex-col text-[10px] font-black uppercase bg-muted/30 rounded-xl border">A4</Button>
                <Button variant="ghost" onClick={() => handleDownload('A5')} disabled={isGenerating} className="h-14 flex-col text-[10px] font-black uppercase bg-muted/30 rounded-xl border">A5</Button>
                <Button variant="ghost" onClick={() => handleDownload('A6')} disabled={isGenerating} className="h-14 flex-col text-[10px] font-black uppercase bg-muted/30 rounded-xl border">A6</Button>
              </div>
            </div>
          </div>

          {isGenerating && (
            <div className="p-4 bg-secondary/10 rounded-2xl border border-secondary/20 flex items-center gap-3 text-secondary animate-in zoom-in-95">
               <Loader2 className="w-5 h-5 animate-spin" />
               <p className="text-[10px] font-black uppercase">Processando Alta Definição...</p>
            </div>
          )}

          <div className="p-5 bg-orange-50 rounded-2xl border border-dashed border-orange-200 flex items-start gap-4">
            <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
               <p className="text-[9px] text-orange-800 font-black uppercase italic">Qualidade de Impressão</p>
               <p className="text-[9px] text-orange-700 font-medium leading-relaxed uppercase">
                 Os formatos A4 a A6 são gerados em alta densidade de pixels para garantir a leitura perfeita do QR Code em papel.
               </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

