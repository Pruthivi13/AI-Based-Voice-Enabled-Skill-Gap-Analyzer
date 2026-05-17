/**
 * WarmupPage.jsx — /warmup
 *
 * 4-phase warmup before a real interview:
 *   Phase 0 — INTRO: explains what's about to happen
 *   Phase 1 — BREATHE: guided breathing ring (2 cycles)
 *   Phase 2 — MIC CHECK: warmup question + voice meter
 *   Phase 3 — READY: celebration → navigate to /interview
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wind, Mic, CheckCircle2, ArrowRight,
  SkipForward, Sparkles, MicOff,
  Lightbulb, Activity, MessageCircle,
  Brain, Target, Timer, Sprout, Zap,
} from 'lucide-react';
import WarmupBreathingRing from '../components/WarmupBreathingRing';
import WarmupReadyMeter from '../components/WarmupReadyMeter';
import { fetchWarmupQuestion, getToken } from '../services/api';

const PHASES = [
  { id: 'intro',   label: 'Get Ready',     icon: Sparkles,     color: '#a78bfa' },
  { id: 'breathe', label: 'Breathe',       icon: Wind,         color: '#38bdf8' },
  { id: 'speak',   label: 'Warm Up Voice', icon: Mic,          color: '#f97316' },
  { id: 'ready',   label: "You're Ready",  icon: CheckCircle2, color: '#34d399' },
];

const slideVariants = {
  enter:  (dir) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0 },
  exit:   (dir) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
};

const TIPS = [
  { Icon: Mic, color: '#f97316', text: 'Speak at your normal pace — no need to rush' },
  { Icon: Lightbulb, color: '#facc15', text: 'This question is NOT scored — just get comfortable' },
  { Icon: Activity, color: '#a78bfa', text: 'A short breathing exercise will calm your nerves' },
  { Icon: CheckCircle2, color: '#34d399', text: 'Your mic will be checked before the real interview' },
];

function ConfidenceLabel({ level }) {
  const map = {
    low:    { label: 'Building…',     color: '#fb923c', Icon: Sprout },
    medium: { label: 'Getting there', color: '#f97316', Icon: () => <img src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif" alt="fire" style={{ width: '1em', height: '1em', verticalAlign: '-0.15em' }} /> },
    high:   { label: 'Feeling good!', color: '#34d399', Icon: Zap },
  };
  const m = map[level] || map.medium;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 99,
        background: `${m.color}15`, border: `1px solid ${m.color}30` }}>
      <m.Icon size={16} style={{ color: m.color }} />
      <span style={{ color: m.color, fontSize: 13, fontWeight: 700 }}>{m.label}</span>
    </motion.div>
  );
}

export default function WarmupPage() {
  const navigate = useNavigate();
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [warmupQ, setWarmupQ] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [micError, setMicError] = useState('');
  const [confidenceLevel, setConfidenceLevel] = useState('low');
  const [timeLeft, setTimeLeft] = useState(90);

  const mediaRecorderRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  const phase = PHASES[phaseIdx];

  useEffect(() => {
    fetchWarmupQuestion()
      .then((d) => setWarmupQ(d.question))
      .catch(() => setWarmupQ({
        id: 'fallback', content: 'Tell me a little about yourself and what you enjoy doing.',
        category: 'life', prompt: "Just speak naturally — there's no right or wrong answer.",
      }));
  }, []);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    wsRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const goNext = useCallback(() => {
    setDirection(1);
    setPhaseIdx((i) => Math.min(i + 1, PHASES.length - 1));
  }, []);

  const skipToInterview = useCallback(() => {
    stopRecording();
    navigate('/interview');
  }, [navigate]);

  const startMic = useCallback(async () => {
    setMicError('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = s;
      setStream(s);

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const wsUrl = API_URL.replace('http', 'ws');
      const token = await getToken();
      if (!token) throw new Error('Missing auth token');
      const ws = new WebSocket(
        `${wsUrl}/ws/transcribe/warmup-${crypto.randomUUID()}?token=${encodeURIComponent(token)}`
      );
      wsRef.current = ws;

      ws.onmessage = async (event) => {
        const raw = event.data instanceof Blob ? await event.data.text() : event.data;
        try {
          const msg = JSON.parse(raw);
          if (msg.type === 'partial' || msg.type === 'final') setTranscript(msg.text || '');
        } catch {}
      };

      const mr = new MediaRecorder(s, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
      };
      mr.start(200);
      setIsRecording(true);

      setTimeLeft(90);
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) { clearInterval(timerRef.current); stopRecording(); return 0; }
          return t - 1;
        });
      }, 1000);
    } catch {
      setMicError('Microphone access denied. Please allow mic access to continue.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    setIsRecording(false);
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setStream(null);
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send('END');
  }, []);

  const handleWarmupDone = useCallback(() => { stopRecording(); goNext(); }, [stopRecording, goNext]);

  // ── RENDER PHASES ──────────────────────────────────────────────────────────
  const renderPhase = () => {
    switch (phase.id) {
      case 'intro':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 24, maxWidth: 440, margin: '0 auto' }}>
            <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{ width: 72, height: 72, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(167,139,250,0.2), rgba(167,139,250,0.05))',
                border: '1.5px solid rgba(167,139,250,0.3)', boxShadow: '0 0 40px rgba(167,139,250,0.2)' }}>
              <Sparkles size={32} style={{ color: '#a78bfa' }} />
            </motion.div>
            <div>
              <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                Let's warm up first <Mic size={24} style={{ color: '#f97316' }} />
              </motion.h2>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, lineHeight: 1.6 }}>
                First-question anxiety is real — it skews your scores. This 2-minute warmup gets you interview-ready.
              </motion.p>
            </div>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TIPS.map((tip, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.08 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 16, textAlign: 'left',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <tip.Icon size={18} style={{ color: tip.color, flexShrink: 0 }} strokeWidth={2.2} />
                  <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13 }}>{tip.text}</span>
                </motion.div>
              ))}
            </div>
            <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              onClick={goNext}
              style={{ width: '100%', padding: '14px 20px', borderRadius: 16, border: 'none', color: '#fff', fontWeight: 700, fontSize: 16,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', boxShadow: '0 8px 24px rgba(167,139,250,0.3)' }}>
              <Wind size={20} /> Start Breathing Exercise <ArrowRight size={18} />
            </motion.button>
            <button onClick={skipToInterview}
              style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}>
              Skip warmup — go straight to interview →
            </button>
          </div>
        );

      case 'breathe':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 32 }}>
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Clear your mind</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: 0 }}>Follow the ring — two full breath cycles</p>
            </motion.div>
            <WarmupBreathingRing totalCycles={2} onComplete={goNext} />
            <button onClick={goNext}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600,
                color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <SkipForward size={14} /> Skip breathing
            </button>
          </div>
        );

      case 'speak':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, maxWidth: 520, margin: '0 auto', width: '100%' }}>
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(249,115,22,0.8)' }}>Not Scored</span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', animation: 'pulse 2s infinite' }} />
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Warm up your voice</h2>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>Answer casually — just to get comfortable</p>
            </motion.div>

            {warmupQ && (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
                style={{ width: '100%', borderRadius: 24, padding: 24,
                  background: 'linear-gradient(135deg, rgba(249,115,22,0.1), rgba(249,115,22,0.03))',
                  border: '1.5px solid rgba(249,115,22,0.25)', boxShadow: '0 0 30px rgba(249,115,22,0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <MessageCircle size={18} style={{ color: '#fb923c' }} />
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fb923c' }}>Warmup Question</span>
                </div>
                <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1.4, marginBottom: 12 }}>"{warmupQ.content}"</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Lightbulb size={13} style={{ color: 'rgba(255,255,255,0.35)' }} /> {warmupQ.prompt}
                </p>
              </motion.div>
            )}

            {isRecording && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, color: timeLeft <= 15 ? '#f87171' : 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600 }}>
                <Timer size={14} /> {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')} remaining
              </motion.div>
            )}

            {transcript && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ width: '100%', borderRadius: 16, padding: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>Live Transcript</p>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{transcript}</p>
              </motion.div>
            )}

            <WarmupReadyMeter stream={stream} isRecording={isRecording} />

            {micError && <p style={{ color: '#f87171', fontSize: 12, fontWeight: 600 }}>{micError}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
              {!isRecording ? (
                <button onClick={startMic}
                  style={{ width: '100%', padding: '16px 24px', borderRadius: 16, border: 'none', color: '#fff', fontWeight: 700, fontSize: 16,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                    background: 'linear-gradient(135deg, #f97316, #ea6a0a)', boxShadow: '0 8px 24px rgba(249,115,22,0.3)' }}>
                  <Mic size={20} /> Start Speaking
                </button>
              ) : (
                <button onClick={handleWarmupDone}
                  style={{ width: '100%', padding: '16px 24px', borderRadius: 16, border: 'none', color: '#fff', fontWeight: 700, fontSize: 16,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                    background: 'linear-gradient(135deg, #34d399, #059669)', boxShadow: '0 8px 24px rgba(52,211,153,0.25)' }}>
                  <CheckCircle2 size={20} /> I'm Done — Continue <ArrowRight size={18} />
                </button>
              )}
              <button onClick={skipToInterview}
                style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}>
                Skip warmup entirely →
              </button>
            </div>
          </div>
        );

      case 'ready':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 32, maxWidth: 440, margin: '0 auto' }}>
            <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 18 }}
              style={{ width: 112, height: 112, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'radial-gradient(circle, rgba(52,211,153,0.2) 0%, rgba(52,211,153,0.04) 70%)',
                border: '2px solid rgba(52,211,153,0.4)', boxShadow: '0 0 50px rgba(52,211,153,0.2)' }}>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}>
                <CheckCircle2 size={54} style={{ color: '#34d399' }} />
              </motion.div>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <Sparkles size={40} style={{ color: '#facc15' }} />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <h2 style={{ fontSize: 30, fontWeight: 800, color: '#fff', marginBottom: 12 }}>You're warmed up!</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, lineHeight: 1.7 }}>
                Your voice is ready and your nerves are settled. The real interview begins now — you've got this.
              </p>
            </motion.div>
            <ConfidenceLabel level={confidenceLevel} />
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
              style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              {[
                { Icon: Brain, label: 'Mind', value: 'Focused', color: '#a78bfa' },
                { Icon: Wind, label: 'Breath', value: 'Steady', color: '#38bdf8' },
                { Icon: Mic, label: 'Voice', value: 'Ready', color: '#f97316' },
              ].map(({ Icon, label, value, color }) => (
                <div key={label} style={{ borderRadius: 16, padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
                  <Icon size={24} style={{ color }} />
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399' }}>{value}</span>
                </div>
              ))}
            </motion.div>
            <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              onClick={() => navigate('/interview')}
              style={{ width: '100%', padding: '16px 24px', borderRadius: 16, border: 'none', color: '#fff', fontWeight: 700, fontSize: 18,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                background: 'linear-gradient(135deg, #f97316, #ea6a0a)', boxShadow: '0 10px 30px rgba(249,115,22,0.35)' }}>
              <Target size={20} /> Start Real Interview <ArrowRight size={20} />
            </motion.button>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(160deg, #080c14 0%, #0a0f1e 50%, #060912 100%)' }}>
      {/* Top bar */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, zIndex: 10 }}>
          {PHASES.map((p, i) => (
            <React.Fragment key={p.id}>
              <div style={{
                width: i === phaseIdx ? 28 : 8, height: 8, borderRadius: 99,
                background: i < phaseIdx ? '#34d399' : i === phaseIdx ? p.color : 'rgba(255,255,255,0.12)',
                transition: 'all 0.4s cubic-bezier(0.25,0.46,0.45,0.94)',
                boxShadow: i === phaseIdx ? `0 0 10px ${p.color}60` : 'none',
              }} />
              {i < PHASES.length - 1 && <div style={{ width: 12, height: 1, background: 'rgba(255,255,255,0.08)' }} />}
            </React.Fragment>
          ))}
        </div>
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
          <AnimatePresence mode="wait">
            <motion.span key={phase.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: phase.color }}>
              {phase.label}
            </motion.span>
          </AnimatePresence>
        </div>
        <button onClick={skipToInterview}
          style={{ zIndex: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 99,
            color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', cursor: 'pointer' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}>
          <SkipForward size={13} /> Skip
        </button>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div key={phase.id} custom={direction} variants={slideVariants}
              initial="enter" animate="center" exit="exit" transition={{ duration: 0.35, ease: 'easeInOut' }}>
              {renderPhase()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Ambient glow */}
      <div style={{ position: 'fixed', bottom: -100, left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 250, borderRadius: '50%',
        background: `radial-gradient(circle, ${phase.color}12 0%, transparent 70%)`,
        filter: 'blur(40px)', pointerEvents: 'none', zIndex: -1, transition: 'background 0.8s ease' }} />

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
