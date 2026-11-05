import { useState, useEffect } from 'react';
import { X, Moon, Sun, Reply, Star, RotateCcw } from 'lucide-react';
import { useTypingAnimation } from '../hooks/useTypingAnimation';
import { getAttachmentUrls } from '../services/messageService';

export default function LetterContent({ message, onClose, onReply, isStarred = false, onToggleStar }) {
  const [dark, setDark] = useState(() => localStorage.getItem('dearly_letter_dark') !== '0');
  const [photos, setPhotos] = useState([]);
  const [photoError, setPhotoError] = useState(false);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('dearly_letter_dark', next ? '1' : '0');
  };

  const fullText = `${message.content}\n\n${message.signature || ''}`;
  const { displayText, isDone, skip, replay } = useTypingAnimation(fullText, 40);

  // Photos live in a private bucket, so fetch short-lived signed links
  const attachmentKey = (message.attachments ?? []).join('|');
  useEffect(() => {
    let alive = true;
    setPhotos([]);
    setPhotoError(false);
    if (!attachmentKey) return undefined;
    getAttachmentUrls(attachmentKey.split('|'))
      .then((urls) => alive && setPhotos(urls))
      .catch((err) => {
        console.error('Failed to load photos:', err);
        if (alive) setPhotoError(true);
      });
    return () => {
      alive = false;
    };
  }, [message.id, attachmentKey]);

  const date = new Date(message.date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const hasFooter = isDone || !!onReply;

  return (
    <div className="fixed inset-0 bg-charcoal/90 z-30 flex items-center justify-center p-4">
      <div
        className={`w-full max-w-3xl h-[85vh] rounded-sm shadow-2xl relative flex flex-col overflow-hidden animate-letter-in transition-colors duration-500 ${
          dark ? 'paper-dark-grain' : 'bg-paper bg-paper-texture'
        }`}
      >
        {/* Header */}
        <div
          className={`p-3 flex justify-between items-center border-b text-xs font-sans transition-colors duration-500 ${
            dark ? 'bg-black/30 border-white/10 text-gray-400' : 'bg-paper-dark/40 border-ink/10 text-ink-light'
          }`}
        >
          <span>{date}</span>
          <span>Message from: [ {message.senderEmail} ]</span>
          <div className="flex items-center gap-3">
            {onToggleStar && (
              <button
                onClick={onToggleStar}
                aria-pressed={isStarred}
                title={isStarred ? 'Remove from keepsakes' : 'Save to keepsakes'}
                className="hover:text-amber-400 transition-colors"
              >
                <Star size={18} className={isStarred ? 'fill-amber-400 text-amber-400' : ''} />
              </button>
            )}
            <button
              onClick={toggleDark}
              title={dark ? 'Switch to light paper' : 'Switch to dark paper'}
              className="hover:text-heart transition-colors"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={onClose} aria-label="Close letter" className="hover:text-heart transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          className={`p-8 md:p-12 flex-1 overflow-y-auto relative transition-colors duration-500 ${
            dark ? 'text-[#d8d2c4]' : 'text-ink'
          }`}
        >
          <h3 className="font-handwriting text-3xl mb-8">{message.greeting}</h3>

          <p className={`font-handwriting text-xl leading-loose whitespace-pre-wrap ${!isDone ? 'cursor-blink' : ''}`}>
            {displayText}
          </p>

          {isDone && photos.length > 0 && (
            <div className={`mt-10 grid gap-3 animate-fade-in ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {photos.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={url}
                    alt="A photo attached to this letter"
                    loading="lazy"
                    className={`w-full object-cover rounded-sm border shadow-lg ${
                      photos.length === 1 ? 'max-h-[28rem]' : 'h-48'
                    } ${dark ? 'border-white/10' : 'border-ink/10'}`}
                  />
                </a>
              ))}
            </div>
          )}
          {isDone && photoError && (
            <p className="mt-8 text-sm font-sans opacity-60">The photos with this letter couldn’t be loaded.</p>
          )}

          {!isDone && (
            <button
              onClick={skip}
              className={`absolute bottom-6 right-6 px-3 py-1 rounded text-xs font-sans transition-colors ${
                dark ? 'bg-white/10 hover:bg-white/20 text-gray-300' : 'bg-ink/10 hover:bg-ink/20 text-ink'
              }`}
            >
              Skip Animation
            </button>
          )}
        </div>

        {/* Footer */}
        {hasFooter && (
          <div
            className={`p-3 flex justify-between items-center border-t transition-colors duration-500 ${
              dark ? 'bg-black/30 border-white/10' : 'bg-paper-dark/40 border-ink/10'
            }`}
          >
            {isDone ? (
              <button
                onClick={replay}
                className={`flex items-center gap-2 px-3 py-2 rounded-sm font-sans text-xs transition-colors ${
                  dark ? 'text-gray-400 hover:text-gray-200' : 'text-ink-light hover:text-ink'
                }`}
              >
                <RotateCcw size={14} />
                Replay
              </button>
            ) : (
              <span />
            )}
            {onReply && (
              <button
                onClick={onReply}
                className="flex items-center gap-2 bg-heart text-paper px-5 py-2 rounded-sm font-sans text-sm tracking-wide hover:bg-red-900 transition-colors"
              >
                <Reply size={16} />
                Reply
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
