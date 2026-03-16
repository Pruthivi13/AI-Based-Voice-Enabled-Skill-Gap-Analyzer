/**
 * SessionReviewPage.jsx — Detailed session review
 *
 * Maps to PRD §9.23 Detailed Session Review.
 * Shows a previously completed session in full detail.
 *
 * Features:
 *   • Session meta (role, date, duration, overall score)
 *   • Per-question transcript, score, feedback, strengths, improvements
 *   • Retry action per question
 *
 * TODO: Replace mock data with fetchSessionReview(sessionId)
 */
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { mockSessionReview } from '../data/mockData';
import StatusChip from '../components/StatusChip';

export default function SessionReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // TODO: Use id to fetch real session review data
  const review = mockSessionReview;

  const getStatus = (score) => {
    if (score >= 8) return 'excellent';
    if (score >= 7) return 'good';
    if (score >= 6) return 'borderline';
    return 'needs-improvement';
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <button
        onClick={() => navigate('/history')}
        className="text-sm text-primary-500 font-semibold hover:text-primary-600 mb-4 inline-flex items-center gap-1"
      >
        ← Back to History
      </button>

      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1>{review.role}</h1>
          <div className="flex items-center gap-3 text-sm text-ink-500 mt-1">
            <span>📅 {review.date}</span>
            <span>⏱ {review.duration}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-4xl font-extrabold text-primary-500">{review.overallScore}</span>
          <span className="text-lg text-ink-500"> / 10</span>
          <p className="text-[10px] uppercase tracking-wider text-primary-500 font-bold">Overall Score</p>
        </div>
      </div>

      {/* Question-by-Question Review */}
      <div className="space-y-6">
        {review.questions.map((q, idx) => (
          <div key={q.id} className="card">
            {/* Question header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-ink-500">Question {idx + 1}</span>
                  <StatusChip status={getStatus(q.score)} />
                </div>
                <p className="font-semibold text-ink-900">{q.question}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-extrabold text-primary-500">{q.score}</p>
                <p className="text-[10px] text-ink-500 font-bold uppercase tracking-wider">Score</p>
              </div>
            </div>

            {/* Transcript */}
            <div className="bg-surface-100 rounded-xl p-4 mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-500 mb-2">Your Answer</p>
              <p className="text-sm text-ink-700 leading-relaxed">{q.transcript}</p>
            </div>

            {/* Feedback */}
            <p className="text-sm text-ink-700 mb-4">
              <span className="font-semibold text-ink-900">Feedback: </span>
              {q.feedback}
            </p>

            {/* Strengths & Improvements */}
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2">Strengths</p>
                <ul className="space-y-1">
                  {q.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-ink-700 flex items-start gap-1">
                      <span className="text-green-500">✓</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">Improvements</p>
                <ul className="space-y-1">
                  {q.improvements.map((s, i) => (
                    <li key={i} className="text-sm text-ink-700 flex items-start gap-1">
                      <span className="text-amber-500">→</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Retry */}
            <button
              onClick={() => navigate('/interview')}
              className="text-sm font-semibold text-primary-500 hover:text-primary-600"
            >
              🔄 Retry This Question
            </button>
          </div>
        ))}
      </div>

      {/* Bottom Actions */}
      <div className="flex gap-4 justify-center mt-8">
        <button onClick={() => navigate('/setup')} className="btn-secondary">
          Practice Again
        </button>
        <button onClick={() => navigate('/analytics')} className="btn-primary">
          View Analytics
        </button>
      </div>
    </div>
  );
}
