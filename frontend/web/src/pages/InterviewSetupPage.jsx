import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createInterviewSession } from '../services/mockApi';

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

  const handleStart = async () => {
    if (!role.trim()) {
      setError('Please enter a target role.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const payload = {
        interviewType: interviewTypeMap[type],
        targetRole: role.trim(),
        difficulty: difficultyMap[difficulty],
        experienceLevel: experienceMap[experience],
        questionCount: Number(questionCount),
      };
      console.log('Sending payload:', payload);
      const result = await createInterviewSession(payload);
      sessionStorage.setItem('currentSessionId', result.sessionId);
      sessionStorage.setItem(
        'currentQuestions',
        JSON.stringify(result.questions)
      );
      navigate('/interview');
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

        {/* AI Notice */}
        <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 text-sm text-primary-700">
          🤖 Questions will be generated by AI specifically for{' '}
          <strong>{role || 'your role'}</strong> — no generic questions.
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
