import { useMemo } from 'react';
import { avatarUrl } from '../services/profileService';

// Everyone who uses Dearly. Tap a person to see their bio and write to them.
export default function ProfilesList({ profiles, myId, term = '', onSelect }) {
  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return profiles
      .filter(
        (p) =>
          !q ||
          (p.name || '').toLowerCase().includes(q) ||
          (p.email || '').toLowerCase().includes(q) ||
          (p.bio || '').toLowerCase().includes(q)
      )
      .sort((a, b) => {
        if (a.id === myId) return -1;
        if (b.id === myId) return 1;
        return (a.name || a.email).localeCompare(b.name || b.email);
      });
  }, [profiles, term, myId]);

  if (rows.length === 0) {
    return (
      <div className="text-center text-gray-500 mt-20 px-6 font-handwriting text-2xl">
        {term ? 'No one matches your search.' : 'No one here yet.'}
      </div>
    );
  }

  return (
    <div>
      <p className="px-4 py-2 text-xs font-sans text-gray-400">
        {rows.length} {rows.length === 1 ? 'person' : 'people'} on Dearly
      </p>
      {rows.map((p) => {
        const img = avatarUrl(p.avatar_path);
        const isMe = p.id === myId;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="w-full text-left flex items-center gap-3 px-4 py-3 border-b border-gray-800/60 hover:bg-white/5 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-slate-700 text-gray-200 overflow-hidden flex items-center justify-center shrink-0 font-sans text-lg">
              {img ? (
                <img src={img} alt="" className="w-full h-full object-cover" />
              ) : (
                (p.name || p.email || '?').charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-sans text-sm text-gray-100 truncate">
                {p.name || p.email.split('@')[0]}
                {isMe && <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">You</span>}
              </p>
              <p className="font-sans text-xs text-gray-400 truncate">{p.email}</p>
              {p.bio && <p
                  className="font-sans text-xs text-gray-300/80 mt-1 overflow-hidden"
                  style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
                >
                  {p.bio}
                </p>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
