import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function SpeciesLocationMap({ latitude, longitude, locationName, speciesName }) {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (!latitude || !longitude || isNaN(lat) || isNaN(lng)) return null;

  return (
    <div className="rounded-lg overflow-hidden border border-border mt-3" style={{ height: 200 }}>
      <MapContainer
        center={[lat, lng]}
        zoom={8}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        scrollWheelZoom={false}
        attributionControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]}>
          <Popup>
            <span className="text-xs font-medium">{speciesName}</span>
            {locationName && <><br /><span className="text-xs text-gray-500">{locationName}</span></>}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
