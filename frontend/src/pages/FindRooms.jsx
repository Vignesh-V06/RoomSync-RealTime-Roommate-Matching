import { useEffect, useMemo, useState } from 'react';
import {
  FiArrowRight, FiCheck, FiHome, FiRefreshCw, FiSearch,
  FiSliders, FiUsers, FiX
} from 'react-icons/fi';
import api from '../api';

const readUserId = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')?.id;
  } catch {
    return null;
  }
};

const getScore = (room) => {
  const score = Number(room.compatibility_score);
  return Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;
};

const FindRooms = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [blockFilter, setBlockFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('match');
  const [refreshKey, setRefreshKey] = useState(0);
  const [applyingRoomId, setApplyingRoomId] = useState(null);
  const [appliedRoomIds, setAppliedRoomIds] = useState(() => new Set());
  const [feedback, setFeedback] = useState({ roomId: null, message: '', type: '' });
  const [previewRoom, setPreviewRoom] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [activeApplication, setActiveApplication] = useState(false);
  const [ownsRoom, setOwnsRoom] = useState(false);
  const userId = readUserId();

  useEffect(() => {
    let active = true;

    const fetchRooms = async () => {
      setLoading(true);
      setError('');
      try {
        if (!userId) {
          throw new Error('Your session could not be read. Please sign in again.');
        }
        const [roomsResult, applicationsResult, ownerAnalyticsResult] = await Promise.allSettled([
          api.get('/rooms/vacant/' + userId),
          api.get('/rooms/my-applications'),
          api.get('/rooms/owner/analytics')
        ]);

        if (roomsResult.status === 'rejected') throw roomsResult.reason;
        if (ownerAnalyticsResult.status === 'fulfilled' && active) setOwnsRoom(Boolean(ownerAnalyticsResult.value.data?.room));

        const roomData = roomsResult.value.data;
        if (active) setRooms(Array.isArray(roomData) ? roomData : []);

        if (active && applicationsResult.status === 'fulfilled') {
          const existingApplications = Array.isArray(applicationsResult.value.data)
            ? applicationsResult.value.data
            : [];
          setAppliedRoomIds(new Set(existingApplications.map((application) => application.room_id)));
          setActiveApplication(existingApplications.some((application) => ['applied', 'accepted'].includes(application.status)));
        }
      } catch (err) {
        if (active) {
          const message = err.response?.data?.message
            || err.message
            || 'Rooms could not be loaded. Please try again.';
          setError(String(message));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchRooms();
    return () => { active = false; };
  }, [userId, refreshKey]);

  const blocks = useMemo(
    () => [...new Set(rooms.map((room) => room.block).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rooms]
  );

  const roomTypes = useMemo(
    () => [...new Set(rooms.map((room) => room.room_type).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rooms]
  );

  const visibleRooms = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = rooms.filter((room) => {
      const searchable = [room.block, room.room_type, room.owner_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return (!normalizedQuery || searchable.includes(normalizedQuery))
        && (blockFilter === 'all' || room.block === blockFilter)
        && (typeFilter === 'all' || room.room_type === typeFilter);
    });

    return filtered.sort((a, b) => {
      if (sortOrder === 'match') return getScore(b) - getScore(a);
      if (sortOrder === 'match-low') return getScore(a) - getScore(b);
      if (sortOrder === 'occupancy') return Number(a.current_occupancy || 0) - Number(b.current_occupancy || 0);
      return String(a.block || '').localeCompare(String(b.block || ''));
    });
  }, [rooms, query, blockFilter, typeFilter, sortOrder]);

  const clearFilters = () => {
    setQuery('');
    setBlockFilter('all');
    setTypeFilter('all');
    setSortOrder('match');
  };

  const hasActiveFilters = Boolean(query.trim()) || blockFilter !== 'all' || typeFilter !== 'all' || sortOrder !== 'match';

  const handlePreview = async (roomId) => {
    setPreviewLoading(true);
    setPreviewRoom(null);
    try {
      const { data } = await api.get('/rooms/' + roomId + '/preview');
      setPreviewRoom(data);
    } catch (err) {
      setFeedback({ roomId, message: err.response?.data?.message || 'Room details could not be loaded.', type: 'error' });
    } finally { setPreviewLoading(false); }
  };

  const handleApply = async (roomId) => {
    setApplyingRoomId(roomId);
    setFeedback({ roomId: null, message: '', type: '' });
    try {
      await api.post('/rooms/apply', { room_id: roomId });
      setAppliedRoomIds((previous) => new Set(previous).add(roomId));
      setFeedback({ roomId, message: 'Application sent. You can track its status in your profile.', type: 'success' });
    } catch (err) {
      const message = err.response?.data?.message || 'Your application could not be sent. Please try again.';
      if (message.toLowerCase().includes('already applied')) {
        setAppliedRoomIds((previous) => new Set(previous).add(roomId));
      }
      setFeedback({ roomId, message, type: 'error' });
    } finally {
      setApplyingRoomId(null);
    }
  };

  if (loading) {
    return (
      <div className="find-rooms-page">
        <div className="discover-container">
          <div className="discover-heading">
            <div className="discover-skeleton-line discover-skeleton-title" />
            <div className="discover-skeleton-line discover-skeleton-subtitle" />
          </div>
          <div className="discover-skeleton-toolbar" />
          <div className="room-card-grid">
            {[1, 2, 3].map((item) => <div className="room-card-skeleton" key={item} />)}
          </div>
          <p className="discover-loading-label">Finding rooms that fit your lifestyle…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="find-rooms-page">
        <div className="discover-container">
          <div className="discover-error-state">
            <div className="discover-state-icon"><FiHome /></div>
            <h1>Rooms could not be loaded</h1>
            <p>{error}</p>
            <button type="button" className="btn-primary" onClick={() => setRefreshKey((value) => value + 1)}>
              <FiRefreshCw /> Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="find-rooms-page">
      <div className="discover-container">
        <section className="discover-heading">
          <div>
            <span className="discover-eyebrow"><span /> ROOM DISCOVERY</span>
            <h1>Find your next room.</h1>
            <p>Compare available spaces and see how well the living preferences align.</p>
          </div>
          <div className="discover-result-count" aria-live="polite">
            <strong>{visibleRooms.length}</strong>
            <span>{visibleRooms.length === 1 ? 'room to explore' : 'rooms to explore'}</span>
          </div>
        </section>

        <section className="discover-toolbar" aria-label="Search and filter rooms">
          <div className="discover-search-control">
            <label htmlFor="room-search">Search rooms</label>
            <div className="discover-control-wrap">
              <FiSearch aria-hidden="true" />
              <input
                id="room-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by block, room type or owner"
              />
              {query && (
                <button type="button" className="discover-clear-search" aria-label="Clear search" onClick={() => setQuery('')}>
                  <FiX />
                </button>
              )}
            </div>
          </div>

          <div className="discover-select-control">
            <label htmlFor="block-filter">Hostel block</label>
            <select id="block-filter" value={blockFilter} onChange={(event) => setBlockFilter(event.target.value)}>
              <option value="all">All blocks</option>
              {blocks.map((block) => <option key={block} value={block}>{block}</option>)}
            </select>
          </div>

          <div className="discover-select-control">
            <label htmlFor="type-filter">Room type</label>
            <select id="type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">All sharing types</option>
              {roomTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>

          <div className="discover-select-control discover-sort-control">
            <label htmlFor="room-sort"><FiSliders aria-hidden="true" /> Sort by</label>
            <select id="room-sort" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
              <option value="match">Best match</option>
              <option value="match-low">Lowest match</option>
              <option value="occupancy">More space</option>
              <option value="block">Block name</option>
            </select>
          </div>
        </section>

        <div className="discover-section-heading">
          <div>
            <h2>{hasActiveFilters ? 'Matching your filters' : 'Recommended for you'}</h2>
            <p>Compatibility is based on the lifestyle details in your profile.</p>
          </div>
          {hasActiveFilters && (
            <button type="button" className="discover-reset-button" onClick={clearFilters}>Clear filters</button>
          )}
        </div>

        {rooms.length === 0 ? (
          <div className="discover-empty-state">
            <div className="discover-state-icon"><FiHome /></div>
            <h2>No vacant rooms right now</h2>
            <p>There aren't any available rooms to show at the moment. Check again a little later.</p>
            <button type="button" className="btn-secondary" onClick={() => setRefreshKey((value) => value + 1)}>
              <FiRefreshCw /> Refresh rooms
            </button>
          </div>
        ) : visibleRooms.length === 0 ? (
          <div className="discover-empty-state">
            <div className="discover-state-icon"><FiSearch /></div>
            <h2>No rooms match those filters</h2>
            <p>Try a different block, room type or search term.</p>
            <button type="button" className="btn-secondary" onClick={clearFilters}>Clear filters</button>
          </div>
        ) : (
          <div className="room-card-grid">
            {visibleRooms.map((room) => {
              const score = getScore(room);
              const matches = Array.isArray(room.compatibility_matches) ? room.compatibility_matches : [];
              const isApplied = appliedRoomIds.has(room.room_id);
              const isApplying = applyingRoomId === room.room_id;
              const roomFeedback = feedback.roomId === room.room_id ? feedback : null;
              const occupancy = Number(room.current_occupancy || 0);
              const capacity = Number(room.total_capacity || 0);
              const available = Math.max(0, capacity - occupancy);

              return (
                <article className="room-card" key={room.room_id}>
                  <div className="room-card-banner">
                    <div className="room-card-banner-icon"><FiHome /></div>
                    <div className="room-card-score">
                      <strong>{score}%</strong>
                      <span>match</span>
                    </div>
                  </div>

                  <div className="room-card-content">
                    <div className="room-card-title-row">
                      <div>
                        <span className="room-card-kicker">AVAILABLE ROOM</span>
                        <button type="button" className="room-card-title-button" onClick={() => handlePreview(room.room_id)}>{room.block || 'Room listing'}</button>
                      </div>
                      <span className="room-type-chip">{room.room_type || 'Room'}</span>
                    </div>

                    <div className="room-card-owner">
                      <span className="room-owner-avatar">{(room.owner_name || 'O').charAt(0).toUpperCase()}</span>
                      <span><small>Room owner</small><strong>{room.owner_name || 'Room owner'}</strong></span>
                    </div>

                    <div className="room-card-occupancy">
                      <div><span>Current occupancy</span><strong>{occupancy} of {capacity || '—'}</strong></div>
                      <div><span>Spaces available</span><strong>{available}</strong></div>
                    </div>

                    <div className="room-card-compatibility">
                      <div className="room-card-compatibility-heading">
                        <span>Lifestyle compatibility</span>
                        <strong>{score}%</strong>
                      </div>
                      <div className="room-score-track" role="progressbar" aria-label="Lifestyle compatibility" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
                        <span style={{ width: score + '%' }} />
                      </div>
                    </div>

                    <div className="room-card-matches">
                      <span className="room-card-section-label">Shared preferences</span>
                      {matches.length > 0 ? (
                        <div className="room-match-tags">
                          {matches.map((match) => (
                            <span className="room-match-tag" key={match}><FiCheck /> {match}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="room-no-matches">No shared preferences are listed for this match yet.</p>
                      )}
                    </div>

                    {room.additional_requirements && (
                      <div className="room-card-notes">
                        <span className="room-card-section-label">Room notes</span>
                        <p>{room.additional_requirements}</p>
                      </div>
                    )}
                  </div>

                  <div className="room-card-actions">
                    <button type="button" className="room-view-details-button" onClick={() => handlePreview(room.room_id)}>View room details <FiArrowRight /></button>
                    {roomFeedback && (
                      <p className={'room-apply-feedback ' + (roomFeedback.type === 'success' ? 'feedback-success' : 'feedback-error')} role="status">
                        {roomFeedback.message}
                      </p>
                    )}
                    <button
                      type="button"
                      className={'room-apply-button' + (isApplied ? ' room-apply-button-done' : '')}
                      onClick={() => handleApply(room.room_id)}
                      disabled={isApplying || isApplied || available <= 0 || activeApplication || ownsRoom}
                    >
                      {isApplying ? 'Sending application…' : isApplied ? 'Application sent' : available <= 0 ? 'Room is full' : ownsRoom ? 'Already a room owner' : activeApplication ? 'One active application allowed' : 'Apply for room'}
                      {!isApplying && !isApplied && available > 0 && <FiArrowRight />}
                      {isApplied && <FiCheck />}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {previewLoading && <div className="room-preview-loading" role="status">Loading room details…</div>}
        {previewRoom && (
          <div className="room-preview-backdrop" role="presentation" onClick={() => setPreviewRoom(null)}>
            <section className="room-preview-modal" role="dialog" aria-modal="true" aria-label="Room details" onClick={(event) => event.stopPropagation()}>
              <header className="room-preview-modal-header">
                <div><span className="section-kicker">ROOM DETAILS</span><h2>{previewRoom.room.block} · {previewRoom.room.room_type}</h2><p>Hosted by {previewRoom.room.owner_name}</p></div>
                <button type="button" aria-label="Close room details" onClick={() => setPreviewRoom(null)}><FiX /></button>
              </header>
              <div className="room-preview-modal-body">
                {(previewRoom.images || []).length > 0 ? <div className="room-preview-gallery">{previewRoom.images.map((photo) => <img key={photo.id} src={(api.defaults.baseURL || '/api') + '/rooms/' + previewRoom.room.room_id + '/images/' + photo.id} alt={photo.original_name || 'Room photo'} />)}</div> : <div className="room-preview-no-image"><FiHome /><span>No room photos uploaded yet</span></div>}
                <div className="room-preview-detail-grid">
                  <div><span>Bed type</span><strong>{previewRoom.room.bed_type || 'Not specified'}</strong></div>
                  <div><span>Occupancy</span><strong>{previewRoom.room.current_occupancy} / {previewRoom.room.total_capacity}</strong></div>
                  <div><span>Availability</span><strong>{Math.max(0, Number(previewRoom.room.total_capacity) - Number(previewRoom.room.current_occupancy))} spaces</strong></div>
                  <div><span>Owner username</span><strong>@{previewRoom.room.owner_username || 'room owner'}</strong></div>
                </div>
                {previewRoom.room.additional_requirements && <div className="room-preview-notes"><h3>Room notes</h3><p>{previewRoom.room.additional_requirements}</p></div>}
                {(previewRoom.room.custom_options || []).length > 0 && <div className="room-preview-notes"><h3>Owner-defined match preferences</h3>{previewRoom.room.custom_options.map((option) => <div className="room-preview-custom-option" key={option.key}><strong>{option.label}</strong><span>{option.value}</span></div>)}</div>}
              </div>
              <footer className="room-preview-modal-footer">
                <span>Compatibility: <strong>{Number(previewRoom.room.compatibility_score || 0)}%</strong></span>
                <button type="button" className="btn-primary" onClick={() => { const id = previewRoom.room.room_id; setPreviewRoom(null); handleApply(id); }} disabled={activeApplication || ownsRoom}>Apply for this room <FiArrowRight /></button>
              </footer>
            </section>
          </div>
        )}
        <div className="discover-footnote">
          <FiUsers aria-hidden="true" />
          <p>Compatibility helps you compare preferences. Take time to talk with a potential roommate and decide what works for you.</p>
        </div>
      </div>
    </div>
  );
};

export default FindRooms;
