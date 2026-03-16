/**
 * AppLayout.jsx — Standard app shell
 *
 * Wraps all product pages (dashboard, history, settings, etc.)
 * with a consistent Header + Footer chrome.
 * Reads theme from ThemeContext and applies dark/light bg.
 */
import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useTheme } from '../context/ThemeContext';

export default function AppLayout() {
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${
      isDark ? 'text-white' : 'text-ink-900'
    }`}>
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

