import { useState, useEffect, useRef } from 'react';

export const useTypingAnimation = (text, speed = 30, startAnimation = true) => {
  const [displayText, setDisplayText] = useState('');
  const [isDone, setIsDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!startAnimation) {
      setDisplayText(text);
      setIsDone(true);
      return;
    }

    setDisplayText('');
    setIsDone(false);
    indexRef.current = 0;

    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayText((prev) => prev + text.charAt(indexRef.current));
        indexRef.current += 1;
      } else {
        clearInterval(interval);
        setIsDone(true);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, startAnimation]);

  const skip = () => {
    setDisplayText(text);
    setIsDone(true);
  };

  return { displayText, isDone, skip };
};
