import { useState, useEffect, useRef } from 'react';
import { Search, Plus, User, LogOut } from 'lucide-react';
import { getMessages, markAsRead, deleteMessage, subscribeToMessages } from '../services/messageService';
import { useToast } from '../components/Toast';
import MessageCard from '../components/MessageCard';
import ComposeMessage from '../components/ComposeMessage';
import EnvelopeScreen from '../components/EnvelopeScreen';
import LetterContent from '../components/LetterContent';

export default function Home({ user, onSignOut }) {
  const myEmail = user.email.toLowerCase();

  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [activeMessage, setActiveMessage] = useState(null);
  const [isEnvelopeOpen, setIsEnvelopeOpen] = useState(false);
  const [swipedId, setSwipedId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);

  const toast = useToast();
  const messagesRef = useRef([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const loadMessages = async ({ quiet = false } = {}) => {
    try {
      setMessages(await getMessages());
    } catch (err) {
      console.error('Failed to load messages:', err);
      if (!quiet) toast.error("Couldn't load your letters. Check your connection and try again.");
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  // Live inbox: new, updated and deleted letters show up without a refresh
  useEffect(() => {
    const unsubscribe = subscribeToMessages(user.id, {
      onInsert: (msg) => {
        if (messagesRef.current.some((m) => m.id === msg.id)) return;
        const mine = msg.senderEmail?.toLowerCase() === myEmail;
        const forMe = msg.recipientEmail?.toLowerCase() === myEmail;
        if (!mine && !forMe) return;
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [msg, ...prev]));
        if (forMe && !mine) toast.info(`A new letter from ${msg.senderEmail} just arrived 💌`);
      },
      onUpdate: (msg) => {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      },
      onDelete: (id) => {
        if (!id) return;
        setMessages((prev) => prev.filter((m) => m.id !== id));
        setActiveMessage((cur) => (cur?.id === id ? null : cur));
      },
    });
    return unsubscribe;
  }, [user.id, myEmail]);

  // Catch up on anything missed while the app was in the background (phones suspend sockets)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadMessages({ quiet: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, []);

  useEffect(() => {
  const id = new URLSearchParams(window.location.search).get('letter');
  if (!id || messages.length === 0) return;
  const msg = messages.find((m) => m.id === id);
  if (msg) {
    handleMessageClick(msg);
    window.history.replaceState({}, '', '/');
  }
}, [messages]);

  const isSentByMe = (msg) => msg.senderEmail.toLowerCase() === myEmail;

  const handleMessageClick = async (msg) => {
    setActiveMessage(msg);
    setIsEnvelopeOpen(false);
    if (!msg.isRead && !isSentByMe(msg)) {
      try {
        await markAsRead(msg.id);
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m)));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCloseLetter = () => {
    setActiveMessage(null);
    setIsEnvelopeOpen(false);
  };

  const handleDelete = async (id) => {
    try {
      await deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setSwipedId(null);
    } catch (err) {
      console.error('Failed to delete message:', err);
      toast.error("Couldn't delete this letter. Please try again.");
    }
  };

  const handleReply = (msg) => {
    setReplyTo(msg);
    handleCloseLetter();
    setIsComposing(true);
  };

  const openCompose = () => {
    setReplyTo(null);
    setIsComposing(true);
  };

  const closeCompose = () => {
    setIsComposing(false);
    setReplyTo(null);
  };

  const handleMessageSent = async (count = 1) => {
    closeCompose();
    toast.success(count > 1 ? `Your ${count} letters are on their way 💌` : 'Your letter is on its way 💌');
    await loadMessages({ quiet: true });
  };

  const filteredMessages = messages.filter((msg) => {
    const sent = isSentByMe(msg);
    if (filter === 'unread' && (msg.isRead || sent)) return false;
    if (filter === 'sent' && !sent) return false;
    if (filter === 'all' && sent) return false;

    if (search) {
      const term = search.toLowerCase();
      return (
        msg.senderEmail.toLowerCase().includes(term) ||
        msg.recipientEmail.toLowerCase().includes(term) ||
        (msg.greeting && msg.greeting.toLowerCase().includes(term))
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="p-4 flex justify-between items-center border-b border-gray-700/50 z-10 bg-charcoal/80 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center border border-gray-600">
            <User size={20} className="text-gray-300" />
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#2a2a2a] text-gray-200 pl-9 pr-4 py-2 rounded-sm text-sm outline-none border border-gray-700 focus:border-gray-500 transition-colors w-48 md:w-64"
            />
          </div>
        </div>
        <div className="flex items-center">
          <button onClick={openCompose} aria-label="Write a letter" className="text-gray-300 hover:text-paper transition-colors p-2">
            <Plus size={24} />
          </button>
          <button onClick={onSignOut} title="Sign out" className="text-gray-300 hover:text-paper transition-colors p-2">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 flex gap-4 text-sm font-sans border-b border-gray-800 z-10 bg-charcoal/80 backdrop-blur-md">
        {['all', 'unread', 'sent'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`capitalize pb-1 border-b-2 transition-colors ${filter === f ? 'text-paper border-paper' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto z-10 relative">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-gray-500 mt-20 font-handwriting text-2xl">No letters found.</div>
        ) : (
          filteredMessages.map((msg) => (
            <MessageCard
              key={msg.id}
              message={msg}
              currentEmail={myEmail}
              onClick={() => handleMessageClick(msg)}
              isActive={activeMessage?.id === msg.id}
              isOpen={swipedId === msg.id}
              onOpen={() => setSwipedId(msg.id)}
              onClose={() => setSwipedId((cur) => (cur === msg.id ? null : cur))}
              onDelete={() => handleDelete(msg.id)}
            />
          ))
        )}
      </div>

      {isComposing && (
        <ComposeMessage
          key={replyTo ? `reply-${replyTo.id}` : 'new'}
          user={user}
          replyTo={replyTo}
          onClose={closeCompose}
          onSent={handleMessageSent}
        />
      )}

      {activeMessage &&
        (!isEnvelopeOpen ? (
          <EnvelopeScreen onOpen={() => setIsEnvelopeOpen(true)} />
        ) : (
          <LetterContent
            message={activeMessage}
            onClose={handleCloseLetter}
            onReply={isSentByMe(activeMessage) ? undefined : () => handleReply(activeMessage)}
          />
        ))}
    </div>
  );
}