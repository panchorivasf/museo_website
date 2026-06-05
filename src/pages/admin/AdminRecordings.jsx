import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import RecordingForm from '@/components/admin/RecordingForm';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const taxonLabels = {
  aves: 'Aves', insectos: 'Insectos', anfibios: 'Anfibios',
  cetaceos: 'Cetáceos', focas: 'Focas', nutrias: 'Nutrias', mamiferos_terrestres: 'M. Terrestres',
};

export default function AdminRecordings() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const queryClient = useQueryClient();

  const { data: recordings = [], isLoading } = useQuery({
    queryKey: ['admin-recordings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('map_recordings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      return data || [];
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-primary">Grabaciones del Mapa</h2>
          <p className="text-sm text-muted-foreground">{recordings.length} registro(s)</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-secondary hover:bg-secondary/90">
          <Plus className="w-4 h-4 mr-2" /> Agregar Grabación
        </Button>
      </div>

      {showForm && (
        <RecordingForm recording={editing} onClose={() => { setShowForm(false); setEditing(null); }} />
      )}

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
                {recordings.map(rec => (
                  <tr key={rec.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <p className="font-medium text-primary">{rec.species_name}</p>
                      {rec.scientific_name && <p className="text-xs italic text-muted-foreground">{rec.scientific_name}</p>}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs">{taxonLabels[rec.taxon] || rec.taxon}</Badge>
                    </td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground text-xs">{rec.location_name || '—'}</td>
                    <td className="p-3 hidden sm:table-cell font-mono text-xs text-muted-foreground">
                      {rec.latitude?.toFixed(4)}, {rec.longitude?.toFixed(4)}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(rec); setShowForm(true); }}>
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
