/**
 * AnalyticsPage.jsx — Long-term performance insights
 *
 * Maps to PRD §9.25 Analytics & Insights.
 * Features:
 *   • Summary stats (total sessions, avg score, most improved, focus area)
 *   • Skill Gap Timeline chart (multi-line per-skill trend)  ← NEW
 *   • Score trend line chart (Chart.js — overall only)
 *   • Weak area frequency bars
 *   • Competency average cards
 */
import React, { useMemo, useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { fetchAnalytics } from '../services/api';
import ScoreCard from '../components/ScoreCard';
import SkillTimelineChart from '../components/SkillTimelineChart';
import LoadingState from '../components/LoadingState';
import { useTheme } from '../context/ThemeContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler
);

export default function AnalyticsPage() {
  const { isDark } = useTheme();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const axisTextColor = isDark ? 'rgba(255,255,255,0.5)' : '#78716c';
  const gridColor     = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const labelColor    = isDark ? 'rgba(255,255,255,0.7)' : '#44403c';

  // ── Session score trend ───────────────────────────────────────────────────
  const trendData = useMemo(
    () => ({
      labels: data?.scoreTrend?.map((p) => p.label) || [],
      datasets: [
        {
          label:              'Average Score',
          data:               data?.scoreTrend?.map((p) => p.score) || [],
          borderColor:        '#f97316',
          backgroundColor:    'rgba(249,115,22,0.1)',
          fill:               true,
          tension:            0.4,
          pointBackgroundColor: '#f97316',
          pointBorderColor:   isDark ? '#1e293b' : '#fff',
          pointBorderWidth:   2,
          pointRadius:        5,
        },
      ],
    }),
    [data, isDark]
  );

  const trendOptions = useMemo(
    () => ({
      responsive:          true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 10,
          ticks: { color: axisTextColor },
          grid:  { color: gridColor },
        },
        x: {
          ticks: { 
            color: axisTextColor,
            maxRotation: 0,
            autoSkip: true
          },
          grid:  { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#334155' : '#1c1917',
          cornerRadius:    8,
          padding:         10,
        },
      },
    }),
    [isDark, axisTextColor, gridColor]
  );

  // ── Weak area bar ─────────────────────────────────────────────────────────
  const weakAreaData = useMemo(
    () => ({
      labels: data?.weakAreas?.map((w) => w.label) || [],
      datasets: [
        {
          label:           'Frequency',
          data:            data?.weakAreas?.map((w) => w.count) || [],
          backgroundColor: ['#f97316', '#fb923c', '#fdba74', '#fed7aa'],
          borderRadius:    8,
        },
      ],
    }),
    [data]
  );

  const barOptions = useMemo(
    () => ({
      responsive:          true,
      maintainAspectRatio: false,
      indexAxis:           'y',
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: axisTextColor },
          grid:  { color: gridColor },
        },
        y: {
          ticks: { color: labelColor, font: { weight: '600' } },
          grid:  { display: false },
        },
      },
      plugins: { legend: { display: false } },
    }),
    [axisTextColor, gridColor, labelColor]
  );

  if (loading) return <LoadingState message="Loading analytics..." />;

  // No sessions yet — show friendly empty state
  const hasData = (data?.totalSessions ?? 0) > 0;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">

      {/* ── Page header ── */}
      <div>
        <h1 className="mb-1">Analytics &amp; Insights</h1>
        <p className={isDark ? 'text-white/50' : 'text-ink-500'}>
          Track your performance trends and close skill gaps over time.
        </p>
      </div>

      {!hasData ? (
        <div style={{
          borderRadius: 20, padding: '60px 24px', textAlign: 'center',
          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
          <p style={{ fontSize: 18, fontWeight: 700, color: isDark ? '#f1f5f9' : '#1c1917', marginBottom: 8 }}>
            No analytics yet
          </p>
          <p style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.4)' : '#78716c' }}>
            Complete your first interview session to start seeing performance insights.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* ── Summary stats ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Sessions', value: data?.totalSessions ?? 0 },
              { label: 'Average Score',  value: `${data?.averageScore ?? 0}/10` },
              { label: 'Most Improved',  value: typeof data?.mostImproved === 'string' ? data.mostImproved.replace(/([a-z])([A-Z])/g, '$1 $2') : (data?.mostImproved ?? '—') },
              { label: 'Focus Area',     value: typeof data?.focusArea === 'string' ? data.focusArea.replace(/([a-z])([A-Z])/g, '$1 $2') : (data?.focusArea ?? '—') },
            ].map((stat, i) => (
              <div key={i} className="card text-center flex flex-col justify-center min-w-0">
                <p className={`text-xs font-bold uppercase tracking-wider mb-1 truncate ${
                  isDark ? 'text-white/40' : 'text-ink-500'
                }`}>
                  {stat.label}
                </p>
                <p 
                  className={`text-xl md:text-2xl font-extrabold truncate ${
                    isDark ? 'text-white' : 'text-ink-900'
                  }`}
                  title={String(stat.value)}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* ── BENTO GRID LAYOUT ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* ── LEFT COLUMN (SPAN 2) ── */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* ── SKILL GAP TIMELINE ── */}
              <SkillTimelineChart
                data={data?.skillTimeline ?? []}
                delta={data?.skillDelta}
              />

              {/* ── Weak Area Frequency ── */}
              {data?.weakAreas?.length > 0 && (
                <div className="card">
                  <h3 className={`font-bold mb-4 ${isDark ? 'text-white' : 'text-ink-900'}`}>
                    Weak Area Frequency
                  </h3>
                  <div className="h-56">
                    <Bar data={weakAreaData} options={barOptions} />
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN (SPAN 1) ── */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              {/* ── Session score trend ── */}
              <section className="card">
                <h3 className={`font-bold mb-4 ${isDark ? 'text-white' : 'text-ink-900'}`}>
                  Session Score Trend
                </h3>
                <div className="h-56">
                  <Line data={trendData} options={trendOptions} />
                </div>
              </section>

              {/* ── Competency Averages ── */}
              {Object.keys(data?.competencyAverages || {}).length > 0 && (
                <div className="flex flex-col gap-4">
                  <h3 className={`font-bold px-1 ${isDark ? 'text-white' : 'text-ink-900'}`}>
                    Competency Averages
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(data?.competencyAverages || {}).map(([key, value]) => (
                      <ScoreCard
                        key={key}
                        label={key.charAt(0).toUpperCase() + key.slice(1)}
                        score={value}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
