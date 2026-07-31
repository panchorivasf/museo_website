import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function ClickHandler({ onAddPoint }) {
  useMapEvents({
    click(e) { onAddPoint(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

export default function MultiLocationPicker({ points = [], onChange }) {
  const [satellite, setSatellite] = useState(true);

  const hasPoints = points.length > 0;
  const center = hasPoints
    ? [points[0].lat, points[0].lng]
    : [-35.5, -71.5];

  const addPoint = (lat, lng) => {
    onChange([...points, { lat, lng, label: '' }]);
  };

  const updateLabel = (idx, label) => {
    const next = [...points];
    next[idx] = { ...next[idx], label };
    onChange(next);
  };

  const removePoint = (idx) => {
    onChange(points.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Haz clic en el mapa para agregar puntos. Puedes agregar varios.
        </p>
        <button
          type="button"
          onClick={() => setSatellite(v => !v)}
          className="text-xs px-2 py-1 rounded border border-border bg-muted hover:bg-muted/80 transition-colors shrink-0"
        >
          {satellite ? 'Mapa' : 'Satélite'}
        </button>
      </div>
      <div className="rounded-lg overflow-hidden border border-border" style={{ height: 350 }}>
        <MapContainer center={center} zoom={hasPoints ? 8 : 5} style={{ height: '100%', width: '100%' }}>
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
          <ClickHandler onAddPoint={addPoint} />
          {points.map((p, i) => (
            <Marker key={i} position={[p.lat, p.lng]} />
          ))}
        </MapContainer>
      </div>

      {hasPoints && (
        <div className="space-y-1.5">
          {points.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground w-8 shrink-0">#{i + 1}</span>
              <Input
                value={p.label}
                onChange={e => updateLabel(i, e.target.value)}
                placeholder="Etiqueta (ej: Punto de avistamiento)"
                className="h-8 text-xs"
              />
              <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-32">
                {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
              </span>
              <button
                type="button"
                onClick={() => removePoint(i)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
