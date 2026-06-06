import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, User, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SpectrogramPlayer from '@/components/audio/SpectrogramPlayer';
import ReactMarkdown from 'react-markdown';
import SpeciesLocationMap from '@/components/species/SpeciesLocationMap';

const taxonLabels = {
  aves: 'Aves',
  insectos: 'Insectos',
  anfibios: 'Anfibios',
  cetaceos: 'Cetáceos',
  mamiferos_terrestres: 'Roedores',
};

const conservationLabels = {
  LC: 'Preocupación Menor', NT: 'Casi Amenazada', VU: 'Vulnerable',
  EN: 'En Peligro', CR: 'En Peligro Crítico', EW: 'Extinta en Estado Silvestre',
  EX: 'Extinta', DD: 'Datos Insuficientes', NE: 'No Evaluada',
};

const conservationColors = {
  LC: 'bg-green-100 text-green-800', NT: 'bg-yellow-100 text-yellow-800',
  VU: 'bg-orange-100 text-orange-800', EN: 'bg-red-100 text-red-800',
  CR: 'bg-red-200 text-red-900', EW: 'bg-purple-100 text-purple-800',
  EX: 'bg-gray-200 text-gray-800', DD: 'bg-gray-100 text-gray-600',
  NE: 'bg-gray-100 text-gray-500',
};

export default function SpeciesDetail() {
  const { id } = useParams();

  const { data: species, isLoading } = useQuery({
    queryKey: ['species', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('species')
        .select('*')
        .eq('id', id)
        .single();
      return data || null;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  if (!species) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-lg text-muted-foreground">Especie no encontrada</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/coleccion">Volver a la colección</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-6 text-muted-foreground">
        <Link to="/coleccion">
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver
        </Link>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          {species.image_url && (
            <div>
              <div className="rounded-xl overflow-hidden aspect-[16/9] bg-muted">
                <img src={species.image_url} alt={species.common_name} className="w-full h-full object-cover" />
              </div>
              {species.image_author && (
                <p className="text-xs text-muted-foreground mt-1.5 px-1">
                  {species.image_license && <span>{species.image_license} </span>}
                  {!species.image_license?.startsWith('©') && '© '}{species.image_author}
                  {species.image_source_platform && species.image_source_url && (
                    <> · <a href={species.image_source_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{species.image_source_platform}</a></>
                  )}
                  {species.image_source_platform && !species.image_source_url && (
                    <> · {species.image_source_platform}</>
                  )}
                </p>
              )}
            </div>
          )}

          {species.audio_url && (
            <SpectrogramPlayer
              audioUrl={species.audio_url}
              frequencyRange={species.frequency_range}
              altText={`Espectrograma del sonido de ${species.common_name} (${species.scientific_name})`}
            />
          )}

          {species.sound_description && (
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-semibold text-primary flex items-center gap-2">
                  <Info className="w-4 h-4 text-secondary" />
                  Sobre este sonido
                </h3>
                {(species.frequency_min || species.frequency_max) && (
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {species.frequency_min && species.frequency_max
                      ? `${species.frequency_min}–${species.frequency_max} kHz`
                      : `${species.frequency_min || species.frequency_max} kHz`}
                  </span>
                )}
              </div>
              <ReactMarkdown className="text-muted-foreground leading-relaxed prose prose-sm max-w-none prose-p:my-1">
                {species.sound_description}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div>
            <Badge className="bg-secondary/10 text-secondary border-0 text-[10px] uppercase tracking-widest font-heading mb-2">
              {taxonLabels[species.taxon] || species.taxon}
            </Badge>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-primary leading-tight">
              {species.common_name}
            </h1>
            <p className="text-lg italic text-muted-foreground mt-1">{species.scientific_name}</p>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 space-y-3">
            <h3 className="text-xs font-heading uppercase tracking-widest text-muted-foreground font-semibold">
              Taxonomía
            </h3>
            {[
              { label: 'Orden', value: species.order },
              { label: 'Familia', value: species.family },
            ].filter(t => t.value).map(t => (
              <div key={t.label} className="flex justify-between items-center border-b border-border/50 pb-2 last:border-0 last:pb-0">
                <span className="text-xs font-mono text-muted-foreground uppercase">{t.label}</span>
                <span className="text-sm font-medium text-primary">{t.value}</span>
              </div>
            ))}
            {species.conservation_status && (
              <div className="pt-1">
                <Badge className={`${conservationColors[species.conservation_status] || 'bg-muted text-muted-foreground'} text-xs`}>
                  {species.conservation_status} — {conservationLabels[species.conservation_status] || ''}
                </Badge>
              </div>
            )}
          </div>

          {species.description && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-xs font-heading uppercase tracking-widest text-muted-foreground font-semibold mb-3">Descripción</h3>
              <ReactMarkdown className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none prose-p:my-1">
                {species.description}
              </ReactMarkdown>
            </div>
          )}

          {species.habitat && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-xs font-heading uppercase tracking-widest text-muted-foreground font-semibold mb-3">Hábitat</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{species.habitat}</p>
            </div>
          )}

          <div className="bg-card rounded-xl border border-border p-5 space-y-2.5">
            <h3 className="text-xs font-heading uppercase tracking-widest text-muted-foreground font-semibold mb-1">
              Información de Grabación
            </h3>
            {species.recording_location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 text-secondary shrink-0" />
                {species.recording_location}
              </div>
            )}
            {species.recording_date && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 text-secondary shrink-0" />
                {species.recording_date}
              </div>
            )}
            {species.recordist && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-3.5 h-3.5 text-secondary shrink-0" />
                {species.recordist}
              </div>
            )}
            <SpeciesLocationMap
              latitude={species.recording_latitude}
              longitude={species.recording_longitude}
              locationName={species.recording_location}
              speciesName={species.common_name}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
