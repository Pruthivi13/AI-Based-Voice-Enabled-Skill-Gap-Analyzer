/**
 * RoleProgressWidget.jsx
 *
 * Dashboard widget: per-role progress tracking.
 * Score ring · trend badge · sparkline · skill bars · "Practice again" CTA.
 * Design: dark glassmorphism + orange accent, matching the rest of the project.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Minus, ChevronRight,
  Target, BarChart2, Zap, ChevronDown, ChevronUp,
} from 'lucide-react';
import { fetchRoleProgress } from '../services/api';
import { useTheme } from '../context/ThemeContext';

// ── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ sessions, color = '#f97316', width = 80, height = 28 }) {
  const scores = sessions.map(s => s.score ?? 0).filter(s => s > 0);
  if (scores.length < 2) return null;
  const min   = Math.min(...scores);
  const max   = Math.max(...scores);
  const range = max - min || 1;
  const step  = width / (scores.length - 1);
  const pts   = scores.map((s, i) => [i * step, height - ((s - min) / range) * (height - 4) - 2]);
  const d    = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const fill = [`M${pts[0][0]},${height}`, ...pts.map(p => `L${p[0]},${p[1]}`), `L${pts[pts.length-1][0]},${height}`, 'Z'].join(' ');
  const gradId = `sg-${color.replace('#','')}`;
  return (
    <svg width={width} height={height} style={{ overflow:'visible', flexShrink:0 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gradId})`}/>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="3" fill={color} stroke="rgba(0,0,0,0.4)" strokeWidth="1"/>
    </svg>
  );
}

// ── Skill bar ────────────────────────────────────────────────────────────────
function SkillBar({ label, value, color }) {
  if (value == null) return null;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <span style={{ fontSize:10, color:'rgba(255,255,255,0.35)', width:68, flexShrink:0 }}>{label}</span>
      <div style={{ flex:1, height:4, borderRadius:99, background:'rgba(255,255,255,0.07)', overflow:'hidden' }}>
        <motion.div
          initial={{ width:0 }} animate={{ width:`${(value/10)*100}%` }}
          transition={{ duration:0.8, ease:'easeOut', delay:0.2 }}
          style={{ height:'100%', borderRadius:99, background:color }}
        />
      </div>
      <span style={{ fontSize:10, fontWeight:700, color, width:28, textAlign:'right', flexShrink:0 }}>{value.toFixed(1)}</span>
    </div>
  );
}

// ── Trend badge ───────────────────────────────────────────────────────────────
function TrendBadge({ trend, improvement }) {
  const cfg = {
    up:   { Icon: TrendingUp,   color:'#34d399', bg:'rgba(52,211,153,0.12)',  sign:'+' },
    down: { Icon: TrendingDown, color:'#f87171', bg:'rgba(248,113,113,0.12)', sign:''  },
    flat: { Icon: Minus,        color:'#94a3b8', bg:'rgba(148,163,184,0.10)', sign:''  },
    new:  { Icon: Zap,          color:'#f97316', bg:'rgba(249,115,22,0.12)',  sign:''  },
  }[trend] ?? { Icon: Minus, color:'#94a3b8', bg:'rgba(148,163,184,0.10)', sign:'' };
  const { Icon } = cfg;
  const label = trend === 'new' ? 'New' : improvement !== null ? `${cfg.sign}${improvement}` : '—';
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 9px', borderRadius:99, background:cfg.bg, flexShrink:0 }}>
      <Icon size={11} color={cfg.color} strokeWidth={2.5}/>
      <span style={{ fontSize:11, fontWeight:700, color:cfg.color }}>{label}</span>
    </div>
  );
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 52 }) {
  const r     = (size - 6) / 2;
  const circ  = 2 * Math.PI * r;
  const pct   = score != null ? score / 10 : 0;
  const color = pct >= 0.8 ? '#34d399' : pct >= 0.6 ? '#f97316' : '#f87171';
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4"/>
        <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="4"
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset:circ }} animate={{ strokeDashoffset: circ*(1-pct) }}
          transition={{ duration:1, ease:'easeOut', delay:0.15 }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:13, fontWeight:800, color, lineHeight:1 }}>{score != null ? score.toFixed(1) : '—'}</span>
        <span style={{ fontSize:8, color:'rgba(255,255,255,0.3)', marginTop:1 }}>/10</span>
      </div>
    </div>
  );
}

const SKILL_COLORS = {
  clarity:'#38bdf8', fluency:'#fb923c', confidence:'#34d399',
  technical:'#a78bfa', grammar:'#f472b6', relevance:'#fbbf24',
};

// ── Role card ─────────────────────────────────────────────────────────────────
function RoleCard({ role: r, index, isDark, onNavigate }) {
  const [expanded, setExpanded] = useState(false);
  const cardBg    = isDark ? 'rgba(14,20,32,0.9)' : '#fff';
  const cardBdr   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const headColor = isDark ? '#f1f5f9' : '#1c1917';
  const subColor  = isDark ? 'rgba(255,255,255,0.38)' : '#78716c';
  const lastSeen  = r.lastPracticed
    ? new Date(r.lastPracticed).toLocaleDateString('en-US', { month:'short', day:'numeric' })
    : null;
  const skillEntries = Object.entries(r.skills).filter(([, v]) => v !== null);
  const accentColor = r.trend === 'up' ? '#34d399' : r.trend === 'down' ? '#f87171' : r.trend === 'new' ? '#f97316' : '#94a3b8';

  return (
    <motion.div
      initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
      transition={{ delay: index * 0.06, duration:0.32 }}
      style={{ background:cardBg, border:`1px solid ${cardBdr}`, borderRadius:18, overflow:'hidden', transition:'box-shadow 0.2s,border-color 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(249,115,22,0.35)'; e.currentTarget.style.boxShadow='0 8px 32px rgba(249,115,22,0.10)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor=cardBdr; e.currentTarget.style.boxShadow='none'; }}
    >
      {/* Accent bar */}
      <div style={{ height:3, background:`linear-gradient(90deg,${accentColor},${accentColor}99)` }}/>

      {/* Main row */}
      <div style={{ padding:'14px 16px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
          <ScoreRing score={r.avgScore}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:3 }}>
              <span style={{ fontSize:13, fontWeight:700, color:headColor, lineHeight:1.3 }}>{r.role}</span>
              <TrendBadge trend={r.trend} improvement={r.improvement}/>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <span style={{ fontSize:11, color:subColor, display:'flex', alignItems:'center', gap:4 }}>
                <BarChart2 size={11}/> {r.sessionCount} session{r.sessionCount !== 1 ? 's' : ''}
              </span>
              {lastSeen && <span style={{ fontSize:11, color:subColor }}>Last: {lastSeen}</span>}
              {r.improvement !== null && r.trend !== 'new' && (
                <span style={{ fontSize:11, fontWeight:600, color: r.trend === 'up' ? '#34d399' : r.trend === 'down' ? '#f87171' : subColor }}>
                  {r.firstScore?.toFixed(1)} → {r.latestScore?.toFixed(1)}
                </span>
              )}
            </div>
            {r.trend === 'up' && r.improvement !== null && r.improvement > 0 && (
              <div style={{ marginTop:6, padding:'4px 9px', borderRadius:8, background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.2)', fontSize:10.5, fontWeight:600, color:'#6ee7b7', display:'inline-block' }}>
                ↑ +{r.improvement} pts since first session
              </div>
            )}
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
            <Sparkline sessions={r.sessions}/>
            <button
              onClick={() => setExpanded(v => !v)}
              style={{ display:'flex', alignItems:'center', gap:3, fontSize:10, fontWeight:600, color:subColor, background:'transparent', border:'none', cursor:'pointer', padding:'2px 6px', borderRadius:6, transition:'color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color='#f97316'; }}
              onMouseLeave={e => { e.currentTarget.style.color=subColor; }}
            >
              {expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
              {expanded ? 'Less' : 'Details'}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded skill bars */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div key="exp" initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }} transition={{ duration:0.25, ease:'easeInOut' }} style={{ overflow:'hidden' }}>
            <div style={{ padding:'12px 16px 14px', borderTop:`1px solid ${cardBdr}` }}>
              {skillEntries.length > 0 ? (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <span style={{ fontSize:9, fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:subColor, marginBottom:4 }}>
                    Skill Breakdown (avg over {r.sessionCount} sessions)
                  </span>
                  {skillEntries.map(([key, val]) => (
                    <SkillBar key={key} label={key.charAt(0).toUpperCase()+key.slice(1)} value={val} color={SKILL_COLORS[key] ?? '#f97316'}/>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize:11, color:subColor, margin:0 }}>Complete more sessions to see skill breakdowns.</p>
              )}
              <button
                onClick={() => onNavigate(r.role)}
                style={{ marginTop:12, width:'100%', padding:'8px 14px', borderRadius:10, border:'1px solid rgba(249,115,22,0.3)', background:'rgba(249,115,22,0.08)', color:'#f97316', fontWeight:600, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(249,115,22,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(249,115,22,0.08)'; }}
              >
                Practice {r.role} again <ChevronRight size={13}/>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard({ isDark }) {
  const bg2 = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  return (
    <div style={{ borderRadius:18, border:`1px solid ${isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.06)'}`, background: isDark?'rgba(14,20,32,0.9)':'#fff', overflow:'hidden', animation:'pulse 2s ease-in-out infinite' }}>
      <div style={{ height:3, background:bg2 }}/>
      <div style={{ padding:16, display:'flex', gap:12 }}>
        <div style={{ width:52, height:52, borderRadius:'50%', background:bg2 }}/>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ height:13, borderRadius:6, width:'55%', background:bg2 }}/>
          <div style={{ height:10, borderRadius:6, width:'40%', background:bg2 }}/>
        </div>
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────
export default function RoleProgressWidget() {
  const navigate   = useNavigate();
  const { isDark } = useTheme();
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [showAll, setShowAll] = useState(false);
  const INITIAL_SHOW = 3;

  useEffect(() => {
    fetchRoleProgress()
      .then(d => setData(Array.isArray(d) ? d : []))
      .catch(() => setError('Could not load role progress.'))
      .finally(() => setLoading(false));
  }, []);

  const handleNavigate = (role) => {
    sessionStorage.setItem('prefill_role', role);
    navigate('/setup');
  };

  const visible = showAll ? data : data.slice(0, INITIAL_SHOW);
  const hasMore = data.length > INITIAL_SHOW;
  const headColor = isDark ? '#f1f5f9' : '#1c1917';
  const subColor  = isDark ? 'rgba(255,255,255,0.4)' : '#78716c';

  const stats = useMemo(() => {
    if (!data.length) return null;
    const totalSessions = data.reduce((s, r) => s + r.sessionCount, 0);
    const allScores     = data.map(r => r.avgScore).filter(Boolean);
    const globalAvg     = allScores.length ? (allScores.reduce((a,b) => a+b, 0) / allScores.length).toFixed(1) : null;
    const improved      = data.filter(r => r.trend === 'up').length;
    return { totalSessions, globalAvg, improved };
  }, [data]);

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:8 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
            <Target size={18} color="#f97316"/>
            <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:headColor }}>Progress by Role</h3>
          </div>
          <p style={{ margin:0, fontSize:12, color:subColor }}>Performance tracked per target role</p>
        </div>
        <button onClick={() => navigate('/analytics')} style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:700, color:'#f97316', background:'transparent', border:'none', cursor:'pointer' }}>
          Full analytics <ChevronRight size={13}/>
        </button>
      </div>

      {/* Summary pills */}
      {!loading && stats && data.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
          {[
            { label:`${data.length} role${data.length!==1?'s':''}`, color:'#a78bfa', bg:'rgba(167,139,250,0.1)' },
            { label:`${stats.totalSessions} sessions`,              color:'#38bdf8', bg:'rgba(56,189,248,0.1)'  },
            stats.globalAvg ? { label:`avg ${stats.globalAvg}/10`, color:'#f97316', bg:'rgba(249,115,22,0.1)' } : null,
            stats.improved > 0 ? { label:`↑ ${stats.improved} improving`, color:'#34d399', bg:'rgba(52,211,153,0.1)' } : null,
          ].filter(Boolean).map((pill, i) => (
            <span key={i} style={{ padding:'4px 12px', borderRadius:99, fontSize:11, fontWeight:700, color:pill.color, background:pill.bg }}>{pill.label}</span>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && <div style={{ display:'flex', flexDirection:'column', gap:10 }}>{[0,1,2].map(i => <SkeletonCard key={i} isDark={isDark}/>)}</div>}

      {/* Error */}
      {!loading && error && (
        <div style={{ borderRadius:14, padding:'20px 16px', textAlign:'center', background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', fontSize:13 }}>{error}</div>
      )}

      {/* Empty state */}
      {!loading && !error && data.length === 0 && (
        <div style={{ borderRadius:16, padding:'32px 20px', textAlign:'center', background: isDark?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.02)', border:`1px dashed ${isDark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.1)'}` }}>
          <Target size={36} color="rgba(249,115,22,0.3)" style={{ margin:'0 auto 10px', display:'block' }}/>
          <p style={{ margin:'0 0 4px', fontSize:13, fontWeight:600, color:headColor }}>No role data yet</p>
          <p style={{ margin:'0 0 16px', fontSize:12, color:subColor }}>Complete a session to start tracking role-specific progress.</p>
          <button onClick={() => navigate('/setup')} style={{ padding:'9px 20px', borderRadius:10, border:'none', background:'#f97316', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
            Start your first session →
          </button>
        </div>
      )}

      {/* Role cards */}
      {!loading && !error && visible.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {visible.map((r, i) => <RoleCard key={r.role} role={r} index={i} isDark={isDark} onNavigate={handleNavigate}/>)}
        </div>
      )}

      {/* Show more/less */}
      {!loading && hasMore && (
        <button
          onClick={() => setShowAll(v => !v)}
          style={{ marginTop:10, width:'100%', padding:'9px', borderRadius:12, border:`1px solid ${isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)'}`, background:'transparent', color:subColor, fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'color 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.color='#f97316'; }}
          onMouseLeave={e => { e.currentTarget.style.color=subColor; }}
        >
          {showAll ? <><ChevronUp size={13}/> Show less</> : <><ChevronDown size={13}/> Show {data.length-INITIAL_SHOW} more role{data.length-INITIAL_SHOW!==1?'s':''}</>}
        </button>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
