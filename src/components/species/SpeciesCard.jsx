import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

const taxonLabels = {
  aves: 'Aves',
  insectos: 'Insectos',
  anfibios: 'Anfibios',
  mamiferos_marinos: 'Mamíferos Marinos',
  mamiferos_terrestres: 'Mamíferos Terrestres',
};

const taxonColors = {
  aves: 'bg-teal text-teal-foreground',
  insectos: 'bg-accent text-accent-foreground',
  anfibios: 'bg-secondary text-secondary-foreground',
  mamiferos_marinos: 'bg-primary text-primary-foreground',
  mamiferos_terrestres: 'bg-ocher text-ocher-foreground',
};

export default function SpeciesCard({ species }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
    >
      <Link
        to={`/especie/${species.id}`}
        className="block group rounded-xl overflow-hidden bg-card border border-border shadow-sm hover:shadow-lg transition-shadow duration-300"
      >
        <div className="aspect-[4/3] overflow-hidden bg-muted relative">
          {species.image_url ? (
            <img
              src={species.image_url}
              alt={species.common_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <span className="text-4xl">🔊</span>
            </div>
          )}
          <Badge className={`absolute top-3 left-3 ${taxonColors[species.taxon] || 'bg-muted text-muted-foreground'} text-[10px] uppercase tracking-widest font-heading`}>
            {taxonLabels[species.taxon] || species.taxon}
          </Badge>
        </div>
        <div className="p-4">
          <h3 className="font-heading font-semibold text-lg text-primary leading-tight">
            {species.common_name}
          </h3>
          <p className="text-sm italic text-muted-foreground mt-0.5">
            {species.scientific_name}
          </p>
          {species.frequency_range && (
            <p className="text-xs font-mono text-muted-foreground/70 mt-2">
              {species.frequency_range}
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}