import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createInterviewSession, createSessionWithResume, resumeSession } from '../services/api';

const QUICK_ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'Data Scientist',
  'Product Manager',
  'DevOps Engineer',
  'Nurse',
  'iOS Developer',
  'Cybersecurity Analyst',
  'Game Designer',
  'Marketing Manager',
];

const experienceLevels = [
  'Entry Level',
  'Junior (1-2 yrs)',
  'Mid (3-5 yrs)',
  'Senior (5+ yrs)',
];
const experienceMap = {
  'Entry Level': 'STUDENT',
  'Junior (1-2 yrs)': 'JUNIOR',
  'Mid (3-5 yrs)': 'MID',
  'Senior (5+ yrs)': 'SENIOR',
};
const interviewTypes = ['Technical', 'Behavioral', 'Mixed', 'Communication'];
const interviewTypeMap = {
  Technical: 'TECHNICAL',
  Behavioral: 'HR',
  Mixed: 'MIXED',
  Communication: 'COMMUNICATION',
};
const difficulties = ['Easy', 'Medium', 'Hard'];
const difficultyMap = {
  Easy: 'EASY',
  Medium: 'MEDIUM',
  Hard: 'HARD',
};
const questionCounts = [3, 5, 7, 10];

export default function InterviewSetupPage() {
  const navigate = useNavigate();

  const [role, setRole] = useState('');
  const [experience, setExperience] = useState('Entry Level');
  const [type, setType] = useState('Technical');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState('Medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resumeFile, setResumeFile] = useState(null);
  const [useResume, setUseResume] = useState(false);
  const [pausedSession, setPausedSession] = useState(null);
  const [warmupEnabled, setWarmupEnabled] = useState(true);

  useEffect(() => {
    // Check for a paused session in this browser
    const savedId = sessionStorage.getItem('currentSessionId');
    const savedIndex = sessionStorage.getItem('resumeFromIndex');
    const savedQuestions = sessionStorage.getItem('currentQuestions');
    if (savedId && savedIndex && savedQuestions) {
      const questions = JSON.parse(savedQuestions);
      const idx = Number(savedIndex);
      if (idx > 0 && idx < questions.length) {
        setPausedSession({ id: savedId, resumeIndex: idx, total: questions.length });
      }
    }
  }, []);

  // Pre-fill role when navigating from the RoleProgressWidget "Practice again" button
  useEffect(() => {
    const prefill = sessionStorage.getItem('prefill_role');
    if (prefill) {
      setRole(prefill);
      sessionStorage.removeItem('prefill_role');
    }
  }, []);

  const handleResume = async () => {
    try {
      setLoading(true);
      const data = await resumeSession(pausedSession.id);
      sessionStorage.setItem('currentSessionId', data.sessionId);
      sessionStorage.setItem('currentQuestions', JSON.stringify(data.questions));
      // resumeFromIndex is already in sessionStorage from before
      navigate('/interview');
    } catch (err) {
      setError('Could not resume session. It may have expired.');
      setPausedSession(null);
      sessionStorage.removeItem('resumeFromIndex');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!role.trim()) {
      setError('Please enter a target role.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      let result;

      if (useResume && resumeFile) {
        // Resume-based session
        const formData = new FormData();
        formData.append('resume', resumeFile);
        formData.append('interviewType', interviewTypeMap[type]);
        formData.append('targetRole', role.trim());
        formData.append('difficulty', difficultyMap[difficulty]);
        formData.append('experienceLevel', experienceMap[experience]);
        formData.append('questionCount', String(questionCount));
        result = await createSessionWithResume(formData);
      } else {
        // Regular AI session
        result = await createInterviewSession({
          interviewType: interviewTypeMap[type],
          targetRole: role.trim(),
          difficulty: difficultyMap[difficulty],
          experienceLevel: experienceMap[experience],
          questionCount: Number(questionCount),
        });
      }

      sessionStorage.setItem('currentSessionId', result.sessionId);
      sessionStorage.setItem('currentQuestions', JSON.stringify(result.questions));
      if (warmupEnabled) {
        navigate('/warmup');
      } else {
        navigate('/interview');
      }
    } catch (err) {
      setError('Failed to create session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="mb-2">Interview Setup</h1>
      <p className="text-ink-500 mb-10">
        Type any role and our AI will generate questions specific to it.
      </p>

      {/* ── Resume paused session banner ── */}
      {pausedSession && (
        <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/5 p-5
                        flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-1">
              ⏸ You have a paused session
            </p>
            <p className="text-xs text-white/60">
              Answered {pausedSession.resumeIndex} of {pausedSession.total} questions.
              Pick up where you left off.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleResume}
              disabled={loading}
              className="btn-primary text-sm py-2 px-5 disabled:opacity-50"
            >
              ▶ Resume
            </button>
            <button
              onClick={() => {
                setPausedSession(null);
                sessionStorage.removeItem('resumeFromIndex');
                sessionStorage.removeItem('currentSessionId');
                sessionStorage.removeItem('currentQuestions');
                sessionStorage.removeItem('skippedQuestions');
              }}
              className="text-xs text-white/40 hover:text-white/70 px-3 py-2 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="card space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {/* Role — free text input */}
        <div>
          <label className="section-header">Target Role</label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Nurse, Data Scientist, iOS Developer..."
            className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-100 border border-surface-200 text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {/* Quick role suggestions */}
          <div className="flex flex-wrap gap-2 mt-3">
            {QUICK_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  role === r
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'border-surface-200 text-ink-500 hover:border-primary-300 hover:text-primary-500'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Experience Level */}
        <div>
          <label className="section-header">Experience Level</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {experienceLevels.map((lvl) => (
              <button
                key={lvl}
                onClick={() => setExperience(lvl)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                  experience === lvl
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-white text-ink-700 border-surface-200 hover:border-primary-300'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Interview Type */}
        <div>
          <label className="section-header">Interview Type</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {interviewTypes.map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                  type === t
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-white text-ink-700 border-surface-200 hover:border-primary-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Question Count & Difficulty */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="section-header">Questions</label>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-100 border border-surface-200 text-ink-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {questionCounts.map((n) => (
                <option key={n} value={n}>
                  {n} questions
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="section-header">Difficulty</label>
            <div className="flex gap-2 mt-2">
              {difficulties.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    difficulty === d
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'bg-white text-ink-700 border-surface-200 hover:border-primary-300'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Warmup Mode Toggle ── */}
        <div className={`rounded-xl border p-4 transition-all ${
          warmupEnabled
            ? 'border-purple-400/30 bg-purple-500/5'
            : 'border-surface-200'
        }`}>
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                warmupEnabled
                  ? 'bg-purple-500/15 border border-purple-500/30'
                  : 'bg-surface-100 border border-surface-200'
              }`}>
                <span className="text-xl">🧘</span>
              </div>
              <div>
                <p className="font-semibold text-sm text-ink-900 flex items-center gap-2">
                  Warmup Mode
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">
                    Recommended
                  </span>
                </p>
                <p className="text-xs text-ink-500 mt-0.5">
                  2-min breathing + mic check before the real session
                </p>
              </div>
            </div>
            <div
              className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ml-4 flex-shrink-0 ${
                warmupEnabled ? 'bg-purple-500' : 'bg-surface-200'
              }`}
              onClick={() => setWarmupEnabled(!warmupEnabled)}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                warmupEnabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </div>
          </label>

          {warmupEnabled && (
            <div className="mt-3 pt-3 border-t border-purple-400/15 grid grid-cols-3 gap-2">
              {[
                { emoji: '🫁', label: 'Breathing', desc: '~22s guided' },
                { emoji: '🎙️', label: 'Mic Check',  desc: 'Voice warm-up' },
                { emoji: '✅', label: 'Ready',      desc: 'Confidence boost' },
              ].map(({ emoji, label, desc }) => (
                <div key={label} className="text-center">
                  <span className="text-base">{emoji}</span>
                  <p className="text-[10px] font-bold text-purple-600 mt-0.5">{label}</p>
                  <p className="text-[9px] text-ink-500">{desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Notice */}
        <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 text-sm text-primary-700">
          🤖 Questions will be generated by AI specifically for{' '}
          <strong>{role || 'your role'}</strong> — no generic questions.
        </div>

        {/* Resume Upload Toggle */}
        <div className={`rounded-xl border p-4 transition-all ${
          useResume ? 'border-primary-300 bg-primary-50' : 'border-surface-200'
        }`}>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="font-semibold text-sm text-ink-900">
                📄 Upload Resume for Personalized Questions
              </p>
              <p className="text-xs text-ink-500 mt-0.5">
                AI will read your resume and ask questions about your actual experience
              </p>
            </div>
            <div
              className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ml-4 flex-shrink-0 ${
                useResume ? 'bg-primary-500' : 'bg-surface-200'
              }`}
              onClick={() => setUseResume(!useResume)}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                useResume ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </div>
          </label>

          {useResume && (
            <div className="mt-4">
              <div
                className={`p-4 border-2 border-dashed rounded-xl text-center transition-colors ${
                  resumeFile
                    ? 'border-primary-300 bg-primary-50'
                    : 'border-surface-200 hover:border-primary-300'
                }`}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="resume-upload"
                />
                <label htmlFor="resume-upload" className="cursor-pointer">
                  {resumeFile ? (
                    <div>
                      <p className="text-primary-600 font-semibold text-sm">
                        ✅ {resumeFile.name}
                      </p>
                      <p className="text-xs text-ink-500 mt-1">
                        Click to change
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-ink-500 text-sm mb-1">
                        Click to upload your resume
                      </p>
                      <p className="text-xs text-ink-500">PDF only, max 5MB</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={loading || !role.trim()}
          className="btn-primary w-full text-lg py-4 disabled:opacity-50"
        >
          {loading ? '🤖 Generating questions...' : '🎯 Start Interview'}
        </button>
      </div>
    </div>
  );
}
