import { useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/RoomSync_ Find, Match, Share-Photoroom.png';
import {
  FiArrowUpRight, FiCheck, FiCompass, FiMessageCircle, FiUsers
} from 'react-icons/fi';

const factors = [
  { title: 'Sleep routine', detail: 'Early bird, night owl or somewhere in between.' },
  { title: 'Study habits', detail: 'Quiet focus, background music or group study.' },
  { title: 'Food preferences', detail: 'Find common ground around everyday routines.' },
  { title: 'Language', detail: 'Share a comfortable way to communicate.' },
  { title: 'Academic branch', detail: 'Connect with people in a similar campus rhythm.' },
  { title: 'CGPA range', detail: 'One more signal in the compatibility picture.' }
];

const Home = () => {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className="home-page">
      <header className="home-header">
        <Link to="/" className="home-brand" aria-label="RoomSync home">
          {logoFailed ? (
            <span className="home-wordmark">RoomSync</span>
          ) : (
            <img
              src= {logo}
              alt="RoomSync — Find, Match, Share"
              className="home-logo"
              onError={() => setLogoFailed(true)}
            />
          )}
        </Link>
        <nav className="home-header-actions" aria-label="Account navigation">
          <Link to="/login" className="home-signin">Sign in</Link>
          <Link to="/register" className="home-get-started">Create account <FiArrowUpRight aria-hidden="true" /></Link>
        </nav>
      </header>

      <main>
        <section className="home-hero">
          <div className="home-hero-copy">
            <span className="home-eyebrow"><span className="eyebrow-dot" /> Built around student living</span>
            <h1>Find a room.<br /><span>Find your rhythm.</span></h1>
            <p className="home-lede">
              A good roommate match is about more than an available bed.
              Discover rooms and people whose everyday habits fit yours.
            </p>
            <div className="home-hero-actions">
              <Link to="/register" className="btn-primary home-primary-cta">Find your match <FiArrowUpRight aria-hidden="true" /></Link>
              <Link to="/login" className="home-secondary-cta">I already have an account</Link>
            </div>
            <div className="home-proof">
              <div className="proof-icon"><FiUsers aria-hidden="true" /></div>
              <div><strong>Compatibility first</strong><span>Compare six lifestyle signals before you apply.</span></div>
            </div>
          </div>

          <div className="home-preview-column" aria-label="Example compatibility preview">
            <div className="preview-orbit orbit-one" />
            <div className="preview-orbit orbit-two" />
            <div className="match-preview-card">
              <div className="preview-card-top">
                <span className="preview-card-label">RoomSync match preview</span>
                <span className="preview-live"><i /> Example</span>
              </div>
              <div className="preview-score-row">
                <div><strong>92%</strong><span>lifestyle compatibility</span></div>
                <div className="score-ring"><span>92</span></div>
              </div>
              <div className="preview-meter"><span /></div>
              <div className="preview-match-list">
                {['Sleep routine', 'Study habits', 'Language'].map((item) => (
                  <div className="preview-match-item" key={item}><span><FiCheck /></span>{item}</div>
                ))}
              </div>
              <div className="preview-card-footer">
                <div className="preview-avatars"><span>A</span><span>V</span></div>
                <span>Better habits. Better shared living.</span>
              </div>
            </div>
            <div className="preview-insights" aria-label="RoomSync benefits">
              <span><FiCompass aria-hidden="true" /><span><strong>Find your fit</strong><small>Explore compatible spaces</small></span></span>
              <span><FiMessageCircle aria-hidden="true" /><span><strong>Talk first</strong><small>Connect before moving in</small></span></span>
            </div>
          </div>
        </section>

        <section className="home-how">
          <div className="section-heading">
            <span className="section-kicker">A more thoughtful match</span>
            <h2>Roommates are a lifestyle decision.</h2>
            <p>RoomSync makes the details that shape day-to-day living easier to compare.</p>
          </div>
          <div className="home-steps">
            <article className="home-step">
              <span className="step-number">01</span>
              <div className="step-icon"><FiUsers /></div>
              <h3>Build your profile</h3>
              <p>Share the habits and preferences that make a space feel right for you.</p>
            </article>
            <article className="home-step">
              <span className="step-number">02</span>
              <div className="step-icon"><FiCompass /></div>
              <h3>Explore compatible rooms</h3>
              <p>See available rooms ranked by how closely their owner's lifestyle aligns with yours.</p>
            </article>
            <article className="home-step">
              <span className="step-number">03</span>
              <div className="step-icon"><FiMessageCircle /></div>
              <h3>Apply and connect</h3>
              <p>Send an application, hear back from the owner and chat when you're accepted.</p>
            </article>
          </div>
        </section>

        <section className="home-factors">
          <div className="factors-intro">
            <span className="section-kicker">The details matter</span>
            <h2>Six signals.<br />A more considered match.</h2>
            <p>Your compatibility score is built from six profile factors. It gives you a useful starting point for a roommate conversation—not a promise that two people are identical.</p>
            <Link to="/register" className="factors-link">Create your profile <FiArrowUpRight /></Link>
          </div>
          <div className="factors-grid">
            {factors.map((factor, index) => (
              <article className="factor-item" key={factor.title}>
                <span className="factor-index">0{index + 1}</span>
                <div><h3>{factor.title}</h3><p>{factor.detail}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="home-bottom-cta">
          <div><span className="section-kicker">Your next chapter starts here</span><h2>Make shared living feel more like a fit.</h2></div>
          <Link to="/register" className="btn-primary">Get started <FiArrowUpRight /></Link>
        </section>
      </main>

      <footer className="home-footer">
        <span>RoomSync · Find, Match, Share</span>
        <span>Designed for better shared living.</span>
      </footer>
    </div>
  );
};

export default Home;
