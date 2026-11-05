import { supabase } from '../supabaseClient';

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

const urlBase64ToUint8Array = (base64) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

const getRegistration = async () => {
  await navigator.serviceWorker.register('/sw.js'); // safe to repeat
  return navigator.serviceWorker.ready;
};

const saveSubscription = async (sub) => {
  const json = sub.toJSON();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_user_agent: navigator.userAgent.slice(0, 200),
  });
  if (error) throw error;
};

/**
 * 'unsupported'   this browser can't do push
 * 'needs-install' iPhone/iPad: only works once Dearly is added to the Home Screen
 * 'denied'        the person blocked notifications in the browser
 * 'on' | 'off'    this device is / isn't subscribed
 */
export const getPushState = async () => {
  if (isIOS() && !isStandalone()) return 'needs-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (!PUBLIC_KEY) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub ? 'on' : 'off';
  } catch {
    return 'off';
  }
};

// Must be called from a tap/click (browsers refuse to ask for permission otherwise)
export const enablePush = async () => {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed.');
  const reg = await getRegistration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_KEY),
    }));
  await saveSubscription(sub);
};

export const disablePush = async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const { endpoint } = sub;
  await sub.unsubscribe();
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
};

// On every app start: if this device already allowed notifications, make sure the
// signed-in account owns the subscription (covers re-installs and switching accounts).
export const syncPush = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (sub) await saveSubscription(sub);
};

// On sign-out: stop this phone receiving the previous account's notifications.
// The browser keeps its permission, so signing back in re-links it automatically.
export const forgetPushOnThisDevice = async () => {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager?.getSubscription();
  if (sub) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
};
