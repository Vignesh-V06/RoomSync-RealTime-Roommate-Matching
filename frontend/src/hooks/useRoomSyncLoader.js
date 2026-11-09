import { useEffect, useRef, useState } from 'react';

const CYCLE_MS = 2450;

const useRoomSyncLoader = (isLoading) => {
  const [visible, setVisible] = useState(Boolean(isLoading));
  const cycleStartedAt = useRef(null);
  const wasLoading = useRef(false);

  useEffect(() => {
    let finishTimer;

    if (isLoading) {
      if (!wasLoading.current) cycleStartedAt.current = Date.now();
      setVisible(true);
    } else if (wasLoading.current && visible) {
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const duration = reducedMotion ? 180 : CYCLE_MS;
      const elapsed = Date.now() - (cycleStartedAt.current ?? Date.now());
      const remaining = reducedMotion ? duration : duration - (elapsed % duration);
      finishTimer = window.setTimeout(() => setVisible(false), remaining);
    }

    wasLoading.current = Boolean(isLoading);
    return () => window.clearTimeout(finishTimer);
  }, [isLoading, visible]);

  return visible;
};

export default useRoomSyncLoader;
