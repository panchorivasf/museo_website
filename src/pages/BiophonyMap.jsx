import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import { Bird, Bug, Turtle, Fish, Rat, Play, Pause, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/lib/ThemeContext';
import 'leaflet/dist/leaflet.css';

const taxonConfig = {
  aves: { label: 'Aves', icon: Bird, color: '#087F8C' },
  insectos: { label: 'Insectos', icon: Bug, color: '#86A873' },
  anfibios: { label: 'Anfibios', icon: Turtle, color: '#5AAA95' },
  cetaceos: { label: 'Cetáceos', icon: Fish, color: '#095256' },
  mamiferos_terrestres: { label: 'Roedores', icon: Rat, color: '#BB9F06' },
};

function createIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
      <div style="width:8px;height:8px;border-radius:50%;background:white;"></div>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
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
    <div className="min-w-[240px] max-w-[300px] p-1">
      {/* Species image thumbnail */}
      {recording.image_url && (
        <img
          src={recording.image_url}
          alt={recording.species_name}
          className="w-full h-28 object-cover rounded-lg mb-2"
          style={{ display: 'block' }}
        />
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="font-heading font-semibold text-sm text-primary leading-tight">{recording.species_name}</h3>
          {recording.scientific_name && (
            <p className="text-xs italic text-muted-foreground">{recording.scientific_name}</p>
          )}
        </div>
        <Badge style={{ backgroundColor: config.color, color: 'white' }} className="text-[9px] uppercase tracking-wider shrink-0">
          {config.label}
        </Badge>
      </div>

      {recording.location_name && (
        <p className="text-xs text-muted-foreground mb-2">📍 {recording.location_name}</p>
      )}

      {/* Collapsible description */}
      {recording.description && (
        <div className="mb-2">
          <button
            onClick={() => setDescOpen(v => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {descOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {descOpen ? 'Ocultar descripción' : 'Ver descripción'}
          </button>
          {descOpen && (
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed border-l-2 border-border pl-2">
              {recording.description}
            </p>
          )}
        </div>
      )}

      {recording.audio_url && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={togglePlay} className="h-7 text-xs">
            {playing ? <Pause className="w-3 h-3 mr-1" /> : <Play className="w-3 h-3 mr-1" />}
            {playing ? 'Pausar' : 'Escuchar'}
          </Button>
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
          chunkedLoading spiderfyOnEveryZoom={false} showCoverageOnHover={false}
          zoomToBoundsOnClick={false} spiderfyOnMaxZoom={true}
          eventHandlers={{
            clustermouseover: (e) => e.layer.spiderfy(),
            clustermouseout: (e) => e.layer.unspiderfy(),
          }}
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
