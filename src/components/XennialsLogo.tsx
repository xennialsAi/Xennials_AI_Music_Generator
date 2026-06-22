import React from 'react';

interface XennialsLogoProps {
  className?: string;
  showText?: boolean;
  textSize?: string;
}

export const XennialsLogo: React.FC<XennialsLogoProps> = ({ 
  className = "w-10 h-10", 
  showText = false,
  textSize = "text-xl"
}) => {
  return (
    <div className="flex items-center gap-3">
      <svg 
        viewBox="0 0 100 100" 
        className={`${className} filter drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]`}
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Left-to-right diagonal: Cyan/Blue/Teal */}
          <linearGradient id="cyanTealGrad" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00f2fe" />
            <stop offset="50%" stopColor="#4facfe" />
            <stop offset="100%" stopColor="#00f2fe" />
          </linearGradient>

          {/* Right-to-left diagonal: Orange/Amber/Yellow */}
          <linearGradient id="orangeAmberGrad" x1="90" y1="10" x2="10" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff0844" />
            <stop offset="50%" stopColor="#ffb199" />
            <stop offset="100%" stopColor="#f9aa16" />
          </linearGradient>

          {/* Filter for glowing effects */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Glowy fiber strands for Cyan-Blue-Teal path */}
        <g filter="url(#glow)">
          <path 
            d="M 15,15 C 35,40 65,40 85,85" 
            stroke="url(#cyanTealGrad)" 
            strokeWidth="5" 
            strokeLinecap="round" 
            opacity="0.9"
          />
          <path 
            d="M 10,20 C 32,43 68,43 90,80" 
            stroke="url(#cyanTealGrad)" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            opacity="0.75"
          />
          <path 
            d="M 20,10 C 38,37 62,37 80,90" 
            stroke="url(#cyanTealGrad)" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            opacity="0.75"
          />
        </g>

        {/* Glowy fiber strands for Orange-Amber/Red path */}
        <g filter="url(#glow)">
          <path 
            d="M 85,15 C 65,40 35,40 15,85" 
            stroke="url(#orangeAmberGrad)" 
            strokeWidth="5" 
            strokeLinecap="round" 
            opacity="0.9"
          />
          <path 
            d="M 90,20 C 68,43 32,43 10,80" 
            stroke="url(#orangeAmberGrad)" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            opacity="0.75"
          />
          <path 
            d="M 80,10 C 62,37 38,37 20,90" 
            stroke="url(#orangeAmberGrad)" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            opacity="0.75"
          />
        </g>

        {/* Dynamic center explosion/glow core */}
        <circle cx="50" cy="38" r="4" fill="#ffffff" filter="url(#glow)" />
        <circle cx="50" cy="38" r="8" fill="url(#cyanTealGrad)" opacity="0.4" filter="url(#glow)" />
        
        {/* Particle/Star accents to give that high fidelity look */}
        <circle cx="22" cy="25" r="1.5" fill="#00f2fe" opacity="0.8" />
        <circle cx="78" cy="25" r="1.5" fill="#f9aa16" opacity="0.8" />
        <circle cx="35" cy="75" r="1.2" fill="#ff0844" opacity="0.8" />
        <circle cx="65" cy="75" r="1.2" fill="#4facfe" opacity="0.8" />
      </svg>
      {showText && (
        <span className={`font-black tracking-widest uppercase select-none transition-all ${textSize} bg-gradient-to-r from-cyan-400 via-teal-400 to-orange-500 bg-clip-text text-transparent`}>
          Xennials
        </span>
      )}
    </div>
  );
};
