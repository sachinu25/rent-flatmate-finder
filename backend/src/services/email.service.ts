import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

/**
 * Transactional email. Every send is fire-and-forget: failures are logged and
 * never propagate to the request that triggered them.
 *
 *  - resend      → Resend HTTPS API (works on hosts that block SMTP ports)
 *  - nodemailer  → generic SMTP
 *  - none        → disabled (logged at debug level)
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Strip characters that could break an email header. */
const headerSafe = (v: string) => v.replace(/[\r\n]+/g, ' ').slice(0, 150);

async function sendViaResend(o: EmailOptions) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.EMAIL_API_KEY ?? ''}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [o.to], subject: o.subject, html: o.html, text: o.text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function sendViaSmtp(o: EmailOptions) {
  const { default: nodemailer } = await import('nodemailer');
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth: { user: env.SMTP_USER ?? '', pass: env.SMTP_PASS ?? '' },
  });
  await transport.sendMail({ from: env.EMAIL_FROM, ...o });
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (env.EMAIL_PROVIDER === 'none' || env.isTest) {
    logger.debug({ subject: options.subject }, 'Email disabled — skipped');
    return false;
  }
  const opts = { ...options, subject: headerSafe(options.subject) };
  try {
    if (env.EMAIL_PROVIDER === 'resend') await sendViaResend(opts);
    else await sendViaSmtp(opts);
    logger.info({ subject: opts.subject }, 'Email sent');
    return true;
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err }, 'Email send failed — non-blocking');
    return false;
  }
}

function layout(heading: string, bodyHtml: string, cta?: { label: string; path: string }) {
  const button = cta
    ? `<p style="margin:28px 0 0"><a href="${escapeHtml(env.APP_URL + cta.path)}" style="background:#0f766e;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(cta.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917">
<div style="max-width:560px;margin:0 auto;padding:32px 16px">
<div style="font-weight:700;font-size:18px;color:#0f766e;margin-bottom:16px">Rent &amp; Flatmate Finder</div>
<div style="background:#fff;border-radius:16px;padding:28px;border:1px solid #e7e5e4">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(heading)}</h1>
<div style="font-size:15px;line-height:1.6;color:#44403c">${bodyHtml}</div>${button}
</div>
<p style="font-size:12px;color:#78716c;margin-top:16px">You received this because of activity on your account.</p>
</div></body></html>`;
}

export function sendHighScoreInterestEmail(ownerEmail: string, tenantName: string, listingTitle: string, score: number) {
  void sendEmail({
    to: ownerEmail,
    subject: `High-match tenant interested in "${listingTitle}"`,
    html: layout(
      'A strong match is interested in your listing',
      `<p><strong>${escapeHtml(tenantName)}</strong> (compatibility ${score}/100) has expressed interest in <strong>${escapeHtml(listingTitle)}</strong>.</p>`,
      { label: 'Review request', path: '/dashboard/interests' },
    ),
    text: `${tenantName} (compatibility ${score}/100) is interested in "${listingTitle}". Review: ${env.APP_URL}/dashboard/interests`,
  });
}

export function sendInterestReceivedEmail(ownerEmail: string, tenantName: string, listingTitle: string) {
  void sendEmail({
    to: ownerEmail,
    subject: `New interest in "${listingTitle}"`,
    html: layout(
      'You have a new interest request',
      `<p><strong>${escapeHtml(tenantName)}</strong> is interested in <strong>${escapeHtml(listingTitle)}</strong>.</p>`,
      { label: 'Review request', path: '/dashboard/interests' },
    ),
    text: `${tenantName} is interested in "${listingTitle}". Review: ${env.APP_URL}/dashboard/interests`,
  });
}

export function sendInterestDecisionEmail(tenantEmail: string, listingTitle: string, status: 'ACCEPTED' | 'DECLINED') {
  const accepted = status === 'ACCEPTED';
  void sendEmail({
    to: tenantEmail,
    subject: accepted ? `Your interest in "${listingTitle}" was accepted` : `Update on "${listingTitle}"`,
    html: layout(
      accepted ? 'Good news — your request was accepted' : 'Your request was declined',
      accepted
        ? `<p>The owner of <strong>${escapeHtml(listingTitle)}</strong> accepted your interest. You can now chat with them directly.</p>`
        : `<p>The owner of <strong>${escapeHtml(listingTitle)}</strong> has declined your request. There are plenty of other places to explore.</p>`,
      accepted ? { label: 'Open messages', path: '/messages' } : { label: 'Browse listings', path: '/listings' },
    ),
    text: accepted
      ? `Your interest in "${listingTitle}" was accepted. Chat now: ${env.APP_URL}/messages`
      : `Your interest in "${listingTitle}" was declined. Browse more: ${env.APP_URL}/listings`,
  });
}
