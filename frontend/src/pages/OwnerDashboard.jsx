import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiCheck, FiEye, FiHome, FiMail, FiRefreshCw, FiUsers, FiUserMinus, FiTrash2, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../api';

const API_VERSION = 'roomsync-owner-room-management-2';

const detailItems = [
  ['Language', 'language'], ['Branch', 'branch'], ['CGPA range', 'cgpa_range'],
  ['Sleep routine', 'sleep_pref'], ['Study environment', 'study_pref'],
  ['Food preference', 'food_pref'], ['Cleanliness', 'cleanliness'], ['Bed preference', 'bed_pref']
];

const Stat = ({ label, value, detail, icon }) => (
  <article className="analytics-stat">
    <span className="analytics-stat-icon">{icon}</span>
    <span className="analytics-stat-label">{label}</span>
    <strong>{value ?? '—'}</strong>
    <small>{detail}</small>
  </article>
);

const OwnerDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [members, setMembers] = useState([]);
  const [roomNumberDraft, setRoomNumberDraft] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [actingRequestId, setActingRequestId] = useState(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [savingRoomNumber, setSavingRoomNumber] = useState(false);
  const [deletingRoom, setDeletingRoom] = useState(false);
  const [backendOutdated, setBackendOutdated] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [analyticsResult, healthResult] = await Promise.all([
        api.get('/rooms/owner/analytics'),
        api.get('/health').catch(() => null)
      ]);
      const nextAnalytics = analyticsResult.data || null;
      const ownerId = nextAnalytics?.room?.owner_id;

      // Send the actual numeric owner ID in the parameterized route. Older API
      // builds use req.params.ownerId; newer builds independently verify req.user.id.
      // Both are compatible with this request and it avoids the old "/current" mismatch.
      const requestResult = ownerId
        ? await api.get('/rooms/requests/' + encodeURIComponent(ownerId))
        : { data: [] };
      const requestData = Array.isArray(requestResult.data) ? requestResult.data : [];
      const memberData = requestData.filter((request) => request.status === 'accepted');
      setBackendOutdated(healthResult?.data?.apiVersion !== API_VERSION);

      setRequests(requestData);
      setMembers(memberData);
      setAnalytics(nextAnalytics);
      setRoomNumberDraft(nextAnalytics?.room?.room_number || '');
    } catch (err) {
      setError(err.response?.data?.message || 'We could not load your room dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard, refreshKey]);

  const handleAction = async (requestId, action) => {
    setActingRequestId(requestId);
    try {
      await api.post('/rooms/requests/' + action, { request_id: requestId });
      toast.success(action === 'accept' ? 'Application accepted.' : 'Application declined.');
      setRefreshKey((value) => value + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'The application could not be updated.');
    } finally {
      setActingRequestId(null);
    }
  };

  const handleRemoveRoommate = async (member) => {
    const roommateName = member.applicant_name || 'this roommate';
    const roomLabel = (room?.block || 'your room') + (room?.room_number ? ' · Room ' + room.room_number : '');
    const confirmed = window.confirm(
      `Remove ${roommateName} from ${roomLabel}? Their room access will end and their bed will become available.`
    );
    if (!confirmed) return;

    const memberKey = member.user_id || member.request_id;
    setActingRequestId(memberKey);
    try {
      await api.post('/rooms/requests/remove', { request_id: member.request_id });
      toast.success('Roommate removed. Their bed is available again.');
      setRefreshKey((value) => value + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'The roommate could not be removed.');
    } finally {
      setActingRequestId(null);
    }
  };

  const handleSaveRoomNumber = async () => {
    if (!room?.room_id) return;
    const roomNumber = roomNumberDraft.trim();
    if (!roomNumber || roomNumber.length > 20) {
      toast.error('Enter a room number up to 20 characters.');
      return;
    }
    setSavingRoomNumber(true);
    try {
      await api.patch('/rooms/' + room.room_id + '/room-number', { room_number: roomNumber });
      toast.success('Room number updated.');
      setRefreshKey((value) => value + 1);
    } catch (err) {
      const serverMessage = err.response?.data?.message;
      const isMissingRoute = err.response?.status === 404 && !serverMessage;
      toast.error(
        isMissingRoute
          ? 'The API server on port 5000 is outdated. Restart the RoomSync backend from the latest branch.'
          : serverMessage || 'Room number could not be updated.'
      );
    } finally {
      setSavingRoomNumber(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!room?.room_id) return;
    const roomLabel = room.block + (room.room_number ? ' · Room ' + room.room_number : '');
    const confirmed = window.confirm(
      `Permanently delete ${roomLabel}? This removes the listing, its photos and chat history, cancels pending applications, and ends all current memberships. Student accounts will not be deleted.`
    );
    if (!confirmed) return;

    setDeletingRoom(true);
    try {
      await api.delete('/rooms/' + room.room_id);
      toast.success('Room listing deleted. Current members and applicants have been notified.');
      setRefreshKey((value) => value + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'The room could not be deleted.');
    } finally {
      setDeletingRoom(false);
    }
  };

  const toggleRoomStatus = async () => {
    if (!analytics?.room) return;
    setChangingStatus(true);
    try {
      const nextStatus = analytics.room.status === 'open' ? 'closed' : 'open';
      await api.patch('/rooms/' + analytics.room.room_id + '/status', { status: nextStatus });
      toast.success(nextStatus === 'open' ? 'Your room is now open.' : 'Your room is now closed.');
      setRefreshKey((value) => value + 1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Room status could not be changed.');
    } finally {
      setChangingStatus(false);
    }
  };

  if (loading) return <div className="owner-page"><div className="owner-container"><div className="owner-skeleton-heading" /><div className="owner-skeleton-card" /><div className="owner-skeleton-card" /></div></div>;

  const room = analytics?.room;
  const isOpen = room?.status === 'open';
  const isFull = Boolean(room) && Number(room.current_occupancy) >= Number(room.total_capacity);
  const pendingRequests = requests.filter((request) => request.status === 'applied');
  const joinedMembers = members;
  const expectedMemberCount = Number(room?.accepted_count || 0);
  const membershipCountMismatch = Boolean(room) && expectedMemberCount !== joinedMembers.length;

  return (
    <div className="owner-page">
      <div className="owner-container">
        <section className="owner-heading">
          <div><span className="discover-eyebrow"><span /> ROOM MANAGEMENT</span><h1>Owner dashboard</h1><p>Understand how your listing performs and manage incoming applications.</p></div>
          <button type="button" className="owner-refresh-button" onClick={() => setRefreshKey((value) => value + 1)}><FiRefreshCw /> Refresh insights</button>
        </section>

        {error && <div className="owner-form-error" role="alert">{error}</div>}
        {backendOutdated && (
          <div className="owner-member-sync-warning" role="status">
            <strong>The RoomSync API server needs updating.</strong>
            <span>This dashboard is newer than the API answering on port 5000. Stop the old backend process and restart backend/server.js from the latest project branch before editing room details.</span>
          </div>
        )}

        {!room ? (
          <div className="owner-state-card">
            <span className="owner-empty-icon"><FiHome /></span>
            <h2>You have not listed a room yet</h2>
            <p>One room listing can be managed by each account. Create your listing to start receiving compatible applications.</p>
            <Link to="/create-room" className="btn-primary">List your room <FiArrowRight /></Link>
          </div>
        ) : (
          <>
            <section className="owner-room-overview surface-card">
              <div className="owner-room-overview-copy">
                <span className="section-kicker">YOUR LISTING</span>
                <h2>{room.block} <span>Room {room.room_number || 'number not set'} · {room.room_type}</span></h2>
                <p>{room.bed_type || 'Bed details not set'} · {room.current_occupancy} of {room.total_capacity} occupants</p>
                <div className="owner-room-number-editor">
                  <label htmlFor="owner-room-number">Room number</label>
                  <div className="owner-room-number-fields">
                    <input id="owner-room-number" type="text" maxLength={20} value={roomNumberDraft} onChange={(event) => setRoomNumberDraft(event.target.value)} placeholder="e.g. 204" />
                    <button type="button" onClick={handleSaveRoomNumber} disabled={savingRoomNumber || !roomNumberDraft.trim()}>{savingRoomNumber ? 'Saving…' : 'Save number'}</button>
                  </div>
                </div>
              </div>
              <div className="owner-room-status-control">
                <span className={'room-status-pill ' + (isOpen ? 'room-status-open' : 'room-status-closed')}>{isFull ? 'Full · closed to applications' : isOpen ? 'Open to applications' : 'Closed to applications'}</span>
                <button type="button" className="btn-secondary" disabled={changingStatus || isFull || deletingRoom} onClick={toggleRoomStatus}>
                  {changingStatus ? 'Updating…' : isFull ? 'Full capacity' : isOpen ? 'Close listing' : 'Reopen listing'}
                </button>
                <button type="button" className="owner-delete-room-button" disabled={deletingRoom} onClick={handleDeleteRoom}>
                  <FiTrash2 /> {deletingRoom ? 'Deleting…' : 'Delete room'}
                </button>
              </div>
            </section>

            <section className="owner-analytics-grid" aria-label="Room performance">
              <Stat label="Unique visitors" value={Number(room.unique_visitors || 0).toLocaleString()} detail="Accounts that opened your listing" icon={<FiUsers />} />
              <Stat label="Room impressions" value={Number(room.total_views || 0).toLocaleString()} detail="Total detail views, including returns" icon={<FiEye />} />
              <Stat label="Applications" value={Number(room.application_count || 0)} detail="All applications received" icon={<FiMail />} />
              <Stat label="Accepted members" value={Number(room.accepted_count || 0)} detail="Approved applications" icon={<FiCheck />} />
            </section>

            <section className="owner-ranking-panel surface-card">
              <div><span className="section-kicker">LISTING DISCOVERY</span><h2>{analytics.rank ? 'Ranked #' + analytics.rank : 'Not currently ranked'}</h2><p>Among {analytics.total_open_rooms || 0} open RoomSync listings. Ranking is based on unique room visitors and application interest.</p></div>
              <div className="owner-ranking-number">{analytics.rank ? '#' + analytics.rank : '—'}</div>
            </section>

            <section className="owner-member-list">
              <div className="owner-list-heading">
                <div>
                  <h2>Current roommates</h2>
                  <p>{joinedMembers.length} {joinedMembers.length === 1 ? 'student has' : 'students have'} joined your room</p>
                </div>
              </div>
              {membershipCountMismatch ? (
                <div className="owner-member-sync-warning" role="status">
                  <strong>Roommate records need to be synchronized.</strong>
                  <span>Analytics reports {expectedMemberCount} accepted student accounts, but {joinedMembers.length} loaded in the current roster. Refresh the dashboard after the latest backend deployment and database migration are applied.</span>
                </div>
              ) : joinedMembers.length === 0 ? (
                <div className="owner-state-card owner-state-card-compact">
                  <span className="owner-empty-icon"><FiUsers /></span>
                  <h2>No roommates have joined yet</h2>
                  <p>Accepted students will appear here, where you can manage their room membership.</p>
                </div>
              ) : (
                <div className="owner-member-grid">
                  {joinedMembers.map((member) => {
                    const memberKey = member.user_id || member.request_id;
                    const isActing = actingRequestId === memberKey;
                    return (
                      <article className="owner-member-card" key={memberKey}>
                        <div className="owner-member-avatar">{(member.applicant_name || 'S').charAt(0).toUpperCase()}</div>
                        <div className="owner-member-copy">
                          <span className="section-kicker">JOINED ROOMMATE</span>
                          <strong>{member.applicant_name || 'Student account #' + (member.user_id || member.request_id)}</strong>
                          {member.applicant_email
                            ? <a href={'mailto:' + member.applicant_email}>{member.applicant_email}</a>
                            : <small>Account details unavailable · membership can still be removed</small>}
                          <small>{member.created_at ? 'Applied ' + new Date(member.created_at).toLocaleDateString() : 'Membership active'}</small>
                        </div>
                        <button
                          type="button"
                          className="owner-member-remove"
                          onClick={() => handleRemoveRoommate(member)}
                          disabled={isActing}
                          aria-label={'Remove ' + (member.applicant_name || 'roommate')}
                        >
                          <FiUserMinus /> {isActing ? 'Removing…' : 'Remove roommate'}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        <section className="owner-application-list">
          <div className="owner-list-heading"><div><h2>Incoming applications</h2><p>{pendingRequests.length} pending {pendingRequests.length === 1 ? 'application' : 'applications'} to review</p></div></div>
          {pendingRequests.length === 0 ? (
            <div className="owner-state-card owner-state-card-compact"><span className="owner-empty-icon"><FiUsers /></span><h2>No pending applications</h2><p>New student requests will appear here.</p></div>
          ) : pendingRequests.map((request) => {
            const isActing = actingRequestId === request.request_id;
            return (
              <article className="owner-application-card" key={request.request_id}>
                <div className="owner-applicant-panel">
                  <div className="owner-applicant-avatar">{(request.applicant_name || 'S').charAt(0).toUpperCase()}</div>
                  <span className="owner-applicant-label">STUDENT APPLICATION</span>
                  <h3>{request.applicant_name || 'Student'}</h3>
                  <a className="owner-applicant-email" href={'mailto:' + request.applicant_email}><FiMail /> {request.applicant_email || 'Email not available'}</a>
                  <div className="owner-room-applied"><span>Applied for</span><strong>{request.block} · {request.room_type}</strong></div>
                </div>
                <div className="owner-applicant-details">
                  <div className="owner-details-heading"><span className="section-kicker">LIFESTYLE PROFILE</span><h4>Potential roommate details</h4></div>
                  <div className="owner-details-grid">{detailItems.map(([label, key]) => <div className="owner-detail-item" key={key}><span>{label}</span><strong>{request[key] || 'Not provided'}</strong></div>)}</div>
                  <div className="owner-application-actions">
                    <button type="button" className="owner-accept-button" onClick={() => handleAction(request.request_id, 'accept')} disabled={isActing}><FiCheck /> {isActing ? 'Updating…' : 'Accept application'}</button>
                    <button type="button" className="owner-reject-button" onClick={() => handleAction(request.request_id, 'reject')} disabled={isActing}><FiX /> Decline</button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
};

export default OwnerDashboard;
