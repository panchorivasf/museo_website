import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ArticleForm from './ArticleForm';
import { scrollToTop } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * Generic admin CRUD list for block-based articles, reused by Blog and Conceptos.
 */
export default function AdminArticleList({
  table,
  basePath,
  adminQueryKey,
  publicQueryKey,
  title,
  entityLabel,
  entityLabelNew,
  entityLabelPluralLower,
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const queryClient = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: [adminQueryKey],
    queryFn: async () => {
      const { data } = await supabase
        .from(table)
        .select('id, title, subtitle, slug, cover_image_url, published, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [adminQueryKey] });
      setDeleteTarget(null);
    },
  });

  const handleEdit = async (postLite) => {
    const { data } = await supabase.from(table).select('*').eq('id', postLite.id).single();
    setEditing(data);
    setShowForm(true);
    scrollToTop();
  };
  const handleClose = () => { setShowForm(false); setEditing(null); };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-primary">{title}</h2>
          <p className="text-sm text-muted-foreground">{posts.length} {entityLabelPluralLower}</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-secondary hover:bg-secondary/90">
          <Plus className="w-4 h-4 mr-2" /> {entityLabelNew}
        </Button>
      </div>

      {showForm && (
        <ArticleForm
          item={editing}
          onClose={handleClose}
          table={table}
          basePath={basePath}
          adminQueryKey={adminQueryKey}
          publicQueryKey={publicQueryKey}
          entityLabel={entityLabel}
          entityLabelNew={entityLabelNew}
        />
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
                  <th className="text-left p-3 font-heading text-xs uppercase tracking-wider text-muted-foreground">{entityLabel}</th>
                  <th className="text-left p-3 font-heading text-xs uppercase tracking-wider text-muted-foreground hidden sm:table-cell">URL</th>
                  <th className="text-left p-3 font-heading text-xs uppercase tracking-wider text-muted-foreground">Estado</th>
                  <th className="text-right p-3 font-heading text-xs uppercase tracking-wider text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {posts.map(post => (
                  <tr key={post.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {post.cover_image_url && (
                          <img src={post.cover_image_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        )}
                        <div>
                          <p className="font-medium text-primary">{post.title}</p>
                          {post.subtitle && <p className="text-xs text-muted-foreground line-clamp-1">{post.subtitle}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 hidden sm:table-cell text-xs font-mono text-muted-foreground">{basePath}/{post.slug}</td>
                    <td className="p-3">
                      {post.published
                        ? <Badge className="bg-secondary text-secondary-foreground text-xs">Publicado</Badge>
                        : <Badge variant="outline" className="text-xs">Borrador</Badge>}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(post)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(post)}>
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
            <AlertDialogTitle>¿Eliminar {entityLabel.toLowerCase()}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará &quot;{deleteTarget?.title}&quot; permanentemente.
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
