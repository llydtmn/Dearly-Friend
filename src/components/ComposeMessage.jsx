import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import RecipientSelector from './RecipientSelector';
import { sendMessage, getProfiles } from '../services/messageService';

export default function ComposeMessage({ user, onClose, onSent }) {
  const myName = user.user_metadata?.name || user.email.split('@')[0];

  const [friends, setFriends] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [greeting, setGreeting] = useState('Dear, [Name]');
  const [content, setContent] = useState('');
  const [signature, setSignature] = useState(`- ${myName}`);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getProfiles()
      .then((all) => setFriends(all.filter((p) => p.id !== user.id)))
      .catch((err) => setError(err.message));
  }, [user.id]);

  const handleSend = async () => {
    if (recipients.length === 0 || !content.trim()) return;
    setSending(true);
    setError('');
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
      onSent();
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex justify-center items-center p-4 animate-fade-in">
      <div className="bg-paper bg-paper-texture w-full max-w-2xl rounded-sm shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-paper-dark/50 p-4 border-b border-ink/10 flex justify-between items-center">
          <h2 className="font-handwriting text-2xl text-ink">Write a Letter</h2>
          <button onClick={onClose} className="text-ink-light hover:text-heart transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto text-ink">
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
          {error && <p className="text-heart text-sm mt-4">{error}</p>}
        </div>

        <div className="p-4 border-t border-ink/10 flex justify-end bg-paper-dark/20">
          <button
            onClick={handleSend}
            disabled={sending || recipients.length === 0 || !content.trim()}
            className="bg-heart text-paper px-6 py-2 rounded-sm font-sans text-sm tracking-wide hover:bg-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : 'Send Now →'}
          </button>
        </div>
      </div>
    </div>
  );
}