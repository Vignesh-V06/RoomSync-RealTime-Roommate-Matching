import { Link } from 'react-router-dom';
import { FiMoon, FiSun } from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext';

const AuthLayout = ({
  eyebrow = 'RoomSync · Student living',
  title,
  description,
  topLinkText,
  topLinkTo,
  children,
  footer
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="auth-page">
      <header className="auth-topbar">
        <Link to="/" className="auth-brand" aria-label="RoomSync home">
          <img src="/roomsync-logo.webp" alt="RoomSync — Find, Match, Share" />
        </Link>
        <div className="auth-topbar-actions">
          <button
            type="button"
            className="auth-theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <FiMoon /> : <FiSun />}
          </button>
          {topLinkText && topLinkTo && (
            <div className="auth-topbar-prompt">
              <span>{topLinkText}</span>
              <Link to={topLinkTo}>{topLinkTo === '/register' ? 'Create account' : 'Sign in'}</Link>
            </div>
          )}
        </div>
      </header>

      <main className="auth-shell">
        <section className="auth-story" aria-label="About RoomSync matching">
          <div className="auth-story-content">
            <span className="auth-eyebrow"><i /> {eyebrow}</span>
            <h1>Shared space.<br /><span>Better fit.</span></h1>
            <p className="auth-story-copy">
              The right roommate match is built on the little things you live with every day.
              RoomSync helps you compare those habits before you apply.
            </p>

            <div className="auth-factor-list">
              <div className="auth-factor-row">
                <span>01</span><div><strong>Sleep routines</strong><small>Early starts or late nights</small></div>
              </div>
              <div className="auth-factor-row">
                <span>02</span><div><strong>Study preferences</strong><small>Quiet focus or shared energy</small></div>
              </div>
              <div className="auth-factor-row">
                <span>03</span><div><strong>Everyday habits</strong><small>Food, language and more</small></div>
              </div>
            </div>

            <div className="auth-story-foot">
              <span className="auth-story-mark">R</span>
              <span>Find a room that feels right to come home to.</span>
            </div>
          </div>
          <div className="auth-story-decoration auth-decoration-one" />
          <div className="auth-story-decoration auth-decoration-two" />
        </section>

        <section className="auth-form-region">
          <div className="auth-form-card">
            <div className="auth-form-heading">
              <span className="auth-form-kicker">YOUR ROOMSYNC ACCOUNT</span>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
            {children}
            {footer && <div className="auth-form-footer">{footer}</div>}
          </div>
          <p className="auth-privacy-note">RoomSync · Find, Match, Share</p>
        </section>
      </main>
      <footer className="auth-page-footer">
        <Link to="/">RoomSync</Link>
        <span>Designed for more thoughtful shared living.</span>
      </footer>
    </div>
  );
};

export default AuthLayout;
