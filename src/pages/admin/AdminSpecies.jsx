import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SpeciesForm from '@/components/admin/SpeciesForm';
import SpectrogramBulkGenerator from '@/components/admin/SpectrogramBulkGenerator';
import TaxonomicSourcesBackfill from '@/components/admin/TaxonomicSourcesBackfill';
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

export default function AdminSpecies() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [taxonFilter, setTaxonFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data: species = [], isLoading } = useQuery({
    queryKey: ['admin-species'],
    queryFn: async () => {
      const { data } = await supabase
        .from('species')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('species').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-species'] });
      setDeleteTarget(null);
    },
  });

  const handleEdit = (sp) => { setEditing(sp); setShowForm(true); scrollToTop(); };
  const handleClose = () => { setShowForm(false); setEditing(null); };

  const filtered = useMemo(() => {
    const term = normalize(search).trim();
    return species.filter(sp => {
      if (taxonFilter !== 'all' && sp.taxon !== taxonFilter) return false;
      if (!term) return true;
      return [sp.common_name, sp.scientific_name, sp.genus, sp.family, sp.order]
        .some(field => normalize(field).includes(term));
    });
  }, [species, search, taxonFilter]);

  const isFiltering = search.trim() !== '' || taxonFilter !== 'all';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-primary">Especies</h2>
          <p className="text-sm text-muted-foreground">
            {isFiltering ? `${filtered.length} de ${species.length} registro(s)` : `${species.length} registro(s)`}
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-secondary hover:bg-secondary/90">
          <Plus className="w-4 h-4 mr-2" /> Agregar Especie
        </Button>
      </div>

      {showForm && <SpeciesForm species={editing} onClose={handleClose} />}

      <SpectrogramBulkGenerator
        records={species}
        table="species"
        queryKeys={['admin-species', 'species', 'featured-species', 'map-recordings']}
        describe={sp => sp.common_name || sp.scientific_name}
      />

      <TaxonomicSourcesBackfill species={species} />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre común, científico, género, familia u orden..."
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
                  <th className="text-left p-3 font-heading text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Localidad</th>
                  <th className="text-left p-3 font-heading text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Grabador(a)</th>
                  <th className="text-left p-3 font-heading text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Destacada</th>
                  <th className="text-right p-3 font-heading text-xs uppercase tracking-wider text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                      {isFiltering ? 'No se encontraron especies con esos criterios.' : 'Aún no hay especies registradas.'}
                    </td>
                  </tr>
                )}
                {filtered.map(sp => (
                  <tr key={sp.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {sp.image_url && (
                          <img src={sp.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        )}
                        <div>
                          <p className="font-medium text-primary">{sp.common_name}</p>
                          <p className="text-xs italic text-muted-foreground">{sp.scientific_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">{taxonLabels[sp.taxon] || sp.taxon}</Badge>
                    </td>
                    <td className="p-3 hidden md:table-cell max-w-[200px]">
                      {sp.recording_location
                        ? <span className="text-xs text-muted-foreground">{sp.recording_location}</span>
                        : <span className="text-xs text-muted-foreground/50">—</span>}
                    </td>
                    <td className="p-3 hidden lg:table-cell max-w-[160px]">
                      {sp.recordist
                        ? <span className="text-xs text-muted-foreground">{sp.recordist}</span>
                        : <span className="text-xs text-muted-foreground/50">—</span>}
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      {sp.featured
                        ? <span className="text-xs text-ocher">★ Sí</span>
                        : <span className="text-xs text-muted-foreground/50">No</span>}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(sp)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(sp)}>
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
            <AlertDialogTitle>¿Eliminar especie?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará &quot;{deleteTarget?.common_name}&quot; permanentemente.
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
