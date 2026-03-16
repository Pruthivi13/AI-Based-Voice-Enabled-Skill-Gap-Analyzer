/**
 * RadarChart.jsx — Chart.js radar chart wrapper
 *
 * Displays multi-dimensional competency scores per PRD §9.18.
 * Uses react-chartjs-2 for rendering.
 *
 * Props:
 *   labels — Array of dimension names
 *   values — Array of scores (same order as labels)
 */
import React from 'react';
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

// Register Chart.js components
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export default function RadarChart({ labels, values }) {
  const data = {
    labels,
    datasets: [
      {
        label: 'Your Score',
        data: values,
        backgroundColor: 'rgba(249, 115, 22, 0.15)',
        borderColor: '#f97316',
        borderWidth: 2,
        pointBackgroundColor: '#f97316',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        beginAtZero: true,
        max: 10,
        ticks: {
          stepSize: 2,
          color: '#78716c',
          backdropColor: 'transparent',
          font: { size: 11 },
        },
        grid: { color: 'rgba(0,0,0,0.06)' },
        pointLabels: {
          color: '#44403c',
          font: { size: 13, weight: '600' },
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1c1917',
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        cornerRadius: 8,
        padding: 10,
      },
    },
  };

  return <Radar data={data} options={options} />;
}
