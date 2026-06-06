import React, { useRef, useEffect, useState } from 'react';

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

export default function MiniSpectrogram({ audioUrl }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!audioUrl || done) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const res = await fetch(audioUrl);
        const buf = await res.arrayBuffer();
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const audio = await ctx.decodeAudioData(buf);
        ctx.close();
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const W = canvas.width;
        const H = canvas.height;

        const fftSize = 512;
        const hopSize = Math.floor(fftSize / 4);
        const numBins = fftSize / 2;
        const channelData = audio.getChannelData(0);
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

        const c2d = canvas.getContext('2d');
        const imageData = c2d.createImageData(W, H);
        const data = imageData.data;
        for (let col = 0; col < W; col++) {
          const frameIdx = Math.floor((col / W) * frames.length);
          const frame = frames[Math.min(frameIdx, frames.length - 1)];
          for (let row = 0; row < H; row++) {
            const binIdx = Math.floor(((H - 1 - row) / H) * numBins);
            const v = frame[Math.min(binIdx, numBins - 1)];
            const [r, g, b] = valueToColor(v);
            const idx = (row * W + col) * 4;
            data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
          }
        }
        c2d.putImageData(imageData, 0, 0);
        setDone(true);
      } catch {}
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [audioUrl]);

  return (
    <div className="flex-1 relative rounded overflow-hidden bg-primary/80" style={{ height: '36px' }}>
      <canvas
        ref={canvasRef}
        width={240}
        height={36}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 border border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
