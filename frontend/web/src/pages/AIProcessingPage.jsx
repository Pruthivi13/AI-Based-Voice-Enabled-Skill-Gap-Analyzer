import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProcessingStatus, generateAnalysis } from '../services/mockApi';
import GlassPanel from '../components/GlassPanel';
import ProgressChecklist from '../components/ProgressChecklist';
import BrainCircuitIcon from '../components/ui/brain-circuit-icon';

export default function AIProcessingPage() {
  const navigate = useNavigate();
  const sessionId = sessionStorage.getItem('currentSessionId');

  const [stages, setStages] = useState([
    { id: 1, label: 'Audio uploaded', status: 'pending' },
    { id: 2, label: 'Generating transcript', status: 'pending' },
    { id: 3, label: 'Running AI analysis', status: 'pending' },
    { id: 4, label: 'Preparing summary', status: 'pending' },
  ]);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      navigate('/setup');
      return;
    }

    // Trigger analysis generation first
    generateAnalysis(sessionId).catch(console.error);

    // Poll real processing status from backend
    const pollStatus = async () => {
      try {
        const data = await fetchProcessingStatus(sessionId);

        // Map real backend stages to UI stages
        const stageMap = {
          upload: 1,
          transcription: 2,
          analysis: 3,
          report: 4,
        };

        const statusMap = {
          completed: 'completed',
          in_progress: 'processing',
          pending: 'pending',
        };

        setStages([
          {
            id: 1,
            label: 'Audio uploaded',
            status:
              statusMap[
                data.stages.find((s) => s.stage === 'upload')?.status
              ] || 'pending',
          },
          {
            id: 2,
            label: 'Generating transcript',
            status:
              statusMap[
                data.stages.find((s) => s.stage === 'transcription')?.status
              ] || 'pending',
          },
          {
            id: 3,
            label: 'Running AI analysis',
            status:
              statusMap[
                data.stages.find((s) => s.stage === 'analysis')?.status
              ] || 'pending',
          },
          {
            id: 4,
            label: 'Preparing summary',
            status:
              statusMap[
                data.stages.find((s) => s.stage === 'report')?.status
              ] || 'pending',
          },
        ]);

        setProgress(data.progress || 0);

        if (data.completed) {
          setCompleted(true);
          setTimeout(() => navigate('/summary'), 1000);
        }
      } catch (err) {
        console.error('Failed to fetch status:', err);
      }
    };

    // Poll every 3 seconds
    pollStatus();
    const interval = setInterval(pollStatus, 3000);

    // Timeout after 120 seconds (as per doc)
    const timeout = setTimeout(() => {
      clearInterval(interval);
      navigate('/summary');
    }, 120000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [sessionId, navigate]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="relative mb-8">
        <div
          className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500/20 to-primary-500/5
                        flex items-center justify-center animate-pulse-slow"
        >
          <div className="w-16 h-16 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-500">
            <BrainCircuitIcon size={40} className="text-current" />
          </div>
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-primary-500/20 animate-ping" />
      </div>

      <h2 className="text-2xl font-bold text-white mb-2 text-center">
        Analyzing your response using AI...
      </h2>
      <p className="text-sm text-white/50 mb-10 text-center">
        Our engine is evaluating your performance across key metrics.
      </p>

      <GlassPanel className="w-full max-w-md mb-10">
        <ProgressChecklist stages={stages} />
      </GlassPanel>

      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">
              Global Status
            </p>
            <p className="text-sm font-bold text-white">
              {completed ? 'Complete!' : 'Processing Results'}
            </p>
          </div>
          <span className="text-lg font-bold text-primary-500">
            {progress}%
          </span>
        </div>
        <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400
                       transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-white/30 mt-2 text-center">
          {completed ? 'Redirecting...' : 'Please do not close this window.'}
        </p>
      </div>
    </div>
  );
}
