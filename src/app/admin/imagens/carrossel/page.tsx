'use client';

import * as React from 'react';
import { useFirestore, useDoc, useAuth, useUser, useFirebaseApp } from '@/firebase';
import { collection, query, where, orderBy, limit, addDoc, serverTimestamp, getDocs, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Inbox,
  Eye,
  Camera,
  Send,
  CheckCircle2,
  Monitor,
  ImageIcon
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
import { sendAgendaRequestAction } from '@/app/actions/email';
import { useIsMobile } from '@/hooks/use-mobile';
import { auditAndPrepareImages, triggerVisualProofDownload } from '@/lib/image-generator-utils';

const COPA_LOGO = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibybrasil.png?alt=media&token=";

export default function CarouselGeneratorPage() {
  const db = useFirestore();
  const auth = useAuth();
  const app = useFirebaseApp();
  const { user } = useUser(auth);
  const isMobile = useIsMobile();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [selectedEvents, setSelectedEvents] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);
  
  const [theme, setTheme] = React.useState<'viby' | 'claro' | 'escuro' | 'copa' | 'pride'>('viby');
  const [aspectRatio, setAspectRatio] = React.useState<'1:1' | '4:5'>('1:1');

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db]);
  const { data: settings } = useDoc<any>(settingsRef);
  
  const [logoBase64, setLogoBase64] = React.useState<string | null>(null);
  const [copaLogoBase64, setCopaLogoBase64] = React.useState<string | null>(null);

  const [capturingSlide, setCapturingSlide] = React.useState<any | null>(null);
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
      
      const results = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(ev => {
           const title = normalizeText(ev.title || "");
           const tags = (ev.tags || []).map(t => normalizeText(t));
           const matchesSearch = title.includes(searchNorm) || tags.some(t => t.includes(searchNorm));
           const isNotListed = !selectedEvents.some(s => s.id === ev.id);
           // Removido filtro de visibilidade temporal
           return matchesSearch && isNotListed;
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

  const processExportQueue = async (action: 'download' | 'email') => {
    if (isGenerating || isSendingEmail || selectedEvents.length === 0) return;
    
    const actionSetter = action === 'download' ? setIsGenerating : setIsSendingEmail;
    actionSetter(true);
    const base64Images: string[] = [];
    const config = {
      '1:1': { width: 1080, height: 1080 },
      '4:5': { width: 1080, height: 1350 }
    }[aspectRatio];

    try {
      if (document.fonts) await document.fonts.ready;

      for (let i = 0; i < selectedEvents.length; i++) {
        const ev = selectedEvents[i];
        setCapturingSlide({ event: ev, idx: i + 1 });
        
        await new Promise(r => setTimeout(r, 1500));

        const node = hiddenRenderRef.current?.querySelector('.viby-carousel-slide') as HTMLElement;
        if (!node) throw new Error("Falha no motor de renderização.");

        await auditAndPrepareImages(node);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        const dataUrl = await toPng(node, {
          pixelRatio: 2,
          cacheBust: true,
          quality: 1,
          skipFonts: false
        });

        if (action === 'download') {
           await triggerVisualProofDownload(dataUrl, `final-export-carrossel-s${i+1}.png`);
        } else {
           base64Images.push(dataUrl);
        }

        setCapturingSlide(null);
        await new Promise(r => setTimeout(r, 600));
      }

      if (action === 'email') {
        const res = await sendAgendaRequestAction({
          images: base64Images,
          theme,
          format: `carousel_${aspectRatio}`,
          userEmail: user?.email!,
          userName: user?.displayName || "Admin"
        });
        if (res.success) toast({ title: "Artes enviadas para seu e-mail!" });
        else throw new Error(res.error);
      } else {
        toast({ title: "Carrossel baixado com sucesso!" });
      }

    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro na geração", description: err.message });
    } finally {
      actionSetter(false);
      setCapturingSlide(null);
    }
  };

  const activeLogo = theme === 'copa' ? copaLogoBase64 : logoBase64;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div 
        ref={hiddenRenderRef} 
        style={{ 
          position: 'fixed', 
          left: '-10000px', 
          top: '0', 
          zIndex: -1, 
          pointerEvents: 'none', 
          opacity: 0.01,
          visibility: 'visible' 
        }}
      >
         {capturingSlide && (
           <CarouselTemplate 
              event={capturingSlide.event} 
              aspectRatio={aspectRatio} 
              theme={theme} 
              logoUrl={activeLogo || undefined}
              slideNumber={capturingSlide.idx}
              totalSlides={selectedEvents.length}
           />
         )}
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
                      <img src={ev.image} className="h-10 w-10 rounded-lg object-cover" alt="" />
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
                    <img src={ev.image} className="h-8 w-8 rounded-lg object-cover" alt="" />
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
           <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2"><Eye className="w-4 h-4" /> Preview do Layout</h3>
           <div className="flex gap-2">
              <Button 
                onClick={() => processExportQueue('email')} 
                disabled={isSendingEmail || selectedEvents.length === 0} 
                variant="outline"
                className="rounded-xl h-11 px-6 font-black uppercase italic text-xs gap-2 border-secondary text-secondary"
              >
                 {isSendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} 
                 Enviar p/ E-mail
              </Button>
              <Button onClick={() => processExportQueue('download')} disabled={isGenerating || selectedEvents.length === 0} className="rounded-xl h-11 px-8 font-black uppercase italic text-xs bg-primary text-white gap-2 shadow-lg">
                 {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} 
                 Baixar Tudo
              </Button>
           </div>
        </div>

        <div className="bg-[#e2e8f0] rounded-[3rem] p-10 min-h-[800px] border-none shadow-2xl overflow-hidden relative">
           {(isGenerating || isSendingEmail) && (
             <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-secondary" />
                <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">
                  {capturingSlide ? `Exportando Slide ${capturingSlide.idx}...` : 'Processando Fila Gráfica...'}
                </p>
             </div>
           )}
           <ScrollArea className="h-full">
              <div className="flex flex-col items-center gap-20 py-10">
                {selectedEvents.length === 0 ? (
                  <div className="text-center opacity-20 py-40">
                     <Layers className="w-20 h-20 mx-auto mb-4" />
                     <p className="text-sm font-black uppercase italic">Adicione eventos para iniciar o carrossel</p>
                  </div>
                ) : isMobile ? (
                  <div className="w-full max-w-sm space-y-4 animate-in fade-in">
                    <Card className="border-none shadow-sm rounded-3xl bg-white p-8 text-center space-y-4">
                       <div className="p-4 bg-secondary/10 rounded-2xl w-fit mx-auto text-secondary"><Monitor className="w-8 h-8" /></div>
                       <div className="space-y-1">
                          <h3 className="font-black uppercase italic text-primary">Prévia Otimizada</h3>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase leading-tight">O carrossel será montado slide a slide no momento da exportação para garantir qualidade e economia de dados.</p>
                       </div>
                    </Card>
                    {selectedEvents.map((ev, i) => (
                      <div key={i} className="p-4 bg-white/40 rounded-2xl border border-dashed flex items-center gap-3">
                         <Badge variant="outline" className="text-[8px] font-black h-5">Slide {i+1}</Badge>
                         <span className="text-[10px] font-bold uppercase truncate">{ev.title}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  selectedEvents.map((ev, idx) => (
                    <div key={ev.id} className="relative group/preview flex flex-col items-center gap-4">
                      <Badge className="bg-white/90 text-primary border-none shadow-md px-4 py-1.5 font-black uppercase text-[10px]">Slide {idx + 1}</Badge>
                      <div className={cn(
                        "shadow-[0_40px_100px_rgba(0,0,0,0.3)] bg-white origin-top transition-all duration-500",
                        aspectRatio === '1:1' ? "scale-[0.5] h-[540px]" : "scale-[0.4] h-[540px]"
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
                  ))
                )}
              </div>
           </ScrollArea>
        </div>
      </div>
    </div>
  );
}
