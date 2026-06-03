
'use client';

import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';

// Corrigir ícone padrão do Leaflet no Next.js
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface LocationMapProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  interactive?: boolean;
}

// Componente para centralizar o mapa quando as coordenadas mudam externamente
function ChangeView({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
      // Forçamos a centralização com animação suave se o ponto existir
      map.setView([latitude, longitude], map.getZoom(), { animate: true });
      
      // Essencial: Invalida o tamanho após o render para corrigir tiles cinzas
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [latitude, longitude, map]);

  return null;
}

// Componente para o Marcador que reage a props e permite arrasto
function DraggableMarker({ latitude, longitude, onChange, interactive }: LocationMapProps) {
  const markerRef = useRef<L.Marker>(null);

  // Efeito para mover o marcador programaticamente caso a prop mude externamente
  useEffect(() => {
    if (markerRef.current) {
      const currentPos = markerRef.current.getLatLng();
      if (currentPos.lat !== latitude || currentPos.lng !== longitude) {
        markerRef.current.setLatLng([latitude, longitude]);
      }
    }
  }, [latitude, longitude]);

  const eventHandlers = React.useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const { lat, lng } = marker.getLatLng();
          onChange(lat, lng);
        }
      },
    }),
    [onChange]
  );

  return (
    <Marker
      draggable={interactive}
      eventHandlers={eventHandlers}
      position={[latitude, longitude]}
      ref={markerRef}
    />
  );
}

export function LocationMap({ latitude, longitude, onChange, interactive = true }: LocationMapProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center text-[10px] font-black uppercase opacity-20">
        Iniciando Camada de Mapa...
      </div>
    );
  }

  // Garantir que temos valores válidos ou fallback para centro de SP
  const lat = Number(latitude) || -23.55052;
  const lng = Number(longitude) || -46.633308;

  return (
    <div className="w-full h-full relative rounded-[1.5rem] overflow-hidden">
      <MapContainer 
        center={[lat, lng]} 
        zoom={15} 
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ChangeView latitude={lat} longitude={lng} />
        <DraggableMarker latitude={lat} longitude={lng} onChange={onChange} interactive={interactive} />
      </MapContainer>
    </div>
  );
}
