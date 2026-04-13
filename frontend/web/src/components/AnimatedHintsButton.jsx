/**
 * AnimatedHintsButton.jsx — Tape-measure morphing hints button
 *
 * Fix: icon is absolutely positioned at right-0, fully independent of flex
 * layout, so it is always perfectly centered regardless of button width.
 *
 * Animation sequence:
 *   1. Button morphs circle → pill, revealing "Helpful Tips" text to the left
 *   2. Snaps back to circle (tape-measure retract)
 *   3. Radar pulse rings fire, stop after ~4s
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ICON_SIZE = 56;   // circle diameter px
const PILL_WIDTH = 192; // expanded pill width px

export default function AnimatedHintsButton({ hints, questionType }) {
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [showLabel, setShowLabel] = useState(true);
  const [showPulse, setShowPulse] = useState(false);
  const timersRef = useRef([]);

  const clearAllTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const schedule = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
  };

  const resetSequence = () => {
    clearAllTimers();
    setShowLabel(true);
    setShowPulse(false);
    schedule(() => setShowLabel(false), 2600);
    schedule(() => setShowPulse(true),  3100);
    schedule(() => setShowPulse(false), 7100);
  };

  useEffect(() => {
    resetSequence();
    return clearAllTimers;
  }, [hints]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hints || hints.length === 0) return null;

  const targetWidth = isOpen || !showLabel ? ICON_SIZE : PILL_WIDTH;

  const widthSpring = showLabel
    ? { type: 'spring', stiffness: 155, damping: 22, mass: 1.1 }
    : { type: 'spring', stiffness: 310, damping: 28, mass: 0.8 };

  return (
    <div className="fixed top-20 right-6 z-50">

      {/* Pulse rings — behind button, anchored to icon position */}
      {showPulse && !isOpen && (
        <>
          <motion.span
            className="absolute top-0 right-0 rounded-full bg-amber-400 pointer-events-none"
            style={{ width: ICON_SIZE, height: ICON_SIZE }}
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 2.8, opacity: 0 }}
            transition={{ duration: 1.7, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.span
            className="absolute top-0 right-0 rounded-full bg-amber-400 pointer-events-none"
            style={{ width: ICON_SIZE, height: ICON_SIZE }}
            initial={{ scale: 1, opacity: 0.3 }}
            animate={{ scale: 2.8, opacity: 0 }}
            transition={{ duration: 1.7, repeat: Infinity, ease: 'easeOut', delay: 0.55 }}
          />
        </>
      )}

      {/* Badge — outside overflow-hidden, over icon */}
      <AnimatePresence>
        {!isOpen && hints.length > 0 && (
          <motion.span
            className="absolute -top-1 right-0 w-5 h-5 rounded-full z-20
                       bg-red-500 text-white text-xs font-bold
                       flex items-center justify-center shadow-md pointer-events-none"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
          >
            {hints.length}
          </motion.span>
        )}
      </AnimatePresence>

      {/* ── Morphing tape-measure button ── */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        animate={{ width: targetWidth }}
        transition={widthSpring}
        className="relative h-14 rounded-full overflow-hidden
                   bg-gradient-to-r from-amber-500 to-orange-500
                   shadow-lg cursor-pointer
                   hover:brightness-105 active:brightness-95
                   transition-[filter] duration-100"
        style={{ minWidth: ICON_SIZE, display: 'block' }}
        aria-label="View helpful tips"
        aria-expanded={isOpen}
      >
        {/* Text — absolutely inset, padded right to leave room for icon */}
        <motion.div
          animate={{ opacity: showLabel && !isOpen ? 1 : 0 }}
          transition={{ duration: 0.13 }}
          className="absolute inset-0 flex items-center overflow-hidden"
          style={{ paddingLeft: 20, paddingRight: ICON_SIZE + 4 }}
          aria-hidden={!showLabel || isOpen}
        >
          <span className="text-sm font-semibold text-white whitespace-nowrap tracking-wide">
            Helpful Tips
          </span>
        </motion.div>

        {/* Hairline divider between text and icon */}
        <motion.span
          animate={{ opacity: showLabel && !isOpen ? 1 : 0 }}
          transition={{ duration: 0.13 }}
          className="absolute top-1/2 -translate-y-1/2 w-px h-5 bg-white/20 pointer-events-none"
          style={{ right: ICON_SIZE }}
          aria-hidden="true"
        />

        {/* Icon — always absolutely anchored to right-0, always perfectly centered */}
        <div
          className="absolute top-0 right-0 flex items-center justify-center"
          style={{ width: ICON_SIZE, height: ICON_SIZE }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isOpen ? (
              <motion.span
                key="close"
                className="flex items-center justify-center"
                initial={{ rotate: -80, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 80, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.16 }}
              >
                <X size={20} className="text-white" strokeWidth={2.5} />
              </motion.span>
            ) : (
              <motion.span
                key="bulb"
                className="flex items-center justify-center"
                initial={{ rotate: 80, opacity: 0, scale: 0.5 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: -80, opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.16 }}
              >
                <Lightbulb size={23} className="text-white" strokeWidth={2.5} />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.button>

      {/* Expanded hints panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 12, scale: 0.93 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 12, scale: 0.93 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26, mass: 0.75 }}
            className={`absolute top-0 right-16 w-80 rounded-2xl shadow-2xl
                       border overflow-hidden ${
              isDark
                ? 'bg-dark-800 border-dark-700'
                : 'bg-white border-gray-200'
            }`}
            style={{ transformOrigin: 'top right' }}
          >
            {/* Header */}
            <div className={`flex items-center px-4 py-3 border-b ${
              isDark
                ? 'border-dark-700 bg-dark-700/50'
                : 'border-gray-200 bg-amber-50'
            }`}>
              <div className="flex items-center gap-2">
                <Lightbulb size={15} className="text-amber-500 shrink-0" />
                <span className={`text-sm font-bold ${
                  isDark ? 'text-amber-400' : 'text-amber-600'
                }`}>
                  Helpful Tips
                </span>
                {questionType && (
                  <span className={`text-xs px-2 py-0.5 rounded-full leading-none ${
                    isDark
                      ? 'bg-dark-600 text-white/60'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {questionType}
                  </span>
                )}
              </div>
            </div>

            {/* Hints list */}
            <div className="p-4 space-y-2.5 max-h-96 overflow-y-auto">
              {hints.map((hint, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.055, duration: 0.2 }}
                  className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                    isDark
                      ? 'bg-dark-700/50 hover:bg-dark-700'
                      : 'bg-amber-50/60 hover:bg-amber-50'
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-[7px] shrink-0"
                    aria-hidden="true"
                  />
                  <span className={`text-sm leading-relaxed ${
                    isDark ? 'text-white/80' : 'text-gray-700'
                  }`}>
                    {hint}
                  </span>
                </motion.div>
              ))}

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: hints.length * 0.055 + 0.1 }}
                className={`text-xs italic pt-3 mt-1 border-t ${
                  isDark
                    ? 'text-white/30 border-dark-700'
                    : 'text-gray-400 border-gray-200'
                }`}
              >
                These are suggestions — answer in your own words and style.
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
