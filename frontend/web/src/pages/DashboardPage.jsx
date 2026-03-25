

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchDashboardData } from '../services/mockApi';
import { useTheme } from '../context/ThemeContext';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import TargetIcon from '../components/ui/target-icon';
import BookIcon from '../components/ui/book-icon';
import ChartBarIcon from '../components/ui/chart-bar-icon';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData()
      .then(setData)
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Loading dashboard..." />;
  if (error)
    return (
      <ErrorState
        title="Error"
        message={error}
        onRetry={() => window.location.reload()}
      />
    );

  const recentSessions = data?.recentSessions || [];
  const analytics = data?.analytics || {};

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* ── Welcome ── */}
      <div className="mb-10">
        <h1>Dashboard</h1>
        <p className={`mt-1 ${isDark ? 'text-white/50' : 'text-ink-500'}`}>
          Welcome back! Ready to ace your next interview?
        </p>
      </div>

      {/* ── Main Feature Cards ── */}
      <div className="grid md:grid-cols-3 gap-6 mb-10">
        <div className="card hover-lift flex flex-col">
          <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center text-primary-500 mb-6">
            <TargetIcon size={32} className="text-current" />
          </div>
          <h3
            className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-ink-900'}`}
          >
            Practice Interview
          </h3>
          <p
            className={`text-sm flex-1 mb-4 ${isDark ? 'text-white/60' : 'text-ink-500'}`}
          >
            Practice answering AI-generated interview questions tailored to your
            target roles.
          </p>
          <button
            onClick={() => navigate('/setup')}
            className="btn-primary w-full"
          >
            Start Practice →
          </button>
        </div>

        <div className="card hover-lift flex flex-col">
          <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center text-primary-500 mb-6">
            <BookIcon size={32} className="text-current" />
          </div>
          <h3
            className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-ink-900'}`}
          >
            Explore Learning
          </h3>
          <p
            className={`text-sm flex-1 mb-4 ${isDark ? 'text-white/60' : 'text-ink-500'}`}
          >
            Explore interview preparation materials and expert tips.
          </p>
          <button
            onClick={() => navigate('/resources')}
            className="btn-primary w-full"
          >
            Explore 🔍
          </button>
        </div>

        <div className="card hover-lift flex flex-col">
          <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center text-primary-500 mb-6">
            <ChartBarIcon size={32} className="text-current" />
          </div>
          <h3
            className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-ink-900'}`}
          >
            Performance Analytics
          </h3>
          <p
            className={`text-sm flex-1 mb-4 ${isDark ? 'text-white/60' : 'text-ink-500'}`}
          >
            View your results and track your progress over time.
          </p>
          <button
            onClick={() => navigate('/analytics')}
            className="btn-primary w-full"
          >
            View Results 📈
          </button>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid md:grid-cols-5 gap-6">
        {/* Recent Sessions */}
        <div className="md:col-span-3 card">
          <div className="flex items-center justify-between mb-4">
            <h3
              className={`font-bold ${isDark ? 'text-white' : 'text-ink-900'}`}
            >
              Recent Sessions
            </h3>
            <button
              onClick={() => navigate('/history')}
              className="text-sm font-semibold text-primary-500 hover:text-primary-600"
            >
              View All
            </button>
          </div>

          {recentSessions.length === 0 ? (
            <p
              className={`text-sm ${isDark ? 'text-white/40' : 'text-ink-500'}`}
            >
              No sessions yet. Start your first practice interview!
            </p>
          ) : (
            <div className="space-y-4">
              {recentSessions.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-4 py-3 border-b last:border-0 ${isDark ? 'border-white/10' : 'border-surface-200/60'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                      s.score >= 7
                        ? isDark
                          ? 'bg-green-900/40 text-green-400'
                          : 'bg-green-100 text-green-600'
                        : isDark
                          ? 'bg-amber-900/40 text-amber-400'
                          : 'bg-amber-100 text-amber-600'
                    }`}
                  >
                    {s.score >= 7 ? '✓' : '◎'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-ink-900'}`}
                    >
                      {s.title}
                    </p>
                    <p
                      className={`text-xs ${isDark ? 'text-white/40' : 'text-ink-500'}`}
                    >
                      {new Date(s.date).toLocaleDateString()} • {s.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-bold ${isDark ? 'text-white' : 'text-ink-900'}`}
                    >
                      {s.score ? `${s.score}/10` : 'N/A'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats Card */}
        <div
          className={`md:col-span-2 rounded-2xl p-6 flex flex-col justify-center ${
            isDark
              ? 'gradient-dark text-white'
              : 'bg-gradient-to-br from-primary-50 via-white to-amber-50 border border-primary-100'
          }`}
        >
          <h3
            className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-ink-900'}`}
          >
            Your Stats
          </h3>
          <div className="space-y-3">
            <div>
              <p
                className={`text-xs uppercase tracking-wider font-bold ${isDark ? 'text-white/40' : 'text-ink-500'}`}
              >
                Total Sessions
              </p>
              <p
                className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-ink-900'}`}
              >
                {analytics.totalSessions || 0}
              </p>
            </div>
            <div>
              <p
                className={`text-xs uppercase tracking-wider font-bold ${isDark ? 'text-white/40' : 'text-ink-500'}`}
              >
                Average Score
              </p>
              <p className={`text-2xl font-extrabold text-primary-500`}>
                {analytics.averageScore || 0}/10
              </p>
            </div>
            <div>
              <p
                className={`text-xs uppercase tracking-wider font-bold ${isDark ? 'text-white/40' : 'text-ink-500'}`}
              >
                Focus Area
              </p>
              <p
                className={`text-sm font-semibold ${isDark ? 'text-white/80' : 'text-ink-900'}`}
              >
                {analytics.focusArea || 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
