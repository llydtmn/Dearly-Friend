import { useEffect, useState } from 'react';
import { Clock, Repeat } from 'lucide-react';
import { getScheduledLetters, cancelScheduled } from '../services/messageService';
import { useToast } from './Toast';

const when = (iso) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export default function ScheduledList() {
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let alive = true;
    getScheduledLetters()
      .then((rows) => alive && setItems(rows))
      .catch((err) => {
        console.error('Failed to load scheduled letters:', err);
        if (alive) {
          setItems([]);
          toast.error("Couldn't load your scheduled letters.");
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = async (id) => {
    setBusyId(id);
    try {
      await cancelScheduled(id);
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast.success('Scheduled letter cancelled.');
    } catch (err) {
      toast.error(err.message || "Couldn't cancel this letter.");
    } finally {
      setBusyId(null);
    }
  };

  if (items === null) {
    return <div className="text-center text-gray-300 mt-20 font-handwriting text-2xl">Checking the post office...</div>;
  }
  if (items.length === 0) {
    return (
      <div className="text-center text-gray-300 mt-20 px-6 font-handwriting text-2xl">
        Nothing scheduled yet. Tap + and switch on “Schedule for later”.
      </div>
    );
  }

  return items.map((x) => (
    <div key={x.id} className="flex items-center justify-between gap-3 px-4 py-4 border-b border-gray-700/60">
      <div className="min-w-0 font-sans" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95)' }}>
        <p className="text-[15px] text-gray-50 break-words">
          To <span className="font-semibold">{x.recipient_email}</span>
        </p>
        <p className="text-xs text-gray-300 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <Clock size={12} /> {when(x.deliver_at)}
          </span>
          {x.occasion && <span>· {x.occasion}</span>}
          {x.repeat_yearly && (
            <span className="inline-flex items-center gap-1">
              · <Repeat size={12} /> every year
            </span>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={() => cancel(x.id)}
        disabled={busyId === x.id}
        className="shrink-0 text-xs font-sans px-3 py-1.5 rounded-sm border border-gray-600 text-gray-300 hover:border-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
      >
        {busyId === x.id ? 'Cancelling...' : 'Cancel'}
      </button>
    </div>
  ));
}
