// /**
//  * mockApi.js — Frontend service abstraction layer
//  *
//  * All methods return Promises wrapping mock data so that the
//  * integration pattern (async/await) is identical to real API
//  * calls. Backend teammates can later replace these with fetch()
//  * or axios calls to real endpoints.
//  *
//  * TODO: Replace every function body with real API integration
//  *       when backend endpoints are available.
//  */
// import {
//   mockQuestions,
//   mockPracticeSummary,
//   mockPerformanceAnalysis,
//   mockInterviewHistory,
//   mockSessionReview,
//   mockRecentSessions,
//   mockAnalytics,
//   mockResources,
//   mockProcessingStages,
// } from '../data/mockData';

// /** Simulates network latency */
// const delay = (ms = 800) => new Promise((r) => setTimeout(r, ms));

// /* ───────────────────────────────────────────────────────────
//    Interview Session
//    ─────────────────────────────────────────────────────────── */

// /**
//  * Creates a new interview session on the backend.
//  * @param {Object} setup — { role, experience, type, difficulty, questionCount, jobDescription }
//  * @returns {Promise<{ sessionId: string }>}
//  *
//  * TODO: POST /api/sessions with setup payload
//  */
// export async function createInterviewSession(setup) {
//   await delay(500);
//   console.log('[mockApi] createInterviewSession', setup);
//   return { sessionId: 'sess_' + Date.now() };
// }

// /**
//  * Fetches questions for the current session.
//  * TODO: GET /api/sessions/:id/questions
//  */
// export async function fetchQuestions(sessionId) {
//   await delay(600);
//   return mockQuestions;
// }

// /* ───────────────────────────────────────────────────────────
//    Audio / Transcript
//    ─────────────────────────────────────────────────────────── */

// /**
//  * Uploads recorded audio blob to backend for ASR processing.
//  * TODO: POST /api/sessions/:id/audio with multipart form data
//  */
// export async function uploadAudioPlaceholder(sessionId, questionId, audioBlob) {
//   await delay(1000);
//   console.log('[mockApi] uploadAudio', { sessionId, questionId });
//   return { success: true };
// }

// /**
//  * Fetches transcript after ASR completes.
//  * TODO: GET /api/sessions/:id/questions/:qid/transcript
//  */
// export async function fetchTranscriptPlaceholder(sessionId, questionId) {
//   await delay(800);
//   return {
//     transcript: mockPracticeSummary.transcript,
//   };
// }

// /* ───────────────────────────────────────────────────────────
//    Analysis Results
//    ─────────────────────────────────────────────────────────── */

// /**
//  * Fetches per-question practice summary.
//  * TODO: GET /api/sessions/:id/questions/:qid/summary
//  */
// export async function fetchPracticeSummary(sessionId, questionId) {
//   await delay(700);
//   return mockPracticeSummary;
// }

// /**
//  * Fetches full session performance analysis with radar data.
//  * TODO: GET /api/sessions/:id/analysis
//  */
// export async function fetchPerformanceAnalysis(sessionId) {
//   await delay(900);
//   return mockPerformanceAnalysis;
// }

// /* ───────────────────────────────────────────────────────────
//    History & Review
//    ─────────────────────────────────────────────────────────── */

// /**
//  * Fetches list of past interview sessions.
//  * TODO: GET /api/sessions?page=1&limit=10
//  */
// export async function fetchInterviewHistory() {
//   await delay(600);
//   return mockInterviewHistory;
// }

// /**
//  * Fetches detailed review for a specific session.
//  * TODO: GET /api/sessions/:id/review
//  */
// export async function fetchSessionReview(sessionId) {
//   await delay(700);
//   return mockSessionReview;
// }

// /* ───────────────────────────────────────────────────────────
//    Dashboard
//    ─────────────────────────────────────────────────────────── */

// /**
//  * Fetches dashboard summary data.
//  * TODO: GET /api/dashboard
//  */
// export async function fetchDashboardData() {
//   await delay(500);
//   return {
//     recentSessions: mockRecentSessions,
//     analytics: mockAnalytics,
//   };
// }

// /* ───────────────────────────────────────────────────────────
//    Analytics
//    ─────────────────────────────────────────────────────────── */

// /**
//  * Fetches analytics & insights data.
//  * TODO: GET /api/analytics
//  */
// export async function fetchAnalytics() {
//   await delay(600);
//   return mockAnalytics;
// }

// /* ───────────────────────────────────────────────────────────
//    Learning Resources
//    ─────────────────────────────────────────────────────────── */

// /**
//  * Fetches recommended learning resources.
//  * TODO: GET /api/resources
//  */
// export async function fetchResources() {
//   await delay(500);
//   return mockResources;
// }

// /* ───────────────────────────────────────────────────────────
//    Processing Status
//    ─────────────────────────────────────────────────────────── */

// /**
//  * Polls current processing stage.
//  * TODO: GET /api/sessions/:id/processing-status or use WebSocket
//  */
// export async function fetchProcessingStatus(sessionId) {
//   await delay(300);
//   return mockProcessingStages;
// }

//update
import { auth } from '../config/firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const getToken = async () => {
  if (auth.currentUser) {
    return auth.currentUser.getIdToken();
  }
  return null;
};

const request = async (method, path, body = null) => {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const response = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    ...(body && { body: JSON.stringify(body) }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
};

const requestFormData = async (method, path, formData) => {
  const token = await getToken();
  const headers = {
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const response = await fetch(`${API_URL}/api${path}`, {
    method,
    headers,
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('API Error:', data);
    throw new Error(data.message || 'Request failed');
  }
  return data;
};

// ── Auth ──
export const getCurrentUser = () => request('GET', '/users/me');
export const updateCurrentUser = (data) => request('PUT', '/users/me', data);

// ── Sessions ──
export const createInterviewSession = (payload) => request('POST', '/sessions', payload);

export const fetchInterviewHistory = (page = 1, limit = 10) =>
  request('GET', `/sessions?page=${page}&limit=${limit}`);

export const fetchSessionById = (id) => request('GET', `/sessions/${id}`);

export const fetchQuestions = (sessionId) =>
  request('GET', `/sessions/${sessionId}/questions`);

export const finishSession = (sessionId) =>
  request('POST', `/sessions/${sessionId}/finish`);

// ── Uploads ──
export const uploadAudioPlaceholder = async (
  sessionId,
  questionId,
  audioBlob,
  answerOrder = 1,
  durationSeconds
) => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'answer.webm');
  formData.append('answerOrder', answerOrder.toString());
  if (durationSeconds)
    formData.append('durationSeconds', durationSeconds.toString());
  return requestFormData(
    'POST',
    `/sessions/${sessionId}/questions/${questionId}/audio`,
    formData
  );
};

export const fetchTranscriptPlaceholder = (sessionId, questionId) =>
  request('GET', `/sessions/${sessionId}/questions/${questionId}/transcript`);

// ── Analysis ──
export const fetchPracticeSummary = (sessionId, questionId) =>
  request('GET', `/sessions/${sessionId}/questions/${questionId}/summary`);

export const fetchPerformanceAnalysis = (sessionId) =>
  request('GET', `/sessions/${sessionId}/analysis`);

export const fetchProcessingStatus = (sessionId) =>
  request('GET', `/sessions/${sessionId}/processing-status`);

export const generateAnalysis = (sessionId) =>
  request('POST', `/sessions/${sessionId}/generate-analysis`);

// ── Reports ──
export const fetchReport = (sessionId) =>
  request('GET', `/sessions/${sessionId}/report`);

// ── Session Review ──
export const fetchSessionReview = (sessionId) =>
  request('GET', `/sessions/${sessionId}/review`);

// ── Dashboard ──
export const fetchDashboardData = () => request('GET', '/dashboard');

// ── Analytics ──
export const fetchAnalytics = () => request('GET', '/analytics');

// ── Resources ──
export const fetchResources = () => request('GET', '/resources');

// ── Settings ──
export const fetchSettings = () => request('GET', '/settings');
export const updateSettings = (data) => request('PUT', '/settings', data);
