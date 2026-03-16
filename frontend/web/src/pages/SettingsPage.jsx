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
import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function SettingsPage() {
  // Theme state from global context (persisted to localStorage)
  const { theme, setTheme, isDark } = useTheme();

  // Placeholder state — will persist to backend settings API
  const [name, setName] = useState('Alex Johnson');
  const [email, setEmail] = useState('alex@example.com');
  const [preferredRole, setPreferredRole] = useState('Frontend Developer');
  const [notifications, setNotifications] = useState({
    sessionReminders: true,
    weeklyProgress: true,
    newResources: false,
  });

  const handleSave = () => {
    // TODO: POST /api/settings with updated preferences
    console.log('[Settings] Saving:', { name, email, preferredRole, theme, notifications });
    alert('Settings saved! (placeholder)');
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="mb-2">Settings</h1>
      <p className="text-ink-500 mb-10">Manage your profile and preferences.</p>

      <div className="space-y-8">
        {/* ── Profile ── */}
        <section className="card">
          <h3 className="font-bold text-ink-900 mb-4">Profile</h3>
          <div className="space-y-4">
            <div>
              <label className="section-header">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-100 border border-surface-200
                           text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="section-header">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-100 border border-surface-200
                           text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </section>

        {/* ── Preferences ── */}
        <section className="card">
          <h3 className="font-bold text-ink-900 mb-4">Preferences</h3>
          <div className="space-y-4">
            <div>
              <label className="section-header">Default Role</label>
              <select
                value={preferredRole}
                onChange={(e) => setPreferredRole(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-100 border border-surface-200
                           text-ink-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {['Frontend Developer', 'Backend Developer', 'Full Stack Developer',
                  'Data Scientist', 'DevOps Engineer', 'Product Manager'].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Theme toggle placeholder */}
            <div>
              <label className="section-header">Theme</label>
              <div className="flex gap-3 mt-2">
                {['light', 'dark', 'system'].map((t) => (
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

        {/* ── Notifications ── */}
        <section className="card">
          <h3 className="font-bold text-ink-900 mb-4">Notifications</h3>
          <div className="space-y-3">
            {[
              { key: 'sessionReminders', label: 'Session Reminders' },
              { key: 'weeklyProgress', label: 'Weekly Progress Reports' },
              { key: 'newResources', label: 'New Resource Alerts' },
            ].map((item) => (
              <label key={item.key} className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-ink-700">{item.label}</span>
                <div
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                    notifications[item.key] ? 'bg-primary-500' : 'bg-surface-200'
                  }`}
                  onClick={() =>
                    setNotifications((n) => ({ ...n, [item.key]: !n[item.key] }))
                  }
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      notifications[item.key] ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* ── Privacy ── */}
        <section className="card">
          <h3 className="font-bold text-ink-900 mb-4">Privacy</h3>
          <p className="text-sm text-ink-500 mb-3">
            Your data is encrypted and stored securely. You can request data deletion at any time.
          </p>
          <button className="text-sm font-semibold text-danger hover:underline">
            Request Data Deletion
          </button>
        </section>

        {/* Save */}
        <button onClick={handleSave} className="btn-primary w-full text-lg py-4">
          Save Settings
        </button>
      </div>
    </div>
  );
}
