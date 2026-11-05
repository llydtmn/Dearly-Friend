import { useState, useEffect } from 'react';
import { supabase, isRecovering, clearRecovering, getCachedSession } from './supabaseClient';
import SplashScreen from './components/SplashScreen';
import Landing from './components/Landing';
import Login from './components/Login';
import Home from './pages/Home';
import Legal from './pages/Legal';
import ResetPassword from './components/ResetPassword';
import StopEmailsPrompt from './components/StopEmailsPrompt';

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === '/privacy' || path === '/terms') return <Legal />;
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

  if (showSplash) return <SplashScreen onComplete={() => setShowSplash(false)} />;
  if (loading) return null;

  if (!session) {
    // People arriving from an email link skip the landing page and go straight to login
    if (!authMode && !hasLetterLink) {
      return <Landing onSignIn={() => setAuthMode('signin')} onSignUp={() => setAuthMode('signup')} />;
    }
    return (
      <Login
        initialMode={authMode ?? 'signin'}
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