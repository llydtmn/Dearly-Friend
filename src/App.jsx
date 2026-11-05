import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import SplashScreen from './components/SplashScreen';
import Login from './components/Login';
import Home from './pages/Home';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

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
  if (!session) return <Login />;

  return <Home user={session.user} onSignOut={() => supabase.auth.signOut()} />;
}