import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';

export default function SplitText({
  text = '',
  className = '',
  delay = 50,
  duration = 1.0,
  ease = 'easeOut',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = '-100px',
  textAlign = 'center',
  onLetterAnimationComplete,
  showCallback = false,
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: threshold, rootMargin });
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (isInView && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [isInView, hasAnimated]);

  const elements = React.useMemo(() => {
    if (splitType === 'chars') {
      return text.split('');
    } else if (splitType === 'words') {
      return text.split(' ').map((word, i, arr) => word + (i < arr.length - 1 ? ' ' : ''));
    }
    return [];
  }, [text, splitType]);

  const currentEase = React.useMemo(() => {
    if (ease === 'power3.out') return [0.215, 0.61, 0.355, 1];
    if (ease === 'power4.out') return [0.165, 0.84, 0.44, 1];
    return ease || 'easeOut';
  }, [ease]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ textAlign, overflow: 'hidden', display: 'inline-block' }}
    >
      {elements.map((char, index) => (
        <motion.span
          key={index}
          initial={from}
          animate={hasAnimated ? to : from}
          transition={{
            duration: duration,
            delay: (index * delay) / 1000,
            ease: currentEase,
          }}
          onAnimationComplete={() => {
            if (index === elements.length - 1 && onLetterAnimationComplete && showCallback) {
              onLetterAnimationComplete();
            }
          }}
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </div>
  );
}
