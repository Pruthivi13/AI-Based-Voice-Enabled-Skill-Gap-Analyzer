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
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockInterviewHistory } from '../data/mockData';
import HistoryCard from '../components/HistoryCard';
import EmptyState from '../components/EmptyState';
import { useTheme } from '../context/ThemeContext';

const filterTabs = ['All', 'Technical', 'Behavioral'];

export default function InterviewHistoryPage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('All');
  const { isDark } = useTheme();

  // TODO: Replace with real API call
  const sessions = mockInterviewHistory;

  const filteredSessions = activeFilter === 'All'
    ? sessions
    : sessions.filter((s) =>
        s.category.toLowerCase().includes(activeFilter.toLowerCase())
      );

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-primary-500">Interview History</h1>
          <p className={`mt-1 ${isDark ? 'text-white/50' : 'text-ink-500'}`}>
            Track your progress and review detailed feedback from your AI-led sessions.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
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

      {/* Session List */}
      {filteredSessions.length > 0 ? (
        <div className="space-y-6">
          {filteredSessions.map((session) => (
            <HistoryCard
              key={session.id}
              session={session}
              onView={() => navigate(`/history/${session.id}`)}
            />
          ))}

          {/* Load more placeholder */}
          <div className="text-center pt-4">
            <button className="btn-secondary text-sm">
              Load More History ↓
            </button>
          </div>
        </div>
      ) : (
        <EmptyState
          icon="📭"
          title="No sessions found"
          message="No interview sessions match the selected filter. Try a different category or start a new practice session."
          action={{ label: 'Start Practice', onClick: () => navigate('/setup') }}
        />
      )}
    </div>
  );
}
