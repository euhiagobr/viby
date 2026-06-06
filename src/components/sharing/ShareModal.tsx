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
  Camera,
  Info
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { toPng } from 'html-to-image';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${data.url}?vsrc=qr`;

  React.useEffect(() => {
    if (!isOpen) return;

    const convertToBase64 = async (url: string, name: string): Promise<string | null> => {
      try {
        console.log(`[VIBY-LOGO-AUDIT] Loading asset: ${name}`);
        // Forçar bypass de cache e garantir CORS via proxy ou headers limpos
        const response = await fetch(url, { 
          mode: 'cors',
          credentials: 'omit'
        });
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            console.log(`[VIBY-LOGO-AUDIT] ${name} converted to base64 successfully.`);
            resolve(result);
          };
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
      console.log(`[VIBY-LOGO-AUDIT] All assets ready for canvas rendering.`);
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
    await new Promise(resolve => setTimeout(resolve, 800));

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
        pixelRatio: 2,
      });

      const link = document.createElement('a');
      link.download = `viby-${data.username}-${format}.png`;
      link.href = dataUrl;
      link.click();
      
      toast({ title: "Arte gerada!", description: `Formato ${config.label} exportado.` });
    } catch (err) {
      console.error("[VIBY-EXPORT-ERROR] Canvas export failed:", err);
      toast({ 
        variant: "destructive", 
        title: "Não foi possível gerar a imagem.", 
        description: "Verifique os recursos visuais da organização e tente novamente." 
      });
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

  // --- TEMPLATES VISUAIS ---

  const renderFeedTemplate = () => {
    const config = FORMAT_CONFIGS['instagram'];
    return (
      <div style={{ 
        width: config.width, height: config.height, 
        backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', 
        alignItems: 'center', justifyContent: 'center', padding: '80px', fontFamily: 'sans-serif',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '50px', width: '100%' }}>
          <div style={{ width: '250px', height: '250px', borderRadius: '60px', overflow: 'hidden', border: '10px solid #f1f5f9', boxShadow: '0 30px 60px rgba(0,0,0,0.06)' }}>
            {orgLogoBase64 ? <img src={orgLogoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Org Logo" /> : <div style={{ width: '100%', height: '100%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '80px', fontWeight: 900, color: '#cbd5e1' }}>{data.title.charAt(0)}</div>}
          </div>
          <h1 style={{ fontSize: '80px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', textAlign: 'center', margin: 0, letterSpacing: '-0.03em', color: '#000000', lineHeight: 0.9 }}>{data.title}</h1>
          <div style={{ padding: '60px', backgroundColor: '#ffffff', borderRadius: '60px', border: '2px solid #f1f5f9', boxShadow: '0 40px 80px rgba(0,0,0,0.1)' }}>
            <QRCodeSVG value={shareUrl} size={480} level="H" />
          </div>
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <p style={{ fontSize: '38px', fontWeight: 900, color: '#2C52EE', margin: '0' }}>viby.club/{data.username}</p>
            <p style={{ fontSize: '24px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.2em', marginTop: '20px' }}>Escaneie para acessar</p>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <p style={{ fontSize: '20px', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', margin: 0, letterSpacing: '0.1em' }}>Powered by Viby.Club</p>
          {vibyLogoBase64 && <img src={vibyLogoBase64} style={{ height: '55px', opacity: 0.9 }} alt="Viby Logo" />}
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
        alignItems: 'center', justifyContent: 'space-between', padding: '200px 100px', fontFamily: 'sans-serif' 
      }}>
        <div style={{ width: '100%', textAlign: 'center' }}>
          <h2 style={{ fontSize: '48px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.3em', marginBottom: '60px' }}>AGENDA OFICIAL</h2>
          <h1 style={{ fontSize: '130px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', lineHeight: 0.8, letterSpacing: '-0.06em', color: '#000000' }}>{data.title}</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '60px' }}>
          <div style={{ width: '380px', height: '380px', borderRadius: '100px', overflow: 'hidden', border: '12px solid #f1f5f9', boxShadow: '0 50px 100px rgba(0,0,0,0.12)' }}>
             {orgLogoBase64 ? <img src={orgLogoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Org Logo" /> : <div style={{ width: '100%', height: '100%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '120px', fontWeight: 900, color: '#cbd5e1' }}>{data.title.charAt(0)}</div>}
          </div>
          <div style={{ padding: '80px', backgroundColor: '#ffffff', borderRadius: '80px', boxShadow: '0 60px 120px rgba(0,0,0,0.15)', border: '2px solid #f1f5f9' }}>
            <QRCodeSVG value={shareUrl} size={620} level="H" />
          </div>
          <div style={{ textAlign: 'center' }}>
             <p style={{ fontSize: '56px', fontWeight: 900, color: '#2C52EE', fontFamily: 'monospace' }}>viby.club/{data.username}</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px' }}>
          <p style={{ fontSize: '32px', fontWeight: 800, textTransform: 'uppercase', color: '#cbd5e1' }}>Powered by Viby.Club</p>
          {vibyLogoBase64 && <img src={vibyLogoBase64} style={{ height: '80px', opacity: 1 }} alt="Viby Logo" />}
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
        alignItems: 'center', justifyContent: 'space-between', padding: '140px 100px', fontFamily: 'sans-serif' 
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '80px', width: '100%' }}>
           <div style={{ width: '300px', height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {orgLogoBase64 ? <img src={orgLogoBase64} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} alt="Org Logo" /> : <div style={{ fontSize: '100px', fontWeight: 900 }}>{data.title.charAt(0)}</div>}
           </div>
           <h1 style={{ fontSize: '100px', fontWeight: 900, textTransform: 'uppercase', textAlign: 'center', fontStyle: 'italic', letterSpacing: '-0.03em', margin: 0, lineHeight: 0.9 }}>{data.title}</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '50px' }}>
           <p style={{ fontSize: '42px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.4em' }}>ESCANEIE PARA ACESSAR</p>
           <div style={{ padding: '70px', border: '5px solid #000000', borderRadius: '50px' }}>
             <QRCodeSVG value={shareUrl} size={550} level="H" />
           </div>
           <p style={{ fontSize: '48px', fontWeight: 900, color: '#000000', fontFamily: 'monospace' }}>viby.club/{data.username}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
           <p style={{ fontSize: '32px', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', margin: '0 0 20px 0' }}>Powered by Viby.Club</p>
           {vibyLogoBase64 && <img src={vibyLogoBase64} style={{ height: '75px', opacity: 1 }} alt="Viby Logo" />}
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
            <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-center">
               <Loader2 className="w-10 h-10 animate-spin text-secondary" />
               <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-widest text-primary animate-pulse">Refatorando Ativos Visuais...</p>
                  <p className="text-[9px] text-muted-foreground uppercase font-bold">Isso garante a qualidade final do seu PNG.</p>
               </div>
            </div>
          )}

          {/* Render Node (Hidden for Capture) */}
          <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', overflow: 'hidden' }}>
            <div ref={renderRef}>
              {currentFormat === 'instagram' ? renderFeedTemplate() : 
               currentFormat === 'stories' ? renderStoriesTemplate() : 
               renderPrintTemplate(currentFormat)}
            </div>
          </div>

          {/* Visual Preview */}
          <div className="scale-[0.22] md:scale-[0.32] lg:scale-[0.38] origin-center shadow-2xl transition-all duration-500 bg-white border">
             {currentFormat === 'instagram' ? renderFeedTemplate() : 
              currentFormat === 'stories' ? renderStoriesTemplate() : 
              renderPrintTemplate(currentFormat)}
          </div>
          
          <div className="mt-8 flex items-center gap-2 text-muted-foreground">
             <Monitor className="w-4 h-4" />
             <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Prévia do formato: {FORMAT_CONFIGS[currentFormat].label}</p>
          </div>
        </div>

        {/* Actions Area */}
        <div className="w-full md:w-96 p-8 flex flex-col bg-white">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                  <Share2 className="w-5 h-5" />
               </div>
               <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Divulgação de Marca</DialogTitle>
            </div>
            <DialogDescription className="font-bold text-xs uppercase opacity-60">Gere artes de alta resolução para impressão ou redes sociais.</DialogDescription>
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
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Redes Sociais (PNG 4K)</p>
                <div className="grid grid-cols-1 gap-2">
                  <Button 
                    variant={currentFormat === 'instagram' ? 'secondary' : 'outline'} 
                    onClick={() => handleDownload('instagram')} 
                    disabled={isGenerating || !isAssetsLoaded} 
                    className="h-14 justify-start gap-4 rounded-xl border-dashed px-4"
                  >
                    <Instagram className="w-5 h-5 text-pink-500" />
                    <div className="text-left">
                       <p className="text-[10px] font-black uppercase">Post para Feed</p>
                       <p className="text-[8px] font-bold opacity-60">1080 x 1080 px (1:1)</p>
                    </div>
                    {isGenerating && currentFormat === 'instagram' && <Loader2 className="ml-auto w-4 h-4 animate-spin text-secondary" />}
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
                       <p className="text-[8px] font-bold opacity-60">1080 x 1920 px (9:16)</p>
                    </div>
                    {isGenerating && currentFormat === 'stories' && <Loader2 className="ml-auto w-4 h-4 animate-spin text-secondary" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between ml-1">
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Materiais para Impressão</p>
                   <Button variant="ghost" size="sm" onClick={handlePrint} className="h-6 text-[8px] font-black uppercase text-secondary">
                      <Printer className="w-3 h-3 mr-1" /> Imprimir Direto
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
                  <Button onClick={() => handleDownload(currentFormat)} disabled={isGenerating || !isAssetsLoaded} className="w-full h-10 rounded-xl font-bold uppercase text-[9px] gap-2 bg-muted text-primary hover:bg-secondary hover:text-white transition-colors">
                     {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                     Baixar PNG {currentFormat}
                  </Button>
                )}
              </div>

              <div className="p-4 bg-orange-50 rounded-2xl border border-dashed border-orange-200 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <p className="text-[9px] text-orange-800 font-bold uppercase leading-tight italic">
                   Utilize o PNG gerado para gráficas ou divulgar em canais oficiais. O QR Code é gerado em nível H para máxima redundância.
                </p>
              </div>
            </div>
          </ScrollArea>
          
          <div className="pt-4 border-t mt-4 flex flex-col gap-2">
             <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full h-10 rounded-xl font-bold uppercase text-[9px] opacity-40 hover:opacity-100">
                Fechar painel
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
