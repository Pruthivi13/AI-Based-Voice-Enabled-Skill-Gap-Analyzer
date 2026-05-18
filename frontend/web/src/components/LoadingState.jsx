/**
 * LoadingState.jsx — Minimalist Spinner / skeleton loader
 *
 * Props:
 *   message — Optional loading message
 */
import React from 'react';

export default function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-20 w-full h-full min-h-[50vh]">
      <div className="flex flex-col items-center animate-in fade-in duration-700">
        <div className="w-10 h-10 border-2 border-ink-200 dark:border-white/10 border-t-primary-500 dark:border-t-primary-500 rounded-full animate-spin mb-6" />
        <p className="text-sm text-ink-500 dark:text-white/50 font-medium tracking-wide">
          {message}
        </p>
      </div>
    </div>
  );
}
