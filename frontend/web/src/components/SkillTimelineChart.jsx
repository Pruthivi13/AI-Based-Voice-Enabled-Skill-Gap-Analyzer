import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTheme } from '../context/ThemeContext';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const SKILLS = [
  { key: 'overall',    label: 'Overall',    color: '#f97316' },
  { key: 'technical',  label: 'Technical',  color: '#38bdf8' },
  { key: 'clarity',    label: 'Clarity',    color: '#a78bfa' },
  { key: 'confidence', label: 'Confidence', color: '#34d399' },
  { key: 'fluency',    label: 'Fluency',    color: '#fb923c' },
  { key: 'grammar',    label: 'Grammar',    color: '#f472b6' },
];

const ease = (t) => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;

function DeltaBadge({ value }) {
  if (value == null) return <span style={{color:'rgba(255,255,255,0.25)'}} className="flex items-center gap-0.5 text-[11px] font-semibold"><Minus size={11}/> —</span>;
  const isPos = value > 0, isNeg = value < 0;
  return <span className="flex items-center gap-0.5 text-[11px] font-bold" style={{color:isPos?'#34d399':isNeg?'#f87171':'rgba(255,255,255,0.35)'}}>
    {isPos?<TrendingUp size={11}/>:isNeg?<TrendingDown size={11}/>:<Minus size={11}/>}
    {isPos?'+':''}{value}
  </span>;
}

export default function SkillTimelineChart({ data = [], delta = null }) {
  const { isDark } = useTheme();
  const chartRef = useRef(null);

  // anim: p=progress, raf=requestAnimationFrame id, key=skill being toggled in
  const anim = useRef({ p: 0, raf: null, key: null });

  // animatingSkill drives chartData — makes new skill invisible so we draw it manually
  const [animatingSkill, setAnimatingSkill] = useState(null);
  const [activeSkills, setActiveSkills] = useState(() => new Set(['overall','technical','confidence']));

  // ── RAF loop ──────────────────────────────────────────────────────────────
  const runAnim = useCallback((ms, skillKey, onDone) => {
    if (anim.current.raf) cancelAnimationFrame(anim.current.raf);
    anim.current = { p: 0, raf: null, key: skillKey };
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min((now - t0) / ms, 1);
      anim.current.p = ease(t);
      chartRef.current?.update('none');
      if (t < 1) { anim.current.raf = requestAnimationFrame(tick); }
      else { anim.current.p = 1; anim.current.key = null; anim.current.raf = null; onDone?.(); }
    };
    anim.current.raf = requestAnimationFrame(tick);
  }, []);

  // ── Plugin ────────────────────────────────────────────────────────────────
  const plugin = useMemo(() => ({
    id: 'skillGrow',

    // INITIAL LOAD: clip ALL lines growing left → right
    beforeDatasetsDraw(chart) {
      const { p, key } = anim.current;
      if (key !== null || p >= 1) return;          // skip during toggle mode
      const { ctx, chartArea: ca } = chart;
      if (!ca) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(ca.left - 1, ca.top - 6, (ca.right - ca.left + 2) * p, ca.bottom - ca.top + 12);
      ctx.clip();
    },
    afterDatasetsDraw(chart) {
      const { p, key } = anim.current;
      if (key !== null || p >= 1) return;
      chart.ctx.restore();
    },

    // TOGGLE ON: draw ONLY the new line with a growing clip; others already rendered normally
    afterDraw(chart) {
      const { p, key } = anim.current;
      if (!key || p >= 1) return;

      const skill = SKILLS.find(s => s.key === key);
      if (!skill) return;

      // Find the dataset marked as animating (_anim flag set in chartData)
      const dsIdx = chart.data.datasets.findIndex(d => d._anim === true);
      if (dsIdx === -1) return;

      const meta = chart.getDatasetMeta(dsIdx);
      if (!meta) return;

      const { ctx, chartArea: ca } = chart;
      if (!ca) return;

      ctx.save();
      ctx.beginPath();
      ctx.rect(ca.left - 1, ca.top - 6, (ca.right - ca.left + 2) * p, ca.bottom - ca.top + 12);
      ctx.clip();

      // Temporarily restore real color, draw, then revert
      const line = meta.dataset;
      if (line) {
        const prev = line.options.borderColor;
        line.options.borderColor = skill.color;
        line.draw(ctx);
        line.options.borderColor = prev;
      }
      meta.data?.forEach(pt => {
        if (!pt) return;
        const prevBg = pt.options.backgroundColor;
        const prevBd = pt.options.borderColor;
        pt.options.backgroundColor = skill.color;
        pt.options.borderColor     = skill.color;
        pt.draw(ctx);
        pt.options.backgroundColor = prevBg;
        pt.options.borderColor     = prevBd;
      });

      ctx.restore();
    },
  }), []); // eslint-disable-line

  // ── Initial load animation ────────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => runAnim(900, null, null), 80);
    return () => { clearTimeout(id); if (anim.current.raf) cancelAnimationFrame(anim.current.raf); };
  }, []); // eslint-disable-line

  // ── Toggle handler ────────────────────────────────────────────────────────
  const toggleSkill = (key) => {
    const isAdding = !activeSkills.has(key);

    setActiveSkills(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });

    if (isAdding) {
      setAnimatingSkill(key);
      // Wait one frame so React flushes & Chart.js adds the invisible dataset
      requestAnimationFrame(() => {
        runAnim(650, key, () => setAnimatingSkill(null));
      });
    }
  };

  // ── Chart data ────────────────────────────────────────────────────────────
  const labels = data.map(d => d.label);

  const chartData = useMemo(() => ({
    labels,
    datasets: SKILLS.filter(s => activeSkills.has(s.key)).map(skill => {
      const isAnimating = skill.key === animatingSkill;
      return {
        label:               skill.label,
        _anim:               isAnimating,          // flag read by plugin
        data:                data.map(d => d[skill.key] ?? null),
        // Animating skill is invisible — plugin draws it manually with clip
        borderColor:         isAnimating ? 'transparent' : skill.color,
        backgroundColor:     'transparent',
        fill:                false,
        tension:             0.4,
        pointRadius:         isAnimating ? 0 : 4,
        pointHoverRadius:    isAnimating ? 0 : 7,
        pointBackgroundColor: isAnimating ? 'transparent' : skill.color,
        pointBorderColor:    isDark ? '#0f172a' : '#fff',
        pointBorderWidth:    2,
        borderWidth:         2.5,
        spanGaps:            true,
      };
    }),
  }), [data, activeSkills, animatingSkill, isDark]);

  const axisColor = isDark ? 'rgba(255,255,255,0.35)' : '#9ca3af';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      y: { min:0, max:10, ticks:{stepSize:2,color:axisColor,font:{size:11}}, grid:{color:gridColor}, border:{display:false} },
      x: { ticks:{color:axisColor,font:{size:11},maxRotation:0}, grid:{display:false}, border:{display:false} },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark?'#1e293b':'#111827', titleColor: isDark?'#f1f5f9':'#fff',
        bodyColor:'rgba(255,255,255,0.75)', borderColor:'rgba(255,255,255,0.08)',
        borderWidth:1, cornerRadius:10, padding:12,
        filter: item => !chartData.datasets[item.datasetIndex]?._anim,
        callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y!=null?ctx.parsed.y.toFixed(1):'—'}/10` },
      },
    },
  }), [isDark, axisColor, gridColor, chartData]);

  const latest = data[data.length - 1] ?? {};

  if (data.length === 0) return (
    <div className="rounded-2xl p-10 text-center border"
      style={{background:isDark?'rgba(15,23,42,0.5)':'#f8fafc',borderColor:isDark?'rgba(255,255,255,0.07)':'#e2e8f0',color:isDark?'rgba(255,255,255,0.3)':'#94a3b8'}}>
      <TrendingUp size={36} className="mx-auto mb-3 opacity-25"/>
      <p className="font-semibold text-sm">No skill data yet</p>
      <p className="text-xs mt-1 opacity-70">Complete at least one session to see your progress trends.</p>
    </div>
  );

  return (
    <div className="rounded-2xl border p-6" style={{
      background: isDark?'linear-gradient(135deg,rgba(15,23,42,0.8) 0%,rgba(30,41,59,0.6) 100%)':'#fff',
      borderColor:isDark?'rgba(255,255,255,0.07)':'#e2e8f0', backdropFilter:isDark?'blur(12px)':'none',
    }}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h3 className="font-bold text-lg" style={{color:isDark?'#f1f5f9':'#0f172a'}}>Skill Progress Over Time</h3>
          <p className="text-xs mt-0.5" style={{color:isDark?'rgba(255,255,255,0.4)':'#94a3b8'}}>
            {data.length} session{data.length!==1?'s':''} · last 90 days
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map(skill => {
            const active = activeSkills.has(skill.key);
            return <button key={skill.key} onClick={() => toggleSkill(skill.key)} style={{
              border:'1.5px solid', borderColor:active?skill.color:'transparent',
              background:active?`${skill.color}18`:isDark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.04)',
              color:active?skill.color:isDark?'rgba(255,255,255,0.35)':'#78716c',
            }} className="px-3 py-1 rounded-full text-[11px] font-bold transition-all duration-150 cursor-pointer">
              {skill.label}
            </button>;
          })}
        </div>
      </div>

      <div className="h-64 mb-6">
        <Line ref={chartRef} data={chartData} options={options} plugins={[plugin]}/>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {SKILLS.map(skill => (
          <div key={skill.key} className="rounded-xl p-3 border text-center"
            style={{borderColor:`${skill.color}30`,background:`${skill.color}08`}}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{color:skill.color}}>{skill.label}</p>
            <p className="text-lg font-extrabold" style={{color:isDark?'#f1f5f9':'#0f172a'}}>
              {latest[skill.key]!=null?Number(latest[skill.key]).toFixed(1):'—'}
            </p>
            <div className="flex justify-center mt-1"><DeltaBadge value={delta?.[skill.key]??null}/></div>
          </div>
        ))}
      </div>

      <p className="text-[10px] mt-4 text-center" style={{color:isDark?'rgba(255,255,255,0.2)':'#94a3b8'}}>
        Deltas show change vs previous session · Toggle skills to focus the view
      </p>
    </div>
  );
}
