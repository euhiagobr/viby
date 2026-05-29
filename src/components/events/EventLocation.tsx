
"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { 
  MapPin, 
  Navigation, 
  Clock, 
  Search, 
  Loader2, 
  AlertCircle, 
  Zap, 
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { LocationMap } from "./LocationMap"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Location {
  id: string
  title?: string
  cep: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  country: string
  latitude: number
  longitude: number
  startAt: string
  endAt: string
  order: number
}

interface EventLocationProps {
  address: any // Legacy
  locations?: Location[]
  isMultiLocation?: boolean
  onChange?: (address: any) => void
  onLocationsChange?: (locations: Location[]) => void
  onToggleMultiLocation?: (val: boolean) => void
  isPublic?: boolean
}

const DEFAULT_LOCATION: Location = {
  id: "loc_1",
  title: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  country: "Brasil",
  latitude: -23.55052,
  longitude: -46.633308,
  startAt: "",
  endAt: "",
  order: 0
};

export function EventLocation({ 
  address, 
  locations = [], 
  isMultiLocation = false,
  onChange, 
  onLocationsChange,
  onToggleMultiLocation,
  isPublic 
}: EventLocationProps) {
  const [isSearching, setIsSearching] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<Date>(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setActiveTab(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleCepBlur = async (index: number) => {
    const target = isMultiLocation ? locations[index] : { ...address };
    const cep = target.cep?.replace(/\D/g, "");
    
    if (!cep || cep.length !== 8) return;
    
    setIsSearching(isMultiLocation ? target.id : 'legacy');
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        const updated = {
          ...target,
          street: data.logradouro || target.street,
          neighborhood: data.bairro || target.neighborhood,
          city: data.localidade || target.city,
          state: data.uf || target.state
        };

        // Geocoding reverso simplificado ou manual para o protótipo
        // Em um sistema real, aqui chamaria Google Maps Geocoding API
        
        if (isMultiLocation) {
          const newLocs = [...locations];
          newLocs[index] = updated as Location;
          onLocationsChange?.(newLocs);
        } else {
          onChange?.(updated);
        }
      }
    } catch (e) {
      console.warn("Erro ao buscar CEP");
    } finally {
      setIsSearching(null);
    }
  };

  const handleUpdateLocation = (index: number, field: string, value: any) => {
    if (isMultiLocation) {
      const newLocs = [...locations];
      newLocs[index] = { ...newLocs[index], [field]: value };
      onLocationsChange?.(newLocs);
    } else {
      onChange?.({ ...address, [field]: value });
    }
  };

  const handleCoordsChange = (index: number, lat: number, lng: number) => {
    handleUpdateLocation(index, 'latitude', lat);
    handleUpdateLocation(index, 'longitude', lng);
  };

  if (isPublic) {
    const now = new Date();
    
    // Lógica de Localização Ativa para modo multi-local
    const sortedLocs = [...locations].sort((a, b) => a.order - b.order);
    
    const activeLoc = isMultiLocation ? sortedLocs.find(loc => {
      const start = new Date(loc.startAt);
      const end = new Date(loc.endAt);
      return now >= start && now <= end;
    }) || sortedLocs[0] : null;

    const nextLoc = isMultiLocation ? sortedLocs.find(loc => new Date(loc.startAt) > now) : null;

    const renderLocationBlock = (loc: any, isMain: boolean = true) => {
      const addr = isMultiLocation ? `${loc.street}, ${loc.number} - ${loc.neighborhood}, ${loc.city}` : `${address.street}, ${address.number} - ${address.neighborhood}, ${address.city}`;
      const lat = isMultiLocation ? loc.latitude : address.latitude || -23.55052;
      const lng = isMultiLocation ? loc.longitude : address.longitude || -46.633308;

      return (
        <Card className={cn(
          "border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden",
          !isMain && "opacity-60 bg-muted/30"
        )}>
          <div className="h-64 w-full">
            <LocationMap latitude={lat} longitude={lng} interactive={false} onChange={() => {}} />
          </div>
          <CardContent className="p-8 space-y-6">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                   {isMain ? (
                     <Badge className="bg-green-600 text-white border-none text-[9px] font-black uppercase px-3 py-1 mb-2 animate-pulse">
                        Acontecendo agora em:
                     </Badge>
                   ) : (
                     <Badge variant="outline" className="text-[9px] font-black uppercase px-3 py-1 mb-2 border-dashed">
                        Próxima parada:
                     </Badge>
                   )}
                   <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary">
                     {isMultiLocation ? (loc.title || "Local do Evento") : (address.neighborhood || "Local Confirmado")}
                   </h3>
                   <p className="text-sm font-medium text-muted-foreground leading-relaxed">{addr}</p>
                   {isMultiLocation && (
                     <div className="flex items-center gap-2 mt-2 text-[10px] font-black uppercase text-secondary">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(loc.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} até {new Date(loc.endAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                     </div>
                   )}
                </div>
                <Button asChild variant="outline" className="rounded-xl font-black uppercase italic text-[10px] gap-2 border-secondary text-secondary">
                   <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`} target="_blank">
                      <Navigation className="w-4 h-4 fill-current" /> Abrir GPS
                   </a>
                </Button>
             </div>
          </CardContent>
        </Card>
      );
    };

    return (
      <div className="space-y-10">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
            <MapPin className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Itinerário / Localização</h2>
        </div>

        <div className="space-y-8">
           {isMultiLocation ? (
             <>
                {activeLoc && renderLocationBlock(activeLoc, true)}
                {nextLoc && (
                  <div className="space-y-6">
                    <Separator className="border-dashed" />
                    {renderLocationBlock(nextLoc, false)}
                  </div>
                )}
             </>
           ) : renderLocationBlock(null, true)}
        </div>
      </div>
    );
  }

  const renderLocationForm = (loc: any, index: number, isMulti: boolean) => {
    const isL1 = index === 0;
    const isL2 = index === 1;
    const currentLoc = isMulti ? loc : address;

    return (
      <div className={cn("space-y-6 p-8 rounded-[2rem] border-2 border-dashed bg-white", isMulti ? "border-secondary/20" : "border-border/60")}>
        <div className="flex items-center justify-between mb-4">
           <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-black italic", isMulti ? "bg-secondary text-white" : "bg-primary text-white")}>
                {isMulti ? `L${index + 1}` : <MapPin className="w-5 h-5" />}
              </div>
              <h3 className="text-lg font-black uppercase italic tracking-tighter text-primary">
                {isMulti ? `Localização ${index + 1}` : "Endereço Principal"}
              </h3>
           </div>
           {isMulti && (
             <Badge variant="outline" className="text-[9px] font-black uppercase h-6 px-3">Configuração Individual</Badge>
           )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
           <div className="space-y-6">
              {isMulti && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-60">Nome do Local (Opcional)</Label>
                  <Input 
                    value={currentLoc.title || ""} 
                    onChange={e => handleUpdateLocation(index, 'title', e.target.value)}
                    placeholder="Ex: Praça da Redenção"
                    className="rounded-xl h-11"
                  />
                </div>
              )}

              <div className="grid grid-cols-4 gap-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">CEP</Label>
                    <div className="relative">
                      <Input 
                        value={currentLoc.cep || ""} 
                        onChange={e => handleUpdateLocation(index, 'cep', e.target.value)} 
                        onBlur={() => handleCepBlur(index)}
                        placeholder="00000-000" 
                        className="rounded-xl h-11 pl-8" 
                      />
                      <Search className={cn("absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-30", isSearching === (isMulti ? currentLoc.id : 'legacy') && "animate-spin")} />
                    </div>
                 </div>
                 <div className="col-span-3 space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Logradouro / Rua</Label>
                    <Input value={currentLoc.street || ""} onChange={e => handleUpdateLocation(index, 'street', e.target.value)} required className="rounded-xl h-11" />
                 </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Nº</Label><Input value={currentLoc.number || ""} onChange={e => handleUpdateLocation(index, 'number', e.target.value)} required className="rounded-xl h-11" /></div>
                 <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Bairro</Label><Input value={currentLoc.neighborhood || ""} onChange={e => handleUpdateLocation(index, 'neighborhood', e.target.value)} required className="rounded-xl h-11" /></div>
                 <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Cidade</Label><Input value={currentLoc.city || ""} readOnly className="rounded-xl h-11 bg-muted/30" /></div>
                 <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">UF</Label><Input value={currentLoc.state || ""} readOnly className="rounded-xl h-11 bg-muted/30" /></div>
              </div>

              {isMulti && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/5 rounded-2xl border border-secondary/10">
                   <div className="space-y-2">
                      <Label className="text-[9px] font-black uppercase text-secondary">Início neste Local</Label>
                      <Input type="datetime-local" value={currentLoc.startAt} onChange={e => handleUpdateLocation(index, 'startAt', e.target.value)} required className="h-10 rounded-lg text-xs" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[9px] font-black uppercase text-secondary">Fim neste Local</Label>
                      <Input type="datetime-local" value={currentLoc.endAt} onChange={e => handleUpdateLocation(index, 'endAt', e.target.value)} required className="h-10 rounded-lg text-xs" />
                   </div>
                   {isL2 && locations[0]?.endAt && currentLoc.startAt && currentLoc.startAt < locations[0].endAt && (
                     <div className="col-span-2 flex items-center gap-2 text-[8px] font-black uppercase text-red-500 animate-in fade-in">
                        <AlertCircle className="w-3 h-3" /> Conflito de horários: Local 2 deve iniciar após o Local 1.
                     </div>
                   )}
                </div>
              )}
           </div>

           <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase opacity-60 flex justify-between items-center">
                 Ajuste Fino do Marcador (Pin)
                 <span className="text-[8px] opacity-40">Arraste o pin no mapa</span>
              </Label>
              <div className="h-[280px] w-full rounded-2xl overflow-hidden border-2 border-muted relative">
                 <LocationMap 
                    latitude={currentLoc.latitude || -23.55052} 
                    longitude={currentLoc.longitude || -46.633308} 
                    onChange={(lat, lng) => handleCoordsChange(index, lat, lng)} 
                    interactive={true}
                 />
              </div>
              <div className="grid grid-cols-2 gap-2">
                 <div className="p-2 bg-muted/30 rounded-lg text-center">
                    <p className="text-[8px] font-black uppercase opacity-40">Latitude</p>
                    <p className="text-[10px] font-mono">{currentLoc.latitude?.toFixed(6)}</p>
                 </div>
                 <div className="p-2 bg-muted/30 rounded-lg text-center">
                    <p className="text-[8px] font-black uppercase opacity-40">Longitude</p>
                    <p className="text-[10px] font-mono">{currentLoc.longitude?.toFixed(6)}</p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Card className="border-none shadow-sm rounded-[2rem] bg-muted/30 overflow-hidden">
        <CardContent className="p-8">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-white rounded-2xl shadow-sm text-secondary">
                    <Navigation className="w-6 h-6" />
                 </div>
                 <div>
                    <h2 className="text-xl font-black uppercase italic tracking-tighter">Logística do Evento</h2>
                    <p className="text-xs font-medium text-muted-foreground">Defina um ou mais locais para a experiência.</p>
                 </div>
              </div>
              <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl shadow-sm border border-border/40">
                 <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                         <div className="flex items-center gap-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest cursor-help">Dois locais?</Label>
                            <Switch 
                               checked={isMultiLocation} 
                               onCheckedChange={(val) => {
                                  onToggleMultiLocation?.(val);
                                  if (val && locations.length === 0) {
                                     // Migrar endereço principal para L1 e criar L2
                                     const L1 = { ...DEFAULT_LOCATION, ...address, id: "loc_1", order: 0 };
                                     const L2 = { ...DEFAULT_LOCATION, id: "loc_2", order: 1 };
                                     onLocationsChange?.([L1, L2]);
                                  }
                               }} 
                            />
                         </div>
                      </TooltipTrigger>
                      <TooltipContent className="rounded-xl p-3 max-w-xs">
                         <p className="text-[10px] font-bold uppercase leading-relaxed">Habilita um evento com dois locais e horários diferentes. Útil para desfiles, paradas ou eventos itinerantes.</p>
                      </TooltipContent>
                    </Tooltip>
                 </TooltipProvider>
              </div>
           </div>
        </CardContent>
      </Card>

      {isMultiLocation ? (
        <div className="space-y-8">
           {locations.map((loc, idx) => (
             <React.Fragment key={loc.id}>
                {renderLocationForm(loc, idx, true)}
             </React.Fragment>
           ))}
        </div>
      ) : renderLocationForm(null, 0, false)}

      <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4">
         <Zap className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
         <div className="space-y-1">
            <h4 className="font-black uppercase text-[10px] tracking-widest text-secondary">Geolocalização Inteligente</h4>
            <p className="text-[10px] text-muted-foreground font-medium leading-relaxed uppercase">
               O Viby exibirá automaticamente o mapa e endereço correto para o seu público de acordo com o horário da programação. Certifique-se de que os horários não se sobrepõem.
            </p>
         </div>
      </div>
    </div>
  )
}
