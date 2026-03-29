/**
 * PerformanceAnalysisPage.jsx — Final session-level analytics
 *
 * Maps to PRD §9.17, §9.18, §9.19 and UI Reference §17.6.
 * This is the product's "proof of intelligence" page.
 *
 * Features:
 *   • Overall score hero
 *   • Radar chart (multi-axis competency visualization)
 *   • Score cards per dimension (communication, confidence, technical, clarity, fluency)
 *   • AI suggestions panel
 *   • Question-by-question breakdown
 *   • Retry / Save actions
 *
 * TODO: Replace mock data with fetchPerformanceAnalysis(sessionId)
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchReport,
  fetchSessionReview,
  retryQuestion,
} from '../services/mockApi';
import RadarChart from '../components/RadarChart';
import ScoreCard from '../components/ScoreCard';
import FeedbackPanel from '../components/FeedbackPanel';
import StatusChip from '../components/StatusChip';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import RefreshIcon from '../components/ui/refresh-icon';
import SaveIcon from '../components/ui/save-icon';

export default function PerformanceAnalysisPage() {
  const navigate = useNavigate();
  const sessionId = sessionStorage.getItem('currentSessionId');

  const [report, setReport] = useState(null);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sessionId) {
      navigate('/setup');
      return;
    }

    const loadData = async () => {
      try {
        const [reportData, reviewData] = await Promise.all([
          fetchReport(sessionId),
          fetchSessionReview(sessionId),
        ]);
        setReport(reportData);
        setReview(reviewData);
      } catch (err) {
        setError('Failed to load results. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [sessionId, navigate]);

  if (loading) return <LoadingState message="Loading your results..." />;
  if (error)
    return (
      <ErrorState
        title="Error"
        message={error}
        onRetry={() => window.location.reload()}
      />
    );

  const radarData = report?.radarData || { labels: [], values: [] };
  const recommendations = Array.isArray(report?.recommendations)
    ? report.recommendations
    : [];

  const getStatus = (score) => {
    if (score >= 8) return 'excellent';
    if (score >= 7) return 'good';
    if (score >= 6) return 'borderline';
    return 'needs-improvement';
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Overall Score Hero */}
      <section className="text-center mb-12">
        <p className="section-header mb-2">Session Complete</p>
        <h1 className="mb-3">Performance Analysis</h1>
        <div className="inline-flex items-baseline gap-2 mb-2">
          <span className="text-6xl font-extrabold text-primary-500">
            {report?.overallScore ?? 'N/A'}
          </span>
          <span className="text-2xl text-ink-500 font-bold">/ 10</span>
        </div>
        <p className="text-ink-500">
          Overall Rating:{' '}
          <span className="font-bold text-ink-900">
            {report?.ratingLabel ?? 'N/A'}
          </span>
        </p>
        {report?.summary && (
          <p className="text-ink-500 mt-2 max-w-xl mx-auto text-sm">
            {report.summary}
          </p>
        )}
      </section>

      {/* Radar Chart + Score Cards */}
      <section className="grid lg:grid-cols-2 gap-8 mb-12">
        <div className="card flex items-center justify-center p-8">
          <div className="w-full max-w-sm">
            {radarData.labels.length > 0 ? (
              <RadarChart labels={radarData.labels} values={radarData.values} />
            ) : (
              <p className="text-ink-500 text-center">
                No radar data available
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ScoreCard label="Overall Score" score={report?.overallScore ?? 0} />
          {radarData.labels.map((label, i) => (
            <ScoreCard
              key={label}
              label={label}
              score={radarData.values[i] ?? 0}
            />
          ))}
        </div>
      </section>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <section className="mb-12">
          <FeedbackPanel suggestions={recommendations} />
        </section>
      )}

      {/* Question Breakdown */}
      {review?.questions?.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-6">Question Breakdown</h2>
          <div className="space-y-4">
            {review.questions.map((q, idx) => (
              <div
                key={q.id}
                className="card flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-bold text-ink-500">
                      Q{idx + 1}
                    </span>
                    {q.score && <StatusChip status={getStatus(q.score)} />}
                  </div>
                  <p className="text-sm text-ink-700 line-clamp-1">
                    {q.content}
                  </p>
                  {q.transcript && (
                    <p className="text-xs text-ink-500 mt-1 line-clamp-1">
                      "{q.transcript}"
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xl font-extrabold text-ink-900">
                      {q.score ?? 'N/A'}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-ink-500 font-bold">
                      Score
                    </p>
                  </div>
                  {/* Retry button */}
                  <button
                    onClick={async () => {
                      try {
                        const result = await retryQuestion(sessionId, q.id);
                        // Save single question to sessionStorage and go to interview
                        sessionStorage.setItem('currentSessionId', sessionId);
                        sessionStorage.setItem(
                          'currentQuestions',
                          JSON.stringify([result.question])
                        );
                        navigate('/interview');
                      } catch (err) {
                        console.error('Retry failed:', err);
                      }
                    }}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    🔄 Retry
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Actions */}
      <section className="flex flex-wrap gap-4 justify-center">
        <button
          onClick={() => navigate('/setup')}
          className="btn-secondary px-8 flex items-center gap-2"
        >
          <RefreshIcon size={18} className="text-current" /> Practice Again
        </button>
        <button
          onClick={() => navigate('/history')}
          className="btn-primary px-8 flex items-center gap-2"
        >
          <SaveIcon size={18} className="text-current" /> View History
        </button>
      </section>
    </div>
  );
}
