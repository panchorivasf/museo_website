import React from 'react';
import { Bird, Bug, Rat } from 'lucide-react';
import { WhaleTail, Frog } from '@/components/icons/TaxonIcons';
import { Button } from '@/components/ui/button';

const taxa = [
  { key: 'all', label: 'Todos', icon: null },
  { key: 'aves', label: 'Aves', icon: Bird },
  { key: 'insectos', label: 'Insectos', icon: Bug },
  { key: 'anfibios', label: 'Anfibios', icon: Frog },
  { key: 'cetaceos', label: 'Cetáceos', icon: WhaleTail },
  { key: 'mamiferos_terrestres', label: 'Roedores', icon: Rat },
];

export default function TaxonFilter({ selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {taxa.map(t => {
        const isActive = selected === t.key;
        const Icon = t.icon;
        return (
          <Button
            key={t.key}
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => onChange(t.key)}
            className={`rounded-full font-heading text-xs tracking-wide ${
              isActive ? 'bg-secondary text-secondary-foreground hover:bg-secondary/90' : ''
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 mr-1.5" />}
            {t.label}
          </Button>
        );
      })}
    </div>
  );
}
