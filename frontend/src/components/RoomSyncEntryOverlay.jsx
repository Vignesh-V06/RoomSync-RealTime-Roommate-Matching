import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import RoomSyncLoader from './RoomSyncLoader';

const ENTRY_DURATION_MS = 2350;

const RoomSyncEntryOverlay = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const handledEntry = useRef(false);

  useEffect(() => {
    if (location.state?.roomsyncEntry !== true || handledEntry.current) return;

    handledEntry.current = true;
    setVisible(true);

    // Consume the navigation marker so refreshes and later route changes never replay it.
    navigate(
      location.pathname + location.search + location.hash,
      { replace: true, state: null }
    );

    window.setTimeout(() => setVisible(false), ENTRY_DURATION_MS);
  }, [location.key, location.pathname, location.search, location.hash, location.state, navigate]);

  return visible ? <RoomSyncLoader /> : null;
};

export default RoomSyncEntryOverlay;
