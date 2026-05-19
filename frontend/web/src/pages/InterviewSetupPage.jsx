import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createInterviewSession, createSessionWithResume, resumeSession } from '../services/api';
import {
  Activity, Wind, Mic, CheckCircle2, Bot, FileText, Target, Pause, Play, Loader2,
  Search, User, BarChart2, Code, MessageCircle, Shuffle, Sparkles, MessageSquare
} from 'lucide-react';

const QUICK_ROLES = [
  'Frontend Developer', 'Backend Developer', 'Data Scientist', 'Product Manager', 'DevOps Engineer',
  'Nurse', 'iOS Developer', 'Cybersecurity Analyst', 'Game Designer', 'Marketing Manager',
];

const experienceLevels = [
  { label: 'Entry Level', years: '0 - 1 yr', value: 'Entry Level' },
  { label: 'Junior', years: '1 - 2 yrs', value: 'Junior' },
  { label: 'Mid', years: '3 - 5 yrs', value: 'Mid' },
  { label: 'Senior', years: '5+ yrs', value: 'Senior' }
];
const experienceMap = {
  'Entry Level': 'STUDENT',
  'Junior': 'JUNIOR',
  'Mid': 'MID',
  'Senior': 'SENIOR',
};

const interviewTypes = [
  { label: 'Technical', value: 'Technical', icon: Code },
  { label: 'Behavioral', value: 'Behavioral', icon: User },
  { label: 'Mixed', value: 'Mixed', icon: Shuffle },
  { label: 'Communication', value: 'Communication', icon: MessageCircle }
];
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
      sessionStorage.setItem('resumeFromIndex', String(data.resumeFromIndex));
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
        const formData = new FormData();
        formData.append('resume', resumeFile);
        formData.append('interviewType', interviewTypeMap[type]);
        formData.append('targetRole', role.trim());
        formData.append('difficulty', difficultyMap[difficulty]);
        formData.append('experienceLevel', experienceMap[experience]);
        formData.append('questionCount', String(questionCount));
        result = await createSessionWithResume(formData);
      } else {
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
      sessionStorage.removeItem('resumeFromIndex');
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

  const SectionHeader = ({ num, title, subtitle, icon: Icon }) => (
    <div className="mb-3">
      <h3 className="text-base font-semibold text-ink-900 dark:text-white flex items-center gap-2">
        {Icon && <Icon size={18} className="text-primary-500" strokeWidth={2.5} />}
        <span className="text-ink-900 dark:text-white">
          {num}. {title}
        </span>
      </h3>
      {subtitle && <p className="text-xs text-ink-500 dark:text-slate-400 mt-1 pl-7">{subtitle}</p>}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-2">
        <div className="w-12 h-12 bg-primary-500/10 rounded-xl flex items-center justify-center border border-primary-500/20 shadow-[0_0_15px_rgba(249,115,22,0.15)]">
          <FileText className="text-primary-500" size={24} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Interview Setup</h1>
        </div>
      </div>
      <p className="text-ink-500 dark:text-slate-400 mb-10 text-sm md:pl-16">
        Tell us about the role and your preferences. Our AI will generate tailored interview questions.
      </p>

      {pausedSession && (
        <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/5 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-amber-500 dark:text-amber-400 flex items-center gap-2 mb-1">
              <Pause size={14} strokeWidth={2.5} /> You have a paused session
            </p>
            <p className="text-xs text-ink-500 dark:text-white/60">
              Answered {pausedSession.resumeIndex} of {pausedSession.total} questions. Pick up where you left off.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleResume}
              disabled={loading}
              className="btn-primary text-sm py-2 px-5 disabled:opacity-50 flex items-center gap-2"
            >
              <Play size={14} strokeWidth={2.5} /> Resume
            </button>
            <button
              onClick={() => {
                setPausedSession(null);
                sessionStorage.removeItem('resumeFromIndex');
                sessionStorage.removeItem('currentSessionId');
                sessionStorage.removeItem('currentQuestions');
                sessionStorage.removeItem('skippedQuestions');
              }}
              className="text-xs text-ink-500 dark:text-white/40 hover:text-ink-700 dark:hover:text-white/70 px-3 py-2 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm mb-6">
          {error}
        </div>
      )}

      <div className="bg-surface-50 dark:bg-[#0F1423] border border-surface-200 dark:border-white/5 rounded-2xl p-6 md:p-8 space-y-8 shadow-sm">
        
        {/* 1. Target Role */}
        <div>
          <SectionHeader num="1" title="Target Role" subtitle="Enter the job role you're preparing for" icon={User} />
          <div className="pl-7">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search size={18} className="text-ink-400 dark:text-slate-500" />
              </div>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Nurse, Data Scientist, iOS Developer..."
                className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white dark:bg-[#1A2133] border border-surface-200 dark:border-white/10 text-ink-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500 transition-shadow text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {QUICK_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`text-xs px-4 py-2 rounded-full border transition-all ${
                    role === r
                      ? 'bg-primary-500/10 text-primary-500 border-primary-500/30'
                      : 'border-surface-200 dark:border-white/10 text-ink-500 dark:text-slate-400 hover:border-primary-300 dark:hover:border-primary-500/30 hover:text-primary-500 bg-white dark:bg-transparent'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-surface-200 dark:bg-white/5"></div>

        {/* 2. Experience Level */}
        <div>
          <SectionHeader num="2" title="Experience Level" subtitle="Select your total professional experience" icon={BarChart2} />
          <div className="pl-7 grid grid-cols-2 md:grid-cols-4 gap-3">
            {experienceLevels.map((lvl) => (
              <button
                key={lvl.value}
                onClick={() => setExperience(lvl.value)}
                className={`p-3 rounded-xl border text-center transition-all ${
                  experience === lvl.value
                    ? 'border-primary-500 bg-primary-500/5 text-primary-500'
                    : 'border-surface-200 dark:border-white/10 bg-white dark:bg-[#1A2133] text-ink-700 dark:text-slate-300 hover:border-primary-300 dark:hover:border-primary-500/30'
                }`}
              >
                <div className={`text-sm font-semibold ${experience === lvl.value ? 'text-primary-500' : 'text-ink-900 dark:text-white'}`}>
                  {lvl.label}
                </div>
                <div className={`text-xs mt-1 ${experience === lvl.value ? 'text-primary-500/80' : 'text-ink-500 dark:text-slate-500'}`}>
                  {lvl.years}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px w-full bg-surface-200 dark:bg-white/5"></div>

        {/* 3. Interview Type */}
        <div>
          <SectionHeader num="3" title="Interview Type" subtitle="Choose the type of interview you want to practice" icon={MessageSquare} />
          <div className="pl-7 grid grid-cols-2 md:grid-cols-4 gap-3">
            {interviewTypes.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border transition-all ${
                    type === t.value
                      ? 'border-primary-500 bg-primary-500/5 text-primary-500'
                      : 'border-surface-200 dark:border-white/10 bg-white dark:bg-[#1A2133] text-ink-700 dark:text-slate-300 hover:border-primary-300 dark:hover:border-primary-500/30'
                  }`}
                >
                  <Icon size={16} />
                  <span className={`text-sm font-semibold ${type === t.value ? 'text-primary-500' : 'text-ink-900 dark:text-white'}`}>
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px w-full bg-surface-200 dark:bg-white/5"></div>

        {/* 4 & 5. Question Count & Difficulty */}
        <div className="grid md:grid-cols-2 gap-8 md:gap-4">
          <div>
            <SectionHeader num="4" title="Number of Questions" subtitle="Select how many questions to generate" icon={FileText} />
            <div className="pl-7">
              <div className="relative">
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full appearance-none px-4 py-3.5 rounded-xl bg-white dark:bg-[#1A2133] border border-surface-200 dark:border-white/10 text-ink-900 dark:text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
                >
                  {questionCounts.map((n) => (
                    <option key={n} value={n} className="bg-white dark:bg-[#1A2133]">
                      {n} questions
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-ink-400 dark:text-slate-500">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div>
            <SectionHeader num="5" title="Difficulty Level" subtitle="Choose the difficulty level for the questions" icon={Target} />
            <div className="pl-7 flex gap-2">
              {difficulties.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-3.5 rounded-xl text-sm border transition-all ${
                    difficulty === d
                      ? 'border-primary-500 bg-primary-500/5 text-primary-500 font-semibold'
                      : 'border-surface-200 dark:border-white/10 bg-white dark:bg-[#1A2133] text-ink-700 dark:text-slate-300 hover:border-primary-300 dark:hover:border-primary-500/30'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Resume Upload Toggle */}
        <div className="pl-7">
          <div className={`rounded-xl border p-4 transition-all ${
            useResume 
              ? 'border-primary-500/50 bg-primary-500/5' 
              : 'border-surface-200 dark:border-white/5 bg-white dark:bg-[#1A2133]'
          }`}>
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  useResume
                    ? 'bg-primary-500/15 border border-primary-500/30'
                    : 'bg-surface-100 dark:bg-white/5 border border-surface-200 dark:border-white/10'
                }`}>
                  <FileText size={20} className={useResume ? 'text-primary-500' : 'text-ink-400 dark:text-slate-500'} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-ink-900 dark:text-white flex items-center gap-2">
                    Upload Resume
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                      Optional
                    </span>
                  </p>
                  <p className="text-xs text-ink-500 dark:text-slate-400 mt-0.5">
                    AI will read your resume and personalize questions
                  </p>
                </div>
              </div>
              <div
                className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ml-4 flex-shrink-0 ${
                  useResume ? 'bg-primary-500' : 'bg-surface-200 dark:bg-slate-700'
                }`}
                onClick={() => setUseResume(!useResume)}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  useResume ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </label>

            {useResume && (
              <div className="mt-4 pl-[56px]">
                <div
                  className={`p-4 border-2 border-dashed rounded-xl text-center transition-colors ${
                    resumeFile
                      ? 'border-primary-500/50 bg-primary-500/10'
                      : 'border-surface-200 dark:border-white/10 hover:border-primary-500/50 dark:bg-black/20'
                  }`}
                >
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="resume-upload"
                  />
                  <label htmlFor="resume-upload" className="cursor-pointer block w-full">
                    {resumeFile ? (
                      <div>
                        <p className="text-primary-500 font-semibold text-sm flex items-center justify-center gap-2">
                          <CheckCircle2 size={16} strokeWidth={2.5} /> {resumeFile.name}
                        </p>
                        <p className="text-xs text-ink-500 dark:text-slate-400 mt-1">
                          Click to change file
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-ink-700 dark:text-slate-300 text-sm mb-1 font-medium">
                          Click to upload your resume
                        </p>
                        <p className="text-xs text-ink-500 dark:text-slate-500">PDF only, max 5MB</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="h-px w-full bg-surface-200 dark:bg-white/5"></div>

        {/* Warmup Mode Toggle */}
        <div className="pl-7">
          <div className={`rounded-xl border p-4 transition-all ${
            warmupEnabled
              ? 'border-purple-400/30 bg-purple-500/5'
              : 'border-surface-200 dark:border-white/5 bg-white dark:bg-[#1A2133]'
          }`}>
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  warmupEnabled
                    ? 'bg-purple-500/15 border border-purple-500/30'
                    : 'bg-surface-100 dark:bg-white/5 border border-surface-200 dark:border-white/10'
                }`}>
                  <Activity size={20} className={warmupEnabled ? 'text-purple-500' : 'text-ink-400 dark:text-slate-500'} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-ink-900 dark:text-white flex items-center gap-2">
                    Warmup Mode
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300">
                      Recommended
                    </span>
                  </p>
                  <p className="text-xs text-ink-500 dark:text-slate-400 mt-0.5">
                    2-min breathing + mic check before the real session
                  </p>
                </div>
              </div>
              <div
                className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ml-4 flex-shrink-0 ${
                  warmupEnabled ? 'bg-purple-500' : 'bg-surface-200 dark:bg-slate-700'
                }`}
                onClick={() => setWarmupEnabled(!warmupEnabled)}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  warmupEnabled ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </label>
          </div>
        </div>

      </div>

      <div className="mt-8 text-center flex flex-col items-center">
        <button
          onClick={handleStart}
          disabled={loading || !role.trim()}
          className="btn-primary w-full md:w-auto md:min-w-[300px] text-base py-3.5 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary-500/20"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Generating...
            </>
          ) : (
            <>
              <Sparkles size={18} strokeWidth={2.5} /> Generate Questions
            </>
          )}
        </button>
        <p className="text-xs text-ink-400 dark:text-slate-500 mt-4">
          We'll generate questions based on your preferences.
        </p>
      </div>

    </div>
  );
}
