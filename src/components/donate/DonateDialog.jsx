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
import { Heart, Copy, Check, Landmark } from 'lucide-react';

const BANK_DETAILS = [
  { label: 'Nombre / Beneficiario', value: 'Museo Bioacústico' },
  { label: 'RUT', value: '65.217.977-0' },
  { label: 'Banco', value: 'BancoEstado' },
  { label: 'Tipo de cuenta', value: 'Cuenta RUT (Chequera Electrónica)' },
  { label: 'N° de cuenta', value: '53372371451' },
];

// Chile doesn't use IBAN, so a foreign bank routes by SWIFT/BIC + the details
// above. The bank's registered address is sometimes requested too — we don't
// have that on file, so international donors are pointed to email as a fallback.
const SWIFT_DETAIL = { label: 'Código SWIFT / BIC', value: 'BECHCLRMXXX' };

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
          <div className="flex gap-2.5 rounded-lg border border-secondary/30 bg-secondary/10 px-3 py-2.5">
            <Landmark className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
            <p className="text-xs text-foreground leading-relaxed">
              <span className="font-medium">Beneficio tributario:</span> Corporación Museo
              Bioacústico está inscrita como emisora bajo la Ley de Donaciones Culturales
              (Ley 18.985). Si quieres tu certificado de donación, escríbenos a{' '}
              <a
                href="mailto:contacto@museobioacustico.org"
                className="underline underline-offset-2"
              >
                contacto@museobioacustico.org
              </a>{' '}
              con tu RUT, nombre completo y el comprobante de la transferencia.
            </p>
          </div>

          <p className="text-sm font-medium text-foreground">Transferencia bancaria (Chile)</p>
          <div className="space-y-2">
            {BANK_DETAILS.map(field => (
              <CopyField key={field.label} {...field} />
            ))}
          </div>

          <div className="pt-1">
            <p className="text-sm font-medium text-foreground mb-2">
              ¿Donas desde fuera de Chile?
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-2">
              Usa los mismos datos de arriba junto con este código SWIFT/BIC de BancoEstado:
            </p>
            <CopyField {...SWIFT_DETAIL} />
          </div>

          <div className="rounded-lg bg-muted/40 border border-border px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
            Algunos bancos también piden la dirección registrada del banco receptor. Si la tuya la
            solicita, o si tienes dudas sobre la transferencia, escríbenos a{' '}
            <a
              href="mailto:contacto@museobioacustico.org"
              className="text-primary underline underline-offset-2"
            >
              contacto@museobioacustico.org
            </a>{' '}
            y te ayudamos a coordinarla.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
