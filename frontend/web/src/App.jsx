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

import AppLayout from './layouts/AppLayout';
import ImmersiveLayout from './layouts/ImmersiveLayout';
import ProtectedRoute from './components/ProtectedRoute';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
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
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* Protected light pages */}
      <Route element={<AppLayout />}>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <InterviewSetupPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/results"
          element={
            <ProtectedRoute>
              <PerformanceAnalysisPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <InterviewHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history/:id"
          element={
            <ProtectedRoute>
              <SessionReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/resources"
          element={
            <ProtectedRoute>
              <LearningResourcesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Protected dark immersive pages */}
      <Route element={<ImmersiveLayout />}>
        <Route
          path="/interview"
          element={
            <ProtectedRoute>
              <LiveInterviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/processing"
          element={
            <ProtectedRoute>
              <AIProcessingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/summary"
          element={
            <ProtectedRoute>
              <PracticeSummaryPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}
