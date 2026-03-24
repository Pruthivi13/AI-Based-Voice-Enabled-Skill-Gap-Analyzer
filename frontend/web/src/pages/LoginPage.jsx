import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function LoginPage() {
  const { login, googleSignIn } = useAuth();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await googleSignIn();
      navigate('/');
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
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
            Welcome Back
          </h1>
          <p className={isDark ? 'text-white/50' : 'text-ink-500'}>
            Sign in to continue your interview practice
          </p>
        </div>

        <div className="card">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Google Sign-In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border text-sm font-semibold transition-colors disabled:opacity-50 mb-6 ${
              isDark
                ? 'bg-white/5 border-white/20 text-white hover:bg-white/10'
                : 'bg-white border-surface-200 text-ink-900 hover:bg-surface-50'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className={`flex-1 h-px ${isDark ? 'bg-white/10' : 'bg-surface-200'}`} />
            <span className={`text-xs font-medium ${isDark ? 'text-white/30' : 'text-ink-400'}`}>OR</span>
            <div className={`flex-1 h-px ${isDark ? 'bg-white/10' : 'bg-surface-200'}`} />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
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

            <div>
              <label className="section-header">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-100 border border-surface-200 text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="••••••••"
              />
            </div>

            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-sm text-primary-500 hover:text-primary-600"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p
            className={`text-center text-sm mt-4 ${isDark ? 'text-white/50' : 'text-ink-500'}`}
          >
            Don't have an account?{' '}
            <Link
              to="/register"
              className="text-primary-500 font-semibold hover:text-primary-600"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
