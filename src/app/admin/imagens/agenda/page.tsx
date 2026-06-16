
'use client';

import * as React from 'react';
import { useFirestore, useDoc } from '@/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  Loader2, 
  Plus, 
  GripVertical, 
  Download, 
  RefreshCw,
  Palette,
  Maximize2,
  Smartphone,
  Layout,
  FileDown,
  X,
  Trophy,
  ChevronRight,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  Terminal
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
import { cn } from '@/lib/utils';
import { fetchImageAsBase64 } from '@/app/actions/image-proxy';

/**
 * CONFIGURAÇÃO DE CAPACIDADE AUDITADA (VIBY V.1.5)
 * Valores sincronizados com os limites de área útil do AgendaTemplate.
 */
const ITEMS_PER_FORMAT = {
  stories: 7,
  instagram: 4,
  A4: 5
};

const FORMAT_DIMENSIONS = {
  stories: { width: 1080, height: 1920 },
  instagram: { width: 1080, height: 1350 },
  A4: { width: 1240, height: 1754 }
};

const COPA_LOGO = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibybrasil.png?alt=media&token=";

export default function AgendaGeneratorPage() {
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [selectedEvents, setSelectedEvents] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  
  const [format, setFormat] = React.useState<'A4' | 'instagram' | 'stories'>('stories');
  const [theme, setTheme] = React.useState<'viby' | 'claro' | 'escuro' | 'copa'>('viby');

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db]);
  const { data: settings } = useDoc<any>(settingsRef);
  const [logoBase64, setLogoBase64] = React.useState<string | null>(null);
  const [copaLogoBase64, setCopaLogoBase64] = React.useState<string | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);

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
        limit(20)
      );
      const snap = await getDocs(q);
      const results = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(ev => ev.title.toLowerCase().includes(searchTerm.toLowerCase()));
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

  // LÓGICA DE PAGINAÇÃO SINCRONIZADA COM O CÁLCULO DO TEMPLATE
  const eventPages = React.useMemo(() => {
    const itemsPerPage = ITEMS_PER_FORMAT[format];
    const pages = [];
    for (let i = 0; i < selectedEvents.length; i += itemsPerPage) {
      pages.push(selectedEvents.slice(i, i + itemsPerPage));
    }
    return pages;
  }, [selectedEvents, format]);

  const handleDownloadAll = async () => {
    if (!containerRef.current || isGenerating || selectedEvents.length === 0) return;
    setIsGenerating(true);
    
    await new Promise(r => setTimeout(r, 1000));

    try {
      const pages = containerRef.current.querySelectorAll('.viby-export-page');
      const dimensions = FORMAT_DIMENSIONS[format];
      
      for (let i = 0; i < pages.length; i++) {
        const pageElement = pages[i] as HTMLElement;
        const dataUrl = await toPng(pageElement, {
          pixelRatio: 2,
          cacheBust: true,
          quality: 1,
          width: dimensions.width,
          height: dimensions.height
        });

        const link = document.createElement('a');
        link.download = `viby-agenda-${theme}-${format}-p${i + 1}.png`;
        link.href = dataUrl;
        link.click();
        
        await new Promise(r => setTimeout(r, 500));
      }

      toast({ title: "Exportação concluída!" });
    } catch (err) {
      toast({ variant: "destructive", title: "Erro na exportação" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div className="lg:col-span-4 space-y-8">
        <Card className="border-none shadow-sm rounded-[2rem] bg-white">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter">1. Seleção de Eventos</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase">Adicione quanto eventos desejar.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                <Input 
                  placeholder="Nome do evento..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  className="pl-10 h-11 rounded-xl"
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching} className="h-11 px-4 rounded-xl font-bold bg-secondary text-white">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "OK"}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="p-2 bg-muted/20 rounded-2xl border border-dashed animate-in slide-in-from-top-2">
                 {searchResults.map(ev => (
                   <button
                     key={ev.id}
                     onClick={() => addEvent(ev)}
                     className="w-full flex items-center gap-3 p-3 hover:bg-white rounded-xl text-left transition-all group"
                   >
                      <img src={ev.image} className="h-10 w-10 rounded-lg object-cover" alt="" />
                      <div className="flex-1 min-w-0">
                         <p className="text-xs font-bold truncate uppercase">{ev.title}</p>
                         <p className="text-[9px] font-medium opacity-40 uppercase">{ev.city}</p>
                      </div>
                      <Plus className="w-4 h-4 text-secondary opacity-0 group-hover:opacity-100" />
                   </button>
                 ))}
              </div>
            )}

            <div className="space-y-3 pt-4">
              <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Lista de Eventos ({selectedEvents.length})</Label>
              <div className="space-y-2">
                {selectedEvents.map((ev, i) => (
                  <div key={ev.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/50 group animate-in slide-in-from-left-2">
                    <div className="cursor-grab active:cursor-grabbing opacity-20"><GripVertical className="w-4 h-4" /></div>
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
                      <SelectItem value="copa" className="font-bold text-[#002776]">
                        <div className="flex items-center gap-2"><Trophy className="w-3.5 h-3.5 text-[#ffdf00]" /> Copa do Mundo 2026</div>
                      </SelectItem>
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
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">Área de Visualização Determinística</h3>
              {selectedEvents.length > 0 && (
                <p className="text-[9px] font-bold text-secondary uppercase italic animate-in fade-in">
                   {selectedEvents.length} eventos selecionados. Distribuídos em {eventPages.length} artes de {ITEMS_PER_FORMAT[format]} itens cada.
                </p>
              )}
           </div>
           <div className="flex gap-2">
              <Button onClick={handleDownloadAll} disabled={isGenerating || selectedEvents.length === 0} className="rounded-xl h-11 px-8 font-black uppercase italic text-xs bg-primary text-white gap-2 shadow-lg">
                 {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} 
                 {eventPages.length > 1 ? `Baixar ${eventPages.length} Páginas` : 'Baixar PNG'}
              </Button>
           </div>
        </div>

        <div className="relative bg-[#e2e8f0] rounded-[3rem] p-10 min-h-[800px] border-none shadow-2xl overflow-hidden flex flex-col items-center">
           {isGenerating && (
             <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-secondary" />
                <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Gerando Pixels Imutáveis...</p>
             </div>
           )}

           <ScrollArea className="h-full w-full">
              <div className="flex flex-col items-center gap-20 py-10 w-full" ref={containerRef}>
                {eventPages.length === 0 ? (
                  <div className="text-center opacity-20 py-40">
                     <ImageIcon className="w-20 h-20 mx-auto mb-4" />
                     <p className="text-sm font-black uppercase italic">Adicione eventos para gerar a agenda</p>
                  </div>
                ) : eventPages.map((pageEvents, idx) => (
                  <div key={idx} className="relative group/preview flex flex-col items-center gap-4">
                    <div className="flex items-center gap-3 px-6 py-2.5 bg-white/90 backdrop-blur-md rounded-full border shadow-xl mb-4">
                      <Layout className="w-4 h-4 text-secondary" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Arte {idx + 1} de {eventPages.length}</p>
                    </div>
                    
                    <div className={cn(
                      "shadow-[0_40px_100px_rgba(0,0,0,0.3)] bg-white origin-top transition-all duration-500",
                      format === 'stories' ? "scale-[0.35] h-[672px]" : format === 'instagram' ? "scale-[0.45] h-[486px]" : "scale-[0.3] h-[526px]"
                    )}>
                       <AgendaTemplate 
                          events={pageEvents} 
                          format={format} 
                          theme={theme} 
                          logoUrl={(theme === 'copa' ? copaLogoBase64 : logoBase64) || undefined}
                          pageNumber={idx + 1}
                          totalPages={eventPages.length}
                       />
                    </div>
                  </div>
                ))}
              </div>
           </ScrollArea>
        </div>

        <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4 mx-2">
           <ShieldCheck className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
           <div className="space-y-1">
              <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary">Cálculo de Capacidade Ativo</h4>
              <p className="text-[10px] text-muted-foreground leading-relaxed font-medium uppercase">
                 O sistema calcula a altura do cabeçalho e rodapé em tempo real para garantir que nenhum card vaze para fora da imagem. Se houver excesso de eventos, novas páginas são criadas automaticamente.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}

function FormatBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all",
        active ? "border-secondary bg-secondary/5 text-primary shadow-inner" : "border-border bg-white text-muted-foreground hover:bg-muted"
      )}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}
