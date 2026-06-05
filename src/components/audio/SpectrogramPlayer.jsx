import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, Volume2, VolumeX, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

export default function SpectrogramPlayer({ audioUrl, frequencyRange, altText }) {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const audioBufferRef = useRef(null);
  const animFrameRef = useRef(null);
  const spectrogramDataRef = useRef([]);
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [nyquist, setNyquist] = useState(null);
  const gainNodeRef = useRef(null);

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
    setIsLoaded(true);
    setIsLoading(false);
  }, [audioUrl, isLoaded]);

  const drawSpectrogram = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    spectrogramDataRef.current.push(new Uint8Array(dataArray));

    const maxCols = canvas.width;
    if (spectrogramDataRef.current.length > maxCols) {
      spectrogramDataRef.current.shift();
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const colWidth = canvas.width / maxCols;
    const data = spectrogramDataRef.current;

    for (let x = 0; x < data.length; x++) {
      const col = data[x];
      const sliceHeight = canvas.height / col.length;
      for (let y = 0; y < col.length; y++) {
        const value = col[y];
        const hue = 183 - (value / 255) * 50;
        const sat = 60 + (value / 255) * 30;
        const light = 10 + (value / 255) * 45;
        ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
        ctx.fillRect(x * colWidth, canvas.height - (y + 1) * sliceHeight, colWidth + 1, sliceHeight + 1);
      }
    }

    // Playhead
    const progress = data.length / maxCols;
    ctx.strokeStyle = '#BB9F06';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(data.length * colWidth, 0);
    ctx.lineTo(data.length * colWidth, canvas.height);
    ctx.stroke();

    // Update current time
    if (audioContextRef.current && startTimeRef.current > 0) {
      const elapsed = (audioContextRef.current.currentTime - startTimeRef.current) * playbackRate;
      setCurrentTime(Math.min(pauseOffsetRef.current + elapsed, duration));
    }

    animFrameRef.current = requestAnimationFrame(drawSpectrogram);
  }, [playbackRate, duration]);

  const play = useCallback(async () => {
    await loadAudio();
    const ctx = audioContextRef.current;
    const buffer = audioBufferRef.current;
    if (!ctx || !buffer) return;

    if (ctx.state === 'suspended') await ctx.resume();

    stop(false);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;

    const gain = ctx.createGain();
    gain.gain.value = muted ? 0 : volume;
    gainNodeRef.current = gain;

    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);

    analyserRef.current = analyser;
    sourceRef.current = source;

    spectrogramDataRef.current = [];
    startTimeRef.current = ctx.currentTime;
    source.start(0, pauseOffsetRef.current);

    source.onended = () => {
      setIsPlaying(false);
      pauseOffsetRef.current = 0;
      setCurrentTime(0);
      cancelAnimationFrame(animFrameRef.current);
    };

    setIsPlaying(true);
    drawSpectrogram();
  }, [loadAudio, playbackRate, volume, muted, drawSpectrogram]);

  const stop = useCallback((resetOffset = true) => {
    if (sourceRef.current) {
      sourceRef.current.onended = null;
      sourceRef.current.stop();
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

  const pause = useCallback(() => {
    if (audioContextRef.current && startTimeRef.current > 0) {
      const elapsed = (audioContextRef.current.currentTime - startTimeRef.current) * playbackRate;
      pauseOffsetRef.current = Math.min(pauseOffsetRef.current + elapsed, duration);
    }
    stop(false);
    setIsPlaying(false);
  }, [stop, playbackRate, duration]);

  const restart = useCallback(() => {
    pauseOffsetRef.current = 0;
    setCurrentTime(0);
    spectrogramDataRef.current = [];
    if (isPlaying) {
      play();
    }
  }, [isPlaying, play]);

  // Update volume in real time
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = muted ? 0 : volume;
    }
  }, [volume, muted]);

  // Restart with new rate when speed changes
  useEffect(() => {
    if (isPlaying) {
      play();
    }
  }, [playbackRate]);

  // Cleanup
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (sourceRef.current) {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const speedLabel = playbackRate < 1 ? `${playbackRate}× (−${Math.round((1 - playbackRate) * 100)}% freq)` : `${playbackRate}×`;

  return (
    <div
      className="rounded-xl overflow-hidden bg-card border border-border shadow-lg"
      role="region"
      aria-label={altText || 'Reproductor de espectrograma'}
    >
      {/* Spectrogram Canvas */}
      <div className="relative bg-primary/95 aspect-[3/1] min-h-[180px]">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          aria-label={altText || 'Visualización de espectrograma'}
        />
        {!isLoaded && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-primary-foreground/60 text-sm font-body">
              Presiona reproducir para cargar el audio
            </p>
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {/* Freq axis labels — derived from actual audio sample rate */}
        {nyquist && (
          <div className="absolute left-2 top-2 bottom-2 flex flex-col justify-between pointer-events-none">
            {[1, 0.75, 0.5, 0.25, 0].map(fraction => {
              const freq = nyquist * fraction;
              const label = freq >= 1000 ? `${(freq / 1000).toFixed(freq % 1000 === 0 ? 0 : 1)} kHz` : `${Math.round(freq)} Hz`;
              return (
                <span key={fraction} className="text-[10px] font-mono text-primary-foreground/50 leading-none">
                  {label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 space-y-3">
        {/* Playback controls */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={restart}
            className="h-8 w-8 text-muted-foreground hover:text-primary"
            aria-label="Reiniciar"
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            onClick={isPlaying ? pause : play}
            className="h-10 w-10 rounded-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </Button>
          <div className="flex-1 flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-secondary rounded-full transition-all"
                style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
              />
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Speed + Volume */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Gauge className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-mono text-muted-foreground w-28 shrink-0">{speedLabel}</span>
            <Slider
              value={[playbackRate]}
              onValueChange={([v]) => setPlaybackRate(Math.round(v * 100) / 100)}
              min={0.1}
              max={2}
              step={0.05}
              className="flex-1"
              aria-label="Velocidad de reproducción"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMuted(!muted)}
              className="h-8 w-8 text-muted-foreground"
              aria-label={muted ? 'Activar sonido' : 'Silenciar'}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <Slider
              value={[muted ? 0 : volume]}
              onValueChange={([v]) => { setVolume(v); setMuted(false); }}
              min={0}
              max={1}
              step={0.01}
              className="w-20"
              aria-label="Volumen"
            />
          </div>
        </div>

        {playbackRate < 1 && (
          <p className="text-xs text-ocher font-body">
            ⚡ Frecuencias reducidas {Math.round((1 - playbackRate) * 100)}% — ultrasonidos ahora audibles
          </p>
        )}
      </div>
    </div>
  );
}