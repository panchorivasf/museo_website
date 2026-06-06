import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';

// Module-level: only one mini spectrogram plays at a time.
// Stores a ref to the currently playing instance's pause fn.
let _stopActive = null;
export function stopActiveMiniSpectrogram() {
  if (_stopActive) { _stopActive(); _stopActive = null; }
}

const VISIBLE_SECONDS = 2;
const CANVAS_H = 72;

function fftInPlace(re, im) {
  const N = re.length;
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
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
        const nr = cRe * wRe - cIm * wIm; cIm = cRe * wIm + cIm * wRe; cRe = nr;
      }
    }
  }
}

function valueToColor(v) {
  const hue = 183 - (v / 255) * 50;
  const sat = 60 + (v / 255) * 30;
  const light = 10 + (v / 255) * 45;
  const s = sat / 100, l = light / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (hue < 60) { r = c; g = x; } else if (hue < 120) { r = x; g = c; }
  else if (hue < 180) { g = c; b = x; } else if (hue < 240) { g = x; b = c; }
  else if (hue < 300) { r = x; b = c; } else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function buildOffscreen(audioBuffer, canvasW, canvasH, freqMinHz, freqMaxHz) {
  const fftSize = 512;
  const hopSize = Math.floor(fftSize / 4);
  const numBins = fftSize / 2;
  const nyquist = audioBuffer.sampleRate / 2;
  const channelData = audioBuffer.getChannelData(0);
  const numFrames = Math.floor((channelData.length - fftSize) / hopSize);
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);
  const frames = [];

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    for (let i = 0; i < fftSize; i++) {
      const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
      re[i] = (channelData[start + i] || 0) * hann; im[i] = 0;
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

  const minBin = freqMinHz ? Math.max(0, Math.floor((freqMinHz / nyquist) * numBins)) : 0;
  const maxBin = freqMaxHz ? Math.min(numBins, Math.ceil((freqMaxHz / nyquist) * numBins)) : numBins;
  const duration = audioBuffer.duration;
  const zoomFactor = duration > VISIBLE_SECONDS ? duration / VISIBLE_SECONDS : 1;
  const offW = Math.round(canvasW * zoomFactor);

  const offscreen = document.createElement('canvas');
  offscreen.width = offW; offscreen.height = canvasH;
  const ctx = offscreen.getContext('2d');
  const imageData = ctx.createImageData(offW, canvasH);
  const data = imageData.data;

  for (let col = 0; col < offW; col++) {
    const frameIdx = Math.floor((col / offW) * frames.length);
    const frame = frames[Math.min(frameIdx, frames.length - 1)];
    for (let row = 0; row < canvasH; row++) {
      const binIdx = minBin + Math.floor(((canvasH - 1 - row) / canvasH) * (maxBin - minBin));
      const v = frame[Math.min(binIdx, numBins - 1)];
      const [r, g, b] = valueToColor(v);
      const idx = (row * offW + col) * 4;
      data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return offscreen;
}

export default function MiniSpectrogram({ audioUrl, frequencyMin, frequencyMax }) {
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const audioBufferRef = useRef(null);
  const animRef = useRef(null);
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  // Stable ref to the pause function — avoids circular useCallback deps
  const pauseFnRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);

  const renderAt = useCallback((t) => {
    const canvas = canvasRef.current;
    const offscreen = offscreenRef.current;
    if (!canvas || !offscreen) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const dur = audioBufferRef.current?.duration || 0;
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
  }, []);

  const stopSource = useCallback((resetOffset = true) => {
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    cancelAnimationFrame(animRef.current);
    if (resetOffset) pauseOffsetRef.current = 0;
  }, []);

  // pause defined before play to avoid temporal dead zone
  const pause = useCallback(() => {
    if (audioCtxRef.current && startTimeRef.current > 0) {
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
    if (dur > 0 && audioCtxRef.current && startTimeRef.current > 0) {
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
      const canvas = canvasRef.current;
      const dpr = window.devicePixelRatio || 1;
      const W = canvas ? canvas.offsetWidth * dpr : 240;
      const H = CANVAS_H * dpr;
      if (canvas) { canvas.width = W; canvas.height = H; }
      offscreenRef.current = buildOffscreen(
        audio, W, H,
        frequencyMin ? frequencyMin * 1000 : null,
        frequencyMax ? frequencyMax * 1000 : null,
      );
      setLoaded(true);
      renderAt(0);
    } catch {}
    setLoading(false);
  }, [audioUrl, frequencyMin, frequencyMax, loaded, loading, renderAt]);

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
      startTimeRef.current = 0;
      setPlaying(false);
      _stopActive = null;
      renderAt(0);
    };

    setPlaying(true);
    // Register via ref — no circular dep on pause
    _stopActive = () => pauseFnRef.current?.();
    animRef.current = requestAnimationFrame(drawFrame);
  }, [loadAudio, stopSource, drawFrame, renderAt]);

  useEffect(() => { loadAudio(); }, [audioUrl]);

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
