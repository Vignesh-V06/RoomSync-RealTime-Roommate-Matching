import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiArrowRight, FiCheck, FiMail, FiRefreshCw,
  FiUsers, FiX
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../api';

const readUserId = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}')?.id;
  } catch {
    return null;
  }
};

const detailItems = [
  ['Language', 'language'],
  ['Branch', 'branch'],
  ['CGPA range', 'cgpa_range'],
  ['Sleep routine', 'sleep_pref'],
  ['Study environment', 'study_pref'],
  ['Food preference', 'food_pref'],
  ['Cleanliness', 'cleanliness']
];

const OwnerDashboard = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [actingRequestId, setActingRequestId] = useState(null);
  const userId = readUserId();

  const fetchRequests = useCallback(async () => {
    if (!userId) {
      setError('Your session could not be read. Please sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/rooms/requests/' + userId);
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'We could not load your applications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests, refreshKey]);

  const handleAction = async (requestId, action) => {
    setActingRequestId(requestId);
    try {
      await api.post('/rooms/requests/' + action, { request_id: requestId });
      setRequests((previous) => previous.filter((item) => item.request_id !== requestId));
      toast.success(action === 'accept' ? 'Application accepted.' : 'Application declined.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'The application could not be updated.');
    } finally {
      setActingRequestId(null);
    }
  };

  const applicantCount = requests.length;

  if (loading) {
    return (
      <div className="owner-page">
        <div className="owner-container">
          <div className="owner-skeleton-heading" />
          <div className="owner-skeleton-card" />
          <div className="owner-skeleton-card" />
        </div>
      </div>
    );
  }

  return (
    <div className="owner-page">
      <div className="owner-container">
        <section className="owner-heading">
          <div>
            <span className="discover-eyebrow"><span /> ROOM MANAGEMENT</span>
            <h1>Owner dashboard</h1>
            <p>Review the students who would like to join your room.</p>
          </div>
          <div className="owner-heading-actions">
            <div className="owner-request-count"><strong>{applicantCount}</strong><span>pending {applicantCount === 1 ? 'application' : 'applications'}</span></div>
            <Link to="/create-room" className="btn-primary owner-create-link">List a room <FiArrowRight /></Link>
          </div>
        </section>

        {error ? (
          <div className="owner-state-card">
            <h2>Applications are unavailable</h2>
            <p>{error}</p>
            <button type="button" className="btn-primary" onClick={() => setRefreshKey((value) => value + 1)}><FiRefreshCw /> Try again</button>
          </div>
        ) : requests.length === 0 ? (
          <div className="owner-state-card">
            <span className="owner-empty-icon"><FiUsers /></span>
            <h2>No pending applications</h2>
            <p>When a student applies to one of your rooms, their profile and request will appear here.</p>
            <Link to="/create-room" className="btn-primary">List a room <FiArrowRight /></Link>
          </div>
        ) : (
          <div className="owner-application-list">
            <div className="owner-list-heading">
              <div><h2>Incoming applications</h2><p>Review preferences before deciding.</p></div>
              <button type="button" className="owner-refresh-button" onClick={() => setRefreshKey((value) => value + 1)}><FiRefreshCw /> Refresh</button>
            </div>

            {requests.map((request) => {
              const isActing = actingRequestId === request.request_id;
              return (
                <article className="owner-application-card" key={request.request_id}>
                  <div className="owner-applicant-panel">
                    <div className="owner-applicant-avatar">{(request.applicant_name || 'S').charAt(0).toUpperCase()}</div>
                    <span className="owner-applicant-label">STUDENT APPLICATION</span>
                    <h3>{request.applicant_name || 'Student'}</h3>
                    <a className="owner-applicant-email" href={'mailto:' + request.applicant_email}><FiMail /> {request.applicant_email || 'Email not available'}</a>
                    <div className="owner-room-applied">
                      <span>Applied for</span>
                      <strong>{request.block || 'Room'} · {request.room_type || 'Sharing type'}</strong>
                    </div>
                    <Link to="/chat" className="owner-chat-link">Open messages <FiArrowRight /></Link>
                  </div>

                  <div className="owner-applicant-details">
                    <div className="owner-details-heading"><div><span className="section-kicker">LIFESTYLE PROFILE</span><h4>Get to know your potential roommate</h4></div></div>
                    <div className="owner-details-grid">
                      {detailItems.map(([label, key]) => (
                        <div className="owner-detail-item" key={key}>
                          <span>{label}</span>
                          <strong>{request[key] || 'Not provided'}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="owner-application-actions">
                      <button
                        type="button"
                        className="owner-accept-button"
                        onClick={() => handleAction(request.request_id, 'accept')}
                        disabled={isActing}
                      >
                        <FiCheck /> {isActing ? 'Updating…' : 'Accept application'}
                      </button>
                      <button
                        type="button"
                        className="owner-reject-button"
                        onClick={() => handleAction(request.request_id, 'reject')}
                        disabled={isActing}
                      >
                        <FiX /> Decline
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerDashboard;
