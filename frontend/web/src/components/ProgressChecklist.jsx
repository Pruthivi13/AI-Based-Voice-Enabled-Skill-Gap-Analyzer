/**
 * ProgressChecklist.jsx — Staged processing checklist
 *
 * Shows AI analysis pipeline stages with status indicators.
 * Used on the AI Processing page (PRD §9.7).
 *
 * Props:
 *   stages — Array of { id, label, status: 'completed' | 'processing' | 'pending' }
 */
import React from 'react';

const icons = {
  completed:  (
    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    </div>
  ),
  processing: <div className="w-6 h-6 rounded-full bg-primary-500 animate-pulse-slow" />,
  pending:    <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20" />,
};

const statusLabels = {
  completed:  'Completed',
  processing: 'Processing',
  pending:    'Pending',
};

const statusColors = {
  completed:  'text-green-400',
  processing: 'text-primary-400',
  pending:    'text-white/30',
};

export default function ProgressChecklist({ stages }) {
  return (
    <div className="space-y-4">
      {stages.map((stage) => (
        <div key={stage.id} className="flex items-center gap-4">
          {icons[stage.status]}
          <span className={`flex-1 font-semibold ${
            stage.status === 'pending' ? 'text-white/40' : 'text-white'
          }`}>
            {stage.label}
          </span>
          <span className={`text-xs font-bold uppercase tracking-wider ${statusColors[stage.status]}`}>
            {statusLabels[stage.status]}
          </span>
        </div>
      ))}
    </div>
  );
}
