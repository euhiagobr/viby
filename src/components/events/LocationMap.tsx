
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
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (!isNaN(lat) && !isNaN(lng)) {
      // Forçamos a centralização com animação suave se o ponto for válido
      map.setView([lat, lng], map.getZoom(), { animate: true });
      
      // Essencial: Invalida o tamanho após o render para corrigir tiles cinzas
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 200);
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
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (markerRef.current && !isNaN(lat) && !isNaN(lng)) {
      const currentPos = markerRef.current.getLatLng();
      if (currentPos.lat !== lat || currentPos.lng !== lng) {
        markerRef.current.setLatLng([lat, lng]);
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

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (isNaN(lat) || isNaN(lng)) return null;

  return (
    <Marker
      draggable={interactive}
      eventHandlers={eventHandlers}
      position={[lat, lng]}
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

  // Garantir que temos valores numéricos válidos. 
  // Fallback apenas se for NaN (0 é um valor válido)
  const lat = (!isNaN(Number(latitude)) && latitude !== null) ? Number(latitude) : -23.55052;
  const lng = (!isNaN(Number(longitude)) && longitude !== null) ? Number(longitude) : -46.633308;

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
