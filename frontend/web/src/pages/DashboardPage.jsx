// /**
//  * DashboardPage.jsx — User's main control center
//  *
//  * Maps to PRD §9.21 and UI Reference §17.2 (Dashboard.png).
//  * Features:
//  *   • Welcome panel
//  *   • Three main feature cards (Practice, Learning, Analytics)
//  *   • Recent sessions list
//  *   • Upgrade/Pro placeholder card
//  *
//  * TODO: Connect to fetchDashboardData() when backend is ready
//  */
// import React from 'react';
// import { useNavigate } from 'react-router-dom';
// import { mockRecentSessions } from '../data/mockData';
// import { useTheme } from '../context/ThemeContext';

// export default function DashboardPage() {
//   const navigate = useNavigate();
//   const { isDark } = useTheme();

//   // TODO: Replace with real API call — fetchDashboardData()
//   const recentSessions = mockRecentSessions;

//   return (
//     <div className="max-w-6xl mx-auto px-6 py-10">
//       {/* ── Welcome ── */}
//       <div className="mb-10">
//         <h1>Dashboard</h1>
//         <p className={`mt-1 ${isDark ? 'text-white/50' : 'text-ink-500'}`}>Welcome back, Alex! Ready to ace your next interview?</p>
//       </div>

//       {/* ── Main Feature Cards ── */}
//       {/* Maps to PRD dashboard quick actions */}
//       <div className="grid md:grid-cols-3 gap-6 mb-10">
//         {/* Practice Interview */}
//         <div className="card hover-lift flex flex-col">
//           <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center
//                           text-2xl mb-6">
//             🎙️
//           </div>
//           <h3 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-ink-900'}`}>Practice Interview</h3>
//           <p className={`text-sm flex-1 mb-4 ${isDark ? 'text-white/60' : 'text-ink-500'}`}>
//             Practice answering AI-generated interview questions tailored to your target roles
//             and experience level.
//           </p>
//           <button onClick={() => navigate('/setup')} className="btn-primary w-full">
//             Start Practice →
//           </button>
//         </div>

//         {/* Explore Learning */}
//         <div className="card hover-lift flex flex-col">
//           <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center
//                           text-2xl mb-6">
//             📖
//           </div>
//           <h3 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-ink-900'}`}>Explore Learning</h3>
//           <p className={`text-sm flex-1 mb-4 ${isDark ? 'text-white/60' : 'text-ink-500'}`}>
//             Explore interview preparation materials, industry guides, and expert tips to
//             sharpen your communication skills.
//           </p>
//           <button onClick={() => navigate('/resources')} className="btn-primary w-full">
//             Explore 🔍
//           </button>
//         </div>

//         {/* Performance Analytics */}
//         <div className="card hover-lift flex flex-col">
//           <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center
//                           text-2xl mb-6">
//             📊
//           </div>
//           <h3 className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-ink-900'}`}>Performance Analytics</h3>
//           <p className={`text-sm flex-1 mb-4 ${isDark ? 'text-white/60' : 'text-ink-500'}`}>
//             View your previous interview results, feedback scores, and track your progress
//             over time with detailed insights.
//           </p>
//           <button onClick={() => navigate('/analytics')} className="btn-primary w-full">
//             View Results 📈
//           </button>
//         </div>
//       </div>

//       {/* ── Bottom Row: Recent Sessions + Upgrade ── */}
//       <div className="grid md:grid-cols-5 gap-6">
//         {/* Recent Sessions */}
//         <div className="md:col-span-3 card">
//           <div className="flex items-center justify-between mb-4">
//             <h3 className={`font-bold ${isDark ? 'text-white' : 'text-ink-900'}`}>Recent Sessions</h3>
//             <button
//               onClick={() => navigate('/history')}
//               className="text-sm font-semibold text-primary-500 hover:text-primary-600"
//             >
//               View All
//             </button>
//           </div>

//           <div className="space-y-4">
//             {recentSessions.map((s) => (
//               <div key={s.id} className={`flex items-center gap-4 py-3 border-b last:border-0 ${
//                 isDark ? 'border-white/10' : 'border-surface-200/60'
//               }`}>
//                 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
//                   s.score >= 80
//                     ? isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-600'
//                     : isDark ? 'bg-amber-900/40 text-amber-400' : 'bg-amber-100 text-amber-600'
//                 }`}>
//                   {s.score >= 80 ? '✓' : '◎'}
//                 </div>
//                 <div className="flex-1 min-w-0">
//                   <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-ink-900'}`}>{s.title}</p>
//                   <p className={`text-xs ${isDark ? 'text-white/40' : 'text-ink-500'}`}>{s.date} • {s.duration}</p>
//                 </div>
//                 <div className="text-right">
//                   <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-ink-900'}`}>{s.score}%</p>
//                   <p className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? 'text-white/40' : 'text-ink-500'}`}>Score</p>
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>

//         {/* Upgrade Placeholder */}
//         <div className={`md:col-span-2 rounded-2xl p-6 flex flex-col justify-center ${
//           isDark
//             ? 'gradient-dark text-white'
//             : 'bg-gradient-to-br from-primary-50 via-white to-amber-50 border border-primary-100'
//         }`}>
//           <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-ink-900'}`}>Upgrade to Pro</h3>
//           <p className={`text-sm mb-6 leading-relaxed ${isDark ? 'text-white/70' : 'text-ink-500'}`}>
//             Get unlimited AI interviews, personalized coaching insights, and industry-specific
//             question banks.
//           </p>
//           <button className={`w-fit ${isDark ? 'btn-glass' : 'btn-primary'}`}>View Pricing</button>
//         </div>
//       </div>
//     </div>
//   );
// }

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchDashboardData } from '../services/mockApi';
import { useTheme } from '../context/ThemeContext';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';

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
          <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center text-2xl mb-6">
            🎙️
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
          <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center text-2xl mb-6">
            📖
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
          <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center text-2xl mb-6">
            📊
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
