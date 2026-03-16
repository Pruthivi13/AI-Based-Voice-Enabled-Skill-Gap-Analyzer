/**
 * AIProcessingPage.jsx — Analysis wait state
 *
 * Maps to PRD §9.7 and UI Reference §17.4 (AI Analysis Processing).
 * Dark immersive page that communicates system activity while
 * evaluating the user's response.
 *
 * Features:
 *   • Animated brain/AI icon
 *   • "Analyzing your response using AI..." heading
 *   • Stage checklist (Speech Recognition → Text Analysis → Voice Feature → Skill Eval)
 *   • Global progress bar with percentage
 *   • Auto-navigates to /summary after simulated completion
 *
 * TODO: Connect to fetchProcessingStatus() or WebSocket for real-time updates
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassPanel from '../components/GlassPanel';
import ProgressChecklist from '../components/ProgressChecklist';

export default function AIProcessingPage() {
  const navigate = useNavigate();

  // Simulated processing stages
  const [stages, setStages] = useState([
    { id: 1, label: 'Speech Recognition', status: 'processing' },
    { id: 2, label: 'Text Analysis', status: 'pending' },
    { id: 3, label: 'Voice Feature Extraction', status: 'pending' },
    { id: 4, label: 'Skill Evaluation', status: 'pending' },
  ]);
  const [progress, setProgress] = useState(15);

  // Simulate processing pipeline progression
  useEffect(() => {
    const timers = [
      setTimeout(() => {
        setStages((s) => s.map((st) =>
          st.id === 1 ? { ...st, status: 'completed' } :
          st.id === 2 ? { ...st, status: 'processing' } : st
        ));
        setProgress(35);
      }, 1500),
      setTimeout(() => {
        setStages((s) => s.map((st) =>
          st.id <= 2 ? { ...st, status: 'completed' } :
          st.id === 3 ? { ...st, status: 'processing' } : st
        ));
        setProgress(65);
      }, 3000),
      setTimeout(() => {
        setStages((s) => s.map((st) =>
          st.id <= 3 ? { ...st, status: 'completed' } :
          st.id === 4 ? { ...st, status: 'processing' } : st
        ));
        setProgress(85);
      }, 4500),
      setTimeout(() => {
        setStages((s) => s.map((st) => ({ ...st, status: 'completed' })));
        setProgress(100);
      }, 5500),
      setTimeout(() => {
        navigate('/summary');
      }, 6500),
    ];

    return () => timers.forEach(clearTimeout);
  }, [navigate]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      {/* AI Brain Icon — animated */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500/20 to-primary-500/5
                        flex items-center justify-center animate-pulse-slow">
          <div className="w-16 h-16 rounded-full bg-primary-500/20 flex items-center justify-center">
            <span className="text-3xl">🧠</span>
          </div>
        </div>
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-full border-2 border-primary-500/20 animate-ping" />
      </div>

      {/* Heading */}
      <h2 className="text-2xl font-bold text-white mb-2 text-center">
        Analyzing your response using AI...
      </h2>
      <p className="text-sm text-white/50 mb-10 text-center">
        Our engine is evaluating your performance across key metrics.
      </p>

      {/* Processing Checklist */}
      <GlassPanel className="w-full max-w-md mb-10">
        <ProgressChecklist stages={stages} />
      </GlassPanel>

      {/* Global Progress */}
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Global Status</p>
            <p className="text-sm font-bold text-white">Processing Results</p>
          </div>
          <span className="text-lg font-bold text-primary-500">{progress}%</span>
        </div>
        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400
                       transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-white/30 mt-2 text-center">
          Almost there... Please do not close this window.
        </p>
      </div>
    </div>
  );
}
