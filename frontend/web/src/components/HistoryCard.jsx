/**
 * HistoryCard.jsx — Session card for interview history list
 *
 * Displays a past session's key info: role, date, duration, score,
 * category icon, status chip, and action buttons.
 *
 * Maps to PRD §9.22 Interview History and UI Reference §17.7
 *
 * Props:
 *   session — Session object from mockData
 *   onView  — Handler for "View Detailed Analysis" click
 */
import React from 'react';
import StatusChip from './StatusChip';
import { useTheme } from '../context/ThemeContext';

const categoryIcons = {
  Technical:    '< >',
  Backend:      '▷',
  'Soft Skills':'☺',
  default:      '◉',
};

export default function HistoryCard({ session, onView }) {
  const icon = categoryIcons[session.category] || categoryIcons.default;
  const { isDark } = useTheme();

  return (
    <div className="card hover-lift flex flex-col sm:flex-row gap-5">
      {/* Category icon */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center
                      w-20 h-20 rounded-2xl bg-primary-50 text-primary-500">
        <span className="text-2xl font-bold">{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest mt-1">
          {session.category}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-ink-900'}`}>{session.role}</h3>
            <StatusChip status={session.status} />
          </div>
          {/* Score */}
          <div className="text-right flex-shrink-0">
            <span className="text-2xl font-extrabold text-primary-500">{session.overallScore}</span>
            <span className={`text-sm ${isDark ? 'text-white/40' : 'text-ink-500'}`}> / 10</span>
            <p className="text-[10px] uppercase tracking-wider text-primary-500 font-bold">Overall Score</p>
          </div>
        </div>

        {/* Meta */}
        <div className={`flex items-center gap-3 text-xs mb-2 ${isDark ? 'text-white/50' : 'text-ink-500'}`}>
          <span>📅 {session.date}</span>
          <span>⏱ {session.duration}</span>
        </div>

        {/* Summary */}
        <p className={`text-sm mb-3 line-clamp-2 ${isDark ? 'text-white/60' : 'text-ink-700'}`}>{session.summary}</p>

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={onView} className="btn-primary text-sm py-2 px-5">
            📊 View Detailed Analysis
          </button>
          <button className="text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors">
            ▶ Replay Answer
          </button>
        </div>
      </div>
    </div>
  );
}

