/**
 * ResourceCourseCard.jsx
 *
 * Card for the /resources page.
 * - Real thumbnail with gradient fallback
 * - Platform badge, category chip, price, rating
 * - BorderGlow hover effect (colours adapt per category)
 * - "View Resource →" CTA button
 */
import React, { useState } from 'react';
import BorderGlow from './BorderGlow/BorderGlow';
import { ExternalLink, Star, Users, ArrowRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// Glow palette per category
const CATEGORY_GLOW = {
  Technical:     { glowColor: '38 80 80',  colors: ['#38bdf8', '#818cf8', '#c084fc'] },
  Communication: { glowColor: '350 80 75', colors: ['#f472b6', '#fb923c', '#fbbf24'] },
  Fluency:       { glowColor: '142 65 70', colors: ['#4ade80', '#34d399', '#38bdf8'] },
  Confidence:    { glowColor: '40 90 75',  colors: ['#fbbf24', '#fb923c', '#f97316'] },
  All:           { glowColor: '40 80 80',  colors: ['#c084fc', '#f472b6', '#38bdf8'] },
};

const CATEGORY_CHIP = {
  Technical:     'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30',
  Communication: 'bg-pink-500/15 text-pink-400 ring-1 ring-pink-500/30',
  Fluency:       'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
  Confidence:    'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
};

const PLATFORM_EMOJI = {
  Udemy: '🎓', Coursera: '📚', edX: '🏛️',
  'LinkedIn Learning': '💼', Pluralsight: '▶️',
  FreeCodeCamp: '🔥', YouTube: '▶️',
  Article: '📰', Guide: '📖', Tool: '🛠️',
};

const PLATFORM_BG = {
  Udemy:            { from: '#2d1b69', to: '#a435f0' },
  Coursera:         { from: '#001f5b', to: '#0056d3' },
  edX:              { from: '#00262b', to: '#0075b4' },
  'LinkedIn Learning': { from: '#001b30', to: '#0a66c2' },
  Pluralsight:      { from: '#1a0800', to: '#ef4b2e' },
  FreeCodeCamp:     { from: '#0a0a23', to: '#1b1b32' },
  YouTube:          { from: '#1a0000', to: '#ff0000' },
};

export default function ResourceCourseCard({ resource }) {
  const { isDark } = useTheme();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const cat   = resource.category || 'All';
  const glow  = CATEGORY_GLOW[cat] || CATEGORY_GLOW.All;
  const chip  = CATEGORY_CHIP[cat] || 'bg-primary-500/15 text-primary-400 ring-1 ring-primary-500/30';
  const emoji = PLATFORM_EMOJI[resource.platform] || '📖';
  const grad  = PLATFORM_BG[resource.platform];

  const isFree = resource.price?.toLowerCase().includes('free') ||
                 resource.price?.toLowerCase().includes('audit');

  const showImg = resource.thumbnail &&
                  !resource.thumbnail.endsWith('.svg') &&
                  !imgFailed;

  const cardBg = isDark ? '#0d1117' : '#ffffff';

  return (
    <BorderGlow
      backgroundColor={cardBg}
      borderRadius={16}
      glowColor={glow.glowColor}
      colors={glow.colors}
      glowIntensity={0.9}
      fillOpacity={0.4}
      coneSpread={28}
      edgeSensitivity={25}
      style={{ height: '100%' }}
    >
      <div className="flex flex-col h-full">

        {/* ── Thumbnail ───────────────────────────────── */}
        <div className="relative w-full overflow-hidden rounded-t-2xl" style={{ paddingBottom: '52%' }}>

          {/* Real image */}
          {showImg && (
            <img
              src={resource.thumbnail}
              alt={resource.title}
              onLoad={()  => setImgLoaded(true)}
              onError={() => setImgFailed(true)}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
              style={{ opacity: imgLoaded ? 1 : 0 }}
            />
          )}

          {/* Gradient fallback — shown while loading or when no real image */}
          {(!showImg || !imgLoaded) && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
              style={{
                background: grad
                  ? `linear-gradient(150deg, ${grad.from} 0%, ${grad.to} 100%)`
                  : `linear-gradient(150deg, ${glow.colors[0]}33, ${glow.colors[1]}66)`,
              }}
            >
              <span className="text-5xl">{emoji}</span>
              <span className="text-xs font-bold uppercase tracking-widest text-white/60">
                {resource.platform || resource.category}
              </span>
            </div>
          )}

          {/* Scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

          {/* Category chip */}
          <div className="absolute top-3 left-3">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${chip}`}>
              {cat}
            </span>
          </div>

          {/* Price badge */}
          {resource.price && (
            <div className="absolute top-3 right-3">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shadow-md ${
                isFree
                  ? 'bg-emerald-500 text-white'
                  : 'bg-black/70 text-white backdrop-blur-sm'
              }`}>
                {resource.price}
              </span>
            </div>
          )}
        </div>

        {/* ── Body ────────────────────────────────────── */}
        <div className="flex flex-col flex-1 p-5 gap-3">

          {/* Platform label */}
          {resource.platform && (
            <span className={`text-[10px] font-bold uppercase tracking-widest ${
              isDark ? 'text-white/35' : 'text-ink-500/70'
            }`}>
              {resource.platform}
            </span>
          )}

          {/* Title */}
          <h3 className={`font-bold text-sm leading-snug line-clamp-2 ${
            isDark ? 'text-white' : 'text-ink-900'
          }`}>
            {resource.title}
          </h3>

          {/* Description */}
          {resource.description && (
            <p className={`text-xs leading-relaxed line-clamp-3 flex-1 ${
              isDark ? 'text-white/50' : 'text-ink-500'
            }`}>
              {resource.description}
            </p>
          )}

          {/* Meta — rating, students */}
          {(resource.rating || resource.students) && (
            <div className={`flex items-center gap-3 text-xs ${
              isDark ? 'text-white/40' : 'text-ink-500'
            }`}>
              {resource.rating && (
                <span className="flex items-center gap-1 text-amber-400 font-semibold">
                  <Star size={11} fill="currentColor" />
                  {resource.rating}
                </span>
              )}
              {resource.students && (
                <span className="flex items-center gap-1">
                  <Users size={11} />
                  {resource.students}
                </span>
              )}
            </div>
          )}

          {/* CTA */}
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`
              mt-auto inline-flex items-center gap-2 px-4 py-2.5
              rounded-xl text-sm font-semibold
              border transition-all duration-200
              ${isDark
                ? 'bg-white/5 border-white/10 text-white/80 hover:bg-white/12 hover:text-white'
                : 'bg-surface-100 border-surface-200 text-ink-700 hover:bg-surface-200 hover:text-ink-900'
              }
            `}
            onClick={e => e.stopPropagation()}
          >
            View Resource
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </BorderGlow>
  );
}
