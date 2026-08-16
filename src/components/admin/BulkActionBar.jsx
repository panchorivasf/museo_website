import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';

/**
 * Runs a one-record-at-a-time maintenance task over a list, with progress, a stop
 * button and per-record error reporting.
 *
 * `process` is called with each pending record and may throw: the message is
 * collected and the run continues, so one bad record never aborts the batch.
 * Tasks are expected to be idempotent — the bar only ever offers the outstanding
 * work, so pressing the button again simply retries what is left.
 */
export default function BulkActionBar({ pending, describe, process, onFinished, labels, icon: Icon, note }) {
  const [progress, setProgress] = useState(null); // { running, done, total, failed[] }
  const cancelRef = useRef(false);

  const running = progress?.running;

  const run = async () => {
    cancelRef.current = false;
    const failed = [];
    setProgress({ running: true, done: 0, total: pending.length, failed });

    for (let i = 0; i < pending.length; i++) {
      if (cancelRef.current) break;
      try {
        await process(pending[i]);
      } catch (err) {
        failed.push({ label: describe(pending[i]), message: err.message });
      }
      setProgress({ running: true, done: i + 1, total: pending.length, failed: [...failed] });
    }

    setProgress(prev => ({ ...prev, running: false }));
    onFinished?.();
  };

  if (!pending.length && !progress) return null;

  return (
    <div className="mb-4 rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
          {running
            ? labels.running(progress.done, progress.total)
            : pending.length
              ? labels.pending(pending.length)
              : labels.done}
        </p>
        {running ? (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { cancelRef.current = true; }}>
            <X className="w-3 h-3 mr-1.5" /> Detener
          </Button>
        ) : pending.length > 0 && (
          <Button size="sm" className="h-7 text-xs bg-secondary hover:bg-secondary/90" onClick={run}>
            {Icon && <Icon className="w-3 h-3 mr-1.5" />}
            {labels.action(pending.length)}
          </Button>
        )}
      </div>

      {running && (
        <>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-secondary transition-all"
              style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '0%' }}
            />
          </div>
          {note && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              {note}
            </p>
          )}
        </>
      )}

      {progress?.failed?.length > 0 && (
        <div className="text-xs text-destructive space-y-0.5">
          <p className="font-medium">{progress.failed.length} registro(s) sin completar:</p>
          {progress.failed.map((f, i) => <p key={i}>· {f.label}: {f.message}</p>)}
        </div>
      )}
    </div>
  );
}
