import { useEffect, useId, useState } from 'react';
import startFrame from '../assets/roomsync-loader-start.webp';
import brandLogo from '../assets/RoomSync_ Find, Match, Share-Photoroom.png';

const RoomSyncLoader = ({
  mode = 'fullscreen',
  label = 'Loading RoomSync…',
  className = ''
}) => {
  const id = useId().replace(/:/g, '');
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return undefined;
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  const starPath = 'M 1377 236 C 1440 173 1580 154 1682 203';
  const starTransform = 'translate(1682 203)';

  return (
    <div
      className={`roomsync-loader roomsync-loader-${mode} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="roomsync-loader-artwork">
        <img
          className="roomsync-loader-start-frame"
          src={startFrame}
          alt="RoomSync — Find, Match, Share"
          draggable="false"
        />
        <svg
          className="roomsync-loader-animation"
          viewBox="0 0 2048 682"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={`${id}-ring-gradient`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#02BDFB" />
              <stop offset="42%" stopColor="#8EF8FF" />
              <stop offset="72%" stopColor="#08BFF9" />
              <stop offset="100%" stopColor="#0878F4" />
            </linearGradient>
            <linearGradient id={`${id}-trail-gradient`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00BDFB" stopOpacity="0.08" />
              <stop offset="42%" stopColor="#20DFFF" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#B8FFFF" />
            </linearGradient>
            <linearGradient id={`${id}-star-gradient`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="48%" stopColor="#9DFFFF" />
              <stop offset="100%" stopColor="#00BDFB" />
            </linearGradient>
            <radialGradient id={`${id}-cleanup-gradient`}>
              <stop offset="0%" stopColor="#00091F" />
              <stop offset="72%" stopColor="#00091F" />
              <stop offset="100%" stopColor="#00091F" stopOpacity="0" />
            </radialGradient>
            <filter id={`${id}-ring-glow`} x="-30%" y="-50%" width="160%" height="200%">
              <feGaussianBlur stdDeviation="9" result="blur" />
              <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.01 0 0 0 0 0.72 0 0 0 0 1 0 0 0 0.78 0" result="cyanGlow" />
              <feMerge><feMergeNode in="cyanGlow" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id={`${id}-star-glow`} x="-180%" y="-180%" width="460%" height="460%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.02 0 0 0 0 0.82 0 0 0 0 1 0 0 0 0.95 0" result="blueGlow" />
              <feMerge><feMergeNode in="blueGlow" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <clipPath id={`${id}-restore-s`} clipPathUnits="userSpaceOnUse">
              <rect x="1320" y="220" width="122" height="152" />
            </clipPath>
            <path id={`${id}-star-motion`} d={starPath} />
          </defs>

          {/* Clear the sparkle baked into the opening reference, then restore the exact S glyph. */}
          <circle cx="1377" cy="236" r="51" fill={`url(#${id}-cleanup-gradient)`} />
          <image
            href={brandLogo}
            x="0"
            y="0"
            width="2048"
            height="682"
            preserveAspectRatio="none"
            clipPath={`url(#${id}-restore-s)`}
          />

          {/* The rear arc forms first, following the exact sweep around the house. */}
          <path
            className="roomsync-loader-ring roomsync-loader-ring-back"
            d="M 592 198 C 642 184 686 194 710 224 C 735 256 716 298 655 338"
            pathLength="1"
            fill="none"
            stroke={`url(#${id}-ring-gradient)`}
            strokeWidth="17"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${id}-ring-glow)`}
          />

          {/* The foreground ribbon wraps around the base of the house. */}
          <path
            className="roomsync-loader-ring roomsync-loader-ring-front"
            d="M 370 332 C 330 359 299 398 299 428 C 299 462 329 477 373 465 C 443 446 517 393 579 362 C 613 345 640 350 646 376 C 650 395 647 417 647 436"
            pathLength="1"
            fill="none"
            stroke={`url(#${id}-ring-gradient)`}
            strokeWidth="43"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${id}-ring-glow)`}
          />
          <path
            className="roomsync-loader-ring-highlight"
            d="M 370 332 C 330 359 299 398 299 428 C 299 462 329 477 373 465 C 443 446 517 393 579 362 C 613 345 640 350 646 376 C 650 395 647 417 647 436"
            pathLength="1"
            fill="none"
            stroke="#D8FFFF"
            strokeWidth="3.2"
            strokeLinecap="round"
            opacity="0.72"
          />

          {/* A light trail is drawn as the star travels from S to C. */}
          <path
            className="roomsync-loader-star-trail"
            d="M 1382 232 C 1440 181 1585 153 1682 203"
            pathLength="1"
            fill="none"
            stroke={`url(#${id}-trail-gradient)`}
            strokeWidth="4.5"
            strokeLinecap="round"
          />

          {reducedMotion ? (
            <g transform={starTransform} filter={`url(#${id}-star-glow)`}>
              <circle r="25" fill="#00CFFF" opacity="0.16" />
              <path d="M 0 -23 C 3 -5 5 -3 23 0 C 5 3 3 5 0 23 C -3 5 -5 3 -23 0 C -5 -3 -3 -5 0 -23 Z" fill={`url(#${id}-star-gradient)`} />
            </g>
          ) : (
            <g className="roomsync-loader-moving-star" filter={`url(#${id}-star-glow)`}>
              <animateMotion
                dur="2.45s"
                repeatCount="indefinite"
                rotate="0"
                calcMode="spline"
                keyTimes="0;1"
                keySplines="0.42 0 0.24 1"
              >
                <mpath href={`#${id}-star-motion`} />
              </animateMotion>
              <circle r="27" fill="#00CFFF" opacity="0.18" />
              <path d="M 0 -23 C 3 -5 5 -3 23 0 C 5 3 3 5 0 23 C -3 5 -5 3 -23 0 C -5 -3 -3 -5 0 -23 Z" fill={`url(#${id}-star-gradient)`} />
              <path d="M -34 0 H 34 M 0 -34 V 34" stroke="#47E9FF" strokeWidth="1.8" opacity="0.58" />
            </g>
          )}
        </svg>
      </div>
      <span className="roomsync-loader-label">{label}</span>
    </div>
  );
};

export default RoomSyncLoader;
