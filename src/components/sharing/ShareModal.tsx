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
  Building2,
  AlertTriangle,
  ArrowRight,
  Monitor
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { toPng } from 'html-to-image';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

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
        console.log(`[VIBY-LOGO-AUDIT] Loading asset: ${name}`);
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error(`[VIBY-LOGO-AUDIT] Error loading ${name}:`, e);
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
      console.log(`[VIBY-LOGO-AUDIT] Assets ready for rendering.`);
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
    if (!renderRef.current || !isAssetsLoaded) return;

    setCurrentFormat(format);
    setIsGenerating(true);
    
    // Pequeno delay para garantir que o DOM atualizou para o formato selecionado antes do canvas capture
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const config = FORMAT_CONFIGS[format];
      const node = renderRef.current;
      if (!node) return;

      console.log(`[FORMAT-LOG] Exporting ${format} (${config.width}x${config.height})`);

      const dataUrl = await toPng(node, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        width: config.width,
        height: config.height,
        pixelRatio: 1,
      });

      const link = document.createElement('a');
      link.download = `viby-${data.username}-${format}.png`;
      link.href = dataUrl;
      link.click();
      
      toast({ title: "Imagem gerada!", description: `Formato ${config.label} salvo.` });
    } catch (err) {
      console.error("[VIBY-EXPORT-ERROR]", err);
      toast({ variant: "destructive", title: "Não foi possível gerar a imagem. Verifique os recursos visuais da organização e tente novamente." });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
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

  const renderFeedTemplate = () => {
    const config = FORMAT_CONFIGS['instagram'];
    return (
      <div style={{ 
        width: config.width, height: config.height, 
        backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', 
        alignItems: 'center', justifyContent: 'center', padding: '60px', fontFamily: 'sans-serif' 
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px', width: '100%' }}>
          <div style={{ width: '180px', height: '180px', borderRadius: '40px', overflow: 'hidden', border: '6px solid #f1f5f9', boxShadow: '0 20px 40px rgba(0,0,0,0.05)' }}>
            {orgLogoBase64 ? <img src={orgLogoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Logo" /> : <div style={{ width: '100%', height: '100%', backgroundColor: '#f1f5f9' }} />}
          </div>
          <h1 style={{ fontSize: '64px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', textAlign: 'center', margin: 0 }}>{data.title}</h1>
          <div style={{ padding: '40px', backgroundColor: '#ffffff', borderRadius: '40px', border: '1px solid #f1f5f9', boxShadow: '0 30px 60px rgba(0,0,0,0.08)' }}>
            <QRCodeSVG value={shareUrl} size={400} level="H" />
          </div>
          <p style={{ fontSize: '28px', fontWeight: 900, color: '#2C52EE', margin: '10px 0' }}>viby.club/{data.username}</p>
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <p style={{ fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', margin: 0 }}>Powered by Viby.Club</p>
          {vibyLogoBase64 && <img src={vibyLogoBase64} style={{ height: '40px', opacity: 0.5, filter: 'grayscale(1)' }} alt="Viby" />}
        </div>
      </div>
    );
  };

  const renderStoriesTemplate = () => {
    const config = FORMAT_CONFIGS['stories'];
    return (
      <div style={{ 
        width: config.width, height: config.height, 
        backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', 
        alignItems: 'center', justifyContent: 'space-between', padding: '150px 80px', fontFamily: 'sans-serif' 
      }}>
        <div style={{ width: '100%', textAlign: 'center' }}>
          <h2 style={{ fontSize: '40px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.1em', marginBottom: '40px' }}>Confira nossa agenda</h2>
          <h1 style={{ fontSize: '90px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', lineHeight: 0.9 }}>{data.title}</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
          <div style={{ width: '280px', height: '280px', borderRadius: '60px', overflow: 'hidden', border: '8px solid #f1f5f9', boxShadow: '0 30px 60px rgba(0,0,0,0.1)' }}>
             {orgLogoBase64 ? <img src={orgLogoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Logo" /> : <div style={{ width: '100%', height: '100%', backgroundColor: '#f1f5f9' }} />}
          </div>
          <div style={{ padding: '60px', backgroundColor: '#ffffff', borderRadius: '60px', boxShadow: '0 40px 80px rgba(0,0,0,0.12)' }}>
            <QRCodeSVG value={shareUrl} size={550} level="H" />
          </div>
          <p style={{ fontSize: '42px', fontWeight: 900, color: '#2C52EE', fontFamily: 'monospace' }}>viby.club/{data.username}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
          <p style={{ fontSize: '24px', fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1' }}>Powered by Viby.Club</p>
          {vibyLogoBase64 && <img src={vibyLogoBase64} style={{ height: '60px', opacity: 0.3, filter: 'grayscale(1)' }} alt="Viby" />}
        </div>
      </div>
    );
  };

  const renderPrintTemplate = (format: Format) => {
    const config = FORMAT_CONFIGS[format];
    return (
      <div style={{ 
        width: config.width, height: config.height, 
        backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', 
        alignItems: 'center', justifyContent: 'space-between', padding: '100px 60px', fontFamily: 'sans-serif' 
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px', width: '100%' }}>
           <div style={{ width: '200px', height: '200px', borderRadius: '40px', overflow: 'hidden', border: '2px solid #e2e8f0' }}>
              {orgLogoBase64 ? <img src={orgLogoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Logo" /> : <div style={{ width: '100%', height: '100%', backgroundColor: '#f8fafc' }} />}
           </div>
           <h1 style={{ fontSize: '72px', fontWeight: 900, textTransform: 'uppercase', textAlign: 'center' }}>{data.title}</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px' }}>
           <p style={{ fontSize: '32px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.2em' }}>Escaneie para acessar</p>
           <div style={{ padding: '40px', border: '1px solid #e2e8f0' }}>
             <QRCodeSVG value={shareUrl} size={450} level="H" />
           </div>
           <p style={{ fontSize: '36px', fontWeight: 900, color: '#000000', fontFamily: 'monospace' }}>viby.club/{data.username}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
           <p style={{ fontSize: '24px', fontWeight: 700, color: '#94a3b8', margin: '0 0 10px 0' }}>Powered by Viby.Club</p>
           {vibyLogoBase64 && <img src={vibyLogoBase64} style={{ height: '50px', filter: 'grayscale(1)', opacity: 0.5 }} alt="Viby" />}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden rounded-[2.5rem] bg-white border-none flex flex-col md:flex-row h-[90vh] md:h-auto print:hidden">
        
        {/* Preview Area */}
        <div className="flex-1 p-8 bg-muted/20 flex flex-col items-center justify-center border-r border-dashed relative overflow-hidden">
          {!isAssetsLoaded && (
            <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
               <Loader2 className="w-8 h-8 animate-spin text-secondary" />
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando Identidade...</p>
            </div>
          )}

          {/* Render Node (Hidden) */}
          <div style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
            <div ref={renderRef}>
              {currentFormat === 'instagram' ? renderFeedTemplate() : 
               currentFormat === 'stories' ? renderStoriesTemplate() : 
               renderPrintTemplate(currentFormat)}
            </div>
          </div>

          {/* Visual Preview */}
          <div className="scale-[0.3] md:scale-[0.4] lg:scale-[0.45] origin-center shadow-2xl transition-all duration-500 bg-white">
             {currentFormat === 'instagram' ? renderFeedTemplate() : 
              currentFormat === 'stories' ? renderStoriesTemplate() : 
              renderPrintTemplate(currentFormat)}
          </div>
          
          <div className="mt-8 flex items-center gap-2 text-muted-foreground">
             <Monitor className="w-4 h-4" />
             <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Visualização de arte: {FORMAT_CONFIGS[currentFormat].label}</p>
          </div>
        </div>

        {/* Actions Area */}
        <div className="w-full md:w-96 p-8 flex flex-col bg-white">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                  <Share2 className="w-5 h-5" />
               </div>
               <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Gerador de Artes</DialogTitle>
            </div>
            <DialogDescription className="font-medium text-xs">Selecione o formato para gerar sua divulgação.</DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-2 px-2">
            <div className="space-y-6 pb-4">
              
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={handleNativeShare} className="h-11 rounded-xl font-black uppercase italic text-[10px] gap-2 bg-secondary text-white shadow-lg">
                  <Share2 className="w-4 h-4" /> Compartilhar
                </Button>
                <Button variant="outline" onClick={handleCopyLink} className="h-11 rounded-xl font-black uppercase italic text-[10px] gap-2 border-secondary/20 text-secondary">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  Copiar Link
                </Button>
              </div>

              <Separator className="border-dashed" />

              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Redes Sociais (PNG)</p>
                <div className="grid grid-cols-1 gap-2">
                  <Button 
                    variant={currentFormat === 'instagram' ? 'secondary' : 'outline'} 
                    onClick={() => handleDownload('instagram')} 
                    disabled={isGenerating || !isAssetsLoaded} 
                    className="h-14 justify-start gap-4 rounded-xl border-dashed px-4"
                  >
                    <Instagram className="w-5 h-5 text-pink-500" />
                    <div className="text-left">
                       <p className="text-[10px] font-black uppercase">Post Feed Instagram</p>
                       <p className="text-[8px] opacity-60">1080 x 1080 px</p>
                    </div>
                  </Button>
                  <Button 
                    variant={currentFormat === 'stories' ? 'secondary' : 'outline'} 
                    onClick={() => handleDownload('stories')} 
                    disabled={isGenerating || !isAssetsLoaded} 
                    className="h-14 justify-start gap-4 rounded-xl border-dashed px-4"
                  >
                    <Smartphone className="w-5 h-5 text-purple-500" />
                    <div className="text-left">
                       <p className="text-[10px] font-black uppercase">Instagram Stories</p>
                       <p className="text-[8px] opacity-60">1080 x 1920 px</p>
                    </div>
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between ml-1">
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Impressão & PDF</p>
                   <Button variant="ghost" size="sm" onClick={handlePrint} className="h-6 text-[8px] font-black uppercase text-secondary">
                      <Printer className="w-3 h-3 mr-1" /> Imprimir
                   </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant={currentFormat === 'A4' ? 'secondary' : 'outline'} 
                    onClick={() => setCurrentFormat('A4')} 
                    className="h-12 flex-col text-[9px] font-black uppercase rounded-lg"
                  >
                    A4
                  </Button>
                  <Button 
                    variant={currentFormat === 'A5' ? 'secondary' : 'outline'} 
                    onClick={() => setCurrentFormat('A5')} 
                    className="h-12 flex-col text-[9px] font-black uppercase rounded-lg"
                  >
                    A5
                  </Button>
                  <Button 
                    variant={currentFormat === 'A6' ? 'secondary' : 'outline'} 
                    onClick={() => setCurrentFormat('A6')} 
                    className="h-12 flex-col text-[9px] font-black uppercase rounded-lg"
                  >
                    A6
                  </Button>
                </div>
                {currentFormat.startsWith('A') && (
                  <Button onClick={() => handleDownload(currentFormat)} disabled={isGenerating} className="w-full h-10 rounded-xl font-bold uppercase text-[9px] gap-2 bg-muted text-primary hover:bg-secondary hover:text-white transition-colors">
                     <Download className="w-3.5 h-3.5" /> Baixar PNG {currentFormat}
                  </Button>
                )}
              </div>

              <div className="p-4 bg-orange-50 rounded-2xl border border-dashed border-orange-200 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <p className="text-[9px] text-orange-800 font-bold uppercase leading-tight">
                   Utilize formatos A4-A6 para materiais impressos. A resolução é otimizada para scan.
                </p>
              </div>
            </div>
          </ScrollArea>
          
          <div className="pt-4 border-t mt-4 flex flex-col gap-2">
             <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full h-10 rounded-xl font-bold uppercase text-[9px] opacity-40 hover:opacity-100">
                Fechar
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
