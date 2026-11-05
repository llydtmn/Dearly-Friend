import { useState } from 'react';
import { supabase } from '../supabaseClient';
import Turnstile, { captchaEnabled } from './Turnstile';

// If a reset/confirm link was expired or already used, Supabase puts the reason in the URL hash
const linkError = () => {
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (!h.get('error')) return '';
  return h.get('error_code') === 'otp_expired'
    ? 'That link has expired or was already used. Request a new one below.'
    : (h.get('error_description') || 'That link did not work.').replace(/\+/g, ' ');
};

export default function Login({ initialMode = 'signin', initialNotice = '', onBack }) {
  const params = new URLSearchParams(window.location.search);
  const hasLetter = !!params.get('letter');
  const stopSender = (params.get('stop') || '').trim().toLowerCase();
  const invitedEmail = (params.get('email') || '').trim().toLowerCase();

  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup' | 'forgot'
  const [name, setName] = useState('');
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(linkError);
  const [notice, setNotice] = useState(initialNotice);
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaReset, setCaptchaReset] = useState(0);

  const isSignUp = mode === 'signup';
  const isForgot = mode === 'forgot';

  const goTo = (next) => {
    setMode(next);
    setError('');
    setNotice('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    const cleanEmail = email.trim().toLowerCase();

    if (isSignUp) {
      if (password.length < 6) return setError('Password must be at least 6 characters.');
      if (password !== confirm) return setError('Passwords do not match.');
    }
    if (captchaEnabled && !captchaToken) return setError('Please complete the security check first.');

    setBusy(true);
    const options = captchaEnabled ? { captchaToken } : {};

    if (isForgot) {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin,
        ...options,
      });
      if (error) setError(error.message);
      else setNotice('If an account exists for that email, a reset link is on its way. Check your inbox (and spam).');
    } else if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { name: name.trim() }, ...options },
      });
      if (error) {
        setError(error.message);
      } else if (data.user && data.user.identities?.length === 0) {
        setError('This email is already registered. Try signing in.');
      } else if (!data.session) {
        setNotice('Account created! Check your email to confirm it, then sign in.');
        setMode('signin');
        setPassword('');
        setConfirm('');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password, options });
      if (error) setError(error.message);
    }

    // CAPTCHA tokens can only be used once
    setCaptchaToken('');
    setCaptchaReset((n) => n + 1);
    setBusy(false);
  };

  const inputClass = 'w-full bg-transparent border-b border-ink/30 focus:border-heart outline-none py-2';

  const title = isForgot ? 'Reset your password' : isSignUp ? 'Create your account' : 'Welcome back';
  const submitLabel = isForgot ? 'Send reset link' : isSignUp ? 'Sign up' : 'Sign in';
  const busyLabel = isForgot ? 'Sending...' : isSignUp ? 'Creating account...' : 'Signing in...';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-paper w-full max-w-sm p-8 rounded-sm shadow-2xl text-ink space-y-4">
        {onBack && (
          <button type="button" onClick={onBack} className="text-sm text-ink/60 hover:text-heart">
            ← Back
          </button>
        )}
        <h1 className="font-handwriting text-4xl text-center">Dearly</h1>
        <p className="text-center text-sm text-ink/60">{title}</p>
        {hasLetter && invitedEmail && (
          <p className="text-center text-sm bg-heart/10 text-heart rounded-sm px-3 py-2">
            💌 A letter is waiting for you. Sign in or sign up with {invitedEmail} to read it.
          </p>
        )}
        {stopSender && (
          <p className="text-center text-sm bg-heart/10 text-heart rounded-sm px-3 py-2">
            Sign in{invitedEmail ? ` as ${invitedEmail}` : ''} to stop email notifications from {stopSender}.
          </p>
        )}

        {isForgot && (
          <p className="text-sm text-ink/70">Enter your email and we'll send you a link to choose a new password.</p>
        )}

        {isSignUp && (
          <input
            type="text" required placeholder="Your name" value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        )}
        <input
          type="email" required placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={!!invitedEmail && !isForgot}
          className={`${inputClass} ${invitedEmail && !isForgot ? 'text-ink/70 cursor-default' : ''}`}
        />
        {!isForgot && (
          <input
            type="password" required placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus={!!invitedEmail}
            className={inputClass}
          />
        )}
        {isSignUp && (
          <input
            type="password" required placeholder="Confirm password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        )}

        {mode === 'signin' && (
          <div className="text-right -mt-2">
            <button type="button" onClick={() => goTo('forgot')} className="text-sm text-ink/60 hover:text-heart">
              Forgot password?
            </button>
          </div>
        )}

        <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />

        {error && <p className="text-heart text-sm">{error}</p>}
        {notice && <p className="text-green-700 text-sm">{notice}</p>}

        <button
          disabled={busy || (captchaEnabled && !captchaToken)}
          className="w-full bg-heart text-paper py-2 rounded-sm disabled:opacity-50"
        >
          {busy ? busyLabel : submitLabel}
        </button>

        {isSignUp && (
          <p className="text-center text-xs text-ink/60">
            By signing up you agree to the <a href="/terms" className="underline hover:text-heart">Terms</a> and{' '}
            <a href="/privacy" className="underline hover:text-heart">Privacy Policy</a>.
          </p>
        )}

        <p className="text-center text-sm text-ink/70">
          {isForgot ? (
            <button type="button" onClick={() => goTo('signin')} className="text-heart underline">
              Back to sign in
            </button>
          ) : (
            <>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button type="button" onClick={() => goTo(isSignUp ? 'signin' : 'signup')} className="text-heart underline">
                {isSignUp ? 'Sign in' : 'Sign up'}
              </button>
            </>
          )}
        </p>
      </form>
    </div>
  );
}