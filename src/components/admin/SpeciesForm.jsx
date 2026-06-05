import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { X, Upload, Loader2 } from 'lucide-react';

const taxonOptions = [
  { value: 'aves', label: 'Aves' },
  { value: 'insectos', label: 'Insectos' },
  { value: 'anfibios', label: 'Anfibios' },
  { value: 'mamiferos_marinos', label: 'Mamíferos Marinos' },
  { value: 'mamiferos_terrestres', label: 'Mamíferos Terrestres' },
];

const conservationOptions = [
  { value: 'LC', label: 'LC — Preocupación Menor' },
  { value: 'NT', label: 'NT — Casi Amenazada' },
  { value: 'VU', label: 'VU — Vulnerable' },
  { value: 'EN', label: 'EN — En Peligro' },
  { value: 'CR', label: 'CR — En Peligro Crítico' },
  { value: 'DD', label: 'DD — Datos Insuficientes' },
  { value: 'NE', label: 'NE — No Evaluada' },
];

async function uploadFile(file) {
  const ext = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(fileName, file, { cacheControl: '3600' });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);
  return publicUrl;
}

export default function SpeciesForm({ species, onClose }) {
  const isEditing = !!species;
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    common_name: species?.common_name || '',
    scientific_name: species?.scientific_name || '',
    taxon: species?.taxon || 'aves',
    order: species?.order || '',
    family: species?.family || '',
    conservation_status: species?.conservation_status || '',
    image_author: species?.image_author || '',
    image_license: species?.image_license || '',
    image_source_platform: species?.image_source_platform || '',
    image_source_url: species?.image_source_url || '',
    description: species?.description || '',
    sound_description: species?.sound_description || '',
    audio_url: species?.audio_url || '',
    image_url: species?.image_url || '',
    habitat: species?.habitat || '',
    frequency_range: species?.frequency_range || '',
    recording_location: species?.recording_location || '',
    recording_date: species?.recording_date || '',
    recordist: species?.recordist || '',
    featured: species?.featured || false,
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (isEditing) {
        const { error } = await supabase.from('species').update(data).eq('id', species.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('species').insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-species'] });
      queryClient.invalidateQueries({ queryKey: ['species'] });
      queryClient.invalidateQueries({ queryKey: ['featured-species'] });
      onClose();
    },
  });

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setForm(prev => ({ ...prev, [field]: url }));
    } catch (err) {
      alert('Error al subir archivo: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-heading font-semibold text-primary text-lg">
          {isEditing ? 'Editar Especie' : 'Nueva Especie'}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Nombre común *</Label>
            <Input value={form.common_name} onChange={e => update('common_name', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Nombre científico *</Label>
            <Input value={form.scientific_name} onChange={e => update('scientific_name', e.target.value)} className="italic" required />
          </div>
          <div className="space-y-1.5">
            <Label>Taxón *</Label>
            <Select value={form.taxon} onValueChange={v => update('taxon', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {taxonOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Estado de conservación</Label>
            <Select value={form.conservation_status} onValueChange={v => update('conservation_status', v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {conservationOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Orden</Label>
            <Input value={form.order} onChange={e => update('order', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Familia</Label>
            <Input value={form.family} onChange={e => update('family', e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Descripción general</Label>
          <Textarea value={form.description} onChange={e => update('description', e.target.value)} rows={3} />
        </div>
        <div className="space-y-1.5">
          <Label>Descripción del sonido</Label>
          <Textarea value={form.sound_description} onChange={e => update('sound_description', e.target.value)} rows={3} />
        </div>
        <div className="space-y-1.5">
          <Label>Hábitat</Label>
          <Textarea value={form.habitat} onChange={e => update('habitat', e.target.value)} rows={2} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Imagen de la especie</Label>
            {form.image_url && (
              <img src={form.image_url} alt="" className="w-full h-32 object-cover rounded-lg mb-2" />
            )}
            <label className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors text-sm w-fit">
              <Upload className="w-4 h-4" />
              {uploading ? 'Subiendo...' : 'Subir imagen'}
              <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'image_url')} disabled={uploading} />
            </label>
          </div>
          <div className="space-y-1.5">
            <Label>Archivo de audio</Label>
            {form.audio_url && <audio controls src={form.audio_url} className="w-full mb-2" />}
            <label className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors text-sm w-fit">
              <Upload className="w-4 h-4" />
              {uploading ? 'Subiendo...' : 'Subir audio'}
              <input type="file" accept="audio/*" className="hidden" onChange={e => handleFileUpload(e, 'audio_url')} disabled={uploading} />
            </label>
          </div>
        </div>

        <div className="border border-border rounded-lg p-4 space-y-3">
          <p className="text-xs font-heading uppercase tracking-widest text-muted-foreground font-semibold">Atribución de imagen</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>© Autor/a</Label>
              <Input value={form.image_author} onChange={e => update('image_author', e.target.value)} placeholder="ej: Juan Pérez" />
            </div>
            <div className="space-y-1.5">
              <Label>Licencia</Label>
              <Select value={form.image_license} onValueChange={v => update('image_license', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CC BY">CC BY</SelectItem>
                  <SelectItem value="CC BY-SA">CC BY-SA</SelectItem>
                  <SelectItem value="CC BY-NC">CC BY-NC</SelectItem>
                  <SelectItem value="CC BY-NC-SA">CC BY-NC-SA</SelectItem>
                  <SelectItem value="CC BY-ND">CC BY-ND</SelectItem>
                  <SelectItem value="CC BY-NC-ND">CC BY-NC-ND</SelectItem>
                  <SelectItem value="CC0">CC0 (Dominio público)</SelectItem>
                  <SelectItem value="©">© Todos los derechos reservados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Plataforma</Label>
              <Select value={form.image_source_platform} onValueChange={v => update('image_source_platform', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="iNaturalist">iNaturalist</SelectItem>
                  <SelectItem value="Flickr">Flickr</SelectItem>
                  <SelectItem value="Wikimedia Commons">Wikimedia Commons</SelectItem>
                  <SelectItem value="eBird">eBird</SelectItem>
                  <SelectItem value="GBIF">GBIF</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>URL del autor/fuente</Label>
              <Input value={form.image_source_url} onChange={e => update('image_source_url', e.target.value)} placeholder="https://..." />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label>Rango de frecuencias</Label>
            <Input value={form.frequency_range} onChange={e => update('frequency_range', e.target.value)} placeholder="ej: 2-8 kHz" />
          </div>
          <div className="space-y-1.5">
            <Label>Lugar de grabación</Label>
            <Input value={form.recording_location} onChange={e => update('recording_location', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Fecha de grabación</Label>
            <Input type="date" value={form.recording_date} onChange={e => update('recording_date', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Grabador(a)</Label>
            <Input value={form.recordist} onChange={e => update('recordist', e.target.value)} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch checked={form.featured} onCheckedChange={v => update('featured', v)} />
          <Label>Mostrar como especie destacada</Label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="bg-secondary hover:bg-secondary/90" disabled={mutation.isPending || uploading}>
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? 'Guardar Cambios' : 'Crear Especie'}
          </Button>
        </div>
      </form>
    </div>
  );
}
