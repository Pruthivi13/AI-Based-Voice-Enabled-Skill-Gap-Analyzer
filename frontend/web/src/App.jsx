/**
 * App.jsx — Root component & route definitions
 *
 * Routes map to the PRD Information Architecture (section 14):
 *   Home → Dashboard → Setup → Interview → Processing → Summary → Results
 *   History → Session Review
 *   Analytics, Resources, Settings
 *
 * Light pages use AppLayout; dark immersive pages use ImmersiveLayout.
 */
import React from 'react';
import { Routes, Route } from 'react-router-dom';

/* Layouts */
import AppLayout from './layouts/AppLayout';
import ImmersiveLayout from './layouts/ImmersiveLayout';

/* Pages */
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import InterviewSetupPage from './pages/InterviewSetupPage';
import LiveInterviewPage from './pages/LiveInterviewPage';
import AIProcessingPage from './pages/AIProcessingPage';
import PracticeSummaryPage from './pages/PracticeSummaryPage';
import PerformanceAnalysisPage from './pages/PerformanceAnalysisPage';
import InterviewHistoryPage from './pages/InterviewHistoryPage';
import SessionReviewPage from './pages/SessionReviewPage';
import AnalyticsPage from './pages/AnalyticsPage';
import LearningResourcesPage from './pages/LearningResourcesPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      {/* ── Light-mode pages wrapped in standard app shell ── */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/setup" element={<InterviewSetupPage />} />
        <Route path="/results" element={<PerformanceAnalysisPage />} />
        <Route path="/history" element={<InterviewHistoryPage />} />
        <Route path="/history/:id" element={<SessionReviewPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/resources" element={<LearningResourcesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* ── Dark immersive pages ── */}
      <Route element={<ImmersiveLayout />}>
        <Route path="/interview" element={<LiveInterviewPage />} />
        <Route path="/processing" element={<AIProcessingPage />} />
        <Route path="/summary" element={<PracticeSummaryPage />} />
      </Route>
    </Routes>
  );
}
