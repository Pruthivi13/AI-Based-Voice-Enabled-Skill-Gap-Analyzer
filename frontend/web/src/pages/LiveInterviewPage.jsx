import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { finishSession, saveTranscript } from '../services/api';
import { generateFollowupQuestions } from '../services/mockApi';
import QuestionCard from '../components/QuestionCard';
import TranscriptPanel from '../components/TranscriptPanel';
import RecordingControls from '../components/RecordingControls';

// ── Inline Follow-up Panel ───────────────────────────────────────────────────
function FollowupPanel({ followups, loading, onSkip, onAnswer }) {
  if (loading) {
    return (
      <div className="w-full glass-panel p-5 mb-6 text-center">
        <div className="flex items-center justify-center gap-2 text-white/60 text-sm">
          <span className="w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          Generating follow-up questions...
        </div>
      </div>
    );
  }

  if (!followups || followups.length === 0) return null;

  const fq = followups[0]; // show the first follow-up

  return (
    <div className="w-full mb-6 rounded-2xl border border-primary-500/40 bg-primary-500/5 p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
        <span className="text-xs font-bold uppercase tracking-widest text-primary-400">
          Follow-up Question
        </span>
        {fq.topic && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-primary-500/15 text-primary-400 font-semibold">
            {fq.topic}
          </span>
        )}
      </div>

      {/* Question */}
      <p className="text-white font-semibold text-lg mb-4 leading-snug">
        "{fq.question}"
      </p>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onAnswer}
          className="btn-primary text-sm py-2 px-5 flex items-center gap-2"
        >
          🎤 Answer Follow-up
        </button>
        <button
          onClick={onSkip}
          className="btn-glass text-sm py-2 px-5"
        >
          Skip →
        </button>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function LiveInterviewPage() {
  const navigate = useNavigate();

  const sessionId = sessionStorage.getItem('currentSessionId');
  const questions = JSON.parse(
    sessionStorage.getItem('currentQuestions') || '[]'
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording]   = useState(false);
  const [isPaused, setIsPaused]         = useState(false);
  const [transcript, setTranscript]     = useState('');
  const [status, setStatus]             = useState('Ready');
  const [timeLeft, setTimeLeft]         = useState(null);
  const [liveStream, setLiveStream]     = useState(null);

  // ── Follow-up state ──
  const [followupQuestions, setFollowupQuestions] = useState([]);
  const [followupLoading, setFollowupLoading]     = useState(false);
  const [showFollowup, setShowFollowup]           = useState(false);
  const [isFollowupActive, setIsFollowupActive]   = useState(false);
  const pendingTranscriptRef = useRef('');
  const pendingIndexRef      = useRef(0);

  const timerRef         = useRef(null);
  const mediaRecorderRef = useRef(null);
  const wsRef            = useRef(null);
  const streamRef        = useRef(null);
  const currentIndexRef  = useRef(0);

  // ── Timer helpers ────────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback((seconds) => {
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleStop();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  useEffect(() => {
    if (!sessionId || questions.length === 0) navigate('/setup');
    return () => {
      wsRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      clearInterval(timerRef.current);
    };
  }, []);

  const currentQuestion = isFollowupActive
    ? followupQuestions[0]
    : questions[currentIndex];

  // ── Advance to next question (or finish) ─────────────────────────────────
  const advanceOrFinish = useCallback(
    async (idx) => {
      setShowFollowup(false);
      setIsFollowupActive(false);
      setFollowupQuestions([]);
      setTranscript('');

      if (idx < questions.length - 1) {
        setCurrentIndex(idx + 1);
        currentIndexRef.current = idx + 1;
        wsRef.current?.close();
      } else {
        setStatus('Uploading');
        finishSession(sessionId)
          .catch(console.error)
          .finally(() => { wsRef.current?.close(); navigate('/processing'); });
      }
    },
    [sessionId, questions.length, navigate]
  );

  // ── After primary answer: fetch follow-ups ───────────────────────────────
  const fetchFollowups = useCallback(
    async (finalTranscript, idx) => {
      const q = questions[idx];
      if (!q || !finalTranscript || finalTranscript.length < 15) {
        await advanceOrFinish(idx);
        return;
      }

      setFollowupLoading(true);
      setShowFollowup(true);
      pendingTranscriptRef.current = finalTranscript;
      pendingIndexRef.current = idx;

      try {
        const data = await generateFollowupQuestions(
          sessionId,
          q.content,
          finalTranscript,
          q.role || 'Software Engineer',
          2
        );
        const fqs = data?.followups ?? [];
        setFollowupQuestions(fqs);

        if (fqs.length === 0) {
          // No follow-ups generated — move on
          await advanceOrFinish(idx);
        }
      } catch (err) {
        console.error('Follow-up generation failed:', err);
        await advanceOrFinish(idx);
      } finally {
        setFollowupLoading(false);
      }
    },
    [sessionId, questions, advanceOrFinish]
  );

  // ── WebSocket recording helper ────────────────────────────────────────────
  const startRecordingSession = useCallback(
    async (questionId) => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setLiveStream(stream);

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const wsUrl   = API_URL.replace('http', 'ws');
      const ws = new WebSocket(`${wsUrl}/ws/transcribe/${questionId}`);
      wsRef.current = ws;

      ws.onopen = () => console.log('WebSocket connected');

      ws.onmessage = async (event) => {
        const raw = event.data instanceof Blob ? await event.data.text() : event.data;
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        if (msg.type === 'partial') {
          setTranscript(msg.text);
        }

        if (msg.type === 'final') {
          stopTimer();
          setTranscript(msg.text);
          setStatus('Ready');
          setIsRecording(false);
          setIsPaused(false);
          setLiveStream(null);

          const idx = currentIndexRef.current;
          const qId = questions[idx]?.id;

          try {
            await saveTranscript(sessionId, qId, msg.text, idx + 1);
          } catch (err) {
            console.error('Failed to save transcript:', err);
          }

          if (isFollowupActive) {
            // Follow-up answer done — advance
            await advanceOrFinish(pendingIndexRef.current);
          } else {
            // Primary answer done — fetch follow-ups
            await fetchFollowups(msg.text, idx);
          }
        }

        if (msg.type === 'error') {
          console.error('WebSocket server error:', msg.message);
          setStatus('Ready');
          setIsRecording(false);
          setLiveStream(null);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setStatus('Ready');
        setIsRecording(false);
        setLiveStream(null);
      };

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
        }
      };

      return mediaRecorder;
    },
    [sessionId, questions, isFollowupActive, advanceOrFinish, fetchFollowups, stopTimer]
  );

  // ── Controls ──────────────────────────────────────────────────────────────
  const handleRecord = useCallback(async () => {
    if (isPaused) {
      mediaRecorderRef.current?.resume();
      setIsPaused(false);
      setStatus('Recording');
      return;
    }
    if (isRecording) return;

    try {
      const questionId = isFollowupActive
        ? questions[pendingIndexRef.current]?.id  // reuse slot
        : questions[currentIndexRef.current]?.id;

      const mediaRecorder = await startRecordingSession(questionId);
      const timeLimitSeconds = isFollowupActive
        ? 90
        : (questions[currentIndexRef.current]?.timeLimitSeconds || 120);

      mediaRecorder.start(200);
      startTimer(timeLimitSeconds);
      setIsRecording(true);
      setIsPaused(false);
      setTranscript('Start speaking when ready...');
      setStatus('Recording');
    } catch (err) {
      console.error('Mic error:', err);
      alert('Microphone access denied. Please allow microphone access.');
    }
  }, [isRecording, isPaused, isFollowupActive, questions, startRecordingSession, startTimer]);

  const handlePause = useCallback(() => {
    mediaRecorderRef.current?.pause();
    setIsPaused(true);
    setStatus('Paused');
  }, []);

  const handleStop = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    stopTimer();
    setIsRecording(false);
    setIsPaused(false);
    setStatus('Transcribing');
    setTranscript('Transcribing your answer...');

    mediaRecorderRef.current.onstop = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setLiveStream(null);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('END');
      }
    };
    mediaRecorderRef.current.stop();
  }, [stopTimer]);

  // ── Follow-up panel handlers ──────────────────────────────────────────────
  const handleAnswerFollowup = useCallback(() => {
    setShowFollowup(false);
    setIsFollowupActive(true);
    setTranscript('');
    setStatus('Ready');
  }, []);

  const handleSkipFollowup = useCallback(async () => {
    await advanceOrFinish(pendingIndexRef.current);
  }, [advanceOrFinish]);

  if (!currentQuestion && !followupLoading && !showFollowup) return null;

  const statusColor = {
    Ready:        'bg-green-400',
    Recording:    'bg-red-400 animate-pulse',
    Paused:       'bg-amber-400',
    Transcribing: 'bg-blue-400 animate-pulse',
    Uploading:    'bg-purple-400 animate-pulse',
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-4xl mx-auto w-full">

      {/* Status indicator */}
      <div className="self-end mb-6 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${statusColor[status] || 'bg-green-400'}`} />
        <span className="text-xs font-bold uppercase tracking-wider text-white/50">
          {status}
        </span>
      </div>

      {/* Timer */}
      {timeLeft !== null && (
        <div className={`self-end mb-2 flex items-center gap-2 text-sm font-bold tabular-nums ${
          timeLeft <= 10 ? 'text-red-400' : timeLeft <= 30 ? 'text-amber-400' : 'text-white/50'
        }`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </div>
      )}

      {/* Question Card — show primary OR follow-up label */}
      <div className="w-full mb-6">
        {isFollowupActive ? (
          <div className="rounded-2xl p-6 bg-dark-800/80 border border-primary-500/30 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-primary-400">
                Follow-up Question
              </span>
              {followupQuestions[0]?.topic && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-primary-500/15 text-primary-400 font-semibold">
                  {followupQuestions[0].topic}
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-white leading-snug">
              "{followupQuestions[0]?.question}"
            </p>
          </div>
        ) : (
          questions[currentIndex] && (
            <QuestionCard
              question={questions[currentIndex].content}
              category={questions[currentIndex].category}
              number={currentIndex + 1}
              total={questions.length}
              dark
            />
          )
        )}
      </div>

      {/* Follow-up Panel (shown after primary answer, before follow-up recording) */}
      {showFollowup && !isFollowupActive && (
        <div className="w-full">
          <FollowupPanel
            followups={followupQuestions}
            loading={followupLoading}
            onAnswer={handleAnswerFollowup}
            onSkip={handleSkipFollowup}
          />
        </div>
      )}

      {/* Live Transcript */}
      {!showFollowup && (
        <div className="w-full mb-10">
          <TranscriptPanel transcript={transcript} dark />
        </div>
      )}

      {/* Recording Controls — only shown when not waiting for follow-up decision */}
      {!showFollowup && status !== 'Transcribing' && status !== 'Uploading' ? (
        <RecordingControls
          isRecording={isRecording}
          isPaused={isPaused}
          stream={liveStream}
          onRecord={handleRecord}
          onPause={handlePause}
          onStop={handleStop}
        />
      ) : !showFollowup ? (
        <div className="text-white/60 text-sm animate-pulse text-center">
          {status === 'Transcribing'
            ? '🧠 AI is transcribing your answer...'
            : '📤 Saving your session...'}
        </div>
      ) : null}

      {/* Progress dots */}
      <div className="flex gap-2 mt-6">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all ${
              i === currentIndex
                ? 'bg-primary-500 w-4'
                : i < currentIndex
                ? 'bg-green-400 w-2'
                : 'bg-white/20 w-2'
            }`}
          />
        ))}
      </div>

    </div>
  );
}
