/**
 * AnalyticsPage.jsx — Long-term performance insights
 *
 * Maps to PRD §9.25 Analytics & Insights.
 * Features:
 *   • Summary stats (total sessions, avg score, most improved, focus area)
 *   • Score trend line chart (Chart.js)
 *   • Weak area frequency bars
 *   • Competency average cards
 *
 * TODO: Replace mock data with fetchAnalytics()
 */
import React, { useMemo, useState, useEffect } from 'react';
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
import { fetchAnalytics } from '../services/mockApi';
import ScoreCard from '../components/ScoreCard';
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const axisTextColor = isDark ? 'rgba(255,255,255,0.5)' : '#78716c';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const labelColor = isDark ? 'rgba(255,255,255,0.7)' : '#44403c';

  const trendData = useMemo(
    () => ({
      labels: data?.scoreTrend?.map((p) => p.label) || [],
      datasets: [
        {
          label: 'Average Score',
          data: data?.scoreTrend?.map((p) => p.score) || [],
          borderColor: '#f97316',
          backgroundColor: 'rgba(249,115,22,0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#f97316',
          pointBorderColor: isDark ? '#1e293b' : '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
        },
      ],
    }),
    [data, isDark]
  );

  const trendOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 10,
          ticks: { color: axisTextColor },
          grid: { color: gridColor },
        },
        x: { ticks: { color: axisTextColor }, grid: { display: false } },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#334155' : '#1c1917',
          cornerRadius: 8,
          padding: 10,
        },
      },
    }),
    [isDark, axisTextColor, gridColor]
  );

  const weakAreaData = useMemo(
    () => ({
      labels: data?.weakAreas?.map((w) => w.label) || [],
      datasets: [
        {
          label: 'Frequency',
          data: data?.weakAreas?.map((w) => w.count) || [],
          backgroundColor: ['#f97316', '#fb923c', '#fdba74', '#fed7aa'],
          borderRadius: 8,
        },
      ],
    }),
    [data]
  );

  const barOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: axisTextColor },
          grid: { color: gridColor },
        },
        y: {
          ticks: { color: labelColor, font: { weight: '600' } },
          grid: { display: false },
        },
      },
      plugins: { legend: { display: false } },
    }),
    [axisTextColor, gridColor, labelColor]
  );

  if (loading) return <LoadingState message="Loading analytics..." />;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="mb-2">Analytics & Insights</h1>
      <p className={`mb-10 ${isDark ? 'text-white/50' : 'text-ink-500'}`}>
        Track your performance trends and identify areas for improvement.
      </p>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Total Sessions', value: data?.totalSessions ?? 0 },
          { label: 'Average Score', value: `${data?.averageScore ?? 0}/10` },
          { label: 'Most Improved', value: data?.mostImproved ?? 'N/A' },
          { label: 'Focus Area', value: data?.focusArea ?? 'N/A' },
        ].map((stat, i) => (
          <div key={i} className="card text-center">
            <p
              className={`text-xs font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-white/40' : 'text-ink-500'}`}
            >
              {stat.label}
            </p>
            <p
              className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-ink-900'}`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Score Trend */}
      <section className="card mb-10">
        <h3
          className={`font-bold mb-4 ${isDark ? 'text-white' : 'text-ink-900'}`}
        >
          Score Trend Over Time
        </h3>
        <div className="h-64">
          <Line data={trendData} options={trendOptions} />
        </div>
      </section>

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="card">
          <h3
            className={`font-bold mb-4 ${isDark ? 'text-white' : 'text-ink-900'}`}
          >
            Weak Area Frequency
          </h3>
          <div className="h-48">
            <Bar data={weakAreaData} options={barOptions} />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className={`font-bold ${isDark ? 'text-white' : 'text-ink-900'}`}>
            Competency Averages
          </h3>
          {Object.entries(data?.competencyAverages || {}).map(
            ([key, value]) => (
              <ScoreCard
                key={key}
                label={key.charAt(0).toUpperCase() + key.slice(1)}
                score={value}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
