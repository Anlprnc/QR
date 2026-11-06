import type { Env } from './auth';

export async function sendMail(env: Env, to: string | string[], subject: string, text: string) {
  if (!env.RESEND_API_KEY) {
    console.log(`[dev] e-posta → ${[to].flat().join(', ')}: ${subject}\n${text}`);
    return;
  }
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM ?? 'ArızaQR <giris@example.com>', to, subject, text }),
  });
}
