
'use client';

import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';

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
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

// Componente para capturar o clique e arrasto
function DraggableMarker({ latitude, longitude, onChange, interactive }: LocationMapProps) {
  const markerRef = useRef<L.Marker>(null);

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
    return <div className="w-full h-full bg-muted flex items-center justify-center text-xs font-bold uppercase opacity-20">Iniciando Mapa...</div>;
  }

  return (
    <div className="w-full h-full relative rounded-[1.5rem] overflow-hidden">
      <MapContainer 
        center={[latitude, longitude]} 
        zoom={15} 
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ChangeView center={[latitude, longitude]} />
        <DraggableMarker latitude={latitude} longitude={longitude} onChange={onChange} interactive={interactive} />
      </MapContainer>
    </div>
  );
}
