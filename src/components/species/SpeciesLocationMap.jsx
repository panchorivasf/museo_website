import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function SpeciesLocationMap({ latitude, longitude, locationName, speciesName }) {
  const [expanded, setExpanded] = useState(false);
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (!latitude || !longitude || isNaN(lat) || isNaN(lng)) return null;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-heading font-semibold text-primary">
          <MapPin className="w-4 h-4 text-secondary" />
          Ubicación de grabación
          {locationName && <span className="font-normal text-muted-foreground text-xs">— {locationName}</span>}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div style={{ height: 280 }}>
          <MapContainer
            center={[lat, lng]}
            zoom={9}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            <Marker position={[lat, lng]}>
              {locationName && (
                <Popup>
                  <span className="text-xs font-medium">{speciesName}</span>
                  <br />
                  <span className="text-xs text-gray-500">{locationName}</span>
                </Popup>
              )}
            </Marker>
          </MapContainer>
        </div>
      )}
    </div>
  );
}
