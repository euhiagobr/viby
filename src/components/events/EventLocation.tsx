
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
  Globe, 
  Map as MapIcon,
  X,
  Plus,
  CheckCircle2,
  Building2,
  Locate
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
import { 
  getCoordinatesFromAddress, 
  searchGlobalAddresses, 
  mapNominatimToAddress,
  AddressComponents 
} from "@/lib/location-utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const COUNTRIES = [
  { code: 'BR', name: 'Brasil', postalLabel: 'CEP' },
  { code: 'US', name: 'Estados Unidos', postalLabel: 'ZIP Code' },
  { code: 'CA', name: 'Canadá', postalLabel: 'Postal Code' },
  { code: 'PT', name: 'Portugal', postalLabel: 'Código Postal' },
  { code: 'ES', name: 'Espanha', postalLabel: 'Código Postal' },
  { code: 'DE', name: 'Alemanha', postalLabel: 'Postleitzahl' },
  { code: 'FR', name: 'França', postalLabel: 'Code Postal' },
  { code: 'IT', name: 'Itália', postalLabel: 'Codice Postale' },
  { code: 'GB', name: 'Reino Unido', postalLabel: 'Postcode' },
  { code: 'AR', name: 'Argentina', postalLabel: 'Código Postal' },
  { code: 'CL', name: 'Chile', postalLabel: 'Código Postal' },
  { code: 'MX', name: 'México', postalLabel: 'Código Postal' },
];

interface EventLocationProps {
  address: Partial<AddressComponents>
  onChange?: (address: any) => void
  isPublic?: boolean
  className?: string
}

export function EventLocation({ address, onChange, isPublic, className }: EventLocationProps) {
  const [isSearching, setIsSearching] = React.useState(false);
  const [globalSearch, setGlobalSearch] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  const postalLabel = React.useMemo(() => {
    const country = COUNTRIES.find(c => c.code === address?.countryCode || c.name === address?.country);
    return country?.postalLabel || "Postal Code";
  }, [address?.countryCode, address?.country]);

  const handleGlobalSearch = async () => {
    if (!globalSearch || globalSearch.length < 3) return;
    setIsSearching(true);
    const results = await searchGlobalAddresses(globalSearch);
    setSuggestions(results);
    setShowSuggestions(true);
    setIsSearching(false);
  };

  const selectSuggestion = (data: any) => {
    const mapped = mapNominatimToAddress(data);
    onChange?.({ ...address, ...mapped });
    setShowSuggestions(false);
    setGlobalSearch("");
  };

  const handleCepBlur = async () => {
    if (address?.countryCode !== 'BR' && address?.country !== 'Brasil') return;
    const cep = address?.postalCode?.replace(/\D/g, "");
    if (!cep || cep.length !== 8) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        const updated = {
          ...address,
          street: data.logradouro || address.street,
          neighborhood: data.bairro || address.neighborhood,
          city: data.localidade || address.city,
          state: data.uf || address.state,
          country: "Brasil",
          countryCode: "BR"
        };
        
        const searchStr = `${updated.street}, ${updated.city}, BR`;
        const coords = await getCoordinatesFromAddress(searchStr);
        onChange?.({ ...updated, ...coords });
      }
    } catch (e) {
      console.warn("[Location] Falha no ViaCEP");
    } finally {
      setIsSearching(false);
    }
  };

  if (isPublic) {
    const addrString = address?.formattedAddress || 
      `${address?.street || ''}${address?.number ? `, ${address?.number}` : ''} - ${address?.neighborhood || ''} ${address?.city || ''} ${address?.state || ''}`;

    return (
      <div className={cn("space-y-10", className)}>
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
            <MapIcon className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Localização</h2>
        </div>

        <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
          <div className="h-64 w-full">
            <LocationMap 
              latitude={address?.latitude || -23.55052} 
              longitude={address?.longitude || -46.633308} 
              interactive={false} 
              onChange={() => {}} 
            />
          </div>
          <CardContent className="p-8 space-y-6">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                   <h3 className="text-xl font-black uppercase italic tracking-tighter text-primary">
                     {address?.venueName || "Local do Evento"}
                   </h3>
                   <p className="text-sm font-medium text-muted-foreground leading-relaxed">{addrString}</p>
                </div>
                <div className="flex gap-2">
                   <Button asChild variant="outline" className="rounded-xl font-black uppercase italic text-[10px] gap-2 border-secondary text-secondary">
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addrString)}`} target="_blank">
                         <Navigation className="w-4 h-4" /> GPS
                      </a>
                   </Button>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("space-y-8", className)}>
      <Card className="border-none shadow-sm rounded-[2.5rem] bg-muted/30 overflow-hidden">
        <CardContent className="p-8 space-y-8">
           <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                <Globe className="w-3.5 h-3.5" /> Busca Global de Endereços
              </Label>
              <div className="flex gap-2">
                 <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Nome do local, arena, estádio ou endereço..." 
                      value={globalSearch}
                      onChange={e => setGlobalSearch(e.target.value)}
                      className="pl-10 h-12 rounded-xl border-dashed border-secondary/30"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleGlobalSearch())}
                    />
                 </div>
                 <Button type="button" onClick={handleGlobalSearch} disabled={isSearching} className="h-12 rounded-xl px-6 bg-secondary text-white font-bold">
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
                 </Button>
              </div>

              {showSuggestions && suggestions.length > 0 && (
                <div className="p-2 bg-white rounded-2xl border shadow-xl animate-in slide-in-from-top-2">
                   {suggestions.map((s, i) => (
                     <button
                       key={i}
                       type="button"
                       onClick={() => selectSuggestion(s)}
                       className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 rounded-xl text-left transition-colors group"
                     >
                        <MapPin className="w-4 h-4 text-secondary opacity-40 group-hover:opacity-100" />
                        <div className="flex-1 min-w-0">
                           <p className="text-xs font-bold truncate">{s.display_name}</p>
                           <p className="text-[9px] text-muted-foreground uppercase font-black">{s.type || 'local'}</p>
                        </div>
                     </button>
                   ))}
                </div>
              )}
           </div>

           <Separator className="border-dashed" />

           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">País</Label>
                       <Select 
                        value={address?.countryCode || ""} 
                        onValueChange={val => onChange?.({ ...address, countryCode: val, country: COUNTRIES.find(c => c.code === val)?.name })}
                       >
                          <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                             {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">{postalLabel}</Label>
                       <Input 
                         value={address?.postalCode || ""} 
                         onChange={e => onChange?.({ ...address, postalCode: e.target.value })} 
                         onBlur={handleCepBlur}
                         className="rounded-xl h-11" 
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Nome do Local (Venue)</Label>
                    <div className="relative">
                       <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                       <Input value={address?.venueName || ""} onChange={e => onChange?.({ ...address, venueName: e.target.value })} placeholder="Ex: Madison Square Garden" className="pl-10 rounded-xl h-11" />
                    </div>
                 </div>

                 <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-3 space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Logradouro / Rua</Label>
                       <Input value={address?.street || ""} onChange={e => onChange?.({ ...address, street: e.target.value })} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Nº</Label>
                       <Input value={address?.number || ""} onChange={e => onChange?.({ ...address, number: e.target.value })} className="rounded-xl h-11" />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Bairro / Neighborhood</Label><Input value={address?.neighborhood || ""} onChange={e => onChange?.({ ...address, neighborhood: e.target.value })} className="rounded-xl h-11" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Cidade / City</Label><Input value={address?.city || ""} onChange={e => onChange?.({ ...address, city: e.target.value })} className="rounded-xl h-11" /></div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Estado / Região</Label><Input value={address?.state || ""} onChange={e => onChange?.({ ...address, state: e.target.value })} className="rounded-xl h-11" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Complemento</Label><Input value={address?.complement || ""} onChange={e => onChange?.({ ...address, complement: e.target.value })} className="rounded-xl h-11" /></div>
                 </div>
              </div>

              <div className="space-y-4">
                 <Label className="text-[10px] font-black uppercase opacity-60 flex justify-between items-center">
                    Confirmação de Localização (PIN)
                    <span className="text-[8px] opacity-40">Arraste para ajustar</span>
                 </Label>
                 <div className="h-[350px] w-full rounded-[2rem] overflow-hidden border-2 border-muted shadow-inner relative group/map">
                    <LocationMap 
                      latitude={address?.latitude || -23.55052} 
                      longitude={address?.longitude || -46.633308} 
                      onChange={(lat, lng) => onChange?.({ ...address, latitude: lat, longitude: lng })}
                      interactive={true}
                    />
                    <div className="absolute top-4 left-4 z-10 opacity-0 group-hover/map:opacity-100 transition-opacity">
                       <Badge className="bg-white/90 text-primary border-none shadow-lg text-[9px] font-black uppercase">
                          Lat: {address?.latitude?.toFixed(4)} | Lng: {address?.longitude?.toFixed(4)}
                       </Badge>
                    </div>
                 </div>
                 <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
                    <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                    <p className="text-[10px] text-secondary font-bold uppercase leading-tight italic">O posicionamento exato no mapa é fundamental para o sistema de recomendação de proximidade.</p>
                 </div>
              </div>
           </div>
        </CardContent>
      </Card>
    </div>
  )
}
