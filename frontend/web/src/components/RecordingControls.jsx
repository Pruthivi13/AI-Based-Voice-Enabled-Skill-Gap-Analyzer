/**
 * RecordingControls.jsx — Microphone record/pause/stop controls
 *
 * Renders a floating control bar with:
 *   • Pause  — pauses recording
 *   • Record — main mic button (pulsing when active)
 *   • Stop   — stops and submits recording
 *
 * Props:
 *   isRecording — Boolean, whether currently recording
 *   isPaused    — Boolean, whether paused
 *   onRecord    — Handler to start/resume recording
 *   onPause     — Handler to pause
 *   onStop      — Handler to stop
 *
 * TODO: Connect to browser MediaRecorder API and audio upload service
 */
import React from 'react';

const WAVEFORM_BARS = [0, 1, 2, 3, 4, 5, 6];

export default function RecordingControls({ isRecording, isPaused, onRecord, onPause, onStop }) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Waveform placeholder — visual response to voice input */}
      {/* TODO: Replace with real audio visualization (canvas/SVG) */}
      <div className="flex items-end gap-1 h-8">
        {WAVEFORM_BARS.map((i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-300 ${
              isRecording && !isPaused
                ? 'bg-primary-500 animate-waveform'
                : 'bg-white/20 h-3'
            }`}
            style={{
              animationDelay: `${i * 0.15}s`,
              height: isRecording && !isPaused ? undefined : '12px',
            }}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="glass-panel px-6 py-4 flex items-center gap-6">
        {/* Pause */}
        <button
          onClick={onPause}
          disabled={!isRecording}
          className="flex flex-col items-center gap-1 disabled:opacity-30 transition-opacity"
          aria-label="Pause recording"
        >
          <div className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
                          flex items-center justify-center transition-colors">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-white/50">Pause</span>
        </button>

        {/* Record — main button */}
        <button
          onClick={onRecord}
          className="flex flex-col items-center gap-1"
          aria-label={isRecording ? 'Recording' : 'Start recording'}
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center
                           transition-all duration-300 ${
                             isRecording && !isPaused
                               ? 'bg-red-500 glow-orange scale-110'
                               : 'bg-primary-500 hover:bg-primary-600'
                           }`}>
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          <span className={`text-[10px] uppercase tracking-wider ${
            isRecording && !isPaused ? 'text-red-400' : 'text-white/50'
          }`}>
            {isRecording && !isPaused ? 'Recording' : 'Record'}
          </span>
        </button>

        {/* Stop */}
        <button
          onClick={onStop}
          disabled={!isRecording}
          className="flex flex-col items-center gap-1 disabled:opacity-30 transition-opacity"
          aria-label="Stop recording"
        >
          <div className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20
                          flex items-center justify-center transition-colors">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-white/50">Stop</span>
        </button>
      </div>
    </div>
  );
}
