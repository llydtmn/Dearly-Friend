import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) setError(error.message);
    setBusy(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleLogin} className="bg-paper w-full max-w-sm p-8 rounded-sm shadow-2xl text-ink space-y-4">
        <h1 className="font-handwriting text-4xl text-center">Dearly</h1>
        <input
          type="email" required placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-transparent border-b border-ink/30 focus:border-heart outline-none py-2"
        />
        <input
          type="password" required placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-transparent border-b border-ink/30 focus:border-heart outline-none py-2"
        />
        {error && <p className="text-heart text-sm">{error}</p>}
        <button disabled={busy} className="w-full bg-heart text-paper py-2 rounded-sm disabled:opacity-50">
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}