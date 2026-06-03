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
  ArrowRight,
  Map as MapIcon,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { LocationMap } from "./LocationMap"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getCoordinatesFromAddress } from "@/lib/location-utils"

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
  const [currentTime, setCurrentTime] = React.useState<Date>(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const formatFullAddress = (addr: any) => {
    if (!addr || Object.keys(addr).length === 0) return "Local Confirmado";
    const parts = [
      addr.street ? `${addr.street}${addr.number ? `, ${addr.number}` : ''}` : null,
      addr.neighborhood || addr.location,
      addr.city ? `${addr.city}${addr.state ? ` - ${addr.state}` : ''}` : null
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(" • ") : "Local Confirmado";
  };

  /**
   * Lógica para buscar coordenadas automaticamente quando o endereço é preenchido.
   */
  const triggerGeocoding = async (index: number, updatedAddr: any) => {
    const addressStr = `${updatedAddr.street}, ${updatedAddr.number}, ${updatedAddr.city}, ${updatedAddr.state}, Brasil`;
    const coords = await getCoordinatesFromAddress(addressStr);
    
    if (coords) {
      if (isMultiLocation) {
        const newLocs = [...locations];
        newLocs[index] = { ...updatedAddr, ...coords };
        onLocationsChange?.(newLocs);
      } else {
        onChange?.({ ...updatedAddr, ...coords });
      }
    }
  };

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

        // Após preencher a rua via CEP, tenta buscar a coordenada
        await triggerGeocoding(index, updated);
      }
    } catch (e) {
      console.warn("Erro ao buscar CEP");
    } finally {
      setIsSearching(null);
    }
  };

  const handleUpdateLocation = (index: number, field: string, value: any) => {
    let finalValue = value;
    
    if (field === 'latitude' || field === 'longitude') {
      if (typeof value === 'string') {
        finalValue = value === "" ? 0 : parseFloat(value);
        if (isNaN(finalValue)) return;
      }
    }

    if (isMultiLocation) {
      const newLocs = [...locations];
      newLocs[index] = { ...newLocs[index], [field]: finalValue };
      onLocationsChange?.(newLocs);
      
      // Se mudar o número, tenta re-geocodificar para maior precisão
      if (field === 'number' && finalValue) {
        triggerGeocoding(index, newLocs[index]);
      }
    } else {
      const updated = { ...address, [field]: finalValue };
      onChange?.(updated);
      
      if (field === 'number' && finalValue) {
        triggerGeocoding(index, updated);
      }
    }
  };

  const handleCoordsChange = (index: number, lat: number, lng: number) => {
    if (isMultiLocation) {
      const newLocs = [...locations];
      newLocs[index] = { ...newLocs[index], latitude: lat, longitude: lng };
      onLocationsChange?.(newLocs);
    } else {
      onChange?.({ ...address, latitude: lat, longitude: lng });
    }
  };

  if (isPublic) {
    const sortedLocs = [...locations].sort((a, b) => a.order - b.order);
    
    const renderLocationBlock = (loc: any, isCurrent: boolean, isNext: boolean) => {
      const currentAddrObj = isMultiLocation ? loc : address;
      const addrString = formatFullAddress(currentAddrObj);
      
      const lat = isMultiLocation ? loc.latitude : address?.latitude || -23.55052;
      const lng = isMultiLocation ? loc.longitude : address?.longitude || -46.633308;
      
      const titleFallback = address?.neighborhood || address?.city || "Local do Evento";
      const title = isMultiLocation ? (loc.title || "Ponto de Encontro") : titleFallback;

      return (
        <Card key={loc?.id || 'single'} className={cn(
          "border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden transition-all",
          (!isCurrent && isMultiLocation) && "opacity-60 bg-muted/30"
        )}>
          <div className="h-64 w-full">
            <LocationMap latitude={lat} longitude={lng} interactive={false} onChange={() => {}} />
          </div>
          <CardContent className="p-8 space-y-6">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                   {isMultiLocation && (
                     <div className="flex gap-2 mb-2">
                        {isCurrent ? (
                          <Badge className="bg-green-600 text-white border-none text-[9px] font-black uppercase px-3 py-1 animate-pulse">
                             Acontecendo Agora
                          </Badge>
                        ) : isNext ? (
                          <Badge variant="outline" className="text-[9px] font-black uppercase px-3 py-1 border-dashed">
                             Próxima Parada
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[9px] font-black uppercase px-3 py-1 opacity-50">
                             Programação
                          </Badge>
                        )}
                     </div>
                   )}
                   <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary">
                     {title}
                   </h3>
                   <p className="text-sm font-medium text-muted-foreground leading-relaxed">{addrString}</p>
                   
                   {isMultiLocation && loc.startAt && (
                     <div className="flex items-center gap-2 mt-2 text-[10px] font-black uppercase text-secondary">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(loc.startAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} 
                        {loc.endAt && ` às ${new Date(loc.endAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                     </div>
                   )}
                </div>
                <Button asChild variant="outline" className="rounded-xl font-black uppercase italic text-[10px] gap-2 border-secondary text-secondary hover:bg-secondary hover:text-white transition-all">
                   <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addrString)}`} target="_blank">
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
            <MapIcon className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">
            {isMultiLocation ? "Itinerário do Evento" : "Localização"}
          </h2>
        </div>

        <div className="space-y-8">
           {isMultiLocation ? (
             sortedLocs.map((loc, idx) => {
                const start = loc.startAt ? new Date(loc.startAt) : null;
                const end = loc.endAt ? new Date(loc.endAt) : null;
                const isCurrent = start && end && currentTime >= start && currentTime <= end;
                const isNext = start && currentTime < start && (!sortedLocs[idx-1] || (sortedLocs[idx-1].endAt && currentTime > new Date(sortedLocs[idx-1].endAt)));
                
                return renderLocationBlock(loc, !!isCurrent, !!isNext);
             })
           ) : renderLocationBlock(null, true, false)}
        </div>
      </div>
    );
  }

  const renderLocationForm = (loc: any, index: number, isMulti: boolean) => {
    const currentLoc = isMulti ? loc : address;

    return (
      <div key={isMulti ? loc.id : 'single'} className={cn("space-y-6 p-8 rounded-[2rem] border-2 border-dashed bg-white", isMulti ? "border-secondary/20" : "border-border/60")}>
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
             <Button 
               variant="ghost" 
               size="icon" 
               className="text-destructive hover:bg-red-50 rounded-full"
               onClick={() => {
                 const newList = locations.filter((_, i) => i !== index);
                 onLocationsChange?.(newList);
               }}
             >
                <X className="w-5 h-5" />
             </Button>
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
                    placeholder="Ex: Praça da Matriz"
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
                 <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">UF</Label><Input value={currentLoc.state || ""} readOnly className="rounded-xl h-11 bg-muted/30 w-16" /></div>
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
                </div>
              )}
           </div>

           <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase opacity-60 flex justify-between items-center">
                 Ajuste do Pin no Mapa
                 <span className="text-[8px] opacity-40">Arraste para precisão total</span>
              </Label>
              <div className="h-[280px] w-full rounded-2xl overflow-hidden border-2 border-muted relative">
                 <LocationMap 
                    latitude={currentLoc.latitude || -23.55052} 
                    longitude={currentLoc.longitude || -46.633308} 
                    onChange={(lat, lng) => handleCoordsChange(index, lat, lng)} 
                    interactive={true}
                 />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                    <Label className="text-[8px] font-black uppercase opacity-40">Latitude</Label>
                    <Input 
                      type="number" 
                      step="any"
                      value={currentLoc.latitude || ""} 
                      onChange={e => handleUpdateLocation(index, 'latitude', e.target.value)}
                      className="h-9 text-[11px] font-mono rounded-xl bg-muted/20"
                    />
                 </div>
                 <div className="space-y-1">
                    <Label className="text-[8px] font-black uppercase opacity-40">Longitude</Label>
                    <Input 
                      type="number" 
                      step="any"
                      value={currentLoc.longitude || ""} 
                      onChange={e => handleUpdateLocation(index, 'longitude', e.target.value)}
                      className="h-9 text-[11px] font-mono rounded-xl bg-muted/20"
                    />
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <Card className="border-none shadow-sm rounded-[2rem] bg-muted/30 overflow-hidden">
        <CardContent className="p-8">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-white rounded-2xl shadow-sm text-secondary">
                    <MapIcon className="w-6 h-6" />
                 </div>
                 <div>
                    <h2 className="text-xl font-black uppercase italic tracking-tighter">Itinerário e Logística</h2>
                    <p className="text-xs font-medium text-muted-foreground">O evento possui mais de um local ou é itinerante?</p>
                 </div>
              </div>
              <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl shadow-sm border border-border/40">
                 <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                         <div className="flex items-center gap-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest cursor-help">Múltiplos Locais?</Label>
                            <Switch 
                               checked={isMultiLocation} 
                               onCheckedChange={(val) => {
                                  onToggleMultiLocation?.(val);
                                  if (val && locations.length === 0) {
                                     const L1 = { ...DEFAULT_LOCATION, ...address, id: "loc_1", order: 0 };
                                     const L2 = { ...DEFAULT_LOCATION, id: "loc_2", order: 1 };
                                     onLocationsChange?.([L1, L2]);
                                  }
                               }} 
                            />
                         </div>
                      </TooltipTrigger>
                      <TooltipContent className="rounded-xl p-3 max-w-xs shadow-2xl border-none">
                         <p className="text-[10px] font-bold uppercase leading-relaxed">
                            Ative para eventos que mudam de lugar (ex: Trios elétricos, paradas, tours). 
                            O público verá qual local é o atual baseando-se no horário.
                         </p>
                      </TooltipContent>
                    </Tooltip>
                 </TooltipProvider>
              </div>
           </div>
        </CardContent>
      </Card>

      <div className="space-y-8">
         {isMultiLocation ? (
           <>
              {locations.map((loc, idx) => renderLocationForm(loc, idx, true))}
              <Button 
                type="button" 
                variant="outline" 
                className="w-full h-14 rounded-2xl border-2 border-dashed border-secondary/30 text-secondary font-black uppercase text-[10px] gap-2 hover:bg-secondary/5"
                onClick={() => {
                  const newLoc = { ...DEFAULT_LOCATION, id: `loc_${Date.now()}`, order: locations.length };
                  onLocationsChange?.([...locations, newLoc]);
                }}
              >
                <Plus className="w-4 h-4" /> Adicionar Parada no Itinerário
              </Button>
           </>
         ) : renderLocationForm(null, 0, false)}
      </div>

      <div className="p-6 bg-secondary/5 rounded-3xl border border-secondary/10 flex items-start gap-4">
         <Zap className="w-6 h-6 text-secondary shrink-0 mt-0.5" />
         <div className="space-y-1">
            <h4 className="font-black uppercase text-secondary">Mapa Inteligente Ativo</h4>
            <p className="text-[10px] text-muted-foreground font-medium uppercase leading-relaxed">
               O Viby exibirá para o público o local correto baseando-se no horário da programação. Certifique-se de que os horários de cada parada estão corretos.
            </p>
         </div>
      </div>
    </div>
  )
}
