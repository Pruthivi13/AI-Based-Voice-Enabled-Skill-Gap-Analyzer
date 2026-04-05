/**
 * CourseRecommendations.jsx
 *
 * Embla-style focus carousel for course cards.
 * - CSS scroll-snap for smooth dragging
 * - Centre card is full-size & fully interactive; side cards scale down
 * - Dot indicators + prev/next arrow buttons
 * - Fetches once, caches in DB via backend
 *
 * Props:
 *   sessionId  — interview session ID
 *   targetRole — role string for the heading
 */
import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import { fetchCourses } from '../services/mockApi';
import CourseCard from './CourseCard';
import { BookOpen, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// ── skeleton card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      borderRadius: 20, overflow: 'hidden',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      width: '100%',
    }}>
      <div style={{ paddingBottom: '56.25%', background: 'rgba(255,255,255,0.06)', position: 'relative' }} />
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ height: 13, borderRadius: 6, background: 'rgba(255,255,255,0.08)', width: '80%' }} />
        <div style={{ height: 11, borderRadius: 6, background: 'rgba(255,255,255,0.05)', width: '60%' }} />
      </div>
    </div>
  );
}

export default function CourseRecommendations({ sessionId, targetRole }) {
  const { isDark } = useTheme();
  const [courses,  setCourses]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [active,   setActive]   = useState(0);   // index of centre card
  const [canPrev,  setCanPrev]  = useState(false);
  const [canNext,  setCanNext]  = useState(false);

  const trackRef  = useRef(null);
  const ticking   = useRef(false);

  // ── data fetching ─────────────────────────────────────────────────────────
  const load = useCallback(async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await fetchCourses(sessionId);
      setCourses(data?.courses ?? []);
      setActive(0);
    } catch {
      setError('Could not load courses. Check your Serper API key.');
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [sessionId]);

  useEffect(() => { if (sessionId) load(); }, [sessionId]);

  // ── scroll-snap tracking ─────────────────────────────────────────────────
  const updateActive = useCallback(() => {
    const el = trackRef.current;
    if (!el || courses.length === 0) return;
    const slideW = el.firstElementChild?.offsetWidth ?? 1;
    const gap = 24;
    const idx = Math.round(el.scrollLeft / (slideW + gap));
    setActive(Math.max(0, Math.min(idx, courses.length - 1)));
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, [courses.length]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(() => { updateActive(); ticking.current = false; });
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    // initial state
    setTimeout(updateActive, 80);
    return () => el.removeEventListener('scroll', onScroll);
  }, [updateActive, courses]);

  // ── navigation helpers ───────────────────────────────────────────────────
  const scrollTo = useCallback((idx) => {
    const el = trackRef.current;
    if (!el || !el.firstElementChild) return;
    const slideW = el.firstElementChild.offsetWidth;
    const gap = 24;
    el.scrollTo({ left: idx * (slideW + gap), behavior: 'smooth' });
  }, []);

  const prev = () => scrollTo(Math.max(0,               active - 1));
  const next = () => scrollTo(Math.min(courses.length - 1, active + 1));

  // ── colours ───────────────────────────────────────────────────────────────
  const bg      = isDark ? 'transparent' : 'transparent';
  const headTxt = isDark ? '#f1f5f9' : '#1c1917';
  const subTxt  = isDark ? 'rgba(255,255,255,0.45)' : '#78716c';
  const btnBg   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const btnHov  = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';

  return (
    <section style={{ marginTop: 64, marginBottom: 48 }}>
      {/* ── header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                    flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <BookOpen size={22} color="#f97316" />
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: headTxt }}>
              Recommended Courses
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: subTxt }}>
            Top picks from Udemy, Coursera, edX &amp; more for{' '}
            <span style={{ color: '#f97316', fontWeight: 700 }}>{targetRole}</span>
          </p>
        </div>

        {!loading && (
          <button
            onClick={() => load(true)}
            disabled={retrying}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 16px', borderRadius: 99,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, color: subTxt,
              opacity: retrying ? 0.5 : 1,
            }}
          >
            <RefreshCw size={13} style={{ animation: retrying ? 'spin 0.7s linear infinite' : 'none' }} />
            {retrying ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
      </div>

      {/* ── loading skeletons ── */}
      {loading && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 20,
        }}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* ── error ── */}
      {!loading && error && (
        <div style={{
          borderRadius: 16, padding: '32px 24px', textAlign: 'center',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          color: '#f87171',
        }}>
          <p style={{ margin: '0 0 12px', fontWeight: 600 }}>{error}</p>
          <button
            onClick={() => load(true)}
            style={{
              padding: '8px 20px', borderRadius: 99,
              background: '#ef4444', color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >Try Again</button>
        </div>
      )}

      {/* ── empty ── */}
      {!loading && !error && courses.length === 0 && (
        <div style={{
          borderRadius: 16, padding: '48px 24px', textAlign: 'center',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: subTxt,
        }}>
          <BookOpen size={40} style={{ margin: '0 auto 12px', opacity: 0.4, display: 'block' }} />
          <p style={{ margin: 0, fontWeight: 600 }}>No courses found for this role.</p>
          <p style={{ margin: '6px 0 0', fontSize: 12 }}>
            Make sure SERPER_API_KEY is set in your backend .env file.
          </p>
        </div>
      )}

      {/* ── CAROUSEL ── */}
      {!loading && !error && courses.length > 0 && (
        <div style={{ position: 'relative' }}>
          {/* scroll track */}
          <div
            ref={trackRef}
            style={{
              display: 'flex',
              gap: 24,
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',          /* Firefox */
              msOverflowStyle: 'none',         /* IE */
              paddingLeft:  'calc(50% - 175px)',
              paddingRight: 'calc(50% - 175px)',
              paddingBottom: 8,
              paddingTop: 8,
              cursor: 'grab',
            }}
            /* hide scrollbar webkit */
            className="hide-scrollbar"
          >
            {courses.map((course, i) => (
              <div
                key={course.id}
                onClick={() => { if (i !== active) scrollTo(i); }}
                style={{
                  flexShrink: 0,
                  width: 320,
                  scrollSnapAlign: 'center',
                  cursor: i === active ? 'auto' : 'pointer',
                }}
              >
                <CourseCard course={course} isCenter={i === active} />
              </div>
            ))}
          </div>

          {/* ── prev / next arrows ── */}
          {canPrev && (
            <button
              onClick={prev}
              style={{
                position: 'absolute', left: 0, top: '40%',
                transform: 'translateY(-50%)',
                width: 40, height: 40, borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(15,23,42,0.85)',
                backdropFilter: 'blur(12px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: 10,
                color: '#f1f5f9',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {canNext && (
            <button
              onClick={next}
              style={{
                position: 'absolute', right: 0, top: '40%',
                transform: 'translateY(-50%)',
                width: 40, height: 40, borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(15,23,42,0.85)',
                backdropFilter: 'blur(12px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', zIndex: 10,
                color: '#f1f5f9',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}
            >
              <ChevronRight size={18} />
            </button>
          )}

          {/* ── dot indicators ── */}
          <div style={{
            display: 'flex', justifyContent: 'center',
            alignItems: 'center', gap: 6, marginTop: 18,
          }}>
            {courses.map((_, i) => (
              <button
                key={i}
                onClick={() => scrollTo(i)}
                style={{
                  width:  i === active ? 20 : 7,
                  height: 7,
                  borderRadius: 99,
                  background: i === active ? '#f97316' : 'rgba(255,255,255,0.2)',
                  border: 'none', padding: 0, cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.25,0.46,0.45,0.94)',
                }}
              />
            ))}
          </div>

          {/* footnote */}
          <p style={{
            textAlign: 'center', marginTop: 14,
            fontSize: 11, color: 'rgba(255,255,255,0.2)',
          }}>
            {courses.length} courses · Prices are approximate and may vary
          </p>
        </div>
      )}

      {/* Inline CSS for scrollbar hide + spin keyframe */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  );
}
