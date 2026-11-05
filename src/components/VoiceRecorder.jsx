import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2 } from 'lucide-react';
import { useToast } from './Toast';

export const MAX_VOICE_SECONDS = 180; // 3 minutes
const MIN_VOICE_SECONDS = 1;

// Chrome/Firefox/Android record webm or ogg; Safari/iOS records mp4
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
const pickType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  return TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
};

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * value:    null | { blob, url, mime, seconds }
 * onChange: called with a new recording, or null when it's removed
 */
export default function VoiceRecorder({ value, onChange, disabled = false }) {
  const toast = useToast();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const secondsRef = useRef(0);
  const cancelRef = useRef(false);

  const release = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Never leave the microphone on if this window closes mid-recording
  useEffect(
    () => () => {
      cancelRef.current = true;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          /* already stopped */
        }
      }
      release();
    },
    []
  );

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error("Voice recording isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const type = pickType();
      const rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined);
      recorderRef.current = rec;
      chunksRef.current = [];
      cancelRef.current = false;
      secondsRef.current = 0;
      setSeconds(0);

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        release();
        setRecording(false);
        if (cancelRef.current) return;
        const length = secondsRef.current;
        if (length < MIN_VOICE_SECONDS || chunksRef.current.length === 0) {
          toast.info('That was too short. Hold on a little longer and try again.');
          return;
        }
        const mime = (rec.mimeType || type || 'audio/webm').split(';')[0];
        const blob = new Blob(chunksRef.current, { type: mime });
        onChange({ blob, url: URL.createObjectURL(blob), mime, seconds: length });
      };

      rec.start();
      setRecording(true);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= MAX_VOICE_SECONDS) stop();
      }, 1000);
    } catch (err) {
      release();
      console.error('Microphone error:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        toast.error('Microphone access is blocked. Allow it in your browser settings, then try again.');
      } else if (err?.name === 'NotFoundError') {
        toast.error("We couldn't find a microphone on this device.");
      } else {
        toast.error("Couldn't start recording. Please try again.");
      }
    }
  };

  const stop = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  };

  const cancel = () => {
    cancelRef.current = true;
    stop();
  };

  if (value) {
    return (
      <div className="flex items-center gap-3 flex-wrap bg-ink/5 rounded-sm p-2 pr-3">
        <audio controls src={value.url} preload="metadata" className="h-9 max-w-full" />
        <span className="text-xs text-ink/60">{clock(value.seconds)}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          aria-label="Remove voice message"
          className="ml-auto text-ink/60 hover:text-heart transition-colors disabled:opacity-40"
        >
          <Trash2 size={16} />
        </button>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-3 bg-heart/10 rounded-sm px-3 py-2">
        <span className="relative flex h-3 w-3" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-heart opacity-60" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-heart" />
        </span>
        <span className="tabular-nums">
          {clock(seconds)} <span className="text-ink/50">/ {clock(MAX_VOICE_SECONDS)}</span>
        </span>
        <button
          type="button"
          onClick={stop}
          className="ml-auto flex items-center gap-2 bg-heart text-paper px-3 py-1.5 rounded-sm hover:bg-red-900 transition-colors"
        >
          <Square size={14} className="fill-current" /> Stop
        </button>
        <button type="button" onClick={cancel} className="text-ink/60 hover:text-ink underline">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled}
      className="flex items-center gap-2 px-3 py-1.5 border border-ink/20 rounded-sm hover:border-heart hover:text-heart transition-colors disabled:opacity-40 disabled:hover:border-ink/20 disabled:hover:text-ink"
    >
      <Mic size={16} /> Record voice message
    </button>
  );
}