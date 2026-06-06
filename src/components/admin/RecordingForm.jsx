import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Upload, Loader2, Map } from 'lucide-react';
import RecordistSelect from './RecordistSelect';
import LocationPicker from './LocationPicker';

const UNCATALOGUED = '__uncatalogued__';

const taxonOptions = [
  { value: 'aves', label: 'Aves' },
  { value: 'insectos', label: 'Insectos' },
  { value: 'anfibios', label: 'Anfibios' },
  { value: 'cetaceos', label: 'Cetáceos' },
  { value: 'focas', label: 'Focas' },
  { value: 'nutrias', label: 'Nutrias' },
  { value: 'mamiferos_terrestres', label: 'Mamíferos Terrestres' },
];

async function uploadFile(file) {
  const ext = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(fileName, file, { cacheControl: '3600' });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);
  return publicUrl;
}

export default function RecordingForm({ recording, onClose }) {
  const isEditing = !!recording;
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const initialUncatalogued = isEditing && !recording.species_id && recording.species_name;

  const [form, setForm] = useState({
    species_id: recording?.species_id || '',
    species_name: recording?.species_name || '',
    taxon: recording?.taxon || '',
    latitude: recording?.latitude || '',
    longitude: recording?.longitude || '',
    location_name: recording?.location_name || '',
    audio_url: recording?.audio_url || '',
    recording_date: recording?.recording_date || '',
    recordist: recording?.recordist || '',
    description: recording?.description || '',
    elevation: recording?.elevation || '',
  });

  const [speciesMode, setSpeciesMode] = useState(
    initialUncatalogued ? UNCATALOGUED : (recording?.species_id || '')
  );

  const { data: speciesList = [] } = useQuery({
    queryKey: ['species-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('species')
        .select('id, common_name, scientific_name, taxon, recording_location, recording_latitude, recording_longitude, recording_date, recordist, audio_url')
        .order('common_name');
      return data || [];
    },
  });

  const handleSpeciesSelect = (value) => {
    setSpeciesMode(value);
    if (value === UNCATALOGUED) {
      setForm(prev => ({ ...prev, species_id: '', species_name: '', taxon: '' }));
      return;
    }
    const s = speciesList.find(sp => sp.id === value);
    if (!s) return;
    setForm(prev => ({
      ...prev,
      species_id: value,
      species_name: '',
      taxon: '',
      location_name: s.recording_location || prev.location_name,
      latitude: s.recording_latitude ? String(s.recording_latitude) : prev.latitude,
      longitude: s.recording_longitude ? String(s.recording_longitude) : prev.longitude,
      recording_date: s.recording_date || prev.recording_date,
      recordist: s.recordist || prev.recordist,
      audio_url: s.audio_url || prev.audio_url,
    }));
  };

  const mutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        species_id: data.species_id || null,
        species_name: data.species_id ? null : (data.species_name || null),
        taxon: data.species_id ? null : (data.taxon || null),
        latitude: parseFloat(data.latitude) || 0,
        longitude: parseFloat(data.longitude) || 0,
        elevation: data.elevation ? parseFloat(data.elevation) : null,
        location_name: data.location_name || null,
        audio_url: data.audio_url || null,
        recording_date: data.recording_date || null,
        recordist: data.recordist || null,
        description: data.description || null,
      };
      if (isEditing) {
        const { error } = await supabase.from('map_recordings').update(payload).eq('id', recording.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('map_recordings').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-recordings'] });
      queryClient.invalidateQueries({ queryKey: ['map-recordings'] });
      onClose();
    },
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setForm(prev => ({ ...prev, audio_url: url }));
    } catch (err) {
      alert('Error al subir archivo: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Auto-fetch elevation when coordinates change
  const elevationTimer = useRef(null);
  useEffect(() => {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
    clearTimeout(elevationTimer.current);
    elevationTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
        const data = await res.json();
        if (data.elevation?.[0] != null) {
          setForm(prev => ({ ...prev, elevation: Math.round(data.elevation[0]) }));
        }
      } catch {}
    }, 600);
    return () => clearTimeout(elevationTimer.current);
  }, [form.latitude, form.longitude]);

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const selectedSpecies = speciesList.find(s => s.id === form.species_id);
  const isUncatalogued = speciesMode === UNCATALOGUED;

  return (
    <div className="bg-card rounded-xl border border-border p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-heading font-semibold text-primary text-lg">
          {isEditing ? 'Editar Grabación' : 'Nueva Grabación'}
        </h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Species selection */}
        <div className="space-y-1.5">
          <Label>Especie</Label>
          <Select value={speciesMode} onValueChange={handleSpeciesSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar especie..." />
            </SelectTrigger>
            <SelectContent>
              {speciesList.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {s.common_name}
                  {s.scientific_name && <span className="text-muted-foreground italic ml-1 text-xs">— {s.scientific_name}</span>}
                </SelectItem>
              ))}
              <SelectItem value={UNCATALOGUED}>
                <span className="text-muted-foreground italic">Sin catalogar (ingresar manualmente)</span>
              </SelectItem>
            </SelectContent>
          </Select>
          {selectedSpecies && (
            <p className="text-xs text-muted-foreground">
              Taxón: <span className="font-medium">{selectedSpecies.taxon}</span>
            </p>
          )}
        </div>

        {/* Manual species fields for uncatalogued */}
        {isUncatalogued && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-muted/40 rounded-lg border border-border">
            <div className="space-y-1.5">
              <Label>Nombre de especie</Label>
              <Input value={form.species_name} onChange={e => update('species_name', e.target.value)} placeholder="Nombre común" />
            </div>
            <div className="space-y-1.5">
              <Label>Taxón</Label>
              <Select value={form.taxon} onValueChange={v => update('taxon', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {taxonOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Coordinates */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Latitud</Label>
              <Input type="number" step="any" value={form.latitude} onChange={e => update('latitude', e.target.value)} placeholder="-36.82" />
            </div>
            <div className="space-y-1.5">
              <Label>Longitud</Label>
              <Input type="number" step="any" value={form.longitude} onChange={e => update('longitude', e.target.value)} placeholder="-73.05" />
            </div>
            <div className="space-y-1.5">
              <Label>Elevación (m)</Label>
              <Input type="number" value={form.elevation} onChange={e => update('elevation', e.target.value)} />
            </div>
          </div>

          <Button
            type="button" variant="outline" size="sm"
            className="gap-2 text-secondary border-secondary/40 hover:bg-secondary/10"
            onClick={() => setShowMap(v => !v)}
          >
            <Map className="w-4 h-4" />
            {showMap ? 'Ocultar mapa' : 'Seleccionar en mapa (opcional)'}
          </Button>

          {showMap && (
            <LocationPicker
              latitude={form.latitude}
              longitude={form.longitude}
              onLocationSelect={(lat, lng) => {
                update('latitude', lat.toFixed(6));
                update('longitude', lng.toFixed(6));
              }}
            />
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Nombre del lugar</Label>
          <Input value={form.location_name} onChange={e => update('location_name', e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Fecha de grabación</Label>
            <Input type="date" value={form.recording_date} onChange={e => update('recording_date', e.target.value)} />
          </div>
          <RecordistSelect value={form.recordist} onChange={v => update('recordist', v)} />
        </div>

        <div className="space-y-1.5">
          <Label>Descripción</Label>
          <Textarea value={form.description} onChange={e => update('description', e.target.value)} rows={2} />
        </div>

        <div className="space-y-1.5">
          <Label>Archivo de audio</Label>
          {form.audio_url && <audio controls src={form.audio_url} className="w-full mb-2" />}
          <label className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors text-sm w-fit">
            <Upload className="w-4 h-4" />
            {uploading ? 'Subiendo...' : 'Subir audio'}
            <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="bg-secondary hover:bg-secondary/90" disabled={mutation.isPending || uploading}>
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? 'Guardar Cambios' : 'Crear Grabación'}
          </Button>
        </div>
      </form>
    </div>
  );
}
