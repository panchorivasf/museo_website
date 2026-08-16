import React, { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { BookOpen } from 'lucide-react';
import BulkActionBar from './BulkActionBar';
import { enrichSpeciesFromSources, needsSourceEnrichment } from '@/lib/speciesSources';

/**
 * Completes the external sources of species created before they were fetched
 * automatically: the GBIF taxonomic-source reference and the global IUCN Red List
 * category with its citation. Species already carrying both are skipped.
 */
export default function TaxonomicSourcesBackfill({ species }) {
  const queryClient = useQueryClient();

  const pending = useMemo(() => species.filter(needsSourceEnrichment), [species]);

  const process = async (sp) => {
    const { patch } = await enrichSpeciesFromSources(sp);
    if (!Object.keys(patch).length) return;
    const { error } = await supabase.from('species').update(patch).eq('id', sp.id);
    if (error) throw error;
  };

  return (
    <BulkActionBar
      pending={pending}
      describe={sp => sp.common_name || sp.scientific_name}
      process={process}
      icon={BookOpen}
      note="Consultando GBIF y la Lista Roja de la IUCN para cada especie."
      onFinished={() => {
        queryClient.invalidateQueries({ queryKey: ['admin-species'] });
        queryClient.invalidateQueries({ queryKey: ['species'] });
      }}
      labels={{
        pending: n => `${n} especie(s) sin referencia a GBIF o sin clasificación global IUCN.`,
        action: n => `Completar fuentes (${n})`,
        running: (done, total) => `Consultando fuentes... ${done} de ${total}`,
        done: 'Todas las especies tienen sus fuentes completas.',
      }}
    />
  );
}
