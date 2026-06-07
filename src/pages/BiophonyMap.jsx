import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { Bird, Bug, Rat } from 'lucide-react';
import { WhaleTail, Frog } from '@/components/icons/TaxonIcons';
import MiniSpectrogram, { stopActiveMiniSpectrogram } from '@/components/audio/MiniSpectrogram';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/lib/ThemeContext';
import 'leaflet/dist/leaflet.css';

const taxonConfig = {
  aves: { label: 'Aves', icon: Bird, color: '#087F8C' },
  insectos: { label: 'Insectos', icon: Bug, color: '#86A873' },
  anfibios: { label: 'Anfibios', icon: Frog, color: '#5AAA95' },
  cetaceos: { label: 'Cetáceos', icon: WhaleTail, color: '#095256' },
  mamiferos_terrestres: { label: 'Roedores', icon: Rat, color: '#BB9F06' },
};

function createIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 5px rgba(0,0,0,0.35);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function MapBounds({ recordings }) {
  const map = useMap();
  useEffect(() => {
    if (recordings.length > 0) {
      const bounds = L.latLngBounds(recordings.map(r => [r.latitude, r.longitude]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [recordings, map]);
  return null;
}

function MapEvents() {
  const map = useMap();
  useEffect(() => {
    const handler = () => stopActiveMiniSpectrogram();
    map.on('popupclose', handler);
    return () => map.off('popupclose', handler);
  }, [map]);
  return null;
}

function RecordingPopup({ recording }) {
  const config = taxonConfig[recording.taxon] || { label: recording.taxon, color: '#5AAA95' };

  return (
    <div style={{ width: '260px', padding: '0' }} onClick={e => e.stopPropagation()}>

      {/* Row 1: image with taxon badge */}
      {recording.image_url && (
        <div style={{ position: 'relative', width: '100%', marginBottom: '6px' }}>
          <img
            src={recording.image_url}
            alt={recording.species_name}
            style={{ display: 'block', width: '100%', height: 'auto', borderRadius: '6px' }}
          />
          <span style={{
            position: 'absolute', top: '5px', right: '5px',
            backgroundColor: config.color, color: 'white',
            fontSize: '8px', letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '2px 5px', borderRadius: '3px',
          }}>
            {config.label}
          </span>
        </div>
      )}

      {/* If no image, show taxon badge inline */}
      {!recording.image_url && (
        <span style={{
          display: 'inline-block', marginBottom: '4px',
          backgroundColor: config.color, color: 'white',
          fontSize: '8px', letterSpacing: '0.06em', textTransform: 'uppercase',
          padding: '2px 5px', borderRadius: '3px',
        }}>
          {config.label}
        </span>
      )}

      {/* Row 2: common name + scientific name */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '5px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '13px', color: '#062a2e', lineHeight: 1.2 }}>
          {recording.species_name}
        </span>
        {recording.scientific_name && (
          <span style={{ fontSize: '10px', fontStyle: 'italic', color: '#999', lineHeight: 1.2 }}>
            {recording.scientific_name}
          </span>
        )}
      </div>

      {/* Row 3: spectrogram with location (top-right) and play button (bottom-left) */}
      {recording.audio_url && (
        <div style={{ position: 'relative' }}>
          <MiniSpectrogram
            audioUrl={recording.audio_url}
            frequencyMin={recording.spectrogram_min ?? recording.frequency_min}
            frequencyMax={recording.spectrogram_max ?? recording.frequency_max}
          />
          {recording.location_name && (
            <div style={{
              position: 'absolute', top: '4px', right: '5px',
              fontSize: '9px', color: 'rgba(255,255,255,0.8)',
              background: 'rgba(0,0,0,0.4)', padding: '1px 4px', borderRadius: '3px',
              pointerEvents: 'none', maxWidth: '160px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              📍 {recording.location_name}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BiophonyMap() {
  const { isDark } = useTheme();
  const [visibleTaxa, setVisibleTaxa] = useState(
    Object.keys(taxonConfig).reduce((acc, k) => ({ ...acc, [k]: true }), {})
  );

  const { data: recordings = [] } = useQuery({
    queryKey: ['map-recordings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('map_recordings')
        .select('*, species(common_name, scientific_name, taxon, image_url, frequency_min, frequency_max, spectrogram_min, spectrogram_max)')
        .order('created_at', { ascending: false })
        .limit(500);
      return (data || []).map(r => ({
        ...r,
        species_name: r.species?.common_name || r.species_name || '',
        scientific_name: r.species?.scientific_name || '',
        taxon: r.species?.taxon || r.taxon || '',
        image_url: r.species?.image_url || null,
        frequency_min: r.species?.frequency_min || null,
        frequency_max: r.species?.frequency_max || null,
        spectrogram_min: r.species?.spectrogram_min || null,
        spectrogram_max: r.species?.spectrogram_max || null,
      }));
    },
  });

  const toggleTaxon = (key) => setVisibleTaxa(prev => ({ ...prev, [key]: !prev[key] }));

  const filteredRecordings = recordings.filter(r => r.latitude && r.longitude && visibleTaxa[r.taxon]);

  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const tileAttribution = isDark
    ? '&copy; <a href="https://www.openstreetmap.org">OSM</a> | Tiles &copy; <a href="https://carto.com">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  return (
    <div className="h-[calc(100vh-4rem)] relative">
      <MapContainer center={[-36.82, -73.05]} zoom={6} className="w-full h-full z-0" zoomControl={false}>
        <TileLayer key={tileUrl} attribution={tileAttribution} url={tileUrl} />
        <MapBounds recordings={filteredRecordings} />
        <MapEvents />
        <MarkerClusterGroup
          chunkedLoading
          showCoverageOnHover={false}
          maxClusterRadius={40}
          disableClusteringAtZoom={10}
          spiderfyOnMaxZoom={true}
          zoomToBoundsOnClick={true}
        >
          {filteredRecordings.map(rec => {
            const config = taxonConfig[rec.taxon] || { color: '#5AAA95' };
            return (
              <Marker key={rec.id} position={[rec.latitude, rec.longitude]} icon={createIcon(config.color)}>
                <Popup maxWidth={320}>
                  <RecordingPopup recording={rec} />
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>

      <div className="absolute top-4 left-4 z-[1000]">
        <div className="bg-card/90 backdrop-blur-xl rounded-xl border border-border/50 px-4 py-3 shadow-lg">
          <h1 className="font-display font-bold text-primary text-lg">Mapa Biofónico</h1>
          <p className="text-xs text-muted-foreground">
            {filteredRecordings.length} grabación{filteredRecordings.length !== 1 ? 'es' : ''}
          </p>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000]">
        <div className="bg-card/90 backdrop-blur-xl rounded-full border border-border/50 px-3 py-2 shadow-lg flex items-center gap-1.5 flex-wrap justify-center">
          {Object.entries(taxonConfig).map(([key, config]) => {
            const Icon = config.icon;
            const active = visibleTaxa[key];
            return (
              <Button
                key={key} variant="ghost" size="sm" onClick={() => toggleTaxon(key)}
                className={`rounded-full text-xs font-heading px-3 h-8 transition-all ${active ? 'text-white hover:text-white' : 'opacity-40 hover:opacity-70'}`}
                style={active ? { backgroundColor: config.color } : {}}
              >
                <Icon className="w-3.5 h-3.5 mr-1.5" />
                <span className="hidden sm:inline">{config.label}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
