/**
 * AnimatedHintsButtonLight.jsx — Light theme variant
 * Same tape-measure morphing behaviour, hardcoded light styles.
 * Icon absolutely positioned at right-0 for perfect centering.
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, X } from 'lucide-react';

const ICON_SIZE = 56;
const PILL_WIDTH = 192;

export default function AnimatedHintsButtonLight({ hints, questionType }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showLabel, setShowLabel] = useState(true);
  const [showPulse, setShowPulse] = useState(false);
  const timersRef = useRef([]);

  const clearAllTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => {
    clearAllTimers();
    setShowLabel(true);
    setShowPulse(false);
    const t1 = setTimeout(() => setShowLabel(false), 2600);
    const t2 = setTimeout(() => setShowPulse(true),  3100);
    const t3 = setTimeout(() => setShowPulse(false), 7100);
    timersRef.current = [t1, t2, t3];
    return clearAllTimers;
  }, [hints]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hints || hints.length === 0) return null;

  const targetWidth = isOpen || !showLabel ? ICON_SIZE : PILL_WIDTH;
  const widthSpring = showLabel
    ? { type: 'spring', stiffness: 155, damping: 22, mass: 1.1 }
    : { type: 'spring', stiffness: 310, damping: 28, mass: 0.8 };

  return (
    <div className="fixed top-20 right-6 z-50">
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
        <motion.div
          animate={{ opacity: showLabel && !isOpen ? 1 : 0 }}
          transition={{ duration: 0.13 }}
          className="absolute inset-0 flex items-center overflow-hidden"
          style={{ paddingLeft: 20, paddingRight: ICON_SIZE + 4 }}
        >
          <span className="text-sm font-semibold text-white whitespace-nowrap tracking-wide">
            Helpful Tips
          </span>
        </motion.div>

        <motion.span
          animate={{ opacity: showLabel && !isOpen ? 1 : 0 }}
          transition={{ duration: 0.13 }}
          className="absolute top-1/2 -translate-y-1/2 w-px h-5 bg-white/20 pointer-events-none"
          style={{ right: ICON_SIZE }}
          aria-hidden="true"
        />

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

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 12, scale: 0.93 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 12, scale: 0.93 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26, mass: 0.75 }}
            className="absolute top-0 right-16 w-80 rounded-2xl shadow-2xl
                       border border-gray-200 bg-white overflow-hidden"
            style={{ transformOrigin: 'top right' }}
          >
            <div className="flex items-center px-4 py-3 border-b border-gray-200 bg-amber-50">
              <div className="flex items-center gap-2">
                <Lightbulb size={15} className="text-amber-500 shrink-0" />
                <span className="text-sm font-bold text-amber-600">Helpful Tips</span>
                {questionType && (
                  <span className="text-xs px-2 py-0.5 rounded-full leading-none bg-gray-100 text-gray-500">
                    {questionType}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 space-y-2.5 max-h-96 overflow-y-auto">
              {hints.map((hint, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.055, duration: 0.2 }}
                  className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/60 hover:bg-amber-50 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-[7px] shrink-0" aria-hidden="true" />
                  <span className="text-sm leading-relaxed text-gray-700">{hint}</span>
                </motion.div>
              ))}

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: hints.length * 0.055 + 0.1 }}
                className="text-xs italic pt-3 mt-1 border-t border-gray-200 text-gray-400"
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
