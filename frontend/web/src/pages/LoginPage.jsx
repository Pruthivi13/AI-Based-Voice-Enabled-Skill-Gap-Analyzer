import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function LoginPage() {
  const { login } = useAuth();
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
      navigate('/dashboard');
    } catch (err) {
      setError('Invalid email or password.');
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
