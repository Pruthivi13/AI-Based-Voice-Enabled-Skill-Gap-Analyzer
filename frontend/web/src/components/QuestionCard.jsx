/**
 * QuestionCard.jsx — Interview question display
 *
 * Renders the current question in a prominent glass panel on the
 * dark interview page, or a card on light pages.
 *
 * Props:
 *   question    — Question text string
 *   category    — Optional label (e.g. "Behavioral")
 *   number      — Current question number
 *   total       — Total questions in session
 *   dark        — Dark-mode styling
 */
import React from 'react';

export default function QuestionCard({ question, category, number, total, dark = true }) {
  return (
    <div className={`rounded-2xl p-6 ${
      dark
        ? 'bg-dark-800/80 border border-primary-500/30 shadow-lg'
        : 'card'
    }`}>
      {/* Category & progress */}
      <div className="flex items-center justify-between mb-3">
        <span className="section-header flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          Interview Question
        </span>
        {number && total && (
          <span className={`text-xs font-medium ${dark ? 'text-white/40' : 'text-ink-500'}`}>
            {number} / {total}
          </span>
        )}
      </div>

      {/* Question text */}
      <p className={`text-xl font-bold leading-snug ${dark ? 'text-white' : 'text-ink-900'}`}>
        &ldquo;{question}&rdquo;
      </p>

      {category && (
        <span className="mt-3 inline-block text-xs font-semibold text-primary-400 bg-primary-500/10 px-3 py-1 rounded-full">
          {category}
        </span>
      )}
    </div>
  );
}
