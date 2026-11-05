import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Check } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RecipientSelector({ users, selected, onChange, currentEmail }) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const isSelected = (email) => selected.some((r) => r.email === email);

  const addRecipient = (r) => {
    const email = r.email.toLowerCase();
    if (email === currentEmail) {
      setError("You can't send a letter to yourself.");
      return;
    }
    if (!isSelected(email)) onChange([...selected, { ...r, email }]);
    setQuery('');
    setError('');
  };

  const addTyped = () => {
    const value = query.trim().toLowerCase();
    if (!value) return;
    if (!EMAIL_RE.test(value)) {
      setError('Enter a valid email address.');
      return;
    }
    const known = users.find((u) => u.email.toLowerCase() === value);
    addRecipient(known ?? { id: value, email: value, name: value.split('@')[0] });
  };

  const toggleUser = (u) => {
    const email = u.email.toLowerCase();
    if (isSelected(email)) {
      onChange(selected.filter((r) => r.email !== email));
    } else {
      addRecipient(u);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTyped();
    } else if (e.key === 'Backspace' && !query && selected.length) {
      onChange(selected.slice(0, -1));
    }
  };

  const term = query.trim().toLowerCase();
  const suggestions = term
    ? users
        .filter((u) => !isSelected(u.email.toLowerCase()))
        .filter((u) => u.email.toLowerCase().includes(term) || u.name.toLowerCase().includes(term))
        .slice(0, 5)
    : [];

  return (
    <div className="mb-4 relative" ref={boxRef}>
      <label className="block text-sm text-gray-400 mb-2">To:</label>

      <div className="flex flex-wrap items-center gap-2 border-b border-ink/20 focus-within:border-heart pb-2">
        {selected.map((r) => (
          <span
            key={r.email}
            className="flex items-center gap-1 bg-heart text-white text-sm font-sans pl-3 pr-1.5 py-1 rounded-full"
          >
            {r.name !== r.email.split('@')[0] ? `${r.name} (${r.email})` : r.email}
            <button
              type="button"
              onClick={() => onChange(selected.filter((x) => x.email !== r.email))}
              aria-label={`Remove ${r.email}`}
              className="hover:bg-white/20 rounded-full p-0.5"
            >
              <X size={14} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setError('');
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => EMAIL_RE.test(query.trim()) && addTyped()}
          placeholder={selected.length ? 'Add another email...' : 'Type an email address and press Enter'}
          className="flex-1 min-w-[12rem] bg-transparent outline-none text-sm font-sans text-ink placeholder-ink/40 py-1"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Show all users"
          aria-expanded={open}
          className="ml-auto p-1 rounded-sm text-ink/60 hover:text-heart hover:bg-ink/5 transition-colors"
        >
          <ChevronDown size={20} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto bg-paper border border-ink/20 rounded-sm shadow-xl">
          {users.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink/60 font-sans">No other users yet.</p>
          ) : (
            users.map((u) => {
              const picked = isSelected(u.email.toLowerCase());
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleUser(u)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left font-sans hover:bg-ink/5 border-b border-ink/10 last:border-b-0"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink truncate">{u.name}</span>
                    <span className="block text-xs text-ink/60 truncate">{u.email}</span>
                  </span>
                  {picked && <Check size={16} className="text-heart shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}

      {error && <p className="text-heart text-sm mt-2">{error}</p>}

      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((u) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addRecipient(u)}
              className="px-3 py-1.5 rounded-full text-sm font-sans border border-gray-600 text-gray-500 hover:border-heart hover:text-heart transition-colors"
            >
              {u.name} ({u.email})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}