/**
 * Header.jsx — Top navigation bar
 *
 * Renders the brand mark, main navigation links, and profile controls.
 * Active link is highlighted with primary orange color.
 * Auth-connected with profile dropdown and logout.
 */
import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const navLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/history',   label: 'Interviews' },
  { to: '/analytics', label: 'Insights' },
  { to: '/settings',  label: 'Settings' },
];

export default function Header() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { currentUser, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setIsDropdownOpen(false);
      navigate('/');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const userInitial = currentUser?.displayName
    ? currentUser.displayName.charAt(0).toUpperCase()
    : currentUser?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <header className={`sticky top-0 z-50 backdrop-blur-md border-b transition-colors duration-300 ${
      isDark
        ? 'bg-dark-900/90 border-dark-700/60'
        : 'bg-white/90 border-surface-200/60'
    }`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        {/* Brand */}
        <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                          group-hover:scale-105 transition-transform ${
                            isDark ? 'bg-dark-700' : 'bg-dark-900'
                          }`}>
            <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
            </svg>
          </div>
          <span className={`text-lg font-bold hidden sm:block ${isDark ? 'text-white' : 'text-ink-900'}`}>AI Interview Assistant</span>
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                  isActive
                    ? 'text-primary-500 bg-primary-500/10'
                    : isDark
                      ? 'text-white/60 hover:text-white hover:bg-white/10'
                      : 'text-ink-700 hover:text-ink-900 hover:bg-surface-100'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          {/* Desktop Search */}
          <div className={`hidden lg:flex flex-1 max-w-[200px] items-center gap-2 rounded-full px-4 py-2 ${
            isDark ? 'bg-white/10' : 'bg-surface-100'
          }`}>
            <svg className={`w-4 h-4 shrink-0 ${isDark ? 'text-white/50' : 'text-ink-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              className={`bg-transparent text-sm outline-none w-full min-w-0 ${
                isDark
                  ? 'text-white placeholder:text-white/40'
                  : 'text-ink-700 placeholder:text-ink-500'
              }`}
            />
          </div>

          {/* Avatar with Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center shrink-0
                         hover:ring-2 hover:ring-primary-200 transition-all"
            >
              <span className="text-white text-sm font-bold">{userInitial}</span>
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className={`absolute right-0 mt-2 w-56 rounded-xl shadow-xl border overflow-hidden z-50 ${
                isDark
                  ? 'bg-dark-800 border-dark-700'
                  : 'bg-white border-surface-200'
              }`}>
                {/* User info */}
                <div className={`px-4 py-3 border-b ${isDark ? 'border-dark-700' : 'border-surface-200'}`}>
                  <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-ink-900'}`}>
                    {currentUser?.displayName || 'User'}
                  </p>
                  <p className={`text-xs truncate ${isDark ? 'text-white/50' : 'text-ink-500'}`}>
                    {currentUser?.email}
                  </p>
                </div>

                {/* Links */}
                <div className="py-1">
                  <button
                    onClick={() => { setIsDropdownOpen(false); navigate('/profile'); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2.5 transition-colors ${
                      isDark
                        ? 'text-white/80 hover:bg-white/5 hover:text-white'
                        : 'text-ink-700 hover:bg-surface-50 hover:text-ink-900'
                    }`}
                  >
                    👤 Profile
                  </button>
                  <button
                    onClick={() => { setIsDropdownOpen(false); navigate('/settings'); }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2.5 transition-colors ${
                      isDark
                        ? 'text-white/80 hover:bg-white/5 hover:text-white'
                        : 'text-ink-700 hover:bg-surface-50 hover:text-ink-900'
                    }`}
                  >
                    ⚙️ Settings
                  </button>
                </div>

                {/* Logout */}
                <div className={`border-t py-1 ${isDark ? 'border-dark-700' : 'border-surface-200'}`}>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2.5 text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    🚪 Logout
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <button 
            className={`lg:hidden p-2 rounded-lg transition-colors ${isDark ? 'text-white hover:bg-white/10' : 'text-ink-900 hover:bg-surface-100'}`}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className={`lg:hidden border-t px-6 py-4 flex flex-col gap-4 ${isDark ? 'border-dark-700/60 bg-dark-900/95' : 'border-surface-200/60 bg-white/95'}`}>
          {/* Mobile Search */}
          <div className={`flex items-center gap-2 rounded-full px-4 py-2 ${
            isDark ? 'bg-white/10' : 'bg-surface-100'
          }`}>
            <svg className={`w-4 h-4 shrink-0 ${isDark ? 'text-white/50' : 'text-ink-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              placeholder="Search sessions..."
              className={`bg-transparent text-sm outline-none w-full min-w-0 ${
                isDark
                  ? 'text-white placeholder:text-white/40'
                  : 'text-ink-700 placeholder:text-ink-500'
              }`}
            />
          </div>

          {/* Mobile Navigation Links */}
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setIsMenuOpen(false)}
                className={({ isActive }) =>
                  `px-4 py-3 rounded-xl text-base font-semibold transition-colors ${
                    isActive
                      ? 'text-primary-500 bg-primary-500/10'
                      : isDark
                        ? 'text-white hover:bg-white/10'
                        : 'text-ink-700 hover:bg-surface-100'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            {/* Mobile Profile & Logout */}
            <button
              onClick={() => { setIsMenuOpen(false); navigate('/profile'); }}
              className={`px-4 py-3 rounded-xl text-base font-semibold text-left transition-colors ${
                isDark ? 'text-white hover:bg-white/10' : 'text-ink-700 hover:bg-surface-100'
              }`}
            >
              👤 Profile
            </button>
            <button
              onClick={() => { setIsMenuOpen(false); handleLogout(); }}
              className="px-4 py-3 rounded-xl text-base font-semibold text-left text-red-500 hover:bg-red-500/10 transition-colors"
            >
              🚪 Logout
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}


