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
  Instagram,
  AlertTriangle,
  Monitor,
  Info,
  X,
  RefreshCw
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { toPng } from 'html-to-image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${data.url}${data.url.includes('?') ? '&' : '?'}vsrc=qr`;

  const loadAssets = React.useCallback(async () => {
    setIsAssetsLoaded(false);
    try {
      const promises: Promise<any>[] = [
        fetchImageAsBase64(VIBY_LOGO_OFFICIAL)
      ];

      if (data.logoUrl && !data.logoUrl.includes('profile.jpeg') && !data.logoUrl.includes('organizacao.jpeg')) {
        promises.push(fetchImageAsBase64(data.logoUrl));
      }

      const [vibyRes, orgRes] = await Promise.all(promises);

      if (vibyRes.success) setVibyLogoBase64(vibyRes.data!);
      if (orgRes && orgRes.success) setOrgLogoBase64(orgRes.data!);

      setIsAssetsLoaded(true);
    } catch (e) {
      setIsAssetsLoaded(true); 
    }
  }, [data.logoUrl]);

  React.useEffect(() => {
    if (isOpen) {
      loadAssets();
    } else {
      setOrgLogoBase64(null);
      setVibyLogoBase64(null);
      setIsAssetsLoaded(false);
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
          url: shareUrl,
        });
      } catch (err) {
        // user cancel
      }
    } else {
      handleCopyLink();
    }
  };

  const handleDownload = async (format: Format) => {
    if (!renderRef.current || !isAssetsLoaded) return;

    setCurrentFormat(format);
    setIsGenerating(true);
    
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const config = FORMAT_CONFIGS[format];
      const node = renderRef.current;

      const dataUrl = await toPng(node, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        width: config.width,
        height: config.height,
        pixelRatio: 2,
        skipFonts: true,
      });

      const link = document.createElement('a');
      link.download = `viby-${data.username}-${format}.png`;
      link.href = dataUrl;
      link.click();
      
      toast({ title: "Arte gerada!", description: `Formato ${config.label} baixado.` });
    } catch (err) {
      toast({ 
        variant: "destructive", 
        title: "Erro na geração.", 
        description: "Verifique os ativos da marca e tente novamente." 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // --- RENDER HELPERS ---
  const renderLogoSection = (size: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px' }}>
      <div style={{ 
        width: `${size}px`, 
        height: `${size}px`, 
        borderRadius: '50%', 
        overflow: 'hidden', 
        backgroundColor: '#f1f5f9',
        border: '4px solid #ffffff',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {orgLogoBase64 ? (
          <img src={orgLogoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
        ) : (
          <div style={{ fontSize: `${size/2.5}px`, fontWeight: 900, color: '#2C52EE', textTransform: 'uppercase' }}>
            {data.title.charAt(0)}
          </div>
        )}
      </div>
      <h1 style={{ 
        fontSize: `${size/3}px`, 
        fontWeight: 900, 
        textTransform: 'uppercase', 
        fontStyle: 'italic', 
        textAlign: 'center', 
        margin: 0, 
        letterSpacing: '-0.04em', 
        color: '#000000',
        lineHeight: 0.9 
      }}>
        {data.title}
      </h1>
    </div>
  );

  const renderFooter = (logoHeight: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
      <p style={{ fontSize: `${logoHeight/2.5}px`, fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', margin: 0, letterSpacing: '0.15em' }}>
        Powered by Viby.Club
      </p>
      {vibyLogoBase64 && (
        <img src={vibyLogoBase64} style={{ height: `${logoHeight}px`, objectFit: 'contain' }} alt="Viby" />
      )}
    </div>
  );

  const renderQRSection = (qrSize: number, fontSize: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
      <p style={{ fontSize: `${fontSize/1.5}px`, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0 }}>
        Escaneie para acessar
      </p>
      <div style={{ padding: '30px', backgroundColor: '#ffffff', borderRadius: '40px', border: '1px solid #f1f5f9', boxShadow: '0 20px 50px rgba(0,0,0,0.05)' }}>
        <QRCodeSVG value={shareUrl} size={qrSize} level="H" />
      </div>
      <p style={{ fontSize: `${fontSize}px`, fontWeight: 900, color: '#2C52EE', margin: 0, fontFamily: 'monospace' }}>
        viby.club/{data.username}
      </p>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden rounded-[2.5rem] bg-white border-none flex flex-col md:flex-row h-[90vh] md:max-h-[85vh]">
        
        {/* PREVIEW PANEL (LEFT) */}
        <div className="flex-1 p-6 md:p-10 bg-muted/20 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-dashed relative overflow-hidden">
          {!isAssetsLoaded && (
            <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-center p-6">
               <Loader2 className="w-10 h-10 animate-spin text-secondary" />
               <p className="text-[11px] font-black uppercase tracking-widest text-primary animate-pulse">Preparando Materiais de Divulgação...</p>
            </div>
          )}

          {/* HIDDEN CAPTURE NODE */}
          <div style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
            <div ref={renderRef} style={{ 
              width: FORMAT_CONFIGS[currentFormat].width, 
              height: FORMAT_CONFIGS[currentFormat].height,
              backgroundColor: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: currentFormat === 'stories' ? '200px 80px' : '100px',
              fontFamily: 'sans-serif'
            }}>
              {currentFormat === 'instagram' && (
                <>
                  {renderLogoSection(200)}
                  {renderQRSection(400, 32)}
                  {renderFooter(50)}
                </>
              )}
              {currentFormat === 'stories' && (
                <>
                  {renderLogoSection(320)}
                  {renderQRSection(550, 48)}
                  {renderFooter(70)}
                </>
              )}
              {(currentFormat === 'A4' || currentFormat === 'A5' || currentFormat === 'A6') && (
                <>
                  {renderLogoSection(250)}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
                    <p style={{ fontSize: '40px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.4em' }}>AGENDA OFICIAL</p>
                    <div style={{ padding: '60px', border: '8px solid #000000', borderRadius: '50px' }}>
                      <QRCodeSVG value={shareUrl} size={500} level="H" />
                    </div>
                    <p style={{ fontSize: '50px', fontWeight: 900, color: '#000000', fontFamily: 'monospace' }}>viby.club/{data.username}</p>
                  </div>
                  {renderFooter(60)}
                </>
              )}
            </div>
          </div>

          {/* VISUAL PREVIEW SCALED */}
          <div className="scale-[0.22] md:scale-[0.3] lg:scale-[0.35] origin-center shadow-2xl bg-white border ring-8 ring-white shrink-0">
             {currentFormat === 'instagram' ? (
                <div style={{ width: 1080, height: 1080, backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '100px', fontFamily: 'sans-serif' }}>
                  {renderLogoSection(200)}
                  {renderQRSection(400, 32)}
                  {renderFooter(50)}
                </div>
             ) : currentFormat === 'stories' ? (
                <div style={{ width: 1080, height: 1920, backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '200px 80px', fontFamily: 'sans-serif' }}>
                  {renderLogoSection(320)}
                  {renderQRSection(550, 48)}
                  {renderFooter(70)}
                </div>
             ) : (
                <div style={{ width: 1240, height: 1754, backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '120px 80px', fontFamily: 'sans-serif' }}>
                  {renderLogoSection(250)}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
                    <p style={{ fontSize: '40px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.4em' }}>AGENDA OFICIAL</p>
                    <div style={{ padding: '60px', border: '8px solid #000000', borderRadius: '50px' }}>
                      <QRCodeSVG value={shareUrl} size={500} level="H" />
                    </div>
                    <p style={{ fontSize: '50px', fontWeight: 900, color: '#000000', fontFamily: 'monospace' }}>viby.club/{data.username}</p>
                  </div>
                  {renderFooter(60)}
                </div>
             )}
          </div>
          
          <div className="mt-6 flex items-center gap-2 text-muted-foreground bg-white/80 px-4 py-2 rounded-full border shadow-sm shrink-0">
             <Monitor className="w-4 h-4 text-secondary" />
             <p className="text-[9px] font-black uppercase tracking-widest">Prévia: {FORMAT_CONFIGS[currentFormat].label}</p>
          </div>
        </div>

        {/* ACTIONS PANEL (RIGHT) */}
        <div className="w-full md:w-96 flex flex-col bg-white overflow-hidden">
          {/* Header Fixo */}
          <div className="p-8 pb-4 shrink-0">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                 <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                    <Share2 className="w-5 h-5" />
                 </div>
                 <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Gerar Artes</DialogTitle>
              </div>
              <DialogDescription className="font-bold text-xs uppercase opacity-60">Escolha o formato e baixe a imagem.</DialogDescription>
            </DialogHeader>
          </div>

          {/* Área de Rolagem Central */}
          <ScrollArea className="flex-1">
            <div className="p-8 pt-0 space-y-6">
              
              <div className="grid grid-cols-1 gap-2">
                <Button onClick={handleNativeShare} className="h-14 rounded-2xl font-black uppercase italic text-sm gap-2 bg-secondary text-white shadow-xl shadow-secondary/10">
                  <Share2 className="w-5 h-5" /> Compartilhar Link
                </Button>
                <Button variant="outline" onClick={handleCopyLink} className="h-12 rounded-2xl font-bold uppercase text-xs gap-2 border-secondary/20 text-secondary">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Link Copiado" : "Copiar Link Público"}
                </Button>
              </div>

              <Separator className="border-dashed" />

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Redes Sociais</p>
                <div className="grid grid-cols-1 gap-3">
                  <Button 
                    variant={currentFormat === 'instagram' ? 'secondary' : 'outline'} 
                    onClick={() => handleDownload('instagram')} 
                    disabled={isGenerating || !isAssetsLoaded} 
                    className={cn(
                      "h-16 justify-start gap-4 rounded-2xl border-2 border-dashed px-4 transition-all",
                      currentFormat === 'instagram' && "border-secondary bg-secondary/5"
                    )}
                  >
                    <Instagram className="w-6 h-6 text-pink-500" />
                    <div className="text-left flex-1">
                       <p className="text-xs font-black uppercase">Post para Feed</p>
                       <p className="text-[9px] font-bold opacity-60">1080x1080 (1:1)</p>
                    </div>
                    {isGenerating && currentFormat === 'instagram' ? <Loader2 className="w-4 h-4 animate-spin text-secondary" /> : <Download className="w-4 h-4 opacity-20" />}
                  </Button>

                  <Button 
                    variant={currentFormat === 'stories' ? 'secondary' : 'outline'} 
                    onClick={() => handleDownload('stories')} 
                    disabled={isGenerating || !isAssetsLoaded} 
                    className={cn(
                      "h-16 justify-start gap-4 rounded-2xl border-2 border-dashed px-4 transition-all",
                      currentFormat === 'stories' && "border-secondary bg-secondary/5"
                    )}
                  >
                    <Smartphone className="w-6 h-6 text-purple-500" />
                    <div className="text-left flex-1">
                       <p className="text-xs font-black uppercase">Post para Stories</p>
                       <p className="text-[9px] font-bold opacity-60">1080x1920 (9:16)</p>
                    </div>
                    {isGenerating && currentFormat === 'stories' ? <Loader2 className="w-4 h-4 animate-spin text-secondary" /> : <Download className="w-4 h-4 opacity-20" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Impressão Física</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['A4', 'A5', 'A6'] as Format[]).map(f => (
                    <Button 
                      key={f}
                      variant={currentFormat === f ? 'secondary' : 'outline'} 
                      onClick={() => handleDownload(f)} 
                      disabled={isGenerating || !isAssetsLoaded}
                      className={cn(
                        "h-14 flex-col text-[10px] font-black uppercase rounded-xl border-dashed",
                        currentFormat === f && "border-secondary bg-secondary/5"
                      )}
                    >
                      {isGenerating && currentFormat === f ? <Loader2 className="w-4 h-4 animate-spin" /> : f}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-orange-50 rounded-2xl border border-dashed border-orange-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                   <p className="text-[9px] text-orange-800 font-black uppercase italic">Dica Profissional</p>
                   <p className="text-[9px] text-orange-700 font-medium leading-tight uppercase">
                     Artes de alta resolução garantem leitura do QR Code mesmo em ambientes com pouca luz.
                   </p>
                </div>
              </div>
            </div>
          </ScrollArea>
          
          {/* Footer Fixo */}
          <div className="p-8 border-t bg-muted/10 shrink-0 flex flex-col gap-3">
             <Button variant="ghost" onClick={() => window.print()} className="w-full h-10 rounded-xl font-black uppercase text-[9px] gap-2 text-primary border border-border bg-white shadow-sm">
                <Printer className="w-3.5 h-3.5" /> Imprimir Documento
             </Button>
             <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full h-10 rounded-xl font-bold uppercase text-[10px] opacity-40 hover:opacity-100">
                Fechar Janela
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}