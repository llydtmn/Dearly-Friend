import { useState, useEffect, useRef } from 'react';
import { X, ImagePlus, Clock } from 'lucide-react';
import RecipientSelector from './RecipientSelector';
import VoiceRecorder from './VoiceRecorder';
import {
  sendMessage,
  getProfiles,
  scheduleLetter,
  uploadAttachments,
  removeAttachments,
  uploadVoice,
  removeVoice,
} from '../services/messageService';
import { enqueueLetter, isNetworkError } from '../services/outboxService';
import { compressImage } from '../utils/image';
import { useToast } from './Toast';

const DEFAULT_GREETING = 'Dear, [Name]';
const MAX_PHOTOS = 4;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

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
  (baseEmail ? d.recipients.length === 1 && d.recipients[0].email === baseEmail : d.recipients.length === 0);

// <input type="datetime-local"> wants local time as YYYY-MM-DDTHH:mm
const toLocalInput = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const defaultDeliveryTime = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return toLocalInput(d);
};

const prettyWhen = (value) =>
  new Date(value).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });

export default function ComposeMessage({ user, profile = null, replyTo = null, to = null, onClose, onSent }) {
  const toast = useToast();
  const myName = profile?.name || user.user_metadata?.name || user.email.split('@')[0];

  // One draft slot for new letters, and one per letter being replied to
  const draftKey = replyTo
    ? `dearly_draft_reply_${replyTo.id}_${user.id}`
    : to
      ? `dearly_draft_to_${to.id}_${user.id}`
      : `dearly_draft_new_${user.id}`;

  const replyEmail = replyTo?.senderEmail?.toLowerCase();
  // Opened from someone's profile: they start out as the recipient
  const toEmail = to?.email?.toLowerCase();
  const baseEmail = replyEmail || toEmail;
  const baseName = replyEmail ? replyEmail.split('@')[0] : to?.name || '';
  const replyGuessName = replyEmail ? replyEmail.split('@')[0] : '';
  const defaults = {
    greeting: replyTo ? `Dear, ${replyGuessName}` : to ? `Dear, ${baseName}` : DEFAULT_GREETING,
    signature: profile?.default_signature || `- ${myName}`,
  };

  // Restore a saved draft once, on first render
  const [initial] = useState(() => {
    const saved = readDraft(draftKey);
    if (saved && typeof saved === 'object') {
      const savedRecipients = Array.isArray(saved.recipients) ? saved.recipients : [];
      return {
        recipients: savedRecipients,
        greeting: saved.greeting ?? defaults.greeting,
        content: saved.content ?? '',
        signature: saved.signature ?? defaults.signature,
        restored: !isBlank({ content: saved.content ?? '', recipients: savedRecipients }, baseEmail),
      };
    }
    return {
      recipients: baseEmail ? [{ id: to?.id || baseEmail, email: baseEmail, name: baseName }] : [],
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
  const [photos, setPhotos] = useState([]); // [{ id, file, url }]
  const [voice, setVoice] = useState(null); // { blob, url, mime, seconds }
  const [scheduleOn, setScheduleOn] = useState(false);
  const [deliverAt, setDeliverAt] = useState('');
  const [occasion, setOccasion] = useState('');
  const [repeatYearly, setRepeatYearly] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [stage, setStage] = useState('');
  const sentRef = useRef(false);
  const fileRef = useRef(null);
  const photosRef = useRef([]);
  photosRef.current = photos;

  const voiceRef = useRef(null);
  voiceRef.current = voice;

  // Free the preview URLs when the window closes
  useEffect(
    () => () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
      if (voiceRef.current) URL.revokeObjectURL(voiceRef.current.url);
    },
    []
  );

  // Replace or remove the recording (and free the old preview URL)
  const changeVoice = (next) => {
    setVoice((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return next;
    });
  };

  useEffect(() => {
    getProfiles()
      .then((all) => setFriends(all.filter((p) => p.id !== user.id)))
      .catch((err) => toast.error(`Couldn't load your friends list: ${err.message}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // When replying, swap the guessed name for the friend's real profile name once it loads
  useEffect(() => {
    if (!replyEmail || friends.length === 0) return;
    const profileMatch = friends.find((f) => f.email.toLowerCase() === replyEmail);
    if (!profileMatch?.name || profileMatch.name === replyGuessName) return;
    setRecipients((prev) =>
      prev.map((r) =>
        r.email === replyEmail && r.name === replyGuessName ? { ...r, id: profileMatch.id, name: profileMatch.name } : r
      )
    );
    setGreeting((g) => (g === `Dear, ${replyGuessName}` ? `Dear, ${profileMatch.name}` : g));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friends]);

  // Draft autosave (debounced). Photos and schedule settings aren't kept in drafts.
  useEffect(() => {
    if (sentRef.current) return;
    const timer = setTimeout(() => {
      try {
        const draft = { recipients, greeting, content, signature };
        if (isBlank(draft, baseEmail)) localStorage.removeItem(draftKey);
        else localStorage.setItem(draftKey, JSON.stringify({ ...draft, savedAt: Date.now() }));
      } catch {
        /* storage full or blocked: autosave is best-effort */
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipients, greeting, content, signature, draftKey]);

  // Flush immediately if the tab is hidden, closed, or this window unmounts
  const latest = useRef({});
  latest.current = { recipients, greeting, content, signature };
  useEffect(() => {
    const flush = () => {
      if (sentRef.current) return;
      try {
        const draft = latest.current;
        if (isBlank(draft, baseEmail)) localStorage.removeItem(draftKey);
        else localStorage.setItem(draftKey, JSON.stringify({ ...draft, savedAt: Date.now() }));
      } catch {
        /* ignore */
      }
    };
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
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
    setRecipients(baseEmail ? [{ id: to?.id || baseEmail, email: baseEmail, name: baseName }] : []);
    setGreeting(defaults.greeting);
    setContent('');
    setSignature(defaults.signature);
    setRestored(false);
  };

  /* ---------- Photos ---------- */

  const addPhotos = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const valid = files.filter((f) => f.type.startsWith('image/') && f.size <= MAX_FILE_BYTES);
    if (valid.length < files.length) toast.error('Some files were skipped. Only images under 20 MB can be attached.');

    const room = MAX_PHOTOS - photos.length;
    if (valid.length > room) toast.info(`You can attach up to ${MAX_PHOTOS} photos to a letter.`);

    const added = valid.slice(0, Math.max(room, 0)).map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...added]);
  };

  const removePhoto = (id) => {
    setPhotos((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((p) => p.id !== id);
    });
  };

  /* ---------- Scheduling ---------- */

  const toggleSchedule = (e) => {
    const on = e.target.checked;
    setScheduleOn(on);
    if (on && !deliverAt) setDeliverAt(defaultDeliveryTime());
  };

  const deliverTime = deliverAt ? new Date(deliverAt).getTime() : NaN;
  const scheduleValid = !scheduleOn || (Number.isFinite(deliverTime) && deliverTime > Date.now() + 30 * 1000);
  const canSend = recipients.length > 0 && content.trim() && scheduleValid && !sending;

  /* ---------- Send / schedule ---------- */

  const offline = typeof navigator !== 'undefined' && !navigator.onLine;

  // No connection: keep the whole letter on this device. It goes out by itself when we're back online.
  const queueForLater = async () => {
    setStage('Saving your letter...');
    const blobs = await Promise.all(photos.map((p) => compressImage(p.file, { maxSize: 1600, quality: 0.82 })));
    await enqueueLetter({
      user,
      recipients,
      greeting,
      content,
      signature,
      photos: blobs,
      voice,
      schedule: scheduleOn ? { deliverAt: new Date(deliverAt).toISOString(), occasion: occasion.trim() || null, repeatYearly } : null,
    });
    sentRef.current = true;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    onSent(recipients.length, { queued: true });
  };

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setStage(photos.length ? 'Uploading photos...' : voice ? 'Uploading voice message...' : '');
    let paths = [];
    let voicePath = null;
    try {
      if (!navigator.onLine) {
        await queueForLater();
        return;
      }
      if (photos.length) {
        const blobs = await Promise.all(photos.map((p) => compressImage(p.file, { maxSize: 1600, quality: 0.82 })));
        paths = await uploadAttachments(user.id, blobs);
      }
      if (voice) {
        setStage('Uploading voice message...');
        try {
          voicePath = await uploadVoice(user.id, voice.blob, voice.mime);
        } catch (err) {
          await removeAttachments(paths); // don't leave the photos orphaned
          throw err;
        }
      }
      setStage('');

      const deliverIso = scheduleOn ? new Date(deliverAt).toISOString() : null;
      const results = await Promise.allSettled(
        recipients.map((r) => {
          const base = {
            senderId: user.id,
            senderEmail: user.email.toLowerCase(),
            recipientEmail: r.email,
            greeting: greeting.replace('[Name]', r.name),
            content,
            signature,
            attachments: paths,
            voicePath,
          };
          return scheduleOn
            ? scheduleLetter({ ...base, deliverAt: deliverIso, occasion: occasion.trim(), repeatYearly })
            : sendMessage(base);
        })
      );

      const failed = recipients.filter((_, i) => results[i].status === 'rejected');

      if (failed.length === 0) {
        sentRef.current = true;
        try {
          localStorage.removeItem(draftKey);
        } catch {
          /* ignore */
        }
        onSent(recipients.length, scheduleOn ? { scheduled: true, deliverAt: deliverIso } : undefined);
        return;
      }

      if (failed.length === recipients.length) {
        await removeAttachments(paths);
        await removeVoice(voicePath);
        throw results.find((r) => r.status === 'rejected').reason;
      }

      // Some went out, some didn't: keep only the ones that failed so a retry can't double-send
      setRecipients(failed);
      toast.error(
        `${scheduleOn ? 'Scheduled' : 'Sent'} to ${recipients.length - failed.length}, but not to ${failed
          .map((f) => f.email)
          .join(', ')}. They're still in the To: field so you can try again.`
      );
      setConfirming(false);
      setSending(false);
    } catch (err) {
      // The connection dropped mid-send: save it for later instead of losing it
      if (isNetworkError(err)) {
        try {
          await queueForLater();
          return;
        } catch (queueErr) {
          console.error('Could not queue the letter:', queueErr);
        }
      }
      console.error('Failed to send letter:', err);
      toast.error(
        `Your letter wasn't ${scheduleOn ? 'scheduled' : 'sent'}: ${err.message || 'something went wrong'}. Your draft is safe.`
      );
      setConfirming(false);
      setSending(false);
    }
  };

  const noun = scheduleOn ? 'schedule' : 'send';

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

          {/* Extras: photos + scheduling */}
          <div className="mt-6 pt-4 border-t border-ink/10 space-y-3 font-sans text-sm">
            <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={photos.length >= MAX_PHOTOS}
                className="flex items-center gap-2 px-3 py-1.5 border border-ink/20 rounded-sm hover:border-heart hover:text-heart transition-colors disabled:opacity-40 disabled:hover:border-ink/20 disabled:hover:text-ink"
              >
                <ImagePlus size={16} /> Add photo
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={addPhotos} />

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={scheduleOn} onChange={toggleSchedule} className="accent-heart" />
                <Clock size={16} /> Schedule for later
              </label>
            </div>

            <VoiceRecorder value={voice} onChange={changeVoice} disabled={sending} />

            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photos.map((p) => (
                  <div key={p.id} className="relative w-20 h-20 rounded-sm overflow-hidden border border-ink/20">
                    <img src={p.url} alt="Attached" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(p.id)}
                      aria-label="Remove photo"
                      className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {scheduleOn && (
              <div className="space-y-2 bg-ink/5 rounded-sm p-3">
                <div className="flex flex-wrap gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-ink/60">Arrives on</span>
                    <input
                      type="datetime-local"
                      value={deliverAt}
                      min={toLocalInput(new Date(Date.now() + 60 * 1000))}
                      onChange={(e) => setDeliverAt(e.target.value)}
                      className="bg-transparent border border-ink/20 rounded-sm px-2 py-1 text-ink outline-none focus:border-heart"
                    />
                  </label>
                  <label className="flex flex-col gap-1 flex-1 min-w-[10rem]">
                    <span className="text-xs text-ink/60">Occasion (optional)</span>
                    <input
                      type="text"
                      value={occasion}
                      onChange={(e) => setOccasion(e.target.value)}
                      maxLength={40}
                      placeholder="Birthday, anniversary..."
                      className="bg-transparent border border-ink/20 rounded-sm px-2 py-1 text-ink outline-none focus:border-heart placeholder-ink/30"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={repeatYearly}
                    onChange={(e) => setRepeatYearly(e.target.checked)}
                    className="accent-heart"
                  />
                  Send again every year
                </label>
                {!scheduleValid && <p className="text-heart text-xs">Pick a time in the future.</p>}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-ink/10 flex justify-end bg-paper-dark/20">
          <button
            onClick={() => setConfirming(true)}
            disabled={!canSend}
            className="bg-heart text-paper px-6 py-2 rounded-sm font-sans text-sm tracking-wide hover:bg-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scheduleOn ? 'Schedule →' : 'Send Now →'}
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
                {recipients.length === 1
                  ? `${scheduleOn ? 'Schedule' : 'Send'} to this address?`
                  : `${scheduleOn ? 'Schedule' : 'Send'} to these ${recipients.length} addresses?`}
              </h3>
              <ul className="mb-3 space-y-1">
                {recipients.map((r) => (
                  <li key={r.email} className="text-sm font-semibold break-all">
                    {r.email}
                  </li>
                ))}
              </ul>
              {scheduleOn && (
                <p className="text-sm mb-2">
                  Arrives {prettyWhen(deliverAt)}
                  {repeatYearly ? ', then every year' : ''}.
                </p>
              )}
              {photos.length > 0 && (
                <p className="text-sm mb-2">
                  Includes {photos.length} photo{photos.length > 1 ? 's' : ''}.
                </p>
              )}
              {voice && <p className="text-sm mb-2">Includes a voice message.</p>}
              {offline && (
                <p className="text-sm mb-2 text-heart">
                  You're offline. Your letter will be saved on this device and sent automatically when you're back online.
                </p>
              )}
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
                  {sending ? stage || (scheduleOn ? 'Scheduling...' : 'Sending...') : offline ? 'Yes, save & send later' : `Yes, ${noun}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
