import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useToast } from './Toast';

// Shown after someone opens the reset link from their email
export default function ResetPassword({ onDone }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = () => {
    // drop the recovery tokens from the address bar
    window.history.replaceState({}, '', window.location.pathname);
    onDone();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);

    toast.success('Password updated. You are signed in.');
    finish();
  };

  const inputClass = 'w-full bg-transparent border-b border-ink/30 focus:border-heart outline-none py-2';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-paper w-full max-w-sm p-8 rounded-sm shadow-2xl text-ink space-y-4">
        <h1 className="font-handwriting text-4xl text-center">Dearly</h1>
        <p className="text-center text-sm text-ink/60">Choose a new password</p>
        <input
          type="password" required autoFocus placeholder="New password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <input
          type="password" required placeholder="Confirm new password" value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
        {error && <p className="text-heart text-sm">{error}</p>}
        <button disabled={busy} className="w-full bg-heart text-paper py-2 rounded-sm disabled:opacity-50">
          {busy ? 'Saving...' : 'Save new password'}
        </button>
        <p className="text-center text-sm">
          <button type="button" onClick={finish} className="text-ink/60 hover:text-heart">
            Skip for now
          </button>
        </p>
      </form>
    </div>
  );
}
