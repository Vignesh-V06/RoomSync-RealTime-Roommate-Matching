import { useEffect, useMemo, useState } from 'react';
import {
  FiActivity, FiCalendar, FiCheckCircle, FiDatabase, FiDownload, FiEye,
  FiFileText, FiHome, FiMessageCircle, FiRefreshCw, FiShield,
  FiUsers, FiUserCheck
} from 'react-icons/fi';
import api from '../api';
import CustomSelect from '../components/CustomSelect';

const formatNumber = (value) => Number(value || 0).toLocaleString();
const percentage = (part, total) => total ? Math.max(0, Math.min(100, Math.round((Number(part || 0) / Number(total)) * 100))) : 0;

const Metric = ({ label, value, caption, icon, detail }) => (
  <article className="admin-metric-card">
    <span className="admin-metric-icon">{icon}</span>
    <span className="admin-metric-label">{label}</span>
    <strong>{formatNumber(value)}</strong>
    <small>{caption}</small>
    {detail && <span className="admin-metric-detail">{detail}</span>}
  </article>
);

const EVENT_LABELS = {
  user_registered: 'Account registered',
  user_logged_in: 'User signed in',
  profile_created: 'Profile completed',
  profile_updated: 'Profile updated',
  room_created: 'Room listed',
  room_viewed: 'Room viewed',
  room_application_submitted: 'Application submitted',
  room_application_accepted: 'Application accepted',
  room_application_rejected: 'Application declined',
  room_status_changed: 'Room status changed',
  room_photo_uploaded: 'Room photo uploaded',
  chat_message_sent: 'Chat message sent',
  admin_report_exported: 'Admin report exported'
};

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const [range, setRange] = useState('12m');
  const [csvDataset, setCsvDataset] = useState('users');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/admin/analytics', { params: { range } });
        if (active) setData(response.data);
      } catch (err) {
        if (active) setError(err.response?.data?.message || 'Admin analytics could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [range, refreshKey]);

  const downloadReport = async (format, dataset) => {
    const key = format === 'xlsx' ? 'xlsx' : 'csv';
    setExporting(key);
    try {
      const response = await api.get('/admin/reports/export', {
        params: { format, range, ...(dataset ? { dataset } : {}) },
        responseType: 'blob'
      });
      const mimeType = format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv;charset=utf-8';
      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = format === 'xlsx'
        ? `roomsync-${range}-admin-report.xlsx`
        : `roomsync-${dataset}-${range}-report.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const message = err.response?.data?.message || 'Report export failed. Please try again.';
      // Blob responses can contain a JSON error body.
      if (err.response?.data instanceof Blob) {
        try {
          const body = JSON.parse(await err.response.data.text());
          window.alert(body.message || message);
        } catch {
          window.alert(message);
        }
      } else {
        window.alert(message);
      }
    } finally {
      setExporting('');
    }
  };

  const monthly = useMemo(() => {
    const rows = new Map();
    (data?.monthly_activity || []).forEach((item) => {
      if (!rows.has(item.period)) rows.set(item.period, {});
      rows.get(item.period)[item.metric] = Number(item.amount || 0);
    });
    return [...rows.entries()].map(([period, values]) => ({ period, ...values }));
  }, [data]);

  if (loading && !data) {
    return <div className="admin-page"><div className="admin-container admin-loading">Loading platform intelligence…</div></div>;
  }
  if (error && !data) {
    return (
      <div className="admin-page"><div className="admin-container">
        <div className="admin-error"><h1>Analytics unavailable</h1><p>{error}</p>
          <button type="button" className="btn-primary" onClick={() => setRefreshKey((value) => value + 1)}><FiRefreshCw /> Try again</button>
        </div>
      </div></div>
    );
  }

  const users = data?.users || {};
  const rooms = data?.rooms || {};
  const apps = data?.applications || {};
  const engagement = data?.engagement || {};
  const funnel = data?.funnel || {};
  const maxMonthly = Math.max(1, ...monthly.flatMap((item) => [
    item['Sign-ups'] || 0, item['Rooms created'] || 0, item.Applications || 0,
    item.Messages || 0
  ]));
  const profileRate = percentage(users.completed_profiles, users.total_users);
  const acceptanceRate = percentage(apps.accepted_applications, apps.total_applications);
  const occupancyRate = percentage(rooms.occupied_beds, rooms.total_beds);

  return (
    <div className="admin-page">
      <div className="admin-container admin-control-centre">
        <header className="admin-heading admin-heading-expanded">
          <div>
            <span className="discover-eyebrow"><span /> ROOMSYNC CONTROL CENTRE</span>
            <h1>Platform intelligence</h1>
            <p>Growth, marketplace health, user engagement and operational activity in one place.</p>
          </div>
          <div className="admin-heading-actions">
            <div className="admin-range-control">
              <label htmlFor="admin-range">Reporting period</label>
              <CustomSelect
                id="admin-range"
                ariaLabel="Reporting period"
                value={range}
                onChange={setRange}
                options={[
                  { value: '3m', label: 'Last 3 months' },
                  { value: '12m', label: 'Last 12 months' },
                  { value: 'all', label: 'All available history' }
                ]}
              />
            </div>
            <button type="button" className="owner-refresh-button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading}>
              <FiRefreshCw /> {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </header>

        {error && <div className="admin-inline-warning" role="status">{error} Showing the last successfully loaded snapshot.</div>}

        <section className="admin-export-panel">
          <div className="admin-export-copy">
            <span className="admin-export-icon"><FiShield /></span>
            <div><strong>Administrator reports</strong><p>Confidential platform datasets · generated from the selected reporting period</p></div>
          </div>
          <div className="admin-export-actions">
            <button type="button" className="admin-export-button admin-export-primary" onClick={() => downloadReport('xlsx')} disabled={Boolean(exporting)}>
              <FiDownload /> {exporting === 'xlsx' ? 'Preparing workbook…' : 'Download Excel workbook'}
            </button>
            <div className="admin-csv-export">
              <div className="admin-csv-select">
                <label htmlFor="admin-csv-dataset">CSV dataset</label>
                <CustomSelect
                  id="admin-csv-dataset"
                  ariaLabel="CSV dataset"
                  value={csvDataset}
                  onChange={setCsvDataset}
                  options={[
                    { value: 'overview', label: 'Overview' },
                    { value: 'users', label: 'Users' },
                    { value: 'rooms', label: 'Rooms' },
                    { value: 'applications', label: 'Applications' },
                    { value: 'monthly', label: 'Monthly trends' },
                    { value: 'top_rooms', label: 'Top rooms' },
                    { value: 'blocks', label: 'Hostel blocks' },
                    { value: 'activity', label: 'Activity log' }
                  ]}
                />
              </div>
              <button type="button" className="admin-export-button" onClick={() => downloadReport('csv', csvDataset)} disabled={Boolean(exporting)}>
                <FiFileText /> {exporting === 'csv' ? 'Preparing CSV…' : 'Download CSV'}
              </button>
            </div>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-heading">
            <div><span className="section-kicker">PLATFORM SNAPSHOT</span><h2>Accounts & engagement</h2></div>
            <span className="admin-period-label">{range === 'all' ? 'All available history' : range === '3m' ? 'Last 90 days' : 'Last 12 months'}</span>
          </div>
          <div className="admin-metric-grid">
            <Metric label="Student accounts" value={users.total_users} caption={formatNumber(users.users_in_range) + ' registered in selected period'} icon={<FiUsers />} detail={formatNumber(users.new_users_30d) + ' new in 30 days'} />
            <Metric label="Active accounts" value={users.active_users_30d} caption="Signed in within 30 days" icon={<FiActivity />} detail={formatNumber(engagement.tracked_logins) + ' tracked sign-ins in period'} />
            <Metric label="Profiles created" value={profileRate + '%'} caption={formatNumber(users.completed_profiles) + ' profile records'} icon={<FiUserCheck />} detail="Profiles / student accounts" />
            <Metric label="Room visitors" value={engagement.unique_room_visitors} caption={formatNumber(engagement.room_impressions) + ' tracked impressions in period'} icon={<FiEye />} detail={formatNumber(engagement.tracked_login_users) + ' users with tracked logins'} />
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-heading">
            <div><span className="section-kicker">MARKETPLACE</span><h2>Room supply & applications</h2></div>
            <span className="admin-period-label">{occupancyRate}% of listed capacity occupied</span>
          </div>
          <div className="admin-metric-grid">
            <Metric label="Room listings" value={rooms.total_rooms} caption={formatNumber(rooms.open_rooms) + ' open · ' + formatNumber(rooms.closed_rooms) + ' closed now'} icon={<FiHome />} detail={formatNumber(rooms.full_rooms) + ' currently full'} />
            <Metric label="Occupied beds" value={rooms.occupied_beds} caption={formatNumber(rooms.total_beds) + ' total listed capacity'} icon={<FiUsers />} detail={occupancyRate + '% occupancy'} />
            <Metric label="Applications" value={apps.total_applications} caption={formatNumber(apps.pending_applications) + ' waiting for review'} icon={<FiCheckCircle />} detail={acceptanceRate + '% acceptance rate'} />
            <Metric label="Chat messages" value={engagement.total_messages} caption={formatNumber(engagement.room_photos) + ' room photos uploaded'} icon={<FiMessageCircle />} detail="Messages contain no reportable content" />
          </div>
        </section>

        <div className="admin-content-grid admin-content-grid-wide">
          <section className="admin-panel">
            <div className="admin-panel-heading"><div><span className="section-kicker">GROWTH & ENGAGEMENT</span><h2>Monthly platform activity</h2><p>Counts are grouped by month; tracked login and room-view events start from event-log rollout.</p></div></div>
            {monthly.length ? (
              <div className="admin-monthly-chart">
                <div className="admin-chart-legend">
                  <span><i className="admin-legend-signup" />Sign-ups</span>
                  <span><i className="admin-legend-room" />Rooms</span>
                  <span><i className="admin-legend-application" />Applications</span>
                  <span><i className="admin-legend-message" />Messages</span>
                </div>
                <div className="admin-monthly-rows">
                  {monthly.map((item) => (
                    <div className="admin-month-row" key={item.period}>
                      <time>{new Date(item.period + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}</time>
                      <div className="admin-month-bars">
                        {[
                          ['Sign-ups', 'admin-bar-signup'],
                          ['Rooms created', 'admin-bar-room'],
                          ['Applications', 'admin-bar-application'],
                          ['Messages', 'admin-bar-message']
                        ].map(([key, className]) => (
                          <div className="admin-month-bar-track" key={key} title={key + ': ' + formatNumber(item[key])}>
                            <span className={className} style={{ width: Math.max(item[key] ? 2 : 0, (Number(item[key] || 0) / maxMonthly) * 100) + '%' }} />
                          </div>
                        ))}
                      </div>
                      <strong>{formatNumber((item['Sign-ups'] || 0) + (item['Rooms created'] || 0) + (item.Applications || 0) + (item.Messages || 0))}</strong>
                    </div>
                  ))}
                </div>
                <div className="admin-tracked-summary">
                  <span>Tracked logins <strong>{formatNumber(engagement.tracked_logins)}</strong></span>
                  <span>Tracked room views <strong>{formatNumber((data.monthly_activity || []).filter((item) => item.metric === 'Room views (tracked)').reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong></span>
                </div>
              </div>
            ) : <p className="admin-muted">No monthly activity found for this reporting period.</p>}
          </section>

          <section className="admin-panel">
            <div className="admin-panel-heading"><div><span className="section-kicker">CONVERSION FUNNEL</span><h2>From discovery to chat</h2><p>Lifetime stage counts from available platform records.</p></div></div>
            <div className="admin-funnel">
              {[
                ['Registered students', funnel.registered_users],
                ['Completed profiles', funnel.profiled_users],
                ['Viewed a room', funnel.room_viewers],
                ['Applied to a room', funnel.applications],
                ['Accepted into a room', funnel.accepted_applications],
                ['Sent a chat message', funnel.chat_participants]
              ].map(([label, value], index) => (
                <div className="admin-funnel-step" key={label}>
                  <div><span>{label}</span><strong>{formatNumber(value)}</strong></div>
                  <div className="admin-funnel-track"><span style={{ width: percentage(value, funnel.registered_users) + '%' }} /></div>
                </div>
              ))}
            </div>
            <div className="admin-funnel-footnote">Each stage is a distinct account or record count, not a guaranteed sequential user journey.</div>
          </section>
        </div>

        <section className="admin-panel admin-table-panel">
          <div className="admin-panel-heading"><div><span className="section-kicker">MARKETPLACE PERFORMANCE</span><h2>Most-engaged rooms</h2><p>Engagement score = unique visitors + applications × 3 + messages × 0.25. This is an indicative comparison, not the student compatibility score.</p></div></div>
          <div className="admin-table-scroll">
            <table className="admin-table"><thead><tr><th>Room</th><th>Owner</th><th>Status</th><th>Occupancy</th><th>Visitors</th><th>Applications</th><th>Messages</th><th>Engagement</th></tr></thead>
              <tbody>{(data.top_rooms || []).map((room) => <tr key={room.room_id}>
                <td>{room.block} · {room.room_type}</td><td>{room.owner_name}</td>
                <td><span className={'room-status-pill ' + (room.status === 'open' ? 'room-status-open' : 'room-status-closed')}>{room.status}</span></td>
                <td>{room.current_occupancy}/{room.total_capacity}</td><td>{formatNumber(room.unique_visitors)}</td>
                <td>{formatNumber(room.applications)}</td><td>{formatNumber(room.messages)}</td><td>{Number(room.engagement_score || 0).toFixed(1)}</td>
              </tr>)}
              {(!data.top_rooms || !data.top_rooms.length) && <tr><td colSpan="8">No room records found.</td></tr>}</tbody>
            </table>
          </div>
        </section>

        <div className="admin-content-grid">
          <section className="admin-panel">
            <div className="admin-panel-heading"><div><span className="section-kicker">HOSTEL DISTRIBUTION</span><h2>Rooms by block</h2></div></div>
            <div className="admin-block-list">
              {(data.block_stats || []).map((block) => (
                <div className="admin-block-item" key={block.block}>
                  <div><strong>{block.block}</strong><span>{block.room_count} rooms · {block.applications} applications</span></div>
                  <div className="admin-block-capacity"><span style={{ width: percentage(block.occupied_beds, block.total_beds) + '%' }} /></div>
                  <small>{block.occupied_beds}/{block.total_beds} beds occupied</small>
                </div>
              ))}
              {(!data.block_stats || !data.block_stats.length) && <p className="admin-muted">No room blocks have been listed yet.</p>}
            </div>
          </section>
          <section className="admin-panel">
            <div className="admin-panel-heading"><div><span className="section-kicker">ENGAGEMENT</span><h2>Most active accounts</h2><p>Based on tracked sign-in events since rollout.</p></div></div>
            <div className="admin-active-user-list">
              {(data.most_active_users || []).map((user) => (
                <div className="admin-active-user" key={user.id}>
                  <span className="admin-active-avatar">{(user.name || 'U').slice(0,1).toUpperCase()}</span>
                  <div><strong>{user.name}</strong><small>Last tracked {user.last_tracked_login ? new Date(user.last_tracked_login).toLocaleString() : '—'}</small></div>
                  <b>{formatNumber(user.login_count)} <small>logins</small></b>
                </div>
              ))}
              {(!data.most_active_users || !data.most_active_users.length) && <p className="admin-muted">Login activity tracking starts after this release.</p>}
            </div>
          </section>
        </div>

        <div className="admin-content-grid">
          <section className="admin-panel">
            <div className="admin-panel-heading"><div><span className="section-kicker">RECENT ACCOUNTS</span><h2>Latest registrations</h2></div></div>
            <div className="admin-table-scroll">
              <table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Profile</th><th>Room</th><th>Registered</th></tr></thead>
                <tbody>{(data.recent_users || []).map((user) => <tr key={user.id}>
                  <td>{user.name}</td><td>{user.email}</td><td>{Number(user.has_profile) ? 'Created' : 'Not created'}</td>
                  <td>{Number(user.rooms_owned) ? 'Owner' : Number(user.active_relationships) ? 'Member/applicant' : '—'}</td>
                  <td>{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</td>
                </tr>)}
                {(!data.recent_users || !data.recent_users.length) && <tr><td colSpan="5">No student accounts found.</td></tr>}</tbody>
              </table>
            </div>
          </section>
          <section className="admin-panel">
            <div className="admin-panel-heading"><div><span className="section-kicker">AUDIT & OPERATIONS</span><h2>Recent activity</h2></div></div>
            <div className="admin-event-list">
              {(data.recent_activity || []).map((event) => (
                <div className="admin-event-item" key={event.id}>
                  <span className="admin-event-dot" />
                  <div><strong>{EVENT_LABELS[event.event_type] || event.event_type}</strong><small>{event.actor_name || 'Former account'}{event.subject_name && event.subject_name !== event.actor_name ? ' → ' + event.subject_name : ''} · {event.entity_type || 'platform'} {event.entity_id || ''}</small></div>
                  <time>{event.occurred_at ? new Date(event.occurred_at).toLocaleString() : '—'}</time>
                </div>
              ))}
              {(!data.recent_activity || !data.recent_activity.length) && <p className="admin-muted">No new event-log records yet. Events are tracked from deployment onward.</p>}
            </div>
          </section>
        </div>

        <section className="admin-data-note">
          <FiDatabase />
          <div><strong>Data coverage & interpretation</strong><p>{data.tracking_note} Historical signup, room, application, view and message counts use existing tables. The event log does not reconstruct activity from before its migration. Exported reports are confidential; account reports include names and email addresses for administration, never passwords, OTPs or chat content.</p></div>
        </section>
        <p className="admin-generated-at"><FiCalendar /> Last refreshed: {data.generated_at ? new Date(data.generated_at).toLocaleString() : '—'}</p>
      </div>
    </div>
  );
};

export default AdminDashboard;
