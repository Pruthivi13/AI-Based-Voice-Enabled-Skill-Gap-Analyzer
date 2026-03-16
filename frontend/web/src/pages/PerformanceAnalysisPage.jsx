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
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { mockPerformanceAnalysis } from '../data/mockData';
import RadarChart from '../components/RadarChart';
import ScoreCard from '../components/ScoreCard';
import FeedbackPanel from '../components/FeedbackPanel';
import StatusChip from '../components/StatusChip';

export default function PerformanceAnalysisPage() {
  const navigate = useNavigate();
  const data = mockPerformanceAnalysis; // TODO: Replace with real API call

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* ── Overall Score Hero ── */}
      <section className="text-center mb-12">
        <p className="section-header mb-2">Session Complete</p>
        <h1 className="mb-3">Performance Analysis</h1>
        <div className="inline-flex items-baseline gap-2 mb-2">
          <span className="text-6xl font-extrabold text-primary-500">{data.overallScore}</span>
          <span className="text-2xl text-ink-500 font-bold">/ 10</span>
        </div>
        <p className="text-ink-500">
          Overall Rating: <span className="font-bold text-ink-900">{data.ratingLabel}</span>
        </p>
      </section>

      {/* ── Radar Chart + Score Cards ── */}
      <section className="grid lg:grid-cols-2 gap-8 mb-12">
        {/* Radar chart */}
        <div className="card flex items-center justify-center p-8">
          <div className="w-full max-w-sm">
            <RadarChart labels={data.radarData.labels} values={data.radarData.values} />
          </div>
        </div>

        {/* Score Cards */}
        <div className="grid grid-cols-2 gap-4">
          <ScoreCard label="Communication" score={data.dimensions.communication} />
          <ScoreCard label="Confidence" score={data.dimensions.confidence} />
          <ScoreCard label="Technical Knowledge" score={data.dimensions.technicalKnowledge} />
          <ScoreCard label="Clarity" score={data.dimensions.clarity} />
          <ScoreCard label="Fluency" score={data.dimensions.fluency} />
          {/* Overall in card form */}
          <div className="card bg-primary-50 flex flex-col items-center justify-center">
            <p className="text-xs font-bold uppercase tracking-wider text-primary-600 mb-1">Overall</p>
            <p className="text-3xl font-extrabold text-primary-500">{data.overallScore}</p>
          </div>
        </div>
      </section>

      {/* ── AI Suggestions ── */}
      <section className="mb-12">
        <FeedbackPanel suggestions={data.aiSuggestions} />
      </section>

      {/* ── Question-by-Question Breakdown ── */}
      <section className="mb-12">
        <h2 className="mb-6">Question Breakdown</h2>
        <div className="space-y-4">
          {data.questionBreakdown.map((q) => (
            <div key={q.id} className="card flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-bold text-ink-500">Q{q.id}</span>
                  <StatusChip status={q.status} />
                  <span className="chip bg-surface-100 text-ink-700">{q.topic}</span>
                </div>
                <p className="text-sm text-ink-700 line-clamp-1">{q.question}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xl font-extrabold text-ink-900">{q.score}</p>
                <p className="text-[10px] uppercase tracking-wider text-ink-500 font-bold">Score</p>
              </div>
              <button
                onClick={() => navigate('/interview')}
                className="text-sm font-semibold text-primary-500 hover:text-primary-600 flex-shrink-0"
              >
                Retry
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Actions ── */}
      <section className="flex flex-wrap gap-4 justify-center">
        <button onClick={() => navigate('/setup')} className="btn-secondary px-8">
          🔄 Practice Again
        </button>
        <button
          onClick={() => {
            // TODO: Call save session API
            console.log('[Performance] Saving results...');
            navigate('/history');
          }}
          className="btn-primary px-8"
        >
          💾 Save & View History
        </button>
      </section>
    </div>
  );
}
