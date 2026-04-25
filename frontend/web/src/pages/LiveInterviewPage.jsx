import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { finishSession, saveTranscript, pauseSession } from '../services/api';
import { generateFollowupQuestions } from '../services/api';
import QuestionCard from '../components/QuestionCard';
import TranscriptPanel from '../components/TranscriptPanel';
import RecordingControls from '../components/RecordingControls';
import AnimatedHintsButton from '../components/AnimatedHintsButton';
import BookmarkButton from '../components/BookmarkButton';

// ── helpers ──────────────────────────────────────────────────────────────────
const SKIPPED_KEY  = 'skippedQuestions';
const RESUME_KEY   = 'resumeFromIndex';

function saveProgressToStorage(index) {
  sessionStorage.setItem(RESUME_KEY, String(index));
}

function markSkipped(questionId) {
  const skipped = JSON.parse(sessionStorage.getItem(SKIPPED_KEY) || '[]');
  if (!skipped.includes(questionId)) {
    sessionStorage.setItem(SKIPPED_KEY, JSON.stringify([...skipped, questionId]));
  }
}

function isSkipped(questionId) {
  const skipped = JSON.parse(sessionStorage.getItem(SKIPPED_KEY) || '[]');
  return skipped.includes(questionId);
}

// ── Follow-up Panel ──────────────────────────────────────────────────────────
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
  const fq = followups[0];
  return (
    <div className="w-full mb-6 rounded-2xl border border-primary-500/40 bg-primary-500/5 p-5">
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
      <p className="text-white font-semibold text-lg mb-4 leading-snug">
        "{fq.question}"
      </p>
      <div className="flex gap-3">
        <button onClick={onAnswer} className="btn-primary text-sm py-2 px-5 flex items-center gap-2">
          🎤 Answer Follow-up
        </button>
        <button onClick={onSkip} className="btn-glass text-sm py-2 px-5">
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
  const questions  = JSON.parse(sessionStorage.getItem('currentQuestions') || '[]');

  // Resume from a paused session if available
  const initialIndex = Math.min(
    Number(sessionStorage.getItem(RESUME_KEY) || '0'),
    Math.max(0, questions.length - 1)
  );

  const [currentIndex, setCurrentIndex]         = useState(initialIndex);
  const [isRecording, setIsRecording]           = useState(false);
  const [isPaused, setIsPaused]                 = useState(false);
  const [transcript, setTranscript]             = useState('');
  const [status, setStatus]                     = useState('Ready');
  const [timeLeft, setTimeLeft]                 = useState(null);
  const [liveStream, setLiveStream]             = useState(null);
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);

  // Follow-up state
  const [followupQuestions, setFollowupQuestions] = useState([]);
  const [followupLoading, setFollowupLoading]     = useState(false);
  const [showFollowup, setShowFollowup]           = useState(false);
  const [isFollowupActive, setIsFollowupActive]   = useState(false);
  const pendingTranscriptRef = useRef('');
  const pendingIndexRef      = useRef(initialIndex);

  const timerRef         = useRef(null);
  const mediaRecorderRef = useRef(null);
  const wsRef            = useRef(null);
  const streamRef        = useRef(null);
  const currentIndexRef  = useRef(initialIndex);

  // ── Timer helpers ────────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback((seconds) => {
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current); handleStop(); return 0; }
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

  const currentQuestion = isFollowupActive ? followupQuestions[0] : questions[currentIndex];
  
  // Extract hints from question
  const currentHints = currentQuestion?.hints || [];
  const questionType = currentQuestion?.category || '';

  // ── Advance to next question or finish ───────────────────────────────────
  const advanceOrFinish = useCallback(async (idx) => {
    setShowFollowup(false);
    setIsFollowupActive(false);
    setFollowupQuestions([]);
    setTranscript('');
    wsRef.current?.close();

    const nextIndex = idx + 1;
    saveProgressToStorage(nextIndex);  // ← persist progress

    if (nextIndex < questions.length) {
      setCurrentIndex(nextIndex);
      currentIndexRef.current = nextIndex;
    } else {
      // Clear resume state on completion
      sessionStorage.removeItem(RESUME_KEY);
      sessionStorage.removeItem(SKIPPED_KEY);
      setStatus('Uploading');
      finishSession(sessionId)
        .catch(console.error)
        .finally(() => navigate('/processing'));
    }
  }, [sessionId, questions.length, navigate]);

  // ── Skip current question ────────────────────────────────────────────────
  const handleSkip = useCallback(async () => {
    if (isRecording) {
      stopTimer();
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setLiveStream(null);
      wsRef.current?.close();
      setIsRecording(false);
      setIsPaused(false);
    }

    const idx = currentIndexRef.current;
    const qId = questions[idx]?.id;

    markSkipped(qId);
    // Save empty transcript so the response record exists
    try { await saveTranscript(sessionId, qId, '[skipped]', idx + 1); } catch {}

    setStatus('Ready');
    setTranscript('');
    await advanceOrFinish(idx);
  }, [isRecording, questions, sessionId, stopTimer, advanceOrFinish]);

  // ── Pause & exit session ──────────────────────────────────────────────────
  const handlePauseAndExit = useCallback(async () => {
    if (isRecording) {
      stopTimer();
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setLiveStream(null);
      wsRef.current?.close();
    }
    saveProgressToStorage(currentIndexRef.current);
    try { await pauseSession(sessionId); } catch {}
    setShowPauseConfirm(false);
    navigate('/dashboard');
  }, [isRecording, sessionId, stopTimer, navigate]);

  // ── Fetch follow-ups after primary answer ────────────────────────────────
  const fetchFollowups = useCallback(async (finalTranscript, idx) => {
    const q = questions[idx];
    if (!q || !finalTranscript || finalTranscript.length < 15) {
      await advanceOrFinish(idx); return;
    }
    setFollowupLoading(true);
    setShowFollowup(true);
    pendingTranscriptRef.current = finalTranscript;
    pendingIndexRef.current = idx;
    try {
      const data = await generateFollowupQuestions(
        sessionId, q.content, finalTranscript, q.role || 'Software Engineer', 2
      );
      const fqs = data?.followups ?? [];
      setFollowupQuestions(fqs);
      if (fqs.length === 0) await advanceOrFinish(idx);
    } catch {
      await advanceOrFinish(idx);
    } finally {
      setFollowupLoading(false);
    }
  }, [sessionId, questions, advanceOrFinish]);

  // ── WebSocket recording helper ────────────────────────────────────────────
  const startRecordingSession = useCallback(async (questionId) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    setLiveStream(stream);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const wsUrl   = API_URL.replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/ws/transcribe/${questionId}`);
    wsRef.current = ws;

    ws.onmessage = async (event) => {
      const raw = event.data instanceof Blob ? await event.data.text() : event.data;
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'partial') setTranscript(msg.text);

      if (msg.type === 'final') {
        stopTimer();
        setTranscript(msg.text);
        setStatus('Ready');
        setIsRecording(false);
        setIsPaused(false);
        setLiveStream(null);

        const idx = currentIndexRef.current;
        const qId = questions[idx]?.id;
        try { await saveTranscript(sessionId, qId, msg.text, idx + 1); } catch {}

        if (isFollowupActive) {
          await advanceOrFinish(pendingIndexRef.current);
        } else {
          await fetchFollowups(msg.text, idx);
        }
      }
      if (msg.type === 'error') {
        console.error('WebSocket error:', msg.message);
        setStatus('Ready'); setIsRecording(false); setLiveStream(null);
      }
    };
    ws.onerror = () => { setStatus('Ready'); setIsRecording(false); setLiveStream(null); };

    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
    };
    return mediaRecorder;
  }, [sessionId, questions, isFollowupActive, advanceOrFinish, fetchFollowups, stopTimer]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const handleRecord = useCallback(async () => {
    if (isPaused) {
      mediaRecorderRef.current?.resume();
      setIsPaused(false); setStatus('Recording'); return;
    }
    if (isRecording) return;
    try {
      const questionId = isFollowupActive
        ? questions[pendingIndexRef.current]?.id
        : questions[currentIndexRef.current]?.id;
      const mediaRecorder = await startRecordingSession(questionId);
      const timeLimitSeconds = isFollowupActive
        ? 90
        : (questions[currentIndexRef.current]?.timeLimitSeconds || 120);
      mediaRecorder.start(200);
      startTimer(timeLimitSeconds);
      setIsRecording(true); setIsPaused(false);
      setTranscript('Start speaking when ready...');
      setStatus('Recording');
    } catch {
      alert('Microphone access denied. Please allow microphone access.');
    }
  }, [isRecording, isPaused, isFollowupActive, questions, startRecordingSession, startTimer]);

  const handlePause = useCallback(() => {
    mediaRecorderRef.current?.pause();
    setIsPaused(true); setStatus('Paused');
  }, []);

  const handleStop = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    stopTimer();
    setIsRecording(false); setIsPaused(false);
    setStatus('Transcribing');
    setTranscript('Transcribing your answer...');
    mediaRecorderRef.current.onstop = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setLiveStream(null);
      if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send('END');
    };
    mediaRecorderRef.current.stop();
  }, [stopTimer]);

  // ── Follow-up panel handlers ──────────────────────────────────────────────
  const handleAnswerFollowup = useCallback(() => {
    setShowFollowup(false); setIsFollowupActive(true);
    setTranscript(''); setStatus('Ready');
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

  const skippedCount = JSON.parse(sessionStorage.getItem(SKIPPED_KEY) || '[]').length;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-4xl mx-auto w-full">

      {/* ── 💡 Animated Hints Button (Fixed Top-Right) ── */}
      {!showFollowup && currentHints.length > 0 && (
        <AnimatedHintsButton hints={currentHints} questionType={questionType} />
      )}

      {/* ── Top bar: status + pause button ── */}
      <div className="self-stretch flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColor[status] || 'bg-green-400'}`} />
          <span className="text-xs font-bold uppercase tracking-wider text-white/50">{status}</span>
          {skippedCount > 0 && (
            <span className="ml-3 text-[10px] font-bold uppercase tracking-wider text-amber-400/70">
              {skippedCount} skipped
            </span>
          )}
        </div>
        <button
          onClick={() => setShowPauseConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                     border border-white/15 text-white/50 hover:text-white hover:border-white/30
                     transition-colors bg-white/5"
        >
          ⏸ Pause & Exit
        </button>
      </div>

      {/* ── Pause confirmation dialog ── */}
      {showPauseConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel p-8 max-w-sm w-full mx-4 text-center">
            <p className="text-2xl mb-2">⏸</p>
            <h3 className="text-white font-bold text-lg mb-2">Pause Session?</h3>
            <p className="text-white/60 text-sm mb-6">
              Your progress will be saved. You can resume from where you left off.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={handlePauseAndExit} className="btn-primary px-6 py-2.5 text-sm">
                Yes, Save & Exit
              </button>
              <button
                onClick={() => setShowPauseConfirm(false)}
                className="btn-glass px-6 py-2.5 text-sm"
              >
                Keep Going
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Timer ── */}
      {timeLeft !== null && (
        <div className={`self-end mb-2 flex items-center gap-2 text-sm font-bold tabular-nums ${
          timeLeft <= 10 ? 'text-red-400' : timeLeft <= 30 ? 'text-amber-400' : 'text-white/50'
        }`}>
          ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </div>
      )}

      {/* ── Question card ── */}
      <div className="w-full mb-6">
        {isFollowupActive ? (
          <div className="rounded-2xl p-6 bg-dark-800/80 border border-primary-500/30 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-widest text-primary-400">Follow-up</span>
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
            <div className="relative">
              <QuestionCard
                question={questions[currentIndex].content}
                category={questions[currentIndex].category}
                number={currentIndex + 1}
                total={questions.length}
                dark
                actions={
                  <BookmarkButton
                    questionId={questions[currentIndex].id}
                    size="sm"
                    showLabel
                  />
                }
              />
              {isSkipped(questions[currentIndex]?.id) && (
                <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider
                                 px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Previously skipped
                </span>
              )}
            </div>
          )
        )}
      </div>

      {/* ── Follow-up panel ── */}
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

      {/* ── Live Transcript ── */}
      {!showFollowup && (
        <div className="w-full mb-6">
          <TranscriptPanel transcript={transcript} dark />
        </div>
      )}

      {/* ── Controls: Recording + Skip ── */}
      {!showFollowup && status !== 'Transcribing' && status !== 'Uploading' ? (
        <div className="flex flex-col items-center gap-4 w-full">
          <RecordingControls
            isRecording={isRecording}
            isPaused={isPaused}
            stream={liveStream}
            onRecord={handleRecord}
            onPause={handlePause}
            onStop={handleStop}
          />
          {/* Skip button */}
          {!isFollowupActive && (
            <button
              onClick={handleSkip}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-semibold
                         border border-white/10 text-white/40 hover:text-white/70
                         hover:border-white/25 bg-white/5 transition-colors"
            >
              Skip question →
            </button>
          )}
        </div>
      ) : !showFollowup ? (
        <div className="text-white/60 text-sm animate-pulse text-center">
          {status === 'Transcribing' ? '🧠 Transcribing...' : '📤 Saving...'}
        </div>
      ) : null}

      {/* ── Progress dots ── */}
      <div className="flex gap-2 mt-6">
        {questions.map((q, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all ${
              i === currentIndex
                ? 'bg-primary-500 w-4'
                : isSkipped(q.id)
                  ? 'bg-amber-400/60 w-2'
                  : i < currentIndex
                    ? 'bg-green-400 w-2'
                    : 'bg-white/20 w-2'
            }`}
            title={isSkipped(q.id) ? 'Skipped' : i < currentIndex ? 'Answered' : ''}
          />
        ))}
      </div>

    </div>
  );
}
