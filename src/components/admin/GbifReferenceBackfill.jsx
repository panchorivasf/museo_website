import React, { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { BookOpen } from 'lucide-react';
import BulkActionBar from './BulkActionBar';
import { hasGbifReference, referencesWithGbif } from '@/lib/gbif';

/**
 * Adds the GBIF taxonomic-source reference to species created before it was added
 * automatically. Species that already cite GBIF are skipped.
 */
export default function GbifReferenceBackfill({ species }) {
  const queryClient = useQueryClient();

  const pending = useMemo(
    () => species.filter(sp => sp.scientific_name?.trim() && !hasGbifReference(sp.references)),
    [species],
  );

  const process = async (sp) => {
    const references = await referencesWithGbif(sp);
    if (!references) return;
    const { error } = await supabase.from('species').update({ references }).eq('id', sp.id);
    if (error) throw error;
  };

  return (
    <BulkActionBar
      pending={pending}
      describe={sp => sp.common_name || sp.scientific_name}
      process={process}
      icon={BookOpen}
      note="Consultando GBIF para cada especie."
      onFinished={() => {
        queryClient.invalidateQueries({ queryKey: ['admin-species'] });
        queryClient.invalidateQueries({ queryKey: ['species'] });
      }}
      labels={{
        pending: n => `${n} especie(s) sin referencia a GBIF en su lista de referencias.`,
        action: n => `Agregar referencia GBIF (${n})`,
        running: (done, total) => `Agregando referencias de GBIF... ${done} de ${total}`,
        done: 'Todas las especies citan su fuente taxonómica.',
      }}
    />
  );
}
