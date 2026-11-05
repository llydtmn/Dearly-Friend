import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Login({ initialMode = 'signin', onBack }) {
  const params = new URLSearchParams(window.location.search);
  const hasLetter = !!params.get('letter');
  const invitedEmail = (params.get('email') || '').trim().toLowerCase();

  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === 'signup';

  const switchMode = () => {
    setMode(isSignUp ? 'signin' : 'signup');
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

    setBusy(true);

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { name: name.trim() } },
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
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) setError(error.message);
    }

    setBusy(false);
  };

  const inputClass = 'w-full bg-transparent border-b border-ink/30 focus:border-heart outline-none py-2';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-paper w-full max-w-sm p-8 rounded-sm shadow-2xl text-ink space-y-4">
        {onBack && (
          <button type="button" onClick={onBack} className="text-sm text-ink/60 hover:text-heart">
            ← Back
          </button>
        )}
        <h1 className="font-handwriting text-4xl text-center">Dearly</h1>
        <p className="text-center text-sm text-ink/60">{isSignUp ? 'Create your account' : 'Welcome back'}</p>
        {hasLetter && invitedEmail && (
          <p className="text-center text-sm bg-heart/10 text-heart rounded-sm px-3 py-2">
            💌 A letter is waiting for you. Sign in or sign up with {invitedEmail} to read it.
          </p>
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
          readOnly={!!invitedEmail}
          className={`${inputClass} ${invitedEmail ? 'text-ink/70 cursor-default' : ''}`}
        />
        <input
          type="password" required placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus={!!invitedEmail}
          className={inputClass}
        />
        {isSignUp && (
          <input
            type="password" required placeholder="Confirm password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        )}

        {error && <p className="text-heart text-sm">{error}</p>}
        {notice && <p className="text-green-700 text-sm">{notice}</p>}

        <button disabled={busy} className="w-full bg-heart text-paper py-2 rounded-sm disabled:opacity-50">
          {busy ? (isSignUp ? 'Creating account...' : 'Signing in...') : isSignUp ? 'Sign up' : 'Sign in'}
        </button>

        <p className="text-center text-sm text-ink/70">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" onClick={switchMode} className="text-heart underline">
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </form>
    </div>
  );
}