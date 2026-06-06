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
  AlertTriangle
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
        console.log(`[VIBY-LOGO-AUDIT] Iniciando fetch: ${name}`);
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error(`Falha no fetch: ${response.status}`);
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error(`[VIBY-LOGO-AUDIT] Erro ao carregar ${name}:`, e);
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
    
    setTimeout(async () => {
      try {
        const config = FORMAT_CONFIGS[format];
        const node = renderRef.current;
        if (!node) return;

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
        toast({ variant: "destructive", title: "Erro ao gerar imagem" });
      } finally {
        setIsGenerating(false);
      }
    }, 200);
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

  const renderTemplate = (format: Format) => {
    const config = FORMAT_CONFIGS[format];
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
          padding: format === 'stories' ? '140px 100px' : '80px',
          fontFamily: 'sans-serif'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px', width: '100%' }}>
          <div style={{ 
            width: format === 'stories' ? '300px' : '220px', 
            height: format === 'stories' ? '300px' : '220px', 
            borderRadius: '50px', 
            backgroundColor: '#f1f5f9', 
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '8px solid #f8fafc',
            boxShadow: '0 30px 60px rgba(0,0,0,0.08)'
          }}>
            {orgLogoBase64 ? (
              <img src={orgLogoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Logo" />
            ) : (
              <div style={{ color: '#cbd5e1' }}><Building2 size={100} /></div>
            )}
          </div>
          <h1 style={{ 
            fontSize: format === 'stories' ? '92px' : '72px', 
            fontWeight: 900, 
            textTransform: 'uppercase', 
            fontStyle: 'italic', 
            letterSpacing: '-0.04em',
            color: '#000000',
            textAlign: 'center',
            lineHeight: 0.9,
            margin: 0
          }}>
            {data.title}
          </h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
          <p style={{ 
            fontSize: '28px', 
            fontWeight: 800, 
            textTransform: 'uppercase', 
            letterSpacing: '0.25em', 
            color: '#64748b',
            margin: 0
          }}>
            Escaneie para acessar
          </p>
          
          <div style={{ 
            padding: '50px', 
            backgroundColor: '#ffffff', 
            borderRadius: '60px', 
            boxShadow: '0 50px 100px rgba(0,0,0,0.1)',
            border: '1px solid #f1f5f9'
          }}>
            <QRCodeSVG value={shareUrl} size={format === 'stories' ? 580 : 480} level="H" />
          </div>

          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <p style={{ 
              fontSize: '36px', 
              fontWeight: 900, 
              color: '#2C52EE', 
              fontFamily: 'monospace',
              margin: 0,
              letterSpacing: '-0.02em'
            }}>
              viby.club/{data.username}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
          <div style={{ height: '3px', width: '120px', backgroundColor: '#f1f5f9', borderRadius: '10px' }} />
          <p style={{ 
            fontSize: '24px', 
            fontWeight: 800, 
            textTransform: 'uppercase', 
            letterSpacing: '0.4em', 
            color: '#94a3b8',
            margin: 0
          }}>
            Powered by Viby.Club
          </p>
          {vibyLogoBase64 && (
            <img src={vibyLogoBase64} style={{ height: '60px', width: 'auto', filter: 'grayscale(1)', opacity: 0.6 }} alt="Viby" />
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden rounded-[2.5rem] bg-white border-none flex flex-col md:flex-row h-[90vh] md:h-auto print:hidden">
        
        {/* Lado Esquerdo: Preview */}
        <div className="flex-1 p-8 bg-muted/20 flex flex-col items-center justify-center border-r border-dashed relative overflow-hidden">
          {!isAssetsLoaded && (
            <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
               <Loader2 className="w-8 h-8 animate-spin text-secondary" />
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando Identidade...</p>
            </div>
          )}

          {/* Área Oculta para Renderização de Alta Qualidade */}
          <div style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
            <div ref={renderRef}>
              {renderTemplate(currentFormat)}
            </div>
          </div>

          {/* Preview Visual Dinâmico */}
          <div className="scale-[0.35] md:scale-[0.45] lg:scale-[0.5] origin-center shadow-2xl transition-transform duration-500">
             {renderTemplate(currentFormat)}
          </div>
          
          <div className="mt-8 flex items-center gap-2 text-muted-foreground">
             <Info className="w-4 h-4" />
             <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Prévia do formato {FORMAT_CONFIGS[currentFormat].label}</p>
          </div>
        </div>

        {/* Lado Direito: Ações */}
        <div className="w-full md:w-96 p-10 flex flex-col">
          <DialogHeader className="mb-8">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                  <Share2 className="w-5 h-5" />
               </div>
               <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Divulgar Marca</DialogTitle>
            </div>
            <DialogDescription className="font-medium text-xs">Selecione o formato ideal para sua divulgação.</DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-2 px-2">
            <div className="space-y-8 pb-4">
              
              {/* Ações Rápidas */}
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={handleNativeShare} className="h-12 rounded-xl font-black uppercase italic text-[10px] gap-2 bg-secondary text-white shadow-lg">
                  <Share2 className="w-4 h-4" /> Compartilhar
                </Button>
                <Button variant="outline" onClick={handleCopyLink} className="h-12 rounded-xl font-black uppercase italic text-[10px] gap-2 border-secondary/20 text-secondary">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  Copiar Link
                </Button>
              </div>

              <Separator className="border-dashed" />

              {/* Formatos Sociais */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Redes Sociais (PNG)</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant={currentFormat === 'instagram' ? 'secondary' : 'outline'} 
                    onClick={() => handleDownload('instagram')} 
                    disabled={isGenerating || !isAssetsLoaded} 
                    className="h-20 flex-col gap-2 rounded-2xl border bg-white hover:bg-muted/30 transition-all"
                  >
                    <Instagram className="w-5 h-5 text-pink-500" />
                    <span className="text-[9px] font-black uppercase">Post Feed</span>
                  </Button>
                  <Button 
                    variant={currentFormat === 'stories' ? 'secondary' : 'outline'} 
                    onClick={() => handleDownload('stories')} 
                    disabled={isGenerating || !isAssetsLoaded} 
                    className="h-20 flex-col gap-2 rounded-2xl border bg-white hover:bg-muted/30 transition-all"
                  >
                    <Smartphone className="w-5 h-5 text-purple-500" />
                    <span className="text-[9px] font-black uppercase">Stories</span>
                  </Button>
                </div>
              </div>

              {/* Formatos de Impressão */}
              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Materiais Físicos</p>
                   <Button variant="ghost" size="sm" onClick={handlePrint} className="h-6 text-[8px] font-black uppercase text-secondary">
                      <Printer className="w-3 h-3 mr-1" /> Imprimir
                   </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button 
                    variant={currentFormat === 'A4' ? 'secondary' : 'outline'} 
                    onClick={() => setCurrentFormat('A4')} 
                    className="h-14 flex-col text-[10px] font-black uppercase rounded-xl border-dashed"
                  >
                    A4
                  </Button>
                  <Button 
                    variant={currentFormat === 'A5' ? 'secondary' : 'outline'} 
                    onClick={() => setCurrentFormat('A5')} 
                    className="h-14 flex-col text-[10px] font-black uppercase rounded-xl border-dashed"
                  >
                    A5
                  </Button>
                  <Button 
                    variant={currentFormat === 'A6' ? 'secondary' : 'outline'} 
                    onClick={() => setCurrentFormat('A6')} 
                    className="h-14 flex-col text-[10px] font-black uppercase rounded-xl border-dashed"
                  >
                    A6
                  </Button>
                </div>
                {currentFormat.startsWith('A') && (
                  <Button onClick={() => handleDownload(currentFormat)} disabled={isGenerating} className="w-full h-10 rounded-xl font-bold uppercase text-[9px] gap-2">
                     <Download className="w-3 h-3" /> Baixar PNG {currentFormat}
                  </Button>
                )}
              </div>

              <div className="p-5 bg-orange-50 rounded-2xl border border-dashed border-orange-200 flex items-start gap-4">
                <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <p className="text-[9px] text-orange-800 font-bold uppercase leading-relaxed">
                  Para impressão, utilize os formatos A4-A6. Eles possuem margens de segurança e alta resolução para leitura do QR Code.
                </p>
              </div>
            </div>
          </ScrollArea>
          
          <div className="pt-6 mt-auto">
             <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full h-12 rounded-xl font-black uppercase text-[10px] opacity-40 hover:opacity-100">
                Fechar
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
