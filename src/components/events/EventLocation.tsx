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
import { LocationMap } from "./LocationMap"
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

  const postalLabel = React.useMemo(() => {
    const country = COUNTRIES.find(c => c.code === address?.countryCode);
    return country?.postalLabel || "Postal Code";
  }, [address?.countryCode]);

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
    onChange?.({ ...address, ...mapped, isCustomized: false });
    setShowSuggestions(false);
    setGlobalSearch("");
  };

  const handleMapChange = async (lat: number, lng: number) => {
    // Evita recalcular se já estivermos na mesma posição
    if (address.latitude?.toFixed(6) === lat.toFixed(6) && address.longitude?.toFixed(6) === lng.toFixed(6)) return;

    setIsSearching(true);
    try {
      const result = await reverseGeocode(lat, lng);
      if (result) {
        // REGRA PRINCIPAL: PIN recalcula TODO o endereço
        onChange?.({
          ...address,
          ...result,
          latitude: lat,
          longitude: lng,
          isCustomized: false
        });
      } else {
        // Fallback: Mantém coordenadas e dados existentes
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
      isCustomized: true // Qualquer edição manual marca como customizado
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
      <Card className="border-none shadow-sm rounded-[2.5rem] bg-muted/30 overflow-hidden">
        <CardContent className="p-8 space-y-8">
           <div className="space-y-4">
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
              <div className="flex gap-2">
                 <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Nome do local, estádio ou endereço completo..." 
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
                <div className="p-2 bg-white rounded-2xl border shadow-xl animate-in slide-in-from-top-2 z-50 relative">
                   <div className="flex justify-end p-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSuggestions(false)}><X className="w-3 h-3" /></Button>
                   </div>
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

           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">País (ISO Code)</Label>
                       <Select 
                        value={address?.countryCode || ""} 
                        onValueChange={val => handleFieldChange('countryCode', val)}
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
                         onChange={e => handleFieldChange('postalCode', e.target.value)} 
                         onBlur={handleCepBlur}
                         className="rounded-xl h-11" 
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-60">Nome do Local (Venue)</Label>
                    <div className="relative">
                       <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                       <Input value={address?.venueName || ""} onChange={e => handleFieldChange('venueName', e.target.value)} placeholder="Ex: Madison Square Garden" className="pl-10 rounded-xl h-11" />
                    </div>
                 </div>

                 <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-3 space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Logradouro / Address Line 1</Label>
                       <Input value={address?.addressLine1 || ""} onChange={e => handleFieldChange('addressLine1', e.target.value)} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-[10px] font-black uppercase opacity-60">Nº</Label>
                       <Input value={address?.streetNumber || ""} onChange={e => handleFieldChange('streetNumber', e.target.value)} className="rounded-xl h-11" />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Bairro</Label><Input value={address?.neighborhood || ""} onChange={e => handleFieldChange('neighborhood', e.target.value)} className="rounded-xl h-11" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Cidade</Label><Input value={address?.city || ""} onChange={e => handleFieldChange('city', e.target.value)} className="rounded-xl h-11" /></div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Estado ou Região</Label><Input value={address?.stateRegion || ""} onChange={e => handleFieldChange('stateRegion', e.target.value)} className="rounded-xl h-11" /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-60">Complemento / Line 2</Label><Input value={address?.addressLine2 || ""} onChange={e => handleFieldChange('addressLine2', e.target.value)} className="rounded-xl h-11" /></div>
                 </div>
              </div>

              <div className="space-y-4">
                 <Label className="text-[10px] font-black uppercase opacity-60 flex justify-between items-center">
                    Fonte Primária: Mapa (PIN)
                    {address.latitude && (
                      <Badge className="bg-green-500 text-white border-none shadow-sm text-[8px] font-black uppercase">PIN Sincronizado</Badge>
                    )}
                 </Label>
                 <div className="h-[400px] w-full rounded-[2.5rem] overflow-hidden border-2 border-muted shadow-inner relative group/map">
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
                            <span className="text-[10px] font-black uppercase text-primary">Sincronizando endereço...</span>
                         </div>
                      </div>
                    )}
                 </div>
                 <div className="p-4 bg-secondary/5 rounded-2xl border border-secondary/10 flex items-start gap-3">
                    <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                    <p className="text-[9px] text-secondary font-bold uppercase leading-tight italic">
                       Mover o PIN no mapa atualiza automaticamente todos os campos de endereço acima através de geocodificação reversa.
                    </p>
                 </div>
              </div>
           </div>
        </CardContent>
      </Card>
    </div>
  )
}
