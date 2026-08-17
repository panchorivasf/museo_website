import React, { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { X, Upload, Loader2, Map, BadgeCheck, AlertTriangle, Plus, Trash2, ChevronUp, ChevronDown, ImageDown, RefreshCw, ShieldCheck, Link2, Search } from 'lucide-react';
import LocationPicker from './LocationPicker';
import RecordistSelect from './RecordistSelect';
import SpectrogramPlayer from '@/components/audio/SpectrogramPlayer';
import { generateSpectrogramImage, hasFreshSpectrogramImage } from '@/lib/prerenderSpectrogram';
import { spectrogramSettings } from '@/lib/spectrogram';
import { diffChars } from '@/lib/textDiff';
import { enrichSpeciesFromSources } from '@/lib/speciesSources';
import { IUCN_CATEGORIES } from '@/lib/iucn';
import {
  GBIF_CLASS_BY_TAXON, normalizeGbifTaxon, resolveAcceptedUsage, searchGbifByEpithet, specificEpithet,
} from '@/lib/gbif';

const fftSizeOptions = [512, 1024, 2048, 4096, 8192, 16384];

const taxonOptions = [
  { value: 'aves', label: 'Aves' },
  { value: 'insectos', label: 'Insectos' },
  { value: 'anfibios', label: 'Anfibios' },
  { value: 'cetaceos', label: 'Cetáceos' },
  { value: 'mamiferos_terrestres', label: 'Roedores' },
  { value: 'felinos', label: 'Felinos' },
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
  return { url: publicUrl, originalName: file.name };
}

export default function SpeciesForm({ species, onClose }) {
  const isEditing = !!species;
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: existingSpecies = [] } = useQuery({
    queryKey: ['species-list-lite'],
    queryFn: async () => {
      const { data } = await supabase
        .from('species')
        .select('common_name, scientific_name, taxon')
        .order('common_name');
      return data || [];
    },
  });

  const [form, setForm] = useState({
    common_name: species?.common_name || '',
    scientific_name: species?.scientific_name || '',
    taxon: species?.taxon || 'aves',
    order: species?.order || '',
    family: species?.family || '',
    conservation_status: species?.conservation_status || '',
    iucn_global_status: species?.iucn_global_status || '',
    gbif_usage_key: species?.gbif_usage_key || null,
    gbif_scientific_name: species?.gbif_scientific_name || '',
    image_author: species?.image_author || '',
    image_license: species?.image_license || '',
    image_source_platform: species?.image_source_platform || '',
    image_source_url: species?.image_source_url || '',
    description: species?.description || '',
    sound_description: species?.sound_description || '',
    audio_url: species?.audio_url || '',
    audio_original_name: species?.audio_original_name || '',
    image_url: species?.image_url || '',
    image_position_y: species?.image_position_y ?? 50,
    habitat: species?.habitat || '',
    frequency_range: species?.frequency_range || '',
    frequency_min: species?.frequency_min ?? 0,
    frequency_max: species?.frequency_max || '',
    spectrogram_min: species?.spectrogram_min ?? 0,
    spectrogram_max: species?.spectrogram_max || '',
    fft_size: species?.fft_size || '',
    recording_location: species?.recording_location || '',
    recording_latitude: species?.recording_latitude || '',
    recording_longitude: species?.recording_longitude || '',
    recording_date: species?.recording_date || '',
    recordist: species?.recordist || '',
    references: Array.isArray(species?.references) ? species.references : [],
    featured: species?.featured || false,
    spectrogram_image: species?.spectrogram_image || null,
  });

  const numericFields = ['frequency_min', 'frequency_max', 'spectrogram_min', 'spectrogram_max', 'fft_size', 'recording_latitude', 'recording_longitude', 'image_position_y'];

  // The baked spectrogram picture is rendered here in the browser and uploaded,
  // so visitors never run the FFT themselves. It is rebuilt whenever the audio or
  // the frequency/FFT parameters change.
  const [spectrogramStatus, setSpectrogramStatus] = useState(null);

  const ensureSpectrogramImage = async (data) => {
    if (!data.audio_url) return null;
    if (hasFreshSpectrogramImage(data)) return data.spectrogram_image;
    setSpectrogramStatus('building');
    try {
      const meta = await generateSpectrogramImage(data);
      setSpectrogramStatus(null);
      return meta;
    } catch (err) {
      setSpectrogramStatus(null);
      throw new Error(`No se pudo generar el espectrograma: ${err.message}`);
    }
  };

  const mutation = useMutation({
    mutationFn: async (rawData) => {
      const data = { ...rawData };
      for (const field of numericFields) {
        data[field] = data[field] === '' || data[field] == null ? null : parseFloat(data[field]);
      }
      // Blank cross-authority link fields are stored as null, not empty strings
      data.gbif_usage_key = data.gbif_usage_key || null;
      data.gbif_scientific_name = data.gbif_scientific_name?.trim() || null;
      // Drop half-filled reference rows and normalise blank URLs to null
      data.references = (data.references || [])
        .filter(r => r.citation?.trim())
        .map(r => ({
          citation: r.citation.trim(),
          url: r.url?.trim() || null,
          url_label: r.url_label?.trim() || null,
        }));
      // New species pull their taxonomic source and global IUCN category
      // automatically. Only on creation: on later saves the admin's own reference
      // list and category are left alone, so entries that were deliberately removed
      // or corrected do not come back on every edit. Older records are handled by
      // the backfill in the Especies list.
      if (!isEditing) {
        try {
          const { patch } = await enrichSpeciesFromSources(data);
          Object.assign(data, patch);
        } catch {
          // A source being unreachable, or not recognising the name, must never block a save.
        }
      }
      data.spectrogram_image = await ensureSpectrogramImage(data);
      let speciesId = species?.id;
      if (isEditing) {
        const { error } = await supabase.from('species').update(data).eq('id', species.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from('species').insert(data).select('id').single();
        if (error) throw error;
        speciesId = inserted.id;
      }
      // Sync to map_recordings if coordinates exist: update the species' own pin
      // (its earliest linked map_recordings row) instead of a species_id-unique upsert,
      // since a species can have multiple separate map recordings.
      if (speciesId && data.recording_latitude && data.recording_longitude) {
        const mapPayload = {
          species_id: speciesId,
          latitude: parseFloat(data.recording_latitude),
          longitude: parseFloat(data.recording_longitude),
          location_name: data.recording_location || null,
          audio_url: data.audio_url || null,
          audio_original_name: data.audio_original_name || null,
          recording_date: data.recording_date || null,
          recordist: data.recordist || null,
          // The pin plays the species' audio, so it can show the same picture.
          spectrogram_image: data.spectrogram_image || null,
        };
        const { data: existing } = await supabase
          .from('map_recordings')
          .select('id')
          .eq('species_id', speciesId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (existing) {
          await supabase.from('map_recordings').update(mapPayload).eq('id', existing.id);
        } else {
          await supabase.from('map_recordings').insert(mapPayload);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-species'] });
      queryClient.invalidateQueries({ queryKey: ['species'] });
      queryClient.invalidateQueries({ queryKey: ['featured-species'] });
      queryClient.invalidateQueries({ queryKey: ['map-recordings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-recordings'] });
      onClose();
    },
    onError: (err) => {
      const isNumericError = err?.message?.includes('invalid input syntax for type numeric');
      const message = isNumericError
        ? 'Uno de los campos numéricos contiene un valor inválido. Revisa los campos de frecuencia y espectrograma.'
        : (err?.message || 'Por favor intenta de nuevo');
      alert('Error al guardar: ' + message);
    },
  });

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url, originalName } = await uploadFile(file);
      setForm(prev => ({
        ...prev,
        [field]: url,
        ...(field === 'audio_url' ? { audio_original_name: originalName } : {}),
      }));
    } catch (err) {
      alert('Error al subir archivo: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const addReference = () =>
    setForm(prev => ({ ...prev, references: [...prev.references, { citation: '', url_label: '', url: '' }] }));
  const updateReference = (index, field, value) =>
    setForm(prev => ({
      ...prev,
      references: prev.references.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    }));
  const removeReference = (index) =>
    setForm(prev => ({ ...prev, references: prev.references.filter((_, i) => i !== index) }));
  const moveReference = (index, delta) =>
    setForm(prev => {
      const next = [...prev.references];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, references: next };
    });

  const [gbifChecking, setGbifChecking] = useState(false);
  const [gbifResult, setGbifResult] = useState(null);
  const [gbifApplied, setGbifApplied] = useState(false);

  /** Order and family as GBIF spells them, for the fields of the same name. */
  const applyGbifClassification = (result, extra = {}) => {
    setForm(prev => ({
      ...prev,
      ...extra,
      order: result.order || prev.order,
      family: result.family || prev.family,
    }));
    setGbifApplied(true);
  };

  const checkGbif = async () => {
    const entered = form.scientific_name.trim();
    if (!entered) return;
    setGbifChecking(true);
    setGbifResult(null);
    setGbifApplied(false);
    try {
      const res = await fetch(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(entered)}`);
      const data = await res.json();
      setGbifResult(data);
      // A name that already matches is settled: fill in the classification now.
      // When the spelling differs the admin decides first, via "Usar este nombre".
      const canonical = data?.canonicalName || data?.scientificName;
      if (data?.matchType && data.matchType !== 'NONE' && canonical === entered) {
        applyGbifClassification(data);
      }
    } catch (err) {
      setGbifResult({ error: true, message: err.message });
    } finally {
      setGbifChecking(false);
    }
  };

  const gbifCanonical = gbifResult?.canonicalName || gbifResult?.scientificName || '';
  // A HIGHERRANK match means GBIF resolved only the genus (or above), not the name
  // typed in: adopting it would silently truncate the species name, so it is offered
  // as a classification fill only.
  const gbifHigherRank = gbifResult?.matchType === 'HIGHERRANK';
  const gbifDiffers = !!gbifCanonical && gbifCanonical !== form.scientific_name.trim();
  const gbifDiff = gbifDiffers && !gbifHigherRank ? diffChars(form.scientific_name.trim(), gbifCanonical) : null;

  const renderDiff = (segments) => segments.map((seg, i) => (
    <span
      key={i}
      className={seg.changed ? 'bg-ocher/30 text-primary rounded-sm px-px font-semibold' : ''}
    >
      {seg.text}
    </span>
  ));

  const acceptGbifName = () => {
    applyGbifClassification(gbifResult, { scientific_name: gbifCanonical });
  };

  // Linking this species to a GBIF taxon whose genus differs from the authority
  // used here: search the backbone for species sharing the epithet within the same
  // class, and remember the chosen taxon's key. scientific_name is never touched.
  const [candidates, setCandidates] = useState(null);
  const [candidateSearching, setCandidateSearching] = useState(false);
  const [candidateError, setCandidateError] = useState(null);

  const gbifClass = GBIF_CLASS_BY_TAXON[form.taxon];
  const epithet = specificEpithet(form.scientific_name);

  const searchCandidates = async () => {
    setCandidateSearching(true);
    setCandidateError(null);
    setCandidates(null);
    try {
      const results = await searchGbifByEpithet(epithet, gbifClass?.key);
      setCandidates(results);
      if (!results.length) {
        setCandidateError(`Sin especies con el epíteto «${epithet}» en ${gbifClass?.label || 'GBIF'}.`);
      }
    } catch (err) {
      setCandidateError(err.message);
    } finally {
      setCandidateSearching(false);
    }
  };

  /** Store the accepted taxon behind the chosen candidate, synonym or not. */
  const linkCandidate = async (candidate) => {
    setCandidateSearching(true);
    setCandidateError(null);
    try {
      const accepted = normalizeGbifTaxon(await resolveAcceptedUsage(candidate));
      setForm(prev => ({
        ...prev,
        gbif_usage_key: accepted.key,
        gbif_scientific_name: accepted.scientificName || accepted.canonicalName || '',
        order: accepted.order || prev.order,
        family: accepted.family || prev.family,
      }));
      setCandidates(null);
      setIucnMessage(null);
    } catch (err) {
      setCandidateError(err.message);
    } finally {
      setCandidateSearching(false);
    }
  };

  const unlinkGbif = () => {
    setForm(prev => ({ ...prev, gbif_usage_key: null, gbif_scientific_name: '' }));
    setIucnMessage(null);
  };

  const [iucnChecking, setIucnChecking] = useState(false);
  const [iucnMessage, setIucnMessage] = useState(null);

  /**
   * Fill the global IUCN category from the Red List and add its citation, so an
   * existing species can be completed without waiting for the bulk backfill.
   * Writes into the form only — nothing is saved until the admin submits.
   */
  const lookupIucn = async () => {
    setIucnChecking(true);
    setIucnMessage(null);
    try {
      const { patch, notes } = await enrichSpeciesFromSources({ ...form, iucn_global_status: '' });
      if (patch.references || patch.iucn_global_status) {
        setForm(prev => ({ ...prev, ...patch }));
      }
      if (patch.iucn_global_status && patch.iucn_global_status !== 'NE') {
        setIucnMessage({
          tone: 'ok',
          text: `Clasificación ${patch.iucn_global_status} obtenida${patch.references ? ' y citada en Referencias' : ''}.`,
        });
      } else {
        setIucnMessage({ tone: 'warn', text: notes[0] || 'Sin evaluación en la Lista Roja.' });
      }
    } catch (err) {
      setIucnMessage({ tone: 'error', text: err.message });
    } finally {
      setIucnChecking(false);
    }
  };

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
            <Input
              value={form.common_name}
              name="sp-field-a1"
              id="sp-field-a1"
              autoComplete="new-password"
              list="existing-common-names"
              ref={el => { if (el && !el.dataset.roInit) { el.readOnly = true; el.dataset.roInit = '1'; } }}
              onFocus={e => { e.target.removeAttribute('readonly'); }}
              onBlur={e => { e.target.setAttribute('readonly', 'readonly'); }}
              onChange={e => {
                const value = e.target.value;
                const match = !isEditing && existingSpecies.find(s => s.common_name === value);
                if (match) {
                  setForm(prev => ({
                    ...prev,
                    common_name: value,
                    scientific_name: match.scientific_name || prev.scientific_name,
                    taxon: match.taxon || prev.taxon,
                  }));
                } else {
                  update('common_name', value);
                }
              }}
              required
            />
            <datalist id="existing-common-names">
              {existingSpecies.map(s => <option key={s.common_name} value={s.common_name} />)}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label>Nombre científico *</Label>
            <Input
              value={form.scientific_name}
              name="sp-field-a2"
              id="sp-field-a2"
              autoComplete="new-password"
              list="existing-scientific-names"
              ref={el => { if (el && !el.dataset.roInit) { el.readOnly = true; el.dataset.roInit = '1'; } }}
              onFocus={e => { e.target.removeAttribute('readonly'); }}
              onBlur={e => { e.target.setAttribute('readonly', 'readonly'); }}
              onChange={e => {
                const value = e.target.value;
                setGbifResult(null);
                const match = !isEditing && existingSpecies.find(s => s.scientific_name === value);
                if (match) {
                  setForm(prev => ({
                    ...prev,
                    scientific_name: value,
                    common_name: match.common_name || prev.common_name,
                    taxon: match.taxon || prev.taxon,
                  }));
                } else {
                  update('scientific_name', value);
                }
              }}
              className="italic"
              required
            />
            <datalist id="existing-scientific-names">
              {existingSpecies.map(s => <option key={s.scientific_name} value={s.scientific_name} />)}
            </datalist>
            <Button
              type="button" variant="outline" size="sm"
              className="gap-1.5 text-xs h-7 mt-1"
              disabled={!form.scientific_name.trim() || gbifChecking}
              onClick={checkGbif}
            >
              {gbifChecking ? <Loader2 className="w-3 h-3 animate-spin" /> : <BadgeCheck className="w-3 h-3" />}
              Verificar en GBIF
            </Button>
            {gbifResult && (
              <div className="text-xs rounded-md border border-border bg-muted/40 p-2 mt-1 space-y-0.5">
                {gbifResult.error || !gbifResult.matchType || gbifResult.matchType === 'NONE' ? (
                  <p className="flex items-center gap-1.5 text-destructive">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    No se encontró coincidencia en GBIF para este nombre.
                  </p>
                ) : (
                  <>
                    <p className="flex items-center gap-1.5 text-secondary font-medium">
                      <BadgeCheck className="w-3.5 h-3.5 shrink-0" />
                      {gbifResult.canonicalName || gbifResult.scientificName}
                      {gbifResult.status && <span className="font-normal text-muted-foreground">({gbifResult.status})</span>}
                    </p>
                    <p className="text-muted-foreground">
                      {[gbifResult.rank, gbifResult.family, gbifResult.order].filter(Boolean).join(' · ')}
                    </p>
                    {gbifDiff && (
                      <div className="pt-1 space-y-1">
                        <p className="text-ocher">Difiere del nombre ingresado:</p>
                        <div className="font-mono text-[11px] leading-relaxed">
                          <p>
                            <span className="text-muted-foreground">Ingresado: </span>
                            {renderDiff(gbifDiff.left)}
                          </p>
                          <p>
                            <span className="text-muted-foreground">GBIF: </span>
                            {renderDiff(gbifDiff.right)}
                          </p>
                        </div>
                        <Button
                          type="button" variant="outline" size="sm"
                          className="gap-1.5 text-xs h-7"
                          onClick={acceptGbifName}
                        >
                          <BadgeCheck className="w-3 h-3" />
                          Usar este nombre y completar orden/familia
                        </Button>
                      </div>
                    )}
                    {gbifHigherRank && (
                      <div className="pt-1 space-y-1">
                        <p className="text-ocher">
                          GBIF no reconoce «{form.scientific_name.trim()}»; solo resolvió {gbifResult.rank
                            ? `el rango ${gbifResult.rank.toLowerCase()}`
                            : 'un rango superior'} «{gbifCanonical}». Revisa la ortografía del epíteto.
                        </p>
                        <Button
                          type="button" variant="outline" size="sm"
                          className="gap-1.5 text-xs h-7"
                          onClick={() => applyGbifClassification(gbifResult)}
                        >
                          <BadgeCheck className="w-3 h-3" />
                          Completar orden/familia de todos modos
                        </Button>
                      </div>
                    )}
                    {gbifApplied && !gbifDiff && (
                      <p className="text-secondary">
                        Orden y familia completados desde GBIF.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Cross-authority link: this site keeps its own binomial while GBIF and
                IUCN are consulted through the taxon selected here. */}
            <div className="text-xs rounded-md border border-border bg-muted/40 p-2 mt-1 space-y-1.5">
              {form.gbif_usage_key ? (
                <>
                  <p className="flex items-center gap-1.5 text-secondary font-medium">
                    <Link2 className="w-3.5 h-3.5 shrink-0" />
                    Vinculado en GBIF: <span className="italic">{form.gbif_scientific_name}</span>
                  </p>
                  <p className="text-muted-foreground">
                    GBIF e IUCN se consultan con este taxón (clave {form.gbif_usage_key}); el nombre
                    de la ficha se mantiene como «{form.scientific_name.trim()}».
                  </p>
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={unlinkGbif}>
                    <X className="w-3 h-3" /> Desvincular
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground">
                    ¿GBIF ubica esta especie en otro género? Busca por epíteto dentro de
                    {gbifClass ? ` ${gbifClass.label}` : ' su clase'} y vincula el taxón correcto sin
                    cambiar el nombre de la ficha.
                  </p>
                  <Button
                    type="button" variant="outline" size="sm"
                    className="gap-1.5 text-xs h-7"
                    disabled={!epithet || candidateSearching}
                    onClick={searchCandidates}
                  >
                    {candidateSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    Buscar por epíteto «{epithet || '—'}»
                  </Button>
                </>
              )}

              {candidateError && <p className="text-ocher">{candidateError}</p>}

              {candidates?.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {candidates.map(c => (
                    <li key={c.key} className="flex items-start justify-between gap-2 border-t border-border/60 pt-1">
                      <span className="min-w-0">
                        <span className="italic text-primary">{c.canonicalName}</span>{' '}
                        <span className={c.taxonomicStatus === 'ACCEPTED' ? 'text-secondary' : 'text-muted-foreground'}>
                          ({c.taxonomicStatus === 'ACCEPTED' ? 'aceptado' : 'sinónimo'})
                        </span>
                        <span className="block text-muted-foreground">
                          {[c.family, c.order].filter(Boolean).join(' · ')}
                          {c.taxonomicStatus !== 'ACCEPTED' && c.accepted && ` → ${c.accepted}`}
                        </span>
                      </span>
                      <Button
                        type="button" variant="outline" size="sm"
                        className="gap-1.5 text-xs h-7 shrink-0"
                        disabled={candidateSearching}
                        onClick={() => linkCandidate(c)}
                      >
                        <Link2 className="w-3 h-3" /> Vincular
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
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
          <div className="space-y-1.5">
            <Label>Clasificación Global IUCN</Label>
            <Select value={form.iucn_global_status} onValueChange={v => update('iucn_global_status', v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {IUCN_CATEGORIES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              type="button" variant="outline" size="sm"
              className="gap-1.5 text-xs h-7"
              disabled={!form.scientific_name.trim() || iucnChecking}
              onClick={lookupIucn}
            >
              {iucnChecking ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
              Consultar Lista Roja IUCN
            </Button>
            {iucnMessage && (
              <p className={`text-xs ${iucnMessage.tone === 'error' ? 'text-destructive' : iucnMessage.tone === 'warn' ? 'text-ocher' : 'text-secondary'}`}>
                {iucnMessage.text}
              </p>
            )}
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
          <Label>Hábitat y Distribución</Label>
          <Textarea value={form.habitat} onChange={e => update('habitat', e.target.value)} rows={2} />
        </div>

        <div className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-heading uppercase tracking-widest text-muted-foreground font-semibold">Referencias</p>
            <Button type="button" variant="outline" size="sm" onClick={addReference} className="h-7 gap-1.5 text-xs">
              <Plus className="w-3 h-3" /> Añadir referencia
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Admite Markdown: <code className="font-mono">*cursiva*</code> para nombres científicos y títulos de revistas,
            <code className="font-mono"> **negrita**</code>, y <code className="font-mono">[texto](url)</code> para enlaces.
          </p>
          {form.references.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sin referencias. Añade las citas de artículos o libros en que se basa esta ficha; aparecerán como apéndice al final de la página de la especie.
            </p>
          ) : (
            form.references.map((ref, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-xs font-mono text-muted-foreground w-5 shrink-0 text-right pt-2.5">{i + 1}.</span>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <Textarea
                    value={ref.citation}
                    onChange={e => updateReference(i, 'citation', e.target.value)}
                    rows={2}
                    placeholder="Apellido, N. (2020). Título del artículo. Revista, 12(3), 45–67."
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-1.5">
                    <Input
                      value={ref.url_label || ''}
                      onChange={e => updateReference(i, 'url_label', e.target.value)}
                      placeholder="Nombre del enlace (por defecto: Ver artículo)"
                    />
                    <Input
                      value={ref.url || ''}
                      onChange={e => updateReference(i, 'url', e.target.value)}
                      placeholder="https://doi.org/10.xxxx/xxxxx"
                    />
                  </div>
                </div>
                <div className="flex flex-col shrink-0">
                  <Button
                    type="button" variant="ghost" size="icon"
                    onClick={() => moveReference(i, -1)} disabled={i === 0}
                    className="h-6 w-8 text-muted-foreground disabled:opacity-30" aria-label="Subir referencia"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button" variant="ghost" size="icon"
                    onClick={() => moveReference(i, 1)} disabled={i === form.references.length - 1}
                    className="h-6 w-8 text-muted-foreground disabled:opacity-30" aria-label="Bajar referencia"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    type="button" variant="ghost" size="icon"
                    onClick={() => removeReference(i)}
                    className="h-6 w-8 text-muted-foreground hover:text-destructive" aria-label="Eliminar referencia"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Imagen de la especie</Label>
            {form.image_url && (
              <div className="space-y-1.5 mb-2">
                <p className="text-xs text-muted-foreground">Vista previa (como se ve en la página de la especie)</p>
                <div className="rounded-xl overflow-hidden aspect-[16/9] bg-muted">
                  <img
                    src={form.image_url}
                    alt=""
                    className="w-full h-full object-cover"
                    style={{ objectPosition: `50% ${form.image_position_y}%` }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Posición vertical</Label>
                  <Slider
                    value={[Number(form.image_position_y)]}
                    onValueChange={([v]) => update('image_position_y', v)}
                    min={0} max={100} step={1}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-8 text-right">{form.image_position_y}%</span>
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors text-sm w-fit">
              <Upload className="w-4 h-4" />
              {uploading ? 'Subiendo...' : 'Subir imagen'}
              <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'image_url')} disabled={uploading} />
            </label>
          </div>
          <div className="space-y-1.5">
            <Label>Archivo de audio</Label>
            {form.audio_url && <audio controls src={form.audio_url} className="w-full mb-1" />}
            {form.audio_original_name && (
              <p className="text-xs text-muted-foreground mb-2 truncate">Archivo original: {form.audio_original_name}</p>
            )}
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
            <Label>Frec. mín. informativa (kHz)</Label>
            <Input type="number" step="0.001" min="0" value={form.frequency_min} onChange={e => update('frequency_min', e.target.value)} placeholder="ej: 0.001" />
          </div>
          <div className="space-y-1.5">
            <Label>Frec. máx. informativa (kHz)</Label>
            <Input type="number" step="0.1" min="0" value={form.frequency_max} onChange={e => update('frequency_max', e.target.value)} placeholder="ej: 8" />
          </div>
          <div className="space-y-1.5">
            <Label>Espectrograma mín. (kHz)</Label>
            <Input type="number" step="0.001" min="0" value={form.spectrogram_min} onChange={e => update('spectrogram_min', e.target.value)} placeholder="ej: 0" />
          </div>
          <div className="space-y-1.5">
            <Label>Espectrograma máx. (kHz)</Label>
            <Input type="number" step="0.1" min="0" value={form.spectrogram_max} onChange={e => update('spectrogram_max', e.target.value)} placeholder="ej: 10" />
          </div>
          <div className="space-y-1.5">
            <Label>Lugar de grabación</Label>
            <Input value={form.recording_location} onChange={e => update('recording_location', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Fecha de grabación</Label>
            <Input type="date" value={form.recording_date} onChange={e => update('recording_date', e.target.value)} />
          </div>
          <RecordistSelect value={form.recordist} onChange={v => update('recordist', v)} />
        </div>

        {form.audio_url && (
          <div className="space-y-2 border border-border rounded-lg p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs font-heading uppercase tracking-widest text-muted-foreground font-semibold">
                Vista previa del espectrograma
              </p>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Resolución (FFT)</Label>
                <Select
                  value={form.fft_size ? String(form.fft_size) : 'auto'}
                  onValueChange={v => update('fft_size', v === 'auto' ? '' : v)}
                >
                  <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automático</SelectItem>
                    {fftSizeOptions.map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Si el espectrograma automático se ve borroso o muy comprimido, prueba un valor de FFT más alto (más resolución en frecuencia, más lento) o más bajo (más resolución en el tiempo).
            </p>
            <p className="text-xs text-muted-foreground">
              El rango visible se controla únicamente con <strong>Espectrograma mín./máx.</strong> Si los dejas vacíos se muestra el rango completo del audio. Las frecuencias informativas no afectan al espectrograma.
            </p>

            <div className="flex items-center justify-between gap-2 flex-wrap rounded-md bg-muted/50 px-3 py-2">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ImageDown className="w-3.5 h-3.5 shrink-0" />
                {spectrogramStatus === 'building'
                  ? 'Generando la imagen del espectrograma...'
                  : hasFreshSpectrogramImage(form)
                    ? 'Imagen del espectrograma guardada: los visitantes la descargan en vez de calcularla.'
                    : 'Se generará y guardará la imagen del espectrograma al guardar los cambios.'}
              </p>
              {hasFreshSpectrogramImage(form) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={spectrogramStatus === 'building'}
                  onClick={() => update('spectrogram_image', null)}
                >
                  <RefreshCw className="w-3 h-3 mr-1.5" /> Regenerar al guardar
                </Button>
              )}
            </div>

            {/* Always rendered live from the current form values — this preview is
                what the saved picture will be baked from. */}
            <SpectrogramPlayer
              key={`${form.audio_url}-${form.spectrogram_min}-${form.spectrogram_max}-${form.fft_size}`}
              audioUrl={form.audio_url}
              {...spectrogramSettings(form)}
              fftSize={form.fft_size ? parseInt(form.fft_size, 10) : null}
              spectrogramImage={null}
              altText="Vista previa del espectrograma"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Latitud de grabación</Label>
            <Input type="number" step="any" value={form.recording_latitude} onChange={e => update('recording_latitude', e.target.value)} placeholder="-36.82" />
          </div>
          <div className="space-y-1.5">
            <Label>Longitud de grabación</Label>
            <Input type="number" step="any" value={form.recording_longitude} onChange={e => update('recording_longitude', e.target.value)} placeholder="-73.05" />
          </div>
        </div>

        <LocationPicker
          latitude={form.recording_latitude}
          longitude={form.recording_longitude}
          onLocationSelect={(lat, lng) => {
            update('recording_latitude', lat.toFixed(6));
            update('recording_longitude', lng.toFixed(6));
          }}
        />

        <div className="flex items-center gap-3">
          <Switch checked={form.featured} onCheckedChange={v => update('featured', v)} />
          <Label>Mostrar como especie destacada</Label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" className="bg-secondary hover:bg-secondary/90" disabled={mutation.isPending || uploading}>
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {spectrogramStatus === 'building'
              ? 'Generando espectrograma...'
              : isEditing ? 'Guardar Cambios' : 'Crear Especie'}
          </Button>
        </div>
      </form>
    </div>
  );
}
