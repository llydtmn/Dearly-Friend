import { useState } from 'react';
import { blockSender } from '../services/emailBlockService';
import { useToast } from './Toast';

// Opens from the "stop emails from this sender" link in a notification email: /?stop=<sender>&email=<you>
export default function StopEmailsPrompt({ user, sender, invitedEmail, onClose }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const myEmail = user.email.toLowerCase();
  const wrongAccount = invitedEmail && invitedEmail !== myEmail;

  const confirm = async () => {
    setBusy(true);
    try {
      await blockSender(myEmail, sender);
      toast.success(`You won't get emails about letters from ${sender}.`);
      onClose();
    } catch (err) {
      toast.error(`Couldn't update that: ${err.message || 'something went wrong'}`);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-paper w-full max-w-sm rounded-sm shadow-2xl p-6 text-ink space-y-4">
        <h2 className="font-handwriting text-2xl">Stop these emails?</h2>
        <p className="text-sm text-ink/80">
          Stop email notifications to <strong>{myEmail}</strong> about letters from <strong>{sender}</strong>? Their
          letters will still be waiting in your Dearly inbox, and you can undo this in your profile.
        </p>
        {wrongAccount && (
          <p className="text-sm text-heart">
            This link was sent to {invitedEmail}, but you're signed in as {myEmail}.
          </p>
        )}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 text-sm text-ink/70 hover:text-ink">
            Cancel
          </button>
          <button
            type="button" onClick={confirm} disabled={busy}
            className="bg-heart text-paper px-5 py-2 rounded-sm text-sm hover:bg-red-900 transition-colors disabled:opacity-50"
          >
            {busy ? 'Saving...' : 'Stop emails'}
          </button>
        </div>
      </div>
    </div>
  );
}
