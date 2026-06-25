'use client';

import * as React from 'react';
import { useFirestore, useDoc, useAuth, useUser, useCollection, useMemoFirebase } from '@/firebase';
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
  Smartphone, 
  RefreshCw,
  Palette,
  FileDown,
  X,
  Trophy,
  ChevronRight,
  Info,
  Eye,
  Camera,
  Send,
  CheckCircle2,
  Monitor,
  Flame
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { StoryTemplate } from '@/components/images/StoryTemplate';
import { toPng } from 'html-to-image';
import { cn, normalizeText } from '@/lib/utils';
import { fetchImageAsBase64 } from '@/app/actions/image-proxy';
import { sendAgendaRequestAction } from '@/app/actions/email';
import { useIsMobile } from '@/hooks/use-mobile';
import { auditAndPrepareImages, triggerVisualProofDownload, resolveNextOccurrence, formatTemplateDate } from '@/lib/image-generator-utils';
import { startOfToday, addDays, format } from "date-fns";

const COPA_LOGO = "https://firebasestorage.googleapis.com/v0/b/vibyeventos.firebasestorage.app/o/admin%2Fsite%2Fvibybrasil.png?alt=media&token=";

export default function StoriesGeneratorPage() {
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser(auth);
  const isMobile = useIsMobile();

  const [searchTerm, setSearchTerm] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = React.useState<any | null>(null);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isSendingEmail, setIsSendingEmail] = React.useState(false);
  
  const [theme, setTheme] = React.useState<'viby' | 'claro' | 'escuro' | 'copa' | 'pride' | 'junina' | 'junina_noite'>('viby');

  const settingsRef = React.useMemo(() => db ? doc(db, "settings", "site") : null, [db]);
  const { data: settings } = useDoc<any>(settingsRef);
  
  const [logoBase64, setLogoBase64] = React.useState<string | null>(null);
  const [copaLogoBase64, setCopaLogoBase64] = React.useState<string | null>(null);

  const [isMobileCapturing, setIsMobileCapturing] = React.useState(false);
  const hiddenRenderRef = React.useRef<HTMLDivElement>(null);

  const occurrencesQuery = useMemoFirebase(() => {
    if (!db) return null;
    const yesterdayStr = format(addDays(startOfToday(), -1), 'yyyy-MM-dd');
    return query(collection(db, "recurring_occurrences"), where("status", "==", "active"), where("date", ">=", yesterdayStr));
  }, [db]);
  const { data: allOccurrences } = useCollection<any>(occurrencesQuery);

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
        limit(200)
      );
      const snap = await getDocs(q);
      const searchNorm = normalizeText(searchTerm);
      const now = new Date();
      
      const results = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .map(ev => {
           const schedule = resolveNextOccurrence(ev, allOccurrences, now);
           const included = !!schedule;
           
           if (!included) return null;

           return { 
             ...ev, 
             date: schedule.nextDate, 
             _additionalCount: schedule.additionalCount 
           };
        })
        .filter(ev => {
          if (!ev) return false;
          const title = normalizeText(ev.title || "");
          const tags = (ev.tags || []).map(t => normalizeText(t));
          return (title.includes(searchNorm) || tags.some(t => t.includes(searchNorm))) && ev.id !== selectedEvent?.id;
        });
      setSearchResults(results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } catch (e) {
      toast({ variant: "destructive", title: "Erro na busca" });
    } finally {
      setIsSearching(false);
    }
  };

  const selectEvent = async (event: any) => {
    setIsSearching(true);
    const imgRes = await fetchImageAsBase64(event.image);
    setSelectedEvent({
      ...event,
      image: imgRes.success ? imgRes.data : event.image
    });
    setSearchResults([]);
    setSearchTerm("");
    setIsSearching(false);
  };

  const captureSingleAsBase64 = async () => {
    if (!hiddenRenderRef.current || !selectedEvent) return null;
    
    setIsMobileCapturing(true);
    await new Promise(r => setTimeout(r, 1000));

    if (document.fonts) await document.fonts.ready;

    const node = hiddenRenderRef.current.querySelector('.viby-export-page') as HTMLElement;
    if (!node) return null;

    await auditAndPrepareImages(node);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const result = await toPng(node, {
      pixelRatio: 2,
      cacheBust: true,
      quality: 1,
      width: 1080,
      height: 1920,
      skipFonts: false
    });

    setIsMobileCapturing(false);
    return result;
  };

  const handleDownload = async () => {
    if (!selectedEvent || isGenerating) return;
    setIsGenerating(true);
    
    try {
      const dataUrl = await captureSingleAsBase64();
      if (!dataUrl) throw new Error("Falha ao gerar PNG.");

      await triggerVisualProofDownload(dataUrl, `final-export-story-${selectedEvent.id}.png`);
      toast({ title: "Story gerado com sucesso!" });
    } catch (err) {
      toast({ variant: "destructive", title: "Erro na exportação" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendToViby = async () => {
    if (!selectedEvent || !user || isSendingEmail) return;
    setIsSendingEmail(true);
    try {
      const base64 = await captureSingleAsBase64();
      if (!base64) throw new Error("Falha na captura gráfica.");

      const res = await sendAgendaRequestAction({
        images: [base64],
        theme,
        format: 'stories',
        userEmail: user.email!,
        userName: user.displayName || "Admin"
      });

      if (res.success) toast({ title: "Arte enviada para seu e-mail!" });
      else throw new Error(res.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro no envio", description: e.message });
    } finally {
      setIsSendingEmail(false);
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
         {(isMobileCapturing || !isMobile) && selectedEvent && (
           <StoryTemplate 
              event={selectedEvent} 
              theme={theme} 
              logoUrl={activeLogo || undefined}
           />
         )}
      </div>

      <div className="lg:col-span-4 space-y-8">
        <Card className="border-none shadow-sm rounded-[2rem] bg-white">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter">1. Seleção do Evento</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase">Busque por eventos futuros ativos.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-6">
            {!selectedEvent ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                    <Input 
                      placeholder="Nome ou tag..." 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      className="pl-10 h-11 rounded-xl"
                    />
                  </div>
                  <Button onClick={handleSearch} disabled={isSearching} className="h-11 px-4 rounded-xl font-bold bg-secondary text-white">{isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}</Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="p-2 bg-muted/20 rounded-2xl border border-dashed animate-in slide-in-from-top-2">
                    {searchResults.map(ev => (
                      <button
                        key={ev.id}
                        onClick={() => selectEvent(ev)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-white rounded-xl text-left transition-all group"
                      >
                        <img src={ev.image} className="h-10 w-10 rounded-lg object-cover" alt="" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate uppercase">{ev.title}</p>
                          <p className="text-[9px] font-black text-secondary uppercase">{formatTemplateDate(ev.date)}</p>
                        </div>
                        <Plus className="w-4 h-4 text-secondary opacity-0 group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-center justify-between animate-in zoom-in-95">
                <div className="flex items-center gap-3">
                  <img src={selectedEvent.image} className="h-12 w-12 rounded-xl object-cover shadow-sm" alt="" />
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase italic text-primary truncate max-w-[150px]">{selectedEvent.title}</p>
                    <p className="text-[9px] font-black text-secondary uppercase">{formatTemplateDate(selectedEvent.date)}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="p-2 text-muted-foreground hover:text-destructive transition-colors"><X className="w-4 h-4" /></button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] bg-white">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-xl font-black italic uppercase tracking-tighter">2. Personalização</CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-6">
             <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase opacity-60 flex items-center gap-2"><Palette className="w-3.5 h-3.5" /> Tema Visual</Label>
                <Select value={theme} onValueChange={(v:any) => setTheme(v)}>
                   <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                   <SelectContent className="rounded-xl">
                      <SelectItem value="viby">Viby (Padrão)</SelectItem>
                      <SelectItem value="copa">Copa do Mundo 2026</SelectItem>
                      <SelectItem value="pride">Pride / Diversidade</SelectItem>
                      <SelectItem value="junina">Festa Junina (Imersivo)</SelectItem>
                      <SelectItem value="junina_noite">Arraiá Noite (Fogueira)</SelectItem>
                      <SelectItem value="claro">Minimalista Claro</SelectItem>
                      <SelectItem value="escuro">Deep Black</SelectItem>
                   </SelectContent>
                </Select>
             </div>
             
             <div className="p-4 bg-muted/30 rounded-xl flex gap-3">
               <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
               <p className="text-[9px] text-muted-foreground font-medium uppercase leading-relaxed">O sistema identifica automaticamente a próxima data válida se o evento for recorrente.</p>
             </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-8 space-y-6">
        <div className="flex items-center justify-between px-2">
           <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2"><Eye className="w-4 h-4" /> Preview do Story</h3>
           <div className="flex gap-2">
              <Button 
                onClick={handleSendToViby} 
                disabled={isSendingEmail || !selectedEvent} 
                variant="outline"
                className="rounded-xl h-11 px-6 font-black uppercase italic text-xs gap-2 border-secondary text-secondary"
              >
                 {isSendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} 
                 Enviar p/ E-mail
              </Button>
              <Button onClick={handleDownload} disabled={isGenerating || !selectedEvent} className="rounded-xl h-11 px-8 font-black uppercase italic text-xs bg-primary text-white gap-2 shadow-lg">
                 {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} 
                 Baixar PNG
              </Button>
           </div>
        </div>

        <div className="relative bg-[#e2e8f0] rounded-[3rem] p-10 min-h-[800px] flex flex-col items-center justify-center overflow-hidden">
           {(isGenerating || isSendingEmail) && (
             <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-4 text-center">
                <Loader2 className="w-12 h-12 animate-spin text-secondary" />
                <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Codificando Story...</p>
             </div>
           )}

           {!selectedEvent ? (
             <div className="text-center opacity-20 space-y-4">
               <Smartphone className="w-20 h-20 mx-auto" />
               <p className="text-sm font-black uppercase italic">Selecione um evento para visualizar</p>
             </div>
           ) : isMobile ? (
              <Card className="border-none shadow-sm rounded-3xl bg-white p-8 text-center space-y-4 max-w-sm">
                <div className="p-4 bg-secondary/10 rounded-2xl w-fit mx-auto text-secondary"><Monitor className="w-8 h-8" /></div>
                <div className="space-y-1">
                    <h3 className="font-black uppercase italic text-primary">Prévia Otimizada</h3>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase leading-tight">O story será renderizado em alta resolução no momento da exportação.</p>
                </div>
                <Badge variant="outline" className="text-[8px] font-black uppercase">Pronto para exportar</Badge>
              </Card>
           ) : (
             <div className="scale-[0.35] md:scale-[0.4] origin-center shadow-[0_40px_100px_rgba(0,0,0,0.3)] bg-white">
                <StoryTemplate 
                  event={selectedEvent} 
                  theme={theme} 
                  logoUrl={activeLogo || undefined}
                />
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
