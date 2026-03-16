/**
 * ImmersiveLayout.jsx — Dark full-screen layout
 *
 * Used for emotionally important screens:
 *   • Live Interview (dark focus mode)
 *   • AI Processing (analysis wait state)
 *   • Practice Summary
 *
 * Minimal nav: compact header with logo and close/exit action.
 */
import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

export default function ImmersiveLayout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col gradient-dark text-white">
      {/* Compact immersive header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          {/* Brand mark */}
          <div className="w-9 h-9 rounded-lg bg-primary-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
          <span className="text-lg font-bold">AI Interview Assistant</span>
        </div>

        {/* Close / Exit */}
        <button
          onClick={() => navigate('/dashboard')}
          className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20
                     flex items-center justify-center transition-colors"
          aria-label="Exit to dashboard"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Page content */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
