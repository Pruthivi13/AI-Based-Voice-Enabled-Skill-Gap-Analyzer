/**
 * LearningResourcesPage.jsx  —  /resources
 *
 * Dynamic, personalised resource hub.
 *
 * Features:
 *  • Derives weak categories from user's past interview analyses
 *  • Fetches real courses from Udemy/Coursera/edX/YouTube via Serper
 *  • Category filter tabs: All | Technical | Communication | Fluency | Confidence
 *  • Responsive masonry-style grid
 *  • BorderGlow hover effect per card (colour changes by category)
 *  • Skeleton loading state
 *  • Personalisation banner showing which skills were flagged
 */
import React, { useState, useEffect, useMemo } from 'react';
import { fetchResources } from '../services/api';
import ResourceCourseCard from '../components/ResourceCourseCard';
import { useTheme } from '../context/ThemeContext';
import {
  BookOpen, Zap, Mic, TrendingUp, Code2,
  RefreshCw, Sparkles, ChevronDown,
} from 'lucide-react';

// ── category meta ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'All',           label: 'All Resources', icon: BookOpen,   color: 'text-white/70',         ring: 'ring-white/20'             },
  { key: 'Technical',     label: 'Technical',     icon: Code2,      color: 'text-sky-400',           ring: 'ring-sky-500/40'           },
  { key: 'Communication', label: 'Communication', icon: Mic,        color: 'text-pink-400',          ring: 'ring-pink-500/40'          },
  { key: 'Fluency',       label: 'Fluency',       icon: Zap,        color: 'text-emerald-400',       ring: 'ring-emerald-500/40'       },
  { key: 'Confidence',    label: 'Confidence',    icon: TrendingUp, color: 'text-amber-400',         ring: 'ring-amber-500/40'         },
];

const WEAK_BADGE = {
  Technical:     { bg: 'bg-sky-500/15',     text: 'text-sky-400',      label: 'Technical depth' },
  Communication: { bg: 'bg-pink-500/15',    text: 'text-pink-400',     label: 'Communication'   },
  Fluency:       { bg: 'bg-emerald-500/15', text: 'text-emerald-400',  label: 'Fluency'         },
  Confidence:    { bg: 'bg-amber-500/15',   text: 'text-amber-400',    label: 'Confidence'      },
};

// ── skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard({ isDark }) {
  return (
    <div className={`rounded-2xl overflow-hidden border animate-pulse ${
      isDark ? 'bg-dark-800 border-dark-700' : 'bg-surface-100 border-surface-200'
    }`}>
      <div className={`w-full h-44 ${isDark ? 'bg-white/5' : 'bg-surface-200'}`} />
      <div className="p-5 space-y-3">
        <div className={`h-2.5 rounded-full w-1/3 ${isDark ? 'bg-white/8' : 'bg-surface-300'}`} />
        <div className={`h-3.5 rounded-full w-4/5 ${isDark ? 'bg-white/10' : 'bg-surface-300'}`} />
        <div className={`h-3 rounded-full w-3/5 ${isDark ? 'bg-white/8' : 'bg-surface-200'}`} />
        <div className={`h-9 rounded-xl w-36 mt-4 ${isDark ? 'bg-white/6' : 'bg-surface-200'}`} />
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────
export default function LearningResourcesPage() {
  const { isDark } = useTheme();
  const [resources,      setResources]      = useState([]);
  const [weakCategories, setWeakCategories] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [retrying,       setRetrying]       = useState(false);
  const [activeTab,      setActiveTab]      = useState('All');
  const [showAll,        setShowAll]        = useState(false);

  const INITIAL_SHOW = 8;

  const load = async (isRetry = false) => {
    if (isRetry) setRetrying(true);
    else         setLoading(true);
    setError(null);
    try {
      const data = await fetchResources();
      // Support both old (array) and new ({ resources, weakCategories }) shape
      if (Array.isArray(data)) {
        setResources(data);
        setWeakCategories([]);
      } else {
        setResources(data.resources  ?? []);
        setWeakCategories(data.weakCategories ?? []);
      }
      setShowAll(false);
    } catch {
      setError('Failed to load resources. Check your connection.');
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Filter by active tab
  const filtered = useMemo(() =>
    activeTab === 'All'
      ? resources
      : resources.filter(r => r.category === activeTab),
  [resources, activeTab]);

  const visible = showAll ? filtered : filtered.slice(0, INITIAL_SHOW);

  // Derive which categories actually have resources (for tab badges)
  const countsByCategory = useMemo(() => {
    const map = { All: resources.length };
    resources.forEach(r => {
      map[r.category] = (map[r.category] || 0) + 1;
    });
    return map;
  }, [resources]);

  const headColor = isDark ? 'text-white' : 'text-ink-900';
  const subColor  = isDark ? 'text-white/50' : 'text-ink-500';

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">

      {/* ── Page header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary-500/15 flex items-center justify-center">
            <Sparkles size={20} className="text-primary-500" />
          </div>
          <h1 className={headColor}>Learning Resources</h1>
        </div>
        <p className={`${subColor} max-w-2xl`}>
          Personalised courses and guides curated from your interview performance.
          We surface resources for the areas where you need the most growth.
        </p>
      </div>

      {/* ── Personalisation banner (shown when we have weak categories) ── */}
      {weakCategories.length > 0 && !loading && (
        <div className={`rounded-2xl p-4 mb-8 flex flex-wrap items-center gap-3 border ${
          isDark
            ? 'bg-primary-500/5 border-primary-500/20'
            : 'bg-primary-50 border-primary-200'
        }`}>
          <Sparkles size={16} className="text-primary-500 shrink-0" />
          <span className={`text-sm font-semibold ${isDark ? 'text-white/80' : 'text-ink-800'}`}>
            Personalised for your skill gaps:
          </span>
          {weakCategories.map(cat => {
            const meta = WEAK_BADGE[cat];
            return (
              <span key={cat} className={`px-3 py-1 rounded-full text-xs font-bold ${meta.bg} ${meta.text}`}>
                {meta.label}
              </span>
            );
          })}
          <button
            onClick={() => load(true)}
            disabled={retrying}
            className={`ml-auto flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full
              transition-colors border ${
                isDark
                  ? 'border-white/10 text-white/50 hover:text-white hover:border-white/25'
                  : 'border-surface-200 text-ink-500 hover:text-ink-700'
              } disabled:opacity-40`}
          >
            <RefreshCw size={11} className={retrying ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      )}

      {/* ── Category tabs ── */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map(({ key, label, icon: Icon, color, ring }) => {
          const count  = countsByCategory[key] ?? 0;
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => { setActiveTab(key); setShowAll(false); }}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold
                border transition-all duration-200
                ${active
                  ? `bg-primary-500 text-white border-primary-500 shadow-md`
                  : isDark
                    ? `bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white`
                    : `bg-white border-surface-200 text-ink-600 hover:border-primary-300 hover:text-ink-900`
                }
              `}
            >
              <Icon size={14} className={active ? 'text-white' : color} />
              {label}
              {count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  active
                    ? 'bg-white/25 text-white'
                    : isDark ? 'bg-white/10 text-white/50' : 'bg-surface-200 text-ink-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Error ── */}
      {!loading && error && (
        <div className={`rounded-2xl p-8 text-center border mb-8 ${
          isDark
            ? 'bg-red-950/30 border-red-800/40 text-red-400'
            : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          <p className="font-semibold mb-3">{error}</p>
          <button
            onClick={() => load(true)}
            className="px-6 py-2.5 rounded-full bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Loading skeleton grid ── */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} isDark={isDark} />
          ))}
        </div>
      )}

      {/* ── Resource grid ── */}
      {!loading && !error && filtered.length > 0 && (
        <>
          {/* Section label */}
          <p className={`text-xs font-bold uppercase tracking-widest mb-5 ${
            isDark ? 'text-white/30' : 'text-ink-400'
          }`}>
            {filtered.length} resource{filtered.length !== 1 ? 's' : ''}
            {activeTab !== 'All' ? ` · ${activeTab}` : ''}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {visible.map((resource) => (
              <ResourceCourseCard key={resource.id} resource={resource} />
            ))}
          </div>

          {/* Show more */}
          {filtered.length > INITIAL_SHOW && !showAll && (
            <div className="flex justify-center mt-10">
              <button
                onClick={() => setShowAll(true)}
                className={`
                  flex items-center gap-2 px-7 py-3 rounded-full text-sm font-semibold
                  border transition-all duration-200
                  ${isDark
                    ? 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10 hover:text-white'
                    : 'bg-white border-surface-200 text-ink-600 hover:border-primary-300 hover:text-ink-900'
                  }
                `}
              >
                <ChevronDown size={15} />
                Show all {filtered.length} resources
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && filtered.length === 0 && (
        <div className={`rounded-2xl p-16 text-center border ${
          isDark
            ? 'bg-dark-800/50 border-dark-700 text-white/40'
            : 'bg-surface-50 border-surface-200 text-ink-500'
        }`}>
          <BookOpen size={44} className="mx-auto mb-4 opacity-30" />
          <p className="font-semibold text-lg mb-1">No resources yet</p>
          <p className="text-sm">
            {activeTab !== 'All'
              ? `No ${activeTab} resources found. Try a different category.`
              : 'Complete an interview to get personalised recommendations.'}
          </p>
        </div>
      )}

      {/* Note */}
      {!loading && resources.length > 0 && (
        <p className={`text-xs mt-8 text-center ${isDark ? 'text-white/20' : 'text-ink-400'}`}>
          Courses sourced from Udemy, Coursera, edX, LinkedIn Learning &amp; more ·
          Prices are approximate and may vary by region
        </p>
      )}
    </div>
  );
}
