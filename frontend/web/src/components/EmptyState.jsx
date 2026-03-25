/**
 * EmptyState.jsx — No-data placeholder
 *
 * Props:
 *   icon    — Optional emoji or React node
 *   title   — Heading text
 *   message — Description
 *   action  — Optional { label, onClick } for a CTA button
 */
import React from 'react';
import MailFilledIcon from './ui/mail-filled-icon';

export default function EmptyState({ icon = <MailFilledIcon size={48} className="text-current opacity-50" />, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <span className="text-5xl mb-4">{icon}</span>
      <h3 className="text-xl font-bold text-ink-900 mb-2">{title}</h3>
      <p className="text-sm text-ink-500 max-w-sm mb-6">{message}</p>
      {action && (
        <button onClick={action.onClick} className="btn-primary">
          {action.label}
        </button>
      )}
    </div>
  );
}
