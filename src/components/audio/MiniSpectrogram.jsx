import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import {
  isSpectrogramMetaFresh,
  offscreenWidthFor,
  renderSpectrogram,
  scaleImageToOffscreen,
  toHz,
} from '@/lib/spectrogram';

// Module-level: only one mini spectrogram plays at a time.
// Stores a ref to the currently playing instance's pause fn.
let _stopActive = null;
export function stopActiveMiniSpectrogram() {
  if (_stopActive) { _stopActive(); _stopActive = null; }
}

const VISIBLE_SECONDS = 2;
const CANVAS_H = 72;

function buildOffscreen(audioBuffer, canvasW, canvasH, freqMinHz, freqMaxHz, fftSizeOverride) {
  const offW = offscreenWidthFor(canvasW, audioBuffer.duration, VISIBLE_SECONDS);
  const { canvas } = renderSpectrogram(audioBuffer, {
    width: offW,
    height: canvasH,
    freqMinHz,
    freqMaxHz,
    fftSize: fftSizeOverride,
  });
  return canvas;
}

// Prop names match SpectrogramPlayer so both can be fed by spectrogramSettings().
export default function MiniSpectrogram({ audioUrl, spectrogramMin, spectrogramMax, fftSize, spectrogramImage }) {
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const audioBufferRef = useRef(null);
  const animRef = useRef(null);
  // null while stopped. Not 0: a freshly created AudioContext starts at
  // currentTime 0, so a truthiness check here would treat the first frames of
  // playback as "not playing" and freeze the playhead.
  const startTimeRef = useRef(null);
  const pauseOffsetRef = useRef(0);
  // Stable ref to the pause function — avoids circular useCallback deps
  const pauseFnRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);

  const freqMinHz = toHz(spectrogramMin);
  const freqMaxHz = toHz(spectrogramMax);

  // Only trust a stored picture that was baked from this audio with these exact
  // parameters. When one exists the audio is not fetched until play is pressed.
  const bakedMeta = useMemo(
    () => (isSpectrogramMetaFresh(spectrogramImage, { audioUrl, freqMinHz, freqMaxHz, fftSize })
      ? spectrogramImage
      : null),
    [spectrogramImage, audioUrl, freqMinHz, freqMaxHz, fftSize],
  );

  const renderAt = useCallback((t) => {
    const canvas = canvasRef.current;
    const offscreen = offscreenRef.current;
    if (!canvas || !offscreen) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const dur = audioBufferRef.current?.duration || bakedMeta?.duration || 0;
    const offW = offscreen.width;
    const centerX = W / 2;
    const playheadOff = dur > 0 ? (t / dur) * offW : 0;
    let srcX, playheadScreen;
    if (playheadOff <= centerX) { srcX = 0; playheadScreen = playheadOff; }
    else if (playheadOff >= offW - centerX) { srcX = offW - W; playheadScreen = playheadOff - srcX; }
    else { srcX = playheadOff - centerX; playheadScreen = centerX; }
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(offscreen, srcX, 0, W, H, 0, 0, W, H);
    ctx.strokeStyle = '#BB9F06';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(playheadScreen, 0); ctx.lineTo(playheadScreen, H); ctx.stroke();
  }, [bakedMeta]);

  /** Size the canvas to its box and return the device-pixel dimensions. */
  const sizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas ? canvas.offsetWidth * dpr : 240;
    const H = CANVAS_H * dpr;
    if (canvas) { canvas.width = W; canvas.height = H; }
    return { W, H };
  }, []);

  const stopSource = useCallback((resetOffset = true) => {
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    cancelAnimationFrame(animRef.current);
    startTimeRef.current = null;
    if (resetOffset) pauseOffsetRef.current = 0;
  }, []);

  // pause defined before play to avoid temporal dead zone
  const pause = useCallback(() => {
    if (audioCtxRef.current && startTimeRef.current !== null) {
      pauseOffsetRef.current = Math.min(
        pauseOffsetRef.current + (audioCtxRef.current.currentTime - startTimeRef.current),
        audioBufferRef.current?.duration || 0,
      );
    }
    stopSource(false);
    setPlaying(false);
    _stopActive = null;
  }, [stopSource]);

  // Keep ref up to date so _stopActive can always call the latest pause
  useEffect(() => { pauseFnRef.current = pause; }, [pause]);

  const drawFrame = useCallback(() => {
    const dur = audioBufferRef.current?.duration || 0;
    if (dur > 0 && audioCtxRef.current && startTimeRef.current !== null) {
      const elapsed = audioCtxRef.current.currentTime - startTimeRef.current;
      renderAt(Math.min(pauseOffsetRef.current + elapsed, dur));
    }
    animRef.current = requestAnimationFrame(drawFrame);
  }, [renderAt]);

  const loadAudio = useCallback(async () => {
    if (loaded || loading || !audioUrl) return;
    setLoading(true);
    try {
      const res = await fetch(audioUrl);
      const buf = await res.arrayBuffer();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const audio = await ctx.decodeAudioData(buf);
      audioBufferRef.current = audio;
      // The baked picture is already on screen — decoding here is only for playback.
      if (!bakedMeta) {
        const { W, H } = sizeCanvas();
        offscreenRef.current = buildOffscreen(audio, W, H, freqMinHz, freqMaxHz, fftSize);
        renderAt(0);
      }
      setLoaded(true);
    } catch {}
    setLoading(false);
  }, [audioUrl, freqMinHz, freqMaxHz, fftSize, loaded, loading, renderAt, bakedMeta, sizeCanvas]);

  const play = useCallback(async () => {
    await loadAudio();
    const ctx = audioCtxRef.current;
    const buffer = audioBufferRef.current;
    if (!ctx || !buffer) return;
    if (ctx.state === 'suspended') await ctx.resume();
    stopSource(false);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    sourceRef.current = source;
    startTimeRef.current = ctx.currentTime;
    source.start(0, pauseOffsetRef.current);

    source.onended = () => {
      cancelAnimationFrame(animRef.current);
      pauseOffsetRef.current = 0;
      startTimeRef.current = null;
      setPlaying(false);
      _stopActive = null;
      renderAt(0);
    };

    setPlaying(true);
    // Register via ref — no circular dep on pause
    _stopActive = () => pauseFnRef.current?.();
    animRef.current = requestAnimationFrame(drawFrame);
  }, [loadAudio, stopSource, drawFrame, renderAt]);

  // With a baked picture the audio is fetched only when the visitor presses play;
  // without one the spectrogram can only be drawn by decoding the file up front.
  useEffect(() => {
    if (!bakedMeta) loadAudio();
  }, [audioUrl, bakedMeta]);

  useEffect(() => {
    if (!bakedMeta) return undefined;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const { W, H } = sizeCanvas();
      const dur = audioBufferRef.current?.duration || bakedMeta.duration || 0;
      offscreenRef.current = scaleImageToOffscreen(img, offscreenWidthFor(W, dur, VISIBLE_SECONDS), H);
      renderAt(pauseOffsetRef.current);
    };
    // A broken picture falls back to the live path rather than showing nothing.
    img.onerror = () => { if (!cancelled) loadAudio(); };
    img.src = bakedMeta.url;
    return () => { cancelled = true; };
  }, [bakedMeta, sizeCanvas, renderAt]);

  useEffect(() => () => {
    cancelAnimationFrame(animRef.current);
    if (sourceRef.current) { try { sourceRef.current.stop(); } catch {} }
    if (audioCtxRef.current) audioCtxRef.current.close();
    _stopActive = null;
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: `${CANVAS_H}px`, borderRadius: '5px', overflow: 'hidden', background: '#062a2e' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      <button
        type="button"
        onClick={playing ? pause : play}
        style={{
          position: 'absolute', bottom: '5px', left: '5px',
          width: '24px', height: '24px', borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'white', padding: 0,
        }}
      >
        {playing
          ? <Pause style={{ width: '10px', height: '10px' }} />
          : <Play style={{ width: '10px', height: '10px', marginLeft: '1px' }} />}
      </button>

      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '14px', height: '14px', border: '2px solid #BB9F06', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        </div>
      )}
    </div>
  );
}
