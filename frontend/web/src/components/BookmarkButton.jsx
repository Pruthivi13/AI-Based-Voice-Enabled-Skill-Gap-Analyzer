/**
 * BookmarkButton.jsx
 *
 * Drop-in bookmark toggle for any question card.
 *
 * Props:
 *   questionId  — string (required)
 *   initialState — boolean (optional, default false)
 *   size        — 'sm' | 'md' (default 'md')
 *   showLabel   — boolean (show "Saved" / "Save" text)
 *   onToggle    — (bookmarked: boolean) => void   optional callback
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { toggleBookmark } from '../services/api';

export default function BookmarkButton({
  questionId,
  initialState = false,
  size = 'md',
  showLabel = false,
  onToggle,
}) {
  const [bookmarked, setBookmarked] = useState(initialState);
  const [loading, setLoading]       = useState(false);
  const [burst, setBurst]           = useState(false);

  const iconSize  = size === 'sm' ? 15 : 18;
  const padClass  = size === 'sm' ? 'p-1.5' : 'p-2';

  const handleClick = async (e) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const result = await toggleBookmark(questionId);
      setBookmarked(result.bookmarked);
      if (result.bookmarked) {
        setBurst(true);
        setTimeout(() => setBurst(false), 600);
      }
      onToggle?.(result.bookmarked);
    } catch (err) {
      console.error('Bookmark toggle failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={bookmarked ? 'Remove bookmark' : 'Bookmark this question'}
      className={`
        relative inline-flex items-center gap-1.5
        ${padClass} rounded-xl
        border transition-all duration-200 select-none
        ${bookmarked
          ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25'
          : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70'
        }
        disabled:opacity-50
      `}
      aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark question'}
      aria-pressed={bookmarked}
    >
      {/* Pop rings on save */}
      {burst && (
        <>
          <span
            className="absolute inset-0 rounded-xl border-2 border-amber-400 pointer-events-none"
            style={{ animation: 'bookmarkRing 0.55s ease-out forwards' }}
          />
          <span
            className="absolute inset-0 rounded-xl border border-amber-400/50 pointer-events-none"
            style={{ animation: 'bookmarkRing 0.55s ease-out 0.1s forwards' }}
          />
        </>
      )}

      <motion.span
        key={bookmarked ? 'saved' : 'unsaved'}
        initial={{ scale: 0.6, rotate: -15, opacity: 0 }}
        animate={{ scale: 1,   rotate: 0,   opacity: 1 }}
        exit={{    scale: 0.6, rotate: 15,  opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 22 }}
      >
        {bookmarked
          ? <BookmarkCheck size={iconSize} strokeWidth={2.2} />
          : <Bookmark      size={iconSize} strokeWidth={2.2} />
        }
      </motion.span>

      {showLabel && (
        <span className="text-xs font-semibold whitespace-nowrap">
          {bookmarked ? 'Saved' : 'Save'}
        </span>
      )}

      <style>{`
        @keyframes bookmarkRing {
          0%   { opacity: 0.8; transform: scale(1); }
          100% { opacity: 0;   transform: scale(1.55); }
        }
      `}</style>
    </button>
  );
}
