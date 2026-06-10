
"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { 
  MapPin, 
  Navigation, 
  Search, 
  Loader2, 
  Globe, 
  Map as MapIcon,
  X,
  Building2,
  AlertTriangle,
  Info,
  CheckCircle2,
  Edit3
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { 
  getCoordinatesFromAddress, 
  searchGlobalAddresses, 
  mapNominatimToAddress,
  reverseGeocode,
  AddressComponents 
} from "@/lib/location-utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import dynamic from "next/dynamic"

// Carregamento Client-Only para o Mapa para evitar ReferenceError: document is not defined durante SSR
const LocationMap = dynamic(() => import("./LocationMap").then(mod => mod.LocationMap), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center text-[10px] font-black uppercase opacity-20">Iniciando Mapa...</div>
})

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
  status?: string
}

export function EventLocation({ address, onChange, isPublic, className, status }: EventLocationProps) {
  const [isSearching, setIsSearching] = React.useState(false);
  const [globalSearch, setGlobalSearch] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);

  const postalLabel = React.useMemo(() => {
    const country = COUNTRIES.find(c => c.code === address?.countryCode);
    return country?.postalLabel || "Postal Code";
  }, [address?.countryCode]);

  // Busca debounced automática
  React.useEffect(() => {
    if (!globalSearch || globalSearch.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchGlobalAddresses(globalSearch);
      setSuggestions(results);
      setHasSearched(true);
      setShowSuggestions(true);
      setIsSearching(false);
    }, 600);

    return () => clearTimeout(timer);
  }, [globalSearch]);

  const handleGlobalSearchManual = async () => {
    if (!globalSearch || globalSearch.length < 3) return;
    setIsSearching(true);
    const results = await searchGlobalAddresses(globalSearch);
    setSuggestions(results);
    setHasSearched(true);
    setShowSuggestions(true);
    setIsSearching(false);
  };

  const selectSuggestion = (data: any) => {
    const mapped = mapNominatimToAddress(data);
    onChange?.({ ...address, ...mapped, isCustomized: false });
    setShowSuggestions(false);
    setGlobalSearch("");
    setHasSearched(false);
  };

  const handleMapChange = async (lat: number, lng: number) => {
    if (address.latitude?.toFixed(6) === lat.toFixed(6) && address.longitude?.toFixed(6) === lng.toFixed(6)) return;

    setIsSearching(true);
    try {
      const result = await reverseGeocode(lat, lng);
      if (result) {
        onChange?.({
          ...address,
          ...result,
          latitude: lat,
          longitude: lng,
          isCustomized: false
        });
      } else {
        onChange?.({ ...address, latitude: lat, longitude: lng });
      }
    } catch (e) {
      onChange?.({ ...address, latitude: lat, longitude: lng });
    } finally {
      setIsSearching(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    onChange?.({
      ...address,
      [field]: value,
      isCustomized: true
    });
  };

  const handleCepBlur = async () => {
    if (address?.countryCode !== 'BR') return;
    const cep = address?.postalCode?.replace(/\D/g, "");
    if (!cep || cep.length !== 8) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        const updated = {
          ...address,
          addressLine1: data.logradouro || address.addressLine1,
          neighborhood: data.bairro || address.neighborhood,
          city: data.localidade || address.city,
          stateRegion: data.uf || address.stateRegion,
          country: "Brasil",
          countryCode: "BR",
          isCustomized: false
        };
        
        const searchStr = `${updated.addressLine1}, ${updated.city}, BR`;
        const coords = await getCoordinatesFromAddress(searchStr);
        onChange?.({ ...updated, ...coords });
      }
    } catch (e) {
      console.warn("[Location] Falha no ViaCEP");
    } finally {
      setIsSearching(false);
    }
  };

  const isAtivo = status === 'Ativo';
  const missingCoords = !address?.latitude || !address?.longitude;

  if (isPublic) {
    const addrString = address?.formattedAddress || 
      `${address?.addressLine1 || ''}${address?.streetNumber ? `, ${address?.streetNumber}` : ''} - ${address?.neighborhood || ''} ${address?.city || ''} ${address?.stateRegion || ''}`;

    return (
      <div className={cn("space-y-10", className)}>
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 bg-secondary/10 rounded-lg text-secondary">
            <MapIcon className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-black uppercase italic tracking-tighter text-primary">Localização</h2>
        </div>

        <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
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
      <Card className="border-none shadow-sm rounded-[2.5rem] bg-muted/30">
        <CardContent className="p-8 space-y-8">
           <div className="space-y-4 relative z-[110]">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5" /> Busca Global de Endereços
                </Label>
                <div className="flex items-center gap-2">
                  {address.isCustomized && (
                    <Badge variant="outline" className="text-[8px] font-black uppercase border-orange-200 text-orange-600 bg-orange-50 gap-1.5 h-6">
                       <Edit3 className="w-3 h-3" /> Customizado manualmente
                    </Badge>
                  )}
                  {isAtivo && missingCoords && (
                    <Badge variant="destructive" className="text-[8px] font-black uppercase">Coordenadas Obrigatórias</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2 relative">
                 <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Nome do local, estádio ou endereço completo..." 
                      value={globalSearch}
                      onChange={e => setGlobalSearch(e.target.value)}
                      className="pl-10 h-12 rounded-xl border-dashed border-secondary/30 bg-white"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleGlobalSearchManual())}
                    />
                 </div>
                 <Button type="button" onClick={handleGlobalSearchManual} disabled={isSearching} className="h-12 rounded-xl px-6 bg-secondary text-white font-bold">
                    {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
                 </Button>
              </div>

              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-white/95 backdrop-blur-md rounded-2xl border shadow-2xl animate-in slide-in-from-top-2 overflow-hidden">
                   <div className="flex justify-between items-center p-2 border-b bg-muted/20">
                      <span className="text-[9px] font-black uppercase opacity-40 tracking-widest">Sugestões Localizadas</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => { setShowSuggestions(false); setHasSearched(false); }}><X className="w-3 h-3" /></Button>
                   </div>
                   <ScrollArea className="max-h-60">
                      {suggestions.length > 0 ? (
                        suggestions.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => selectSuggestion(s)}
                            className="w-full flex items-center gap-3 p-4 hover:bg-secondary/5 text-left transition-colors group border-b last:border-0"
                          >
                             <div className="p-2 bg-muted rounded-lg group-hover:bg-secondary group-hover:text-white transition-colors">
                                <MapPin className="w-4 h-4" />
                             </div>
                             <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate text-primary uppercase">{s.display_name.split(',')[0]}</p>
                                <p className="text-[10px] text-muted-foreground truncate leading-relaxed">{s.display_name}</p>
                             </div>
                          </button>
                        ))
                      ) : hasSearched ? (
                        <div className="p-8 text-center space-y-2">
                           <AlertTriangle className="w-8 h-8 text-orange-400 mx-auto" />
                           <p className="text-xs font-bold text-muted-foreground uppercase italic">Nenhum local encontrado para esta busca.</p>
                        </div>
                      ) : null}
                   </ScrollArea>
                </div>
              )}
           </div>

           <Separator className="border-dashed" />

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">País (ISO Code)</Label>
                       <Select 
                        value={address?.countryCode || ""} 
                        onValueChange={val => handleFieldChange('countryCode', val)}
                       >
                          <SelectTrigger className="rounded-xl h-11 bg-white"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                             {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                          </SelectContent>
                       </Select>
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">{postalLabel}</Label>
                       <Input 
                         value={address?.postalCode || ""} 
                         onChange={e => handleFieldChange('postalCode', e.target.value)} 
                         onBlur={handleCepBlur}
                         className="rounded-xl h-11 bg-white" 
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Nome do Local (Venue)</Label>
                    <div className="relative">
                       <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                       <Input value={address?.venueName || ""} onChange={e => handleFieldChange('venueName', e.target.value)} placeholder="Ex: Madison Square Garden" className="pl-10 rounded-xl h-11 bg-white" />
                    </div>
                 </div>

                 <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-3 space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Logradouro / Rua</Label>
                       <Input value={address?.addressLine1 || ""} onChange={e => handleFieldChange('addressLine1', e.target.value)} className="rounded-xl h-11 bg-white" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Nº</Label>
                       <Input value={address?.streetNumber || ""} onChange={e => handleFieldChange('streetNumber', e.target.value)} className="rounded-xl h-11 bg-white" />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Bairro</Label><Input value={address?.neighborhood || ""} onChange={e => handleFieldChange('neighborhood', e.target.value)} className="rounded-xl h-11 bg-white" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Cidade</Label><Input value={address?.city || ""} onChange={e => handleFieldChange('city', e.target.value)} className="rounded-xl h-11 bg-white" /></div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Estado ou Região</Label><Input value={address?.stateRegion || ""} onChange={e => handleFieldChange('stateRegion', e.target.value)} className="rounded-xl h-11 bg-white" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Complemento / Line 2</Label><Input value={address?.addressLine2 || ""} onChange={e => handleFieldChange('addressLine2', e.target.value)} className="rounded-xl h-11 bg-white" /></div>
                 </div>
              </div>

              <div className="space-y-4">
                 <Label className="text-[10px] font-black uppercase opacity-60 flex justify-between items-center">
                    Localização Exata (Arraste o PIN)
                    {address.latitude && (
                      <Badge className="bg-green-500 text-white border-none shadow-sm text-[8px] font-black uppercase h-5 px-2">Mapa Sincronizado</Badge>
                    )}
                 </Label>
                 <div className="h-[400px] w-full rounded-[2.5rem] overflow-hidden border-2 border-muted shadow-inner relative group/map bg-white">
                    <LocationMap 
                      latitude={address?.latitude || -23.55052} 
                      longitude={address?.longitude || -46.633308} 
                      onChange={handleMapChange}
                      interactive={true}
                    />
                    {isSearching && (
                      <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-20 flex items-center justify-center">
                         <div className="p-4 bg-white rounded-2xl shadow-xl flex items-center gap-3">
                            <Loader2 className="w-5 h-5 animate-spin text-secondary" />
                            <span className="text-[10px] font-black uppercase text-primary">Sincronizando...</span>
                         </div>
                      </div>
                    )}
                 </div>
                 <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
                    <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                    <p className="text-[9px] text-secondary font-bold uppercase leading-tight italic">
                       Dica: Você pode digitar o nome de um estabelecimento famoso na busca para localizá-lo instantaneamente.
                    </p>
                 </div>
              </div>
           </div>
        </CardContent>
      </Card>
    </div>
  )
}
