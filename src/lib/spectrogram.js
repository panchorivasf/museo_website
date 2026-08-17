/**
 * Spectrogram rendering shared by the live players and the admin pre-renderer.
 *
 * Two ways to get a spectrogram image:
 *
 *  - `renderSpectrogram` runs a full FFT pass over an AudioBuffer. This is what
 *    the players used to do inline on every page view — accurate but expensive.
 *  - `buildPrerenderCanvas` renders the same image once at a fixed, canvas-independent
 *    scale so the admin can upload it as a file (the Macaulay Library approach:
 *    bake the image at ingest, serve a picture to the visitor). Players then only
 *    need `scaleImageToOffscreen` to fit the stored picture to their canvas.
 *
 * Both honour the same per-species parameters: the spectrogram frequency window
 * (`spectrogram_min` / `spectrogram_max`, in kHz) and the FFT size.
 */

// Cooley-Tukey radix-2 FFT (in-place)
export function fftInPlace(re, im) {
  const N = re.length;
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = (2 * Math.PI) / len;
    const wRe = Math.cos(ang), wIm = -Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let cRe = 1, cIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j], uIm = im[i + j];
        const vRe = re[i + j + len / 2] * cRe - im[i + j + len / 2] * cIm;
        const vIm = re[i + j + len / 2] * cIm + im[i + j + len / 2] * cRe;
        re[i + j] = uRe + vRe; im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe; im[i + j + len / 2] = uIm - vIm;
        const nr = cRe * wRe - cIm * wIm;
        cIm = cRe * wIm + cIm * wRe;
        cRe = nr;
      }
    }
  }
}

export function valueToColor(v) {
  const hue = 183 - (v / 255) * 50;
  const sat = 60 + (v / 255) * 30;
  const light = 10 + (v / 255) * 45;
  // Convert HSL to RGB for ImageData
  const s = sat / 100, l = light / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (hue < 60) { r = c; g = x; }
  else if (hue < 120) { r = x; g = c; }
  else if (hue < 180) { g = c; b = x; }
  else if (hue < 240) { g = x; b = c; }
  else if (hue < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/**
 * The FFT size to use when a species has not pinned one.
 *
 * Resolved against a fixed reference height rather than the height of whatever
 * widget is drawing, so one species looks the same everywhere: the 72px-tall map
 * popup, the full player on the species page and the baked image all get the same
 * frequency resolution. Sizing it per widget made the map noticeably coarser.
 */
export function resolveFftSize(sampleRate, freqMinHz, freqMaxHz, fftSize = null) {
  return fftSize || pickFftSize(sampleRate, freqMinHz, freqMaxHz, PRERENDER_HEIGHT, 1024);
}

/** Smallest FFT size that gives at least one bin per pixel row of the visible band. */
export function pickFftSize(sampleRate, freqMinHz, freqMaxHz, canvasH, minSize = 1024) {
  const nyquist = sampleRate / 2;
  const rangeHz = (freqMaxHz ?? nyquist) - (freqMinHz ?? 0);
  const needed = Math.ceil((canvasH * sampleRate) / rangeHz);
  let size = minSize;
  while (size < needed && size < 16384) size <<= 1;
  return size;
}

/** One 0-255 magnitude column per hop, over a -80 dB dynamic range. */
function computeFrames(audioBuffer, fftSize) {
  const hopSize = Math.floor(fftSize / 4);
  const numBins = fftSize / 2;
  const channelData = audioBuffer.getChannelData(0);
  const numFrames = Math.floor((channelData.length - fftSize) / hopSize);
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);
  const frames = [];

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    for (let i = 0; i < fftSize; i++) {
      const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
      re[i] = (channelData[start + i] || 0) * hann;
      im[i] = 0;
    }
    fftInPlace(re, im);
    const mags = new Uint8Array(numBins);
    for (let b = 0; b < numBins; b++) {
      const mag = Math.sqrt(re[b] * re[b] + im[b] * im[b]) / fftSize;
      const db = Math.max(-80, 20 * Math.log10(mag + 1e-9));
      mags[b] = Math.round(((db + 80) / 80) * 255);
    }
    frames.push(mags);
  }
  return { frames, numBins };
}

/**
 * Full FFT render of `audioBuffer` into a canvas of exactly `width` x `height`.
 * `freqMinHz` / `freqMaxHz` crop the frequency axis; null means 0 / Nyquist.
 */
export function renderSpectrogram(audioBuffer, {
  width,
  height,
  freqMinHz = null,
  freqMaxHz = null,
  fftSize: fftSizeOverride = null,
}) {
  const nyquist = audioBuffer.sampleRate / 2;
  const fftSize = resolveFftSize(audioBuffer.sampleRate, freqMinHz, freqMaxHz, fftSizeOverride);
  const { frames, numBins } = computeFrames(audioBuffer, fftSize);

  const minBin = freqMinHz ? Math.max(0, Math.floor((freqMinHz / nyquist) * numBins)) : 0;
  const maxBin = freqMaxHz ? Math.min(numBins, Math.ceil((freqMaxHz / nyquist) * numBins)) : numBins;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  for (let col = 0; col < width; col++) {
    const frameIdx = Math.floor((col / width) * frames.length);
    const frame = frames[Math.min(frameIdx, frames.length - 1)];
    if (!frame) continue;
    for (let row = 0; row < height; row++) {
      const binIdx = minBin + Math.floor(((height - 1 - row) / height) * (maxBin - minBin));
      const v = frame[Math.min(binIdx, numBins - 1)];
      const [r, g, b] = valueToColor(v);
      const idx = (row * width + col) * 4;
      data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  return { canvas, minHz: freqMinHz ?? 0, maxHz: freqMaxHz ?? nyquist, fftSize };
}

/**
 * Width of the scrolling strip: the clip is stretched so `visibleSeconds` fill
 * one canvas width, and the player pans across it.
 */
export function offscreenWidthFor(canvasWidth, duration, visibleSeconds) {
  const zoomFactor = duration > visibleSeconds ? duration / visibleSeconds : 1;
  return Math.round(canvasWidth * zoomFactor);
}

/** Draw a stored spectrogram picture into a strip of the size the player expects. */
export function scaleImageToOffscreen(image, width, height) {
  const offscreen = document.createElement('canvas');
  offscreen.width = width;
  offscreen.height = height;
  const ctx = offscreen.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, image.naturalWidth || image.width, image.naturalHeight || image.height, 0, 0, width, height);
  return offscreen;
}

// 512 rows outrun the tallest canvas we ever draw into, so the frequency axis
// never has to be upscaled. Width is not fixed: see below.
export const PRERENDER_HEIGHT = 512;
export const PRERENDER_MAX_WIDTH = 12000;

/**
 * Render at the baked-image scale, independent of any on-screen canvas.
 *
 * One pixel column per FFT frame: that is exactly the time resolution the chosen
 * FFT size can express, so nothing is lost and nothing is wasted. A species tuned
 * for time detail (small FFT, ~344 frames/s at 512) gets a wide image; one tuned
 * for frequency detail (large FFT) gets a narrow one. Players stretch it to
 * whatever width their canvas needs.
 */
export function buildPrerenderCanvas(audioBuffer, { freqMinHz = null, freqMaxHz = null, fftSize = null } = {}) {
  const resolvedFftSize = resolveFftSize(audioBuffer.sampleRate, freqMinHz, freqMaxHz, fftSize);
  const frameRate = audioBuffer.sampleRate / Math.floor(resolvedFftSize / 4);
  const width = Math.max(
    1,
    Math.min(PRERENDER_MAX_WIDTH, Math.round(audioBuffer.duration * frameRate)),
  );
  return renderSpectrogram(audioBuffer, {
    width,
    height: PRERENDER_HEIGHT,
    freqMinHz,
    freqMaxHz,
    fftSize: resolvedFftSize,
  });
}

/** Encode a canvas, preferring WebP — spectrogram noise makes PNG very large. */
export function canvasToBlob(canvas) {
  const attempt = (type, quality) => new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob && blob.type === type ? blob : null), type, quality);
  });
  return attempt('image/webp', 0.85)
    .then(blob => blob || attempt('image/jpeg', 0.9))
    .then(blob => blob || attempt('image/png'));
}

/** Fetch and decode an audio file into an AudioBuffer, then release the context. */
export async function decodeAudioFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo descargar el audio (${response.status})`);
  const arrayBuffer = await response.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    return await ctx.decodeAudioData(arrayBuffer);
  } finally {
    ctx.close();
  }
}

const nullableNumber = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

/** kHz fields as stored on species/recordings -> Hz, or null for "unbounded". */
export function toHz(kHz) {
  const n = nullableNumber(kHz);
  return n ? n * 1000 : null;
}

/**
 * The one rule for turning a species/recording row into player props.
 *
 * Only the `spectrogram_*` window controls what the spectrogram shows. The
 * `frequency_*` fields are informative metadata about the species' voice and are
 * deliberately NOT consulted here: a blank spectrogram window means the full
 * range, not the informative range.
 *
 * Every consumer must resolve this the same way — the pre-rendered picture is only
 * reused when the parameters it was baked from still match, so a caller that
 * resolved them differently would silently fall back to computing in the browser.
 */
export function spectrogramSettings(record) {
  return {
    spectrogramMin: record?.spectrogram_min || null,
    spectrogramMax: record?.spectrogram_max || null,
    fftSize: record?.fft_size || null,
    spectrogramImage: record?.spectrogram_image || null,
  };
}

/**
 * Descriptor stored next to the uploaded picture. It records the inputs the image
 * was baked from so a player can tell whether the stored image still matches the
 * species' current parameters.
 */
export function buildSpectrogramMeta({
  url, audioUrl, freqMinHz, freqMaxHz, fftSize, visMinHz, visMaxHz, resolvedFftSize, width, duration,
}) {
  return {
    url,
    audio_url: audioUrl,
    // Requested parameters — what freshness is judged against.
    min_hz: freqMinHz ?? null,
    max_hz: freqMaxHz ?? null,
    fft_size: nullableNumber(fftSize),
    // Resolved values — what the picture actually shows, so the player can label
    // the frequency axis before (or without) decoding the audio.
    vis_min_hz: visMinHz,
    vis_max_hz: visMaxHz,
    resolved_fft_size: resolvedFftSize,
    width,
    height: PRERENDER_HEIGHT,
    duration,
    built_at: new Date().toISOString(),
  };
}

const sameNumber = (a, b) => nullableNumber(a) === nullableNumber(b);

/**
 * True when `meta` describes an image built from this exact audio and these exact
 * parameters. A stale image is ignored rather than shown with a wrong frequency
 * axis — the player falls back to computing the spectrogram live.
 */
export function isSpectrogramMetaFresh(meta, { audioUrl, freqMinHz, freqMaxHz, fftSize }) {
  if (!meta || !meta.url) return false;
  if (meta.audio_url !== audioUrl) return false;
  return sameNumber(meta.min_hz, freqMinHz)
    && sameNumber(meta.max_hz, freqMaxHz)
    && sameNumber(meta.fft_size, fftSize);
}
