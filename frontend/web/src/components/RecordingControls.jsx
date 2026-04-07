/**
 * RecordingControls.jsx — Mic record/pause/stop with REAL waveform
 *
 * Waveform is driven by Web Audio API AnalyserNode reading live
 * frequency data from the mic stream on every animation frame.
 *
 * Props:
 *   isRecording  — Boolean, whether recording is active
 *   isPaused     — Boolean, whether paused
 *   stream       — MediaStream | null  (passed from LiveInterviewPage)
 *   onRecord     — Start / resume
 *   onPause      — Pause
 *   onStop       — Stop and submit
 */
import React, { useRef, useEffect, useCallback } from 'react';

// ─── Canvas sizing ───────────────────────────────────────────────────────────
const W = 280;   // canvas CSS + logical width
const H = 48;    // canvas CSS + logical height
const BAR_COUNT = 40;
const BAR_GAP   = 2;
const BAR_W     = (W - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT; // ~5px each

// ─── Color constants (match Tailwind primary-500 = #f97316) ─────────────────
const COLOR_ACTIVE  = '#f97316';
const COLOR_PAUSED  = 'rgba(249,115,22,0.4)';
const COLOR_IDLE    = 'rgba(255,255,255,0.15)';

export default function RecordingControls({
  isRecording,
  isPaused,
  stream,
  onRecord,
  onPause,
  onStop,
}) {
  const canvasRef    = useRef(null);
  const analyserRef  = useRef(null);
  const sourceRef    = useRef(null);
  const audioCtxRef  = useRef(null);
  const rafRef       = useRef(null);
  const dataArrayRef = useRef(null);

  // ── Draw one frame ──────────────────────────────────────────────────────
  const drawFrame = useCallback(() => {
    const canvas   = canvasRef.current;
    const analyser = analyserRef.current;
    const dataArr  = dataArrayRef.current;
    if (!canvas || !analyser || !dataArr) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    // Read frequency data (0-255 per bin)
    analyser.getByteFrequencyData(dataArr);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // We sample BAR_COUNT evenly-spaced bins from the lower half of the spectrum
    // (voice energy lives in roughly the bottom 25% of the FFT bins)
    const usableBins = Math.floor(analyser.frequencyBinCount * 0.25);

    for (let i = 0; i < BAR_COUNT; i++) {
      const binIndex = Math.floor((i / BAR_COUNT) * usableBins);
      const rawVal   = dataArr[binIndex]; // 0-255

      // Map to bar height: min 3px, max (H - 4)px
      const barH = 3 + ((rawVal / 255) * (H * dpr - 4 - 3));

      const x = i * (BAR_W * dpr + BAR_GAP * dpr);
      const y = (canvas.height - barH) / 2;

      ctx.fillStyle = isPaused ? COLOR_PAUSED : COLOR_ACTIVE;
      ctx.beginPath();
      // Pill-shaped bar: rounded top + bottom
      const radius = Math.min((BAR_W * dpr) / 2, barH / 2);
      ctx.roundRect(x, y, BAR_W * dpr, barH, radius);
      ctx.fill();
    }
  }, [isPaused]);

  // ── Idle draw (static low bars when not recording) ──────────────────────
  const drawIdle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < BAR_COUNT; i++) {
      // Gentle sine-wave pattern for idle state
      const idleH = (4 + Math.sin(i * 0.5) * 2) * dpr;
      const x     = i * (BAR_W * dpr + BAR_GAP * dpr);
      const y     = (canvas.height - idleH) / 2;
      ctx.fillStyle = COLOR_IDLE;
      ctx.beginPath();
      ctx.roundRect(x, y, BAR_W * dpr, idleH, idleH / 2);
      ctx.fill();
    }
  }, []);

  // ── Animation loop ───────────────────────────────────────────────────────
  const startLoop = useCallback(() => {
    const tick = () => {
      drawFrame();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [drawFrame]);

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // ── Set up / tear down AudioContext when stream changes ──────────────────
  useEffect(() => {
    // Clean up any previous context first
    stopLoop();
    if (sourceRef.current)   { try { sourceRef.current.disconnect(); }   catch (_) {} }
    if (analyserRef.current) { try { analyserRef.current.disconnect(); } catch (_) {} }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
    }
    analyserRef.current  = null;
    sourceRef.current    = null;
    audioCtxRef.current  = null;
    dataArrayRef.current = null;

    if (!stream || !isRecording) {
      drawIdle();
      return;
    }

    // Build the audio graph
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) { drawIdle(); return; }

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();

    // FFT size: higher = more frequency resolution, 256 is lightweight
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8; // 0=raw, 1=very smooth — 0.8 feels natural

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    // NOTE: deliberately NOT connecting analyser → audioCtx.destination
    // so we don't create feedback / echo through the speakers

    audioCtxRef.current  = audioCtx;
    analyserRef.current  = analyser;
    sourceRef.current    = source;
    dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

    startLoop();

    return () => {
      stopLoop();
      try { source.disconnect(); }  catch (_) {}
      try { analyser.disconnect(); } catch (_) {}
      if (audioCtx.state !== 'closed') audioCtx.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, isRecording]);

  // ── When paused: stop loop, draw last frame frozen, redraw in pause color
  useEffect(() => {
    if (!isRecording) {
      stopLoop();
      drawIdle();
      return;
    }
    if (isPaused) {
      stopLoop();
      // Redraw current frame in muted color
      drawFrame();
      return;
    }
    // Recording and not paused — ensure loop is running
    if (!rafRef.current && analyserRef.current) {
      startLoop();
    }
  }, [isPaused, isRecording, stopLoop, drawFrame, drawIdle, startLoop]);

  // ── Scale canvas for devicePixelRatio (sharp on retina) ─────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    drawIdle();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopLoop();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    };
  }, [stopLoop]);

  // ── Derived state ────────────────────────────────────────────────────────
  const recordingActive = isRecording && !isPaused;

  return (
    <div className="flex flex-col items-center gap-4">

      {/* ── Real-time waveform canvas ── */}
      <div className="relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          style={{ width: W, height: H }}
          className="block"
          aria-hidden="true"
        />

        {/* Mic status pill overlaid below canvas */}
        {recordingActive && (
          <div
            className="absolute -bottom-5 flex items-center gap-1.5 px-2 py-0.5
                       rounded-full bg-red-500/10 border border-red-500/20"
            aria-live="polite"
            role="status"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
              Live
            </span>
          </div>
        )}
      </div>

      {/* ── Buttons ── */}
      <div className="glass-panel px-6 py-4 flex items-center gap-6 mt-2">

        {/* Pause */}
        <button
          onClick={onPause}
          disabled={!isRecording}
          className="flex flex-col items-center gap-1 disabled:opacity-30 transition-opacity"
          aria-label="Pause recording"
          aria-pressed={isPaused}
        >
          <div
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
                       flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6"  y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-white/50">Pause</span>
        </button>

        {/* Record — main button */}
        <button
          onClick={onRecord}
          className="flex flex-col items-center gap-1"
          aria-label={recordingActive ? 'Recording in progress' : 'Start recording'}
          aria-pressed={recordingActive}
        >
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center
                       transition-all duration-300 ${
                         recordingActive
                           ? 'bg-red-500 glow-orange scale-110'
                           : 'bg-primary-500 hover:bg-primary-600'
                       }`}
          >
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          <span
            className={`text-[10px] uppercase tracking-wider ${
              recordingActive ? 'text-red-400' : 'text-white/50'
            }`}
          >
            {recordingActive ? 'Recording' : isPaused ? 'Paused' : 'Record'}
          </span>
        </button>

        {/* Stop */}
        <button
          onClick={onStop}
          disabled={!isRecording}
          className="flex flex-col items-center gap-1 disabled:opacity-30 transition-opacity"
          aria-label="Stop recording and submit answer"
        >
          <div
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
                       flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-white/50">Stop</span>
        </button>

      </div>
    </div>
  );
}
