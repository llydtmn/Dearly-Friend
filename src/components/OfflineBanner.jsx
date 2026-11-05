import { WifiOff, Loader2, Send, AlertCircle } from 'lucide-react';

const plural = (n) => `${n} letter${n === 1 ? '' : 's'}`;

/** Slim bar under the top of the screen. Shows only when offline, or while letters are waiting. */
export default function OfflineBanner({ outbox }) {
  const { online, pending, failed, flushing, lastError, flush, retry, discard, visible } = outbox;
  if (!visible) return null;

  let tone = 'bg-[#3a3a3a] text-gray-100';
  let icon = <WifiOff size={16} className="shrink-0" />;
  let text;
  let actions = null;

  if (failed > 0 && online) {
    tone = 'bg-red-900 text-red-50';
    icon = <AlertCircle size={16} className="shrink-0" />;
    text = `${plural(failed)} couldn't be sent${lastError ? `: ${lastError}` : ''}`;
    actions = (
      <>
        <button onClick={retry} className="underline shrink-0">Retry</button>
        <button onClick={discard} className="underline shrink-0">Discard</button>
      </>
    );
  } else if (!online) {
    text =
      pending > 0
        ? `You're offline. ${plural(pending)} will send when you're back online.`
        : "You're offline. You can still write letters, they'll send when you're back.";
  } else if (flushing) {
    tone = 'bg-heart text-paper';
    icon = <Loader2 size={16} className="shrink-0 animate-spin" />;
    text = `Sending ${plural(pending)}...`;
  } else {
    tone = 'bg-heart text-paper';
    icon = <Send size={16} className="shrink-0" />;
    text = `${plural(pending)} waiting to send.`;
    actions = <button onClick={flush} className="underline shrink-0">Send now</button>;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-20 h-9 px-4 flex items-center gap-2 text-xs font-sans ${tone}`}
    >
      {icon}
      <span className="flex-1 truncate">{text}</span>
      {actions}
    </div>
  );
}
