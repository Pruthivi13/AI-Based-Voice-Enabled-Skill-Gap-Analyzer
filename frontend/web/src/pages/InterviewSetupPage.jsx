/**
 * InterviewSetupPage.jsx — Interview configuration page
 *
 * Maps to PRD §9.2 and the Interview Setup flow.
 * Features:
 *   • Role selection dropdown
 *   • Experience level picker
 *   • Interview type selector
 *   • Question count and difficulty
 *   • Job description upload UI placeholder
 *   • Start Interview CTA
 *
 * TODO: Connect to createInterviewSession() when backend is ready.
 * All form values are local state; they will be sent to the backend
 * when the user clicks "Start Interview".
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const roles = [
  'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
  'Data Scientist', 'DevOps Engineer', 'Product Manager',
  'UI/UX Designer', 'Mobile Developer', 'QA Engineer',
];

const experienceLevels = ['Entry Level', 'Junior (1-2 yrs)', 'Mid (3-5 yrs)', 'Senior (5+ yrs)'];
const interviewTypes = ['Technical', 'Behavioral', 'Mixed', 'System Design'];
const difficulties = ['Easy', 'Medium', 'Hard'];
const questionCounts = [3, 5, 7, 10];

export default function InterviewSetupPage() {
  const navigate = useNavigate();

  // Local form state — will be sent to backend as setup payload
  const [role, setRole] = useState('Frontend Developer');
  const [experience, setExperience] = useState('Entry Level');
  const [type, setType] = useState('Technical');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState('Medium');
  const [fileName, setFileName] = useState('');

  /** Simulates file selection — no real upload */
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setFileName(file.name);
  };

  /** Starts the interview flow */
  const handleStart = () => {
    // TODO: Call createInterviewSession({ role, experience, type, difficulty, questionCount })
    console.log('[Setup] Starting interview:', { role, experience, type, difficulty, questionCount, fileName });
    navigate('/interview');
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="mb-2">Interview Setup</h1>
      <p className="text-ink-500 mb-10">
        Configure your practice session. Select your target role, experience, and preferences.
      </p>

      <div className="card space-y-6">
        {/* Role */}
        <div>
          <label className="section-header">Target Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-100 border border-surface-200
                       text-ink-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {roles.map((r) => <option key={r}>{r}</option>)}
          </select>
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
              className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-100 border border-surface-200
                         text-ink-900 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {questionCounts.map((n) => (
                <option key={n} value={n}>{n} questions</option>
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

        {/* JD Upload */}
        <div>
          <label className="section-header">Job Description (Optional)</label>
          <div className="mt-2 p-6 border-2 border-dashed border-surface-200 rounded-2xl
                          text-center hover:border-primary-300 transition-colors cursor-pointer">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={handleFileChange}
              className="hidden"
              id="jd-upload"
            />
            <label htmlFor="jd-upload" className="cursor-pointer">
              <p className="text-ink-500 text-sm mb-1">
                {fileName ? `📄 ${fileName}` : 'Click to upload or drag & drop'}
              </p>
              <p className="text-xs text-ink-500/60">PDF, DOC, DOCX, or TXT</p>
            </label>
          </div>
        </div>

        {/* Start Button */}
        <button onClick={handleStart} className="btn-primary w-full text-lg py-4">
          🎯 Start Interview
        </button>
      </div>
    </div>
  );
}
