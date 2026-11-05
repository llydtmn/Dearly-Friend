import { useState, useEffect } from 'react';
import { X, ArchiveRestore } from 'lucide-react';
import { getArchivedMessages, archiveMessage } from '../services/messageService';
import { useToast } from './Toast';

const when = (iso) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

/** Letters I tucked away. Tap one to read it, or move it back to my mailbox. Only my copy is affected. */
export default function ArchivedLetters({ myEmail, onClose, onUnarchived, onOpenLetter }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    getArchivedMessages(myEmail)
      .then(setItems)
      .catch((err) => {
        console.error('Failed to load archived letters:', err);
        toast.error("Couldn't load your archive. Check your connection and try again.");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myEmail]);

  const unarchive = async (msg) => {
    setBusyId(msg.id);
    try {
      await archiveMessage(msg.id, false);
      setItems((prev) => prev.filter((m) => m.id !== msg.id));
      toast.success('Letter moved back to your mailbox ✨');
      onUnarchived?.();
    } catch (err) {
      console.error('Failed to unarchive letter:', err);
      toast.error("Couldn't unarchive this letter. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const open = (msg) => {
    onClose();
    onOpenLetter?.(msg);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-title"
      className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#222] border border-gray-700 rounded-sm w-full max-w-lg max-h-[85vh] flex flex-col text-gray-100 font-sans">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 id="archive-title" className="font-handwriting text-2xl">Archive</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-300 hover:text-white p-1">
            <X size={22} />
          </button>
        </div>

        <p className="px-4 pt-3 text-sm text-gray-300">
          Archived letters are tucked out of your mailbox. The other person is not affected.
        </p>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && <p className="text-center text-gray-300 py-8">Loading...</p>}
          {!loading && items.length === 0 && (
            <p className="text-center text-gray-300 py-8 font-handwriting text-2xl">
              Nothing archived. Swipe a letter to the right to archive it.
            </p>
          )}
          {items.map((msg) => {
            const sentByMe = msg.senderEmail.toLowerCase() === myEmail;
            const other = sentByMe ? msg.recipientEmail : msg.senderEmail;
            return (
              <div key={msg.id} className="flex items-center gap-3 bg-[#2a2a2a] border border-gray-700 rounded-sm p-3">
                <button
                  type="button"
                  onClick={() => open(msg)}
                  className="flex-1 min-w-0 text-left"
                  aria-label={`Open letter ${sentByMe ? 'to' : 'from'} ${other}`}
                >
                  <p className="text-sm text-gray-300 truncate">
                    {sentByMe ? 'To ' : 'From '}
                    <span className="text-white">{other}</span>
                  </p>
                  <p className="text-sm text-gray-200 truncate">{msg.content}</p>
                  <p className="text-xs text-gray-400">{when(msg.date)}</p>
                </button>
                <button
                  onClick={() => unarchive(msg)}
                  disabled={busyId === msg.id}
                  className="shrink-0 flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-500 rounded-sm hover:border-white hover:text-white disabled:opacity-50"
                >
                  <ArchiveRestore size={14} /> {busyId === msg.id ? 'Moving...' : 'Unarchive'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}