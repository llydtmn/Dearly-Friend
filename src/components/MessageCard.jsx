import { useRef, useState } from 'react';
import { Trash2, Star, Paperclip, Mic } from 'lucide-react';

const ACTION_WIDTH = 88;

export default function MessageCard({
  message,
  onClick,
  isActive,
  currentEmail,
  isOpen = false,
  onOpen,
  onClose,
  onDelete,
  avatarUrl = null,
  initial = '',
  isStarred = false,
}) {
  const isSent = message.senderEmail.toLowerCase() === currentEmail;
  const isUnread = !message.isRead && !isSent;
  const date = new Date(message.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const start = useRef(null);
  const moved = useRef(false);
  const [drag, setDrag] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const offset = drag ?? (isOpen ? -ACTION_WIDTH : 0);

  const handlePointerDown = (e) => {
    start.current = { x: e.clientX, y: e.clientY, base: isOpen ? -ACTION_WIDTH : 0 };
    moved.current = false;
  };

  const handlePointerMove = (e) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    if (!moved.current) {
      if (Math.abs(dx) < 8 || Math.abs(dy) > Math.abs(dx)) return;
      moved.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDrag(Math.max(-ACTION_WIDTH - 24, Math.min(0, start.current.base + dx)));
  };

  const handlePointerUp = () => {
    if (!start.current) return;
    if (moved.current && drag !== null) {
      drag < -ACTION_WIDTH / 2 ? onOpen?.() : onClose?.();
    }
    setDrag(null);
    start.current = null;
  };

  const handlePointerCancel = () => {
    setDrag(null);
    start.current = null;
  };

  const handleClick = () => {
    if (moved.current) {
      moved.current = false;
      return;
    }
    if (isOpen) {
      onClose?.();
      return;
    }
    onClick?.();
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete?.();
    } finally {
      setDeleting(false);
    }
  };

  const strong = isUnread ? 'text-white font-semibold' : 'text-gray-50 font-medium';
  const soft = isUnread ? 'text-gray-100' : 'text-gray-300';
  const glow = { textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.6)' };

  return (
    <div className="relative overflow-hidden border-b border-gray-700/60">
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleClick}
        style={{
          transform: `translateX(${offset}px)`,
          touchAction: 'pan-y',
          transition: drag === null ? 'transform 200ms ease-out' : 'none',
        }}
        className={`relative flex justify-between items-center gap-3 px-4 py-4 cursor-pointer select-none hover:bg-white/5 ${
          isActive ? 'bg-white/10' : ''
        }`}
      >
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Delete message"
          tabIndex={isOpen ? 0 : -1}
          style={{ width: ACTION_WIDTH }}
          className="absolute top-0 bottom-0 left-full flex flex-col items-center justify-center gap-1 bg-red-600 text-white text-xs font-medium active:bg-red-700 disabled:opacity-60"
        >
          <Trash2 size={20} />
          {deleting ? 'Deleting...' : 'Delete'}
        </button>

        <div className="flex items-center gap-3 min-w-0">
          {isUnread && <div className="w-2.5 h-2.5 rounded-full bg-heart shrink-0"></div>}
          <div className="w-9 h-9 rounded-full bg-gray-700 border border-gray-600 overflow-hidden shrink-0 flex items-center justify-center text-gray-200 text-sm font-semibold uppercase">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" draggable={false} className="w-full h-full object-cover" />
            ) : (
              initial || '?'
            )}
          </div>
          <p style={glow} className="font-sans text-[15px] leading-snug break-words min-w-0">
            {isSent ? (
              <>
                <span className={soft}>You sent a message to </span>
                <span className={strong}>{message.recipientEmail}</span>
              </>
            ) : (
              <>
                <span className={strong}>{message.senderEmail}</span>
                <span className={soft}> sent you a message</span>
              </>
            )}
          </p>
        </div>
        <span style={glow} className="font-sans text-xs text-gray-300 shrink-0 flex items-center gap-2">
          {message.voicePath && <Mic size={13} aria-label="Has a voice message" />}
          {message.attachments?.length > 0 && <Paperclip size={13} aria-label="Has photos" />}
          {isStarred && <Star size={13} className="fill-amber-400 text-amber-400" aria-label="Keepsake" />}
          {date}
        </span>
      </div>
    </div>
  );
}