import React from 'react';

export const BaseballFieldGraphic: React.FC<React.SVGProps<SVGGElement>> = (props) => {
  return (
    <g id="baseball-field-graphic" {...props}>
      <defs>
        {/* Pasto de los jardines */}
        <radialGradient id="outfieldGrass" cx="50%" cy="80%" r="70%">
          <stop offset="0%" stopColor="#15803d" />
          <stop offset="70%" stopColor="#166534" />
          <stop offset="100%" stopColor="#14532d" />
        </radialGradient>
        {/* Arcilla del infield */}
        <radialGradient id="infieldClay" cx="50%" cy="75%" r="60%">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#92400e" />
        </radialGradient>
      </defs>

      {/* Terreno Exterior / Outfield Grass (Abanico de béisbol) */}
      <path
        d="M 120 180 A 380 380 0 0 1 680 180 L 400 460 Z"
        fill="url(#outfieldGrass)"
        stroke="#22c55e"
        strokeWidth="2"
        opacity="0.9"
      />

      {/* Barda de jonrón / Home Run Wall */}
      <path
        d="M 120 180 A 380 380 0 0 1 680 180"
        fill="none"
        stroke="#fbbf24"
        strokeWidth="4"
        strokeDasharray="6 4"
      />

      {/* Cuadrante de Arcilla del Infield */}
      <path
        d="M 280 340 L 400 220 L 520 340 L 400 460 Z"
        fill="url(#infieldClay)"
        stroke="#f59e0b"
        strokeWidth="2"
      />

      {/* Pasto interior del diamante */}
      <path
        d="M 320 340 L 400 260 L 480 340 L 400 420 Z"
        fill="#15803d"
        stroke="#86efac"
        strokeWidth="1.5"
      />

      {/* Líneas de Cal (Foul lines) */}
      <line x1="400" y1="460" x2="115" y2="175" stroke="#ffffff" strokeWidth="2.5" strokeOpacity="0.8" />
      <line x1="400" y1="460" x2="685" y2="175" stroke="#ffffff" strokeWidth="2.5" strokeOpacity="0.8" />

      {/* Montículo del Pitcher */}
      <circle cx="400" cy="340" r="14" fill="#b45309" stroke="#ffffff" strokeWidth="1.5" />
      <rect x="395" y="338" width="10" height="3" fill="#ffffff" />

      {/* Bases */}
      {/* Home Plate */}
      <polygon points="400,466 394,460 394,453 406,453 406,460" fill="#ffffff" />
      {/* Primera Base */}
      <rect x="475" y="335" width="10" height="10" fill="#ffffff" transform="rotate(45 480 340)" />
      {/* Segunda Base */}
      <rect x="395" y="255" width="10" height="10" fill="#ffffff" transform="rotate(45 400 260)" />
      {/* Tercera Base */}
      <rect x="315" y="335" width="10" height="10" fill="#ffffff" transform="rotate(45 320 340)" />

      {/* Texto en terreno de juego */}
      <text x="400" y="200" fill="#ffffff" opacity="0.6" fontSize="13" fontWeight="bold" textAnchor="middle" letterSpacing="2">
        JARDÍN CENTRAL
      </text>
      <text x="250" y="240" fill="#ffffff" opacity="0.4" fontSize="11" fontWeight="bold" textAnchor="middle">
        JARDÍN IZQ.
      </text>
      <text x="550" y="240" fill="#ffffff" opacity="0.4" fontSize="11" fontWeight="bold" textAnchor="middle">
        JARDÍN DER.
      </text>

      {/* Indicador de Home Plate en SVG */}
      <text x="400" y="445" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">
        HOME
      </text>
    </g>
  );
};
