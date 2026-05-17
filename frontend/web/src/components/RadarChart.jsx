/**
 * RadarChart.jsx — Chart.js radar chart wrapper
 *
 * Displays multi-dimensional competency scores per PRD §9.18.
 * Uses react-chartjs-2 for rendering.
 * Theme-aware: adapts colors for light/dark mode.
 *
 * Props:
 *   labels — Array of dimension names
 *   values — Array of scores (same order as labels)
 */
import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { useTheme } from '../context/ThemeContext';

// Register Chart.js components
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function RadarChart({ labels, values }) {
  const { isDark } = useTheme();

  const data = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Your Score',
        data: values,
        backgroundColor: isDark
          ? 'rgba(249, 115, 22, 0.2)'
          : 'rgba(249, 115, 22, 0.15)',
        borderColor: '#f97316',
        borderWidth: 2.5,
        pointBackgroundColor: '#f97316',
        pointBorderColor: isDark ? '#1e293b' : '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: '#ea580c',
        fill: true,
      },
    ],
  }), [labels, values, isDark]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        beginAtZero: true,
        max: 10,
        ticks: {
          stepSize: 2,
          color: isDark ? 'rgba(255, 255, 255, 0.4)' : '#78716c',
          backdropColor: 'transparent',
          font: { size: 11 },
        },
        grid: {
          color: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          lineWidth: 1,
        },
        angleLines: {
          color: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        },
        pointLabels: {
          color: isDark ? 'rgba(255, 255, 255, 0.75)' : '#44403c',
          font: { size: 13, weight: '600' },
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#1e293b' : '#1c1917',
        titleColor: '#f1f5f9',
        bodyColor: '#e2e8f0',
        titleFont: { size: 13, weight: '600' },
        bodyFont: { size: 12 },
        cornerRadius: 8,
        padding: 10,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'transparent',
        borderWidth: isDark ? 1 : 0,
        callbacks: {
          label: (ctx) => `${ctx.label}: ${ctx.raw}/10`,
        },
      },
    },
  }), [isDark]);

  return <Radar data={data} options={options} />;
}
