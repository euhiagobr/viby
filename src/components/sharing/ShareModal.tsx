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
  Info,
  X,
  Globe
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { toPng } from 'html-to-image';
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
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${data.url}${data.url.includes('?') ? '&' : '?'}vsrc=qr`;

  const convertToDataUrl = React.useCallback((url: string, name: string): Promise<string | null> => {
    return new Promise((resolve) => {
      console.log(`[${name}] Iniciando carga do ativo...`);
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL("image/png");
          console.log(`[${name}] Carregado e convertido com sucesso (${img.width}x${img.height})`);
          resolve(dataURL);
        } else {
          console.error(`[${name}] Falha no contexto do canvas`);
          resolve(null);
        }
      };

      img.onerror = () => {
        console.error(`[${name}] Erro ao carregar imagem externa. Verifique CORS.`);
        resolve(null);
      };

      // Adiciona cache buster para forçar nova requisição com headers CORS se necessário
      const cb = url.includes('?') ? '&' : '?';
      img.src = `${url}${cb}v_cache=${Date.now()}`;
    });
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;

    const loadAssets = async () => {
      setIsAssetsLoaded(false);
      
      const [vibyBase64, orgBase64] = await Promise.all([
        convertToDataUrl(VIBY_LOGO_OFFICIAL, "VIBY-LOGO"),
        data.logoUrl ? convertToDataUrl(data.logoUrl, "ORG-LOGO") : Promise.resolve(null)
      ]);

      setVibyLogoBase64(vibyBase64);
      setOrgLogoBase64(orgBase64);
      setIsAssetsLoaded(true);
    };

    loadAssets();
  }, [isOpen, data.logoUrl, convertToDataUrl]);

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
    
    // Pequeno delay para troca de template no DOM invisível
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const config = FORMAT_CONFIGS[format];
      const node = renderRef.current;
      
      console.log(`[EXPORT] Gerando ${format} (${config.width}x${config.height})`);

      const dataUrl = await toPng(node, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        width: config.width,
        height: config.height,
        pixelRatio: 2,
        skipFonts: true, // Evita erro de leitura de regras CSS de domínios externos
      });

      const link = document.createElement('a');
      link.download = `viby-${data.username}-${format}.png`;
      link.href = dataUrl;
      link.click();
      
      toast({ title: "Arte exportada!", description: `Formato ${config.label} concluído.` });
    } catch (err) {
      console.error("[EXPORT-ERROR]", err);
      toast({ 
        variant: "destructive", 
        title: "Erro ao gerar imagem.", 
        description: "Não foi possível processar a arte. Verifique os recursos da organização." 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: data.title,
          text: `Confira ${data.title} na Viby!`,
          url: shareUrl,
        });
      } catch (err) {}
    } else {
      handleCopyLink();
    }
  };

  // --- COMPONENTES DE TEMPLATE (RENDERIZAÇÃO LIMPA PARA CANVAS) ---

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
        <img src={vibyLogoBase64} style={{ height: `${logoHeight}px`, objectFit: 'contain' }} alt="" />
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
      <DialogContent className="max-w-6xl p-0 overflow-hidden rounded-[2.5rem] bg-white border-none flex flex-col md:flex-row h-[90vh] md:h-auto">
        
        {/* Lado Esquerdo: Preview Interativo */}
        <div className="flex-1 p-10 bg-muted/20 flex flex-col items-center justify-center border-r border-dashed relative overflow-hidden">
          {!isAssetsLoaded && (
            <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-center">
               <Loader2 className="w-10 h-10 animate-spin text-secondary" />
               <p className="text-[11px] font-black uppercase tracking-widest text-primary animate-pulse">Sincronizando Identidade Visual...</p>
            </div>
          )}

          {/* Nó de Renderização Invisível para Captura */}
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

          {/* Prévia Visual Escalonada */}
          <div className="scale-[0.25] md:scale-[0.35] lg:scale-[0.4] origin-center shadow-2xl bg-white border">
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
          
          <div className="mt-8 flex items-center gap-2 text-muted-foreground bg-white/80 px-4 py-2 rounded-full border shadow-sm">
             <Monitor className="w-4 h-4 text-secondary" />
             <p className="text-[9px] font-black uppercase tracking-widest">Formato: {FORMAT_CONFIGS[currentFormat].label}</p>
          </div>
        </div>

        {/* Lado Direito: Ações */}
        <div className="w-full md:w-96 p-8 flex flex-col bg-white">
          <DialogHeader className="mb-8">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                  <Share2 className="w-5 h-5" />
               </div>
               <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Divulgação Ativa</DialogTitle>
            </div>
            <DialogDescription className="font-bold text-xs uppercase opacity-60">Gere artes de alta resolução.</DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 -mx-2 px-2">
            <div className="space-y-6 pb-6">
              
              <div className="grid grid-cols-1 gap-2">
                <Button onClick={handleNativeShare} className="h-14 rounded-2xl font-black uppercase italic text-sm gap-2 bg-secondary text-white shadow-lg transition-transform active:scale-95">
                  <Share2 className="w-5 h-5" /> Compartilhar Link
                </Button>
                <Button variant="outline" onClick={handleCopyLink} className="h-12 rounded-2xl font-bold uppercase text-xs gap-2 border-secondary/20 text-secondary">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copiado!" : "Copiar Endereço"}
                </Button>
              </div>

              <div className="h-px bg-border border-dashed border-b my-4" />

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Redes Sociais (PNG 4K)</p>
                <div className="grid grid-cols-1 gap-3">
                  <Button 
                    variant={currentFormat === 'instagram' ? 'secondary' : 'outline'} 
                    onClick={() => handleDownload('instagram')} 
                    disabled={isGenerating || !isAssetsLoaded} 
                    className="h-16 justify-start gap-4 rounded-[1.2rem] border-2 border-dashed px-4 transition-all"
                  >
                    <Instagram className="w-6 h-6 text-pink-500" />
                    <div className="text-left flex-1">
                       <p className="text-xs font-black uppercase">Post para Feed</p>
                       <p className="text-[9px] font-bold opacity-60">Quadrado (1:1)</p>
                    </div>
                    {isGenerating && currentFormat === 'instagram' ? <Loader2 className="w-4 h-4 animate-spin text-secondary" /> : <Download className="w-4 h-4 opacity-20" />}
                  </Button>
                  <Button 
                    variant={currentFormat === 'stories' ? 'secondary' : 'outline'} 
                    onClick={() => handleDownload('stories')} 
                    disabled={isGenerating || !isAssetsLoaded} 
                    className="h-16 justify-start gap-4 rounded-[1.2rem] border-2 border-dashed px-4 transition-all"
                  >
                    <Smartphone className="w-6 h-6 text-purple-500" />
                    <div className="text-left flex-1">
                       <p className="text-xs font-black uppercase">Stories</p>
                       <p className="text-[9px] font-bold opacity-60">Vertical (9:16)</p>
                    </div>
                    {isGenerating && currentFormat === 'stories' ? <Loader2 className="w-4 h-4 animate-spin text-secondary" /> : <Download className="w-4 h-4 opacity-20" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Impressão</p>
                   <Button variant="ghost" size="sm" onClick={() => window.print()} className="h-6 text-[8px] font-black uppercase text-secondary">
                      <Printer className="w-3 h-3 mr-1" /> Imprimir
                   </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['A4', 'A5', 'A6'] as Format[]).map(f => (
                    <Button 
                      key={f}
                      variant={currentFormat === f ? 'secondary' : 'outline'} 
                      onClick={() => handleDownload(f)} 
                      disabled={isGenerating || !isAssetsLoaded}
                      className="h-14 flex-col text-[10px] font-black uppercase rounded-xl border-dashed"
                    >
                      {isGenerating && currentFormat === f ? <Loader2 className="w-4 h-4 animate-spin" /> : f}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-orange-50 rounded-2xl border border-dashed border-orange-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <p className="text-[9px] text-orange-700 font-bold uppercase leading-tight italic">
                  Utilize as versões em PNG para divulgação digital e os formatos A4/5/6 para materiais impressos de portaria.
                </p>
              </div>
            </div>
          </ScrollArea>
          
          <div className="pt-4 border-t mt-auto">
             <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full h-10 rounded-xl font-bold uppercase text-[9px] opacity-40 hover:opacity-100">
                Fechar Painel
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
