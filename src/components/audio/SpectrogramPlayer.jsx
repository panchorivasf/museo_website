import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, Volume2, VolumeX, Gauge, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  isSpectrogramMetaFresh,
  offscreenWidthFor,
  renderSpectrogram,
  scaleImageToOffscreen,
  toHz,
} from '@/lib/spectrogram';

const VISIBLE_SECONDS = 4; // seconds visible in the canvas at once

function buildSpectrogramImage(audioBuffer, canvasWidth, canvasHeight, freqMinHz, freqMaxHz, fftSizeOverride) {
  const offscreenWidth = offscreenWidthFor(canvasWidth, audioBuffer.duration, VISIBLE_SECONDS);
  const { canvas, minHz, maxHz } = renderSpectrogram(audioBuffer, {
    width: offscreenWidth,
    height: canvasHeight,
    freqMinHz,
    freqMaxHz,
    fftSize: fftSizeOverride,
  });
  // Return visible freq range so labels can be drawn correctly
  return { offscreen: canvas, visMinHz: minHz, visMaxHz: maxHz };
}

// Built spectrograms are expensive (a full FFT pass over the file plus a per-pixel
// paint), and identical for the same audio at the same size and settings. Keep the
// last few keyed on exactly the inputs that change the image, so remounts, repeat
// visits and play/pause reuse the canvas instead of recomputing it.
const SPECTROGRAM_CACHE_LIMIT = 3;
const spectrogramCache = new Map();

const spectrogramCacheKey = (url, w, h, fftSize, minHz, maxHz) =>
  `${url}|${w}x${h}|${fftSize || 'auto'}|${minHz ?? ''}|${maxHz ?? ''}`;

function getSpectrogramImage(key, audioBuffer, w, h, minHz, maxHz, fftSize) {
  const cached = spectrogramCache.get(key);
  if (cached) return cached;
  const result = buildSpectrogramImage(audioBuffer, w, h, minHz, maxHz, fftSize);
  spectrogramCache.set(key, result);
  while (spectrogramCache.size > SPECTROGRAM_CACHE_LIMIT) {
    spectrogramCache.delete(spectrogramCache.keys().next().value);
  }
  return result;
}

export default function SpectrogramPlayer({ audioUrl, altText, spectrogramMin, spectrogramMax, fftSize, spectrogramImage }) {
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioBufferRef = useRef(null);
  const animFrameRef = useRef(null);
  // null while stopped — see MiniSpectrogram: a new AudioContext starts at
  // currentTime 0, so 0 cannot double as "not playing".
  const startTimeRef = useRef(null);
  const pauseOffsetRef = useRef(0);
  const playbackRateRef = useRef(1);
  const isPlayingRef = useRef(false);
  const scrubbing = useRef(false);
  const builtKeyRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [nyquist, setNyquist] = useState(null);
  const [visFreqRange, setVisFreqRange] = useState({ min: 0, max: null }); // Hz
  const [bakedImage, setBakedImage] = useState(null);

  const freqMinHz = toHz(spectrogramMin);
  const freqMaxHz = toHz(spectrogramMax);

  // A stored spectrogram picture is used only when it was baked from this audio
  // with these exact parameters; otherwise we fall back to computing it live.
  const bakedMeta = useMemo(
    () => (isSpectrogramMetaFresh(spectrogramImage, { audioUrl, freqMinHz, freqMaxHz, fftSize })
      ? spectrogramImage
      : null),
    [spectrogramImage, audioUrl, freqMinHz, freqMaxHz, fftSize],
  );

  useEffect(() => {
    if (!bakedMeta) { setBakedImage(null); return undefined; }
    let cancelled = false;
    const img = new Image();
    img.onload = () => { if (!cancelled) setBakedImage(img); };
    // A missing or broken picture is not fatal: the live FFT path still works.
    img.onerror = () => { if (!cancelled) setBakedImage(null); };
    img.src = bakedMeta.url;
    return () => { cancelled = true; };
  }, [bakedMeta]);

  const renderAtTime = useCallback((t) => {
    const canvas = canvasRef.current;
    const offscreen = offscreenRef.current;
    if (!canvas || !offscreen) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    // Before the audio finishes decoding the baked image already knows how long
    // the clip is, so the picture can be drawn without waiting for it.
    const dur = audioBufferRef.current?.duration || bakedMeta?.duration || 0;
    const offW = offscreen.width;
    const centerX = W / 2;

    // Position of playhead in offscreen canvas
    const playheadOffscreen = dur > 0 ? (t / dur) * offW : 0;

    let srcX, playheadScreen;
    if (playheadOffscreen <= centerX) {
      srcX = 0;
      playheadScreen = playheadOffscreen;
    } else if (playheadOffscreen >= offW - centerX) {
      srcX = offW - W;
      playheadScreen = playheadOffscreen - srcX;
    } else {
      srcX = playheadOffscreen - centerX;
      playheadScreen = centerX;
    }

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(offscreen, srcX, 0, W, H, 0, 0, W, H);

    // Frequency axis labels relative to visible range
    const visMax = visFreqRange.max ?? nyquist;
    if (visMax) {
      const visMin = visFreqRange.min;
      const rangeHz = visMax - visMin;
      // Pick a round step that gives ~4-6 labels
      const rawStep = rangeHz / 5;
      const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
      const step = Math.ceil(rawStep / magnitude) * magnitude;
      const firstLabel = Math.ceil(visMin / step) * step;
      const fontSize = Math.round(H * 0.055);
      ctx.font = `${fontSize}px monospace`;

      const labels = [];
      let widest = 0;
      for (let f = firstLabel; f < visMax; f += step) {
        const text = `${(f / 1000).toFixed(f % 1000 === 0 ? 0 : 1)} kHz`;
        widest = Math.max(widest, ctx.measureText(text).width);
        labels.push({ text, y: H * (1 - (f - visMin) / rangeHz) });
      }

      if (labels.length) {
        // One full-height gutter behind the whole axis instead of a box per label.
        // Sized from the widest label so it holds at any canvas size or zoom.
        const padX = Math.max(4, fontSize * 0.4);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(0, 0, widest + padX * 2, H);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        labels.forEach(({ text, y }) => ctx.fillText(text, padX, y - 2));
      }
    }

    // Playhead
    ctx.strokeStyle = '#BB9F06';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadScreen, 0);
    ctx.lineTo(playheadScreen, H);
    ctx.stroke();
  }, [nyquist, visFreqRange, bakedMeta]);

  const drawFrame = useCallback(() => {
    const dur = audioBufferRef.current?.duration || 0;
    if (dur > 0 && audioContextRef.current && startTimeRef.current !== null) {
      const elapsed = (audioContextRef.current.currentTime - startTimeRef.current) * playbackRateRef.current;
      const t = Math.min(pauseOffsetRef.current + elapsed, dur);
      setCurrentTime(t);
      renderAtTime(t);
    }
    animFrameRef.current = requestAnimationFrame(drawFrame);
  }, [renderAtTime]);

  const drawStatic = useCallback(() => {
    renderAtTime(pauseOffsetRef.current);
  }, [renderAtTime]);

  const loadAudio = useCallback(async () => {
    if (!audioUrl || isLoaded) return;
    setIsLoading(true);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioContextRef.current = ctx;
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer);
    audioBufferRef.current = buffer;
    setDuration(buffer.duration);
    setNyquist(buffer.sampleRate / 2);

    // The image itself is built by buildIfNeeded once isLoaded flips, so the
    // canvas is sized correctly and we never build the same thing twice.
    setIsLoaded(true);
    setIsLoading(false);
  }, [audioUrl, isLoaded]);

  // Build the offscreen spectrogram only when something that changes the image
  // changes: the audio, the canvas pixel size, or the frequency/FFT settings.
  const buildIfNeeded = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Fast path: a picture baked from these parameters only needs rescaling to the
    // strip the player pans across — no FFT, and no need to wait for the audio.
    if (bakedImage && bakedMeta) {
      const key = `image:${bakedMeta.url}|${canvas.width}x${canvas.height}`;
      if (builtKeyRef.current === key && offscreenRef.current) return;
      const dur = audioBufferRef.current?.duration || bakedMeta.duration || 0;
      if (!dur) return;
      const offW = offscreenWidthFor(canvas.width, dur, VISIBLE_SECONDS);
      offscreenRef.current = scaleImageToOffscreen(bakedImage, offW, canvas.height);
      builtKeyRef.current = key;
      const visMin = bakedMeta.vis_min_hz ?? 0;
      const visMax = bakedMeta.vis_max_hz ?? null;
      setVisFreqRange(prev => (prev.min === visMin && prev.max === visMax ? prev : { min: visMin, max: visMax }));
      return;
    }

    const buffer = audioBufferRef.current;
    if (!buffer || !isLoaded) return;

    const key = spectrogramCacheKey(audioUrl, canvas.width, canvas.height, fftSize, freqMinHz, freqMaxHz);
    if (builtKeyRef.current === key && offscreenRef.current) return;

    const result = getSpectrogramImage(key, buffer, canvas.width, canvas.height, freqMinHz, freqMaxHz, fftSize);
    offscreenRef.current = result.offscreen;
    builtKeyRef.current = key;
    // Bail out of the state update when the range is unchanged: a fresh object
    // here would invalidate renderAtTime -> drawStatic -> this effect, and rebuild forever.
    setVisFreqRange(prev =>
      prev.min === result.visMinHz && prev.max === result.visMaxHz
        ? prev
        : { min: result.visMinHz, max: result.visMaxHz }
    );
  }, [isLoaded, audioUrl, freqMinHz, freqMaxHz, fftSize, bakedImage, bakedMeta]);

  // Draw static spectrogram once loaded
  // Auto-load on mount
  useEffect(() => {
    if (audioUrl) loadAudio();
  }, [audioUrl]);

  useEffect(() => {
    if ((isLoaded || bakedImage) && !isPlaying) {
      buildIfNeeded();
      drawStatic();
    }
  }, [isLoaded, bakedImage, buildIfNeeded, drawStatic]);

  const stopSource = useCallback((resetOffset = true) => {
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    cancelAnimationFrame(animFrameRef.current);
    startTimeRef.current = null;
    if (resetOffset) {
      pauseOffsetRef.current = 0;
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, []);

  const play = useCallback(async () => {
    await loadAudio();
    const ctx = audioContextRef.current;
    const buffer = audioBufferRef.current;
    if (!ctx || !buffer) return;
    if (ctx.state === 'suspended') await ctx.resume();
    stopSource(false);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    playbackRateRef.current = playbackRate;

    const gain = ctx.createGain();
    gain.gain.value = muted ? 0 : volume;
    gainNodeRef.current = gain;

    source.connect(gain);
    gain.connect(ctx.destination);
    sourceRef.current = source;

    startTimeRef.current = ctx.currentTime;
    source.start(0, pauseOffsetRef.current);

    source.onended = () => {
      cancelAnimationFrame(animFrameRef.current);
      pauseOffsetRef.current = 0;
      startTimeRef.current = null;
      setCurrentTime(0);
      setIsPlaying(false);
      drawStatic();
    };

    setIsPlaying(true);
    isPlayingRef.current = true;
    animFrameRef.current = requestAnimationFrame(drawFrame);
  }, [loadAudio, playbackRate, volume, muted, stopSource, drawFrame, drawStatic]);

  const pause = useCallback(() => {
    if (audioContextRef.current && startTimeRef.current !== null) {
      const elapsed = (audioContextRef.current.currentTime - startTimeRef.current) * playbackRateRef.current;
      pauseOffsetRef.current = Math.min(pauseOffsetRef.current + elapsed, audioBufferRef.current?.duration || 0);
    }
    stopSource(false);
    setIsPlaying(false);
    isPlayingRef.current = false;
    drawStatic();
  }, [stopSource, drawStatic]);

  const seekTo = useCallback((t) => {
    const dur = audioBufferRef.current?.duration || 0;
    pauseOffsetRef.current = Math.max(0, Math.min(t, dur));
    setCurrentTime(pauseOffsetRef.current);
    if (isPlayingRef.current) {
      // restart from new position
      const ctx = audioContextRef.current;
      const buffer = audioBufferRef.current;
      stopSource(false);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRateRef.current;
      const gain = ctx.createGain();
      gain.gain.value = gainNodeRef.current?.gain.value ?? 0.8;
      gainNodeRef.current = gain;
      source.connect(gain);
      gain.connect(ctx.destination);
      sourceRef.current = source;
      startTimeRef.current = ctx.currentTime;
      source.start(0, pauseOffsetRef.current);
      source.onended = () => {
        cancelAnimationFrame(animFrameRef.current);
        pauseOffsetRef.current = 0;
        startTimeRef.current = 0;
        setCurrentTime(0);
        setIsPlaying(false);
        isPlayingRef.current = false;
        drawStatic();
      };
      animFrameRef.current = requestAnimationFrame(drawFrame);
    } else {
      drawStatic();
    }
  }, [stopSource, drawFrame, drawStatic]);

  const restart = useCallback(() => {
    pauseOffsetRef.current = 0;
    setCurrentTime(0);
    if (isPlaying) play();
    else drawStatic();
  }, [isPlaying, play, drawStatic]);

  // Update volume live
  useEffect(() => {
    if (gainNodeRef.current) gainNodeRef.current.gain.value = muted ? 0 : volume;
  }, [volume, muted]);

  // Restart with new rate when speed changes while playing
  useEffect(() => {
    playbackRateRef.current = playbackRate;
    if (isPlaying) play();
  }, [playbackRate]);

  // Cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (sourceRef.current) { try { sourceRef.current.stop(); } catch {} }
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  // Size the canvas to its box, then (re)build only if that actually changed the
  // pixel dimensions. Resize events are debounced so dragging a window edge can't
  // fire a full FFT per event.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let timer;
    const applySize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(canvas.offsetWidth * dpr);
      const h = Math.round(canvas.offsetHeight * dpr);
      if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w;
        canvas.height = h;
      }
      buildIfNeeded();
      if (!isPlayingRef.current) drawStatic();
    };
    applySize();
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(applySize, 150);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [buildIfNeeded, drawStatic]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  const speedLabel = playbackRate < 1 ? `${playbackRate}× (−${Math.round((1 - playbackRate) * 100)}% freq)` : `${playbackRate}×`;

  const handleCanvasClick = useCallback((e) => {
    if (!offscreenRef.current || !audioBufferRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const W = canvas.width;
    const offW = offscreenRef.current.width;
    const dur = audioBufferRef.current.duration;
    const centerX = W / 2;
    const playheadOff = dur > 0 ? (pauseOffsetRef.current / dur) * offW : 0;
    let srcX;
    if (playheadOff <= centerX) srcX = 0;
    else if (playheadOff >= offW - centerX) srcX = offW - W;
    else srcX = playheadOff - centerX;
    seekTo((srcX + clickX) / offW * dur);
  }, [seekTo]);

  const handleProgressPointer = useCallback((e) => {
    if (!audioBufferRef.current) return;
    const bar = e.currentTarget;
    const seek = (clientX) => {
      const rect = bar.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      seekTo(frac * audioBufferRef.current.duration);
    };
    seek(e.clientX);
    const onMove = (mv) => seek(mv.clientX);
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [seekTo]);

  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border shadow-lg" role="region" aria-label={altText || 'Reproductor de espectrograma'}>
      <div className="relative bg-primary/95 aspect-[3/1] min-h-[180px]">
        <canvas ref={canvasRef} onClick={handleCanvasClick} className="w-full h-full cursor-pointer" aria-label={altText || 'Espectrograma'} />
        {!isLoaded && !isLoading && !bakedImage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-primary-foreground/60 text-sm font-body">Presiona reproducir para cargar el audio</p>
          </div>
        )}
        {isLoading && !bakedImage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-primary-foreground/60 text-xs font-body">
                {bakedMeta ? 'Cargando audio...' : 'Generando espectrograma...'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={restart} className="h-8 w-8 text-muted-foreground hover:text-primary" aria-label="Reiniciar">
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button size="icon" onClick={isPlaying ? pause : play} className="h-10 w-10 rounded-full bg-secondary hover:bg-secondary/90 text-secondary-foreground" aria-label={isPlaying ? 'Pausar' : 'Reproducir'}>
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </Button>
          <div className="flex-1 flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <div
              className="flex-1 h-2 bg-muted rounded-full overflow-hidden cursor-pointer"
              onPointerDown={handleProgressPointer}
            >
              <div className="h-full bg-secondary rounded-full" style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }} />
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Gauge className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-mono text-muted-foreground w-28 shrink-0">{speedLabel}</span>
            <Slider value={[playbackRate]} onValueChange={([v]) => setPlaybackRate(Math.round(v * 100) / 100)} min={0.1} max={2} step={0.05} className="flex-1" aria-label="Velocidad de reproducción" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPlaybackRate(1)}
              disabled={playbackRate === 1}
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary disabled:opacity-30"
              title="Restablecer velocidad a 1×"
              aria-label="Restablecer velocidad a 1×"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setMuted(!muted)} className="h-8 w-8 text-muted-foreground" aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <Slider value={[muted ? 0 : volume]} onValueChange={([v]) => { setVolume(v); setMuted(false); }} min={0} max={1} step={0.01} className="w-20" aria-label="Volumen" />
          </div>
        </div>

        {playbackRate < 1 && (
          <p className="text-xs text-ocher font-body">⚡ Frecuencias reducidas {Math.round((1 - playbackRate) * 100)}% — ultrasonidos ahora audibles</p>
        )}
      </div>
    </div>
  );
}
