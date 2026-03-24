import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPracticeSummary, generateAnalysis } from '../services/mockApi';
import GlassPanel from '../components/GlassPanel';
import TranscriptPanel from '../components/TranscriptPanel';
import LoadingState from '../components/LoadingState';

export default function PracticeSummaryPage() {
  const navigate = useNavigate();
  const sessionId = sessionStorage.getItem('currentSessionId');
  const questions = JSON.parse(
    sessionStorage.getItem('currentQuestions') || '[]'
  );

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const firstQuestion = questions[0];

  useEffect(() => {
    if (!sessionId || !firstQuestion) {
      navigate('/setup');
      return;
    }

    const loadSummary = async () => {
      try {
        // Generate analysis first
        await generateAnalysis(sessionId);

        // Wait for transcription to complete (Whisper takes time)
        let summaryData = null;
        let attempts = 0;
        const maxAttempts = 10;

        while (attempts < maxAttempts) {
          const data = await fetchPracticeSummary(sessionId, firstQuestion.id);

          if (data?.transcript) {
            summaryData = data;
            break;
          }

          attempts++;
          if (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 3000));
          }
        }

        setSummary(summaryData || { transcript: null, analysis: null });
      } catch (err) {
        console.error('Failed to load summary:', err);
        setSummary({ transcript: null, analysis: null });
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [sessionId, firstQuestion, navigate]);

  if (loading)
    return (
      <LoadingState message="Transcribing your answer... this may take 20-30 seconds" />
    );

  return (
    <div className="flex-1 flex flex-col items-center px-6 py-10 max-w-3xl mx-auto w-full">
      <h2 className="text-2xl font-bold text-white mb-1">Practice Summary</h2>
      <p className="text-sm text-white/50 mb-8">
        Here&apos;s how you did on this question.
      </p>

      {/* Quick Score */}
      <GlassPanel className="w-full mb-6 text-center">
        <p className="text-xs uppercase tracking-widest text-white/40 font-bold mb-1">
          Quick Score
        </p>
        <p className="text-5xl font-extrabold text-primary-500">
          {summary?.analysis?.overallScore ?? 'N/A'}
        </p>
        <p className="text-sm text-white/50 mt-1">out of 10</p>
      </GlassPanel>

      {/* Transcript */}
      <div className="w-full mb-6">
        <TranscriptPanel
          transcript={summary?.transcript || 'No transcript available yet.'}
          label="Your Answer"
          dark
        />
      </div>

      {/* Feedback */}
      {summary?.analysis && (
        <div className="grid md:grid-cols-2 gap-4 w-full mb-8">
          <GlassPanel>
            <h4 className="text-sm font-bold text-green-400 uppercase tracking-wider mb-3">
              ✅ Feedback
            </h4>
            <ul className="space-y-2">
              {Array.isArray(summary.analysis.feedback) ? (
                summary.analysis.feedback.map((s, i) => (
                  <li
                    key={i}
                    className="text-sm text-white/80 flex items-start gap-2"
                  >
                    <span className="text-green-400 mt-0.5">•</span>
                    {s}
                  </li>
                ))
              ) : (
                <li className="text-sm text-white/80">
                  Good effort! Keep practicing.
                </li>
              )}
            </ul>
          </GlassPanel>

          <GlassPanel>
            <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider mb-3">
              📊 Scores
            </h4>
            <div className="space-y-2 text-sm text-white/80">
              {summary.analysis.clarityScore && (
                <p>
                  Clarity:{' '}
                  <span className="text-primary-400 font-bold">
                    {summary.analysis.clarityScore}/10
                  </span>
                </p>
              )}
              {summary.analysis.fluencyScore && (
                <p>
                  Fluency:{' '}
                  <span className="text-primary-400 font-bold">
                    {summary.analysis.fluencyScore}/10
                  </span>
                </p>
              )}
              {summary.analysis.confidenceScore && (
                <p>
                  Confidence:{' '}
                  <span className="text-primary-400 font-bold">
                    {summary.analysis.confidenceScore}/10
                  </span>
                </p>
              )}
              {summary.analysis.technicalScore && (
                <p>
                  Technical:{' '}
                  <span className="text-primary-400 font-bold">
                    {summary.analysis.technicalScore}/10
                  </span>
                </p>
              )}
            </div>
          </GlassPanel>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={() => navigate('/interview')}
          className="btn-glass px-8"
        >
          Next Question →
        </button>
        <button
          onClick={() => navigate('/results')}
          className="btn-primary px-8"
        >
          Finish Practice
        </button>
      </div>
    </div>
  );
}
