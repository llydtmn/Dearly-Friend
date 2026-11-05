import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Plus, User, LogOut, Inbox, Users, Star, Clock } from 'lucide-react';
import {
  getMessages,
  getMessage,
  getProfiles,
  markAsRead,
  deleteMessage,
  subscribeToMessages,
  getKeepsakeIds,
  getUnreadCount,
  addKeepsake,
  removeKeepsake,
  PAGE_SIZE,
} from '../services/messageService';
import { getMyProfile, avatarUrl } from '../services/profileService';
import { syncPush, forgetPushOnThisDevice } from '../services/pushService';
import { useToast } from '../components/Toast';
import MessageCard from '../components/MessageCard';
import ComposeMessage from '../components/ComposeMessage';
import EnvelopeScreen from '../components/EnvelopeScreen';
import LetterContent from '../components/LetterContent';
import ProfileSettings from '../components/ProfileSettings';
import ScheduledList from '../components/ScheduledList';
import ProfilesList from '../components/ProfilesList';
import ProfileSheet from '../components/ProfileSheet';
import OfflineBanner from '../components/OfflineBanner';
import { useOutbox } from '../hooks/useOutbox';

const TABS = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['sent', 'Sent'],
  ['keepsakes', 'Keepsakes'],
  ['scheduled', 'Scheduled'],
  ['profiles', 'Profiles'],
];

const EMPTY_TEXT = {
  all: 'No letters found.',
  unread: 'No unread letters.',
  sent: "You haven't sent any letters yet.",
  keepsakes: 'Star a letter to keep it here.',
};

// Same rules the database applies, used to keep the visible list in step with live changes
const matchesView = (msg, { filter, term, keepsakeIds }, myEmail) => {
  if (filter === 'scheduled' || filter === 'profiles') return false;
  const sent = msg.senderEmail.toLowerCase() === myEmail;
  if (sent ? msg.deletedBySender : msg.deletedByRecipient) return false; // I removed my copy
  if (filter === 'unread' && (msg.isRead || sent)) return false;
  if (filter === 'sent' && !sent) return false;
  if (filter === 'all' && sent) return false;
  if (filter === 'keepsakes' && !keepsakeIds.has(msg.id)) return false;
  if (term) {
    return (
      msg.senderEmail.toLowerCase().includes(term) ||
      msg.recipientEmail.toLowerCase().includes(term) ||
      (msg.greeting && msg.greeting.toLowerCase().includes(term))
    );
  }
  return true;
};

// Fold a fresh first page into what's already loaded, dropping older rows that were deleted elsewhere
const mergeFresh = (prev, page) => {
  const oldest = Date.parse(page[page.length - 1].date);
  const keep = prev.filter((m) => Date.parse(m.date) < oldest);
  return [...page, ...keep];
};

const formatWhen = (iso) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export default function Home({ user, onSignOut }) {
  const myEmail = user.email.toLowerCase();
  const toast = useToast();

  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [keepsakeIds, setKeepsakeIds] = useState(() => new Set());
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [isComposing, setIsComposing] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [composeTo, setComposeTo] = useState(null); // a profile to write to
  const [viewProfile, setViewProfile] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [activeMessage, setActiveMessage] = useState(null);
  const [isEnvelopeOpen, setIsEnvelopeOpen] = useState(false);
  const [swipedId, setSwipedId] = useState(null);
  const [scheduledVersion, setScheduledVersion] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesRef = useRef([]);
  const viewRef = useRef({ filter: 'all', term: '', keepsakeIds });
  const reqRef = useRef(0);
  const refreshRef = useRef(() => {});

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    viewRef.current = { filter, term: debouncedSearch.trim().toLowerCase(), keepsakeIds };
  }, [filter, debouncedSearch, keepsakeIds]);

  /* ---------- Loading + pagination ---------- */

  const loadPage = useCallback(
    async ({ reset }) => {
      const reqId = ++reqRef.current;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const last = messagesRef.current[messagesRef.current.length - 1];
        const page = await getMessages({
          filter,
          search: debouncedSearch,
          myEmail,
          before: reset ? undefined : last?.date,
          limit: PAGE_SIZE,
        });
        if (reqId !== reqRef.current) return;
        setMessages((prev) => (reset ? page : [...prev, ...page.filter((m) => !prev.some((p) => p.id === m.id))]));
        setHasMore(page.length === PAGE_SIZE);
      } catch (err) {
        console.error('Failed to load messages:', err);
        if (reqId === reqRef.current && navigator.onLine) toast.error("Couldn't load your letters. Check your connection and try again.");
      } finally {
        if (reqId === reqRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter, debouncedSearch, myEmail]
  );

  // Quietly pull in anything new without disturbing the pages already loaded
  const refreshFirstPage = useCallback(async () => {
    if (filter === 'scheduled' || filter === 'profiles') return;
    const reqId = reqRef.current;
    try {
      const page = await getMessages({ filter, search: debouncedSearch, myEmail, limit: PAGE_SIZE });
      if (reqId !== reqRef.current) return;
      if (page.length < PAGE_SIZE) {
        setMessages(page);
        setHasMore(false);
      } else {
        setMessages((prev) => mergeFresh(prev, page));
      }
    } catch (err) {
      console.error('Failed to refresh messages:', err);
    }
  }, [filter, debouncedSearch, myEmail]);

  useEffect(() => {
    refreshRef.current = refreshFirstPage;
  }, [refreshFirstPage]);

  // Number shown on the Inbox badge (counts the whole inbox, not just the page that's loaded)
  const refreshUnread = useCallback(async () => {
    try {
      setUnreadCount(await getUnreadCount(myEmail));
    } catch (err) {
      console.error('Failed to count unread letters:', err);
    }
  }, [myEmail]);

  const refreshUnreadRef = useRef(refreshUnread);
  useEffect(() => {
    refreshUnreadRef.current = refreshUnread;
  }, [refreshUnread]);

  useEffect(() => {
    refreshUnread();
  }, [refreshUnread]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (filter === 'scheduled' || filter === 'profiles') return;
    loadPage({ reset: true });
  }, [loadPage, filter]);

  // Profile, friends (for avatars) and keepsakes. Failures here shouldn't block the inbox.
  useEffect(() => {
    getMyProfile(user.id).then(setProfile).catch((err) => console.error('Failed to load profile:', err));
    getProfiles().then(setProfiles).catch((err) => console.error('Failed to load profiles:', err));
    getKeepsakeIds()
      .then((ids) => setKeepsakeIds(new Set(ids)))
      .catch((err) => console.error('Failed to load keepsakes:', err));
  }, [user.id]);

  // If this device already allowed notifications, keep it linked to the signed-in account
  useEffect(() => {
    syncPush().catch((err) => console.warn('Push sync failed:', err));
  }, [user.id]);

  const handleSignOut = async () => {
    try {
      await forgetPushOnThisDevice();
    } catch {
      /* best effort: never block signing out */
    }
    onSignOut();
  };

  /* ---------- Live inbox ---------- */

  useEffect(() => {
    const unsubscribe = subscribeToMessages(user.id, {
      onInsert: (msg) => {
        if (messagesRef.current.some((m) => m.id === msg.id)) return;
        const mine = msg.senderEmail?.toLowerCase() === myEmail;
        const forMe = msg.recipientEmail?.toLowerCase() === myEmail;
        if (!mine && !forMe) return;
        if (matchesView(msg, viewRef.current, myEmail)) {
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [msg, ...prev]));
        }
        if (forMe && !mine) {
          toast.info(`A new letter from ${msg.senderEmail} just arrived 💌`);
          refreshUnreadRef.current();
        }
      },
      onUpdate: (msg) => {
        const sentByMe = msg.senderEmail?.toLowerCase() === myEmail;
        const hiddenForMe = sentByMe ? msg.deletedBySender : msg.deletedByRecipient;
        setMessages((prev) =>
          hiddenForMe ? prev.filter((m) => m.id !== msg.id) : prev.map((m) => (m.id === msg.id ? msg : m))
        );
        refreshUnreadRef.current();
      },
      onDelete: (id) => {
        if (!id) return;
        setMessages((prev) => prev.filter((m) => m.id !== id));
        setActiveMessage((cur) => (cur?.id === id ? null : cur));
        refreshUnreadRef.current();
      },
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, myEmail]);

  // Catch up on anything missed while the app was in the background (phones suspend sockets)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshRef.current();
        refreshUnreadRef.current();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, []);

  /* ---------- Offline outbox ---------- */

  const outbox = useOutbox(user, {
    onSent: (n) => {
      toast.success(n > 1 ? `Your ${n} waiting letters were sent 💌` : 'Your waiting letter was sent 💌');
      refreshRef.current();
      setScheduledVersion((v) => v + 1);
    },
  });

  /* ---------- Helpers ---------- */

  const isSentByMe = (msg) => msg.senderEmail.toLowerCase() === myEmail;

  const profileByEmail = useMemo(() => {
    const map = new Map(profiles.map((p) => [p.email.toLowerCase(), p]));
    if (profile) map.set(myEmail, profile);
    return map;
  }, [profiles, profile, myEmail]);

  const myAvatar = avatarUrl(profile?.avatar_path);

  /* ---------- Letters ---------- */

  const handleMessageClick = async (msg) => {
    setActiveMessage(msg);
    setIsEnvelopeOpen(false);
    if (!msg.isRead && !isSentByMe(msg)) {
      try {
        await markAsRead(msg.id);
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m)));
        setUnreadCount((n) => Math.max(0, n - 1));
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Email links (?letter=<id>) open the letter directly, even if it's on a page we haven't loaded
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('letter');
    if (!id) return;
    (async () => {
      try {
        const msg = await getMessage(id);
        window.history.replaceState({}, '', '/');
        const hiddenForMe =
          msg && (msg.senderEmail.toLowerCase() === myEmail ? msg.deletedBySender : msg.deletedByRecipient);
        if (msg && !hiddenForMe) handleMessageClick(msg);
        else toast.error("That letter isn't in this inbox. Make sure you're signed in with the email it was sent to.");
      } catch (err) {
        console.error('Failed to open linked letter:', err);
        window.history.replaceState({}, '', '/');
        toast.error("Couldn't open that letter.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCloseLetter = () => {
    setActiveMessage(null);
    setIsEnvelopeOpen(false);
  };

  const handleDelete = async (id) => {
    try {
      await deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      setSwipedId(null);
      refreshUnread();
    } catch (err) {
      console.error('Failed to delete message:', err);
      toast.error("Couldn't delete this letter. Please try again.");
    }
  };

  const toggleKeepsake = async (msg) => {
    const had = keepsakeIds.has(msg.id);
    const flip = (add) =>
      setKeepsakeIds((prev) => {
        const next = new Set(prev);
        if (add) next.add(msg.id);
        else next.delete(msg.id);
        return next;
      });

    flip(!had); // optimistic
    try {
      if (had) await removeKeepsake(msg.id);
      else {
        await addKeepsake(msg.id);
        toast.success('Saved to your keepsakes ✨');
      }
    } catch (err) {
      console.error('Failed to update keepsake:', err);
      flip(had); // revert
      toast.error("Couldn't update your keepsakes. Please try again.");
    }
  };

  /* ---------- Compose ---------- */

  const handleReply = (msg) => {
    setReplyTo(msg);
    handleCloseLetter();
    setIsComposing(true);
  };

  const openCompose = () => {
    setReplyTo(null);
    setComposeTo(null);
    setIsComposing(true);
  };

  const writeTo = (p) => {
    setViewProfile(null);
    setReplyTo(null);
    setComposeTo(p);
    setIsComposing(true);
  };

  const closeCompose = () => {
    setIsComposing(false);
    setReplyTo(null);
    setComposeTo(null);
  };

  const openProfile = (p) => {
    if (p.id === user.id) setShowProfile(true);
    else setViewProfile(p);
  };

  const handleMessageSent = async (count = 1, info) => {
    closeCompose();
    if (info?.queued) {
      toast.info(
        count > 1
          ? "You're offline. Your letters are saved and will send by themselves when you're back 📮"
          : "You're offline. Your letter is saved and will send by itself when you're back 📮"
      );
      return;
    }
    if (info?.scheduled) {
      toast.success(
        count > 1
          ? `Your ${count} letters are scheduled for ${formatWhen(info.deliverAt)} ⏳`
          : `Your letter is scheduled for ${formatWhen(info.deliverAt)} ⏳`
      );
      setScheduledVersion((v) => v + 1);
      return;
    }
    toast.success(count > 1 ? `Your ${count} letters are on their way 💌` : 'Your letter is on its way 💌');
    await refreshRef.current();
  };

  const view = { filter, term: debouncedSearch.trim().toLowerCase(), keepsakeIds };
  const visibleMessages = messages.filter((m) => matchesView(m, view, myEmail));

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <OfflineBanner outbox={outbox} />
      <div
        className="p-4 flex justify-between items-center border-b border-gray-700/50 z-10 bg-charcoal/80 backdrop-blur-md sticky top-0"
        style={{ top: outbox.visible ? '2.25rem' : 0 }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowProfile(true)}
            aria-label="Profile settings"
            title="Profile settings"
            className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center border border-gray-600 hover:border-gray-400 transition-colors"
          >
            {myAvatar ? (
              <img src={myAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User size={20} className="text-gray-300" />
            )}
          </button>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#2a2a2a] text-gray-200 pl-9 pr-4 py-2 rounded-sm text-sm outline-none border border-gray-700 focus:border-gray-500 transition-colors w-40 md:w-64"
            />
          </div>
        </div>
        <div className="flex items-center">
          <button onClick={openCompose} aria-label="Write a letter" className="hidden md:block text-gray-300 hover:text-paper transition-colors p-2">
            <Plus size={24} />
          </button>
          <button onClick={handleSignOut} title="Sign out" className="text-gray-300 hover:text-paper transition-colors p-2">
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="px-4 py-3 hidden md:flex gap-5 text-sm font-sans border-b border-gray-800 z-10 bg-charcoal/80 backdrop-blur-md overflow-x-auto whitespace-nowrap">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`pb-1 border-b-2 transition-colors ${filter === key ? 'text-paper border-paper' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Mobile only: All / Unread / Sent switch (the bottom bar replaces the tab row) */}
      {(filter === 'all' || filter === 'unread' || filter === 'sent') && (
        <div className="md:hidden px-4 py-2 flex gap-2 text-sm font-sans z-10 bg-charcoal/80 backdrop-blur-md border-b border-gray-800">
          {[
            ['all', 'All'],
            ['unread', unreadCount > 0 ? `Unread (${unreadCount > 99 ? '99+' : unreadCount})` : 'Unread'],
            ['sent', 'Sent'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-1 rounded-full border transition-colors ${
                filter === key ? 'bg-paper text-charcoal border-paper' : 'border-gray-600 text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto z-10 relative pb-28 md:pb-0">
        {filter === 'scheduled' ? (
          <ScheduledList key={scheduledVersion} />
        ) : filter === 'profiles' ? (
          <ProfilesList
            profiles={profile ? profiles.map((p) => (p.id === profile.id ? { ...p, ...profile } : p)) : profiles}
            myId={user.id}
            term={debouncedSearch}
            onSelect={openProfile}
          />
        ) : loading && visibleMessages.length === 0 ? (
          <div className="text-center text-gray-500 mt-20 font-handwriting text-2xl">Opening the mailbox...</div>
        ) : visibleMessages.length === 0 ? (
          <div className="text-center text-gray-500 mt-20 px-6 font-handwriting text-2xl">
            {debouncedSearch ? 'No letters match your search.' : EMPTY_TEXT[filter]}
          </div>
        ) : (
          <>
            {visibleMessages.map((msg) => {
              const other = profileByEmail.get((isSentByMe(msg) ? msg.recipientEmail : msg.senderEmail).toLowerCase());
              const otherEmail = isSentByMe(msg) ? msg.recipientEmail : msg.senderEmail;
              return (
                <MessageCard
                  key={msg.id}
                  message={msg}
                  currentEmail={myEmail}
                  avatarUrl={avatarUrl(other?.avatar_path)}
                  initial={(other?.name || otherEmail || '?').charAt(0)}
                  isStarred={keepsakeIds.has(msg.id)}
                  onClick={() => handleMessageClick(msg)}
                  isActive={activeMessage?.id === msg.id}
                  isOpen={swipedId === msg.id}
                  onOpen={() => setSwipedId(msg.id)}
                  onClose={() => setSwipedId((cur) => (cur === msg.id ? null : cur))}
                  onDelete={() => handleDelete(msg.id)}
                />
              );
            })}
            {hasMore && (
              <div className="flex justify-center py-6">
                <button
                  onClick={() => loadPage({ reset: false })}
                  disabled={loadingMore}
                  className="font-sans text-sm px-5 py-2 rounded-sm border border-gray-600 text-gray-300 hover:border-gray-400 hover:text-paper transition-colors disabled:opacity-50"
                >
                  {loadingMore ? 'Loading...' : 'Load older letters'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-charcoal/95 backdrop-blur-md border-t border-gray-700/50 flex items-end justify-around px-2 pt-2"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <NavBtn
          label="Inbox"
          icon={Inbox}
          badge={unreadCount}
          active={filter === 'all' || filter === 'unread' || filter === 'sent'}
          onClick={() => setFilter('all')}
        />
        <NavBtn label="Profiles" icon={Users} active={filter === 'profiles'} onClick={() => setFilter('profiles')} />

        <button
          onClick={openCompose}
          aria-label="Write a letter"
          className="-mt-6 w-14 h-14 rounded-full bg-heart text-paper shadow-lg flex items-center justify-center border-4 border-charcoal active:scale-95 transition-transform"
        >
          <Plus size={26} />
        </button>

        <NavBtn label="Keepsakes" icon={Star} active={filter === 'keepsakes'} onClick={() => setFilter('keepsakes')} />
        <NavBtn label="Scheduled" icon={Clock} active={filter === 'scheduled'} onClick={() => setFilter('scheduled')} />
      </nav>

      {isComposing && (
        <ComposeMessage
          key={replyTo ? `reply-${replyTo.id}` : composeTo ? `to-${composeTo.id}` : 'new'}
          user={user}
          profile={profile}
          replyTo={replyTo}
          to={composeTo}
          onClose={closeCompose}
          onSent={handleMessageSent}
        />
      )}

      {viewProfile && <ProfileSheet profile={viewProfile} onClose={() => setViewProfile(null)} onWrite={writeTo} />}

      {showProfile && (
        <ProfileSettings
          user={user}
          profile={profile}
          onClose={() => setShowProfile(false)}
          onAccountDeleted={onSignOut}
          onSaved={(saved) => {
            setProfile(saved);
            setProfiles((prev) => prev.map((p) => (p.id === saved.id ? { ...p, ...saved } : p)));
          }}
        />
      )}

      {activeMessage &&
        (!isEnvelopeOpen ? (
          <EnvelopeScreen
            message={activeMessage}
            onOpen={() => setIsEnvelopeOpen(true)}
            onClose={handleCloseLetter}
          />
        ) : (
          <LetterContent
            message={activeMessage}
            onClose={handleCloseLetter}
            onReply={isSentByMe(activeMessage) ? undefined : () => handleReply(activeMessage)}
            isStarred={keepsakeIds.has(activeMessage.id)}
            onToggleStar={() => toggleKeepsake(activeMessage)}
          />
        ))}
    </div>
  );
}

function NavBtn({ icon: Icon, label, active, onClick, badge = 0 }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center gap-0.5 w-16 pb-1 text-[11px] font-sans transition-colors ${
        active ? 'text-paper' : 'text-gray-500'
      }`}
    >
      <span className="relative">
        <Icon size={22} />
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-heart text-paper text-[10px] leading-4 text-center">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      {label}
    </button>
  );
}