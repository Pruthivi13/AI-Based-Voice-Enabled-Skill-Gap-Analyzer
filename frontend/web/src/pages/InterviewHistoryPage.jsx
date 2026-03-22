/**
 * InterviewHistoryPage.jsx — Past session list
 *
 * Maps to PRD §9.22 and UI Reference §17.7 (Interview History).
 * Features:
 *   • Search/filter bar
 *   • Filter tabs (All, Technical, Behavioral)
 *   • Session cards with score, date, role, duration, summary
 *   • View Detailed Analysis / Replay / Delete actions
 *
 * TODO: Replace mock data with fetchInterviewHistory()
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchInterviewHistory } from '../services/mockApi';
import HistoryCard from '../components/HistoryCard';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import { useTheme } from '../context/ThemeContext';

const filterTabs = ['All', 'TECHNICAL', 'HR', 'COMMUNICATION', 'MIXED'];

export default function InterviewHistoryPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');

  useEffect(() => {
    fetchInterviewHistory()
      .then((data) => setSessions(data.items || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filteredSessions =
    activeFilter === 'All'
      ? sessions
      : sessions.filter((s) => s.interviewType === activeFilter);

  if (loading) return <LoadingState message="Loading history..." />;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-primary-500">Interview History</h1>
          <p className={`mt-1 ${isDark ? 'text-white/50' : 'text-ink-500'}`}>
            Track your progress and review feedback from your sessions.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeFilter === tab
                  ? 'bg-primary-500 text-white'
                  : isDark
                    ? 'text-white/60 hover:bg-white/10'
                    : 'text-ink-700 hover:bg-surface-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {filteredSessions.length > 0 ? (
        <div className="space-y-6">
          {filteredSessions.map((session) => (
            <div key={session.id} className="card hover-lift">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3
                      className={`font-bold ${isDark ? 'text-white' : 'text-ink-900'}`}
                    >
                      {session.title}
                    </h3>
                    <span
                      className={`chip ${
                        session.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {session.status}
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-3 text-xs mb-2 ${isDark ? 'text-white/50' : 'text-ink-500'}`}
                  >
                    <span>
                      📅 {new Date(session.startedAt).toLocaleDateString()}
                    </span>
                    <span>🎯 {session.targetRole}</span>
                    <span>📊 {session.difficulty}</span>
                    <span>❓ {session.questionCount} questions</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-2xl font-extrabold text-primary-500">
                    {session.overallScore ?? 'N/A'}
                  </span>
                  <p
                    className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? 'text-white/40' : 'text-ink-500'}`}
                  >
                    Score
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => {
                    sessionStorage.setItem('currentSessionId', session.id);
                    navigate(`/history/${session.id}`);
                  }}
                  className="btn-primary text-sm py-2 px-5"
                >
                  📊 View Analysis
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="📭"
          title="No sessions found"
          message="No interview sessions yet. Start your first practice!"
          action={{
            label: 'Start Practice',
            onClick: () => navigate('/setup'),
          }}
        />
      )}
    </div>
  );
}
