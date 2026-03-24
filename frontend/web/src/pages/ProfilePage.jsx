/**
 * ProfilePage.jsx — User profile page
 *
 * Displays user information, account details, session statistics,
 * and provides a logout button. Auth-connected via AuthContext.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getCurrentUser } from '../services/mockApi';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { currentUser, logout, resendVerification } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifyMsg, setVerifyMsg] = useState('');

  useEffect(() => {
    getCurrentUser()
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const cardClass = `rounded-2xl p-6 border transition-colors duration-300 ${
    isDark
      ? 'bg-dark-800/60 border-dark-700/50'
      : 'bg-white border-surface-200'
  }`;

  const labelClass = `text-xs font-bold uppercase tracking-wider mb-1 ${
    isDark ? 'text-primary-400' : 'text-primary-600'
  }`;

  const valueClass = `text-base font-semibold ${
    isDark ? 'text-white' : 'text-ink-900'
  }`;

  const subTextClass = `text-sm ${isDark ? 'text-white/50' : 'text-ink-500'}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Page Header */}
      <h1 className={`text-3xl font-extrabold mb-2 ${isDark ? 'text-white' : 'text-ink-900'}`}>
        Profile
      </h1>
      <p className={subTextClass}>Manage your account and view your activity.</p>

      {/* Profile Card */}
      <div className={`${cardClass} mt-8 flex flex-col sm:flex-row items-center gap-6`}>
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shrink-0 shadow-lg">
          <span className="text-3xl font-bold text-white">
            {currentUser?.displayName
              ? currentUser.displayName.charAt(0).toUpperCase()
              : currentUser?.email?.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 text-center sm:text-left">
          <h2 className={`text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-ink-900'}`}>
            {currentUser?.displayName || profile?.data?.fullName || 'User'}
          </h2>
          <p className={subTextClass}>{currentUser?.email}</p>
          {currentUser?.emailVerified && (
            <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-500">
              ✓ Email Verified
            </span>
          )}
          {currentUser && !currentUser.emailVerified && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-600">
                ⚠ Email Not Verified
              </span>
              <button
                onClick={async () => {
                  try {
                    await resendVerification();
                    setVerifyMsg('✅ Verification email sent! Check your inbox.');
                  } catch (err) {
                    setVerifyMsg('❌ Failed to send. Try again later.');
                  }
                }}
                className="px-3 py-1 rounded-full text-xs font-semibold bg-primary-500/10 text-primary-500 hover:bg-primary-500/20 transition-colors"
              >
                Resend Verification Email
              </button>
            </div>
          )}
          {verifyMsg && (
            <p className={`text-xs mt-2 ${verifyMsg.startsWith('✅') ? 'text-green-500' : 'text-red-500'}`}>
              {verifyMsg}
            </p>
          )}
        </div>
      </div>

      {/* Account Details */}
      <div className={`${cardClass} mt-6`}>
        <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-ink-900'}`}>
          Account Details
        </h3>
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <p className={labelClass}>Email</p>
            <p className={valueClass}>{currentUser?.email || '—'}</p>
          </div>
          <div>
            <p className={labelClass}>Display Name</p>
            <p className={valueClass}>{currentUser?.displayName || profile?.data?.fullName || 'Not set'}</p>
          </div>
          <div>
            <p className={labelClass}>Account Created</p>
            <p className={valueClass}>
              {currentUser?.metadata?.creationTime
                ? new Date(currentUser.metadata.creationTime).toLocaleDateString('en-IN', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })
                : '—'}
            </p>
          </div>
          <div>
            <p className={labelClass}>Last Sign-In</p>
            <p className={valueClass}>
              {currentUser?.metadata?.lastSignInTime
                ? new Date(currentUser.metadata.lastSignInTime).toLocaleDateString('en-IN', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className={`${cardClass} mt-6`}>
        <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-ink-900'}`}>
          Quick Links
        </h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <button
            onClick={() => navigate('/settings')}
            className={`p-4 rounded-xl text-left transition-colors ${
              isDark ? 'hover:bg-white/5' : 'hover:bg-surface-50'
            }`}
          >
            <span className="text-2xl mb-2 block">⚙️</span>
            <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-ink-900'}`}>Settings</p>
            <p className={`text-xs mt-1 ${subTextClass}`}>Theme, preferences</p>
          </button>
          <button
            onClick={() => navigate('/history')}
            className={`p-4 rounded-xl text-left transition-colors ${
              isDark ? 'hover:bg-white/5' : 'hover:bg-surface-50'
            }`}
          >
            <span className="text-2xl mb-2 block">📋</span>
            <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-ink-900'}`}>Interview History</p>
            <p className={`text-xs mt-1 ${subTextClass}`}>Past sessions</p>
          </button>
          <button
            onClick={() => navigate('/analytics')}
            className={`p-4 rounded-xl text-left transition-colors ${
              isDark ? 'hover:bg-white/5' : 'hover:bg-surface-50'
            }`}
          >
            <span className="text-2xl mb-2 block">📊</span>
            <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-ink-900'}`}>Analytics</p>
            <p className={`text-xs mt-1 ${subTextClass}`}>Performance insights</p>
          </button>
        </div>
      </div>

      {/* Logout Section */}
      <div className={`${cardClass} mt-6 flex flex-col sm:flex-row items-center justify-between gap-4`}>
        <div>
          <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-ink-900'}`}>
            Sign Out
          </h3>
          <p className={subTextClass}>End your current session and return to the home page.</p>
        </div>
        <button
          onClick={handleLogout}
          className="px-6 py-3 rounded-xl text-sm font-semibold bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors whitespace-nowrap"
        >
          🚪 Logout
        </button>
      </div>
    </div>
  );
}
