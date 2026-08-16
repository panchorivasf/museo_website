import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RecordingForm from '@/components/admin/RecordingForm';
import SpectrogramBulkGenerator from '@/components/admin/SpectrogramBulkGenerator';
import { scrollToTop } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const taxonLabels = {
  aves: 'Aves', insectos: 'Insectos', anfibios: 'Anfibios',
  cetaceos: 'Cetáceos', mamiferos_terrestres: 'Roedores', felinos: 'Felinos',
};

const normalize = (value) => (value || '')
  .toString()
  .toLowerCase()
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '');

export default function AdminRecordings() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [taxonFilter, setTaxonFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['admin-recordings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('map_recordings')
        .select('*, species:species_id(common_name, scientific_name, taxon, spectrogram_min, spectrogram_max, fft_size, spectrogram_image)')
        .order('created_at', { ascending: false })
        .limit(500);
      // Spectrogram settings live on the species; a pin renders its own audio with them.
      return (data || []).map(rec => ({
        ...rec,
        spectrogram_min: rec.species?.spectrogram_min ?? null,
        spectrogram_max: rec.species?.spectrogram_max ?? null,
        fft_size: rec.species?.fft_size ?? null,
        spectrogram_image: rec.spectrogram_image || rec.species?.spectrogram_image || null,
      }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('map_recordings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-recordings'] });
      setDeleteTarget(null);
    },
  });

  const filtered = useMemo(() => {
    const term = normalize(search).trim();
    return recordings.filter(rec => {
      const taxon = rec.species?.taxon || rec.taxon;
      if (taxonFilter !== 'all' && taxon !== taxonFilter) return false;
      if (!term) return true;
      return [
        rec.species?.common_name,
        rec.species?.scientific_name,
        rec.species_name,
        rec.location_name,
        rec.recordist,
      ].some(field => normalize(field).includes(term));
    });
  }, [recordings, search, taxonFilter]);

  const isFiltering = search.trim() !== '' || taxonFilter !== 'all';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-primary">Grabaciones del Mapa</h2>
          <p className="text-sm text-muted-foreground">
            {isFiltering ? `${filtered.length} de ${recordings.length} registro(s)` : `${recordings.length} registro(s)`}
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-secondary hover:bg-secondary/90">
          <Plus className="w-4 h-4 mr-2" /> Agregar Grabación
        </Button>
      </div>

      {showForm && (
        <RecordingForm recording={editing} onClose={() => { setShowForm(false); setEditing(null); }} />
      )}

      <SpectrogramBulkGenerator
        records={recordings}
        table="map_recordings"
        queryKeys={['admin-recordings', 'map-recordings']}
        describe={rec => rec.species?.common_name || rec.species_name || rec.location_name || rec.id}
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por especie, ubicación o grabador..."
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Select value={taxonFilter} onValueChange={setTaxonFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los taxones</SelectItem>
            {Object.entries(taxonLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 font-heading text-xs uppercase tracking-wider text-muted-foreground">Especie</th>
                  <th className="text-left p-3 font-heading text-xs uppercase tracking-wider text-muted-foreground">Taxón</th>
                  <th className="text-left p-3 font-heading text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Ubicación</th>
                  <th className="text-left p-3 font-heading text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Coordenadas</th>
                  <th className="text-right p-3 font-heading text-xs uppercase tracking-wider text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                      {isFiltering ? 'No se encontraron grabaciones con esos criterios.' : 'Aún no hay grabaciones registradas.'}
                    </td>
                  </tr>
                )}
                {filtered.map(rec => (
                  <tr key={rec.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <p className="font-medium text-primary">{rec.species?.common_name || rec.species_name || '—'}</p>
                      {rec.species?.scientific_name && <p className="text-xs italic text-muted-foreground">{rec.species.scientific_name}</p>}
                    </td>
                    <td className="p-3">
                      {(() => {
                        const taxon = rec.species?.taxon || rec.taxon;
                        return taxon ? <Badge variant="outline" className="text-xs">{taxonLabels[taxon] || taxon}</Badge> : '—';
                      })()}
                    </td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground text-xs">{rec.location_name || '—'}</td>
                    <td className="p-3 hidden sm:table-cell font-mono text-xs text-muted-foreground">
                      {rec.latitude?.toFixed(4)}, {rec.longitude?.toFixed(4)}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(rec); setShowForm(true); scrollToTop(); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(rec)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar grabación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la grabación de &quot;{deleteTarget?.species_name}&quot; permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
