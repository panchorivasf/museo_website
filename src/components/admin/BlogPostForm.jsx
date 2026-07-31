import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { X, Upload, Loader2, Type, Image as ImageIcon, AudioLines, MapPinned, ArrowUp, ArrowDown, Trash2, Plus } from 'lucide-react';
import SpectrogramPlayer from '@/components/audio/SpectrogramPlayer';
import MultiLocationPicker from './MultiLocationPicker';

const quillModules = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline'],
    [{ list: 'ordered' }, { list: 'bullet' }],
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

const DIACRITICS_RE = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(DIACRITICS_RE, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

let blockIdCounter = 0;
const nextBlockId = () => `b${Date.now()}-${blockIdCounter++}`;

function TextBlock({ block, onChange }) {
  return (
    <div className="bg-background">
      <ReactQuill
        theme="snow"
        modules={quillModules}
        value={block.html}
        onChange={html => onChange({ ...block, html })}
      />
    </div>
  );
}

function ImageBlock({ block, onChange }) {
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadFile(file);
      onChange({ ...block, url });
    } catch (err) {
      alert('Error al subir imagen: ' + err.message);
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="space-y-2">
      {block.url && <img src={block.url} alt="" className="w-full max-h-80 object-contain rounded-lg border border-border" />}
      <label className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors text-sm w-fit">
        <Upload className="w-4 h-4" />
        {uploading ? 'Subiendo...' : block.url ? 'Cambiar imagen' : 'Subir imagen'}
        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>
      <Input
        value={block.caption || ''}
        onChange={e => onChange({ ...block, caption: e.target.value })}
        placeholder="Pie de foto (opcional)"
        className="text-sm"
      />
    </div>
  );
}

function AudioBlock({ block, onChange }) {
  const [uploading, setUploading] = useState(false);
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url, originalName } = await uploadFile(file);
      onChange({ ...block, url, originalName });
    } catch (err) {
      alert('Error al subir audio: ' + err.message);
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="space-y-2">
      <Input
        value={block.title || ''}
        onChange={e => onChange({ ...block, title: e.target.value })}
        placeholder="Título de la grabación (opcional)"
        className="text-sm"
      />
      <label className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors text-sm w-fit">
        <Upload className="w-4 h-4" />
        {uploading ? 'Subiendo...' : block.url ? 'Cambiar audio' : 'Subir audio'}
        <input type="file" accept="audio/*" className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>
      {block.originalName && <p className="text-xs text-muted-foreground">Archivo original: {block.originalName}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Espectrograma mín. (kHz)</Label>
          <Input
            type="number" step="0.001" min="0"
            value={block.spectrogramMin ?? 0}
            onChange={e => onChange({ ...block, spectrogramMin: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Espectrograma máx. (kHz)</Label>
          <Input
            type="number" step="0.1" min="0"
            value={block.spectrogramMax ?? ''}
            onChange={e => onChange({ ...block, spectrogramMax: e.target.value })}
            placeholder="ej: 10"
          />
        </div>
      </div>
      {block.url && (
        <SpectrogramPlayer
          key={`${block.url}-${block.spectrogramMin}-${block.spectrogramMax}`}
          audioUrl={block.url}
          spectrogramMin={block.spectrogramMin}
          spectrogramMax={block.spectrogramMax}
          altText={block.title || 'Espectrograma'}
        />
      )}
    </div>
  );
}

function MapBlock({ block, onChange }) {
  return (
    <MultiLocationPicker
      points={block.points || []}
      onChange={points => onChange({ ...block, points })}
    />
  );
}

const blockRenderers = {
  text: TextBlock,
  image: ImageBlock,
  audio: AudioBlock,
  map: MapBlock,
};

const blockLabels = {
  text: { label: 'Texto', icon: Type },
  image: { label: 'Imagen', icon: ImageIcon },
  audio: { label: 'Grabación', icon: AudioLines },
  map: { label: 'Mapa', icon: MapPinned },
};

function newBlock(type) {
  const base = { id: nextBlockId(), type };
  if (type === 'text') return { ...base, html: '' };
  if (type === 'image') return { ...base, url: '', caption: '' };
  if (type === 'audio') return { ...base, url: '', title: '', spectrogramMin: 0, spectrogramMax: '' };
  if (type === 'map') return { ...base, points: [] };
  return base;
}

export default function BlogPostForm({ post, onClose }) {
  const isEditing = !!post;
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(isEditing);

  const [form, setForm] = useState({
    title: post?.title || '',
    subtitle: post?.subtitle || '',
    slug: post?.slug || '',
    cover_image_url: post?.cover_image_url || '',
    published: post?.published || false,
  });

  const [blocks, setBlocks] = useState(
    post?.content?.length ? post.content.map(b => ({ ...b, id: b.id || nextBlockId() })) : [newBlock('text')]
  );

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleTitleChange = (value) => {
    update('title', value);
    if (!slugTouched) update('slug', slugify(value));
  };

  const updateBlock = (idx, updated) => {
    setBlocks(prev => prev.map((b, i) => (i === idx ? updated : b)));
  };

  const addBlock = (type) => setBlocks(prev => [...prev, newBlock(type)]);

  const removeBlock = (idx) => setBlocks(prev => prev.filter((_, i) => i !== idx));

  const moveBlock = (idx, dir) => {
    setBlocks(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadFile(file);
      update('cover_image_url', url);
    } catch (err) {
      alert('Error al subir imagen: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const numericBlocks = blocks.map(b => {
        if (b.type !== 'audio') return b;
        return {
          ...b,
          spectrogramMin: b.spectrogramMin === '' || b.spectrogramMin == null ? null : parseFloat(b.spectrogramMin),
          spectrogramMax: b.spectrogramMax === '' || b.spectrogramMax == null ? null : parseFloat(b.spectrogramMax),
        };
      });
      const payload = { ...form, content: numericBlocks };
      if (isEditing) {
        const { error } = await supabase.from('blog_posts').update(payload).eq('id', post.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('blog_posts').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-posts'] });
      queryClient.invalidateQueries({ queryKey: ['blog-posts'] });
      onClose();
    },
    onError: (err) => {
      alert('Error al guardar: ' + (err?.message || 'Por favor intenta de nuevo'));
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.slug.trim()) {
      alert('El slug (URL) no puede estar vacío.');
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-heading font-semibold text-primary text-lg">
          {isEditing ? 'Editar Entrada' : 'Nueva Entrada'}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label>Título *</Label>
          <Input value={form.title} onChange={e => handleTitleChange(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Subtítulo</Label>
          <Input value={form.subtitle} onChange={e => update('subtitle', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>URL (slug) *</Label>
          <Input
            value={form.slug}
            onChange={e => { setSlugTouched(true); update('slug', slugify(e.target.value)); }}
            required
          />
          <p className="text-xs text-muted-foreground">Se publicará en /blog/{form.slug || '...'}</p>
        </div>

        <div className="space-y-1.5">
          <Label>Imagen de portada</Label>
          {form.cover_image_url && (
            <img src={form.cover_image_url} alt="" className="w-full h-40 object-cover rounded-lg mb-2" />
          )}
          <label className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors text-sm w-fit">
            <Upload className="w-4 h-4" />
            {uploading ? 'Subiendo...' : 'Subir portada'}
            <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={uploading} />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Switch checked={form.published} onCheckedChange={v => update('published', v)} />
          <Label>Publicada (visible al público)</Label>
        </div>

        <div className="space-y-3 border-t border-border pt-5">
          <p className="text-xs font-heading uppercase tracking-widest text-muted-foreground font-semibold">Contenido</p>
          {blocks.map((block, idx) => {
            const Renderer = blockRenderers[block.type];
            const { label, icon: Icon } = blockLabels[block.type];
            return (
              <div key={block.id} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-heading uppercase tracking-wide text-muted-foreground">
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveBlock(idx, -1)}>
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={idx === blocks.length - 1} onClick={() => moveBlock(idx, 1)}>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeBlock(idx)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                {Renderer && <Renderer block={block} onChange={updated => updateBlock(idx, updated)} />}
              </div>
            );
          })}

          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(blockLabels).map(([type, { label, icon: Icon }]) => (
              <Button
                key={type} type="button" variant="outline" size="sm"
                className="gap-1.5 text-xs"
                onClick={() => addBlock(type)}
              >
                <Plus className="w-3.5 h-3.5" /> <Icon className="w-3.5 h-3.5" /> {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="bg-secondary hover:bg-secondary/90" disabled={mutation.isPending || uploading}>
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? 'Guardar Cambios' : 'Crear Entrada'}
          </Button>
        </div>
      </form>
    </div>
  );
}
