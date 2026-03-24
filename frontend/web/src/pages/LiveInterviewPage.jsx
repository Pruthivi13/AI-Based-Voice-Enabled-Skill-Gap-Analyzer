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
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadAudioPlaceholder, finishSession } from '../services/mockApi'
import QuestionCard from '../components/QuestionCard'
import TranscriptPanel from '../components/TranscriptPanel'
import RecordingControls from '../components/RecordingControls'

export default function LiveInterviewPage() {
  const navigate = useNavigate()

  // Load session data from sessionStorage
  const sessionId = sessionStorage.getItem('currentSessionId')
  const questions = JSON.parse(sessionStorage.getItem('currentQuestions') || '[]')

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [uploading, setUploading] = useState(false)

  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const startTimeRef = useRef(null)

  const currentQuestion = questions[currentIndex]

  // Redirect if no session
  useEffect(() => {
    if (!sessionId || questions.length === 0) {
      navigate('/setup')
    }
  }, [sessionId, questions, navigate])

  const handleRecord = useCallback(async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder
        audioChunksRef.current = []
        startTimeRef.current = Date.now()

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        }

        mediaRecorder.start()
        setIsRecording(true)
        setIsPaused(false)
        setTranscript('Recording... (transcript will appear after upload)')
      } catch (err) {
        alert('Microphone access denied. Please allow microphone access.')
      }
    } else if (isPaused) {
      mediaRecorderRef.current?.resume()
      setIsPaused(false)
    }
  }, [isRecording, isPaused])

  const handlePause = useCallback(() => {
    mediaRecorderRef.current?.pause()
    setIsPaused(true)
  }, [])

  const handleStop = useCallback(async () => {
    if (!mediaRecorderRef.current) return

    setUploading(true)

    mediaRecorderRef.current.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000)

      try {
        await uploadAudioPlaceholder(
          sessionId,
          currentQuestion.id,
          audioBlob,
          currentIndex + 1,
          durationSeconds
        )
      } catch (err) {
        console.error('Upload failed:', err)
      }

      setIsRecording(false)
      setIsPaused(false)
      setUploading(false)

      // Stop all tracks
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop())

      // If more questions, go to next — else finish session
      if (currentIndex < questions.length - 1) {
        setCurrentIndex((prev) => prev + 1)
        setTranscript('')
      } else {
        // Last question — finish session and go to processing
        try {
          await finishSession(sessionId)
        } catch (err) {
          console.error('Finish session failed:', err)
        }
        navigate('/processing')
      }
    }

    mediaRecorderRef.current.stop()
  }, [sessionId, currentQuestion, currentIndex, questions, navigate])

  if (!currentQuestion) return null

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-4xl mx-auto w-full">
      {/* AI Status */}
      <div className="self-end mb-6 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${isRecording && !isPaused ? 'bg-red-400 animate-pulse' : 'bg-green-400'}`} />
        <span className="text-xs font-bold uppercase tracking-wider text-white/50">
          {uploading ? 'Uploading...' : isRecording ? 'Recording' : 'Ready'}
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

      {/* Recording Controls */}
      {!uploading ? (
        <RecordingControls
          isRecording={isRecording}
          isPaused={isPaused}
          onRecord={handleRecord}
          onPause={handlePause}
          onStop={handleStop}
        />
      ) : (
        <div className="text-white/60 text-sm animate-pulse">
          Uploading your answer...
        </div>
      )}

      {/* Question Navigation Dots */}
      <div className="flex gap-2 mt-6">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i === currentIndex
                ? 'bg-primary-500 w-4'
                : i < currentIndex
                ? 'bg-green-400'
                : 'bg-white/20'
            }`}
          />
        ))}
      </div>
    </div>
  )
}