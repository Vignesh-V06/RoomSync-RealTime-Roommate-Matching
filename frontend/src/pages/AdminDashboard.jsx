import { useEffect, useState } from 'react';
import { FiActivity, FiCheckCircle, FiEye, FiHome, FiMessageCircle, FiRefreshCw, FiUsers } from 'react-icons/fi';
import api from '../api';

const Metric = ({ label, value, caption, icon: Icon }) => (
  <article className="admin-metric-card">
    <span className="admin-metric-icon"><Icon /></span>
    <span className="admin-metric-label">{label}</span>
    <strong>{Number(value || 0).toLocaleString()}</strong>
    <small>{caption}</small>
  </article>
);

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/admin/analytics');
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Admin analytics could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="admin-page"><div className="admin-container admin-loading">Loading platform analytics…</div></div>;
  if (error) return <div className="admin-page"><div className="admin-container"><div className="admin-error"><h1>Analytics unavailable</h1><p>{error}</p><button type="button" className="btn-primary" onClick={load}><FiRefreshCw /> Try again</button></div></div></div>;

  const users = data.users || {};
  const rooms = data.rooms || {};
  const apps = data.applications || {};
  const engagement = data.engagement || {};
  const maxSignup = Math.max(1, ...(data.signups_last_7_days || []).map((item) => Number(item.signups || 0)));

  return (
    <div className="admin-page">
      <div className="admin-container">
        <header className="admin-heading">
          <div><span className="discover-eyebrow"><span /> PLATFORM OVERVIEW</span><h1>Admin analytics</h1><p>RoomSync platform activity, listing health and engagement at a glance.</p></div>
          <button type="button" className="owner-refresh-button" onClick={load}><FiRefreshCw /> Refresh data</button>
        </header>
        <section className="admin-section">
          <h2>Accounts & engagement</h2>
          <div className="admin-metric-grid">
            <Metric label="Total student accounts" value={users.total_users} caption={users.new_users_30d + ' new in 30 days'} icon={FiUsers} />
            <Metric label="Active accounts" value={users.active_users_30d} caption="Logged in during last 30 days" icon={FiActivity} />
            <Metric label="Unique room visitors" value={engagement.unique_room_visitors} caption={engagement.room_impressions + ' detail impressions'} icon={FiEye} />
            <Metric label="Chat messages" value={engagement.total_messages} caption="Messages sent across rooms" icon={FiMessageCircle} />
          </div>
        </section>
        <section className="admin-section">
          <h2>Marketplace health</h2>
          <div className="admin-metric-grid">
            <Metric label="Total rooms" value={rooms.total_rooms} caption={rooms.open_rooms + ' open · ' + rooms.closed_rooms + ' closed'} icon={FiHome} />
            <Metric label="Full rooms" value={rooms.full_rooms} caption="Listings at capacity" icon={FiCheckCircle} />
            <Metric label="Applications" value={apps.total_applications} caption={apps.pending_applications + ' waiting for review'} icon={FiUsers} />
            <Metric label="Room photos" value={engagement.room_photos} caption="Photos added by owners" icon={FiEye} />
          </div>
        </section>
        <div className="admin-content-grid">
          <section className="admin-panel">
            <div className="admin-panel-heading"><div><span className="section-kicker">GROWTH</span><h2>Sign-ups · 7 days</h2></div></div>
            <div className="admin-signup-chart">
              {(data.signups_last_7_days || []).map((item) => (
                <div className="admin-signup-bar-wrap" key={String(item.day)}>
                  <strong>{item.signups}</strong>
                  <div className="admin-signup-bar"><span style={{ height: Math.max(5, (Number(item.signups) / maxSignup) * 100) + '%' }} /></div>
                  <small>{new Date(item.day).toLocaleDateString(undefined, { weekday: 'short' })}</small>
                </div>
              ))}
              {(!data.signups_last_7_days || data.signups_last_7_days.length === 0) && <p className="admin-muted">No recent sign-ups to chart.</p>}
            </div>
          </section>
          <section className="admin-panel">
            <div className="admin-panel-heading"><div><span className="section-kicker">APPLICATION OUTCOMES</span><h2>Decision breakdown</h2></div></div>
            <div className="admin-outcome-list">
              <div><span>Pending</span><strong>{apps.pending_applications || 0}</strong></div>
              <div><span>Accepted</span><strong>{apps.accepted_applications || 0}</strong></div>
              <div><span>Rejected</span><strong>{apps.rejected_applications || 0}</strong></div>
            </div>
          </section>
        </div>
        <section className="admin-panel admin-table-panel">
          <div className="admin-panel-heading"><div><span className="section-kicker">DISCOVERY</span><h2>Top-performing rooms</h2></div></div>
          <div className="admin-table-scroll">
            <table className="admin-table"><thead><tr><th>Room</th><th>Owner</th><th>Status</th><th>Visitors</th><th>Applications</th><th>Score</th></tr></thead>
              <tbody>{(data.top_rooms || []).map((room) => <tr key={room.room_id}><td>{room.block} · {room.room_type}</td><td>{room.owner_name}</td><td><span className={'room-status-pill ' + (room.status === 'open' ? 'room-status-open' : 'room-status-closed')}>{room.status}</span></td><td>{room.unique_visitors}</td><td>{room.applications}</td><td>{room.rank_score}</td></tr>)}
              {(!data.top_rooms || !data.top_rooms.length) && <tr><td colSpan="6">No room activity recorded yet.</td></tr>}</tbody>
            </table>
          </div>
        </section>
        <section className="admin-bottom-grid">
          <div className="admin-panel"><span className="section-kicker">POPULAR LOCATIONS</span><h2>Rooms by block</h2>{(data.blocks || []).map((block) => <div className="admin-block-row" key={block.block}><span>{block.block}</span><strong>{block.room_count}</strong></div>)}</div>
          <div className="admin-panel admin-note-panel"><FiActivity /><h2>Platform health signals</h2><p>These indicators summarize sign-ups, active accounts, room discovery, applications, messaging and photo uploads. They are operational overview metrics, not financial or security audit reports.</p></div>
        </section>
        <p className="admin-generated-at">Last refreshed: {data.generated_at ? new Date(data.generated_at).toLocaleString() : '—'}</p>
      </div>
    </div>
  );
};

export default AdminDashboard;
