import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import RecipientSelector from './RecipientSelector';
import { sendMessage, getProfiles } from '../services/messageService';
import { useToast } from './Toast';

const DEFAULT_GREETING = 'Dear, [Name]';

const readDraft = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// A draft isn't worth keeping if nothing was written and the recipients are just the starting ones
const isBlank = (d, baseEmail) =>
  !d.content.trim() &&
  (baseEmail
    ? d.recipients.length === 1 && d.recipients[0].email === baseEmail
    : d.recipients.length === 0);

export default function ComposeMessage({ user, replyTo = null, onClose, onSent }) {
  const toast = useToast();
  const myName = user.user_metadata?.name || user.email.split('@')[0];

  // One draft slot for new letters, and one per letter being replied to
  const draftKey = replyTo ? `dearly_draft_reply_${replyTo.id}_${user.id}` : `dearly_draft_new_${user.id}`;

  const replyEmail = replyTo?.senderEmail?.toLowerCase();
  const replyGuessName = replyEmail ? replyEmail.split('@')[0] : '';
  const defaults = {
    greeting: replyTo ? `Dear, ${replyGuessName}` : DEFAULT_GREETING,
    signature: `- ${myName}`,
  };

  // Restore a saved draft once, on first render
  const [initial] = useState(() => {
    const saved = readDraft(draftKey);
    if (saved && typeof saved === 'object') {
      return {
        recipients: Array.isArray(saved.recipients) ? saved.recipients : [],
        greeting: saved.greeting ?? defaults.greeting,
        content: saved.content ?? '',
        signature: saved.signature ?? defaults.signature,
        restored: !isBlank(
          { content: saved.content ?? '', recipients: Array.isArray(saved.recipients) ? saved.recipients : [] },
          replyEmail
        ),
      };
    }
    return {
      recipients: replyEmail ? [{ id: replyEmail, email: replyEmail, name: replyGuessName }] : [],
      greeting: defaults.greeting,
      content: '',
      signature: defaults.signature,
      restored: false,
    };
  });

  const [friends, setFriends] = useState([]);
  const [recipients, setRecipients] = useState(initial.recipients);
  const [greeting, setGreeting] = useState(initial.greeting);
  const [content, setContent] = useState(initial.content);
  const [signature, setSignature] = useState(initial.signature);
  const [restored, setRestored] = useState(initial.restored);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const sentRef = useRef(false);

  useEffect(() => {
    getProfiles()
      .then((all) => setFriends(all.filter((p) => p.id !== user.id)))
      .catch((err) => toast.error(`Couldn't load your friends list: ${err.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // When replying, swap the guessed name for the friend's real profile name once it loads
  useEffect(() => {
    if (!replyEmail || friends.length === 0) return;
    const profile = friends.find((f) => f.email.toLowerCase() === replyEmail);
    if (!profile?.name || profile.name === replyGuessName) return;
    setRecipients((prev) =>
      prev.map((r) =>
        r.email === replyEmail && r.name === replyGuessName ? { ...r, id: profile.id, name: profile.name } : r
      )
    );
    setGreeting((g) => (g === `Dear, ${replyGuessName}` ? `Dear, ${profile.name}` : g));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friends]);

  // Draft autosave (debounced). Cleared on send; removed when there's nothing worth keeping.
  useEffect(() => {
    if (sentRef.current) return;
    const timer = setTimeout(() => {
      try {
        const draft = { recipients, greeting, content, signature };
        if (isBlank(draft, replyEmail)) localStorage.removeItem(draftKey);
        else localStorage.setItem(draftKey, JSON.stringify({ ...draft, savedAt: Date.now() }));
      } catch {
        /* storage full or blocked: autosave is best-effort */
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipients, greeting, content, signature, draftKey]);

  // Flush immediately if the tab is hidden or closed, so the last keystrokes aren't lost
  const latest = useRef({});
  latest.current = { recipients, greeting, content, signature };
  useEffect(() => {
    const flush = () => {
      if (sentRef.current) return;
      try {
        const draft = latest.current;
        if (isBlank(draft, replyEmail)) localStorage.removeItem(draftKey);
        else localStorage.setItem(draftKey, JSON.stringify({ ...draft, savedAt: Date.now() }));
      } catch {
        /* ignore */
      }
    };
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      flush(); // also saves when the compose window is closed within the debounce delay
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const discardDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    setRecipients(replyEmail ? [{ id: replyEmail, email: replyEmail, name: replyGuessName }] : []);
    setGreeting(defaults.greeting);
    setContent('');
    setSignature(defaults.signature);
    setRestored(false);
  };

  const canSend = recipients.length > 0 && content.trim() && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await Promise.all(
        recipients.map((r) =>
          sendMessage({
            senderId: user.id,
            senderEmail: user.email.toLowerCase(),
            recipientEmail: r.email,
            greeting: greeting.replace('[Name]', r.name),
            content,
            signature,
          })
        )
      );
      sentRef.current = true;
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      onSent(recipients.length);
    } catch (err) {
      console.error('Failed to send letter:', err);
      toast.error(`Your letter wasn't sent: ${err.message || 'something went wrong'}. Your draft is safe.`);
      setConfirming(false);
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-paper bg-paper-texture w-full max-w-2xl rounded-sm shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-paper-dark/50 p-4 border-b border-ink/10 flex justify-between items-center">
          <h2 className="font-handwriting text-2xl text-ink">{replyTo ? 'Write a Reply' : 'Write a Letter'}</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-light hover:text-heart transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto text-ink">
          {restored && (
            <div className="mb-4 flex items-center justify-between gap-3 bg-heart/10 text-ink text-sm font-sans rounded-sm px-3 py-2">
              <span>Draft restored. Pick up where you left off.</span>
              <button type="button" onClick={discardDraft} className="text-heart underline shrink-0">
                Start over
              </button>
            </div>
          )}

          <RecipientSelector
            users={friends}
            selected={recipients}
            onChange={setRecipients}
            currentEmail={user.email.toLowerCase()}
          />

          <div className="space-y-4">
            <input
              type="text"
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              className="w-full bg-transparent border-b border-ink/20 focus:border-heart outline-none font-handwriting text-2xl placeholder-ink/40 pb-1"
              placeholder="Dear, [Name]"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-48 bg-transparent resize-none outline-none font-handwriting text-xl leading-relaxed placeholder-ink/40"
              placeholder="Write your message here..."
            />
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="w-full bg-transparent border-b border-ink/20 focus:border-heart outline-none font-handwriting text-2xl text-right placeholder-ink/40 pb-1"
            />
          </div>
        </div>

        <div className="p-4 border-t border-ink/10 flex justify-end bg-paper-dark/20">
          <button
            onClick={() => setConfirming(true)}
            disabled={!canSend}
            className="bg-heart text-paper px-6 py-2 rounded-sm font-sans text-sm tracking-wide hover:bg-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send Now →
          </button>
        </div>

        {confirming && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-send-title"
            className="absolute inset-0 z-10 bg-black/50 flex items-center justify-center p-4 animate-fade-in"
          >
            <div className="bg-paper w-full max-w-sm rounded-sm shadow-2xl p-6 text-ink font-sans">
              <h3 id="confirm-send-title" className="font-handwriting text-2xl mb-3">
                {recipients.length === 1 ? 'Send to this address?' : `Send to these ${recipients.length} addresses?`}
              </h3>
              <ul className="mb-4 space-y-1">
                {recipients.map((r) => (
                  <li key={r.email} className="text-sm font-semibold break-all">
                    {r.email}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink/60 mb-5">
                Double-check the spelling. A private letter can't be unsent once it's delivered.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={sending}
                  className="px-4 py-2 text-sm text-ink/70 hover:text-ink disabled:opacity-50"
                >
                  Go back
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={handleSend}
                  disabled={sending}
                  className="bg-heart text-paper px-5 py-2 rounded-sm text-sm tracking-wide hover:bg-red-900 transition-colors disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Yes, send'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
