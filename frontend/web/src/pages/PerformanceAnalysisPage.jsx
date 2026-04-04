import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Position,
  Handle,
  BaseEdge,
  getSmoothStepPath,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import {
  fetchReport,
  fetchSessionReview,
  retryQuestion,
  generateRoadmap,
  saveRoadmap,
  getNodeInfo,
} from '../services/mockApi';
import RadarChart from '../components/RadarChart';
import ScoreCard from '../components/ScoreCard';
import FeedbackPanel from '../components/FeedbackPanel';
import StatusChip from '../components/StatusChip';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { useTheme } from '../context/ThemeContext';
import RoadmapSection from '../components/RoadmapSection';
// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PerformanceAnalysisPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const sessionId = sessionStorage.getItem('currentSessionId');

  const [report, setReport] = useState(null);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [roadmap, setRoadmap] = useState(null);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapError, setRoadmapError] = useState(null);
  const [roadmapRole, setRoadmapRole] = useState('');

  useEffect(() => {
    if (!sessionId) {
      navigate('/setup');
      return;
    }
    (async () => {
      try {
        const [r, rv] = await Promise.all([
          fetchReport(sessionId),
          fetchSessionReview(sessionId),
        ]);
        setReport(r);
        setReview(rv);
      } catch {
        setError('Failed to load results.');
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, navigate]);

  useEffect(() => {
    if (!report) return;
    (async () => {
      setRoadmapLoading(true);
      setRoadmapError(null);
      try {
        const questions = JSON.parse(
          sessionStorage.getItem('currentQuestions') || '[]'
        );
        const role =
          questions[0]?.role ||
          review?.session?.title?.replace(
            / (TECHNICAL|HR|MIXED|COMMUNICATION) Interview$/,
            ''
          ) ||
          'Professional';
        setRoadmapRole(role);
        const weaknesses = Array.isArray(report.weaknesses)
          ? report.weaknesses
          : [];
        const rd = report.radarData || { labels: [], values: [] };
        const lowAreas = rd.labels.filter((_, i) => (rd.values[i] ?? 10) < 7);
        const weakSkills = [...new Set([...weaknesses, ...lowAreas])].slice(
          0,
          5
        );
        const data = await generateRoadmap(role, weakSkills);
        setRoadmap(data);
        
        try {
          await saveRoadmap(sessionId, role, data.nodes, data.edges);
        } catch (err) {
          console.warn('Failed to save roadmap:', err);
        }
      } catch {
        setRoadmapError('Could not generate roadmap.');
      } finally {
        setRoadmapLoading(false);
      }
    })();
  }, [report, review]);

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
  const getStatus = (s) =>
    s >= 8
      ? 'excellent'
      : s >= 7
        ? 'good'
        : s >= 6
          ? 'borderline'
          : 'needs-improvement';

  // Stable roadmap ID for localStorage (role + session)
  const roadmapId = `${roadmapRole}-${sessionId}`
    .replace(/\s+/g, '-')
    .toLowerCase();

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
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

      <section className="grid lg:grid-cols-2 gap-8 mb-12">
        <div className="card flex items-center justify-center p-8">
          <div className="w-full max-w-sm">
            {radarData.labels.length > 0 ? (
              <RadarChart labels={radarData.labels} values={radarData.values} />
            ) : (
              <p className="text-ink-500 text-center">No radar data</p>
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

      {recommendations.length > 0 && (
        <section className="mb-12">
          <FeedbackPanel suggestions={recommendations} />
        </section>
      )}

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
                  <button
                    onClick={async () => {
                      try {
                        const r = await retryQuestion(sessionId, q.id);
                        sessionStorage.setItem('currentSessionId', sessionId);
                        sessionStorage.setItem(
                          'currentQuestions',
                          JSON.stringify([r.question])
                        );
                        navigate('/interview');
                      } catch (e) {
                        console.error('Retry failed:', e);
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

      <section className="mb-12">
        <div className="mb-4">
          <h2>Personalized Learning Roadmap</h2>
          <p
            className={`text-sm mt-1 ${isDark ? 'text-white/50' : 'text-ink-500'}`}
          >
            Click <strong>main nodes</strong> to focus a branch · click any
            other node for details & status
          </p>
        </div>

        {roadmapLoading && (
          <div className="card flex items-center justify-center p-16">
            <LoadingState message="Building your personalized learning roadmap..." />
          </div>
        )}

        {roadmapError && !roadmapLoading && (
          <div className="bg-red-950 border border-red-800 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
            <span>{roadmapError}</span>
            <button
              onClick={() => window.location.reload()}
              className="text-xs font-semibold underline ml-4"
            >
              Retry
            </button>
          </div>
        )}

        {!roadmapLoading && roadmap && (
          <RoadmapSection
            nodes={roadmap.nodes}
            edges={roadmap.edges}
            targetRole={roadmapRole}
            roadmapId={roadmapId}
          />
        )}
      </section>

      <section className="flex flex-wrap gap-4 justify-center">
        <button
          onClick={() => navigate('/setup')}
          className="btn-secondary px-8"
        >
          🔄 Practice Again
        </button>
        <button
          onClick={() => navigate('/history')}
          className="btn-primary px-8"
        >
          💾 View History
        </button>
      </section>
    </div>
  );
}
