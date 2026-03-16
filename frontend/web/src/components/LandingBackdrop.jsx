/**
 * LandingBackdrop.jsx — Theme-aware ColorBends backdrop for the landing page
 *
 * Wraps the raw ColorBends WebGL effect with project-specific tuning.
 * Important: This tuning intentionally keeps parameters like frequency (>0.8)
 * and warpStrength (<1.2) very close to the raw defaults. The shader's core
 * mathematical formulas break (collapse to black) if the parameters are pushed
 * too far into extreme bounds.
 *
 * Features:
 *   • Safe, luminous aurora-style palettes for Light/Dark modes
 *   • NO CSS overlay in dark mode — shader IS the background
 *   • Light mode: minimal white wash for text readability
 *   • pointer-events-none so clicks pass through to UI underneath
 */
import React from 'react';
import { useTheme } from '../context/ThemeContext';
import ColorBends from './ColorBends';

/* ── Theme-specific presets (Safe Math Bounds) ── */

/*
 * DARK preset: Vivid aurora ribbons.
 */
const DARK_PRESET = {
  colors: ['#00FFFF', '#7EF9FF', '#FFD700', '#FF69B4', '#8B5CF6', '#38BDF8'],
  speed: 0.3,
  rotation: 15,
  scale: 1.1,
  frequency: 1.0,
  warpStrength: 1.0,
  mouseInfluence: 0.5,
  parallax: 0.2,
  noise: 0.05,
  transparent: false,
};

/*
 * LIGHT preset: Softer pastel version of the ribbons.
 */
const LIGHT_PRESET = {
  colors: ['#67e8f9', '#a5f3fc', '#fde68a', '#fcd34d', '#f9a8d4', '#c4b5fd'],
  speed: 0.25,
  rotation: 15,
  scale: 1.2,
  frequency: 1.0,
  warpStrength: 0.9,
  mouseInfluence: 0.4,
  parallax: 0.2,
  noise: 0.05,
  transparent: false,
};

export default function LandingBackdrop() {
  const { isDark } = useTheme();
  const preset = isDark ? DARK_PRESET : LIGHT_PRESET;

  return (
    <div
      className="fixed inset-0 h-screen w-screen pointer-events-none"
      style={{ zIndex: -10 }}
      aria-hidden="true"
    >
      {/* WebGL canvas — the primary background layer */}
      <ColorBends {...preset} />

      {/* Light-mode readability wash only */}
      {!isDark && (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.40) 100%)',
          }}
        />
      )}
    </div>
  );
}
