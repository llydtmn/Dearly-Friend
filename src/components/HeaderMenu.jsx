import { useEffect, useRef, useState } from 'react';
import { MoreVertical, History, Archive } from 'lucide-react';

/** Dropdown in the top bar: History (my deleted letters) and Archive (letters I tucked away). */
export default function HeaderMenu({ onHistory, onArchive }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (box.current && !box.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (fn) => () => {
    setOpen(false);
    fn?.();
  };

  const item =
    'w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-gray-200 hover:bg-white/10 transition-colors';

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More"
        title="More"
        className="text-gray-300 hover:text-paper transition-colors p-2"
      >
        <MoreVertical size={20} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-44 rounded-md border border-gray-600 bg-gray-800 shadow-xl overflow-hidden z-30 font-sans"
        >
          <button role="menuitem" type="button" onClick={pick(onHistory)} className={item}>
            <History size={18} /> History
          </button>
          <button role="menuitem" type="button" onClick={pick(onArchive)} className={item}>
            <Archive size={18} /> Archive
          </button>
        </div>
      )}
    </div>
  );
}