/**
 * LiveInterviewPage.jsx — Core interview experience
 *
 * Maps to PRD §9.4, §9.5 and UI Reference §17.3 (Interview Interaction).
 * This is the most emotionally important screen — immersive, dark, focused.
 *
 * Features:
 *   • Current question display (QuestionCard)
 *   • AI status indicator
 *   • Live transcript panel (placeholder until ASR is connected)
 *   • Waveform/recording visual
 *   • Record/Pause/Stop controls
 *   • Question progress tracker
 *
 * State flow:
 *   idle → recording → paused/recording → stopped → processing
 *   After stop: navigate to /processing
 *
 * TODO: Connect to browser MediaRecorder API for real audio capture
 * TODO: Wire transcript to real-time ASR results
 */
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockQuestions } from '../data/mockData';
import QuestionCard from '../components/QuestionCard';
import TranscriptPanel from '../components/TranscriptPanel';
import RecordingControls from '../components/RecordingControls';

export default function LiveInterviewPage() {
  const navigate = useNavigate();
  const questions = mockQuestions; // TODO: Replace with fetchQuestions(sessionId)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Placeholder transcript — will come from ASR in production
  const [transcript, setTranscript] = useState('');

  const currentQuestion = questions[currentIndex];

  const handleRecord = useCallback(() => {
    if (!isRecording) {
      setIsRecording(true);
      setIsPaused(false);
      // Simulate live transcript appearing
      setTimeout(() => {
        setTranscript(
          'In my final year project I developed a web application using React and ' +
          'Node.js. One of the biggest challenges was handling real-time data ' +
          'synchronization between multiple clients.'
        );
      }, 2000);
    } else if (isPaused) {
      setIsPaused(false);
    }
  }, [isRecording, isPaused]);

  const handlePause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handleStop = useCallback(() => {
    setIsRecording(false);
    setIsPaused(false);
    // Navigate to AI processing screen
    // TODO: Call uploadAudioPlaceholder() before navigating
    navigate('/processing');
  }, [navigate]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-4xl mx-auto w-full">
      {/* AI Status */}
      <div className="self-end mb-6 flex items-center gap-2">
        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="text-xs font-bold uppercase tracking-wider text-white/50">
          AI Status: {isRecording ? 'Listening' : 'Ready'}
        </span>
      </div>

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

      {/* Transcript Panel */}
      <div className="w-full mb-10">
        <TranscriptPanel transcript={transcript} dark />
      </div>

      {/* Recording Controls + Waveform */}
      <RecordingControls
        isRecording={isRecording}
        isPaused={isPaused}
        onRecord={handleRecord}
        onPause={handlePause}
        onStop={handleStop}
      />
    </div>
  );
}
