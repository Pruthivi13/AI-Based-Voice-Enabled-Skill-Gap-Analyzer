/**
 * api.js — Frontend API client
 *
 * All methods call real backend endpoints at VITE_API_URL.
 * Firebase ID token is automatically attached to every authenticated request.
 */
import { auth } from '../config/firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/** Retrieves the current Firebase ID token, or null if not signed in */
const getToken = async () => {
  if (auth.currentUser) {
    return auth.currentUser.getIdToken();
  }
  return null;
};

/** Generic JSON request helper */
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

/** Multipart form-data request helper (for audio/file uploads) */
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

// ── Auth / User ──────────────────────────────────────────────────────────────
export const getCurrentUser = () => request('GET', '/users/me');
export const updateCurrentUser = (data) => request('PUT', '/users/me', data);

// ── Sessions ─────────────────────────────────────────────────────────────────
export const createInterviewSession = (payload) =>
  request('POST', '/sessions', payload);

export const createSessionWithResume = async (formData) => {
  const token = await getToken();
  const response = await fetch(`${API_URL}/api/sessions/with-resume`, {
    method: 'POST',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: formData, // FormData — do not set Content-Type manually
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
};

export const fetchInterviewHistory = (page = 1, limit = 10) =>
  request('GET', `/sessions?page=${page}&limit=${limit}`);

export const fetchSessionById = (id) => request('GET', `/sessions/${id}`);

export const fetchQuestions = (sessionId) =>
  request('GET', `/sessions/${sessionId}/questions`);

export const finishSession = (sessionId) =>
  request('POST', `/sessions/${sessionId}/finish`);

export const pauseSession = (sessionId) =>
  request('POST', `/sessions/${sessionId}/pause`);

export const resumeSession = (sessionId) =>
  request('POST', `/sessions/${sessionId}/resume`);

// ── Uploads ──────────────────────────────────────────────────────────────────
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

// ── Analysis ─────────────────────────────────────────────────────────────────
export const fetchPracticeSummary = (sessionId, questionId) =>
  request('GET', `/sessions/${sessionId}/questions/${questionId}/summary`);

export const fetchPerformanceAnalysis = (sessionId) =>
  request('GET', `/sessions/${sessionId}/analysis`);

export const fetchProcessingStatus = (sessionId) =>
  request('GET', `/sessions/${sessionId}/processing-status`);

export const generateAnalysis = (sessionId) =>
  request('POST', `/sessions/${sessionId}/generate-analysis`);

// ── Reports ──────────────────────────────────────────────────────────────────
export const fetchReport = (sessionId) =>
  request('GET', `/sessions/${sessionId}/report`);

// ── Session Review ────────────────────────────────────────────────────────────
export const fetchSessionReview = (sessionId) =>
  request('GET', `/sessions/${sessionId}/review`);

// ── Dashboard ────────────────────────────────────────────────────────────────
export const fetchDashboardData = () => request('GET', '/dashboard');

// ── Analytics ────────────────────────────────────────────────────────────────
export const fetchAnalytics = () => request('GET', '/analytics');

// ── Learning Resources ────────────────────────────────────────────────────────
export const fetchResources = () => request('GET', '/resources');

// ── Settings ─────────────────────────────────────────────────────────────────
export const fetchSettings = () => request('GET', '/settings');
export const updateSettings = (data) => request('PUT', '/settings', data);

// ── Retry ────────────────────────────────────────────────────────────────────
export const retryQuestion = (sessionId, questionId) =>
  request('POST', `/sessions/${sessionId}/questions/${questionId}/retry`);

export const saveTranscript = (
  sessionId,
  questionId,
  transcript,
  answerOrder,
  durationSeconds
) =>
  request('POST', `/sessions/${sessionId}/questions/${questionId}/transcript`, {
    transcript,
    answerOrder,
    durationSeconds,
  });
