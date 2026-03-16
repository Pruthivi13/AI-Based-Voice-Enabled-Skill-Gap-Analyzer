/**
 * TranscriptPanel.jsx — Scrollable transcript display
 *
 * Shows the user's spoken response text. Used on interview page,
 * practice summary, and session review.
 *
 * Props:
 *   transcript — String of transcribed text
 *   label      — Optional header label (default: "Live Transcript")
 *   dark       — If true, uses dark styling for immersive pages
 */
import React from 'react';

export default function TranscriptPanel({ transcript, label = 'Live Transcript', dark = false }) {
  return (
    <div className={`rounded-2xl p-5 ${
      dark
        ? 'bg-white/5 border border-white/10'
        : 'bg-surface-100 border border-surface-200'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <svg className={`w-4 h-4 ${dark ? 'text-white/60' : 'text-ink-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        <span className={`text-xs font-bold uppercase tracking-wider ${dark ? 'text-white/60' : 'text-ink-500'}`}>
          {label}
        </span>
      </div>

      {/* Transcript text */}
      <div className={`max-h-48 overflow-y-auto text-sm leading-relaxed ${
        dark ? 'text-white/80' : 'text-ink-700'
      }`}>
        {transcript || (
          <span className={dark ? 'text-white/30' : 'text-ink-500'}>
            {/* Placeholder transcript until ASR is connected */}
            Waiting for response...
          </span>
        )}
      </div>
    </div>
  );
}
