import sgMail from '@sendgrid/mail';
import { logger } from '../utils/logger';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@yourapp.com';
const APP_NAME   = process.env.APP_NAME || 'InterviewPrep';

function isSendGridConfigured(): boolean {
  if (SENDGRID_API_KEY) return true;
  logger.warn('SendGrid is not configured; skipping email send.');
  return false;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReminderEmailOpts {
  to: string;
  sessionTitle: string;
  scheduledAt: Date;
}

interface StreakRiskEmailOpts {
  to: string;
  currentStreak: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
  });
}

// ── Email senders ─────────────────────────────────────────────────────────────

export async function sendReminderEmail(opts: ReminderEmailOpts): Promise<void> {
  if (!isSendGridConfigured()) return;
  const { to, sessionTitle, scheduledAt } = opts;
  try {
    await sgMail.send({
      to,
      from: { email: FROM_EMAIL, name: APP_NAME },
      subject: `⏰ Reminder: "${sessionTitle}" starts in 15 minutes`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="margin:0 0 8px;font-size:22px;color:#1c1917">Your interview is almost here</h2>
          <p style="color:#78716c;margin:0 0 24px">
            <strong>${sessionTitle}</strong> is scheduled for<br>
            <strong>${formatDateTime(scheduledAt)}</strong>
          </p>
          <a href="${process.env.APP_URL || 'http://localhost:5173'}/setup"
            style="display:inline-block;background:#f97316;color:#fff;padding:12px 28px;
                   border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
            Start Interview →
          </a>
          <p style="color:#a8a29e;font-size:12px;margin-top:32px">
            You can cancel or reschedule from your Dashboard.
          </p>
        </div>
      `,
    });
    logger.info(`Reminder email sent to ${to}`);
  } catch (err: any) {
    // Log but don't throw — a failed email shouldn't break the job
    logger.error('SendGrid reminder error:', err?.response?.body ?? err);
  }
}

export async function sendStreakAtRiskEmail(opts: StreakRiskEmailOpts): Promise<void> {
  if (!isSendGridConfigured()) return;
  const { to, currentStreak } = opts;
  try {
    await sgMail.send({
      to,
      from: { email: FROM_EMAIL, name: APP_NAME },
      subject: `🔥 Don't lose your ${currentStreak}-day streak!`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="margin:0 0 8px;font-size:22px;color:#1c1917">
            Your streak is at risk 🔥
          </h2>
          <p style="color:#78716c;margin:0 0 8px">
            You've been on a <strong>${currentStreak}-day streak</strong> — amazing work!
          </p>
          <p style="color:#78716c;margin:0 0 24px">
            Practice at least one session today to keep it going.
          </p>
          <a href="${process.env.APP_URL || 'http://localhost:5173'}/setup"
            style="display:inline-block;background:#f97316;color:#fff;padding:12px 28px;
                   border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
            Practice Now →
          </a>
        </div>
      `,
    });
    logger.info(`Streak-at-risk email sent to ${to}`);
  } catch (err: any) {
    logger.error('SendGrid streak-risk error:', err?.response?.body ?? err);
  }
}
