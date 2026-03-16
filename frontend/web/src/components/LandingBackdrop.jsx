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
import LiquidEther from './LiquidEther';

/* ── Theme-specific presets (Safe Math Bounds) ── */

// The user's exact requested configuration for a reddish-orange fluid background,
// but mapped correctly to the `colors` array and optimized for performance.
const FLUID_PRESET = {
  // Using the reddish-orange hex codes requested
  colors: ['#f0ebea', '#fe7f2a', '#f69131'],
  mouseForce: 15, // Increased for stronger interaction
  cursorSize: 250, // Increased for wider interaction radius
  isViscous: false,
  viscous: 10,
  iterationsViscous: 8, // Explicit limit to prevent lag
  iterationsPoisson: 8,  // Explicit limit to prevent lag
  isBounce: true,
  autoDemo: true,
  autoSpeed: 0.2,
  autoIntensity: 1.3,
  resolution: 0.35, // Reduced from 0.75 to dramatically improve high-DPI GPU performance
};

export default function LandingBackdrop() {
  const { isDark } = useTheme();

  return (
    <div
      className="fixed inset-0 h-screen w-screen pointer-events-none"
      style={{ zIndex: -10 }}
      aria-hidden="true"
    >
      {/* WebGL canvas — the primary background layer */}
      <LiquidEther {...FLUID_PRESET} />

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
