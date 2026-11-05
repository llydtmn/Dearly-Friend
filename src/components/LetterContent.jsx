import { useState } from 'react';
import { X, Moon, Sun } from 'lucide-react';
import { useTypingAnimation } from '../hooks/useTypingAnimation';

export default function LetterContent({ message, onClose }) {
const [dark, setDark] = useState(
  () => localStorage.getItem('dearly_letter_dark') !== '0'
);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('dearly_letter_dark', next ? '1' : '0');
  };

  const fullText = `${message.content}\n\n${message.signature || ''}`;
  const { displayText, isDone, skip } = useTypingAnimation(fullText, 40);

  const date = new Date(message.date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="absolute inset-0 bg-charcoal/90 z-30 flex items-center justify-center p-4 animate-fade-in">
      <div
        className={`w-full max-w-3xl h-[85vh] rounded-sm shadow-2xl relative flex flex-col overflow-hidden transition-colors duration-500 ${
          dark ? 'paper-dark-grain' : 'bg-paper bg-paper-texture'
        }`}
      >
        {/* Header */}
        <div
          className={`p-3 flex justify-between items-center border-b text-xs font-sans transition-colors duration-500 ${
            dark
              ? 'bg-black/30 border-white/10 text-gray-400'
              : 'bg-paper-dark/40 border-ink/10 text-ink-light'
          }`}
        >
          <span>{date}</span>
          <span>Message from: [ {message.senderEmail} ]</span>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleDark}
              title={dark ? 'Switch to light paper' : 'Switch to dark paper'}
              className="hover:text-heart transition-colors"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={onClose} className="hover:text-heart transition-colors">
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

          <p
            className={`font-handwriting text-xl leading-loose whitespace-pre-wrap ${
              !isDone ? 'cursor-blink' : ''
            }`}
          >
            {displayText}
          </p>

          {!isDone && (
            <button
              onClick={skip}
              className={`absolute bottom-6 right-6 px-3 py-1 rounded text-xs font-sans transition-colors ${
                dark
                  ? 'bg-white/10 hover:bg-white/20 text-gray-300'
                  : 'bg-ink/10 hover:bg-ink/20 text-ink'
              }`}
            >
              Skip Animation
            </button>
          )}
        </div>
      </div>
    </div>
  );
}