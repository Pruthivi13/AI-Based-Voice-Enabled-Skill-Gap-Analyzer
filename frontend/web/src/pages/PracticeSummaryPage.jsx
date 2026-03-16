/**
 * PracticeSummaryPage.jsx — Per-question feedback screen
 *
 * Maps to PRD §9.15 and UI Reference §17.5 (Practice Summary).
 * Shows immediate post-answer feedback after each question.
 *
 * Features:
 *   • Answer transcript
 *   • Quick score
 *   • Strengths list
 *   • Improvements list
 *   • Next Question / Finish Practice actions
 *
 * This screen is a checkpoint, not a full report.
 *
 * TODO: Replace mock data with fetchPracticeSummary(sessionId, questionId)
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { mockPracticeSummary } from '../data/mockData';
import GlassPanel from '../components/GlassPanel';
import TranscriptPanel from '../components/TranscriptPanel';

export default function PracticeSummaryPage() {
  const navigate = useNavigate();
  const summary = mockPracticeSummary; // TODO: Replace with real data

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-10 max-w-3xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-white mb-1">Practice Summary</h2>
      <p className="text-sm text-white/50 mb-8">Here&apos;s how you did on this question.</p>

      {/* Quick Score */}
      <GlassPanel className="w-full mb-6 text-center">
        <p className="text-xs uppercase tracking-widest text-white/40 font-bold mb-1">Quick Score</p>
        <p className="text-5xl font-extrabold text-primary-500">{summary.quickScore}</p>
        <p className="text-sm text-white/50 mt-1">out of 10</p>
      </GlassPanel>

      {/* Transcript */}
      <div className="w-full mb-6">
        <TranscriptPanel transcript={summary.transcript} label="Your Answer" dark />
      </div>

      {/* Strengths & Improvements */}
      <div className="grid md:grid-cols-2 gap-4 w-full mb-8">
        {/* Strengths */}
        <GlassPanel>
          <h4 className="text-sm font-bold text-green-400 uppercase tracking-wider mb-3">
            ✅ Strengths
          </h4>
          <ul className="space-y-2">
            {summary.strengths.map((s, i) => (
              <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                <span className="text-green-400 mt-0.5">•</span>
                {s}
              </li>
            ))}
          </ul>
        </GlassPanel>

        {/* Improvements */}
        <GlassPanel>
          <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3">
            ⚠️ Areas to Improve
          </h4>
          <ul className="space-y-2">
            {summary.improvements.map((s, i) => (
              <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span>
                {s}
              </li>
            ))}
          </ul>
        </GlassPanel>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={() => navigate('/interview')}
          className="btn-glass px-8"
        >
          Next Question →
        </button>
        <button
          onClick={() => navigate('/results')}
          className="btn-primary px-8"
        >
          Finish Practice
        </button>
      </div>
    </div>
  );
}
