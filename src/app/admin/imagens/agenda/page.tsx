
'use client';

import * as React from 'react';
import { useFirestore, useDoc, useAuth, useUser } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Loader2, 
  Plus, 
  GripVertical, 
  Download, 
  Palette,
  Maximize2,
  Smartphone,
  Layout,
  FileDown,
  X,
  Trophy,
  Image as ImageIcon,
  Info,
  Heart,
  Zap,
  RefreshCw,
  Eye,
  Send,
  Monitor,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { AgendaTemplate } from '@/components/images/AgendaTemplate';
import { toPng } from 'html-to-image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, normalizeText } from '@/lib/utils';
import { fetchImageAsBase64 } from '@/app/actions/image-proxy';
import { Separator } from '@/components/ui/separator';
import { isEventVisible } from '@/lib/event-scoring-utils';
import { COPA_TAGS, LGBT_TAGS, LGBT_CATEGORY_IDS } from '@/lib/constants';
import { sendAgendaRequestAction } from '@/app/actions/email';
import { useIsMobile } from '@/hooks/use-mobile';

const ITEMS_PER_FORMAT = {
  stories: 7,
  instagram: 4,
  A4: 4
};

const FORMAT_DIMENSIONS = {
  stories: { width: 1080, height: 1920 },
  instagram: { width: 1080, height: 1350 },
  A4: { width: 1240, height: 1754 }
};

const COPA_LOGO = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibybrasil.png?alt=media&token=";

export default function AgendaGeneratorPage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const isMobile = useIsMobile();
  
  const [searchTerm, setSearchTerm] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [selectedEvents, setSelectedEvents] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);
  
  const [format, setFormat] = React.useState<'A4' | 'instagram' | 'stories'>('stories');
  const [theme, setTheme] = React.useState<'viby' | 'claro' | 'escuro' | 'copa' | 'pride'>('viby');

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db]);
  const { data: settings } = useDoc<any>(settingsRef);
  
  const [logoBase64, setLogoBase64] = React.useState<string | null>(null);
  const [copaLogoBase64, setCopaLogoBase64] = React.useState<string | null>(null);

  // Estado para controle de fila de renderização mobile
  const [capturingPage, setCapturingPage] = React.useState<any | null>(null);
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

  const loadPreset = async (type: 'copa' | 'lgbt') => {
    if (!db || isSearching) return;
    setIsSearching(true);
    try {
      const q = query(
        collection(db, "events"),
        where("status", "==", "Ativo"),
        orderBy("date", "asc"),
        limit(200)
      );
      const snap = await getDocs(q);
      const now = new Date();
      
      const filtered = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(ev => isEventVisible(ev, now))
        .filter(ev => {
          if (type === 'copa') {
            return ev.tags?.some(t => COPA_TAGS.includes(t.toLowerCase()));
          } else {
            const byCategory = LGBT_CATEGORY_IDS.includes(ev.categoryId);
            const byTags = ev.tags?.some(t => LGBT_TAGS.includes(t.toLowerCase()));
            return byCategory || byTags;
          }
        });

      const prepared = await Promise.all(filtered.slice(0, 15).map(async (ev) => {
        const imgRes = await fetchImageAsBase64(ev.image);
        return { ...ev, image: imgRes.success ? imgRes.data : ev.image };
      }));

      setSelectedEvents(prepared);
      setTheme(type === 'copa' ? 'copa' : 'pride');
      toast({ title: `Preset ${type.toUpperCase()} carregado!`, description: `${prepared.length} eventos adicionados.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erro ao carregar preset" });
    } finally {
      setIsSearching(false);
    }
  };

  const addEvent = async (event: any) => {
    if (selectedEvents.some(e => e.id === event.id)) return;
    setIsSearching(true);
    const imgRes = await fetchImageAsBase64(event.image);
    const eventWithSafeImage = {
      ...event,
      image: imgRes.success ? imgRes.data : event.image
    };
    setSelectedEvents([...selectedEvents, eventWithSafeImage]);
    setSearchResults([]);
    setSearchTerm("");
    setIsSearching(false);
  };

  const removeEvent = (id: string) => {
    setSelectedEvents(selectedEvents.filter(e => e.id !== id));
  };

  const eventPages = React.useMemo(() => {
    const itemsPerPage = ITEMS_PER_FORMAT[format];
    const pages = [];
    for (let i = 0; i < selectedEvents.length; i += itemsPerPage) {
      pages.push(selectedEvents.slice(i, i + itemsPerPage));
    }
    return pages;
  }, [selectedEvents, format]);

  // LÓGICA DE CAPTURA SEQUENCIAL (FILA) PARA MOBILE
  const processExportQueue = async (action: 'download' | 'email') => {
    if (isGenerating || isSendingEmail || selectedEvents.length === 0) return;
    
    const isMobileExport = !!isMobile;
    const actionStateSetter = action === 'download' ? setIsGenerating : setIsSendingEmail;
    
    actionStateSetter(true);
    const base64Images: string[] = [];
    const dimensions = FORMAT_DIMENSIONS[format];

    console.log(`[Mobile Export] Starting sequential queue. Pages: ${eventPages.length}`);

    try {
      // 1. Garantir fontes prontas
      if (document.fonts) await document.fonts.ready;

      // 2. Processar cada página individualmente
      for (let i = 0; i < eventPages.length; i++) {
        const pageEvents = eventPages[i];
        setCapturingPage({ events: pageEvents, idx: i + 1 });
        
        // Pequena pausa para o React montar o nó off-screen
        await new Promise(r => setTimeout(r, 600));

        const node = hiddenRenderRef.current?.querySelector('.viby-template-root') as HTMLElement;
        if (!node) throw new Error("Falha ao localizar nó de renderização.");

        // Validar mídias no nó
        const imgs = Array.from(node.querySelectorAll('img'));
        await Promise.all(imgs.map(async (img) => {
          if (img.src) {
            try {
              if (!img.complete) await new Promise(r => { img.onload = r; img.onerror = r; });
              await img.decode();
            } catch (e) {}
          }
        }));

        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        const dataUrl = await toPng(node, {
          pixelRatio: 2,
          cacheBust: true,
          quality: 1,
          width: dimensions.width,
          height: dimensions.height,
          skipFonts: false
        });

        if (action === 'download') {
           const response = await fetch(dataUrl);
           const blob = await response.blob();
           const blobUrl = URL.createObjectURL(blob);
           const link = document.createElement('a');
           link.download = `viby-agenda-${theme}-${format}-p${i + 1}.png`;
           link.href = blobUrl;
           link.rel = "noopener";
           document.body.appendChild(link);
           link.click();
           document.body.removeChild(link);
           setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
        } else {
           base64Images.push(dataUrl);
        }

        // Limpar página atual para liberar memória antes da próxima
        setCapturingPage(null);
        await new Promise(r => setTimeout(r, 300));
      }

      if (action === 'email') {
        const res = await sendAgendaRequestAction({
          images: base64Images,
          theme,
          format,
          userEmail: user?.email!,
          userName: user?.displayName || "Admin"
        });
        if (res.success) toast({ title: "Arte enviada para seu e-mail!" });
        else throw new Error(res.error);
      } else {
        toast({ title: "Todas as páginas foram baixadas!" });
      }

    } catch (err: any) {
      console.error("[Mobile Export Error]", err);
      toast({ variant: "destructive", title: "Erro na geração", description: err.message });
    } finally {
      actionStateSetter(false);
      setCapturingPage(null);
    }
  };

  const activeLogo = theme === 'copa' ? copaLogoBase64 : logoBase64;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      {/* NÓ DE RENDERIZAÇÃO OFF-SCREEN (SEQUENCIAL) */}
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
        {capturingPage && (
          <AgendaTemplate 
            events={capturingPage.events} 
            format={format} 
            theme={theme} 
            logoUrl={activeLogo || undefined} 
            pageNumber={capturingPage.idx} 
            totalPages={eventPages.length} 
          />
        )}
      </div>

      <div className="lg:col-span-4 space-y-8">
        <Card className="border-none shadow-sm rounded-[2rem] bg-white">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter">1. Conteúdo da Agenda</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase">Busque eventos ou use um preset.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-6">
            <div className="grid grid-cols-2 gap-2 mb-4">
               <button onClick={() => loadPreset('copa')} disabled={isSearching} className="h-12 rounded-xl border-2 border-dashed gap-2 font-black uppercase text-[9px] text-[#002776] border-[#ffdf00] bg-[#ffdf00]/5 flex items-center justify-center transition-all hover:bg-[#ffdf00]/10">
                  <Trophy className="w-3.5 h-3.5 fill-[#ffdf00]" /> Preset Copa
               </button>
               <button onClick={() => loadPreset('lgbt')} disabled={isSearching} className="h-12 rounded-xl border-2 border-dashed gap-2 font-black uppercase text-[9px] text-pink-600 border-pink-200 bg-pink-50/50 flex items-center justify-center transition-all hover:bg-pink-100/50">
                  <Heart className="w-3.5 h-3.5 fill-pink-500" /> Preset Pride
               </button>
            </div>

            <Separator className="border-dashed" />

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                <Input placeholder="Nome ou tag..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="pl-10 h-11 rounded-xl" />
              </div>
              <Button onClick={handleSearch} disabled={isSearching} className="h-11 px-4 rounded-xl font-bold bg-secondary text-white">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "OK"}
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="p-2 bg-muted/20 rounded-2xl border border-dashed animate-in slide-in-from-top-2">
                 {searchResults.map(ev => (
                   <button key={ev.id} onClick={() => addEvent(ev)} className="w-full flex items-center gap-3 p-3 hover:bg-white rounded-xl text-left transition-all group">
                      <img src={ev.image} className="h-10 w-10 rounded-lg object-cover" alt="" />
                      <div className="flex-1 min-w-0"><p className="text-xs font-bold truncate uppercase">{ev.title}</p></div>
                      <Plus className="w-4 h-4 text-secondary opacity-0 group-hover:opacity-100" />
                   </button>
                 ))}
              </div>
            )}
            <div className="space-y-3 pt-4">
              <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Lista Atual ({selectedEvents.length})</Label>
              <div className="space-y-2">
                {selectedEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/50 group animate-in slide-in-from-left-2">
                    <div className="opacity-20"><GripVertical className="w-4 h-4" /></div>
                    <img src={ev.image} className="h-8 w-8 rounded-lg object-cover" alt="" />
                    <span className="flex-1 text-xs font-bold uppercase truncate">{ev.title}</span>
                    <button onClick={() => removeEvent(ev.id)} className="p-1.5 text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded-lg transition-all"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] bg-white">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter">2. Estilo Visual</CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-8">
             <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Layout className="w-3.5 h-3.5" /> Formato Global</Label>
                <div className="grid grid-cols-3 gap-2">
                   <FormatBtn active={format === 'stories'} onClick={() => setFormat('stories')} icon={Smartphone} label="Stories" />
                   <FormatBtn active={format === 'instagram'} onClick={() => setFormat('instagram')} icon={Layout} label="Feed" />
                   <FormatBtn active={format === 'A4'} onClick={() => setFormat('A4')} icon={Maximize2} label="A4" />
                </div>
             </div>
             <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Palette className="w-3.5 h-3.5" /> Tema Aplicado</Label>
                <Select value={theme} onValueChange={(v:any) => setTheme(v)}>
                   <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                   <SelectContent className="rounded-xl">
                      <SelectItem value="viby">Viby (Padrão)</SelectItem>
                      <SelectItem value="copa">Copa do Mundo 2026</SelectItem>
                      <SelectItem value="pride">Pride / Diversidade</SelectItem>
                      <SelectItem value="claro">Minimalista Claro</SelectItem>
                      <SelectItem value="escuro">Deep Black</SelectItem>
                   </SelectContent>
                </Select>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-8 space-y-6">
        <div className="flex items-center justify-between px-2">
           <div className="space-y-1">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2"><Info className="w-4 h-4" /> Prévia do Material</h3>
              {selectedEvents.length > 0 && <p className="text-[9px] font-bold text-secondary uppercase italic animate-in fade-in">Total: {eventPages.length} página(s).</p>}
           </div>
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
                 Baixar PNG
              </Button>
           </div>
        </div>

        <div className="relative bg-[#e2e8f0] rounded-[3rem] p-10 min-h-[800px] border-none shadow-2xl overflow-hidden flex flex-col items-center">
           {(isGenerating || isSendingEmail) && (
             <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-secondary" />
                <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">
                  {capturingPage ? `Processando Página ${capturingPage.idx}...` : 'Iniciando Fila Gráfica...'}
                </p>
             </div>
           )}
           <ScrollArea className="h-full w-full">
              <div className="flex flex-col items-center gap-20 py-10 w-full">
                {eventPages.length === 0 ? (
                  <div className="text-center opacity-20 py-40">
                     <ImageIcon className="w-20 h-20 mx-auto mb-4" />
                     <p className="text-sm font-black uppercase italic">Adicione eventos para gerar a agenda</p>
                  </div>
                ) : isMobile ? (
                  /* PREVIEW SIMPLIFICADO PARA MOBILE (POUPAR MEMÓRIA) */
                  <div className="w-full max-w-sm space-y-4 animate-in fade-in">
                     <Card className="border-none shadow-sm rounded-3xl bg-white p-8 text-center space-y-4">
                        <div className="p-4 bg-secondary/10 rounded-2xl w-fit mx-auto text-secondary"><Monitor className="w-8 h-8" /></div>
                        <div className="space-y-1">
                           <h3 className="font-black uppercase italic text-primary">Prévia Otimizada</h3>
                           <p className="text-[10px] font-medium text-muted-foreground uppercase leading-tight">No mobile, renderizamos a arte real apenas durante o download para garantir máxima fidelidade.</p>
                        </div>
                     </Card>
                     {eventPages.map((p, i) => (
                       <div key={i} className="p-4 bg-white/40 rounded-2xl border border-dashed flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase opacity-40">Lâmina #{i+1}</span>
                          <Badge variant="outline" className="text-[8px] font-black uppercase">{p.length} Eventos</Badge>
                       </div>
                     ))}
                  </div>
                ) : (
                  /* PREVIEW COMPLETO PARA DESKTOP */
                  eventPages.map((pageEvents, idx) => (
                    <div key={idx} className="relative flex flex-col items-center gap-4">
                      <div className={cn(
                        "shadow-[0_40px_100px_rgba(0,0,0,0.3)] bg-white origin-top transition-all duration-500",
                        format === 'stories' ? "scale-[0.35] h-[672px]" : format === 'instagram' ? "scale-[0.45] h-[486px]" : "scale-[0.3] h-[526px]"
                      )}>
                        <AgendaTemplate events={pageEvents} format={format} theme={theme} logoUrl={activeLogo || undefined} pageNumber={idx + 1} totalPages={eventPages.length} />
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

function FormatBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all", active ? "border-secondary bg-secondary/5 text-primary shadow-inner" : "border-border bg-white text-muted-foreground hover:bg-muted")}>
      <Icon className="w-5 h-5" />
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}
