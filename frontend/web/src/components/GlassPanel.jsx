/**
 * GlassPanel.jsx — Glassmorphism container
 *
 * Used on dark immersive pages (interview, processing) to create
 * frosted translucent card surfaces per design.md §2.4.
 *
 * Props:
 *   children  — Content
 *   className — Extra classes
 */
import React from 'react';

export default function GlassPanel({ children, className = '' }) {
  return (
    <div className={`glass-panel p-6 ${className}`}>
      {children}
    </div>
  );
}
