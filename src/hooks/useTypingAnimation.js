import { useState, useEffect, useRef } from 'react';

export const useTypingAnimation = (text, speed = 30, startAnimation = true) => {
  const [displayText, setDisplayText] = useState('');
  const [isDone, setIsDone] = useState(false);
  const [runId, setRunId] = useState(0);
  const indexRef = useRef(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!startAnimation || text.length === 0) {
      setDisplayText(text);
      setIsDone(true);
      return;
    }

    setDisplayText('');
    setIsDone(false);
    indexRef.current = 0;

    intervalRef.current = setInterval(() => {
      indexRef.current += 1;
      setDisplayText(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) {
        clearInterval(intervalRef.current);
        setIsDone(true);
      }
    }, speed);

    return () => clearInterval(intervalRef.current);
  }, [text, speed, startAnimation, runId]);

  // Stop the timer too, otherwise it keeps running after the jump to the full text
  const skip = () => {
    clearInterval(intervalRef.current);
    setDisplayText(text);
    setIsDone(true);
  };

  const replay = () => setRunId((r) => r + 1);

  return { displayText, isDone, skip, replay };
};
