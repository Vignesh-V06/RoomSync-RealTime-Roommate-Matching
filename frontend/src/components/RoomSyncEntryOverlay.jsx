import { useEffect } from 'react';
import RoomSyncLoader from './RoomSyncLoader';

const RoomSyncEntryOverlay = ({ onComplete }) => {
  useEffect(() => {
    const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const timer = window.setTimeout(onComplete, reducedMotion ? 650 : 2350);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return <RoomSyncLoader />;
};

export default RoomSyncEntryOverlay;
