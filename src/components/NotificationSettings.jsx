import { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useToast } from './Toast';
import { getPushState, enablePush, disablePush } from '../services/pushService';

const HINTS = {
  'needs-install':
    'On iPhone, first add Dearly to your Home Screen (Share → Add to Home Screen), then open it from there and turn this on.',
  unsupported: "This browser doesn't support push notifications.",
  denied: 'Notifications are blocked for Dearly. Allow them in your browser or phone settings, then come back.',
};

export default function NotificationSettings() {
  const toast = useToast();
  const [state, setState] = useState(null); // null while checking
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setState).catch(() => setState('unsupported'));
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      if (state === 'on') {
        await disablePush();
        toast.success('Notifications turned off on this device.');
      } else {
        await enablePush();
        toast.success("You'll get a notification when a letter arrives 💌");
      }
      setState(await getPushState());
    } catch (err) {
      console.error('Push toggle failed:', err);
      toast.error(err.message || "Couldn't change notifications. Please try again.");
      setState(await getPushState());
    } finally {
      setBusy(false);
    }
  };

  if (state === null) return null;
  const canToggle = state === 'on' || state === 'off';

  return (
    <div>
      <span className="block text-sm text-ink/70 mb-1">Notifications on this device</span>
      {canToggle ? (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={`flex items-center gap-2 px-3 py-1.5 border rounded-sm text-sm transition-colors disabled:opacity-50 ${
            state === 'on'
              ? 'border-heart text-heart hover:bg-heart/10'
              : 'border-ink/20 hover:border-heart hover:text-heart'
          }`}
        >
          {state === 'on' ? <BellOff size={16} /> : <Bell size={16} />}
          {busy ? 'Please wait...' : state === 'on' ? 'Turn off notifications' : 'Turn on notifications'}
        </button>
      ) : (
        <p className="text-xs text-ink/60">{HINTS[state]}</p>
      )}
      {state === 'on' && <p className="text-xs text-ink/50 mt-1">Notifications are on for this device.</p>}
    </div>
  );
}
