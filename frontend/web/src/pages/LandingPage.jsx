/**
 * LandingPage.jsx — Home / Landing page
 *
 * Primary entry point. Maps to PRD §17.1 and the Landing Page screenshot.
 * Features:
 *   • Premium animated hero section (LandingHero component)
 *   • Setup preview card showing interview configuration
 *   • Feature highlight cards (Voice Analysis, Body Language, Technical Depth)
 *   • Clean navigation to setup, resources, and history
 *
 * This page should feel like a premium product dashboard-home hybrid.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import LandingHero from '../components/LandingHero';
import LandingBackdrop from '../components/LandingBackdrop';

export default function LandingPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  return (
    <div className="relative min-h-screen">
      <LandingBackdrop />
      
      {/* ── Global Readability Pillar ── */}
      {/* A single continuous vertical blur to ensure text contrast across all sections without creating gaps or seams between them */}
      <div 
        className={`absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-full -z-10 blur-[120px] pointer-events-none transition-colors duration-500 ${
          isDark ? 'bg-dark-900/50' : 'bg-white/60'
        }`} 
        aria-hidden="true"
      />
      
      {/* ── Premium Animated Hero ── */}
      <LandingHero />

      {/* ── Below-the-fold content ── */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 pb-12">
        {/* ── Setup Preview Card ── */}
        {/* This section maps to the PRD's setup entry flow preview */}
        <section className="max-w-4xl mx-auto mb-16">
          <div className="card flex flex-col md:flex-row gap-6 overflow-hidden">
            {/* Left — visual placeholder */}
            <div className="md:w-2/5 bg-dark-900 rounded-2xl flex items-center justify-center
                            min-h-[200px] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-dark-700/50 to-dark-900" />
              <div className="relative z-10 glass-panel px-6 py-3 text-center">
                <span className="text-3xl font-bold text-white">&lt; &gt;</span>
                <p className="text-xs text-white/60 mt-1 uppercase tracking-wider font-bold">Setup Active</p>
              </div>
            </div>

            {/* Right — setup summary */}
            <div className="md:w-3/5 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                  Configuration Ready
                </span>
              </div>

              <p className="section-header">Role Selected</p>
              <p className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-ink-900'}`}>Frontend Developer</p>

              <div className="flex gap-8 mb-4">
                <div>
                  <p className="section-header">Experience</p>
                  <p className={`text-sm font-semibold ${isDark ? 'text-white/80' : 'text-ink-900'}`}>Entry Level</p>
                </div>
                <div>
                  <p className="section-header">Document</p>
                  <p className={`text-sm font-semibold flex items-center gap-1 ${isDark ? 'text-white/80' : 'text-ink-900'}`}>
                    📄 job-spec-v2.pdf
                  </p>
                </div>
              </div>

              <div className={`p-3 rounded-xl text-sm leading-relaxed ${
                isDark ? 'bg-white/5 text-white/60' : 'bg-surface-100 text-ink-700'
              }`}>
                AI is ready to generate industry-specific questions based on the uploaded
                job description. You can expect questions on React, Tailwind CSS, and Web performance.
              </div>
            </div>
          </div>
        </section>

        {/* ── Action Buttons ── */}
        <section className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <button onClick={() => navigate('/setup')} className="btn-primary text-lg px-8 py-4">
            ▶ Start Interview
          </button>
          <button onClick={() => navigate('/resources')} className="btn-secondary text-lg px-8 py-4">
            📖 Explore Resources
          </button>
          <button onClick={() => navigate('/history')} className="btn-secondary text-lg px-8 py-4">
            📋 Past Reviews
          </button>
        </section>

        {/* ── Feature Highlights ── */}
        {/* Maps to PRD feature cards: Voice Analysis, Body Language, Technical Depth */}
        <section className="relative grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-24">
          {[
            {
              icon: '🎙️',
              title: 'Voice Analysis',
              desc: 'Analyze tone, pace, and filler words in real-time.',
            },
            {
              icon: '📹',
              title: 'Body Language',
              desc: 'Track eye contact and facial expressions for impact.',
            },
            {
              icon: '💻',
              title: 'Technical Depth',
              desc: 'Verify accuracy of technical answers for devs.',
            },
          ].map((f, i) => (
            <div key={i} className="text-center py-8 relative z-10">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-50 flex items-center justify-center
                              text-2xl mb-4 shadow-sm">
                {f.icon}
              </div>
              <h4 className={`font-bold mb-1 ${
                isDark ? 'text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]' : 'text-ink-900'
              }`}>{f.title}</h4>
              <p className={`text-sm ${
                isDark ? 'text-white/80 font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)]' : 'text-ink-500'
              }`}>{f.desc}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

