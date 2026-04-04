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
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchSessionReview, fetchSessionRoadmap } from '../services/mockApi';
import RoadmapSection from '../components/RoadmapSection';
import StatusChip from '../components/StatusChip';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { useTheme } from '../context/ThemeContext';
import ClockIcon from '../components/ui/clock-icon';

export default function SessionReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roadmap, setRoadmap] = useState(null);
  const [roadmapLoading, setRoadmapLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    sessionStorage.setItem('currentSessionId', id);
    fetchSessionReview(id)
      .then((data) => {
        setReview(data);
        setRoadmapLoading(true);
        fetchSessionRoadmap(id)
          .then(setRoadmap)
          .catch(() => {}) // roadmap just won't show if not saved
          .finally(() => setRoadmapLoading(false));
      })
      .catch(() => setError('Failed to load session review.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingState message="Loading session review..." />;
  if (error)
    return (
      <ErrorState
        title="Error"
        message={error}
        onRetry={() => window.location.reload()}
      />
    );

  const getStatus = (score) => {
    if (!score) return 'borderline';
    if (score >= 8) return 'excellent';
    if (score >= 7) return 'good';
    if (score >= 6) return 'borderline';
    return 'needs-improvement';
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <button
        onClick={() => navigate('/history')}
        className="text-sm text-primary-500 font-semibold hover:text-primary-600 mb-4 inline-flex items-center gap-1"
      >
        ← Back to History
      </button>

      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1>{review?.session?.title || 'Session Review'}</h1>
          <div
            className={`flex items-center gap-3 text-sm mt-1 ${isDark ? 'text-white/50' : 'text-ink-500'}`}
          >
            <span className="flex items-center gap-1">
              <ClockIcon size={16} className="text-current" />{' '}
              {review?.session?.date
                ? new Date(review.session.date).toLocaleDateString()
                : 'N/A'}
            </span>
            {review?.session?.duration && (
              <span className="flex items-center gap-1"><ClockIcon size={16} className="text-current" /> {review.session.duration}s</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="text-4xl font-extrabold text-primary-500">
            {review?.session?.score ?? 'N/A'}
          </span>
          <span
            className={`text-lg ${isDark ? 'text-white/50' : 'text-ink-500'}`}
          >
            {' '}
            / 10
          </span>
          <p className="text-[10px] uppercase tracking-wider text-primary-500 font-bold">
            Overall Score
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {review?.questions?.map((q, idx) => (
          <div key={q.id} className="card">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-xs font-bold ${isDark ? 'text-white/50' : 'text-ink-500'}`}
                  >
                    Question {idx + 1}
                  </span>
                  <StatusChip status={getStatus(q.score)} />
                </div>
                <p
                  className={`font-semibold ${isDark ? 'text-white' : 'text-ink-900'}`}
                >
                  {q.content}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-extrabold text-primary-500">
                  {q.score ?? 'N/A'}
                </p>
                <p
                  className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-ink-500'}`}
                >
                  Score
                </p>
              </div>
            </div>

            {q.transcript && (
              <div
                className={`rounded-xl p-4 mb-4 ${isDark ? 'bg-white/5' : 'bg-surface-100'}`}
              >
                <p
                  className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-white/40' : 'text-ink-500'}`}
                >
                  Your Answer
                </p>
                <p
                  className={`text-sm leading-relaxed ${isDark ? 'text-white/70' : 'text-ink-700'}`}
                >
                  {q.transcript}
                </p>
              </div>
            )}

            {Array.isArray(q.feedback) && q.feedback.length > 0 && (
              <div>
                <p
                  className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-white/40' : 'text-ink-500'}`}
                >
                  Feedback
                </p>
                <ul className="space-y-1">
                  {q.feedback.map((f, i) => (
                    <li
                      key={i}
                      className={`text-sm flex items-start gap-1 ${isDark ? 'text-white/70' : 'text-ink-700'}`}
                    >
                      <span className="text-primary-500">→</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>

      {roadmapLoading && (
        <p className="text-sm text-ink-500 text-center mt-8">
          Loading roadmap...
        </p>
      )}
      {!roadmapLoading && roadmap && (
        <section className="mt-10">
          <h2 className="mb-4">Learning Roadmap</h2>
          <RoadmapSection
            nodes={roadmap.nodes}
            edges={roadmap.edges}
            targetRole={roadmap.targetRole}
            roadmapId={`${roadmap.targetRole}-${id}`.replace(/\s+/g, '-').toLowerCase()}
          />
        </section>
      )}

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
