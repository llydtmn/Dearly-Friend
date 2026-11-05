import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import SplashScreen from './components/SplashScreen';
import Landing from './components/Landing';
import Login from './components/Login';
import Home from './pages/Home';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState(null); // null = landing page

  const hasLetterLink = new URLSearchParams(window.location.search).has('letter');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
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

  return (
    <Home
      user={session.user}
      onSignOut={() => {
        supabase.auth.signOut();
        setAuthMode(null);
      }}
    />
  );
}