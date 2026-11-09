import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import logo from '../assets/RoomSync_ Find, Match, Share-Photoroom.png';
import {
  FiBell, FiHome, FiLogOut, FiMenu, FiMessageCircle,
  FiMoon, FiPlus, FiSearch, FiShield, FiSun, FiX
} from 'react-icons/fi';
import { useTheme } from '../context/useTheme';
import api from '../api';
import toast from 'react-hot-toast';
import { disconnectSocket, initSocket } from '../socket';

const readUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const navItems = [
  { label: 'Find rooms', to: '/find-rooms', icon: FiSearch },
  { label: 'Create room', to: '/create-room', icon: FiPlus },
  { label: 'Owner dashboard', to: '/dashboard', icon: FiHome },
  { label: 'Messages', to: '/chat', icon: FiMessageCircle }
];

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');
  const user = readUser();
  const userId = user?.id;
  const userAvatar = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(user?.name || user?.id || 'RoomSync')}&backgroundColor=e2e8f0`;
  const visibleNavItems = user?.role === 'admin' ? [...navItems, { label: 'Admin analytics', to: '/admin', icon: FiShield }] : navItems;
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    if (!userId || !token) return undefined;

    const socket = initSocket(userId);
    const fetchNotifications = async () => {
      try {
        const { data } = await api.get('/notifications');
        setNotifications(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load notifications', error);
      }
    };
    const handleNewNotification = (data) => {
      setNotifications((previous) => [data, ...previous]);
      toast.success(data.message, { icon: '🔔' });
    };

    fetchNotifications();
    socket.on('new_notification', handleNewNotification);
    return () => socket.off('new_notification', handleNewNotification);
  }, [userId, token]);

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const markAsRead = async (id) => {
    try {
      await api.put('/notifications/' + id + '/read');
      setNotifications((previous) => previous.map((item) => item.id === id ? { ...item, is_read: 1 } : item));
    } catch (error) {
      console.error('Could not mark notification as read', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications((previous) => previous.map((item) => ({ ...item, is_read: 1 })));
    } catch {
      toast.error('Could not update notifications');
    }
  };

  const closeTransientMenus = () => {
    setMobileOpen(false);
    setShowNotifications(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    disconnectSocket();
    navigate('/login', { replace: true });
  };

  if (!token) return null;

  return (
    <header className="app-header sticky top-0 z-50">
      <div className="app-header-inner">
        <Link to="" className="brand-link" aria-label="RoomSync home" onClick={closeTransientMenus}>
          {logoFailed ? (
            <span className="brand-wordmark">RoomSync</span>
          ) : (
            <img
              src={logo}
              alt="RoomSync — Find, Match, Share"
              className="brand-logo"
              onError={() => setLogoFailed(true)}
            />
          )}
        </Link>

        <nav className="desktop-navigation" aria-label="Main navigation">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={closeTransientMenus}
                className={'nav-link' + (isActive(item.to) ? ' nav-link-active' : '')}
                aria-current={isActive(item.to) ? 'page' : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="header-actions">
          <div className="notification-wrap">
            <button
              type="button"
              className="icon-button notification-button"
              onClick={() => setShowNotifications((shown) => !shown)}
              aria-label={unreadCount ? 'Notifications, ' + unreadCount + ' unread' : 'Notifications'}
              aria-expanded={showNotifications}
            >
              <FiBell aria-hidden="true" />
              {unreadCount > 0 && <span className="notification-dot" />}
            </button>
            {showNotifications && (
              <section className="notification-popover" aria-label="Notifications">
                <div className="notification-heading">
                  <div>
                    <strong>Notifications</strong>
                    <span>{unreadCount ? unreadCount + ' unread' : 'You are all caught up'}</span>
                  </div>
                  <button type="button" className="text-action" onClick={markAllAsRead}>Mark all read</button>
                </div>
                <div className="notification-list">
                  {notifications.length === 0 ? (
                    <p className="notification-empty">Nothing new yet. Application updates will appear here.</p>
                  ) : notifications.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={'notification-item' + (!item.is_read ? ' notification-unread' : '')}
                      onClick={() => markAsRead(item.id)}
                    >
                      <span>{item.message}</span>
                      <small>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</small>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          <button
            type="button"
            className="icon-button theme-button"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <FiMoon /> : <FiSun />}
          </button>

          <div className="user-menu">
            <Link
              to="/profile"
              className="user-profile-link"
              onClick={closeTransientMenus}
              aria-label={`Open profile for ${user?.name || 'your account'}`}
              title="Manage profile"
            >
              <img
                src={userAvatar}
                alt=""
                aria-hidden="true"
                className="user-avatar"
                loading="lazy"
              />
              <span className="user-name">{user?.name || 'Account'}</span>
            </Link>
            <button type="button" className="logout-button" onClick={handleLogout}>
              <FiLogOut aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>

          <button
            type="button"
            className="icon-button mobile-menu-button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="mobile-navigation" aria-label="Mobile navigation">
          <Link to="/profile" className="mobile-user-summary" onClick={closeTransientMenus}>
            <img src={userAvatar} alt="" aria-hidden="true" className="mobile-user-avatar" />
            <span>
              <small className="mobile-user-label">PROFILE & ACCOUNT</small>
              <strong>{user?.name || 'RoomSync account'}</strong>
            </span>
          </Link>
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={closeTransientMenus}
                className={'mobile-nav-link' + (isActive(item.to) ? ' mobile-nav-link-active' : '')}
                aria-current={isActive(item.to) ? 'page' : undefined}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button type="button" className="mobile-signout" onClick={handleLogout}>
            <FiLogOut aria-hidden="true" /> Sign out
          </button>
        </nav>
      )}
    </header>
  );
};

export default Navbar;
