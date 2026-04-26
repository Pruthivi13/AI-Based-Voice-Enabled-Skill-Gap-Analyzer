/**
 * TargetedPracticeModal.jsx
 *
 * Full-screen modal showing the user's skill prescription and
 * a one-click "Start Targeted Practice" button.
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X, Zap, TrendingDown, TrendingUp, Minus, AlertTriangle, ChevronRight, Dumbbell } from 'lucide-react';
import { createTargetedSession } from '../services/api';

const URGENCY = {
  critical: { ring:'rgba(239,68,68,0.4)',  bg:'rgba(239,68,68,0.08)',  text:'#f87171', badge:'bg-red-500/15 text-red-400 border-red-500/30',    label:'Critical'     },
  high:     { ring:'rgba(249,115,22,0.4)', bg:'rgba(249,115,22,0.08)', text:'#fb923c', badge:'bg-orange-500/15 text-orange-400 border-orange-500/30', label:'High Priority' },
  medium:   { ring:'rgba(234,179,8,0.3)',  bg:'rgba(234,179,8,0.06)',  text:'#fbbf24', badge:'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', label:'Needs Work'   },
};

function TrendIcon({ trend }) {
  if (trend === 'declining') return <TrendingDown size={13} className="text-red-400" />;
  if (trend === 'improving') return <TrendingUp size={13} className="text-emerald-400" />;
  return <Minus size={13} className="text-white/30" />;
}

function ScoreBar({ score, color }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
      <motion.div
        initial={{ width: 0 }} animate={{ width: `${(score / 10) * 100}%` }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        className="h-full rounded-full" style={{ background: color }}
      />
    </div>
  );
}

function SkillCard({ skill, index }) {
  const u = URGENCY[skill.urgency];
  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 + index * 0.07 }}
      style={{ border: `1px solid ${u.ring}`, background: u.bg }}
      className="rounded-2xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">{skill.emoji}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white/90">{skill.label}</span>
              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${u.badge}`}>{u.label}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <TrendIcon trend={skill.trend} />
              <span className="text-[10px] text-white/35 capitalize">{skill.trend}</span>
              {skill.consecutiveWeakSessions > 0 && (
                <span className="text-[10px] text-white/35">· {skill.consecutiveWeakSessions} session{skill.consecutiveWeakSessions !== 1 ? 's' : ''} weak</span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-extrabold" style={{ color: u.text }}>{skill.avgScore.toFixed(1)}</span>
          <span className="text-xs text-white/30">/10</span>
        </div>
      </div>
      <ScoreBar score={skill.avgScore} color={u.text} />
      <p className="text-[11px] text-white/45 mt-3 leading-relaxed">💡 {skill.suggestedFocusPrompt}</p>
    </motion.div>
  );
}

export default function TargetedPracticeModal({ prescription, onClose }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { weakSkills, sessionConfig, primaryWeakness } = prescription;

  const handleStart = async () => {
    if (!sessionConfig) return;
    setLoading(true); setError('');
    try {
      const result = await createTargetedSession({
        interviewType: sessionConfig.interviewType,
        targetRole:    sessionConfig.targetRole,
        difficulty:    sessionConfig.difficulty,
        questionCount: sessionConfig.questionCount,
        focusAreas:    sessionConfig.focusAreas,
      });
      sessionStorage.setItem('currentSessionId', result.sessionId);
      sessionStorage.setItem('currentQuestions', JSON.stringify(result.questions));
      onClose();
      navigate('/interview');
    } catch {
      setError('Failed to create session. Please try again.');
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl"
        style={{ background: 'linear-gradient(160deg,#0e1420 0%,#080c14 100%)', border:'1px solid rgba(249,115,22,0.2)', boxShadow:'0 32px 80px rgba(0,0,0,0.7),0 0 0 1px rgba(249,115,22,0.1)' }}
      >
        <div className="h-1 w-full rounded-t-3xl" style={{ background:'linear-gradient(90deg,#f97316,#fb923c,#f97316)' }} />
        <div className="p-7">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background:'rgba(249,115,22,0.15)', border:'1px solid rgba(249,115,22,0.3)' }}>
                <Dumbbell size={22} style={{ color: '#f97316' }} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-white leading-tight">Skill Prescription</h2>
                <p className="text-xs text-white/40 mt-0.5">Based on your last {prescription.snapshotCount} sessions</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-colors">
              <X size={15} />
            </button>
          </div>

          {/* Primary alert */}
          {primaryWeakness && (
            <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}
              className="rounded-2xl p-4 mb-5 flex items-start gap-3"
              style={{ background: URGENCY[primaryWeakness.urgency].bg, border:`1px solid ${URGENCY[primaryWeakness.urgency].ring}` }}>
              <AlertTriangle size={18} style={{ color: URGENCY[primaryWeakness.urgency].text, flexShrink:0, marginTop:1 }} />
              <p className="text-sm text-white/80 leading-relaxed">{primaryWeakness.message}</p>
            </motion.div>
          )}

          {/* Skill cards */}
          <div className="space-y-3 mb-6">
            {weakSkills.slice(0, 4).map((skill, i) => <SkillCard key={skill.key} skill={skill} index={i} />)}
          </div>

          {/* Session config preview */}
          {sessionConfig && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.35 }}
              className="rounded-2xl p-4 mb-5"
              style={{ background:'rgba(249,115,22,0.06)', border:'1px solid rgba(249,115,22,0.2)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color:'#f97316' }}>Recommended Session</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label:'Type',       value: sessionConfig.interviewType },
                  { label:'Difficulty', value: sessionConfig.difficulty },
                  { label:'Questions',  value: sessionConfig.questionCount },
                  { label:'Role',       value: sessionConfig.targetRole.slice(0,22) },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl px-3 py-2.5" style={{ background:'rgba(255,255,255,0.04)' }}>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mb-1">{label}</p>
                    <p className="text-sm font-semibold text-white/80">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {sessionConfig.focusAreas.map(area => (
                  <span key={area} className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                    style={{ background:'rgba(249,115,22,0.12)', color:'#fb923c', border:'1px solid rgba(249,115,22,0.25)' }}>
                    {area}
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {error && <p className="text-red-400 text-xs font-semibold mb-4 text-center">{error}</p>}

          {/* CTA */}
          <div className="flex gap-3">
            <motion.button whileTap={{ scale: 0.97 }} onClick={handleStart}
              disabled={loading || !sessionConfig}
              className="flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-base text-white transition-all disabled:opacity-50"
              style={{ background: loading?'rgba(249,115,22,0.4)':'linear-gradient(135deg,#f97316,#ea6a0a)', boxShadow: loading?'none':'0 8px 24px rgba(249,115,22,0.3)' }}>
              {loading ? (
                <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Creating session…</>
              ) : (
                <><Zap size={18} className="fill-current" />Start Targeted Practice<ChevronRight size={16} /></>
              )}
            </motion.button>
            <button onClick={onClose} className="px-5 py-3.5 rounded-2xl text-sm font-semibold text-white/50 border border-white/10 hover:bg-white/5 hover:text-white/70 transition-colors">
              Later
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
