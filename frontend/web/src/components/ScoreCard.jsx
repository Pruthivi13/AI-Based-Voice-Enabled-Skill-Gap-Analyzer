/**
 * ScoreCard.jsx — Numeric score display card
 *
 * Used in performance analysis and dashboard pages to show
 * individual dimension scores (communication, confidence, etc.).
 *
 * Props:
 *   label    — Dimension name (e.g. "Communication")
 *   score    — Numeric value (0–10)
 *   maxScore — Maximum possible score (default 10)
 *   icon     — Optional React node for a leading icon
 *   color    — Tailwind text-color class for the score (default: primary-500)
 */
import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function ScoreCard({ label, score, maxScore = 10, icon, color = 'text-primary-500' }) {
  const percentage = (score / maxScore) * 100;
  const { isDark } = useTheme();

  return (
    <div className="card hover-lift flex flex-col gap-2 p-4">
      <div className="flex items-center gap-2">
        {icon && <div className="text-primary-500">{icon}</div>}
        <span className={`text-xs font-semibold ${isDark ? 'text-white/70' : 'text-ink-700'}`}>{label}</span>
      </div>

      {/* Score display */}
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-extrabold ${color}`}>{score.toFixed(1)}</span>
        <span className={`text-xs ${isDark ? 'text-white/40' : 'text-ink-500'}`}>/ {maxScore}</span>
      </div>

      {/* Progress bar */}
      <div className={`w-full h-1.5 rounded-full mt-1 overflow-hidden ${isDark ? 'bg-white/10' : 'bg-surface-200'}`}>
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-700"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

