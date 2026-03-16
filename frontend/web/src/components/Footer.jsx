/**
 * Footer.jsx — Simple copyright footer
 */
import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function Footer() {
  const { isDark } = useTheme();

  return (
    <footer className={`border-t py-6 text-center transition-colors duration-300 ${
      isDark ? 'border-dark-700/60' : 'border-surface-200/60'
    }`}>
      <p className={`text-sm ${isDark ? 'text-white/40' : 'text-ink-500'}`}>
        &copy; {new Date().getFullYear()} AI Interview Assistant. Level up your career with AI coaching.
      </p>
    </footer>
  );
}
