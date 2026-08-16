import { supabase } from '@/api/supabaseClient';
import {
  buildPrerenderCanvas,
  buildSpectrogramMeta,
  canvasToBlob,
  decodeAudioFromUrl,
  isSpectrogramMetaFresh,
  spectrogramSettings,
  toHz,
} from '@/lib/spectrogram';

/**
 * Bakes the spectrogram picture for one record and uploads it to the media bucket.
 *
 * The frequency window and FFT size come from the record itself, so every species
 * keeps the settings chosen for it in the admin form; the returned descriptor is
 * what gets stored in the row's `spectrogram_image` column.
 */

const extensionFor = (mimeType) => ({
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}[mimeType] || 'webp');

/** Frequency window + FFT size for a species (or a map recording) row. */
export function spectrogramParams(record) {
  const { spectrogramMin, spectrogramMax, fftSize } = spectrogramSettings(record);
  return {
    audioUrl: record?.audio_url || null,
    freqMinHz: toHz(spectrogramMin),
    freqMaxHz: toHz(spectrogramMax),
    fftSize: fftSize ? Number(fftSize) : null,
  };
}

/** True when the row already has an image matching its current parameters. */
export function hasFreshSpectrogramImage(record) {
  const params = spectrogramParams(record);
  if (!params.audioUrl) return false;
  return isSpectrogramMetaFresh(record?.spectrogram_image, params);
}

/**
 * Render and upload the spectrogram for `record`, returning the descriptor to
 * store. Returns null when the record has no audio.
 */
export async function generateSpectrogramImage(record) {
  const params = spectrogramParams(record);
  if (!params.audioUrl) return null;

  const audioBuffer = await decodeAudioFromUrl(params.audioUrl);
  const { canvas, minHz, maxHz, fftSize } = buildPrerenderCanvas(audioBuffer, params);
  const blob = await canvasToBlob(canvas);
  if (!blob) throw new Error('El navegador no pudo codificar la imagen del espectrograma');

  const fileName = `spectrograms/${Date.now()}-${Math.random().toString(36).slice(2)}.${extensionFor(blob.type)}`;
  const { error } = await supabase.storage
    .from('media')
    .upload(fileName, blob, { cacheControl: '31536000', contentType: blob.type });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(fileName);

  return buildSpectrogramMeta({
    url: publicUrl,
    audioUrl: params.audioUrl,
    freqMinHz: params.freqMinHz,
    freqMaxHz: params.freqMaxHz,
    fftSize: params.fftSize,
    visMinHz: minHz,
    visMaxHz: maxHz,
    resolvedFftSize: fftSize,
    width: canvas.width,
    duration: audioBuffer.duration,
  });
}
