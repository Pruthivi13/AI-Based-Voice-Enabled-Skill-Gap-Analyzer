/**
 * NoteDisplay.jsx — Read-only note display with expand/collapse
 *
 * Used on SessionReviewPage to show saved notes alongside transcripts.
 * Matches the project's glass/dark design language.
 *
 * Props:
 *   note    — string | null
 *   isDark  — boolean
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StickyNote, ChevronDown, ChevronUp } from 'lucide-react';

export default function NoteDisplay({ note, isDark = true }) {
  const [expanded, setExpanded] = useState(false);

  if (!note || note.trim().length === 0) return null;

  const isLong   = note.length > 140;
  const preview  = isLong && !expanded ? note.slice(0, 140) + '…' : note;

  const bg     = isDark ? 'rgba(249,115,22,0.06)' : 'rgba(249,115,22,0.04)';
  const border = isDark ? 'rgba(249,115,22,0.20)' : 'rgba(249,115,22,0.18)';
  const text   = isDark ? 'rgba(255,255,255,0.75)' : '#44403c';

  return (
    <div style={{
      background:   bg,
      border:       `1px solid ${border}`,
      borderRadius: 12,
      padding:      '11px 14px',
      marginTop:     10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <StickyNote size={13} color="#f97316" strokeWidth={2.2} style={{ marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#f97316',
            display: 'block', marginBottom: 5,
          }}>
            Your Note
          </span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={expanded ? 'expanded' : 'collapsed'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              style={{
                fontSize: 12.5, lineHeight: 1.65, color: text,
                margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}
            >
              {preview}
            </motion.p>
          </AnimatePresence>
          {isLong && (
            <button
              onClick={() => setExpanded(v => !v)}
              style={{
                marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 11, fontWeight: 600, color: '#f97316',
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              }}
            >
              {expanded ? <><ChevronUp size={11} /> Show less</> : <><ChevronDown size={11} /> Show more</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
