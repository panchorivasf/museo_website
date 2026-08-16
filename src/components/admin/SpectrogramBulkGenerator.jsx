import React, { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { ImageDown } from 'lucide-react';
import BulkActionBar from './BulkActionBar';
import { generateSpectrogramImage, hasFreshSpectrogramImage } from '@/lib/prerenderSpectrogram';

/**
 * Bakes the missing spectrogram pictures for a whole table.
 *
 * Each record is rendered from its own frequency window and FFT size, uploaded to
 * the media bucket and written back to its row. Records that already have a picture
 * matching their current parameters are skipped, so the button only ever does the
 * outstanding work.
 */
export default function SpectrogramBulkGenerator({ records, table, queryKeys, describe }) {
  const queryClient = useQueryClient();

  const pending = useMemo(
    () => records.filter(r => r.audio_url && !hasFreshSpectrogramImage(r)),
    [records],
  );

  const process = async (record) => {
    const meta = await generateSpectrogramImage(record);
    const { error } = await supabase
      .from(table)
      .update({ spectrogram_image: meta })
      .eq('id', record.id);
    if (error) throw error;
  };

  return (
    <BulkActionBar
      pending={pending}
      describe={describe}
      process={process}
      icon={ImageDown}
      note="No cierres esta pestaña: las imágenes se generan en el navegador."
      onFinished={() => queryKeys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }))}
      labels={{
        pending: n => `${n} registro(s) con audio sin imagen de espectrograma guardada.`,
        action: n => `Generar espectrogramas (${n})`,
        running: (done, total) => `Generando espectrogramas... ${done} de ${total}`,
        done: 'Todos los espectrogramas están generados.',
      }}
    />
  );
}
