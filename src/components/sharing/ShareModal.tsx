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
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${data.url}${data.url.includes('?') ? '&' : '?'}vsrc=qr`;

  // Função robusta para converter imagem remota em Base64 (ignora CORS se configurado no Storage)
  const convertToBase64 = React.useCallback(async (url: string, name: string): Promise<string | null> => {
    try {
      console.log(`[VIBY-LOGO-AUDIT] Loading asset: ${name}`);
      // Adiciona um timestamp para evitar cache agressivo que possa travar o CORS
      const separator = url.includes('?') ? '&' : '?';
      const proxyUrl = `${url}${separator}cb=${Date.now()}`;
      
      const response = await fetch(proxyUrl, { mode: 'cors' });
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
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;

    const loadAllAssets = async () => {
      setIsAssetsLoaded(false);
      
      // Carrega o logo da Viby e o da organização em paralelo
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
  }, [isOpen, data.logoUrl, convertToBase64]);

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
    
    // Delay para garantir que o DOM atualizou para o formato selecionado
    await new Promise(resolve => setTimeout(resolve, 500));

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
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
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
        title: "Erro ao gerar imagem.", 
        description: "Verifique os recursos visuais e tente novamente." 
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
          text: `Confira ${data.title} na Viby!`,
          url: shareUrl,
        });
      } catch (err) {}
    } else {
      handleCopyLink();
    }
  };

  // --- TEMPLATES INDEPENDENTES ---

  const renderFeedTemplate = () => {
    const config = FORMAT_CONFIGS['instagram'];
    return (
      <div id="capture-node-feed" style={{ 
        width: config.width, height: config.height, 
        backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', 
        alignItems: 'center', justifyContent: 'center', padding: '100px', fontFamily: 'sans-serif',
        position: 'relative'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px', width: '100%' }}>
          <div style={{ width: '220px', height: '220px', borderRadius: '50px', overflow: 'hidden', border: '8px solid #f1f5f9', boxShadow: '0 20px 40px rgba(0,0,0,0.05)' }}>
            {orgLogoBase64 ? <img src={orgLogoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{ width: '100%', height: '100%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '80px', fontWeight: 900, color: '#cbd5e1' }}>{data.title.charAt(0)}</div>}
          </div>
          <h1 style={{ fontSize: '72px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', textAlign: 'center', margin: 0, letterSpacing: '-0.03em', color: '#000000', lineHeight: 0.9 }}>{data.title}</h1>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.2em', margin: 0 }}>Escaneie para acessar</p>
          <div style={{ padding: '50px', backgroundColor: '#ffffff', borderRadius: '50px', border: '2px solid #f1f5f9', boxShadow: '0 40px 80px rgba(0,0,0,0.08)' }}>
            <QRCodeSVG value={shareUrl} size={420} level="H" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '32px', fontWeight: 900, color: '#2C52EE', margin: '0' }}>viby.club/{data.username}</p>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
          <p style={{ fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', margin: 0, letterSpacing: '0.1em' }}>Powered by Viby.Club</p>
          {vibyLogoBase64 && <img src={vibyLogoBase64} style={{ height: '45px' }} alt="" />}
        </div>
      </div>
    );
  };

  const renderStoriesTemplate = () => {
    const config = FORMAT_CONFIGS['stories'];
    return (
      <div id="capture-node-stories" style={{ 
        width: config.width, height: config.height, 
        backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', 
        alignItems: 'center', justifyContent: 'space-between', padding: '180px 80px', fontFamily: 'sans-serif' 
      }}>
        <div style={{ width: '100%', textAlign: 'center' }}>
          <h2 style={{ fontSize: '40px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.4em', marginBottom: '40px' }}>LINK OFICIAL</h2>
          <h1 style={{ fontSize: '120px', fontWeight: 900, textTransform: 'uppercase', fontStyle: 'italic', lineHeight: 0.85, letterSpacing: '-0.04em', color: '#000000' }}>{data.title}</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '60px' }}>
          <div style={{ width: '340px', height: '340px', borderRadius: '80px', overflow: 'hidden', border: '12px solid #f1f5f9', boxShadow: '0 40px 80px rgba(0,0,0,0.1)' }}>
             {orgLogoBase64 ? <img src={orgLogoBase64} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <div style={{ width: '100%', height: '100%', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '120px', fontWeight: 900, color: '#cbd5e1' }}>{data.title.charAt(0)}</div>}
          </div>
          <div style={{ padding: '70px', backgroundColor: '#ffffff', borderRadius: '70px', boxShadow: '0 60px 120px rgba(0,0,0,0.12)', border: '2px solid #f1f5f9' }}>
            <QRCodeSVG value={shareUrl} size={600} level="H" />
          </div>
          <div style={{ textAlign: 'center' }}>
             <p style={{ fontSize: '50px', fontWeight: 900, color: '#2C52EE' }}>viby.club/{data.username}</p>
             <p style={{ fontSize: '28px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.3em', marginTop: '20px' }}>Acesse a agenda agora</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px' }}>
          <p style={{ fontSize: '32px', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', margin: 0 }}>Powered by Viby.Club</p>
          {vibyLogoBase64 && <img src={vibyLogoBase64} style={{ height: '70px' }} alt="" />}
        </div>
      </div>
    );
  };

  const renderPrintTemplate = (format: Format) => {
    const config = FORMAT_CONFIGS[format];
    return (
      <div id={`capture-node-${format}`} style={{ 
        width: config.width, height: config.height, 
        backgroundColor: '#ffffff', display: 'flex', flexDirection: 'column', 
        alignItems: 'center', justifyContent: 'space-between', padding: '120px 80px', fontFamily: 'sans-serif' 
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '60px', width: '100%' }}>
           <div style={{ width: '280px', height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {orgLogoBase64 ? <img src={orgLogoBase64} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} alt="" /> : <div style={{ fontSize: '100px', fontWeight: 900 }}>{data.title.charAt(0)}</div>}
           </div>
           <h1 style={{ fontSize: '90px', fontWeight: 900, textTransform: 'uppercase', textAlign: 'center', fontStyle: 'italic', letterSpacing: '-0.02em', margin: 0, lineHeight: 0.9 }}>{data.title}</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
           <p style={{ fontSize: '38px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.4em' }}>ESCANEIE PARA ACESSAR</p>
           <div style={{ padding: '60px', border: '6px solid #000000', borderRadius: '40px' }}>
             <QRCodeSVG value={shareUrl} size={500} level="H" />
           </div>
           <p style={{ fontSize: '44px', fontWeight: 900, color: '#000000', fontFamily: 'monospace' }}>viby.club/{data.username}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
           <p style={{ fontSize: '30px', fontWeight: 800, textTransform: 'uppercase', color: '#94a3b8', margin: '0 0 20px 0' }}>Powered by Viby.Club</p>
           {vibyLogoBase64 && <img src={vibyLogoBase64} style={{ height: '65px' }} alt="" />}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden rounded-[2.5rem] bg-white border-none flex flex-col md:flex-row h-[90vh] md:h-auto print:hidden">
        
        {/* Lado Esquerdo: Preview */}
        <div className="flex-1 p-8 bg-muted/20 flex flex-col items-center justify-center border-r border-dashed relative overflow-hidden">
          {!isAssetsLoaded && (
            <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-center">
               <Loader2 className="w-10 h-10 animate-spin text-secondary" />
               <p className="text-[11px] font-black uppercase tracking-widest text-primary animate-pulse">Processando Marcas e Logos...</p>
            </div>
          )}

          {/* Nó de Renderização Invisível (Real Size para Captura) */}
          <div style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
            <div ref={renderRef}>
              {currentFormat === 'instagram' ? renderFeedTemplate() : 
               currentFormat === 'stories' ? renderStoriesTemplate() : 
               renderPrintTemplate(currentFormat)}
            </div>
          </div>

          {/* Prévia Visual (Escalonada para o Modal) */}
          <div className="scale-[0.25] md:scale-[0.35] lg:scale-[0.42] origin-center shadow-2xl transition-all duration-500 bg-white border">
             {currentFormat === 'instagram' ? renderFeedTemplate() : 
              currentFormat === 'stories' ? renderStoriesTemplate() : 
              renderPrintTemplate(currentFormat)}
          </div>
          
          <div className="mt-8 flex items-center gap-2 text-muted-foreground bg-white/80 px-4 py-2 rounded-full border shadow-sm">
             <Monitor className="w-4 h-4 text-secondary" />
             <p className="text-[9px] font-black uppercase tracking-widest">Prévia: {FORMAT_CONFIGS[currentFormat].label}</p>
          </div>
        </div>

        {/* Lado Direito: Ações */}
        <div className="w-full md:w-96 p-8 flex flex-col bg-white">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                  <Share2 className="w-5 h-5" />
               </div>
               <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Materiais de Divulgação</DialogTitle>
            </div>
            <DialogDescription className="font-bold text-xs uppercase opacity-60">Gere artes exclusivas para sua marca ou evento.</DialogDescription>
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

              <Separator className="border-dashed" />

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
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Impressão Profissional</p>
                   <Button variant="ghost" size="sm" onClick={handlePrint} className="h-6 text-[8px] font-black uppercase text-secondary">
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
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-orange-800">Alta Resolução</p>
                  <p className="text-[9px] text-orange-700 font-medium leading-relaxed uppercase italic">
                    As imagens são geradas em 4K. Use para materiais gráficos ou divulgação digital de alta qualidade.
                  </p>
                </div>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-2xl border border-dashed border-blue-200 flex items-start gap-3">
                 <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                 <p className="text-[9px] text-blue-800 font-bold uppercase leading-tight italic">
                    Dica: Incluímos o endereço legível <strong>viby.club/{data.username}</strong> em todas as artes para garantir o acesso.
                 </p>
              </div>
            </div>
          </ScrollArea>
          
          <div className="pt-4 border-t mt-auto flex flex-col gap-2">
             <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full h-10 rounded-xl font-bold uppercase text-[9px] opacity-40 hover:opacity-100">
                Fechar Painel
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
