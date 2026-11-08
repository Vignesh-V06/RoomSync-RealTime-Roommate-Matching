import { Link } from 'react-router-dom';
import { FiMoon, FiSun } from 'react-icons/fi';
import { useTheme } from '../context/useTheme';

const AuthLayout = ({ eyebrow = 'RoomSync · Student living', title, description, children, footer }) => {
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
          <Link to="/" className="auth-topbar-home">Back to home</Link>
        </div>
      </header>

      <main className="auth-shell">
        <section className="auth-story" aria-label="About RoomSync matching">
          <div className="auth-story-content">
            <span className="auth-eyebrow"><i /> {eyebrow}</span>
            <h1>Find your people.<br /><span>Feel at home.</span></h1>
            <p className="auth-story-copy">
              A good roommate match goes beyond an empty bed. RoomSync brings everyday
              routines and shared expectations into the decision, so you can choose with more confidence.
            </p>
            <div className="auth-fit-card">
              <div className="auth-fit-card-heading">
                <span>THE ROOMSYNC APPROACH</span>
                <strong>Compatibility, with context.</strong>
              </div>
              <div className="auth-fit-signals">
                <span><i /> Daily routines</span>
                <span><i /> Study atmosphere</span>
                <span><i /> Shared expectations</span>
              </div>
            </div>
            <div className="auth-story-stat-row">
              <div><strong>01</strong><span>Set your rhythm</span></div>
              <div><strong>02</strong><span>Compare the fit</span></div>
              <div><strong>03</strong><span>Meet your match</span></div>
            </div>
            <div className="auth-factor-list">
              <div className="auth-factor-row">
                <span>01</span><div><strong>Daily rhythm</strong><small>Early starts or late nights</small></div>
              </div>
              <div className="auth-factor-row">
                <span>02</span><div><strong>Study atmosphere</strong><small>Quiet focus or shared energy</small></div>
              </div>
              <div className="auth-factor-row">
                <span>03</span><div><strong>Shared expectations</strong><small>Food, language and more</small></div>
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
