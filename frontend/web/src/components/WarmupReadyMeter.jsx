/**
 * WarmupReadyMeter.jsx
 *
 * Fills a "readiness" bar as the user speaks during the warmup question.
 * Reads audio volume from the mic stream and accumulates speaking time.
 * When the meter hits 100% (≥28s of actual speech), the Continue button activates.
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';

const SPEECH_THRESHOLD  = 18;   // RMS volume level considered "speaking"
const REQUIRED_SECONDS  = 28;   // seconds of speech needed to fill meter
const TICK_INTERVAL_MS  = 200;  // how often we sample

export default function WarmupReadyMeter({ stream, isRecording }) {
  const [speakingSeconds, setSpeakingSeconds] = useState(0);
  const [isSpeaking,      setIsSpeaking]      = useState(false);
  const [volume,          setVolume]          = useState(0);  // 0-100

  const analyserRef  = useRef(null);
  const audioCtxRef  = useRef(null);
  const sourceRef    = useRef(null);
  const intervalRef  = useRef(null);
  const dataRef      = useRef(null);

  useEffect(() => {
    if (!stream || !isRecording) {
      clearInterval(intervalRef.current);
      if (audioCtxRef.current?.state !== 'closed') {
        audioCtxRef.current?.close();
      }
      analyserRef.current = null;
      sourceRef.current   = null;
      audioCtxRef.current = null;
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx      = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.7;

    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    audioCtxRef.current  = ctx;
    analyserRef.current  = analyser;
    sourceRef.current    = source;
    dataRef.current      = new Uint8Array(analyser.frequencyBinCount);

    intervalRef.current = setInterval(() => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataRef.current);
      const rms = Math.sqrt(
        dataRef.current.reduce((sum, v) => sum + v * v, 0) / dataRef.current.length
      );
      const vol = Math.min(100, (rms / 80) * 100);
      setVolume(vol);

      const speaking = rms > SPEECH_THRESHOLD;
      setIsSpeaking(speaking);
      if (speaking) {
        setSpeakingSeconds((s) => Math.min(s + TICK_INTERVAL_MS / 1000, REQUIRED_SECONDS));
      }
    }, TICK_INTERVAL_MS);

    return () => {
      clearInterval(intervalRef.current);
      try { source.disconnect(); } catch {}
      if (ctx.state !== 'closed') ctx.close();
    };
  }, [stream, isRecording]);

  const pct     = Math.round((speakingSeconds / REQUIRED_SECONDS) * 100);
  const isReady = pct >= 100;

  const meterColor = isReady
    ? '#34d399'
    : pct > 60
      ? '#f97316'
      : '#38bdf8';

  // Volume bars (visualizer strip under the meter)
  const BAR_COUNT = 24;
  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const center = BAR_COUNT / 2;
    const dist   = Math.abs(i - center) / center;          // 0 at center, 1 at edges
    const envH   = isSpeaking ? (1 - dist * 0.6) : 0.15;  // envelope shape
    const h      = Math.max(3, envH * (volume / 100) * 36 + Math.random() * 4);
    return h;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: '100%' }}>

      {/* Mic status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {isRecording ? (
          <>
            <motion.div
              animate={{ scale: isSpeaking ? [1, 1.2, 1] : 1 }}
              transition={{ duration: 0.4, repeat: isSpeaking ? Infinity : 0 }}
            >
              <Mic size={18} style={{ color: '#f97316' }} />
            </motion.div>
            <span style={{ fontSize: 12, color: isSpeaking ? '#f97316' : 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
              {isSpeaking ? '🟠 Speaking…' : 'Waiting for your voice…'}
            </span>
          </>
        ) : (
          <>
            <MicOff size={18} style={{ color: 'rgba(255,255,255,0.25)' }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
              Mic not started
            </span>
          </>
        )}
      </div>

      {/* Volume bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2.5, height: 44 }}>
        {bars.map((h, i) => (
          <motion.div
            key={i}
            animate={{ height: isRecording ? h : 3 }}
            transition={{ duration: 0.15 }}
            style={{
              width: 5,
              borderRadius: 99,
              background: isSpeaking
                ? `rgba(249,115,22,${0.3 + (h / 36) * 0.7})`
                : 'rgba(255,255,255,0.1)',
              minHeight: 3,
            }}
          />
        ))}
      </div>

      {/* Ready meter */}
      <div style={{ width: '100%', maxWidth: 280 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>
            Voice Warmup
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: meterColor }}>
            {pct}%
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              height: '100%',
              borderRadius: 99,
              background: `linear-gradient(90deg, ${meterColor}80, ${meterColor})`,
              boxShadow: pct > 10 ? `0 0 10px ${meterColor}60` : 'none',
            }}
          />
        </div>
        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 6, textAlign: 'center' }}>
          {isReady
            ? '✅ Voice is warmed up!'
            : `Keep talking — ${Math.max(0, REQUIRED_SECONDS - speakingSeconds).toFixed(0)}s to go`}
        </p>
      </div>
    </div>
  );
}
