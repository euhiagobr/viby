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
  Layout, 
  FileText,
  Instagram,
  QrCode
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { toPng } from 'html-to-image';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';

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

export function ShareModal({ isOpen, onOpenChange, data }: ShareModalProps) {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const printRef = React.useRef<HTMLDivElement>(null);

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${data.url}?vsrc=qr`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({ title: "Link copiado!" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (format: Format) => {
    if (!printRef.current) return;
    setIsGenerating(true);
    try {
      const node = printRef.current;
      const dataUrl = await toPng(node, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        style: {
          display: 'flex',
          transform: 'scale(1)',
        }
      });
      
      const link = document.createElement('a');
      link.download = `viby-share-${data.username}-${format}.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "Download concluído!" });
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao gerar imagem" });
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
      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[2.5rem] bg-white border-none flex flex-col md:flex-row h-[90vh] md:h-auto">
        <div className="flex-1 p-8 bg-muted/20 flex items-center justify-center border-r border-dashed print:p-0 print:bg-white print:border-none">
          {/* O CARD GERADO PARA IMPRESSÃO/IMAGEM */}
          <div 
            ref={printRef}
            className="w-[300px] h-[424px] bg-white shadow-2xl rounded-3xl flex flex-col items-center p-8 text-center border relative overflow-hidden print:shadow-none print:border-none print:w-full print:h-screen"
          >
            <div className="mb-6 flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-muted overflow-hidden relative border shadow-sm">
                {data.logoUrl ? (
                  <Image src={data.logoUrl} alt="Logo" fill className="object-cover" unoptimized />
                ) : (
                  <QrCode className="w-8 h-8 text-muted-foreground m-auto mt-4" />
                )}
              </div>
              <h2 className="text-xl font-black uppercase italic tracking-tighter text-primary line-clamp-1">
                {data.title}
              </h2>
            </div>

            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-6 max-w-[200px] leading-relaxed">
              Escaneie para acessar nossa agenda completa de eventos
            </p>

            <div className="p-3 bg-white border-4 border-primary/5 rounded-3xl shadow-inner mb-6">
              <QRCodeSVG 
                value={shareUrl}
                size={160}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="mt-auto space-y-4">
              <p className="text-[9px] font-mono font-bold text-secondary uppercase tracking-tight truncate max-w-[240px]">
                viby.club/{data.username}
              </p>
              
              <div className="flex flex-col items-center gap-1.5 opacity-40">
                <span className="text-[8px] font-black uppercase tracking-[0.3em]">Powered by Viby.Club</span>
                <div className="w-10 h-4 relative">
                  <Image src="https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2FlogoUrl_1739501509176?alt=media&token=c813d395-5d9c-4861-a1e1-95567b452834" alt="Viby" fill className="object-contain grayscale" unoptimized />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full md:w-80 p-8 space-y-8 overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase tracking-tighter text-primary">Compartilhar</DialogTitle>
            <DialogDescription className="font-medium">Gere materiais de divulgação física ou digital.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-2">
              <Button onClick={handleNativeShare} className="h-12 rounded-xl font-bold uppercase text-[10px] gap-2 bg-secondary text-white">
                <Share2 className="w-4 h-4" /> Compartilhar Agora
              </Button>
              <Button variant="outline" onClick={handleCopyLink} className="h-12 rounded-xl font-bold uppercase text-[10px] gap-2">
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                Copiar Link Público
              </Button>
            </div>

            <Separator className="border-dashed" />

            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Para Impressão</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={handlePrint} className="h-10 text-[9px] font-black uppercase gap-1.5 bg-muted/50 rounded-lg">
                  <Printer className="w-3.5 h-3.5" /> Imprimir
                </Button>
                <Button variant="ghost" onClick={() => handleDownload('A4')} disabled={isGenerating} className="h-10 text-[9px] font-black uppercase gap-1.5 bg-muted/50 rounded-lg">
                  <FileText className="w-3.5 h-3.5" /> Salvar PNG
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Redes Sociais</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="ghost" onClick={() => handleDownload('instagram')} className="h-20 flex-col gap-2 rounded-xl border bg-white hover:bg-muted">
                  <Instagram className="w-5 h-5 text-pink-500" />
                  <span className="text-[8px] font-black uppercase">Post Feed</span>
                </Button>
                <Button variant="ghost" onClick={() => handleDownload('stories')} className="h-20 flex-col gap-2 rounded-xl border bg-white hover:bg-muted">
                  <Smartphone className="w-5 h-5 text-purple-500" />
                  <span className="text-[8px] font-black uppercase">Stories</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
            <Info className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
            <p className="text-[9px] text-secondary font-bold uppercase leading-tight italic">
              Dica: Imprima em papel couchê 250g para um acabamento profissional em balcões ou mesas.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
