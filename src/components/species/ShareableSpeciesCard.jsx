import React, { useRef } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AudioWaveform } from 'lucide-react';

export default function ShareableSpeciesCard({ species, spectrogram, onClose }) {
  const cardRef = useRef(null);

  const downloadAsImage = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${species.common_name.replace(/\s+/g, '_')}_preview.png`;
      link.click();
    } catch (err) {
      alert('Error al descargar: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-heading font-semibold text-primary">Vista previa para compartir</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-8 overflow-y-auto max-h-[80vh]">
          {/* Shareable Card */}
          <div
            ref={cardRef}
            className="bg-gradient-to-b from-primary to-primary/90 rounded-2xl p-8 space-y-6 text-white"
            style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}
          >
            {/* Logo */}
            <div className="flex items-center justify-center">
              <div className="flex items-center gap-3">
                <AudioWaveform className="w-8 h-8 text-secondary" />
                <span className="text-xl font-display font-bold tracking-wide">
                  Museo Bioacústico
                </span>
              </div>
            </div>

            {/* Species Name */}
            <div className="text-center space-y-2 border-b border-white/20 pb-6">
              <h2 className="text-3xl font-display font-bold leading-tight">
                {species.common_name}
              </h2>
              <p className="text-lg italic text-white/80">
                {species.scientific_name}
              </p>
            </div>

            {/* Species Image */}
            {species.image_url && (
              <div className="rounded-xl overflow-hidden aspect-video bg-white/10">
                <img
                  src={species.image_url}
                  alt={species.common_name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Spectrogram */}
            {spectrogram && (
              <div className="rounded-xl overflow-hidden bg-white/10 p-2">
                <img
                  src={spectrogram}
                  alt="Spectrogram"
                  className="w-full h-auto"
                />
              </div>
            )}

            {/* Additional Info */}
            <div className="space-y-2 text-sm text-white/80 border-t border-white/20 pt-6">
              {species.recording_location && (
                <div>
                  <span className="font-semibold">Lugar:</span> {species.recording_location}
                </div>
              )}
              {species.recordist && (
                <div>
                  <span className="font-semibold">Grabado por:</span> {species.recordist}
                </div>
              )}
              {(species.frequency_min || species.frequency_max) && (
                <div>
                  <span className="font-semibold">Frecuencia:</span>{' '}
                  {species.frequency_min && species.frequency_max
                    ? `${species.frequency_min}–${species.frequency_max} kHz`
                    : `${species.frequency_min || species.frequency_max} kHz`}
                </div>
              )}
              <div className="text-xs pt-2">
                Descubre más en: museobioacustico.org
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t bg-muted">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={downloadAsImage} className="bg-secondary hover:bg-secondary/90">
            <Download className="w-4 h-4 mr-2" />
            Descargar como imagen
          </Button>
        </div>
      </div>
    </div>
  );
}
