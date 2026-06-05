import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function ClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) { onLocationSelect(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

export default function LocationPicker({ latitude, longitude, onLocationSelect }) {
  const [satellite, setSatellite] = useState(true);
  const hasCoords = latitude && longitude && !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude));
  const center = hasCoords ? [parseFloat(latitude), parseFloat(longitude)] : [-35.5, -71.5];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Haz clic en el mapa para seleccionar la ubicación.
        </p>
        <button
          type="button"
          onClick={() => setSatellite(v => !v)}
          className="text-xs px-2 py-1 rounded border border-border bg-muted hover:bg-muted/80 transition-colors"
        >
          {satellite ? 'Mapa' : 'Satélite'}
        </button>
      </div>
      <div className="rounded-lg overflow-hidden border border-border" style={{ height: 450 }}>
        <MapContainer center={center} zoom={hasCoords ? 10 : 5} style={{ height: '100%', width: '100%' }}>
          {satellite ? (
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          ) : (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}
          <ClickHandler onLocationSelect={onLocationSelect} />
          {hasCoords && <Marker position={[parseFloat(latitude), parseFloat(longitude)]} />}
        </MapContainer>
      </div>
    </div>
  );
}
