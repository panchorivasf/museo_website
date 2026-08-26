import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, ExternalLink, FileDown, GripVertical } from 'lucide-react';
import PublicationForm from '@/components/admin/PublicationForm';
import { scrollToTop } from '@/lib/utils';
import { richTextToPlain } from '@/lib/richText';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * The display order lives in publications.sort_order and there is no separate
 * mode flag: rows with sort_order null are ordered by year, rows with a number
 * are ordered by that number. So "por año" is simply the state where every
 * sort_order is null, and switching to "personalizado" freezes the current year
 * order into numbers that drag-and-drop then rewrites.
 */
export default function AdminPublications() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const queryClient = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin-publications'],
    queryFn: async () => {
      const { data } = await supabase
        .from('publications')
        .select('id, title, authors, venue, year, figure_url, article_url, pdf_url, published, sort_order, created_at')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('year', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  // A local copy so a dropped row stays where it was dropped instead of
  // snapping back while the updates are in flight.
  const [rows, setRows] = useState([]);
  useEffect(() => { setRows(items); }, [items]);

  const isCustom = rows.some(r => r.sort_order != null);

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('publications').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-publications'] });
      queryClient.invalidateQueries({ queryKey: ['publications'] });
      setDeleteTarget(null);
    },
  });

  // Takes [{ id, sort_order }] and writes only the rows whose number changed.
  const orderMutation = useMutation({
    mutationFn: async (updates) => {
      const results = await Promise.all(updates.map(u =>
        supabase.from('publications').update({ sort_order: u.sort_order }).eq('id', u.id)
      ));
      const failed = results.find(r => r.error);
      if (failed) throw failed.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-publications'] });
      queryClient.invalidateQueries({ queryKey: ['publications'] });
    },
    onError: (err) => {
      alert('Error al guardar el orden: ' + (err?.message || 'Por favor intenta de nuevo'));
      queryClient.invalidateQueries({ queryKey: ['admin-publications'] });
    },
  });

  const modeMutation = useMutation({
    mutationFn: async (mode) => {
      if (mode === 'year') {
        const { error } = await supabase
          .from('publications')
          .update({ sort_order: null })
          .not('sort_order', 'is', null);
        if (error) throw error;
        return;
      }
      // Custom: number the rows as they are shown right now, so the manual
      // order starts out identical to the year order the admin was looking at.
      const results = await Promise.all(rows.map((r, i) =>
        supabase.from('publications').update({ sort_order: i }).eq('id', r.id)
      ));
      const failed = results.find(r => r.error);
      if (failed) throw failed.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-publications'] });
      queryClient.invalidateQueries({ queryKey: ['publications'] });
    },
    onError: (err) => {
      alert('Error al cambiar el orden: ' + (err?.message || 'Por favor intenta de nuevo'));
    },
  });

  const switchToYear = () => {
    if (isCustom && !window.confirm('Se perderá el orden personalizado. ¿Continuar?')) return;
    modeMutation.mutate('year');
  };

  const handleDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;

    const next = [...rows];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);

    const previous = new Map(rows.map(r => [r.id, r.sort_order]));
    const renumbered = next.map((r, i) => ({ ...r, sort_order: i }));
    setRows(renumbered);

    const changed = renumbered
      .filter(r => previous.get(r.id) !== r.sort_order)
      .map(r => ({ id: r.id, sort_order: r.sort_order }));
    if (changed.length) orderMutation.mutate(changed);
  };

  const handleEdit = async (lite) => {
    const { data } = await supabase.from('publications').select('*').eq('id', lite.id).single();
    setEditing(data);
    setShowForm(true);
    scrollToTop();
  };
  const handleClose = () => { setShowForm(false); setEditing(null); };

  const busy = modeMutation.isPending || orderMutation.isPending;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-primary">Publicaciones</h2>
          <p className="text-sm text-muted-foreground">{items.length} publicación(es)</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-secondary hover:bg-secondary/90">
          <Plus className="w-4 h-4 mr-2" /> Nueva Publicación
        </Button>
      </div>

      {showForm && <PublicationForm item={editing} onClose={handleClose} />}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-sm text-muted-foreground">Orden del sitio:</span>
        <div className="inline-flex items-center gap-1 rounded-lg border border-border p-1">
          <Button
            type="button"
            size="sm"
            variant={isCustom ? 'ghost' : 'secondary'}
            className="h-7 text-xs"
            disabled={busy}
            onClick={switchToYear}
          >
            Por año
          </Button>
          <Button
            type="button"
            size="sm"
            variant={isCustom ? 'secondary' : 'ghost'}
            className="h-7 text-xs"
            disabled={busy || rows.length === 0}
            onClick={() => { if (!isCustom) modeMutation.mutate('custom'); }}
          >
            Personalizado
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          {isCustom
            ? 'Arrastra las filas para cambiar el orden en que aparecen en el sitio.'
            : 'Las publicaciones se muestran de la más reciente a la más antigua.'}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <DragDropContext onDragEnd={handleDragEnd}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="w-10" />
                    <th className="text-left p-3 font-heading text-xs uppercase tracking-wider text-muted-foreground">Publicación</th>
                    <th className="text-left p-3 font-heading text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell w-24">Enlaces</th>
                    <th className="text-left p-3 font-heading text-xs uppercase tracking-wider text-muted-foreground w-28">Estado</th>
                    <th className="text-right p-3 font-heading text-xs uppercase tracking-wider text-muted-foreground w-24">Acciones</th>
                  </tr>
                </thead>
                <Droppable droppableId="publications">
                  {(dropProvided) => (
                    <tbody ref={dropProvided.innerRef} {...dropProvided.droppableProps}>
                      {rows.map((item, index) => (
                        <Draggable
                          key={item.id}
                          draggableId={item.id}
                          index={index}
                          isDragDisabled={!isCustom}
                        >
                          {(dragProvided, snapshot) => (
                            <tr
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${snapshot.isDragging ? 'bg-muted shadow-lg' : ''}`}
                              style={{
                                ...dragProvided.draggableProps.style,
                                // A row torn out of the table loses its cell
                                // widths; laying it out as its own table keeps
                                // the columns from collapsing mid-drag.
                                display: snapshot.isDragging ? 'table' : undefined,
                              }}
                            >
                              <td className="w-10 pl-3">
                                {isCustom && (
                                  <span
                                    {...dragProvided.dragHandleProps}
                                    className="flex items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing"
                                    aria-label="Reordenar"
                                  >
                                    <GripVertical className="w-4 h-4" />
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-3">
                                  {item.figure_url && (
                                    <img src={item.figure_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                                  )}
                                  <div>
                                    <p className="font-medium text-primary">{richTextToPlain(item.title)}</p>
                                    <p className="text-xs text-muted-foreground line-clamp-1">
                                      {[item.authors, item.venue, item.year].filter(Boolean).join(' · ')}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 hidden sm:table-cell">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  {item.article_url && <ExternalLink className="w-3.5 h-3.5" title="Tiene link al artículo" />}
                                  {item.pdf_url && <FileDown className="w-3.5 h-3.5" title="Tiene PDF" />}
                                </div>
                              </td>
                              <td className="p-3">
                                {item.published
                                  ? <Badge className="bg-secondary text-secondary-foreground text-xs">Publicado</Badge>
                                  : <Badge variant="outline" className="text-xs">Borrador</Badge>}
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(item)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Draggable>
                      ))}
                      {dropProvided.placeholder}
                    </tbody>
                  )}
                </Droppable>
              </table>
            </DragDropContext>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar publicación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará &quot;{richTextToPlain(deleteTarget?.title)}&quot; permanentemente.
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
