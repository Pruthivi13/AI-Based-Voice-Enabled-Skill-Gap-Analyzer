/**
 * LandingHero.jsx — Premium animated hero section for the Landing page
 *
 * Features:
 *   • Fade-up text animations via framer-motion
 *   • Floating decorative shapes (orange/amber gradients, not the supplied indigo/rose)
 *   • Product-native preview cards (score card, AI feedback, waveform)
 *   • Trust badge, strong headline, supporting description, dual CTAs
 *   • Full dark-mode support via ThemeContext
 *   • Fully responsive — stacked on mobile, side-by-side on desktop
 *
 * Inspired by the supplied shape-landing-hero.tsx structure but completely
 * rewritten for the AI Interview Assistant product identity.
 *
 * TODO: Connect CTAs to real navigation when auth flow is ready.
 */
import SplitText from "./SplitText";
import { motion } from 'framer-motion';
import { Mic, BarChart3, BrainCircuit, ArrowRight, Sparkles, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

/* ── Decorative floating shape (adapted from supplied component) ── */
function FloatingShape({ className, delay = 0, width = 300, height = 80, gradient }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -80, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 2,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 },
      }}
      className={`absolute pointer-events-none ${className}`}
    >
      <motion.div
        animate={{ y: [0, 12, 0] }}
        transition={{
          duration: 10 + Math.random() * 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{ width, height }}
        className="relative"
      >
        <div
          className={`absolute inset-0 rounded-full bg-gradient-to-r to-transparent ${gradient}
                      blur-xl opacity-60`}
        />
      </motion.div>
    </motion.div>
  );
}

/* ── Floating preview card ── */
function PreviewCard({ children, className, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1.2, delay, ease: [0.25, 0.4, 0.25, 1] }}
      className={className}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{
          duration: 5 + Math.random() * 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ── Waveform bars animation ── */
function WaveformBars({ isDark }) {
  const bars = [3, 5, 8, 12, 7, 10, 6, 9, 4, 7, 11, 5, 8, 6];
  return (
    <div className="flex items-end gap-[3px] h-8">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          animate={{ height: [h, h * 1.8, h, h * 1.4, h] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: i * 0.08,
            ease: 'easeInOut',
          }}
          className={`w-[3px] rounded-full ${
            isDark ? 'bg-primary-400' : 'bg-primary-500'
          }`}
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

/* ── Fade-up animation variants ── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      delay: 0.2 + i * 0.15,
      ease: [0.25, 0.4, 0.25, 1],
    },
  }),
};

/* ════════════════════════════════════════════════════════════════
   MAIN HERO COMPONENT
   ════════════════════════════════════════════════════════════════ */
export default function LandingHero() {
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const handleAnimationComplete = () => {
    console.log('All letters have animated!');
  };

  return (
    <section className="relative w-full">

      {/* ── Decorative floating shapes — light mode only ── */}
      {/* In dark mode the shader arcs provide all the atmosphere needed */}
      {!isDark && (
        <div className="absolute inset-0 overflow-hidden">
          <FloatingShape
            delay={0.3}
            width={400}
            height={100}
            gradient="from-primary-500/20"
            className="left-[-8%] top-[20%]"
          />
          <FloatingShape
            delay={0.5}
            width={300}
            height={80}
            gradient="from-amber-400/15"
            className="right-[-5%] top-[65%]"
          />
          <FloatingShape
            delay={0.7}
            width={200}
            height={60}
            gradient="from-primary-300/15"
            className="left-[15%] bottom-[10%]"
          />
          <FloatingShape
            delay={0.6}
            width={150}
            height={40}
            gradient="from-amber-500/10"
            className="right-[20%] top-[10%]"
          />
        </div>
      )}

      {/* ── Content ── */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">

          {/* ── Left: Text Content ── */}
          <div className="flex-1 text-center lg:text-left max-w-2xl relative z-10">
            {/* Badge */}
            <motion.div
              custom={0}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6
                         border backdrop-blur-sm"
              style={{
                background: isDark ? 'rgba(249,115,22,0.08)' : 'rgba(249,115,22,0.06)',
                borderColor: isDark ? 'rgba(249,115,22,0.2)' : 'rgba(249,115,22,0.15)',
              }}
            >
              <Sparkles className="w-3.5 h-3.5 text-primary-500" />
              <span className={`text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-primary-400' : 'text-primary-600'
              }`}>
                AI-Powered Interview Coach
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              custom={1}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className={`text-4xl sm:text-5xl md:text-6xl lg:text-[3.5rem] font-extrabold
                         leading-[1.1] tracking-tight mb-6 drop-shadow-sm ${
                isDark ? 'text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]' : 'text-slate-900'
              }`}
            >
              Practice Smarter.{' '}
              <br className="hidden sm:block" />
              <div className="my-2">
                <SplitText
                  text="Speak Better."
                  className="bg-clip-text text-transparent bg-gradient-to-r from-primary-500 to-amber-500 drop-shadow-sm font-extrabold"
                  delay={50}
                  duration={1.25}
                  ease="power3.out"
                  splitType="chars"
                  from={{ opacity: 0, y: 40 }}
                  to={{ opacity: 1, y: 0 }}
                  threshold={0.1}
                  rootMargin="-100px"
                  textAlign="center"
                  onLetterAnimationComplete={handleAnimationComplete}
                  showCallback
                />
              </div>
              <br />
              Get Interview Ready.
            </motion.h1>

            {/* Description */}
            <motion.p
              custom={2}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className={`text-base sm:text-lg lg:text-xl leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0 ${
                isDark ? 'text-white/80 font-light' : 'text-slate-600'
              }`}
            >
              Set up role-specific mock interviews, record voice answers, and get instant
              AI-powered feedback on your technical depth, confidence, and communication
              clarity — all tracked over time.
            </motion.p>

            {/* CTAs */}
            <motion.div
              custom={3}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="flex flex-wrap items-center justify-center lg:justify-start gap-4"
            >
              <button
                onClick={() => navigate('/setup')}
                className="btn-primary text-base px-7 py-3.5 group"
              >
                Start Interview
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-secondary text-base px-7 py-3.5"
              >
                Explore Dashboard
              </button>
            </motion.div>

            {/* Trust metrics */}
            <motion.div
              custom={4}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className={`flex items-center justify-center lg:justify-start gap-6 mt-8 pt-8
                         border-t ${isDark ? 'border-white/10' : 'border-surface-200'}`}
            >
              {[
                { value: '10K+', label: 'Sessions' },
                { value: '4.8', label: 'Avg Rating' },
                { value: '85%', label: 'Improvement' },
              ].map((stat, i) => (
                <div key={i} className="text-center lg:text-left">
                  <p className={`text-lg font-extrabold ${isDark ? 'text-white' : 'text-ink-900'}`}>
                    {stat.value}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-white/40' : 'text-ink-500'}`}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Right: Floating Product Preview Cards ── */}
          <div className="flex-1 relative w-full max-w-lg lg:max-w-xl min-h-[380px] md:min-h-[420px]">
            {/* Score Card Preview */}
            <PreviewCard
              delay={0.8}
              className="absolute top-0 right-0 md:right-4 z-20"
            >
              <div className={`rounded-2xl p-5 shadow-elevated backdrop-blur-sm border ${
                isDark
                  ? 'bg-dark-800/90 border-dark-700/60'
                  : 'bg-white/90 border-surface-200/60'
              }`} style={{ width: 220 }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-primary-500/10 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-primary-500" />
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    isDark ? 'text-white/40' : 'text-ink-500'
                  }`}>Overall Score</span>
                </div>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-3xl font-extrabold text-primary-500">8.4</span>
                  <span className={`text-sm ${isDark ? 'text-white/40' : 'text-ink-500'}`}>/ 10</span>
                </div>
                <div className={`w-full h-2 rounded-full overflow-hidden ${
                  isDark ? 'bg-white/10' : 'bg-surface-200'
                }`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '84%' }}
                    transition={{ duration: 1.5, delay: 1.2, ease: 'easeOut' }}
                    className="h-full bg-primary-500 rounded-full"
                  />
                </div>
              </div>
            </PreviewCard>

            {/* AI Feedback Snippet */}
            <PreviewCard
              delay={1.0}
              className="absolute top-[45%] left-0 md:left-[-10px] z-30"
            >
              <div className={`rounded-2xl p-4 shadow-elevated backdrop-blur-sm border ${
                isDark
                  ? 'bg-dark-800/90 border-dark-700/60'
                  : 'bg-white/90 border-surface-200/60'
              }`} style={{ width: 260 }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center">
                    <BrainCircuit className="w-3.5 h-3.5 text-green-600" />
                  </div>
                  <span className={`text-xs font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    AI Feedback
                  </span>
                </div>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-white/60' : 'text-ink-700'}`}>
                  "Strong technical depth on React hooks. Consider adding more
                  concrete examples to support your system design answers."
                </p>
              </div>
            </PreviewCard>

            {/* Waveform + Live Analysis Card */}
            <PreviewCard
              delay={1.2}
              className="absolute bottom-0 right-[5%] md:right-[10%] z-20"
            >
              <div className={`rounded-2xl p-4 shadow-elevated backdrop-blur-sm border ${
                isDark
                  ? 'bg-dark-800/90 border-dark-700/60'
                  : 'bg-white/90 border-surface-200/60'
              }`} style={{ width: 200 }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center">
                    <Mic className="w-3.5 h-3.5 text-primary-500" />
                  </div>
                  <span className={`text-xs font-bold ${isDark ? 'text-primary-400' : 'text-primary-600'}`}>
                    Voice Analysis
                  </span>
                </div>
                <WaveformBars isDark={isDark} />
                <div className="flex items-center gap-1.5 mt-3">
                  <TrendingUp className={`w-3 h-3 ${isDark ? 'text-green-400' : 'text-green-500'}`} />
                  <span className={`text-[10px] font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    Confidence: High
                  </span>
                </div>
              </div>
            </PreviewCard>

            {/* Skill Breakdown Mini Card */}
            <PreviewCard
              delay={1.4}
              className="absolute top-[15%] left-[15%] md:left-[20%] z-10"
            >
              <div className={`rounded-xl px-4 py-3 shadow-card backdrop-blur-sm border ${
                isDark
                  ? 'bg-dark-800/80 border-dark-700/40'
                  : 'bg-white/80 border-surface-200/40'
              }`}>
                <div className="flex items-center gap-3">
                  {['Communication', 'Technical', 'Clarity'].map((skill, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        i === 0 ? 'bg-primary-500' : i === 1 ? 'bg-amber-500' : 'bg-green-500'
                      }`} />
                      <span className={`text-[10px] font-semibold ${
                        isDark ? 'text-white/50' : 'text-ink-500'
                      }`}>{skill}</span>
                    </div>
                  ))}
                </div>
              </div>
            </PreviewCard>
          </div>
        </div>
      </div>

    </section>
  );
}
