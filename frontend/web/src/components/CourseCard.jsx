import React, { useState } from 'react';
import { ExternalLink, Star, Users } from 'lucide-react';

const PLATFORM_EMOJI = {
  Udemy:             '🎓',
  Coursera:          '📚',
  edX:               '🏛️',
  'LinkedIn Learning':'💼',
  Pluralsight:       '▶️',
  FreeCodeCamp:      '🔥',
  YouTube:           '▶️',
};

export default function CourseCard({ course, isCenter }) {
  const [imgLoaded, setImgLoaded]   = useState(false);
  const [imgFailed, setImgFailed]   = useState(false);

  const isFree = course.price?.toLowerCase().includes('free') ||
                 course.price?.toLowerCase().includes('audit');

  const showImg = course.thumbnail &&
                  !course.thumbnail.endsWith('.svg') &&
                  !imgFailed;

  return (
    <a
      href={course.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        transition: 'transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.4s ease, box-shadow 0.4s ease',
        transform:  isCenter ? 'scale(1)' : 'scale(0.84)',
        opacity:    isCenter ? 1          : 0.55,
        boxShadow:  isCenter
          ? '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(249,115,22,0.35)'
          : '0 4px 20px rgba(0,0,0,0.3)',
        borderRadius: 20,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: course.gradientFrom
          ? `linear-gradient(150deg, ${course.gradientFrom} 0%, ${course.gradientTo} 100%)`
          : '#1e293b',
        minWidth: 0,
        width: '100%',
        cursor: 'pointer',
        textDecoration: 'none',
        pointerEvents: isCenter ? 'auto' : 'none',
      }}
    >
      {/* ── Thumbnail area ─────────────────────────────── */}
      <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%' }}>
        {/* Real image */}
        {showImg && (
          <img
            src={course.thumbnail}
            alt={course.title}
            onLoad={()  => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.5s ease',
            }}
          />
        )}

        {/* Gradient placeholder shown while loading OR when no real image */}
        {(!showImg || !imgLoaded) && (
          <div
            style={{
              position: 'absolute', inset: 0,
              background: course.gradientFrom
                ? `linear-gradient(150deg, ${course.gradientFrom} 0%, ${course.gradientTo} 100%)`
                : 'linear-gradient(150deg,#1a1a2e,#f97316)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 44 }}>
              {PLATFORM_EMOJI[course.platform] || '📖'}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 800,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.7)',
            }}>
              {course.platform}
            </span>
          </div>
        )}

        {/* Dark scrim for readability of badges */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        {/* Platform badge */}
        <div style={{ position: 'absolute', top: 12, left: 12 }}>
          <span style={{
            padding: '3px 10px', borderRadius: 99,
            fontSize: 9, fontWeight: 800,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            background: course.color, color: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}>
            {course.platform}
          </span>
        </div>

        {/* Price badge */}
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <span style={{
            padding: '3px 10px', borderRadius: 99,
            fontSize: 9, fontWeight: 800,
            letterSpacing: '0.08em',
            background: isFree ? '#22c55e' : 'rgba(0,0,0,0.7)',
            color: '#fff',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}>
            {course.price}
          </span>
        </div>
      </div>

      {/* ── Card body ──────────────────────────────────── */}
      <div style={{
        padding: '14px 16px 16px',
        display: 'flex', flexDirection: 'column', gap: 8,
        flex: 1,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(12px)',
      }}>
        <h4 style={{
          margin: 0,
          fontSize: 13, fontWeight: 700,
          lineHeight: 1.35,
          color: '#f1f5f9',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {course.title}
        </h4>

        {course.description && (
          <p style={{
            margin: 0,
            fontSize: 11, lineHeight: 1.5,
            color: 'rgba(255,255,255,0.5)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {course.description}
          </p>
        )}

        {/* Meta row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginTop: 'auto', paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}>
          {course.rating && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700, color: '#fbbf24',
            }}>
              <Star size={11} fill="#fbbf24" />
              {course.rating}
            </span>
          )}
          {course.students && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 10, color: 'rgba(255,255,255,0.4)',
            }}>
              <Users size={10} />
              {course.students}
            </span>
          )}
          <span style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 700, color: '#f97316',
          }}>
            View Course <ExternalLink size={11} />
          </span>
        </div>
      </div>
    </a>
  );
}
