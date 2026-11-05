import { useEffect } from 'react';
import { Heart } from 'lucide-react';

export default function SplashScreen({ onComplete }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-charcoal flex flex-col items-center justify-center z-50 animate-fade-in">
      <div className="animate-pulse-heart">
        <Heart size={80} className="text-heart fill-heart" />
      </div>
      <h1 className="font-handwriting text-5xl text-paper mt-6 tracking-wider">Dearly</h1>
      <p className="font-sans text-ink-light text-sm mt-2 tracking-widest uppercase">Connecting Friends</p>
    </div>
  );
}
