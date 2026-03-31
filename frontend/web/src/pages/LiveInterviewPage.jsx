import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { finishSession, saveTranscript } from '../services/mockApi';
import QuestionCard from '../components/QuestionCard';
import TranscriptPanel from '../components/TranscriptPanel';
import RecordingControls from '../components/RecordingControls';

export default function LiveInterviewPage() {
  const navigate = useNavigate();

  const sessionId = sessionStorage.getItem('currentSessionId');
  const questions = JSON.parse(
    sessionStorage.getItem('currentQuestions') || '[]'
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState('Ready');
  const [timeLeft, setTimeLeft] = useState(null);

  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const currentIndexRef = useRef(0);

  const startTimer = useCallback((seconds) => {
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleStop(); // auto-stop when time runs out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Keep ref in sync with state
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    if (!sessionId || questions.length === 0) {
      navigate('/setup');
    }
    return () => {
      wsRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      clearInterval(timerRef.current);
    };
  }, []);

  const currentQuestion = questions[currentIndex];

  const handleRecord = useCallback(async () => {
    if (isPaused) {
      mediaRecorderRef.current?.resume();
      setIsPaused(false);
      setStatus('Recording');
      return;
    }

    if (isRecording) return;

    try {
      // 1 — Get mic access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 2 — Open WebSocket to Node proxy
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const wsUrl = API_URL.replace('http', 'ws');
      const questionId = questions[currentIndexRef.current]?.id;
      const ws = new WebSocket(`${wsUrl}/ws/transcribe/${questionId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = async (event) => {
        // Convert Blob to text first if needed
        const raw =
          event.data instanceof Blob ? await event.data.text() : event.data;

        let msg;
        try {
          msg = JSON.parse(raw);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', raw);
          return;
        }

        if (msg.type === 'partial') {
          setTranscript(msg.text);
        }

        if (msg.type === 'final') {
          stopTimer();
          setTranscript(msg.text);
          setStatus('Ready');
          setIsRecording(false);
          setIsPaused(false);

          // Use ref to avoid stale closure
          const idx = currentIndexRef.current;
          const questionId = questions[idx]?.id;

          // ← Save transcript to DB
          try {
            await saveTranscript(sessionId, questionId, msg.text, idx + 1);
          } catch (err) {
            console.error('Failed to save transcript:', err);
          }

          if (idx < questions.length - 1) {
            // Move to next question
            setCurrentIndex(idx + 1);
            currentIndexRef.current = idx + 1;
            setTranscript('');
            setStatus('Ready');
            ws.close();
          } else {
            // Last question — finish session
            setStatus('Uploading');
            finishSession(sessionId)
              .catch(console.error)
              .finally(() => {
                ws.close();
                navigate('/processing');
              });
          }
        }

        if (msg.type === 'error') {
          console.error('WebSocket error from server:', msg.message);
          setStatus('Ready');
          setIsRecording(false);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setStatus('Ready');
        setIsRecording(false);
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
      };

      // 3 — Start MediaRecorder, stream chunks via WebSocket
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
        }
      };

      mediaRecorder.start(200); // chunk every 200ms
      startTimer(questions[currentIndexRef.current]?.timeLimitSeconds || 120);
      setIsRecording(true);
      setIsPaused(false);
      setTranscript('Listening...');
      setStatus('Recording');
    } catch (err) {
      console.error('Mic error:', err);
      alert('Microphone access denied. Please allow microphone access.');
    }
  }, [isRecording, isPaused, questions, sessionId, navigate]);

  const handlePause = useCallback(() => {
    mediaRecorderRef.current?.pause();
    setIsPaused(true);
    setStatus('Paused');
  }, []);

  const handleStop = useCallback(() => {
    if (!mediaRecorderRef.current) return;
    stopTimer();

    mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());

    setIsRecording(false);
    setIsPaused(false);
    setStatus('Transcribing');
    setTranscript('Transcribing your answer...');

    // Signal end of audio to ML service
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(new TextEncoder().encode('END'));
    }
  }, []);

  if (!currentQuestion) return null;

  const statusColor = {
    Ready: 'bg-green-400',
    Recording: 'bg-red-400 animate-pulse',
    Paused: 'bg-amber-400',
    Transcribing: 'bg-blue-400 animate-pulse',
    Uploading: 'bg-purple-400 animate-pulse',
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-4xl mx-auto w-full">
      {/* Status indicator */}
      <div className="self-end mb-6 flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${statusColor[status] || 'bg-green-400'}`}
        />
        <span className="text-xs font-bold uppercase tracking-wider text-white/50">
          {status}
        </span>
      </div>

      {/* Timer */}
      {timeLeft !== null && (
        <div className={`self-end mb-2 flex items-center gap-2 text-sm font-bold tabular-nums ${
          timeLeft <= 10
            ? 'text-red-400'
            : timeLeft <= 30
            ? 'text-amber-400'
            : 'text-white/50'
        }`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </div>
      )}

      {/* Question Card */}
      <div className="w-full mb-8">
        <QuestionCard
          question={currentQuestion.content}
          category={currentQuestion.category}
          number={currentIndex + 1}
          total={questions.length}
          dark
        />
      </div>

      {/* Live Transcript Panel */}
      <div className="w-full mb-10">
        <TranscriptPanel transcript={transcript} dark />
      </div>

      {/* Recording Controls */}
      {status !== 'Transcribing' && status !== 'Uploading' ? (
        <RecordingControls
          isRecording={isRecording}
          isPaused={isPaused}
          onRecord={handleRecord}
          onPause={handlePause}
          onStop={handleStop}
        />
      ) : (
        <div className="text-white/60 text-sm animate-pulse text-center">
          {status === 'Transcribing'
            ? '🧠 AI is transcribing your answer...'
            : '📤 Saving your session...'}
        </div>
      )}

      {/* Question progress dots */}
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
