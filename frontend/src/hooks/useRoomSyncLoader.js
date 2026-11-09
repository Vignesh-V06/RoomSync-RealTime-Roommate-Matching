import { useEffect, useRef, useState } from 'react';

const CYCLE_MS = 2450;

const useRoomSyncLoader = (isLoading) => {
  const [cycleComplete, setCycleComplete] = useState(false);
  const cycleStartedAt = useRef(null);

  useEffect(() => {
    let finishTimer;

    if (isLoading && cycleStartedAt.current === null) {
      cycleStartedAt.current = Date.now();
    }

    if (!isLoading && cycleStartedAt.current !== null && !cycleComplete) {
      const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
      const duration = reducedMotion ? 180 : CYCLE_MS;
      const elapsed = Date.now() - cycleStartedAt.current;
      const remaining = reducedMotion ? duration : duration - (elapsed % duration);
      finishTimer = window.setTimeout(() => setCycleComplete(true), remaining);
    }

    return () => window.clearTimeout(finishTimer);
  }, [isLoading, cycleComplete]);

  return Boolean(isLoading || (cycleStartedAt.current !== null && !cycleComplete));
};

export default useRoomSyncLoader;
