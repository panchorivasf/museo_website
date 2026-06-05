import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import SpeciesCard from '@/components/species/SpeciesCard';
import TaxonFilter from '@/components/species/TaxonFilter';

export default function Collection() {
  const [taxon, setTaxon] = useState('all');
  const [search, setSearch] = useState('');

  const { data: species = [], isLoading } = useQuery({
    queryKey: ['species'],
    queryFn: async () => {
      const { data } = await supabase
        .from('species')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  const filtered = species.filter(sp => {
    const matchTaxon = taxon === 'all' || sp.taxon === taxon;
    const matchSearch = !search ||
      sp.common_name?.toLowerCase().includes(search.toLowerCase()) ||
      sp.scientific_name?.toLowerCase().includes(search.toLowerCase());
    return matchTaxon && matchSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <span className="text-xs font-heading uppercase tracking-[0.25em] text-secondary font-medium">
          Archivo Sonoro
        </span>
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-primary mt-1">
          Colección de Especies
        </h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Explora nuestra colección de grabaciones bioacústicas de la fauna chilena.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar especie..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <TaxonFilter selected={taxon} onChange={setTaxon} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-secondary/30 border-t-secondary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg">No se encontraron especies</p>
          <p className="text-sm mt-1">Intenta con otro filtro o término de búsqueda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(sp => (
            <SpeciesCard key={sp.id} species={sp} />
          ))}
        </div>
      )}
    </div>
  );
}
