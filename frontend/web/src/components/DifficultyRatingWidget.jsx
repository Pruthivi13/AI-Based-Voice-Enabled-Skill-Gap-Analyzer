/**
 * DifficultyRatingWidget.jsx
 *
 * Post-answer difficulty rating pill that slides up after recording stops.
 * Three options: Too Easy · Just Right · Too Hard
 * Shows community stats after rating (donut-style bar).
 * Matches dark glassmorphism + orange-accent design language.
 *
 * Props:
 *   sessionId    — string
 *   questionId   — string
 *   onRate       — (rating: string) => void  optional callback
 *   autoShow     — boolean (default true) — auto-appear after answer
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { submitDifficultyRating, fetchFeedbackStats } from '../services/api';

const OPTIONS = [
  {
    key:   'TOO_EASY',
    emoji: '😴',
    label: 'Too Easy',
    short: 'Easy',
    color: '#34d399',
    bg:    'rgba(52,211,153,0.12)',
    ring:  'rgba(52,211,153,0.4)',
    bar:   '#34d399',
  },
  {
    key:   'JUST_RIGHT',
    emoji: '🎯',
    label: 'Just Right',
    short: 'Right',
    color: '#f97316',
    bg:    'rgba(249,115,22,0.12)',
    ring:  'rgba(249,115,22,0.4)',
    bar:   '#f97316',
  },
  {
    key:   'TOO_HARD',
    emoji: '🔥',
    label: 'Too Hard',
    short: 'Hard',
    color: '#f87171',
    bg:    'rgba(248,113,113,0.12)',
    ring:  'rgba(248,113,113,0.35)',
    bar:   '#f87171',
  },
];

// ── Community bar ─────────────────────────────────────────────────────────────
function CommunityBar({ stats, yourRating }) {
  if (!stats || !stats.total || stats.total < 3) return null;

  const pcts = stats.percentages || {};
  const bars = [
    { key: 'TOO_EASY',   pct: pcts.tooEasy   ?? 0, color: '#34d399', label: 'Easy'  },
    { key: 'JUST_RIGHT', pct: pcts.justRight  ?? 0, color: '#f97316', label: 'Right' },
    { key: 'TOO_HARD',   pct: pcts.tooHard    ?? 0, color: '#f87171', label: 'Hard'  },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.35, delay: 0.2 }}
      style={{ marginTop: 14, paddingTop: 14,
        borderTop: '1px solid rgba(255,255,255,0.08)' }}
    >
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}>
        {stats.total} ratings from community
      </p>

      {/* Segmented bar */}
      <div style={{ display: 'flex', height: 6, borderRadius: 99, overflow: 'hidden', gap: 2 }}>
        {bars.map(({ key, pct, color }) =>
          pct > 0 ? (
            <motion.div
              key={key}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.3 }}
              style={{ height: '100%', background: color, borderRadius: 99,
                boxShadow: yourRating === key ? `0 0 8px ${color}80` : 'none' }}
            />
          ) : null
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {bars.map(({ key, pct, color, label }) => (
          <span key={key} style={{
            fontSize: 10, fontWeight: yourRating === key ? 800 : 500,
            color: yourRating === key ? color : 'rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {label} {pct}%
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────
export default function DifficultyRatingWidget({
  sessionId,
  questionId,
  onRate,
  autoShow = true,
}) {
  const [visible,    setVisible]    = useState(autoShow);
  const [selected,   setSelected]   = useState(null);   // key string
  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [stats,      setStats]      = useState(null);
  const [hovering,   setHovering]   = useState(null);

  const handleSelect = useCallback(async (key) => {
    if (submitting || submitted) return;
    setSelected(key);
    setSubmitting(true);
    try {
      const result = await submitDifficultyRating(sessionId, questionId, key);
      setStats(result.stats);
      setSubmitted(true);
      onRate?.(key);
    } catch (err) {
      console.error('Rating failed:', err);
      setSelected(null); // allow retry
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, questionId, onRate, submitting, submitted]);

  const selectedOption = OPTIONS.find(o => o.key === selected);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0,  scale: 1    }}
          exit={{    opacity: 0, y: 8,  scale: 0.97  }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          style={{
            borderRadius: 20,
            padding: '16px 20px',
            background: 'rgba(14,20,32,0.92)',
            border: submitted && selectedOption
              ? `1px solid ${selectedOption.ring}`
              : '1px solid rgba(255,255,255,0.09)',
            backdropFilter: 'blur(20px)',
            boxShadow: submitted && selectedOption
              ? `0 8px 32px ${selectedOption.ring}40, 0 0 0 0.5px ${selectedOption.ring}`
              : '0 8px 32px rgba(0,0,0,0.5)',
            transition: 'border-color 0.3s, box-shadow 0.3s',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {submitted ? (
                <>
                  <motion.span
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500 }}
                    style={{ fontSize: 16 }}
                  >
                    {selectedOption?.emoji}
                  </motion.span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: selectedOption?.color }}>
                    Rated {selectedOption?.label}
                  </span>
                  <motion.span
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                    style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}
                  >
                    · Thanks!
                  </motion.span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>
                    How was this question?
                  </span>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', padding: '2px 7px',
                    borderRadius: 99, border: '1px solid rgba(255,255,255,0.1)' }}>
                    Optional
                  </span>
                </>
              )}
            </div>

            {/* Dismiss */}
            {!submitted && (
              <button
                onClick={() => setVisible(false)}
                style={{ width: 22, height: 22, borderRadius: 6, background: 'transparent',
                  border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, lineHeight: 1, transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
              >
                ×
              </button>
            )}
          </div>

          {/* Rating pills */}
          <div style={{ display: 'flex', gap: 8 }}>
            {OPTIONS.map((opt) => {
              const isSelected  = selected === opt.key;
              const isHovering  = hovering === opt.key;
              const isDisabled  = submitted && !isSelected;

              return (
                <motion.button
                  key={opt.key}
                  onClick={() => handleSelect(opt.key)}
                  disabled={submitted || submitting}
                  onMouseEnter={() => !submitted && setHovering(opt.key)}
                  onMouseLeave={() => setHovering(null)}
                  whileTap={!submitted ? { scale: 0.93 } : {}}
                  animate={isSelected ? { scale: [1, 1.08, 1] } : {}}
                  transition={{ duration: 0.25 }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 5,
                    padding: '10px 8px',
                    borderRadius: 14,
                    border: `1.5px solid ${
                      isSelected ? opt.ring : isHovering ? `${opt.ring}70` : 'rgba(255,255,255,0.08)'
                    }`,
                    background: isSelected ? opt.bg : isHovering ? `${opt.bg}80` : 'rgba(255,255,255,0.03)',
                    cursor: submitted ? 'default' : 'pointer',
                    opacity: isDisabled ? 0.35 : 1,
                    transition: 'all 0.18s ease',
                    outline: 'none',
                    boxShadow: isSelected ? `0 4px 16px ${opt.ring}50` : 'none',
                  }}
                >
                  {/* Emoji with loading spinner overlay */}
                  <div style={{ position: 'relative', width: 26, height: 26,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {submitting && isSelected ? (
                      <div style={{
                        width: 18, height: 18,
                        border: `2.5px solid ${opt.color}40`,
                        borderTop: `2.5px solid ${opt.color}`,
                        borderRadius: '50%',
                        animation: 'ratingSpinnerSpin 0.7s linear infinite',
                      }} />
                    ) : (
                      <span style={{ fontSize: 20, lineHeight: 1 }}>{opt.emoji}</span>
                    )}
                  </div>

                  <span style={{
                    fontSize: 10,
                    fontWeight: isSelected ? 800 : 600,
                    color: isSelected ? opt.color : 'rgba(255,255,255,0.45)',
                    whiteSpace: 'nowrap',
                    letterSpacing: '0.02em',
                    transition: 'color 0.15s',
                  }}>
                    {opt.short}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Community stats — revealed after rating */}
          <AnimatePresence>
            {submitted && (
              <CommunityBar stats={stats} yourRating={selected} />
            )}
          </AnimatePresence>

          <style>{`
            @keyframes ratingSpinnerSpin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
