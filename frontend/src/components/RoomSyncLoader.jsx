import { useId } from 'react';

const RoomSyncLoader = () => {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  return (
    <div className="roomsync-entry-loader" role="status" aria-label="Entering RoomSync">
      <div className="roomsync-entry-glow" aria-hidden="true" />
      <svg
        className="roomsync-entry-mark"
        viewBox="0 0 218 205"
        role="img"
        aria-label="RoomSync home mark"
      >
        <defs>
          <linearGradient id={`${id}-roof`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8278F4" />
            <stop offset=".38" stopColor="#12D8F5" />
            <stop offset="1" stopColor="#087AF4" />
          </linearGradient>
          <linearGradient id={`${id}-frame`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#776DF1" />
            <stop offset=".54" stopColor="#176DF2" />
            <stop offset="1" stopColor="#06C9ED" />
          </linearGradient>
          <linearGradient id={`${id}-people`} x1=".12" y1="0" x2=".88" y2="1">
            <stop offset="0" stopColor="#1DA8FF" />
            <stop offset="1" stopColor="#0028B9" />
          </linearGradient>
          <linearGradient id={`${id}-orbit`} x1="0" y1="0" x2="1" y2=".15">
            <stop offset="0" stopColor="#00BDEB" />
            <stop offset=".42" stopColor="#8BFAFF" />
            <stop offset=".74" stopColor="#20D5F9" />
            <stop offset="1" stopColor="#0875EB" />
          </linearGradient>
          <linearGradient id={`${id}-orbit-highlight`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#D5FFFF" stopOpacity=".25" />
            <stop offset=".48" stopColor="#F2FFFF" stopOpacity=".92" />
            <stop offset="1" stopColor="#B1FAFF" stopOpacity=".48" />
          </linearGradient>
          <filter id={`${id}-home-glow`} x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="2.8" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0 0 0 0 .02 0 0 0 0 .65 0 0 0 0 1 0 0 0 .55 0"
              result="cyanGlow"
            />
            <feMerge><feMergeNode in="cyanGlow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id={`${id}-orbit-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0 0 0 0 .01 0 0 0 0 .76 0 0 0 0 1 0 0 0 .8 0"
              result="blueGlow"
            />
            <feMerge><feMergeNode in="blueGlow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <mask id={`${id}-home-occlusion`} maskUnits="userSpaceOnUse" x="0" y="0" width="218" height="205">
            <rect width="218" height="205" fill="white" />
            <path
              d="M 23 94 L 101 23 Q 108 16 116 24 L 195 94 L 181 174 Q 180 180 166 180 H 64 Q 50 180 49 165 V 112 Z"
              fill="black"
            />
          </mask>
        </defs>

        {/* The rear half of the orbit is drawn first, so it passes behind the house. */}
        <path
          className="roomsync-orbit-back"
          d="M 43 94 C 61 82 79 71 104 65 C 126 61 142 60 153 47 C 174 43 196 53 205 69 C 213 86 194 108 174 126"
          pathLength="1"
          fill="none"
          stroke={`url(#${id}-orbit)`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          mask={`url(#${id}-home-occlusion)`}
          filter={`url(#${id}-orbit-glow)`}
        />

        <g className="roomsync-entry-house" filter={`url(#${id}-home-glow)`}>
          {/* House frame */}
          <path
            d="M 61 78 V 158 Q 61 168 71 168 H 163 Q 173 168 173 158 V 91"
            fill="none"
            stroke={`url(#${id}-frame)`}
            strokeWidth="13"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Two roommate silhouettes */}
          <circle cx="91" cy="101" r="13" fill={`url(#${id}-people)`} />
          <circle cx="145" cy="101" r="13" fill={`url(#${id}-people)`} />
          <path
            d="M 64 157 C 65 137 77 125 92 125 C 108 125 121 138 124 157 L 124 164 H 64 Z"
            fill={`url(#${id}-people)`}
          />
          <path
            d="M 112 157 C 115 138 129 125 145 125 C 161 125 173 138 174 157 L 174 164 H 112 Z"
            fill={`url(#${id}-people)`}
          />

          {/* Four-pane window */}
          <g fill="#1ADCF0">
            <rect x="102" y="62" width="9" height="9" rx="1.7" />
            <rect x="116" y="62" width="9" height="9" rx="1.7" />
            <rect x="102" y="76" width="9" height="9" rx="1.7" />
            <rect x="116" y="76" width="9" height="9" rx="1.7" />
          </g>

          {/* Roof */}
          <path
            d="M 32 91 L 102 27 Q 108 21 115 28 L 187 91"
            fill="none"
            stroke={`url(#${id}-roof)`}
            strokeWidth="17"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* The front sweep starts at bottom-right and travels to bottom-left. */}
        <path
          className="roomsync-orbit-front"
          d="M 174 126 C 160 118 151 123 137 131 C 108 148 77 166 49 170 C 29 173 13 163 13 149 C 12 130 27 110 43 94"
          pathLength="1"
          fill="none"
          stroke={`url(#${id}-orbit)`}
          strokeWidth="17"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${id}-orbit-glow)`}
        />
        <path
          className="roomsync-orbit-front-highlight"
          d="M 174 126 C 160 118 151 123 137 131 C 108 148 77 166 49 170 C 29 173 13 163 13 149 C 12 130 27 110 43 94"
          pathLength="1"
          fill="none"
          stroke={`url(#${id}-orbit-highlight)`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export default RoomSyncLoader;
