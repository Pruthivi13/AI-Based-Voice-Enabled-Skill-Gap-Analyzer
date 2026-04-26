/**
 * WarmupBreathingRing.jsx
 *
 * Animated breathing guide ring used in Phase 1 of the warmup.
 * Cycles through: Inhale 4s → Hold 2s → Exhale 4s → Rest 1s
 * The outer ring expands/contracts in sync with the breathing cue.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CYCLE = [
  { phase: 'Inhale',  duration: 4000, scale: 1.35, color: '#38bdf8', hint: 'Breathe in slowly…' },
  { phase: 'Hold',    duration: 2000, scale: 1.35, color: '#a78bfa', hint: 'Hold it…'            },
  { phase: 'Exhale',  duration: 4000, scale: 1.00, color: '#34d399', hint: 'Let it all out…'     },
  { phase: 'Rest',    duration: 1000, scale: 1.00, color: '#34d399', hint: 'Rest…'               },
];

const SIZE   = 180;
const RADIUS = 68;
const CIRC   = 2 * Math.PI * RADIUS;

export default function WarmupBreathingRing({ onComplete, totalCycles = 2 }) {
  const [cycleIdx,   setCycleIdx]   = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [progress,   setProgress]   = useState(0); // 0–1 within current phase
  const rafRef   = useRef(null);
  const startRef = useRef(Date.now());
  const doneRef  = useRef(false);

  const step = CYCLE[cycleIdx];

  useEffect(() => {
    startRef.current = Date.now();
    setProgress(0);

    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const p = Math.min(elapsed / step.duration, 1);
      setProgress(p);

      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Advance to next phase
        const nextIdx = (cycleIdx + 1) % CYCLE.length;
        if (nextIdx === 0) {
          const newCount = cycleCount + 1;
          setCycleCount(newCount);
          if (newCount >= totalCycles && !doneRef.current) {
            doneRef.current = true;
            setTimeout(onComplete, 400);
            return;
          }
        }
        setCycleIdx(nextIdx);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cycleIdx]);

  // Stroke dash for the progress ring
  const dashOffset = CIRC * (1 - progress);
  const totalPhases = CYCLE.length * totalCycles;
  const completedPhases = cycleCount * CYCLE.length + cycleIdx;
  const overallProgress = completedPhases / totalPhases;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>

      {/* Ring */}
      <div style={{ position: 'relative', width: SIZE, height: SIZE }}>

        {/* Background track */}
        <svg width={SIZE} height={SIZE} style={{ position: 'absolute', inset: 0 }}>
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6}
          />
          {/* Overall progress arc */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={6}
            strokeDasharray={`${CIRC * overallProgress} ${CIRC}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
          {/* Phase progress arc */}
          <motion.circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none"
            stroke={step.color}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={{ filter: `drop-shadow(0 0 8px ${step.color}80)` }}
          />
        </svg>

        {/* Pulsing inner orb */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div
            animate={{ scale: step.scale }}
            transition={{
              duration: step.duration / 1000,
              ease: step.phase === 'Exhale' ? 'easeIn' : 'easeOut',
            }}
            style={{
              width: 90, height: 90, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `radial-gradient(circle, ${step.color}30 0%, ${step.color}08 70%)`,
              border: `1.5px solid ${step.color}40`,
              boxShadow: `0 0 30px ${step.color}25`,
            }}
          >
            <motion.div
              style={{ width: 44, height: 44, borderRadius: '50%', background: `${step.color}20` }}
            />
          </motion.div>
        </div>

        {/* Cycle count */}
        <div style={{ position: 'absolute', bottom: -16, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>
            {cycleCount + 1} / {totalCycles}
          </span>
        </div>
      </div>

      {/* Phase label */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.phase}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{    opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          style={{ textAlign: 'center' }}
        >
          <p style={{
            fontSize: 28, fontWeight: 800, marginBottom: 4, color: step.color,
            textShadow: `0 0 20px ${step.color}50`, margin: '0 0 6px',
          }}>
            {step.phase}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>
            {step.hint}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Phase dots */}
      <div style={{ display: 'flex', gap: 8 }}>
        {CYCLE.map((c, i) => (
          <div
            key={i}
            style={{
              width: i === cycleIdx ? 20 : 6,
              height: 6,
              borderRadius: 99,
              background: i === cycleIdx ? step.color : 'rgba(255,255,255,0.12)',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}
