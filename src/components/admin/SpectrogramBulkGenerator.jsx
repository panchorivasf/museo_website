import React, { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { ImageDown, Loader2, X } from 'lucide-react';
import { generateSpectrogramImage, hasFreshSpectrogramImage } from '@/lib/prerenderSpectrogram';

/**
 * Bakes the missing spectrogram pictures for a whole table, one record at a time.
 *
 * Each record is rendered from its own frequency window and FFT size, uploaded to
 * the media bucket and written back to its row. Records that already have a picture
 * matching their current parameters are skipped, so the button can be pressed again
 * safely — it only ever does the outstanding work.
 */
export default function SpectrogramBulkGenerator({ records, table, queryKeys, describe }) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(null); // { done, total, failed: [] }
  const cancelRef = useRef(false);

  const pending = useMemo(
    () => records.filter(r => r.audio_url && !hasFreshSpectrogramImage(r)),
    [records],
  );

  const running = progress?.running;

  const run = async () => {
    cancelRef.current = false;
    const failed = [];
    setProgress({ running: true, done: 0, total: pending.length, failed });

    for (let i = 0; i < pending.length; i++) {
      if (cancelRef.current) break;
      const record = pending[i];
      try {
        const meta = await generateSpectrogramImage(record);
        const { error } = await supabase
          .from(table)
          .update({ spectrogram_image: meta })
          .eq('id', record.id);
        if (error) throw error;
      } catch (err) {
        // One bad file must not abort the batch — collect and keep going.
        failed.push({ label: describe(record), message: err.message });
      }
      setProgress({ running: true, done: i + 1, total: pending.length, failed: [...failed] });
    }

    setProgress(prev => ({ ...prev, running: false }));
    queryKeys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
  };

  if (!pending.length && !progress) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <ImageDown className="w-3.5 h-3.5 shrink-0" />
          {running
            ? `Generando espectrogramas... ${progress.done} de ${progress.total}`
            : pending.length
              ? `${pending.length} registro(s) con audio sin imagen de espectrograma guardada.`
              : 'Todos los espectrogramas están generados.'}
        </p>
        {running ? (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { cancelRef.current = true; }}>
            <X className="w-3 h-3 mr-1.5" /> Detener
          </Button>
        ) : pending.length > 0 && (
          <Button size="sm" className="h-7 text-xs bg-secondary hover:bg-secondary/90" onClick={run}>
            <ImageDown className="w-3 h-3 mr-1.5" /> Generar espectrogramas ({pending.length})
          </Button>
        )}
      </div>

      {running && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-secondary transition-all"
            style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '0%' }}
          />
        </div>
      )}

      {running && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          No cierres esta pestaña: las imágenes se generan en el navegador.
        </p>
      )}

      {progress?.failed?.length > 0 && (
        <div className="text-xs text-destructive space-y-0.5">
          <p className="font-medium">{progress.failed.length} registro(s) fallaron:</p>
          {progress.failed.map((f, i) => <p key={i}>· {f.label}: {f.message}</p>)}
        </div>
      )}
    </div>
  );
}
