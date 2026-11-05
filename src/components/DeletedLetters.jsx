import { useState, useEffect } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { getDeletedMessages, restoreMessage } from '../services/messageService';
import { useToast } from './Toast';

const when = (iso) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

/** Letters I removed from my own mailbox. Restoring brings them back for me only. */
export default function DeletedLetters({ myEmail, onClose, onRestored }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    getDeletedMessages(myEmail)
      .then(setItems)
      .catch((err) => {
        console.error('Failed to load deleted letters:', err);
        toast.error("Couldn't load your deleted letters. Check your connection and try again.");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myEmail]);

  const restore = async (msg) => {
    setBusyId(msg.id);
    try {
      await restoreMessage(msg.id);
      setItems((prev) => prev.filter((m) => m.id !== msg.id));
      toast.success('Letter restored to your mailbox ✨');
      onRestored?.();
    } catch (err) {
      console.error('Failed to restore letter:', err);
      toast.error("Couldn't restore this letter. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deleted-title"
      className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#222] border border-gray-700 rounded-sm w-full max-w-lg max-h-[85vh] flex flex-col text-gray-100 font-sans">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 id="deleted-title" className="font-handwriting text-2xl">Deleted letters</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-300 hover:text-white p-1">
            <X size={22} />
          </button>
        </div>

        <p className="px-4 pt-3 text-sm text-gray-300">
          These are hidden from your mailbox only. The other person still has their copy.
        </p>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && <p className="text-center text-gray-300 py-8">Loading...</p>}
          {!loading && items.length === 0 && (
            <p className="text-center text-gray-300 py-8 font-handwriting text-2xl">Nothing deleted.</p>
          )}
          {items.map((msg) => {
            const sentByMe = msg.senderEmail.toLowerCase() === myEmail;
            const other = sentByMe ? msg.recipientEmail : msg.senderEmail;
            return (
              <div key={msg.id} className="flex items-center gap-3 bg-[#2a2a2a] border border-gray-700 rounded-sm p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 truncate">
                    {sentByMe ? 'To ' : 'From '}
                    <span className="text-white">{other}</span>
                  </p>
                  <p className="text-sm text-gray-200 truncate">{msg.content}</p>
                  <p className="text-xs text-gray-400">{when(msg.date)}</p>
                </div>
                <button
                  onClick={() => restore(msg)}
                  disabled={busyId === msg.id}
                  className="shrink-0 flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-500 rounded-sm hover:border-white hover:text-white disabled:opacity-50"
                >
                  <RotateCcw size={14} /> {busyId === msg.id ? 'Restoring...' : 'Restore'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
