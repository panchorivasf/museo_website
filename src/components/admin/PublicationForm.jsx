import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { X, Upload, Loader2, Trash2 } from 'lucide-react';
import { richTextToNull } from '@/lib/richText';

// Superscript/subscript are here for the notation abstracts actually use
// (kHz ranges, m2, CO2, exponents); italics carry the scientific names.
const abstractModules = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ script: 'super' }, { script: 'sub' }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};

// A caption is a single short line, so it gets inline marks only -- no lists.
const captionModules = {
  toolbar: [
    ['bold', 'italic'],
    [{ script: 'super' }, { script: 'sub' }],
    ['link'],
    ['clean'],
  ],
};

async function uploadFile(file) {
  const ext = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(fileName, file, { cacheControl: '3600' });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);
  return { url: publicUrl, originalName: file.name };
}

const EMPTY = {
  title: '',
  authors: '',
  venue: '',
  year: '',
  abstract: '',
  figure_url: '',
  figure_caption: '',
  article_url: '',
  pdf_url: '',
  published: false,
};

export default function PublicationForm({ item, onClose }) {
  const isEditing = !!item;
  const queryClient = useQueryClient();

  const [form, setForm] = useState(() => {
    if (!item) return EMPTY;
    return Object.fromEntries(
      Object.keys(EMPTY).map(k => [k, item[k] ?? EMPTY[k]])
    );
  });
  const [uploadingFigure, setUploadingFigure] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfName, setPdfName] = useState('');

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleFigureUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFigure(true);
    try {
      const { url } = await uploadFile(file);
      update('figure_url', url);
    } catch (err) {
      alert('Error al subir la figura: ' + err.message);
    } finally {
      setUploadingFigure(false);
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    try {
      const { url, originalName } = await uploadFile(file);
      update('pdf_url', url);
      setPdfName(originalName);
    } catch (err) {
      alert('Error al subir el PDF: ' + err.message);
    } finally {
      setUploadingPdf(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        // Empty text inputs are stored as null rather than '' so the public page's
        // truthiness checks (which decide whether to render each block) hold.
        authors: form.authors || null,
        venue: form.venue || null,
        abstract: richTextToNull(form.abstract),
        figure_url: form.figure_url || null,
        figure_caption: richTextToNull(form.figure_caption),
        article_url: form.article_url || null,
        pdf_url: form.pdf_url || null,
        year: form.year === '' || form.year == null ? null : parseInt(form.year, 10),
      };
      if (isEditing) {
        const { error } = await supabase.from('publications').update(payload).eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('publications').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-publications'] });
      queryClient.invalidateQueries({ queryKey: ['publications'] });
      onClose();
    },
    onError: (err) => {
      alert('Error al guardar: ' + (err?.message || 'Por favor intenta de nuevo'));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-heading font-semibold text-primary text-lg">
          {isEditing ? 'Editar Publicación' : 'Nueva Publicación'}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label>Título *</Label>
          <Input value={form.title} onChange={e => update('title', e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label>Autores</Label>
          <Input
            value={form.authors}
            onChange={e => update('authors', e.target.value)}
            placeholder="ej: Rivas F., Pérez M., González A."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Revista / Editorial</Label>
            <Input
              value={form.venue}
              onChange={e => update('venue', e.target.value)}
              placeholder="ej: Bioacoustics"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Año</Label>
            <Input
              type="number"
              value={form.year}
              onChange={e => update('year', e.target.value)}
              placeholder="2026"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Resumen (abstract)</Label>
          <div className="bg-background">
            <ReactQuill
              theme="snow"
              modules={abstractModules}
              value={form.abstract}
              onChange={html => update('abstract', html)}
            />
          </div>
        </div>

        {/* Figure */}
        <div className="space-y-1.5">
          <Label>Figura</Label>
          {form.figure_url ? (
            <div className="flex items-start gap-3">
              <img src={form.figure_url} alt="" className="w-40 rounded-lg border border-border object-cover" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => update('figure_url', '')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 w-fit">
              {uploadingFigure ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploadingFigure ? 'Subiendo...' : 'Subir figura'}
              <input type="file" accept="image/*" className="hidden" onChange={handleFigureUpload} disabled={uploadingFigure} />
            </label>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Leyenda de la figura</Label>
          <div className="bg-background">
            <ReactQuill
              theme="snow"
              modules={captionModules}
              value={form.figure_caption}
              onChange={html => update('figure_caption', html)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Link al artículo</Label>
          <Input
            type="url"
            value={form.article_url}
            onChange={e => update('article_url', e.target.value)}
            placeholder="https://doi.org/..."
          />
        </div>

        {/* PDF */}
        <div className="space-y-1.5">
          <Label>PDF</Label>
          {form.pdf_url ? (
            <div className="flex items-center gap-3">
              <a
                href={form.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-secondary underline break-all"
              >
                {pdfName || form.pdf_url}
              </a>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive shrink-0"
                onClick={() => { update('pdf_url', ''); setPdfName(''); }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 w-fit">
              {uploadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploadingPdf ? 'Subiendo...' : 'Subir PDF'}
              <input type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} disabled={uploadingPdf} />
            </label>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={form.published} onCheckedChange={v => update('published', v)} />
          <Label className="cursor-pointer">Publicado</Label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="bg-secondary hover:bg-secondary/90" disabled={mutation.isPending}>
            {mutation.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
