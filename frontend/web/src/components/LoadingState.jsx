/**
 * LoadingState.jsx — Spinner / skeleton loader
 *
 * Props:
 *   message — Optional loading message
 */
import React from 'react';

export default function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-12 h-12 border-4 border-surface-200 border-t-primary-500
                      rounded-full animate-spin mb-4" />
      <p className="text-sm text-ink-500">{message}</p>
    </div>
  );
}
