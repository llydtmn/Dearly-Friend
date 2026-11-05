import { useState, useEffect } from 'react';
import { supabase, isRecovering, clearRecovering, getCachedSession } from './supabaseClient';
import SplashScreen from './components/SplashScreen';
import Landing from './components/Landing';
import Login from './components/Login';
import Home from './pages/Home';
import Legal from './pages/Legal';
import Admin from './pages/Admin';
import ResetPassword from './components/ResetPassword';
import StopEmailsPrompt from './components/StopEmailsPrompt';
import { forgetPushOnThisDevice } from './services/pushService';

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/privacy' || path === '/terms') return <Legal />;
  if (path === '/admin') return <Admin />; // has its own login panel
  return <AppInner />;
}

function AppInner() {
  const [showSplash, setShowSplash] = useState(true);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState(null); // null = landing page
  const [recovering, setRecovering] = useState(isRecovering);

  const query = new URLSearchParams(window.location.search);
  const stopSender = (query.get('stop') || '').trim().toLowerCase();
  const invitedEmail = (query.get('email') || '').trim().toLowerCase();
  const [stopOpen, setStopOpen] = useState(!!stopSender);
  const hasLetterLink = query.has('letter') || !!stopSender;
  const [switchedAccount, setSwitchedAccount] = useState(false);

  // An email link (?letter=…&email=…) was opened in a browser that is signed in as someone else.
  // That person must not stay signed in here, so sign out and let the intended recipient log in.
  const sessionEmail = (session?.user?.email || '').toLowerCase();
  const wrongAccount = !!session && query.has('letter') && !!invitedEmail && sessionEmail !== invitedEmail;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      // the recovery event may have fired before this component mounted: the marker still knows
      if (isRecovering()) setRecovering(true);
      // No connection and the saved login can't be refreshed: still open the app
      setSession(data.session ?? (navigator.onLine ? null : getCachedSession()));
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
      if (!s && event !== 'SIGNED_OUT' && !navigator.onLine) return; // offline hiccup, not a real sign-out
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!wrongAccount) return;
    let alive = true;
    (async () => {
      try {
        await forgetPushOnThisDevice(); // stop this device receiving the other account's notifications
      } catch {
        /* best effort: never block signing out */
      }
      // 'local' signs out this browser only, not the other person's phone or other devices
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      if (alive) {
        setSwitchedAccount(true);
        setSession(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [wrongAccount]);

  if (showSplash) return <SplashScreen onComplete={() => setShowSplash(false)} />;
  if (loading) return null;
  if (wrongAccount) return null; // never flash another person's inbox while signing out

  if (!session) {
    // People arriving from an email link skip the landing page and go straight to login
    if (!authMode && !hasLetterLink) {
      return <Landing onSignIn={() => setAuthMode('signin')} onSignUp={() => setAuthMode('signup')} />;
    }
    return (
      <Login
        initialMode={authMode ?? 'signin'}
        initialNotice={
          switchedAccount
            ? 'We signed out the other account on this browser so you can open your letter. Sign in with the email it was sent to.'
            : ''
        }
        onBack={hasLetterLink ? undefined : () => setAuthMode(null)}
      />
    );
  }

  if (recovering) return <ResetPassword onDone={() => { clearRecovering(); setRecovering(false); }} />;

  const signOut = () => {
    supabase.auth.signOut().catch(() => {});
    setAuthMode(null);
  };

  const closeStop = () => {
    setStopOpen(false);
    window.history.replaceState({}, '', window.location.pathname);
  };

  return (
    <>
      <Home user={session.user} onSignOut={signOut} />
      {stopOpen && (
        <StopEmailsPrompt user={session.user} sender={stopSender} invitedEmail={invitedEmail} onClose={closeStop} />
      )}
    </>
  );
}