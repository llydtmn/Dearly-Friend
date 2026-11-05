import { useEffect, useRef, useState } from 'react';
import { Heart, X } from 'lucide-react';

// closed -> opening (flap lifts) -> sliding (card pulled out) -> expanding (card comes to you) -> onOpen()
const TIMING = { opening: 700, sliding: 1000, expanding: 450 };

export default function EnvelopeScreen({ onOpen, onClose, message }) {
  const [phase, setPhase] = useState('closed');
  const cardRef = useRef(null);
  const timers = useRef([]);
  const dark = localStorage.getItem('dearly_letter_dark') !== '0'; // match the paper the letter will use

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Esc closes, until the animation has started
  useEffect(() => {
    if (phase !== 'closed') return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  const handleOpen = () => {
    if (phase !== 'closed') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      onOpen();
      return;
    }
    setPhase('opening');
    later(() => setPhase('sliding'), TIMING.opening);
    later(() => {
      // grow the card towards the size of the letter, but never wider than the screen
      const w = cardRef.current?.getBoundingClientRect().width || 300;
      const grow = Math.max(1, Math.min(1.9, (window.innerWidth * 0.94) / w));
      cardRef.current?.style.setProperty('--grow', String(grow));
      setPhase('expanding');
    }, TIMING.opening + TIMING.sliding);
    later(onOpen, TIMING.opening + TIMING.sliding + TIMING.expanding);
  };

  const lines = [78, 92, 64, 86, 48];

  return (
    <div
      className="fixed inset-0 z-30 bg-charcoal/90 flex flex-col items-center justify-center p-4 overflow-hidden animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && phase === 'closed' && onClose?.()}
    >
      {phase === 'closed' && onClose && (
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-gray-400 hover:text-heart transition-colors p-2"
        >
          <X size={24} />
        </button>
      )}

      <div
        className={`text-center mb-10 transition-opacity duration-500 ${phase === 'closed' ? 'opacity-100' : 'opacity-0'}`}
      >
        <h2 className="font-handwriting text-3xl text-gray-300 mb-1">Message To You My</h2>
        <h1 className="font-sans text-4xl sm:text-5xl font-bold text-paper tracking-widest">FRIEND!</h1>
      </div>

      <div className="env" data-phase={phase}>
        <div className="env-part env-back" />

        <div className="env-part env-flap">
          <div className="env-flap-out" />
          <div className="env-flap-in" />
        </div>

        <div
          ref={cardRef}
          className={`env-card ${dark ? 'paper-dark-grain' : 'bg-paper bg-paper-texture'}`}
          aria-hidden="true"
        >
          <p className={`font-handwriting text-2xl ${dark ? 'text-[#d8d2c4]' : 'text-ink'}`}>
            {message?.greeting || 'Dear,'}
          </p>
          <div className="mt-5 space-y-3">
            {lines.map((w, i) => (
              <div key={i} className={`h-[2px] rounded ${dark ? 'bg-white/15' : 'bg-ink/15'}`} style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>

        <div className="env-part env-front" />
        <div className="env-part env-front-bottom" />

        <button onClick={handleOpen} aria-label="Open the letter" className="env-seal animate-pulse-heart">
          <Heart size={96} className="text-heart fill-heart drop-shadow-2xl" />
          <span className="absolute inset-0 flex items-center justify-center font-handwriting text-paper text-lg -rotate-[10deg] opacity-90 hover:opacity-100 transition-opacity">
            Tap<br />Here!
          </span>
        </button>
      </div>
    </div>
  );
}
