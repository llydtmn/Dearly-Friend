import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import SplashScreen from './components/SplashScreen';
import Landing from './components/Landing';
import Login from './components/Login';
import Home from './pages/Home';
import Legal from './pages/Legal';
import ResetPassword from './components/ResetPassword';
import StopEmailsPrompt from './components/StopEmailsPrompt';

// Captured at load, before the auth client clears the URL: did we arrive from a password-reset email?
const arrivedViaRecoveryLink = window.location.hash.includes('type=recovery');

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
  const [recovering, setRecovering] = useState(arrivedViaRecoveryLink);

  const query = new URLSearchParams(window.location.search);
  const stopSender = (query.get('stop') || '').trim().toLowerCase();
  const invitedEmail = (query.get('email') || '').trim().toLowerCase();
  const [stopOpen, setStopOpen] = useState(!!stopSender);
  const hasLetterLink = query.has('letter') || !!stopSender;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
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

  if (recovering) return <ResetPassword onDone={() => setRecovering(false)} />;

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