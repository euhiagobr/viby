'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Loader2, 
  Plus, 
  Trash2, 
  GripVertical, 
  Download, 
  RefreshCw,
  Palette,
  Maximize2,
  Smartphone,
  Layout,
  FileDown,
  CheckCircle2,
  Info
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
import { toPng, toJpeg } from 'html-to-image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { fetchImageAsBase64 } from '@/app/actions/image-proxy';

export default function AgendaGeneratorPage() {
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [selectedEvents, setSelectedEvents] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  
  const [format, setFormat] = React.useState<'A4' | 'instagram' | 'stories'>('stories');
  const [theme, setTheme] = React.useState<'viby' | 'claro' | 'escuro'>('viby');
  const [processedEvents, setProcessedEvents] = React.useState<any[]>([]);

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db]);
  const { data: settings } = useDoc<any>(settingsRef);
  const [logoBase64, setLogoBase64] = React.useState<string | null>(null);

  const renderRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (settings?.logoUrl) {
      fetchImageAsBase64(settings.logoUrl).then(res => {
        if (res.success) setLogoBase64(res.data || null);
      });
    }
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
    
    // Proxy da imagem para evitar erro de canvas (CORS)
    const imgRes = await fetchImageAsBase64(event.image);
    const eventWithSafeImage = {
      ...event,
      image: imgRes.success ? imgRes.data : event.image
    };

    setSelectedEvents([...selectedEvents, eventWithSafeImage]);
    setSearchResults([]);
    setSearchTerm("");
  };

  const removeEvent = (id: string) => {
    setSelectedEvents(selectedEvents.filter(e => e.id !== id));
  };

  const handleDownload = async (type: 'png' | 'jpg') => {
    if (!renderRef.current || isGenerating) return;
    setIsGenerating(true);
    
    // Pequeno delay para garantir renderização final do DOM no canvas
    await new Promise(r => setTimeout(r, 500));

    try {
      const func = type === 'png' ? toPng : toJpeg;
      const dataUrl = await func(renderRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        quality: 0.95,
        backgroundColor: theme === 'claro' ? '#F8FAFC' : '#000000'
      });

      const link = document.createElement('a');
      link.download = `viby-agenda-${Date.now()}.${type}`;
      link.href = dataUrl;
      link.click();

      // Logar geração para o histórico
      if (db) {
        await addDoc(collection(db, "generated_images_logs"), {
          templateId: 'agenda',
          templateName: 'Agenda da Semana',
          format,
          theme,
          formatExt: type,
          createdAt: serverTimestamp()
        });
      }

      toast({ title: "Imagem gerada!", description: "O download iniciará automaticamente." });
    } catch (err) {
      toast({ variant: "destructive", title: "Erro na exportação", description: "Certifique-se de que todas as imagens carregaram corretamente." });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
      {/* Coluna de Controles */}
      <div className="lg:col-span-4 space-y-8">
        <Card className="border-none shadow-sm rounded-[2rem] bg-white">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter">1. Seleção de Eventos</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase">Busque e adicione eventos para a arte.</CardDescription>
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
              <Label className="text-[10px] font-black uppercase opacity-60 ml-1">Eventos Selecionados ({selectedEvents.length})</Label>
              <div className="space-y-2">
                {selectedEvents.map((ev, i) => (
                  <div key={ev.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border/50 group animate-in slide-in-from-left-2">
                    <div className="cursor-grab active:cursor-grabbing opacity-20"><GripVertical className="w-4 h-4" /></div>
                    <img src={ev.image} className="h-8 w-8 rounded-lg object-cover" alt="" />
                    <span className="flex-1 text-xs font-bold uppercase truncate">{ev.title}</span>
                    <button onClick={() => removeEvent(ev.id)} className="p-1.5 text-destructive opacity-0 group-hover:opacity-100 hover:bg-destructive/10 rounded-lg transition-all"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                {selectedEvents.length === 0 && (
                  <div className="py-10 text-center border-2 border-dashed rounded-3xl opacity-20 flex flex-col items-center gap-2">
                     <Plus className="w-8 h-8" />
                     <p className="text-[9px] font-black uppercase">Adicione eventos acima</p>
                  </div>
                )}
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
                <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Layout className="w-3.5 h-3.5" /> Formato de Exportação</Label>
                <div className="grid grid-cols-3 gap-2">
                   <FormatBtn active={format === 'stories'} onClick={() => setFormat('stories')} icon={Smartphone} label="Stories" />
                   <FormatBtn active={format === 'instagram'} onClick={() => setFormat('instagram')} icon={Layout} label="Feed" />
                   <FormatBtn active={format === 'A4'} onClick={() => setFormat('A4')} icon={Maximize2} label="A4" />
                </div>
             </div>

             <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Palette className="w-3.5 h-3.5" /> Tema Oficial</Label>
                <Select value={theme} onValueChange={(v:any) => setTheme(v)}>
                   <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                   <SelectContent className="rounded-xl">
                      <SelectItem value="viby">Viby (Azul Noturno)</SelectItem>
                      <SelectItem value="claro">Minimalista Claro</SelectItem>
                      <SelectItem value="escuro">Deep Black</SelectItem>
                   </SelectContent>
                </Select>
             </div>
          </CardContent>
        </Card>

        <div className="p-6 bg-secondary/5 rounded-[2rem] border-2 border-dashed border-secondary/10 flex items-start gap-3">
           <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
           <p className="text-[10px] text-secondary font-bold uppercase leading-relaxed italic">O sistema ajusta automaticamente o tamanho das fontes e a quantidade de itens visíveis conforme o formato selecionado.</p>
        </div>
      </div>

      {/* Área de Preview e Download */}
      <div className="lg:col-span-8 space-y-6">
        <div className="flex items-center justify-between px-2">
           <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">Pré-visualização de Download</h3>
           <div className="flex gap-2">
              <Button onClick={() => handleDownload('png')} disabled={isGenerating || selectedEvents.length === 0} className="rounded-xl h-11 px-6 font-black uppercase italic text-xs bg-primary text-white gap-2 shadow-lg">
                 {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Baixar PNG
              </Button>
           </div>
        </div>

        <Card className="border-none shadow-2xl rounded-[3rem] bg-[#e2e8f0] overflow-hidden p-10 flex justify-center items-center min-h-[800px] relative">
           {isGenerating && (
             <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-secondary" />
                <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Processando Canvas...</p>
             </div>
           )}

           <div className={cn(
             "shadow-[0_40px_100px_rgba(0,0,0,0.3)] bg-white origin-top transition-all duration-500",
             format === 'stories' ? "scale-[0.35]" : format === 'instagram' ? "scale-[0.45]" : "scale-[0.3]"
           )}>
              <div ref={renderRef}>
                 <AgendaTemplate 
                    events={selectedEvents} 
                    format={format} 
                    theme={theme} 
                    logoBase64={logoBase64}
                 />
              </div>
           </div>

           {selectedEvents.length === 0 && (
             <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 gap-4">
                <ImageIcon className="w-16 h-16" />
                <p className="font-black uppercase tracking-[0.4em] text-sm">Selecione eventos para visualizar</p>
             </div>
           )}
        </Card>
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
