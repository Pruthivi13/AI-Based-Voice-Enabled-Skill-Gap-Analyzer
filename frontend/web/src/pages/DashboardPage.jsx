import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Crown,
  FileText,
  Flame,
  Gem,
  Mic,
  Rocket,
  Star,
  Target,
  Trophy,
  TrendingUp,
} from 'lucide-react';
import { fetchDashboardData, fetchWeakSkillPrescription } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import WeakSkillInsightCard from '../components/WeakSkillInsightCard';
import TargetedPracticeModal from '../components/TargetedPracticeModal';
import RoleProgressWidget from '../components/RoleProgressWidget';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import BorderGlow from '../components/BorderGlow/BorderGlow';

dayjs.extend(duration);
dayjs.extend(isSameOrBefore);

// ─── Tooltip (fixed positioning, clamped to viewport) ────────────────────────

function TooltipBox({ text, x, y, isDark }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useEffect(() => {
    if (!ref.current) return;
    const { width } = ref.current.getBoundingClientRect();
    const MARGIN = 8;
    const vw = window.innerWidth;

    let left = x - width / 2;
    if (left < MARGIN) left = MARGIN;
    if (left + width > vw - MARGIN) left = vw - width - MARGIN;

    setPos({ left, top: y - 10 });
  }, [x, y, text]);

  return (
    <div
      ref={ref}
      style={{
        position:      'fixed',
        left:           pos.left,
        top:            pos.top,
        transform:     'translateY(-100%)',
        pointerEvents: 'none',
        zIndex:         9999,
        background:    isDark ? '#1e293b' : '#111827',
        color:         '#f1f5f9',
        fontSize:       12,
        fontWeight:     600,
        padding:       '6px 10px',
        borderRadius:   8,
        whiteSpace:    'nowrap',
        boxShadow:     '0 4px 16px rgba(0,0,0,0.5)',
        border:        `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`,
      }}
    >
      {text}
      <div style={{
        position:    'absolute',
        bottom:      -5,
        left:        '50%',
        transform:   'translateX(-50%)',
        borderLeft:  '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop:   `5px solid ${isDark ? '#1e293b' : '#111827'}`,
      }} />
    </div>
  );
}

function MotionIcon({
  Icon,
  color = '#f97316',
  size = 18,
  burn = false,
  pulse = false,
  title,
}) {
  const burnAnimation = {
    scale: [1, 1.12, 0.97, 1.08, 1],
    rotate: [-3, 3, -2, 2, -3],
    filter: [
      'drop-shadow(0 0 4px rgba(251,146,60,0.65))',
      'drop-shadow(0 0 14px rgba(249,115,22,0.95))',
      'drop-shadow(0 0 6px rgba(253,186,116,0.75))',
      'drop-shadow(0 0 18px rgba(234,88,12,0.9))',
      'drop-shadow(0 0 4px rgba(251,146,60,0.65))',
    ],
  };

  return (
    <motion.span
      title={title}
      aria-label={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        lineHeight: 0,
      }}
      animate={
        burn
          ? burnAnimation
          : pulse
            ? { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }
            : undefined
      }
      transition={
        burn
          ? { duration: 1.15, repeat: Infinity, ease: 'easeInOut' }
          : pulse
            ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
            : undefined
      }
      whileHover={{ scale: 1.15, rotate: -4 }}
      whileTap={{ scale: 0.95 }}
    >
      <Icon size={size} strokeWidth={2.4} fill={burn ? 'currentColor' : 'none'} />
    </motion.span>
  );
}

// ─── Heatmap (pure div grid — no SVG, no library) ────────────────────────────

function ActivityHeatmap({ data = [], isDark }) {
  const [tooltip, setTooltip] = useState(null);

  // Date → count lookup
  const countMap = useMemo(() => {
    const m = {};
    data.forEach(({ date, count }) => { m[date] = count; });
    return m;
  }, [data]);

  const totalSessions = data.reduce((sum, d) => sum + d.count, 0);

  // Build 53 weeks of days ending today, aligned to Sunday
  const today     = dayjs().startOf('day');
  const rangeStart = today.subtract(364, 'day');
  const gridStart  = rangeStart.startOf('week'); // align to Sunday

  const weeks = useMemo(() => {
    const w = [];
    let cursor = gridStart;
    while (cursor.isSameOrBefore(today, 'day')) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = cursor.format('YYYY-MM-DD');
        const inRange = !cursor.isBefore(rangeStart, 'day') && !cursor.isAfter(today, 'day');
        week.push({
          date:    dateStr,
          count:   inRange ? (countMap[dateStr] || 0) : null,
          display: cursor.format('MMM D, YYYY'),
        });
        cursor = cursor.add(1, 'day');
      }
      w.push(week);
    }
    return w;
  }, [countMap]);

  // Month labels — first week each month appears
  const monthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = -1;
    weeks.forEach((week, wi) => {
      const first = week.find(d => d.count !== null);
      if (!first) return;
      const m = dayjs(first.date).month();
      if (m !== lastMonth) {
        labels.push({ wi, label: dayjs(first.date).format('MMM') });
        lastMonth = m;
      }
    });
    return labels;
  }, [weeks]);

  // Color scale
  const cellColor = (count) => {
    if (count === null) return 'transparent';
    if (count === 0)    return isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
    if (count === 1)    return 'rgba(249,115,22,0.28)';
    if (count === 2)    return 'rgba(249,115,22,0.52)';
    if (count === 3)    return 'rgba(249,115,22,0.76)';
    return '#f97316';
  };

  const CELL = 12;
  const GAP  = 3;
  const STEP = CELL + GAP;

  // Mouse handlers
  const handleEnter = (e, day) => {
    if (day.count === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      text: day.count === 0
        ? `No sessions on ${day.display}`
        : `${day.count} session${day.count !== 1 ? 's' : ''} on ${day.display}`,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  return (
    <div data-heatmap style={{ overflowX: 'auto' }}>

      {/* Month row */}
      <div style={{ display: 'flex', marginLeft: 28, marginBottom: 4 }}>
        {weeks.map((_, wi) => {
          const lbl = monthLabels.find(m => m.wi === wi);
          return (
            <div key={wi} style={{ width: STEP, flexShrink: 0 }}>
              {lbl && (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: isDark ? 'rgba(255,255,255,0.4)' : '#9ca3af',
                  whiteSpace: 'nowrap',
                }}>
                  {lbl.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 0 }}>

        {/* Day-of-week labels */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: GAP,
          marginRight: 4, width: 24, flexShrink: 0,
        }}>
          {DAY_LABELS.map((label, i) => (
            <div key={i} style={{
              height: CELL,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            }}>
              <span style={{
                fontSize: 9,
                color: isDark ? 'rgba(255,255,255,0.3)' : '#9ca3af',
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Cell grid */}
        <div style={{ display: 'flex', gap: GAP }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
              {week.map((day, di) => (
                <div
                  key={di}
                  onMouseEnter={e => {
                    handleEnter(e, day);
                    if (day.count !== null && day.count > 0) {
                      e.currentTarget.style.transform = 'scale(1.4)';
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                    setTooltip(null);
                  }}
                  style={{
                    width:        CELL,
                    height:       CELL,
                    borderRadius: 3,
                    background:   cellColor(day.count),
                    flexShrink:   0,
                    transition:   'transform 0.1s ease',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <TooltipBox text={tooltip.text} x={tooltip.x} y={tooltip.y} isDark={isDark} />
      )}

      {/* Footer: legend only */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        marginTop:       12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10, color: isDark ? 'rgba(255,255,255,0.3)' : '#9ca3af' }}>Less</span>
          {[
            isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)',
            'rgba(249,115,22,0.28)',
            'rgba(249,115,22,0.52)',
            'rgba(249,115,22,0.76)',
            '#f97316',
          ].map((bg, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: bg }} />
          ))}
          <span style={{ fontSize: 10, color: isDark ? 'rgba(255,255,255,0.3)' : '#9ca3af' }}>More</span>
        </div>
      </div>
    </div>
  );
}

// ─── Streak Flame ──────────────────────────────────────────────────────────────
function StreakCounter({ streak, longestStreak, atRisk, isDark }) {
  const milestone =
    streak >= 30
      ? { label: 'Legendary', Icon: Crown }
      : streak >= 14
        ? { label: 'Unstoppable', Icon: Gem }
        : streak >= 7
          ? { label: 'On Fire', Icon: Star }
          : streak >= 3
            ? { label: 'Rising', Icon: Rocket }
            : null;

  return (
    <div
      style={{
        borderRadius: 20,
        background: isDark
          ? streak > 0
            ? 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(234,88,12,0.06) 50%, rgba(251,146,60,0.03) 100%)'
            : 'rgba(255,255,255,0.03)'
          : streak > 0
            ? 'linear-gradient(135deg, rgba(249,115,22,0.07) 0%, rgba(251,146,60,0.03) 100%)'
            : 'rgba(0,0,0,0.03)',
        border: `1px solid ${streak > 0 ? 'rgba(249,115,22,0.25)' : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
        padding: '18px 24px',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Animated background glow */}
      {streak > 0 && (
        <>
          <div style={{
            position: 'absolute', top: -40, left: -20, width: 120, height: 120,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)',
            filter: 'blur(25px)', pointerEvents: 'none',
            animation: 'streakGlowPulse 3s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', bottom: -30, right: -30, width: 90, height: 90,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(251,146,60,0.1) 0%, transparent 70%)',
            filter: 'blur(20px)', pointerEvents: 'none',
            animation: 'streakGlowPulse 3s ease-in-out infinite 1.5s',
          }} />
        </>
      )}

      {/* Left group: Flame + streak text */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        position: 'relative',
        zIndex: 1,
        flexShrink: 0,
      }}>
        <div style={{
          width: streak > 5 ? 58 : 52,
          height: streak > 5 ? 58 : 52,
          borderRadius: 16,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: streak > 0
            ? 'radial-gradient(circle at 50% 65%, rgba(251,146,60,0.24), rgba(249,115,22,0.09) 48%, transparent 72%)'
            : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          border: `1px solid ${streak > 0 ? 'rgba(249,115,22,0.24)' : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
        }}>
          <MotionIcon
            Icon={Flame}
            size={streak > 5 ? 40 : 34}
            color={streak > 0 ? '#f97316' : isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)'}
            burn={streak > 0}
            title={streak > 0 ? 'Active streak' : 'No active streak'}
          />
        </div>

        {/* Streak number + label */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{
              fontSize: 38,
              fontWeight: 900,
              color: streak > 0 ? '#f97316' : isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
              textShadow: streak > 0 ? '0 2px 16px rgba(249,115,22,0.2)' : 'none',
            }}>
              {streak}
            </span>
            <span style={{
              fontSize: 14,
              fontWeight: 600,
              color: isDark ? 'rgba(255,255,255,0.45)' : '#78716c',
              whiteSpace: 'nowrap',
            }}>
              days streak
            </span>
          </div>

          {/* Sub-info row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: isDark ? 'rgba(255,255,255,0.3)' : '#a8a29e',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <MotionIcon Icon={Trophy} size={13} color="#eab308" title="Best streak" />
              Best: {longestStreak} day{longestStreak !== 1 ? 's' : ''}
            </span>

            {milestone && (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#f97316',
                background: 'rgba(249,115,22,0.08)',
                padding: '2px 8px',
                borderRadius: 99,
                border: '1px solid rgba(249,115,22,0.18)',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <MotionIcon Icon={milestone.Icon} size={12} color="#f97316" title={milestone.label} />
                {milestone.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right side: at-risk warning or motivational text */}
      <div style={{ flex: 1 }} />
      <div style={{ position: 'relative', zIndex: 1, flexShrink: 0 }}>
        {atRisk && streak > 0 && (
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#ef4444',
            background: 'rgba(239,68,68,0.1)',
            padding: '5px 12px',
            borderRadius: 99,
            border: '1px solid rgba(239,68,68,0.2)',
            animation: 'streakAtRiskPulse 2s ease-in-out infinite',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <AlertTriangle size={13} strokeWidth={2.5} />
            Practice today!
          </span>
        )}

        {streak === 0 && (
          <span style={{
            fontSize: 12,
            fontWeight: 500,
            color: isDark ? 'rgba(255,255,255,0.25)' : '#a8a29e',
            fontStyle: 'italic',
            whiteSpace: 'nowrap',
          }}>
            Start your streak today!
          </span>
        )}
      </div>

      <style>{`
        @keyframes streakAtRiskPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.97); }
        }
        @keyframes streakGlowPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}

// ─── Countdown (using dayjs.duration) ───────────────────────────────────────────
function useCountdown(targetDate) {
  const GRACE_MS = 10 * 60 * 1000; // 10-min grace window
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const ms = dayjs(targetDate).diff(dayjs());

      if (ms < -GRACE_MS) {
        setState({ expired: true });          // past grace → hide card
        return;
      }
      if (ms <= 0) {
        setState({ grace: true, d:0, h:0, m:0, s:0, ms:0 }); // in grace period
        return;
      }
      const dur = dayjs.duration(ms);
      setState({
        loading: false, expired: false, grace: false,
        ms, d: Math.floor(dur.asDays()), h: dur.hours(), m: dur.minutes(), s: dur.seconds()
      });
    };
    tick();
    const intv = setInterval(tick, 1000);
    return () => clearInterval(intv);
  }, [targetDate]);

  return state;
}

// ─── Next Interview Card ──────────────────────────────────────────────────────────
function NextInterviewCard({ interview, isDark, onStart, onCancel }) {
  const countdown = useCountdown(interview?.scheduledAt);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (!interview || countdown?.expired) return null;

  const isGrace    = countdown?.grace;
  const isImminent = countdown?.ms != null && countdown.ms < 10 * 60 * 1000;
  const accentColor = isGrace ? '#ef4444' : '#3b82f6';
  
  const cardInnerBg  = isDark ? '#0f172a' : '#ffffff';

  return (
    <BorderGlow
      continuous={true}
      glowColor={isGrace ? "0 84 60" : "217 91 60"}
      backgroundColor={cardInnerBg}
      style={{
        height: '100%',
      }}
    >
      <div style={{
        backgroundImage: isDark
          ? `linear-gradient(135deg, rgba(59,130,246,0.1), rgba(37,99,235,0.02))`
          : `linear-gradient(135deg, rgba(59,130,246,0.06), rgba(37,99,235,0.01))`,
        padding: '19px 23px',
        position: 'relative',
        zIndex: 1,
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column',
      }}>

        <p style={{
          fontSize:10, fontWeight:700, letterSpacing:'0.12em',
          textTransform:'uppercase', color: accentColor, marginBottom:4,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <MotionIcon
            Icon={isGrace ? AlertTriangle : Clock}
            size={13}
            color={accentColor}
            pulse={isGrace}
            title={isGrace ? 'Starting now' : 'Next interview'}
          />
          {isGrace ? 'Starting Now' : 'Next Interview'}
        </p>

        <h4 style={{ fontSize:16, fontWeight:700, color: isDark ? '#f1f5f9' : '#1c1917', margin:'0 0 4px' }}>
          {interview.title || `${interview.targetRole} Interview`}
        </h4>
        <p style={{ fontSize:12, color: isDark ? 'rgba(255,255,255,0.5)' : '#78716c', margin:'0 0 14px' }}>
          {dayjs(interview.scheduledAt).format('ddd, MMM D [at] h:mm A')}
        </p>

        {/* Countdown digits — hidden during grace */}
        {!isGrace && countdown && !countdown.loading && (
          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            {[
              { val: countdown.d, label:'d' },
              { val: countdown.h, label:'h' },
              { val: countdown.m, label:'m' },
              { val: countdown.s, label:'s' },
            ].map(({ val, label }) => (
              <div key={label} style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                borderRadius:10, padding:'8px 12px', textAlign:'center', minWidth:48,
              }}>
                <div style={{
                  fontSize:22, fontWeight:800, lineHeight:1,
                  color: isImminent ? '#ef4444' : isDark ? '#f1f5f9' : '#1c1917',
                  fontVariantNumeric:'tabular-nums',
                }}>
                  {String(val).padStart(2,'0')}
                </div>
                <div style={{ fontSize:9, fontWeight:600, color: isDark ? 'rgba(255,255,255,0.3)' : '#a8a29e', marginTop:2 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Grace period banner */}
        {isGrace && (
          <div style={{
            background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)',
            borderRadius:10, padding:'8px 14px', marginBottom:14, fontSize:12,
            fontWeight:700, color:'#ef4444',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <AlertTriangle size={15} strokeWidth={2.5} />
            Session started. You have 10 minutes to join before it expires.
          </div>
        )}

        <div style={{ marginTop: 'auto' }}>
          {confirmCancel ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 13, color: isDark ? '#f1f5f9' : '#1c1917', margin: 0, fontWeight: 600 }}>
                Cancel this interview?
              </p>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={onCancel} style={{
                  flex:1, padding:'9px 12px', borderRadius:10, border:'none',
                  background: '#ef4444', color:'#fff', fontWeight:600, fontSize:12, cursor:'pointer'
                }}>
                  Yes, Cancel
                </button>
                <button onClick={() => setConfirmCancel(false)} style={{
                  flex:1, padding:'9px 12px', borderRadius:10, 
                  border:`1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                  color: isDark ? '#fff' : '#000', fontWeight:600, fontSize:12, cursor:'pointer'
                }}>
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', gap:8 }}>
              <motion.button
                onClick={onStart}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                flex:1, padding:'9px 16px', borderRadius:10, border:'none',
                background: isGrace ? '#ef4444' : '#3b82f6',
                color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
                <Mic size={15} strokeWidth={2.5} />
                {isGrace ? 'Join Now' : 'Start Early'}
              </motion.button>
              <button onClick={() => setConfirmCancel(true)} style={{
                padding:'9px 14px', borderRadius:10,
                border:`1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                background:'transparent',
                color: isDark ? 'rgba(255,255,255,0.4)' : '#78716c',
                fontSize:12, fontWeight:600, cursor:'pointer',
              }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </BorderGlow>
  );
}

// ── iOS Drum Picker ─────────────────────────────────────────────────────────────
// Scroll-drum that mimics the native iPhone time picker.
// Supports: mouse wheel, touch drag, mouse drag, click-to-select.
function IOSDrum({ items, selectedIndex, onSelect, isDark, width = 68 }) {
  const ITEM_H  = 38;
  const VISIBLE = 5;
  const CENTER  = Math.floor(VISIBLE / 2);
  const containerRef = useRef(null);

  // Internal offset in px (top of scroll area)
  const offsetRef   = useRef(selectedIndex * ITEM_H);
  const rafRef      = useRef(null);
  const dragRef     = useRef({ active:false, startY:0, startOffset:0 });
  const velocityRef = useRef(0);
  const lastYRef    = useRef(0);
  const lastTRef    = useRef(0);

  // Force re-render on offset change
  const [, forceRender] = useState(0);
  const kick = useCallback(() => forceRender(n => n + 1), []);

  // Clamp + snap helpers
  const maxOffset = (items.length - 1) * ITEM_H;
  const clamp = (v) => Math.max(0, Math.min(maxOffset, v));
  const snapTo = useCallback((animated = true) => {
    const idx = Math.round(offsetRef.current / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    offsetRef.current = clamped * ITEM_H;
    kick();
    if (clamped !== selectedIndex) onSelect(clamped);
  }, [items.length, selectedIndex, onSelect, kick]);

  // Sync from parent (e.g. AM/PM toggle or auto-correct) with smooth animation
  useEffect(() => {
    const target = selectedIndex * ITEM_H;
    if (Math.abs(offsetRef.current - target) < 1) {
      offsetRef.current = target;
      return;
    }
    
    // Only animate if we're not actively dragging it ourselves
    if (dragRef.current.active) return;

    cancelAnimationFrame(rafRef.current);
    const animate = () => {
      const diff = target - offsetRef.current;
      if (Math.abs(diff) < 0.5) {
        offsetRef.current = target;
        kick();
        return;
      }
      offsetRef.current += diff * 0.15; // Smooth ease-out
      kick();
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
  }, [selectedIndex, ITEM_H, kick]);

  // ── Momentum decay loop ──
  const startMomentum = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const step = () => {
      velocityRef.current *= 0.92;                   // friction
      if (Math.abs(velocityRef.current) < 0.5) {
        snapTo(true);
        return;
      }
      offsetRef.current = clamp(offsetRef.current + velocityRef.current);
      kick();
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [snapTo, kick]);

  // ── Wheel handler ──
  const onWheel = useCallback((e) => {
    e.preventDefault();
    cancelAnimationFrame(rafRef.current);
    offsetRef.current = clamp(offsetRef.current + e.deltaY * 0.8);
    kick();
    // Debounced snap
    clearTimeout(containerRef.current?._snapTimer);
    containerRef.current._snapTimer = setTimeout(() => snapTo(true), 120);
  }, [snapTo, kick]);

  // ── Pointer / touch handlers ──
  const onDragStart = useCallback((clientY) => {
    cancelAnimationFrame(rafRef.current);
    dragRef.current = { active:true, startY:clientY, startOffset:offsetRef.current };
    lastYRef.current = clientY;
    lastTRef.current = Date.now();
    velocityRef.current = 0;
  }, []);

  const onDragMove = useCallback((clientY) => {
    if (!dragRef.current.active) return;
    const dy = dragRef.current.startY - clientY;
    offsetRef.current = clamp(dragRef.current.startOffset + dy);
    // Track velocity
    const now = Date.now();
    const dt  = now - lastTRef.current || 1;
    velocityRef.current = (lastYRef.current - clientY) / dt * 16;   // px per frame
    lastYRef.current = clientY;
    lastTRef.current = now;
    kick();
  }, [kick]);

  const onDragEnd = useCallback(() => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    if (Math.abs(velocityRef.current) > 1) {
      startMomentum();
    } else {
      snapTo(true);
    }
  }, [startMomentum, snapTo]);

  // Mouse events
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const mMove = (e) => onDragMove(e.clientY);
    const mUp   = ()  => { onDragEnd(); window.removeEventListener('mousemove', mMove); window.removeEventListener('mouseup', mUp); };
    const mDown = (e) => { e.preventDefault(); onDragStart(e.clientY); window.addEventListener('mousemove', mMove); window.addEventListener('mouseup', mUp); };
    el.addEventListener('mousedown', mDown);
    el.addEventListener('wheel', onWheel, { passive:false });
    return () => {
      el.removeEventListener('mousedown', mDown);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('mousemove', mMove);
      window.removeEventListener('mouseup', mUp);
    };
  }, [onDragStart, onDragMove, onDragEnd, onWheel]);

  // Touch events
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const tStart = (e) => { onDragStart(e.touches[0].clientY); };
    const tMove  = (e) => { e.preventDefault(); onDragMove(e.touches[0].clientY); };
    const tEnd   = ()  => onDragEnd();
    el.addEventListener('touchstart', tStart, { passive:true });
    el.addEventListener('touchmove',  tMove,  { passive:false });
    el.addEventListener('touchend',   tEnd,   { passive:true });
    return () => { el.removeEventListener('touchstart', tStart); el.removeEventListener('touchmove', tMove); el.removeEventListener('touchend', tEnd); };
  }, [onDragStart, onDragMove, onDragEnd]);

  // Cleanup RAF
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // ── Render ──
  const currentFloatIdx = offsetRef.current / ITEM_H;
  const totalH = ITEM_H * VISIBLE;

  return (
    <div
      ref={containerRef}
      style={{
        position:'relative', width, height:totalH,
        overflow:'hidden', cursor:'grab', userSelect:'none', flexShrink:0,
      }}
    >


      {/* Items */}
      <div style={{ position:'absolute', left:0, right:0, top:0, height:totalH }}>
        {items.map((item, i) => {
          const yCenter = (i - currentFloatIdx) * ITEM_H + CENTER * ITEM_H + ITEM_H / 2;
          const distPx  = Math.abs(yCenter - totalH / 2);
          const dist    = distPx / ITEM_H;                   // 0 = center
          const scale   = Math.max(0.55, 1 - dist * 0.15);
          const opacity = Math.max(0.0, 1 - dist * 0.45);
          const isCenter = Math.abs(i - Math.round(currentFloatIdx)) === 0;

          // Only render items that are visible
          if (dist > CENTER + 1.5) return null;

          return (
            <div
              key={i}
              onClick={() => { cancelAnimationFrame(rafRef.current); offsetRef.current = i * ITEM_H; kick(); onSelect(i); }}
              style={{
                position:'absolute',
                left:0, right:0,
                top: yCenter - ITEM_H / 2,
                height: ITEM_H,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize: isCenter ? 22 : 16,
                fontWeight: isCenter ? 700 : 400,
                color: isCenter
                  ? '#f97316'
                  : isDark
                    ? `rgba(255,255,255,${opacity * 0.7})`
                    : `rgba(0,0,0,${opacity * 0.65})`,
                transform: `scale(${scale})`,
                opacity,
                pointerEvents: 'none',
                letterSpacing: isCenter ? '0.02em' : 0,
                willChange: 'transform, opacity',
              }}
            >
              {item}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Mini Calendar ─────────────────────────────────────────────────────────────
function MiniCalendar({ selectedDate, onSelect, isDark, compact = false }) {
  const [viewMonth, setViewMonth] = useState(dayjs(selectedDate || undefined));
  const today     = dayjs().startOf('day');

  const startOfMonth  = viewMonth.startOf('month');
  const daysInMonth   = viewMonth.daysInMonth();
  const firstWeekday  = startOfMonth.day(); // 0 = Sun

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++)  cells.push(viewMonth.date(d));

  const head  = isDark ? '#f1f5f9'                    : '#1c1917';
  const muted = isDark ? 'rgba(255,255,255,0.3)'       : '#9ca3af';
  const past  = isDark ? 'rgba(255,255,255,0.12)'      : 'rgba(0,0,0,0.18)';

  const cellSize = compact ? 30 : 32;

  return (
    <div>
      {/* Month header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: compact ? 6 : 10 }}>
        <button
          onClick={() => setViewMonth(m => m.subtract(1,'month'))}
          style={{ background:'none', border:'none', color:muted, cursor:'pointer', fontSize: compact ? 18 : 20, lineHeight:1, padding:'2px 6px' }}
        >‹</button>
        <span style={{ fontSize: compact ? 12 : 13, fontWeight:700, color:head }}>
          {viewMonth.format('MMMM YYYY')}
        </span>
        <button
          onClick={() => setViewMonth(m => m.add(1,'month'))}
          style={{ background:'none', border:'none', color:muted, cursor:'pointer', fontSize: compact ? 18 : 20, lineHeight:1, padding:'2px 6px' }}
        >›</button>
      </div>

      {/* Weekday labels */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom: compact ? 2 : 4 }}>
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} style={{ textAlign:'center', fontSize: compact ? 9 : 10, fontWeight:700, color:muted, padding:'2px 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap: compact ? 1 : 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const isSel    = selectedDate && day.isSame(dayjs(selectedDate), 'day');
          const isToday  = day.isSame(today, 'day');
          const isPast   = day.isBefore(today, 'day');

          return (
            <div
              key={i}
              onClick={() => !isPast && onSelect(day.toDate())}
              style={{
                height: cellSize, borderRadius: compact ? 6 : 8,
                fontSize: compact ? 11 : 12, fontWeight: isSel ? 700 : 400,
                display:'flex', alignItems:'center', justifyContent:'center',
                background:  isSel   ? '#f97316'
                           : isToday ? 'rgba(249,115,22,0.14)'
                           : 'transparent',
                color: isSel  ? '#fff'
                     : isPast ? past
                     : head,
                border: isToday && !isSel ? '1px solid rgba(249,115,22,0.4)' : '1px solid transparent',
                cursor: isPast ? 'not-allowed' : 'pointer',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (!isPast && !isSel) e.currentTarget.style.background='rgba(249,115,22,0.1)'; }}
              onMouseLeave={e => { if (!isPast && !isSel) e.currentTarget.style.background='transparent'; }}
            >
              {day.date()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Schedule Modal ────────────────────────────────────────────────────────────
function ScheduleModal({ isDark, onClose, onScheduled }) {
  const [role,       setRole]       = useState('');
  const [type,       setType]       = useState('TECHNICAL');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  // Date + time state
  // Default to current time, rounded up to the nearest 5-minute increment
  const defaultDate = useMemo(() => {
    let current = dayjs();
    const rem = current.minute() % 5;
    if (rem !== 0) current = current.add(5 - rem, 'minute');
    return current;
  }, []);

  const [selDate,   setSelDate]    = useState(defaultDate.toDate());
  
  // Fix: hourIdx maps 0-11 to ['01'...'12']. E.g. hour 1 -> idx 0 ('01'). Hour 12 -> idx 11 ('12'). Hour 0 -> idx 11.
  const [hourIdx,   setHourIdx]    = useState((defaultDate.hour() + 11) % 12); 
  const [minuteIdx, setMinuteIdx]  = useState(Math.floor(defaultDate.minute() / 5));
  const [ampmIdx,   setAmpmIdx]    = useState(defaultDate.hour() >= 12 ? 1 : 0);

  const HOURS   = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2,'0'));
  const AMPM    = ['AM','PM'];

  // Build ISO string from pieces
  const buildScheduledAt = useCallback(() => {
    const hour24 = (parseInt(HOURS[hourIdx]) % 12) + (ampmIdx === 1 ? 12 : 0);
    const minute = parseInt(MINUTES[minuteIdx]);
    return dayjs(selDate).hour(hour24).minute(minute).second(0).toISOString();
  }, [selDate, hourIdx, minuteIdx, ampmIdx]);

  // Live preview string
  const previewStr = `${dayjs(selDate).format('ddd, MMM D, YYYY')} at ${HOURS[hourIdx]}:${MINUTES[minuteIdx]} ${AMPM[ampmIdx]}`;

  // Auto-correct past times gracefully via rolling animation
  useEffect(() => {
    const scheduledAt = buildScheduledAt();
    const minTime = dayjs(); // Only correct times strictly in the past
    
    if (dayjs(scheduledAt).isBefore(minTime)) {
      const timer = setTimeout(() => {
        // Re-check after debounce
        if (dayjs(buildScheduledAt()).isBefore(minTime)) {
           let fallback = dayjs();
           const rem = fallback.minute() % 5;
           if (rem !== 0) fallback = fallback.add(5 - rem, 'minute');
           
           setHourIdx((fallback.hour() + 11) % 12);
           setMinuteIdx(Math.floor(fallback.minute() / 5));
           setAmpmIdx(fallback.hour() >= 12 ? 1 : 0);
           
           // If we bumped into tomorrow, update the date too
           if (!fallback.isSame(dayjs(selDate), 'day')) {
             setSelDate(fallback.toDate());
           }
        }
      }, 500); // 500ms debounce allows user to finish scrolling
      return () => clearTimeout(timer);
    }
  }, [buildScheduledAt, selDate]);

  const handleSubmit = async () => {
    if (!role.trim()) { setError('Please enter a target role.'); return; }
    const scheduledAt = buildScheduledAt();
    
    // Allow any future time (even 1 minute from now) since picker uses 5-min intervals
    if (dayjs(scheduledAt).isBefore(dayjs())) {
      setError('Cannot schedule in the past.'); return;
    }
    
    setError('');
    setLoading(true);
    try {
      const { auth } = await import('../config/firebase');
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/sessions/schedule`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', ...(token && { Authorization:`Bearer ${token}` }) },
        body: JSON.stringify({ targetRole: role.trim(), interviewType: type, difficulty, questionCount: 5, scheduledAt }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || 'Failed'); }
      onScheduled();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const card  = isDark ? '#0f172a' : '#fff';
  const bdr   = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.1)';
  const head  = isDark ? '#f1f5f9' : '#1c1917';
  const sub   = isDark ? 'rgba(255,255,255,0.45)' : '#78716c';
  const inp   = { width:'100%', padding:'10px 14px', borderRadius:10, fontSize:14,
                  border:`1px solid ${bdr}`, background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  color: head, outline:'none', boxSizing:'border-box' };
  const label = { fontSize:10, fontWeight:700, textTransform:'uppercase',
                  letterSpacing:'0.1em', color:sub, display:'block', marginBottom:6 };

  const panelBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)';

  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, zIndex:100,
        background:'rgba(0,0,0,0.65)', backdropFilter:'blur(10px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:'100%', maxWidth:680, borderRadius:24, padding:28,
          background: card,
          border:`1px solid ${bdr}`,
          boxShadow:'0 28px 80px rgba(0,0,0,0.55)',
        }}
      >
        {/* Header + live preview */}
        <div style={{ marginBottom:20 }}>
          <h3 style={{ margin:'0 0 4px', fontSize:18, fontWeight:800, color:head }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <MotionIcon Icon={Calendar} size={19} color="#f97316" title="Schedule interview" />
              Schedule Interview
            </span>
          </h3>
          <p style={{ margin:0, fontSize:12, color: sub, transition:'color 0.15s' }}>
            {previewStr}
          </p>
        </div>

        {error && (
          <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)',
            borderRadius:10, padding:'9px 13px', marginBottom:16, fontSize:12, color:'#ef4444' }}>
            {error}
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Role */}
          <div>
            <label style={label}>Target Role</label>
            <input value={role} onChange={e => setRole(e.target.value)}
              placeholder="e.g. Frontend Developer" style={inp} />
          </div>

          {/* Type + Difficulty */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={label}>Type</label>
              <select value={type} onChange={e => setType(e.target.value)} style={inp}>
                <option value="TECHNICAL">Technical</option>
                <option value="HR">Behavioral</option>
                <option value="MIXED">Mixed</option>
                <option value="COMMUNICATION">Communication</option>
              </select>
            </div>
            <div>
              <label style={label}>Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)} style={inp}>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
          </div>

          {/* ── Date + Time — side by side ── */}
          <div>
            <label style={label}>Date & Time</label>
            <div style={{
              display:'flex', gap:0,
              background: panelBg,
              border:`1px solid ${bdr}`,
              borderRadius:16,
              overflow:'hidden',
            }}>

              {/* Calendar (left) */}
              <div style={{
                flex:'1 1 auto',
                padding:'14px 16px',
                borderRight:`1px solid ${bdr}`,
                minWidth:0,
              }}>
                <MiniCalendar selectedDate={selDate} onSelect={setSelDate} isDark={isDark} compact />
              </div>

              {/* Time drums (right) */}
              <div style={{
                flex:'0 0 220px',
                display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center',
                padding:'10px 8px',
                position:'relative',
              }}>
                {/* TIME label */}
                <div style={{
                  fontSize:9, fontWeight:700, textTransform:'uppercase',
                  letterSpacing:'0.14em', color:sub, marginBottom:6,
                }}>
                  Time
                </div>

                {/* Drums container with oval pill highlight */}
                <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {/* Single oval pill spanning all drums — iOS style */}
                  <div style={{
                    position:'absolute',
                    top:'50%', left:2, right:2,
                    height:40, transform:'translateY(-50%)',
                    borderRadius:12,
                    background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                    pointerEvents:'none', zIndex:0,
                  }}/>

                  <IOSDrum items={HOURS}   selectedIndex={hourIdx}   onSelect={setHourIdx}   isDark={isDark} width={62} />
                  <div style={{
                    fontSize:20, fontWeight:700,
                    color: '#f97316',
                    padding:'0 1px', zIndex:4, lineHeight:1,
                  }}>:</div>
                  <IOSDrum items={MINUTES} selectedIndex={minuteIdx} onSelect={setMinuteIdx} isDark={isDark} width={62} />
                  <IOSDrum items={AMPM}    selectedIndex={ampmIdx}   onSelect={setAmpmIdx}   isDark={isDark} width={56} />
                </div>

                {/* Small preview badge */}
                <div style={{
                  marginTop:8,
                  padding:'4px 12px', borderRadius:99,
                  background: 'rgba(249,115,22,0.10)',
                  border:'1px solid rgba(249,115,22,0.25)',
                  fontSize:12, fontWeight:600, color:'#f97316',
                }}>
                  {HOURS[hourIdx]}:{MINUTES[minuteIdx]} {AMPM[ampmIdx]}
                </div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display:'flex', gap:10, marginTop:4 }}>
            <button onClick={handleSubmit} disabled={loading} style={{
              flex:1, padding:'12px', borderRadius:12, border:'none',
              background: loading ? 'rgba(249,115,22,0.4)' : '#f97316',
              color:'#fff', fontWeight:700, fontSize:14,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading ? 'Scheduling…' : 'Schedule Interview'}
            </button>
            <button onClick={onClose} style={{
              padding:'12px 20px', borderRadius:12,
              border:`1px solid ${bdr}`, background:'transparent',
              color:sub, fontWeight:600, fontSize:14, cursor:'pointer',
            }}>
              Cancel
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSchedule,    setShowSchedule]    = useState(false);
  const [exiting,         setExiting]         = useState(false);
  const [prescription,    setPrescription]    = useState(null);
  const [showTargetModal, setShowTargetModal] = useState(false);

  const load = () => {
    setLoading(true);
    fetchDashboardData()
      .then(setData)
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Load prescription after dashboard data is ready
  useEffect(() => {
    if (!data) return;
    fetchWeakSkillPrescription().then(setPrescription).catch(console.error);
  }, [data]);

  const handleCancelInterview = async () => {
    if (!data?.nextInterview) return;
    try {
      const { auth } = await import('../config/firebase');
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      
      setExiting(true);

      await fetch(`${API_URL}/api/sessions/${data.nextInterview.id}/cancel`, {
        method: 'POST',
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      });
      
      setTimeout(() => {
        setExiting(false);
        setData(prev => (prev ? { ...prev, nextInterview: null } : null));
        fetchDashboardData().then(setData).catch(console.error);
      }, 450);
    } catch (e) {
      console.error(e);
      setExiting(false);
    }
  };

  if (loading) return <LoadingState message="Loading dashboard..." />;
  if (error) return <ErrorState title="Error" message={error} onRetry={load} />;

  const recentSessions = data?.recentSessions || [];
  const analytics = data?.analytics || {};
  const streak = data?.streak || { currentStreak: 0, longestStreak: 0, streakAtRisk: false };
  const heatmap = data?.heatmap || [];
  const nextInterview = data?.nextInterview || null;

  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : '#fff';
  const cardBorder = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  const headColor = isDark ? '#f1f5f9' : '#1c1917';
  const subColor = isDark ? 'rgba(255,255,255,0.5)' : '#78716c';

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
      {showSchedule && (
        <ScheduleModal
          isDark={isDark}
          onClose={() => setShowSchedule(false)}
          onScheduled={load}
        />
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: headColor }}>Dashboard</h1>
          <p style={{ margin: '4px 0 0', color: subColor }}>Welcome back! Ready to ace your next interview?</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {/* Fix My Weak Areas — shown only when a weakness is detected */}
          {prescription?.primaryWeakness && (
            <motion.button
              initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }}
              whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
              onClick={() => setShowTargetModal(true)}
              style={{ padding:'10px 20px', borderRadius:12, border:'1px solid rgba(239,68,68,0.4)', background:'rgba(239,68,68,0.1)', color:'#f87171', fontWeight:700, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:7 }}
            >
              <MotionIcon Icon={Target} size={15} color="#f87171" title="Weak area" />
              Fix My Weak Areas
            </motion.button>
          )}
          <motion.button
            onClick={() => setShowSchedule(true)}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            style={{ padding:'10px 20px', borderRadius:12, border:'1px solid rgba(249,115,22,0.35)', background:'rgba(249,115,22,0.1)', color:'#f97316', fontWeight:700, fontSize:13, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:7 }}
          >
            <Calendar size={15} strokeWidth={2.5} />
            Schedule Interview
          </motion.button>
          <motion.button
            onClick={() => navigate('/setup')}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            style={{ padding:'10px 20px', borderRadius:12, border:'none', background:'#f97316', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:7 }}
          >
            <Target size={15} strokeWidth={2.5} />
            Start Now
          </motion.button>
        </div>
      </div>

      {/* ── Weak Skill Insight Banner ── */}
      <WeakSkillInsightCard />

      {/* ── Top Row: Streak + Next Interview ── */}
      <div style={{ 
        display: 'flex', 
        gap: (nextInterview && !exiting) ? 20 : 0, 
        marginBottom: 20,
        flexWrap: 'nowrap',
        width: '100%',
        alignItems: 'stretch',
        transition: 'gap 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* Streak banner — smoothly expands when scheduling card collapses */}
        <div style={{ 
          flex: (nextInterview && !exiting) ? '1 1 50%' : '1 1 100%',
          minWidth: 0,
          transition: 'flex 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <StreakCounter
            streak={streak.currentStreak}
            longestStreak={streak.longestStreak}
            atRisk={streak.streakAtRisk}
            isDark={isDark}
          />
        </div>

        {/* Next Interview panel — only rendered when exists */}
        {nextInterview && (
          <div style={{ 
            flex: exiting ? '0 0 0px' : '1 1 50%',
            minWidth: 0,
            opacity: exiting ? 0 : 1,
            overflow: 'hidden',
            transition: 'flex 0.55s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease',
          }}>
            <div style={{ width: '100%', minWidth: 450, height: '100%' }}>
              <NextInterviewCard
                interview={nextInterview}
                isDark={isDark}
                onStart={() => navigate('/setup')}
                onCancel={handleCancelInterview}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Stats Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          {
            label: 'Total Sessions',
            value: analytics.totalSessions ?? 0,
            Icon: Mic,
            iconColor: '#a78bfa',
            iconBg: isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)',
            iconBorder: 'rgba(139,92,246,0.25)',
          },
          {
            label: 'Average Score',
            value: `${analytics.averageScore ?? 0}/10`,
            Icon: BarChart3,
            iconColor: '#60a5fa',
            iconBg: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)',
            iconBorder: 'rgba(59,130,246,0.25)',
          },
          {
            label: 'Current Streak',
            value: `${streak.currentStreak}d`,
            Icon: Flame,
            iconColor: '#f97316',
            burn: streak.currentStreak > 0,
            iconBg: isDark ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.1)',
            iconBorder: 'rgba(249,115,22,0.25)',
          },
          {
            label: 'Best Streak',
            value: `${streak.longestStreak}d`,
            Icon: Trophy,
            iconColor: '#eab308',
            iconBg: isDark ? 'rgba(234,179,8,0.15)' : 'rgba(234,179,8,0.1)',
            iconBorder: 'rgba(234,179,8,0.25)',
          },
        ].map((stat, i) => (
          <motion.div
            key={i}
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ type: 'spring', stiffness: 280, damping: 20 }}
            style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            borderRadius: 16,
            padding: '18px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}>
            {/* Icon in colored square */}
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: stat.iconBg,
              border: `1px solid ${stat.iconBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              flexShrink: 0,
            }}>
              <MotionIcon
                Icon={stat.Icon}
                size={22}
                color={stat.iconColor}
                burn={stat.burn}
                title={stat.label}
              />
            </div>

            {/* Text content */}
            <div style={{ minWidth: 0 }}>
              <p style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                color: headColor,
                lineHeight: 1.1,
              }}>
                {stat.value}
              </p>
              <p style={{
                margin: '2px 0 0',
                fontSize: 11,
                fontWeight: 500,
                color: subColor,
                whiteSpace: 'nowrap',
              }}>
                {stat.label}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Activity Heatmap ── */}
      <div style={{
        background: cardBg, border: `1px solid ${cardBorder}`,
        borderRadius: 20, padding: '24px 28px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: headColor, display: 'flex', alignItems: 'center', gap: 8 }}>
              <MotionIcon Icon={BarChart3} size={18} color="#60a5fa" title="Practice activity" />
              Practice Activity
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: subColor }}>
              {heatmap.reduce((sum, d) => sum + d.count, 0)} sessions in the last year
            </p>
          </div>
          {streak.currentStreak > 0 && (
            <div style={{
              padding: '6px 14px', borderRadius: 99,
              background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)',
              fontSize: 12, fontWeight: 700, color: '#f97316',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <MotionIcon Icon={Flame} size={14} color="#f97316" burn title="Current streak" />
              {streak.currentStreak} day streak
            </div>
          )}
        </div>

        {/* Heatmap + Activity Summary side by side */}
        <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
          {/* Heatmap */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ActivityHeatmap data={heatmap} isDark={isDark} />
          </div>

          {/* Activity Summary sidebar */}
          <div style={{
            flexShrink: 0,
            width: 190,
            borderLeft: `1px solid ${cardBorder}`,
            marginLeft: 20,
            paddingLeft: 20,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 6,
          }}>
            <p style={{
              margin: '0 0 8px',
              fontSize: 12,
              fontWeight: 700,
              color: headColor,
              letterSpacing: '0.02em',
            }}>
              Activity Summary
            </p>

            {[
              {
                Icon: Mic,
                iconBg: isDark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.08)',
                iconBorder: 'rgba(139,92,246,0.2)',
                value: `${analytics.totalSessions ?? 0}`,
                label: 'Total Sessions',
                valueColor: '#a78bfa',
              },
              {
                Icon: BarChart3,
                iconBg: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)',
                iconBorder: 'rgba(59,130,246,0.2)',
                value: (analytics.averageScore ?? 0) > 0
                  ? `${(analytics.averageScore ?? 0).toFixed(1)}/10`
                  : '—',
                label: 'Avg Score',
                valueColor: '#60a5fa',
              },
              {
                Icon: Flame,
                burn: streak.currentStreak > 0,
                iconBg: isDark ? 'rgba(249,115,22,0.12)' : 'rgba(249,115,22,0.08)',
                iconBorder: 'rgba(249,115,22,0.2)',
                value: `${streak.currentStreak}d`,
                label: 'Current Streak',
                valueColor: '#fb923c',
              },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: item.iconBg,
                  border: `1px solid ${item.iconBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, flexShrink: 0,
                }}>
                  <MotionIcon
                    Icon={item.Icon}
                    size={15}
                    color={item.valueColor}
                    burn={item.burn}
                    title={item.label}
                  />
                </div>
                <div>
                  <p style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 800,
                    color: item.valueColor,
                    lineHeight: 1.2,
                  }}>
                    {item.value}
                  </p>
                  <p style={{
                    margin: '1px 0 0',
                    fontSize: 9,
                    fontWeight: 500,
                    color: subColor,
                    whiteSpace: 'nowrap',
                  }}>
                    {item.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Recent Sessions | Quick Actions | Role Progress ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 2fr', gap: 20, alignItems: 'stretch' }}>
        {/* Recent Sessions */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 20, padding: '24px 28px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: headColor }}>Recent Sessions</h3>
            <button
              onClick={() => navigate('/history')}
              style={{ background: 'none', border: 'none', color: '#f97316', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
            >
              View All →
            </button>
          </div>

          {recentSessions.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <p style={{ color: subColor, fontSize: 14 }}>No sessions yet. Start your first practice!</p>
              <button
                onClick={() => navigate('/setup')}
                style={{
                  marginTop: 12, padding: '10px 24px', borderRadius: 10, border: 'none',
                  background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                Start Practice →
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {recentSessions.map((s, i) => (
                <motion.div
                  key={s.id}
                  whileHover={{ x: 3 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 0',
                    borderBottom: i < recentSessions.length - 1 ? `1px solid ${cardBorder}` : 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => { sessionStorage.setItem('currentSessionId', s.id); navigate(`/history/${s.id}`); }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: s.score >= 7 ? 'rgba(34,197,94,0.12)' : s.score ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)',
                    fontSize: 16, flexShrink: 0,
                  }}>
                    {(() => {
                      const SessionIcon = s.status === 'SCHEDULED'
                        ? Calendar
                        : s.score >= 7
                          ? CheckCircle2
                          : s.score
                            ? FileText
                            : Mic;
                      const iconColor = s.status === 'SCHEDULED'
                        ? '#60a5fa'
                        : s.score >= 7
                          ? '#22c55e'
                          : s.score
                            ? '#f59e0b'
                            : '#818cf8';
                      return (
                        <MotionIcon
                          Icon={SessionIcon}
                          size={17}
                          color={iconColor}
                          title={s.status === 'SCHEDULED' ? 'Scheduled session' : 'Interview session'}
                        />
                      );
                    })()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: headColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.title || 'Interview Session'}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: subColor }}>
                      {s.status === 'SCHEDULED' && s.scheduledAt
                        ? `Scheduled: ${new Date(s.scheduledAt).toLocaleDateString()}`
                        : new Date(s.date).toLocaleDateString()} · {s.status}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {s.score ? (
                      <>
                        <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#f97316' }}>{s.score}</p>
                        <p style={{ margin: 0, fontSize: 9, color: subColor, fontWeight: 600 }}>/10</p>
                      </>
                    ) : (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99,
                        background: s.status === 'SCHEDULED' ? 'rgba(59,130,246,0.12)' : 'rgba(99,102,241,0.12)',
                        color: s.status === 'SCHEDULED' ? '#60a5fa' : '#818cf8',
                        border: `1px solid ${s.status === 'SCHEDULED' ? 'rgba(59,130,246,0.25)' : 'rgba(99,102,241,0.25)'}`,
                      }}>
                        {s.status}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions + Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
          {/* Quick Actions */}
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 20, padding: '24px 24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: headColor }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              {[
                { label: 'Start Interview', Icon: Target, onClick: () => navigate('/setup'), primary: true },
                { label: 'Schedule', Icon: Calendar, onClick: () => setShowSchedule(true) },
                { label: 'Resources', Icon: BookOpen, onClick: () => navigate('/resources') },
                { label: 'Analytics', Icon: TrendingUp, onClick: () => navigate('/analytics') },
              ].map(({ label, Icon, onClick, primary }, i) => (
                <motion.button
                  key={i}
                  onClick={onClick}
                  whileHover={{ x: 4, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 10,
                    border: primary ? 'none' : `1px solid ${cardBorder}`,
                    background: primary ? '#f97316' : 'transparent',
                    color: primary ? '#fff' : headColor,
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    textAlign: 'left', flex: 1,
                    display: 'flex', alignItems: 'center', gap: 9,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!primary) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'; }}
                  onMouseLeave={e => { if (!primary) e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon size={16} strokeWidth={2.5} />
                  {label}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Focus Area Card */}
          {analytics.focusArea && (
            <div style={{
              background: isDark ? 'rgba(249,115,22,0.06)' : 'rgba(249,115,22,0.04)',
              border: '1px solid rgba(249,115,22,0.2)',
              borderRadius: 20, padding: '20px 24px',
            }}>
              <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f97316' }}>
                Focus Area
              </p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: headColor }}>{analytics.focusArea}</p>
              <p style={{ margin: '6px 0 12px', fontSize: 12, color: subColor }}>
                Work on this to boost your overall score.
              </p>
              <button
                onClick={() => navigate('/resources')}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                }}
              >
                Find Resources →
              </button>
            </div>
          )}
        </div>

        {/* ── Role Progress Widget ── */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 20, padding: '24px 20px' }}>
          <RoleProgressWidget />
        </div>
      </div>

      {/* ── Targeted Practice Modal ── */}
      <AnimatePresence>
        {showTargetModal && prescription && (
          <TargetedPracticeModal
            prescription={prescription}
            onClose={() => setShowTargetModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
