/**
 * FeedbackPanel.jsx — AI suggestions list
 *
 * Displays actionable coaching suggestions from AI analysis.
 * Used on Performance Analysis and Practice Summary pages.
 *
 * Props:
 *   suggestions — Array of suggestion strings
 *   title       — Panel title (default: "AI Suggestions")
 */
import React from 'react';
import BrainCircuitIcon from './ui/brain-circuit-icon';

export default function FeedbackPanel({ suggestions, title = 'AI Suggestions' }) {
  return (
    <div className="card">
      <h4 className="text-lg font-bold text-ink-900 mb-4 flex items-center gap-2">
        <span className="text-primary-500 leading-none"><BrainCircuitIcon size={24} className="text-current" /></span>
        {title}
      </h4>
      <ul className="space-y-3">
        {suggestions.map((s, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-ink-700">
            <span className="w-6 h-6 flex-shrink-0 rounded-full bg-primary-50 text-primary-500
                             flex items-center justify-center text-xs font-bold mt-0.5">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
