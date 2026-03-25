/**
 * SettingsPage.jsx — User preferences and profile settings
 *
 * Maps to PRD §9.27 Settings & Preferences.
 * Features:
 *   • Profile section (name, email) — placeholder
 *   • Preferred role default
 *   • Theme toggle placeholder
 *   • Notification preferences placeholder
 *   • Privacy preferences placeholder
 *   • Save button
 *
 * TODO: Connect to user settings API when backend is ready.
 * All form values are local state placeholders.
 */
import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { fetchSettings, updateSettings } from '../services/mockApi';
import LoadingState from '../components/LoadingState';
import { CheckCircle2 } from 'lucide-react';

const ROLES = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Data Scientist',
  'DevOps Engineer',
  'Product Manager',
];
const THEMES = ['light', 'dark', 'system'];
const NOTIFICATION_SETTINGS = [
  { key: 'sessionReminders', label: 'Session Reminders' },
  { key: 'weeklyProgress', label: 'Weekly Progress Reports' },
  { key: 'newResources', label: 'New Resource Alerts' },
];

export default function SettingsPage() {
  const { theme, setTheme, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [preferredRole, setPreferredRole] = useState('Frontend Developer');
  const [notifications, setNotifications] = useState({
    sessionReminders: true,
    weeklyProgress: true,
    newResources: false,
  });

  useEffect(() => {
    fetchSettings()
      .then((data) => {
        setName(data.name || '');
        setEmail(data.email || '');
        setPreferredRole(data.preferredRole || 'Frontend Developer');
        setNotifications(
          data.notifications || {
            sessionReminders: true,
            weeklyProgress: true,
            newResources: false,
          }
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateSettings({
        name,
        preferredRole,
        theme,
        notifications,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Loading settings..." />;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="mb-2">Settings</h1>
      <p className={`mb-10 ${isDark ? 'text-white/50' : 'text-ink-500'}`}>
        Manage your profile and preferences.
      </p>

      <div className="space-y-8">
        {/* Profile */}
        <section className="card">
          <h3
            className={`font-bold mb-4 ${isDark ? 'text-white' : 'text-ink-900'}`}
          >
            Profile
          </h3>
          <div className="space-y-4">
            <div>
              <label className="section-header">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-100 border border-surface-200 text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="section-header">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-100 border border-surface-200 text-ink-500 cursor-not-allowed"
              />
              <p className="text-xs text-ink-500 mt-1">Email is read-only</p>
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section className="card">
          <h3
            className={`font-bold mb-4 ${isDark ? 'text-white' : 'text-ink-900'}`}
          >
            Preferences
          </h3>
          <div className="space-y-4">
            <div>
              <label className="section-header">Default Role</label>
              <select
                value={preferredRole}
                onChange={(e) => setPreferredRole(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-100 border border-surface-200 text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="section-header">Theme</label>
              <div className="flex gap-3 mt-2">
                {THEMES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all capitalize ${
                      theme === t
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-white text-ink-700 border-surface-200 hover:border-primary-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="card">
          <h3
            className={`font-bold mb-4 ${isDark ? 'text-white' : 'text-ink-900'}`}
          >
            Notifications
          </h3>
          <div className="space-y-3">
            {NOTIFICATION_SETTINGS.map((item) => (
              <label
                key={item.key}
                className="flex items-center justify-between cursor-pointer"
              >
                <span
                  className={`text-sm font-medium ${isDark ? 'text-white/70' : 'text-ink-700'}`}
                >
                  {item.label}
                </span>
                <div
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                    notifications[item.key]
                      ? 'bg-primary-500'
                      : 'bg-surface-200'
                  }`}
                  onClick={() =>
                    setNotifications((n) => ({
                      ...n,
                      [item.key]: !n[item.key],
                    }))
                  }
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      notifications[item.key]
                        ? 'translate-x-5'
                        : 'translate-x-0'
                    }`}
                  />
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* Save */}
        {saved && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> Settings saved successfully!
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full text-lg py-4 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
