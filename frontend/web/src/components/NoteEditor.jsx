/**
 * NoteEditor.jsx — Per-question note editor
 *
 * Matches the project's dark glassmorphism + orange-accent design language.
 * Used on LiveInterviewPage (inline) and SessionReviewPage (expanded).
 *
 * Props:
 *   sessionId    — string (required)
 *   questionId   — string (required)
 *   initialNote  — string | null (pre-loaded note text)
 *   mode         — 'inline' | 'expanded'  (default 'inline')
 *   isDark       — boolean (from ThemeContext)
 *   onSave       — (note: string) => void  optional callback
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StickyNote, Check, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { saveNote } from '../services/api';

// ─── character limit ──────────────────────────────────────────────────────────
const MAX_CHARS = 500;

// ─── Auto-save debounce ms ────────────────────────────────────────────────────
const AUTOSAVE_DELAY = 1200;

export default function NoteEditor({
  sessionId,
  questionId,
  initialNote = '',
  mode = 'inline',
  isDark = true,
  onSave,
}) {
  const [isOpen,    setIsOpen]    = useState(false);
  const [text,      setText]      = useState(initialNote || '');
  const [saved,     setSaved]     = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const textareaRef = useRef(null);
  const debounceRef = useRef(null);
  const prevTextRef = useRef(initialNote || '');

  // Sync if parent passes a new initialNote (e.g. loaded from API)
  useEffect(() => {
    setText(initialNote || '');
    prevTextRef.current = initialNote || '';
  }, [initialNote]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 120);
    }
  }, [isOpen]);

  // ── Auto-save on text change ──────────────────────────────────────────────
  const persistNote = useCallback(async (value) => {
    if (value === prevTextRef.current) return; // no change
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await saveNote(sessionId, questionId, value);
      prevTextRef.current = value;
      setSaved(true);
      onSave?.(value);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  }, [sessionId, questionId, onSave]);

  const handleChange = (e) => {
    const value = e.target.value;
    if (value.length > MAX_CHARS) return;
    setText(value);
    setSaved(false);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persistNote(value), AUTOSAVE_DELAY);
  };

  const handleSaveNow = () => {
    clearTimeout(debounceRef.current);
    persistNote(text);
  };

  const handleDiscard = () => {
    clearTimeout(debounceRef.current);
    setText(prevTextRef.current);
    setIsOpen(false);
    setError('');
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
    };
  }, []);

  const hasNote  = text.trim().length > 0;
  const charLeft = MAX_CHARS - text.length;

  // ── Design tokens (match project) ────────────────────────────────────────
  const panelBg   = isDark ? 'rgba(14,20,32,0.95)' : 'rgba(255,255,255,0.97)';
  const borderCol = isDark ? 'rgba(249,115,22,0.30)' : 'rgba(249,115,22,0.25)';
  const textCol   = isDark ? '#f1f5f9'               : '#1c1917';
  const mutedCol  = isDark ? 'rgba(255,255,255,0.35)' : '#78716c';
  const inputBg   = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const inputBdr  = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';

  // ── Trigger button ────────────────────────────────────────────────────────
  const trigger = (
    <motion.button
      whileTap={{ scale: 0.93 }}
      onClick={() => setIsOpen(!isOpen)}
      title={hasNote ? 'View / edit note' : 'Add a note'}
      style={{
        position:       'relative',
        display:        'inline-flex',
        alignItems:     'center',
        gap:             6,
        padding:        mode === 'expanded' ? '7px 14px' : '5px 11px',
        borderRadius:    99,
        border:         `1px solid ${hasNote ? borderCol : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
        background:     hasNote ? (isDark ? 'rgba(249,115,22,0.09)' : 'rgba(249,115,22,0.07)') : 'transparent',
        color:          hasNote ? '#f97316' : mutedCol,
        fontSize:        12,
        fontWeight:      600,
        cursor:         'pointer',
        transition:     'all 0.18s ease',
        whiteSpace:     'nowrap',
      }}
    >
      <StickyNote size={13} strokeWidth={2.2} />
      {mode === 'expanded'
        ? (hasNote ? 'Edit Note' : 'Add Note')
        : 'Note'}
      {hasNote && (
        <span style={{
          width:      6, height: 6, borderRadius: '50%',
          background: '#f97316', flexShrink: 0,
        }} />
      )}
      {mode === 'expanded'
        ? (isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
        : null}
    </motion.button>
  );

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {trigger}

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop (dismiss on outside click for BOTH modes) */}
            <div
              onClick={handleDiscard}
              style={{
                position: 'fixed', inset: 0,
                zIndex: 49, background: 'transparent',
              }}
            />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit={{    opacity: 0, y: -6, scale: 0.96  }}
              transition={{ type: 'spring', stiffness: 380, damping: 28, mass: 0.8 }}
              style={{
                position:    'absolute',
                top:         'calc(100% + 8px)',
                right:       0,
                zIndex:      50,
                width:       340,
                marginTop:   0,
                borderRadius: 16,
                background:  panelBg,
                border:      `1px solid ${borderCol}`,
                backdropFilter: 'blur(20px)',
                boxShadow:   isDark
                  ? '0 20px 60px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(249,115,22,0.15)'
                  : '0 12px 40px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(249,115,22,0.2)',
                overflow:    'hidden',
              }}
            >
              {/* ── Header ── */}
              <div style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                padding:        '12px 14px 10px',
                borderBottom:   `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <StickyNote size={14} color="#f97316" strokeWidth={2.2} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em',
                                 textTransform: 'uppercase', color: '#f97316' }}>
                    Question Note
                  </span>
                </div>
                {/* Status pill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AnimatePresence mode="wait">
                    {saving && (
                      <motion.div
                        key="saving"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ display: 'flex', alignItems: 'center', gap: 4,
                                 fontSize: 10, fontWeight: 600, color: mutedCol }}
                      >
                        <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} />
                        Saving…
                      </motion.div>
                    )}
                    {saved && !saving && (
                      <motion.div
                        key="saved"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1,  scale: 1   }}
                        exit={{    opacity: 0               }}
                        style={{ display: 'flex', alignItems: 'center', gap: 4,
                                 fontSize: 10, fontWeight: 700, color: '#22c55e' }}
                      >
                        <Check size={11} /> Saved
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={handleDiscard}
                    style={{
                      width: 22, height: 22, borderRadius: 6,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'transparent', border: 'none',
                      color: mutedCol, cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* ── Textarea ── */}
              <div style={{ padding: '12px 14px' }}>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={handleChange}
                  placeholder="Jot down your thoughts, key points, or things to remember about this question…"
                  rows={mode === 'expanded' ? 5 : 4}
                  style={{
                    width:           '100%',
                    background:      inputBg,
                    border:         `1px solid ${inputBdr}`,
                    borderRadius:    10,
                    padding:        '10px 12px',
                    fontSize:        13,
                    lineHeight:      1.6,
                    color:           textCol,
                    resize:         'vertical',
                    outline:        'none',
                    fontFamily:     'inherit',
                    boxSizing:      'border-box',
                    transition:     'border-color 0.15s',
                    minHeight:      mode === 'expanded' ? 120 : 96,
                  }}
                  onFocus={e  => e.target.style.borderColor = 'rgba(249,115,22,0.45)'}
                  onBlur={e   => e.target.style.borderColor = inputBdr}
                />

                {/* Error */}
                {error && (
                  <p style={{ fontSize: 11, color: '#ef4444', marginTop: 5, fontWeight: 600 }}>
                    {error}
                  </p>
                )}

                {/* ── Footer ── */}
                <div style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  marginTop:       10,
                }}>
                  {/* Char counter */}
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    color: charLeft < 50 ? '#ef4444' : mutedCol,
                  }}>
                    {charLeft} left
                  </span>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button
                      onClick={handleDiscard}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 12,
                        fontWeight: 600, border: `1px solid ${inputBdr}`,
                        background: 'transparent', color: mutedCol,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = textCol; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = inputBdr; e.currentTarget.style.color = mutedCol; }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNow}
                      disabled={saving}
                      style={{
                        padding: '6px 14px', borderRadius: 8, fontSize: 12,
                        fontWeight: 700, border: 'none',
                        background: saving ? 'rgba(249,115,22,0.4)' : '#f97316',
                        color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#ea6a0a'; }}
                      onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#f97316'; }}
                    >
                      {saving
                        ? <><Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> Saving</>
                        : <><Check size={11} /> Save Note</>}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
