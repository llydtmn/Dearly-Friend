import { useEffect, useRef } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

// When no site key is set (e.g. local dev), the CAPTCHA is skipped entirely.
export const captchaEnabled = Boolean(SITE_KEY);

let scriptPromise = null;
const loadScript = () => {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error('Could not load the CAPTCHA.'));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
};

/**
 * Cloudflare Turnstile widget.
 * onToken(token) fires when the check passes; onToken('') when it expires or fails.
 * Change `resetKey` to get a fresh challenge (tokens are single-use).
 */
export default function Turnstile({ onToken, resetKey = 0 }) {
  const box = useRef(null);
  const widgetId = useRef(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!captchaEnabled) return undefined;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !box.current || widgetId.current !== null) return;
        widgetId.current = window.turnstile.render(box.current, {
          sitekey: SITE_KEY,
          theme: 'light',
          callback: (token) => cb.current?.(token),
          'expired-callback': () => cb.current?.(''),
          'error-callback': () => cb.current?.(''),
        });
      })
      .catch(() => cb.current?.(''));
    return () => {
      cancelled = true;
      if (widgetId.current !== null && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (resetKey > 0 && widgetId.current !== null && window.turnstile) {
      window.turnstile.reset(widgetId.current);
    }
  }, [resetKey]);

  if (!captchaEnabled) return null;
  return <div ref={box} className="flex justify-center min-h-[65px]" />;
}
