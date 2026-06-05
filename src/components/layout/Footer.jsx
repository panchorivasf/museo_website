import React from 'react';
import { Link } from 'react-router-dom';
import { AudioWaveform, MapPin, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <AudioWaveform className="w-6 h-6 text-secondary" />
              <span className="font-display text-lg font-semibold tracking-wide">
                Museo Bioacústico
              </span>
            </div>
            <p className="text-primary-foreground/70 text-sm leading-relaxed">
              Poniendo en valor el Patrimonio Acústico Natural de Chile desde Concepción, Biobío.
            </p>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-sm uppercase tracking-widest mb-4 text-secondary">
              Explorar
            </h4>
            <div className="space-y-2">
              <Link to="/coleccion" className="block text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                Colección Sonora
              </Link>
              <Link to="/mapa" className="block text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                Mapa Biofónico
              </Link>
              <Link to="/nosotros" className="block text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                Quiénes Somos
              </Link>
            </div>
          </div>

          <div>
            <h4 className="font-heading font-semibold text-sm uppercase tracking-widest mb-4 text-secondary">
              Contacto
            </h4>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-sm text-primary-foreground/70">
                <MapPin className="w-4 h-4 shrink-0" />
                <span>Concepción, Biobío, Chile</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-primary-foreground/70">
                <Mail className="w-4 h-4 shrink-0" />
                <span>contacto@museobioacustico.cl</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-primary-foreground/10 mt-10 pt-6 text-center">
          <p className="text-xs text-primary-foreground/50">
            © {new Date().getFullYear()} Museo Bioacústico. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}