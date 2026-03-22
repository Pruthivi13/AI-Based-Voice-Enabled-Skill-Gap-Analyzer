import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await resetPassword(email);
      setMessage('Password reset email sent! Check your inbox.');
    } catch (err) {
      setError('Failed to send reset email. Check the email address.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center px-6 ${isDark ? 'bg-dark-900' : 'bg-surface-50'}`}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1
            className={`text-3xl font-extrabold mb-2 ${isDark ? 'text-white' : 'text-ink-900'}`}
          >
            Reset Password
          </h1>
          <p className={isDark ? 'text-white/50' : 'text-ink-500'}>
            Enter your email to receive a reset link
          </p>
        </div>

        <div className="card">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl mb-4 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="section-header">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-100 border border-surface-200 text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Email'}
            </button>
          </form>

          <p
            className={`text-center text-sm mt-4 ${isDark ? 'text-white/50' : 'text-ink-500'}`}
          >
            <Link
              to="/login"
              className="text-primary-500 font-semibold hover:text-primary-600"
            >
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
