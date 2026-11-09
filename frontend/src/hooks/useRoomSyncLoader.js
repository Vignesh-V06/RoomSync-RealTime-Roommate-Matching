import { useEffect, useRef, useState } from 'react';

const CYCLE_MS = 2450;

const useRoomSyncLoader = (isLoading) => {
  const [cyclePending, setCyclePending] = useState(Boolean(isLoading));
  const cycleStartedAt = useRef(null);

  useEffect(() => {
    let finishTimer;

    if (isLoading && cycleStartedAt.current === null) {
      cycleStartedAt.current = Date.now();
    }

    if (!isLoading && cycleStartedAt.current !== null && cyclePending) {
      const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      const duration = reducedMotion ? 180 : CYCLE_MS;
      const elapsed = Date.now() - cycleStartedAt.current;
      const remaining = reducedMotion ? duration : duration - (elapsed % duration);
      finishTimer = window.setTimeout(() => setCyclePending(false), remaining);
    }

    return () => window.clearTimeout(finishTimer);
  }, [isLoading, cyclePending]);

  return Boolean(isLoading || cyclePending);
};

export default useRoomSyncLoader;
