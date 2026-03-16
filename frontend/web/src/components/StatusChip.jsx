/**
 * StatusChip.jsx — Colored badge for session status
 *
 * Maps status strings to design-system semantic colors.
 *
 * Props:
 *   status — 'excellent' | 'passed' | 'good' | 'borderline' | 'needs-improvement' | 'failed'
 *   label  — Optional custom text; defaults to capitalised status
 */
import React from 'react';

const variants = {
  excellent:          'bg-green-100 text-green-700',
  passed:             'bg-green-100 text-green-700',
  good:               'bg-green-100 text-green-700',
  borderline:         'bg-amber-100 text-amber-700',
  'needs-improvement':'bg-amber-100 text-amber-700',
  failed:             'bg-red-100 text-red-700',
};

export default function StatusChip({ status, label }) {
  const classes = variants[status] || 'bg-surface-200 text-ink-700';
  const display = label || status.replace(/-/g, ' ');

  return (
    <span className={`chip ${classes}`}>
      {display}
    </span>
  );
}
