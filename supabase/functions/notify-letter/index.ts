import nodemailer from 'npm:nodemailer@6.9.14';
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: Deno.env.get('GMAIL_USER'),
    pass: Deno.env.get('GMAIL_APP_PASSWORD'),
  },
});

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Push is optional: if the VAPID secrets are missing, only the email is sent
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const pushReady = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (pushReady) {
  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? `mailto:${Deno.env.get('GMAIL_USER')}`,
    VAPID_PUBLIC_KEY!,
    VAPID_PRIVATE_KEY!,
  );
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Sends a push to every device the recipient turned notifications on for.
// Never throws: a push problem must not stop the email.
async function sendPush(m: Record<string, string>) {
  if (!pushReady) return;
  try {
    const { data: recipient } = await admin
      .from('profiles')
      .select('id')
      .eq('email', m.recipient_email.toLowerCase())
      .maybeSingle();
    if (!recipient) return; // not signed up yet: nothing to push to

    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', recipient.id);
    if (!subs || subs.length === 0) return;

    const { data: sender } = await admin.from('profiles').select('name').eq('id', m.sender_id).maybeSingle();
    const who = sender?.name || m.sender_email;

    // The letter itself is never put in the notification
    const payload = JSON.stringify({
      title: `${who} sent you a letter 💌`,
      body: 'Tap to open your letter.',
      url: `/?letter=${m.id}`,
      tag: `letter-${m.id}`,
    });

    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 60 * 60 * 24 },
          );
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            // The phone uninstalled or revoked it: clean up
            await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
          } else {
            console.error('Push failed:', code, err);
          }
        }
      }),
    );
  } catch (err) {
    console.error('Push step failed:', err);
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await req.json();
  const m = payload.record;
  if (payload.type !== 'INSERT' || !m) return new Response('ignored');

  // Skip everything if the recipient chose to stop notifications from this sender
  const { data: blocked } = await admin.rpc('email_blocked', {
    p_recipient: m.recipient_email,
    p_sender: m.sender_email,
  });
  if (blocked) return new Response('blocked by recipient');

  // Push first, so it still goes out even if the email fails
  await sendPush(m);

  const appUrl = Deno.env.get('APP_URL');
  const link = `${appUrl}/?letter=${m.id}&email=${encodeURIComponent(m.recipient_email)}`;
  const sender = esc(m.sender_email);

  try {
    await transporter.sendMail({
      from: `"Dearly" <${Deno.env.get('GMAIL_USER')}>`,
      to: m.recipient_email,
      subject: `${m.sender_email} sent you a letter 💌`,
      html: `
        <div style="font-family:Georgia,serif;max-width:480px;margin:auto;padding:24px;background:#e8e4db;color:#2c2c2c">
          <h2 style="margin-top:0">You have a new letter</h2>
          <p><b>${sender}</b> wrote to you on Dearly.</p>
          <p><a href="${link}" style="display:inline-block;background:#8b2e2e;color:#e8e4db;padding:10px 20px;text-decoration:none;border-radius:2px">Open your letter</a></p>
          <p style="font-size:13px;color:#555">New here? Tap the button, sign up with this email address (${esc(m.recipient_email)}), and your letter will open right away.</p>
        </div>`,
    });
  } catch (err) {
    console.error('Failed to send notification:', err);
    return new Response('email failed', { status: 500 });
  }

  return new Response('sent');
});
