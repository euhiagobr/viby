'use client';

import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';

// Corrigir ícone padrão do Leaflet no Next.js para evitar falhas de assets
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

/**
 * Componente interno para centralizar o mapa de forma segura.
 */
function ChangeView({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  
  useEffect(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);

    // Validação rigorosa para evitar crash no motor do Leaflet
    if (
      !isNaN(lat) && 
      !isNaN(lng) && 
      Math.abs(lat) <= 90 && 
      Math.abs(lng) <= 180
    ) {
      try {
        map.setView([lat, lng], map.getZoom(), { animate: true });
        
        // Corrige problemas de renderização parcial (tiles cinzas)
        const timer = setTimeout(() => {
          map.invalidateSize();
        }, 100);
        return () => clearTimeout(timer);
      } catch (e) {
        console.warn("[Leaflet-Safe] Falha ao mover visualização:", e);
      }
    }
  }, [latitude, longitude, map]);

  return null;
}

/**
 * Componente para o Marcador com tratamento de erro e arraste.
 */
function SafeMarker({ latitude, longitude, onChange, interactive }: LocationMapProps) {
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
      markerRef.current && 
      !isNaN(lat) && 
      !isNaN(lng) && 
      Math.abs(lat) <= 90 && 
      Math.abs(lng) <= 180
    ) {
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

  // Não renderiza o marcador se as coordenadas forem absurdas ou inválidas
  if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

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

  // Sanitização final para garantir que o MapContainer sempre receba algo válido no mount
  const safeLat = (!isNaN(Number(latitude)) && latitude !== null && Math.abs(Number(latitude)) <= 90) 
    ? Number(latitude) 
    : -23.55052;
  const safeLng = (!isNaN(Number(longitude)) && longitude !== null && Math.abs(Number(longitude)) <= 180) 
    ? Number(longitude) 
    : -46.633308;

  return (
    <div className="w-full h-full relative rounded-[1.5rem] overflow-hidden">
      <MapContainer 
        center={[safeLat, safeLng]} 
        zoom={15} 
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ChangeView latitude={safeLat} longitude={safeLng} />
        <SafeMarker latitude={safeLat} longitude={safeLng} onChange={onChange} interactive={interactive} />
      </MapContainer>
    </div>
  );
}