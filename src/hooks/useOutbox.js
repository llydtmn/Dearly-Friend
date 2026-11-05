import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeOutbox, refreshOutbox, flushOutbox, retryFailed, discardFailed } from '../services/outboxService';

/**
 * Keeps the offline outbox moving. Call once, from the signed-in screen.
 * onSent(count) runs after queued letters finally go out.
 */
export function useOutbox(user, { onSent } = {}) {
  const userId = user.id;
  const [state, setState] = useState({ pending: 0, failed: 0, flushing: false, lastError: '' });
  const [online, setOnline] = useState(() => navigator.onLine);
  const onSentRef = useRef(onSent);
  onSentRef.current = onSent;
  const pendingRef = useRef(0);
  pendingRef.current = state.pending;

  const flush = useCallback(async () => {
    const sent = await flushOutbox(userId);
    if (sent > 0) onSentRef.current?.(sent);
  }, [userId]);

  useEffect(() => {
    const unsubscribe = subscribeOutbox(setState);
    refreshOutbox(userId).then(flush);
    return unsubscribe;
  }, [userId, flush]);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      flush();
    };
    const goOffline = () => setOnline(false);
    const onVisible = () => document.visibilityState === 'visible' && flush();
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    document.addEventListener('visibilitychange', onVisible);
    // navigator.onLine can say "online" on a dead wifi, so keep trying while letters wait
    const timer = setInterval(() => {
      if (pendingRef.current > 0 && navigator.onLine) flush();
    }, 20000);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [flush]);

  // A letter just got queued while we thought we were online (the request itself failed)
  useEffect(() => {
    if (state.pending > 0 && online && !state.flushing) {
      const t = setTimeout(flush, 3000);
      return () => clearTimeout(t);
    }
  }, [state.pending, online, state.flushing, flush]);

  const retry = useCallback(async () => {
    await retryFailed(userId);
    flush();
  }, [userId, flush]);

  const discard = useCallback(() => discardFailed(userId), [userId]);

  return { ...state, online, flush, retry, discard, visible: !online || state.pending > 0 || state.failed > 0 };
}
