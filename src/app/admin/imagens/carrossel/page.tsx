'use client';

import * as React from 'react';
import { useFirestore, useDoc } from '@/firebase';
import { collection, query, where, orderBy, limit, addDoc, serverTimestamp, getDocs, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Loader2, 
  Plus, 
  Layers, 
  RefreshCw,
  Palette,
  FileDown,
  X,
  Trophy,
  GripVertical,
  Inbox
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { CarouselTemplate } from '@/components/images/CarouselTemplate';
import { toPng } from 'html-to-image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, normalizeText } from '@/lib/utils';
import { fetchImageAsBase64 } from '@/app/actions/image-proxy';
import { isEventVisible } from '@/lib/event-scoring-utils';

const COPA_LOGO = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibybrasil.png?alt=media&token=";

export default function CarouselGeneratorPage() {
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [selectedEvents, setSelectedEvents] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  
  const [theme, setTheme] = React.useState<'viby' | 'claro' | 'escuro' | 'copa' | 'pride'>('viby');
  const [aspectRatio, setAspectRatio] = React.useState<'1:1' | '4:5'>('1:1');

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db]);
  const { data: settings } = useDoc<any>(settingsRef);
  
  const [logoBase64, setLogoBase64] = React.useState<string | null>(null);
  const [copaLogoBase64, setCopaLogoBase64] = React.useState<string | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const hiddenRenderRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (settings?.logoUrl) {
      fetchImageAsBase64(settings.logoUrl).then(res => {
        if (res.success) setLogoBase64(res.data || null);
      });
    }
    fetchImageAsBase64(COPA_LOGO).then(res => {
      if (res.success) setCopaLogoBase64(res.data || null);
    });
  }, [settings?.logoUrl]);

  const handleSearch = async () => {
    if (!db || !searchTerm.trim() || isSearching) return;
    setIsSearching(true);
    try {
      const q = query(
        collection(db, "events"),
        where("status", "==", "Ativo"),
        orderBy("date", "asc"),
        limit(200)
      );
      const snap = await getDocs(q);
      const searchNorm = normalizeText(searchTerm);
      const now = new Date();
      
      const results = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(ev => {
           const title = normalizeText(ev.title || "");
           const tags = (ev.tags || []).map(t => normalizeText(t));
           const matchesSearch = title.includes(searchNorm) || tags.some(t => t.includes(searchNorm));
           const isNotListed = !selectedEvents.some(s => s.id === ev.id);
           const isVisible = isEventVisible(ev, now);
           return matchesSearch && isNotListed && isVisible;
        });
      setSearchResults(results);
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na busca" });
    } finally {
      setIsSearching(false);
    }
  };

  const addEvent = async (event: any) => {
    if (selectedEvents.some(e => e.id === event.id)) return;
    setIsSearching(true);
    const imgRes = await fetchImageAsBase64(event.image);
    setSelectedEvents([...selectedEvents, { ...event, image: imgRes.success ? imgRes.data : event.image }]);
    setSearchResults([]);
    setSearchTerm("");
    setIsSearching(false);
  };

  const removeEvent = (id: string) => {
    setSelectedEvents(selectedEvents.filter(e => e.id !== id));
  };

  const handleDownloadAll = async () => {
    if (!hiddenRenderRef.current || isGenerating || selectedEvents.length === 0) return;
    setIsGenerating(true);
    
    await new Promise(r => setTimeout(r, 1500));

    try {
      const slides = hiddenRenderRef.current.querySelectorAll('.viby-carousel-slide');
      
      for (let i = 0; i < slides.length; i++) {
        const slideElement = slides[i] as HTMLElement;

        // Forçar decodificação de todas as imagens do slide para garantir renderização mobile
        const imgs = Array.from(slideElement.querySelectorAll('img'));
        await Promise.all(imgs.map(async (img) => {
           if (img.src) {
             try {
               await img.decode();
             } catch (e) {
               console.warn("[Render Engine] Slide decode fail");
             }
           }
        }));

        const dataUrl = await toPng(slideElement, {
          pixelRatio: 2,
          cacheBust: true,
          quality: 1,
          skipFonts: false
        });

        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.download = `viby-carousel-${theme}-slide${i + 1}.png`;
        link.href = blobUrl;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(blobUrl);
        await new Promise(r => setTimeout(r, 1000));
      }

      toast({ title: "Carrossel exportado!" });
    } catch (err) {
      console.error("[Carousel Export Error]", err);
      toast({ variant: "destructive", title: "Erro na exportação", description: "Verifique seu sinal e tente novamente." });
    } finally {
      setIsGenerating(false);
    }
  };

  const activeLogo = theme === 'copa' ? copaLogoBase64 : logoBase64;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      {/* RENDERIZADOR OFF-SCREEN PARA CARROSSEL */}
      <div ref={hiddenRenderRef} style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1 }}>
         {selectedEvents.map((ev, idx) => (
           <CarouselTemplate 
              key={`hidden-slide-${idx}`}
              event={ev} 
              aspectRatio={aspectRatio} 
              theme={theme} 
              logoUrl={activeLogo || undefined}
              slideNumber={idx + 1}
              totalSlides={selectedEvents.length}
           />
         ))}
      </div>

      <div className="lg:col-span-4 space-y-8">
        <Card className="border-none shadow-sm rounded-[2rem] bg-white">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter">1. Conteúdo</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase">Busque por nome ou tags (ex: copa).</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                <Input 
                  placeholder="Nome ou tag..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 rounded-xl"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching} className="h-11 px-4 rounded-xl font-bold bg-secondary text-white">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "OK"}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="p-2 bg-muted/20 rounded-2xl border border-dashed animate-in slide-in-from-top-2">
                 {searchResults.map(ev => (
                   <button key={ev.id} onClick={() => addEvent(ev)} className="w-full flex items-center gap-3 p-3 hover:bg-white rounded-xl text-left transition-all">
                      <img src={ev.image} className="h-10 w-10 rounded-lg object-cover" />
                      <div className="flex-1 min-w-0"><p className="text-xs font-bold truncate uppercase">{ev.title}</p></div>
                      <Plus className="w-4 h-4 text-secondary" />
                   </button>
                 ))}
              </div>
            )}

            <div className="space-y-3 pt-4">
              <Label className="text-[10px] font-black uppercase ml-1 opacity-60">Fila do Carrossel ({selectedEvents.length})</Label>
              <div className="space-y-2">
                {selectedEvents.map((ev, i) => (
                  <div key={ev.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/50 group animate-in slide-in-from-left-2">
                    <div className="opacity-20"><GripVertical className="w-4 h-4" /></div>
                    <img src={ev.image} className="h-8 w-8 rounded-lg object-cover" />
                    <span className="flex-1 text-xs font-bold uppercase truncate">{ev.title}</span>
                    <button onClick={() => removeEvent(ev.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] bg-white">
          <CardHeader className="p-8 pb-4"><CardTitle className="text-xl font-black italic uppercase tracking-tighter">2. Estilo</CardTitle></CardHeader>
          <CardContent className="p-8 pt-0 space-y-6">
             <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase opacity-60">Formato</Label>
                <div className="grid grid-cols-2 gap-2">
                   <Button variant={aspectRatio === '1:1' ? 'secondary' : 'outline'} className="rounded-xl h-12 font-black uppercase text-[10px]" onClick={() => setAspectRatio('1:1')}>Quadrado 1:1</Button>
                   <Button variant={aspectRatio === '4:5' ? 'secondary' : 'outline'} className="rounded-xl h-12 font-black uppercase text-[10px]" onClick={() => setAspectRatio('4:5')}>Retrato 4:5</Button>
                </div>
             </div>
             <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase opacity-60">Tema</Label>
                <Select value={theme} onValueChange={(v:any) => setTheme(v)}>
                   <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                   <SelectContent className="rounded-xl">
                      <SelectItem value="viby">Viby (Padrão)</SelectItem>
                      <SelectItem value="copa">Copa do Mundo 2026</SelectItem>
                      <SelectItem value="pride">Pride / Diversidade</SelectItem>
                      <SelectItem value="claro">Claro</SelectItem>
                      <SelectItem value="escuro">Escuro</SelectItem>
                   </SelectContent>
                </Select>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-8 space-y-6">
        <div className="flex items-center justify-between px-2">
           <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">Sequência do Carrossel</h3>
           <Button onClick={handleDownloadAll} disabled={isGenerating || selectedEvents.length === 0} className="rounded-xl h-11 px-8 font-black uppercase italic text-xs bg-primary text-white gap-2 shadow-lg">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} 
              Baixar Todas as Lâminas
           </Button>
        </div>

        <div className="bg-[#e2e8f0] rounded-[3rem] p-10 min-h-[800px] border-none shadow-2xl overflow-hidden">
           {isGenerating && (
             <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-secondary" />
                <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Sincronizando Mídias...</p>
             </div>
           )}
           <ScrollArea className="h-full">
              <div className="flex flex-col items-center gap-20 py-10" ref={containerRef}>
                {selectedEvents.length === 0 ? (
                  <div className="text-center opacity-20 py-40">
                     <Layers className="w-20 h-20 mx-auto mb-4" />
                     <p className="text-sm font-black uppercase italic">Adicione eventos para iniciar o carrossel</p>
                  </div>
                ) : selectedEvents.map((ev, idx) => (
                  <div key={ev.id} className="relative group/preview flex flex-col items-center gap-4">
                    <Badge className="bg-white/90 text-primary border-none shadow-md px-4 py-1.5 font-black uppercase text-[10px]">Slide {idx + 1}</Badge>
                    <div className={cn(
                      "shadow-[0_40px_100px_rgba(0,0,0,0.3)] bg-white origin-top transition-all duration-500",
                      aspectRatio === '1:1' ? "scale-[0.5] h-[1080px]" : "scale-[0.4] h-[1350px]"
                    )}>
                       <CarouselTemplate 
                          event={ev} 
                          aspectRatio={aspectRatio} 
                          theme={theme} 
                          logoUrl={activeLogo || undefined}
                          slideNumber={idx + 1}
                          totalSlides={selectedEvents.length}
                       />
                    </div>
                  </div>
                ))}
              </div>
           </ScrollArea>
        </div>
      </div>
    </div>
  );
}
