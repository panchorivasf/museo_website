import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { useParams, useSearchParams } from 'react-router-dom';
import SpectrogramPlayer from '@/components/audio/SpectrogramPlayer';
import { spectrogramSettings } from '@/lib/spectrogram';

export default function EmbedPlayer() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const simple = searchParams.get('simple') === '1';

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
      <div className="flex justify-center items-center min-h-screen bg-card">
        <div className="w-6 h-6 border-3 border-secondary/30 border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  if (!species || !species.audio_url) {
    return (
      <div className="bg-card p-4 text-center text-muted-foreground text-sm">
        <p>Audio no disponible</p>
      </div>
    );
  }

  if (simple) {
    // Simple player - just audio controls + basic info
    return (
      <div className="bg-card border border-border rounded-lg p-4 space-y-3" style={{ maxWidth: '340px' }}>
        <audio
          controls
          src={species.audio_url}
          className="w-full"
          style={{ height: '32px' }}
        />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-primary line-clamp-1">
            {species.common_name}
          </p>
          <p className="text-xs italic text-muted-foreground line-clamp-1">
            {species.scientific_name}
          </p>
        </div>
      </div>
    );
  }

  // Sonogram/Spectrogram player - includes the full spectrogram player
  return (
    <div className="bg-card border border-border rounded-lg p-4" style={{ maxWidth: '340px' }}>
      <SpectrogramPlayer
        audioUrl={species.audio_url}
        {...spectrogramSettings(species)}
        altText={`${species.common_name}`}
      />
      <div className="mt-3 space-y-1">
        <p className="text-sm font-semibold text-primary line-clamp-1">
          {species.common_name}
        </p>
        <p className="text-xs italic text-muted-foreground line-clamp-1">
          {species.scientific_name}
        </p>
      </div>
    </div>
  );
}
