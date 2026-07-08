type NeuralBuildOrbitProps = {
  className?: string;
};

export function NeuralBuildOrbit({ className = "" }: NeuralBuildOrbitProps) {
  return (
    <div
      className={`pointer-events-none z-0 ${className}`}
      data-testid="neural-build-orbit"
      aria-hidden="true"
    >
      <style>{`
        @keyframes omnifix-orbit-drift {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes omnifix-node-pulse {
          0%, 100% { opacity: 0.38; transform: scale(1); }
          45% { opacity: 0.72; transform: scale(1.42); }
        }

        @keyframes omnifix-signal-flow {
          0% { stroke-dashoffset: 96; opacity: 0; }
          18% { opacity: 0.7; }
          58% { opacity: 0.54; }
          100% { stroke-dashoffset: -96; opacity: 0; }
        }

        .omnifix-orbit-ring {
          animation: omnifix-orbit-drift 38s linear infinite;
          transform-box: fill-box;
          transform-origin: center;
        }

        .omnifix-orbit-node {
          animation: omnifix-node-pulse 10s ease-in-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }

        .omnifix-orbit-node:nth-of-type(2) { animation-delay: -2.5s; }
        .omnifix-orbit-node:nth-of-type(3) { animation-delay: -5s; }
        .omnifix-orbit-node:nth-of-type(4) { animation-delay: -7s; }

        .omnifix-signal {
          animation: omnifix-signal-flow 12s ease-in-out infinite;
          stroke-dasharray: 42 96;
        }

        .omnifix-signal:nth-of-type(2) { animation-delay: -4s; }
        .omnifix-signal:nth-of-type(3) { animation-delay: -8s; }

        @media (prefers-reduced-motion: reduce) {
          .omnifix-orbit-ring,
          .omnifix-orbit-node,
          .omnifix-signal {
            animation: none;
          }
        }
      `}</style>

      <svg
        className="h-full w-full opacity-[0.78]"
        viewBox="0 0 560 520"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="orbitGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(56, 189, 248, 0.24)" />
            <stop offset="56%" stopColor="rgba(45, 212, 191, 0.09)" />
            <stop offset="100%" stopColor="rgba(6, 6, 9, 0)" />
          </radialGradient>
          <filter id="orbitAtmosphere" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <filter id="softNodeGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <ellipse cx="300" cy="260" rx="230" ry="190" fill="url(#orbitGlow)" />
        <ellipse cx="312" cy="260" rx="160" ry="112" fill="rgba(56,189,248,0.08)" filter="url(#orbitAtmosphere)" />

        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M142 278 C194 180 280 134 390 152 C450 162 492 212 502 278" stroke="rgba(255,255,255,0.12)" strokeWidth="1.15" />
          <path d="M116 330 C184 302 234 318 298 372 C358 420 432 402 482 344" stroke="rgba(255,255,255,0.1)" strokeWidth="1.1" />
          <path d="M178 176 C218 236 274 254 338 236 C394 220 438 238 482 292" stroke="rgba(45,212,191,0.18)" strokeWidth="1.15" />
          <path d="M164 392 C204 340 238 284 284 222 C328 164 384 120 448 104" stroke="rgba(56,189,248,0.16)" strokeWidth="1.1" />
          <path d="M96 242 C164 246 224 266 278 302 C338 342 394 346 464 322" stroke="rgba(255,255,255,0.09)" strokeWidth="1.05" />
          <path d="M220 108 C228 178 256 224 306 260 C356 296 384 348 390 424" stroke="rgba(255,255,255,0.08)" strokeWidth="1.05" />
        </g>

        <g className="omnifix-orbit-ring">
          <ellipse cx="300" cy="260" rx="176" ry="118" stroke="rgba(56,189,248,0.18)" strokeWidth="1.1" />
          <ellipse cx="300" cy="260" rx="98" ry="184" stroke="rgba(45,212,191,0.13)" strokeWidth="1.05" transform="rotate(34 300 260)" />
        </g>

        <g strokeLinecap="round" strokeLinejoin="round">
          <path className="omnifix-signal" d="M142 278 C194 180 280 134 390 152 C450 162 492 212 502 278" stroke="rgba(56,189,248,0.68)" strokeWidth="1.55" />
          <path className="omnifix-signal" d="M178 176 C218 236 274 254 338 236 C394 220 438 238 482 292" stroke="rgba(45,212,191,0.62)" strokeWidth="1.45" />
          <path className="omnifix-signal" d="M96 242 C164 246 224 266 278 302 C338 342 394 346 464 322" stroke="rgba(96,165,250,0.55)" strokeWidth="1.35" />
        </g>

        <g fill="rgba(255,255,255,0.34)">
          <circle cx="142" cy="278" r="3.2" />
          <circle cx="390" cy="152" r="3" />
          <circle cx="482" cy="292" r="2.7" />
          <circle cx="116" cy="330" r="2.5" />
          <circle cx="298" cy="372" r="3" />
          <circle cx="448" cy="104" r="2.8" />
          <circle cx="220" cy="108" r="2.6" />
          <circle cx="390" cy="424" r="2.8" />
          <circle cx="464" cy="322" r="2.8" />
        </g>

        <g filter="url(#softNodeGlow)">
          <circle className="omnifix-orbit-node" cx="278" cy="302" r="5.2" fill="rgba(56,189,248,0.68)" />
          <circle className="omnifix-orbit-node" cx="338" cy="236" r="4.8" fill="rgba(45,212,191,0.62)" />
          <circle className="omnifix-orbit-node" cx="502" cy="278" r="4.6" fill="rgba(96,165,250,0.58)" />
          <circle className="omnifix-orbit-node" cx="164" cy="392" r="4.4" fill="rgba(45,212,191,0.56)" />
        </g>
      </svg>
    </div>
  );
}
