import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { Bird, Bug, Rat, Play, Pause, ChevronDown, ChevronUp } from 'lucide-react';
import { WhaleTail, Frog } from '@/components/icons/TaxonIcons';
import MiniSpectrogram from '@/components/audio/MiniSpectrogram';
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

function RecordingPopup({ recording }) {
  const [playing, setPlaying] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const audioRef = useRef(null);
  const config = taxonConfig[recording.taxon] || { label: recording.taxon, color: '#5AAA95' };

  const togglePlay = () => {
    if (!audioRef.current || !recording.audio_url) return;
    if (playing) { audioRef.current.pause(); } else { audioRef.current.play(); }
    setPlaying(!playing);
  };

  return (
    <div style={{ minWidth: '220px', maxWidth: '280px', padding: '2px' }}>
      {/* Species image thumbnail */}
      {recording.image_url && (
        <img
          src={recording.image_url}
          alt={recording.species_name}
          style={{ display: 'block', width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', marginBottom: '6px' }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '13px', lineHeight: 1.2, color: 'var(--color-primary, #062a2e)' }}>{recording.species_name}</div>
          {recording.scientific_name && (
            <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#888', lineHeight: 1.2 }}>{recording.scientific_name}</div>
          )}
        </div>
        <span style={{ backgroundColor: config.color, color: 'white', fontSize: '9px', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '2px 5px', borderRadius: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {config.label}
        </span>
      </div>

      {recording.location_name && (
        <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>📍 {recording.location_name}</div>
      )}

      {recording.description && (
        <div style={{ marginBottom: '6px' }}>
          <button
            onClick={() => setDescOpen(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {descOpen ? <ChevronUp style={{ width: '11px', height: '11px' }} /> : <ChevronDown style={{ width: '11px', height: '11px' }} />}
            {descOpen ? 'Ocultar' : 'Ver descripción'}
          </button>
          {descOpen && (
            <div style={{ fontSize: '11px', color: '#888', marginTop: '4px', lineHeight: 1.5, borderLeft: '2px solid #ddd', paddingLeft: '6px' }}>
              {recording.description}
            </div>
          )}
        </div>
      )}

      {recording.audio_url && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={togglePlay}
            style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #ccc', background: 'white', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {playing
              ? <Pause style={{ width: '10px', height: '10px' }} />
              : <Play style={{ width: '10px', height: '10px' }} />}
            {playing ? 'Pausar' : 'Oír'}
          </button>
          <MiniSpectrogram audioUrl={recording.audio_url} />
          <audio ref={audioRef} src={recording.audio_url} onEnded={() => setPlaying(false)} />
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
        .select('*, species(common_name, scientific_name, taxon, image_url)')
        .order('created_at', { ascending: false })
        .limit(500);
      return (data || []).map(r => ({
        ...r,
        species_name: r.species?.common_name || r.species_name || '',
        scientific_name: r.species?.scientific_name || '',
        taxon: r.species?.taxon || r.taxon || '',
        image_url: r.species?.image_url || null,
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
