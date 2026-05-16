/**
 * WeakSkillInsightCard.jsx
 *
 * Compact dashboard banner that surfaces the top weak skill
 * with urgency-coded styling and a "Fix It" button that opens
 * the TargetedPracticeModal.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ChevronRight, TrendingDown, X } from 'lucide-react';
import { fetchWeakSkillPrescription } from '../services/api';
import TargetedPracticeModal from './TargetedPracticeModal';

const URGENCY = {
  critical: { gradient:'linear-gradient(135deg,rgba(239,68,68,0.12) 0%,rgba(239,68,68,0.04) 100%)',  border:'rgba(239,68,68,0.3)',  glow:'rgba(239,68,68,0.15)',  accent:'#f87171', dot:'bg-red-400',    pulse:true  },
  high:     { gradient:'linear-gradient(135deg,rgba(249,115,22,0.12) 0%,rgba(249,115,22,0.04) 100%)', border:'rgba(249,115,22,0.3)', glow:'rgba(249,115,22,0.12)', accent:'#fb923c', dot:'bg-orange-400', pulse:true  },
  medium:   { gradient:'linear-gradient(135deg,rgba(234,179,8,0.08) 0%,rgba(234,179,8,0.02) 100%)',   border:'rgba(234,179,8,0.25)', glow:'rgba(234,179,8,0.08)',  accent:'#fbbf24', dot:'bg-yellow-400', pulse:false },
};

export default function WeakSkillInsightCard() {
  const [prescription, setPrescription] = useState(null);
  const [loading,       setLoading]     = useState(true);
  const [dismissed,     setDismissed]   = useState(false);
  const [showModal,     setShowModal]   = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('weakSkillCardDismissed')) { setDismissed(true); setLoading(false); return; }
    fetchWeakSkillPrescription()
      .then(setPrescription)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDismiss = (e) => {
    e.stopPropagation();
    sessionStorage.setItem('weakSkillCardDismissed', Date.now().toString());
    setDismissed(true);
  };

  const primary = prescription?.primaryWeakness;

  if (loading || dismissed || !primary || !prescription?.hasEnoughData) return null;

  const s = URGENCY[primary.urgency] || URGENCY.medium;

  return (
    <>
      <AnimatePresence>
        {!dismissed && (
          <motion.div
            key="card"
            initial={{ opacity:0, y:-10, height:0 }}
            animate={{ opacity:1, y:0,   height:'auto' }}
            exit={{    opacity:0, y:-6,   height:0 }}
            transition={{ duration:0.3, ease:'easeOut' }}
            className="overflow-hidden mb-5"
          >
            <div style={{ background:s.gradient, border:`1px solid ${s.border}`, boxShadow:`0 4px 24px ${s.glow}`, borderRadius:20, padding:'16px 20px', position:'relative', overflow:'hidden' }}>
              {/* BG glow */}
              <div style={{ position:'absolute', top:-30, right:-30, width:120, height:120, borderRadius:'50%', background:`radial-gradient(circle,${s.glow} 0%,transparent 70%)`, filter:'blur(20px)', pointerEvents:'none' }} />

              <div style={{ position:'relative', display:'flex', alignItems:'center', gap:16 }}>
                {/* Icon */}
                <div style={{ width:44, height:44, borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:22, background:`${s.accent}15`, border:`1px solid ${s.accent}30` }}>
                  {primary.emoji === '💪' ? <img src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f4aa/512.gif" alt="💪" style={{ width: '1.4em', height: '1.4em' }} /> : primary.emoji}
                </div>

                {/* Text */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:s.accent, display:'inline-block', animation: s.pulse ? 'pulse 2s infinite' : 'none' }} />
                    <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:s.accent }}>Skill Alert</span>
                    {primary.consecutiveWeakSessions >= 2 && (
                      <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:600 }}>
                        <TrendingDown size={10} /> {primary.consecutiveWeakSessions} sessions
                      </span>
                    )}
                  </div>
                  <p style={{ margin:0, fontSize:13, fontWeight:600, color:'rgba(255,255,255,0.85)', lineHeight:1.4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {primary.message.length > 90 ? primary.message.slice(0,87) + '…' : primary.message}
                  </p>
                  {prescription.sessionConfig && (
                    <p style={{ margin:'3px 0 0', fontSize:11, color:'rgba(255,255,255,0.35)' }}>
                      {prescription.sessionConfig.prescriptionSubtitle}
                    </p>
                  )}
                </div>

                {/* CTA buttons */}
                <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                  <motion.button
                    whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
                    onClick={() => setShowModal(true)}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:12, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, color:'#fff', background:`linear-gradient(135deg,${s.accent},${s.accent}cc)`, boxShadow:`0 4px 12px ${s.glow}` }}
                  >
                    <Zap size={13} style={{ fill:'currentColor' }} />
                    Fix It
                    <ChevronRight size={12} />
                  </motion.button>
                  <button
                    onClick={handleDismiss}
                    style={{ width:28, height:28, borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'rgba(255,255,255,0.3)' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Secondary weak skills strip */}
              {prescription.weakSkills.length > 1 && (
                <div style={{ display:'flex', gap:8, marginTop:12, paddingTop:12, borderTop:'1px solid rgba(255,255,255,0.06)', alignItems:'center' }}>
                  <span style={{ fontSize:10, color:'rgba(255,255,255,0.25)', fontWeight:600, flexShrink:0 }}>Also:</span>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {prescription.weakSkills.slice(1, 4).map(skill => {
                      const sa = URGENCY[skill.urgency]?.accent || '#fbbf24';
                      return (
                        <span key={skill.key} style={{ padding:'2px 10px', borderRadius:99, fontSize:10, fontWeight:600, background:`${sa}12`, color:sa, border:`1px solid ${sa}25` }}>
                          {skill.emoji === '💪' ? <img src="https://fonts.gstatic.com/s/e/notoemoji/latest/1f4aa/512.gif" alt="💪" style={{ width: '1.4em', height: '1.4em', verticalAlign: '-0.25em', marginRight: '4px' }} /> : skill.emoji} {skill.label} · {skill.avgScore.toFixed(1)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showModal && prescription && (
          <TargetedPracticeModal prescription={prescription} onClose={() => setShowModal(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
