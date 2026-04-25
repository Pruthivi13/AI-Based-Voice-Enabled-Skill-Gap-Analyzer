/**
 * BookmarksPage.jsx  —  /bookmarks
 *
 * Shows all questions the user has bookmarked.
 * Features:
 *  • Category filter tabs (All | Technical | HR | Communication | Behavioral)
 *  • Difficulty filter chips (All | Easy | Medium | Hard)
 *  • Per-card: question text, category chip, difficulty badge, note, timestamps
 *  • Inline note editor per bookmark
 *  • Quick-practice button (starts a 1-question session)
 *  • Remove bookmark button with undo toast
 *  • Empty state with CTA
 *  • Responsive 1-2 column grid
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bookmark,
  BookmarkX,
  Play,
  Pencil,
  Check,
  X,
  Clock,
  SlidersHorizontal,
  BookOpen,
  ChevronDown,
} from 'lucide-react';
import {
  fetchBookmarks,
  deleteBookmark,
  updateBookmarkNote,
  createInterviewSession,
} from '../services/api';
import { useTheme } from '../context/ThemeContext';
import LoadingState from '../components/LoadingState';

// ─── Difficulty badge ─────────────────────────────────────────────────────────
const DIFF_STYLE = {
  EASY:   { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Easy'   },
  MEDIUM: { bg: 'bg-amber-500/15',   text: 'text-amber-400',   label: 'Medium' },
  HARD:   { bg: 'bg-red-500/15',     text: 'text-red-400',     label: 'Hard'   },
};

const CAT_STYLE = {
  TECHNICAL:     { bg: 'bg-sky-500/15',     text: 'text-sky-400'     },
  HR:            { bg: 'bg-pink-500/15',    text: 'text-pink-400'    },
  COMMUNICATION: { bg: 'bg-violet-500/15',  text: 'text-violet-400'  },
  BEHAVIORAL:    { bg: 'bg-orange-500/15',  text: 'text-orange-400'  },
};

// ─── Single bookmark card ─────────────────────────────────────────────────────
function BookmarkCard({ item, isDark, onRemove, onPractice }) {
  const { bookmarkId, note, bookmarkedAt, question } = item;
  const [editingNote, setEditingNote] = useState(false);
  const [draftNote,   setDraftNote]   = useState(note ?? '');
  const [saving,      setSaving]      = useState(false);
  const [removing,    setRemoving]    = useState(false);

  const diff = DIFF_STYLE[question.difficulty] || DIFF_STYLE.MEDIUM;
  const cat  = CAT_STYLE[question.category]    || {};

  const handleSaveNote = async () => {
    setSaving(true);
    try {
      await updateBookmarkNote(question.id, draftNote);
      item.note = draftNote;   // optimistic local update
      setEditingNote(false);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await deleteBookmark(bookmarkId);
      onRemove(bookmarkId);
    } catch {
      setRemoving(false);
    }
  };

  const cardBg     = isDark ? 'bg-dark-800 border-dark-700/60'       : 'bg-white border-surface-200';
  const subText    = isDark ? 'text-white/40'                         : 'text-ink-500';
  const bodyText   = isDark ? 'text-white/80'                         : 'text-ink-700';
  const noteArea   = isDark ? 'bg-white/5 border-dark-700 text-white' : 'bg-surface-50 border-surface-200 text-ink-900';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: removing ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.22 }}
      className={`rounded-2xl border p-5 flex flex-col gap-4 transition-shadow hover:shadow-elevated ${cardBg}`}
    >
      {/* ── Header row ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Category chip */}
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${cat.bg} ${cat.text}`}>
            {question.category}
          </span>
          {/* Difficulty chip */}
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${diff.bg} ${diff.text}`}>
            {diff.label}
          </span>
          {/* Time limit */}
          {question.timeLimitSeconds && (
            <span className={`flex items-center gap-1 text-[10px] font-semibold ${subText}`}>
              <Clock size={10} />
              {Math.floor(question.timeLimitSeconds / 60)}m
            </span>
          )}
        </div>

        {/* Remove button */}
        <button
          onClick={handleRemove}
          disabled={removing}
          title="Remove bookmark"
          className={`p-1.5 rounded-lg transition-colors shrink-0 ${
            isDark
              ? 'text-white/25 hover:text-red-400 hover:bg-red-500/10'
              : 'text-ink-400 hover:text-red-500 hover:bg-red-50'
          } disabled:opacity-30`}
        >
          <BookmarkX size={16} />
        </button>
      </div>

      {/* ── Question text ── */}
      <p className={`text-sm font-medium leading-relaxed ${bodyText}`}>
        {question.content}
      </p>

      {/* ── Hints (collapsed by default) ── */}
      {Array.isArray(question.hints) && question.hints.length > 0 && (
        <details className="group">
          <summary className={`text-[11px] font-semibold cursor-pointer list-none flex items-center gap-1 ${subText} hover:text-amber-400 transition-colors`}>
            <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
            {question.hints.length} hint{question.hints.length > 1 ? 's' : ''}
          </summary>
          <ul className="mt-2 space-y-1.5 pl-1">
            {question.hints.map((hint, i) => (
              <li key={i} className={`flex items-start gap-2 text-[11px] leading-relaxed ${subText}`}>
                <span className="text-amber-400 mt-0.5 shrink-0">•</span>
                {hint}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* ── Note section ── */}
      <div>
        {editingNote ? (
          <div className="flex flex-col gap-2">
            <textarea
              rows={2}
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder="Add a note for yourself..."
              className={`w-full text-xs rounded-xl px-3 py-2.5 border resize-none outline-none
                          focus:ring-2 focus:ring-primary-500/40 transition-all ${noteArea}`}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveNote}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-500 text-white text-[11px] font-semibold disabled:opacity-50 transition-opacity"
              >
                <Check size={11} /> {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => { setEditingNote(false); setDraftNote(note ?? ''); }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                  isDark ? 'border-white/10 text-white/50 hover:bg-white/5' : 'border-surface-200 text-ink-500 hover:bg-surface-100'
                }`}
              >
                <X size={11} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditingNote(true)}
            className={`flex items-start gap-2 w-full text-left group rounded-xl px-3 py-2 border border-dashed transition-colors ${
              isDark
                ? 'border-white/10 hover:border-amber-500/40 hover:bg-amber-500/5'
                : 'border-surface-200 hover:border-amber-400/50 hover:bg-amber-50'
            }`}
          >
            <Pencil size={11} className={`mt-0.5 shrink-0 transition-colors ${isDark ? 'text-white/20 group-hover:text-amber-400' : 'text-ink-400 group-hover:text-amber-600'}`} />
            <span className={`text-[11px] italic leading-relaxed ${isDark ? 'text-white/30 group-hover:text-white/60' : 'text-ink-400 group-hover:text-ink-600'}`}>
              {note || 'Add a note…'}
            </span>
          </button>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between pt-1">
        <span className={`text-[10px] font-medium ${subText}`}>
          Saved {new Date(bookmarkedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>

        <button
          onClick={() => onPractice(question)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-full
                     bg-primary-500 text-white text-xs font-semibold
                     hover:bg-primary-600 active:scale-95 transition-all"
        >
          <Play size={11} className="fill-current" />
          Practice
        </button>
      </div>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const CATEGORY_TABS = ['All', 'TECHNICAL', 'HR', 'COMMUNICATION', 'BEHAVIORAL'];
const DIFFICULTY_OPTS = ['All', 'EASY', 'MEDIUM', 'HARD'];

export default function BookmarksPage() {
  const navigate  = useNavigate();
  const { isDark } = useTheme();

  const [bookmarks, setBookmarks] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [catFilter, setCatFilter] = useState('All');
  const [diffFilter,setDiffFilter]= useState('All');
  const [toast,     setToast]     = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchBookmarks()
      .then(setBookmarks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return bookmarks.filter((b) => {
      const catOk  = catFilter  === 'All' || b.question.category  === catFilter;
      const diffOk = diffFilter === 'All' || b.question.difficulty === diffFilter;
      return catOk && diffOk;
    });
  }, [bookmarks, catFilter, diffFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRemove = useCallback((bookmarkId) => {
    setBookmarks((prev) => prev.filter((b) => b.bookmarkId !== bookmarkId));
    showToast('Bookmark removed');
  }, []);

  const handlePractice = useCallback(async (question) => {
    try {
      const result = await createInterviewSession({
        interviewType: question.category === 'HR' ? 'HR' : 'TECHNICAL',
        targetRole:    question.role || 'General',
        difficulty:    question.difficulty,
        questionCount: 1,
      });
      sessionStorage.setItem('currentSessionId', result.sessionId);
      sessionStorage.setItem('currentQuestions', JSON.stringify([question]));
      navigate('/interview');
    } catch (err) {
      console.error('Practice start failed:', err);
    }
  }, [navigate]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  // ── Derived counts ─────────────────────────────────────────────────────────
  const countByCat = useMemo(() => {
    const m = { All: bookmarks.length };
    bookmarks.forEach((b) => {
      m[b.question.category] = (m[b.question.category] || 0) + 1;
    });
    return m;
  }, [bookmarks]);

  // ── Colors ─────────────────────────────────────────────────────────────────
  const headColor = isDark ? '#f1f5f9' : '#1c1917';
  const subColor  = isDark ? 'rgba(255,255,255,0.45)' : '#78716c';
  const chipBase  = isDark
    ? 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
    : 'bg-white border-surface-200 text-ink-600 hover:border-primary-300 hover:text-ink-900';
  const chipActive = 'bg-primary-500 text-white border-primary-500 shadow-sm';

  if (loading) return <LoadingState message="Loading bookmarks…" />;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 relative">

      {/* ── Header ── */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Bookmark size={20} className="text-amber-400" strokeWidth={2.2} />
            </div>
            <h1 style={{ color: headColor, margin: 0 }}>Saved Questions</h1>
          </div>
          <p style={{ color: subColor, fontSize: 14, margin: 0 }}>
            {bookmarks.length} question{bookmarks.length !== 1 ? 's' : ''} bookmarked for later practice.
          </p>
        </div>
        {bookmarks.length > 0 && (
          <button
            onClick={() => navigate('/setup')}
            className="btn-primary text-sm py-2.5 px-6"
          >
            ＋ New Practice
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      {bookmarks.length > 0 && (
        <div className="flex flex-col gap-3 mb-8">
          {/* Category tabs */}
          <div className="flex flex-wrap gap-2">
            {CATEGORY_TABS.map((cat) => {
              const count  = countByCat[cat] ?? 0;
              const active = catFilter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCatFilter(cat)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${active ? chipActive : chipBase}`}
                >
                  {cat === 'All' ? 'All' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                  {count > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      active ? 'bg-white/25' : isDark ? 'bg-white/10 text-white/50' : 'bg-surface-200 text-ink-500'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Difficulty pills */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={13} style={{ color: subColor }} />
            {DIFFICULTY_OPTS.map((d) => (
              <button
                key={d}
                onClick={() => setDiffFilter(d)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  diffFilter === d ? chipActive : chipBase
                }`}
              >
                {d === 'All' ? 'Any difficulty' : d.charAt(0) + d.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {bookmarks.length === 0 && (
        <div className={`flex flex-col items-center justify-center py-24 text-center rounded-2xl border border-dashed ${
          isDark ? 'border-white/10 bg-white/2' : 'border-surface-200 bg-surface-50'
        }`}>
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
            <BookOpen size={30} className="text-amber-400" strokeWidth={1.5} />
          </div>
          <h3 style={{ color: headColor, marginBottom: 8, fontSize: 18, fontWeight: 700 }}>
            No bookmarks yet
          </h3>
          <p style={{ color: subColor, fontSize: 14, maxWidth: 340, margin: '0 auto 20px' }}>
            Bookmark any question while practising to save it here for focused review.
          </p>
          <button onClick={() => navigate('/setup')} className="btn-primary px-8">
            Start Practising
          </button>
        </div>
      )}

      {/* ── Filtered empty ── */}
      {bookmarks.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16" style={{ color: subColor }}>
          <p className="text-sm font-semibold mb-2">No bookmarks match this filter.</p>
          <button
            onClick={() => { setCatFilter('All'); setDiffFilter('All'); }}
            className="text-primary-500 text-sm font-semibold hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Bookmark grid ── */}
      {filtered.length > 0 && (
        <>
          <p className={`text-xs font-bold uppercase tracking-widest mb-5 ${isDark ? 'text-white/30' : 'text-ink-400'}`}>
            {filtered.length} bookmark{filtered.length !== 1 ? 's' : ''}
            {catFilter !== 'All' ? ` · ${catFilter}` : ''}
            {diffFilter !== 'All' ? ` · ${diffFilter}` : ''}
          </p>

          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filtered.map((item) => (
                <BookmarkCard
                  key={item.bookmarkId}
                  item={item}
                  isDark={isDark}
                  onRemove={handleRemove}
                  onPractice={handlePractice}
                />
              ))}
            </div>
          </AnimatePresence>
        </>
      )}

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 10, scale: 0.95  }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                       px-5 py-2.5 rounded-full text-sm font-semibold text-white
                       bg-dark-800 border border-white/10 shadow-xl backdrop-blur-sm"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
