import { X, PenLine } from 'lucide-react';
import { avatarUrl } from '../services/profileService';

// Someone else's profile: photo, name, email, bio, and a shortcut to write to them
export default function ProfileSheet({ profile, onClose, onWrite }) {
  const img = avatarUrl(profile.avatar_path);
  const name = profile.name || profile.email.split('@')[0];

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex justify-center items-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${name}'s profile`}
        onClick={(e) => e.stopPropagation()}
        className="bg-paper bg-paper-texture w-full max-w-sm rounded-sm shadow-2xl overflow-hidden text-ink"
      >
        <div className="bg-paper-dark/50 p-3 border-b border-ink/10 flex justify-end">
          <button onClick={onClose} aria-label="Close" className="text-ink-light hover:text-heart transition-colors">
            <X size={22} />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center text-center font-sans">
          <div className="w-24 h-24 rounded-full bg-ink/10 border border-ink/20 overflow-hidden flex items-center justify-center text-3xl text-ink/50">
            {img ? (
              <img src={img} alt={`${name}'s avatar`} className="w-full h-full object-cover" />
            ) : (
              name.charAt(0).toUpperCase()
            )}
          </div>
          <h2 className="font-handwriting text-3xl mt-3">{name}</h2>
          <p className="text-xs text-ink/60 break-all">{profile.email}</p>

          <p className="mt-5 text-sm leading-relaxed whitespace-pre-wrap text-ink/80">
            {profile.bio || <span className="text-ink/40">No bio yet.</span>}
          </p>
        </div>

        <div className="p-4 border-t border-ink/10 bg-paper-dark/20 flex justify-center">
          <button
            onClick={() => onWrite(profile)}
            className="flex items-center gap-2 bg-heart text-paper px-6 py-2 rounded-sm font-sans text-sm tracking-wide hover:bg-red-900 transition-colors"
          >
            <PenLine size={16} /> Write a letter
          </button>
        </div>
      </div>
    </div>
  );
}
