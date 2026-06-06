import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, Volume2, VolumeX, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

// Cooley-Tukey radix-2 FFT (in-place)
function fftInPlace(re, im) {
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

function valueToColor(v) {
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

const VISIBLE_SECONDS = 4; // seconds visible in the canvas at once

function buildSpectrogramImage(audioBuffer, canvasWidth, canvasHeight) {
  const fftSize = 1024;
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

  // Offscreen canvas is wider than display by the zoom factor
  const duration = audioBuffer.duration;
  const zoomFactor = duration > VISIBLE_SECONDS ? duration / VISIBLE_SECONDS : 1;
  const offscreenWidth = Math.round(canvasWidth * zoomFactor);

  const offscreen = document.createElement('canvas');
  offscreen.width = offscreenWidth;
  offscreen.height = canvasHeight;
  const ctx = offscreen.getContext('2d');
  const imageData = ctx.createImageData(offscreenWidth, canvasHeight);
  const data = imageData.data;

  for (let col = 0; col < offscreenWidth; col++) {
    const frameIdx = Math.floor((col / offscreenWidth) * frames.length);
    const frame = frames[Math.min(frameIdx, frames.length - 1)];
    for (let row = 0; row < canvasHeight; row++) {
      const binIdx = Math.floor(((canvasHeight - 1 - row) / canvasHeight) * numBins);
      const v = frame[Math.min(binIdx, numBins - 1)];
      const [r, g, b] = valueToColor(v);
      const idx = (row * offscreenWidth + col) * 4;
      data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return offscreen;
}

export default function SpectrogramPlayer({ audioUrl, altText }) {
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const gainNodeRef = useRef(null);
  const audioBufferRef = useRef(null);
  const animFrameRef = useRef(null);
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const playbackRateRef = useRef(1);
  const isPlayingRef = useRef(false);
  const scrubbing = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [nyquist, setNyquist] = useState(null);

  const renderAtTime = useCallback((t) => {
    const canvas = canvasRef.current;
    const offscreen = offscreenRef.current;
    if (!canvas || !offscreen) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const dur = audioBufferRef.current?.duration || 0;
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

    // Frequency axis labels
    if (nyquist) {
      const step = 10000;
      ctx.font = `${Math.round(H * 0.055)}px monospace`;
      for (let f = step; f < nyquist; f += step) {
        const y = H * (1 - f / nyquist);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(4, y - 12, 42, 13);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(`${f / 1000} kHz`, 5, y - 2);
      }
    }

    // Playhead
    ctx.strokeStyle = '#BB9F06';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadScreen, 0);
    ctx.lineTo(playheadScreen, H);
    ctx.stroke();
  }, [nyquist]);

  const drawFrame = useCallback(() => {
    const dur = audioBufferRef.current?.duration || 0;
    if (dur > 0 && audioContextRef.current && startTimeRef.current > 0) {
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

    // Build spectrogram image
    const canvas = canvasRef.current;
    const w = canvas ? canvas.width : 800;
    const h = canvas ? canvas.height : 200;
    offscreenRef.current = buildSpectrogramImage(buffer, w, h);

    setIsLoaded(true);
    setIsLoading(false);
  }, [audioUrl, isLoaded]);

  // Draw static spectrogram once loaded
  // Auto-load on mount
  useEffect(() => {
    if (audioUrl) loadAudio();
  }, [audioUrl]);

  useEffect(() => {
    if (isLoaded && !isPlaying) {
      drawStatic();
    }
  }, [isLoaded, drawStatic]);

  const stopSource = useCallback((resetOffset = true) => {
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    cancelAnimationFrame(animFrameRef.current);
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
      startTimeRef.current = 0;
      setCurrentTime(0);
      setIsPlaying(false);
      drawStatic();
    };

    setIsPlaying(true);
    isPlayingRef.current = true;
    animFrameRef.current = requestAnimationFrame(drawFrame);
  }, [loadAudio, playbackRate, volume, muted, stopSource, drawFrame, drawStatic]);

  const pause = useCallback(() => {
    if (audioContextRef.current && startTimeRef.current > 0) {
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

  // Resize canvas and rebuild
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      if (isLoaded && audioBufferRef.current) {
        offscreenRef.current = buildSpectrogramImage(audioBufferRef.current, canvas.width, canvas.height);
        if (!isPlaying) drawStatic();
      }
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [isLoaded, isPlaying, drawStatic]);

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
        {!isLoaded && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-primary-foreground/60 text-sm font-body">Presiona reproducir para cargar el audio</p>
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-primary-foreground/60 text-xs font-body">Generando espectrograma...</p>
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
