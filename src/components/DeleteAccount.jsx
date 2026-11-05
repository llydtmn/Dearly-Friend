import { useState } from 'react';
import { deleteMyAccount } from '../services/accountService';
import { useToast } from './Toast';

export default function DeleteAccount({ user, onDeleted }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const ready = typed.trim().toLowerCase() === user.email.toLowerCase();

  const remove = async () => {
    setBusy(true);
    try {
      await deleteMyAccount(user.id);
      toast.success('Your account and letters have been deleted.');
      onDeleted();
    } catch (err) {
      console.error('Failed to delete account:', err);
      toast.error(`Couldn't delete your account: ${err.message || 'something went wrong'}`);
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs text-ink/50 hover:text-heart underline">
        Delete my account
      </button>
    );
  }

  return (
    <div className="border border-heart/40 rounded-sm p-3 space-y-3">
      <p className="text-sm text-heart font-semibold">Delete your account?</p>
      <p className="text-xs text-ink/70">
        This permanently removes your profile, photos, keepsakes, scheduled letters, and every letter you sent or
        received. Letters you sent will also disappear from your recipients' inboxes. This can't be undone.
      </p>
      <input
        type="email"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={`Type ${user.email} to confirm`}
        className="w-full bg-transparent border-b border-ink/30 focus:border-heart outline-none py-1 text-sm"
      />
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => { setOpen(false); setTyped(''); }}
          disabled={busy}
          className="px-3 py-1.5 text-sm text-ink/70 hover:text-ink"
        >
          Keep my account
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={!ready || busy}
          className="bg-heart text-paper px-4 py-1.5 rounded-sm text-sm hover:bg-red-900 transition-colors disabled:opacity-40"
        >
          {busy ? 'Deleting...' : 'Delete forever'}
        </button>
      </div>
    </div>
  );
}
