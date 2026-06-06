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
  AlertTriangle
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
  
  const printRef = React.useRef<HTMLDivElement>(null);
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${data.url}?vsrc=qr`;

  // Pré-carregamento de imagens para Base64 para evitar erros de CORS na geração do canvas
  React.useEffect(() => {
    if (!isOpen) return;

    const convertToBase64 = async (url: string): Promise<string | null> => {
      try {
        console.log(`[ShareModal] Carregando asset: ${url}`);
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error('Falha no fetch do asset');
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error(`[ShareModal] Erro ao converter imagem para base64:`, e);
        return null;
      }
    };

    const loadAllAssets = async () => {
      setIsAssetsLoaded(false);
      const [vibyLogo, orgLogo] = await Promise.all([
        convertToBase64(VIBY_LOGO_OFFICIAL),
        data.logoUrl ? convertToBase64(data.logoUrl) : Promise.resolve(null)
      ]);

      setVibyLogoBase64(vibyLogo);
      setOrgLogoBase64(orgLogo);
      setIsAssetsLoaded(true);
      console.log(`[ShareModal] Assets carregados com sucesso.`);
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
    if (!printRef.current) return;
    if (!isAssetsLoaded) {
      toast({ variant: "destructive", title: "Aguarde", description: "Carregando recursos visuais..." });
      return;
    }

    setIsGenerating(true);
    console.log(`[ShareModal] Iniciando exportação para formato: ${format}`);
    
    try {
      const config = FORMAT_CONFIGS[format];
      const node = printRef.current;

      // Opções otimizadas para html-to-image
      const options = {
        cacheBust: true,
        backgroundColor: '#ffffff',
        width: config.width,
        height: config.height,
        pixelRatio: 1, // Já definimos largura/altura exatas
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          margin: '0',
          padding: '0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${config.width}px`,
          height: `${config.height}px`,
        }
      };

      const dataUrl = await toPng(node, options);
      
      const link = document.createElement('a');
      link.download = `viby-share-${data.username}-${format}.png`;
      link.href = dataUrl;
      link.click();
      
      toast({ title: "Imagem gerada!", description: `Formato ${config.label} salvo com sucesso.` });
      console.log(`[ShareModal] Exportação PNG concluída.`);
    } catch (err) {
      console.error("[ShareModal] Falha na geração do PNG:", err);
      toast({ 
        variant: "destructive", 
        title: "Não foi possível gerar a imagem", 
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden rounded-[2.5rem] bg-white border-none flex flex-col md:flex-row h-[95vh] md:h-auto">
        
        {/* LADO ESQUERDO: PREVIEW RENDERER */}
        <div className="flex-1 p-8 bg-muted/20 flex items-center justify-center border-r border-dashed print:p-0 print:bg-white print:border-none relative">
          {!isAssetsLoaded && (
            <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
               <Loader2 className="w-8 h-8 animate-spin text-secondary" />
               <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Preparando Identidade...</p>
            </div>
          )}

          {/* ÁREA DE RENDERIZAÇÃO (Este elemento é o que vira imagem) */}
          <div 
            ref={printRef}
            className="w-[300px] h-[424px] bg-white shadow-2xl rounded-3xl flex flex-col items-center p-10 text-center border relative overflow-hidden print:shadow-none print:border-none print:w-full print:h-screen"
            id="share-node"
          >
            {/* Header com Logo */}
            <div className="mb-8 flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-[1.5rem] bg-muted overflow-hidden relative border-2 border-primary/5 shadow-md flex items-center justify-center">
                {orgLogoBase64 ? (
                  <img src={orgLogoBase64} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <QrCode className="w-10 h-10 text-muted-foreground opacity-30" />
                )}
              </div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary line-clamp-1">
                {data.title}
              </h2>
            </div>

            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-8 max-w-[220px] leading-relaxed">
              Escaneie para acessar nossa agenda completa de eventos
            </p>

            {/* QR Code */}
            <div className="p-4 bg-white border-4 border-primary/5 rounded-[2.5rem] shadow-inner mb-6 relative">
              <QRCodeSVG 
                value={shareUrl}
                size={160}
                level="H"
                includeMargin={false}
              />
              <div className="absolute inset-0 border-2 border-secondary/10 rounded-[2.5rem] pointer-events-none" />
            </div>

            {/* URL Pública Visível */}
            <div className="space-y-2 mb-8">
               <p className="text-[9px] font-mono font-bold text-secondary uppercase tracking-tight select-all">
                 viby.club/{data.username}
               </p>
            </div>

            {/* Rodapé Obrigatório */}
            <div className="mt-auto space-y-4 flex flex-col items-center w-full">
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60">
                Powered by Viby.Club
              </p>
              
              <div className="w-12 h-6 relative flex items-center justify-center opacity-40">
                {vibyLogoBase64 ? (
                  <img src={vibyLogoBase64} alt="Viby" className="max-h-full max-w-full object-contain grayscale" />
                ) : (
                  <span className="font-black italic text-xs">VIBY</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* LADO DIREITO: CONTROLES */}
        <div className="w-full md:w-96 p-10 space-y-10 overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
                  <Share2 className="w-5 h-5" />
               </div>
               <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Compartilhar</DialogTitle>
            </div>
            <DialogDescription className="font-medium text-xs">Materiais profissionais de divulgação para sua marca.</DialogDescription>
          </DialogHeader>

          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-3">
              <Button onClick={handleNativeShare} disabled={isGenerating} className="h-14 rounded-2xl font-black uppercase italic text-xs gap-3 bg-secondary text-white shadow-lg shadow-secondary/20 hover:scale-[1.02] transition-transform">
                <Share2 className="w-4.5 h-4.5" /> Compartilhar Link
              </Button>
              <Button variant="outline" onClick={handleCopyLink} disabled={isGenerating} className="h-14 rounded-2xl font-bold uppercase text-[10px] gap-2 border-secondary/20 text-secondary">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                Copiar Endereço Público
              </Button>
            </div>

            <Separator className="border-dashed" />

            {/* FORMATOS DE DOWNLOAD */}
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Download de Arquivo PNG</p>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="ghost" 
                  onClick={() => handleDownload('instagram')} 
                  disabled={isGenerating || !isAssetsLoaded} 
                  className="h-20 flex-col gap-2 rounded-2xl border bg-muted/20 hover:bg-white hover:shadow-md transition-all"
                >
                  <Instagram className="w-5 h-5 text-pink-500" />
                  <span className="text-[9px] font-black uppercase">Post Feed</span>
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => handleDownload('stories')} 
                  disabled={isGenerating || !isAssetsLoaded} 
                  className="h-20 flex-col gap-2 rounded-2xl border bg-muted/20 hover:bg-white hover:shadow-md transition-all"
                >
                  <Smartphone className="w-5 h-5 text-purple-500" />
                  <span className="text-[9px] font-black uppercase">Stories</span>
                </Button>
              </div>
            </div>

            {/* FORMATOS DE IMPRESSÃO */}
            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Materiais para Impressão</p>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="ghost" onClick={() => handleDownload('A4')} disabled={isGenerating} className="h-14 flex-col text-[8px] font-black uppercase bg-muted/30 rounded-xl border">
                   A4 <span className="opacity-40">(Cartaz)</span>
                </Button>
                <Button variant="ghost" onClick={() => handleDownload('A5')} disabled={isGenerating} className="h-14 flex-col text-[8px] font-black uppercase bg-muted/30 rounded-xl border">
                   A5 <span className="opacity-40">(Flyer)</span>
                </Button>
                <Button variant="ghost" onClick={() => handleDownload('A6')} disabled={isGenerating} className="h-14 flex-col text-[8px] font-black uppercase bg-muted/30 rounded-xl border">
                   A6 <span className="opacity-40">(Cartão)</span>
                </Button>
              </div>
              <Button variant="outline" onClick={handlePrint} className="w-full h-11 rounded-xl font-black uppercase text-[10px] gap-2 border-primary/10">
                 <Printer className="w-4 h-4" /> Configurar Impressão Direta
              </Button>
            </div>
          </div>

          {isGenerating && (
            <div className="p-4 bg-secondary/10 rounded-2xl border border-secondary/20 flex items-center gap-3 text-secondary animate-in zoom-in-95">
               <Loader2 className="w-5 h-5 animate-spin" />
               <p className="text-[10px] font-black uppercase">Renderizando alta resolução...</p>
            </div>
          )}

          <div className="p-5 bg-muted/50 rounded-2xl border border-dashed flex items-start gap-4">
            <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
            <div className="space-y-1">
               <p className="text-[9px] text-primary font-black uppercase italic">Dica Profissional</p>
               <p className="text-[9px] text-muted-foreground font-medium leading-relaxed uppercase">
                 Para materiais físicos, utilize os formatos A4 a A6. Eles possuem margens de sangria ideais para gráficas.
               </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
