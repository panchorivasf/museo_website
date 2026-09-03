import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Heart, Copy, Check } from 'lucide-react';

// Local (Chile) bank transfer details only — no SWIFT/IBAN on file yet.
// International donors are pointed to email so we can coordinate case by case.
const BANK_DETAILS = [
  { label: 'Nombre / Beneficiario', value: 'Museo Bioacústico' },
  { label: 'RUT', value: '65.217.977-0' },
  { label: 'Banco', value: 'BancoEstado' },
  { label: 'Tipo de cuenta', value: 'Cuenta RUT (Chequera Electrónica)' },
  { label: 'N° de cuenta', value: '53372371451' },
];

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — user can still select/copy manually.
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0 h-8 w-8"
        onClick={handleCopy}
        title="Copiar"
      >
        {copied ? <Check className="w-4 h-4 text-secondary" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
  );
}

/**
 * Donation button + dialog. Pass a custom `trigger` element to override the
 * default "Donar" button (e.g. for a text link inside the footer).
 */
export default function DonateDialog({ trigger }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="bg-ocher text-ocher-foreground hover:bg-ocher/90 shadow gap-1.5">
            <Heart className="w-4 h-4" />
            Donar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-ocher" />
            Apoya al Museo Bioacústico
          </DialogTitle>
          <DialogDescription>
            Tu donación nos ayuda a seguir registrando, documentando y difundiendo el patrimonio
            acústico natural de Chile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Transferencia bancaria (Chile)</p>
          <div className="space-y-2">
            {BANK_DETAILS.map(field => (
              <CopyField key={field.label} {...field} />
            ))}
          </div>

          <div className="rounded-lg bg-muted/40 border border-border px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
            <p className="font-medium text-foreground mb-1">¿Donas desde fuera de Chile?</p>
            <p>
              Una transferencia internacional a esta cuenta requiere datos adicionales (código
              SWIFT, dirección del banco) que aún no publicamos aquí. Escríbenos a{' '}
              <a
                href="mailto:contacto@museobioacustico.org"
                className="text-primary underline underline-offset-2"
              >
                contacto@museobioacustico.org
              </a>{' '}
              y coordinamos la mejor forma de recibir tu aporte.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
