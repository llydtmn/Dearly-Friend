import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ArrowLeft, RefreshCw, Trash2, Search, LogOut, Lock } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useToast } from '../components/Toast';

// One id per browser tab: reloading keeps it, a second tab or device gets its own
const lockSessionId = () => {
  try {
    let id = sessionStorage.getItem('dearly_admin_session');
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('dearly_admin_session', id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
};

const CHECK_EVERY_MS = 10000; // keeps our spot, or retries while someone else is in

function Center({ children }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6 bg-[#141414] text-gray-100 relative z-50 font-sans">
      {children}
    </div>
  );
}

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

/**
 * /admin has its own sign-in panel, separate from the main Dearly login.
 * Only emails listed in the `admins` table get past the database checks.
 */
export default function Admin() {
  const [session, setSession] = useState(undefined); // undefined = still checking

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  if (!session) return <AdminLogin />;
  return <AdminPanel user={session.user} />;
}

function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (error) setError(error.message);
  };

  const input =
    'w-full bg-[#2a2a2a] px-3 py-2 rounded-sm text-sm text-gray-100 outline-none border border-gray-700 focus:border-gray-500';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans bg-[#141414] relative z-50">
      <form onSubmit={submit} className="w-full max-w-sm bg-[#222] border border-gray-700 rounded-sm p-6 space-y-4">
        <div className="flex items-center gap-2 text-paper">
          <Lock size={18} />
          <h1 className="font-handwriting text-3xl">Dearly Admin</h1>
        </div>
        <p className="text-sm text-gray-300">For administrators only.</p>
        <input
          type="email"
          required
          autoFocus
          autoComplete="username"
          placeholder="Admin email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={input}
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
        />
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-heart text-paper py-2 rounded-sm text-sm tracking-wide hover:bg-red-900 transition-colors disabled:opacity-50"
        >
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

function AdminPanel({ user }) {
  const toast = useToast();
  const sessionId = useRef(lockSessionId()).current;
  const [phase, setPhase] = useState('claiming'); // claiming | ready | busy | lost | denied
  const [holder, setHolder] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState(null); // the user being deleted
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const denied = phase === 'denied';

  // Take (or keep) the single admin seat. Runs on a timer, so it doubles as the heartbeat.
  const claim = useCallback(async () => {
    const { error } = await supabase.rpc('admin_claim', { p_session: sessionId });
    if (!error) {
      setPhase('ready');
    } else if (/not allowed/i.test(error.message)) {
      setPhase('denied');
    } else if (/admin_in_use/i.test(error.message)) {
      setHolder(error.message.split('ADMIN_IN_USE:')[1]?.trim() ?? '');
      setPhase((p) => (p === 'ready' ? 'lost' : 'busy'));
    }
    // other errors (no connection...): keep the current screen and try again on the next beat
  }, [sessionId]);

  useEffect(() => {
    claim();
    const timer = setInterval(claim, CHECK_EVERY_MS);
    return () => clearInterval(timer);
  }, [claim]);

  // Give the seat back when leaving (the database also frees it on its own after ~45 seconds)
  useEffect(() => {
    const release = () => {
      supabase.rpc('admin_release', { p_session: sessionId }).then(() => {});
    };
    window.addEventListener('pagehide', release);
    return () => {
      window.removeEventListener('pagehide', release);
      release();
    };
  }, [sessionId]);

  const leave = async () => {
    await supabase.rpc('admin_release', { p_session: sessionId });
    await supabase.auth.signOut();
  };

  const lockProblem = (error) => {
    if (/admin_in_use|admin_lock_lost/i.test(error.message)) {
      setPhase('lost');
      return true;
    }
    return false;
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('admin_list_users', { p_session: sessionId });
    if (error) {
      if (/not allowed/i.test(error.message)) setPhase('denied');
      else if (!/admin_in_use|admin_lock_lost/i.test(error.message)) toast.error(`Couldn't load users: ${error.message}`);
      else setPhase('lost');
    } else {
      setUsers(data ?? []);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Load the list whenever we (re)gain the seat
  useEffect(() => {
    if (phase === 'ready') load();
  }, [phase, load]);

  const shown = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return users;
    return users.filter((u) => `${u.email} ${u.name ?? ''}`.toLowerCase().includes(t));
  }, [users, search]);

  const openDelete = (u) => {
    setTarget(u);
    setTyped('');
  };

  const confirmDelete = async () => {
    if (!target || typed.trim().toLowerCase() !== target.email.toLowerCase()) return;
    setDeleting(true);
    const { error } = await supabase.rpc('admin_delete_user', { target: target.id, p_session: sessionId });
    setDeleting(false);
    if (error) {
      if (lockProblem(error)) return;
      toast.error(`Couldn't delete: ${error.message}`);
      return;
    }
    toast.success(`${target.email} was deleted.`);
    setUsers((prev) => prev.filter((u) => u.id !== target.id));
    setTarget(null);
  };

  if (phase === 'claiming') return <Center><p className="text-gray-300">Checking...</p></Center>;

  if (phase === 'busy' || phase === 'lost') {
    return (
      <Center>
        <p className="font-handwriting text-3xl">
          {phase === 'lost' ? 'Admin was taken over.' : 'Admin is in use right now.'}
        </p>
        <p className="text-sm text-gray-300 max-w-sm">
          {holder ? `${holder} is using it. ` : ''}Only one person can use the admin page at a time. This page checks again
          every few seconds and will open when it's free.
        </p>
        <button onClick={leave} className="text-sm underline text-gray-300 hover:text-paper">
          Sign out
        </button>
      </Center>
    );
  }

  if (denied) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6 bg-[#141414] text-gray-100 relative z-50">
        <p className="font-handwriting text-3xl">{user.email} isn't an admin.</p>
        <button onClick={leave} className="text-sm underline text-gray-300 hover:text-paper">
          Sign out and use a different account
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans text-gray-100 bg-[#141414] relative z-50">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <a href="/" aria-label="Back to Dearly" className="text-gray-300 hover:text-paper p-1">
              <ArrowLeft size={20} />
            </a>
            <h1 className="font-handwriting text-3xl text-paper">Admin</h1>
            <span className="text-sm text-gray-300 hidden sm:inline">signed in as {user.email}</span>
          </div>
          <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 text-sm px-3 py-1.5 border border-gray-600 rounded-sm hover:border-gray-400 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={leave}
            title="Sign out"
            aria-label="Sign out"
            className="flex items-center gap-2 text-sm px-3 py-1.5 border border-gray-600 rounded-sm hover:border-gray-400"
          >
            <LogOut size={14} /> Sign out
          </button>
          </div>
        </div>

        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name..."
            className="w-full bg-[#2a2a2a] text-gray-100 placeholder-gray-400 pl-9 pr-4 py-2 rounded-sm text-sm outline-none border border-gray-700 focus:border-gray-500"
          />
        </div>

        <p className="text-sm text-gray-300 mb-2">
          {users.length} user{users.length === 1 ? '' : 's'}
        </p>

        <div className="overflow-x-auto border border-gray-700/60 rounded-sm">
          <table className="w-full text-sm bg-[#1c1c1c]">
            <thead className="bg-[#2a2a2a] text-gray-200 text-left">
              <tr>
                <th className="px-3 py-2 font-normal">User</th>
                <th className="px-3 py-2 font-normal">Joined</th>
                <th className="px-3 py-2 font-normal">Last sign-in</th>
                <th className="px-3 py-2 font-normal text-right">Sent</th>
                <th className="px-3 py-2 font-normal text-right">Received</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">Loading...</td></tr>
              )}
              {!loading && shown.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No users found.</td></tr>
              )}
              {shown.map((u) => {
                const me = u.id === user.id;
                return (
                  <tr key={u.id} className="border-t border-gray-700">
                    <td className="px-3 py-2">
                      <div className="break-all text-base text-white">{u.email}</div>
                      <div className="text-sm text-gray-300">{u.name || '-'}{me ? ' (you)' : ''}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-300">{when(u.created_at)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-300">{when(u.last_sign_in_at)}</td>
                    <td className="px-3 py-2 text-right">{u.letters_sent}</td>
                    <td className="px-3 py-2 text-right">{u.letters_received}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => openDelete(u)}
                        disabled={me}
                        title={me ? "You can't delete yourself here" : 'Delete user'}
                        aria-label={`Delete ${u.email}`}
                        className="p-2 text-gray-300 hover:text-red-400 disabled:opacity-30 disabled:hover:text-gray-300"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {target && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
        >
          <div className="bg-[#222] border border-gray-700 rounded-sm w-full max-w-sm p-5">
            <h2 className="text-lg text-paper mb-2">Delete this user?</h2>
            <p className="text-sm text-gray-300 mb-3">
              This permanently deletes <span className="text-gray-200 break-all">{target.email}</span>, the{' '}
              {target.letters_sent} letter{target.letters_sent === 1 ? '' : 's'} they sent and the{' '}
              {target.letters_received} they received. It can't be undone.
            </p>
            <label className="block text-sm text-gray-300 mb-1">Type their email to confirm</label>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full bg-[#2a2a2a] px-3 py-2 rounded-sm text-sm outline-none border border-gray-700 focus:border-gray-500 mb-4"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setTarget(null)} disabled={deleting} className="px-4 py-2 text-sm text-gray-300 hover:text-paper">
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting || typed.trim().toLowerCase() !== target.email.toLowerCase()}
                className="px-4 py-2 text-sm rounded-sm bg-red-700 text-white hover:bg-red-800 disabled:opacity-40"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}