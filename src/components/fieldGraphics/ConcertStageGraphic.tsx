import React from 'react';

export const ConcertStageGraphic: React.FC<React.SVGProps<SVGGElement>> = (props) => {
  return (
    <g id="concert-stage-graphic" {...props}>
      <defs>
        {/* Gradiente de escenario (Púrpura / Morado Neón) */}
        <linearGradient id="concertStageGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4c1d95" />
          <stop offset="50%" stopColor="#581c87" />
          <stop offset="100%" stopColor="#3b0764" />
        </linearGradient>

        {/* Gradiente de pista / piso liso */}
        <radialGradient id="concertFloorGradient" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="70%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#090d16" />
        </radialGradient>

        {/* Haces de luz de escenario */}
        <linearGradient id="spotlightLeft" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c084fc" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="spotlightRight" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* PISO LISO / PISTA GENERAL (STANDING) */}
      <rect
        x="180"
        y="190"
        width="440"
        height="230"
        rx="12"
        fill="url(#concertFloorGradient)"
        stroke="#475569"
        strokeWidth="1.5"
      />

      {/* Cuadrícula sutil de piso / secciones de pie */}
      {[240, 290, 340, 390].map((y) => (
        <line
          key={y}
          x1="195"
          y1={y}
          x2="605"
          y2={y}
          stroke="#334155"
          strokeWidth="0.8"
          strokeDasharray="4 4"
          strokeOpacity="0.4"
        />
      ))}
      {[270, 335, 465, 530].map((x) => (
        <line
          key={x}
          x1={x}
          y1="195"
          x2={x}
          y2="415"
          stroke="#334155"
          strokeWidth="0.8"
          strokeDasharray="4 4"
          strokeOpacity="0.4"
        />
      ))}

      {/* Haces de luz que iluminan la pista */}
      <polygon points="340,180 230,340 310,340" fill="url(#spotlightLeft)" />
      <polygon points="460,180 570,340 490,340" fill="url(#spotlightRight)" />

      {/* FOH (Cabina técnica de consola de sonido e iluminación) */}
      <rect
        x="372"
        y="345"
        width="56"
        height="32"
        rx="4"
        fill="#090d16"
        stroke="#64748b"
        strokeWidth="1.5"
      />
      <circle cx="388" cy="361" r="3" fill="#38bdf8" />
      <circle cx="400" cy="361" r="3" fill="#a855f7" />
      <circle cx="412" cy="361" r="3" fill="#22c55e" />
      <text
        x="400"
        y="354"
        fill="#94a3b8"
        fontSize="7.5"
        fontWeight="bold"
        textAnchor="middle"
        letterSpacing="1"
      >
        FOH / AUDIO
      </text>

      {/* Textos descriptivos de la pista */}
      <text
        x="400"
        y="278"
        fill="#ffffff"
        opacity="0.5"
        fontSize="11"
        fontWeight="bold"
        textAnchor="middle"
        letterSpacing="2"
      >
        PISTA • GENERAL DE PIE
      </text>
      <text
        x="400"
        y="294"
        fill="#94a3b8"
        opacity="0.4"
        fontSize="9"
        textAnchor="middle"
      >
        ZONA DE CONCIERTO
      </text>

      {/* Pasarela central del artista (catwalk / thrust) */}
      <rect
        x="386"
        y="180"
        width="28"
        height="50"
        fill="#581c87"
        stroke="#c084fc"
        strokeWidth="1.5"
      />
      <circle
        cx="400"
        cy="234"
        r="16"
        fill="#581c87"
        stroke="#c084fc"
        strokeWidth="2"
      />
      <circle cx="400" cy="234" r="5" fill="#facc15" />

      {/* ESCENARIO PRINCIPAL (MAIN STAGE) */}
      {/* Sombra proyectada del escenario */}
      <rect
        x="246"
        y="120"
        width="308"
        height="68"
        rx="6"
        fill="#090d16"
        opacity="0.8"
      />
      {/* Plataforma del Escenario */}
      <rect
        x="248"
        y="116"
        width="304"
        height="66"
        rx="6"
        fill="url(#concertStageGradient)"
        stroke="#a855f7"
        strokeWidth="2.5"
      />

      {/* Pantalla LED Central Gigante de Fondo */}
      <rect
        x="295"
        y="123"
        width="210"
        height="12"
        rx="2"
        fill="#06b6d4"
        fillOpacity="0.8"
        stroke="#67e8f9"
        strokeWidth="1"
      />

      {/* Torres de Sonido PA (Izquierda y Derecha) */}
      <rect x="254" y="126" width="22" height="46" rx="2" fill="#1e1b4b" stroke="#818cf8" strokeWidth="1.2" />
      <rect x="524" y="126" width="22" height="46" rx="2" fill="#1e1b4b" stroke="#818cf8" strokeWidth="1.2" />
      <line x1="254" y1="140" x2="276" y2="140" stroke="#818cf8" strokeWidth="0.8" />
      <line x1="254" y1="155" x2="276" y2="155" stroke="#818cf8" strokeWidth="0.8" />
      <line x1="524" y1="140" x2="546" y2="140" stroke="#818cf8" strokeWidth="0.8" />
      <line x1="524" y1="155" x2="546" y2="155" stroke="#818cf8" strokeWidth="0.8" />

      {/* Texto en Escenario */}
      <text
        x="400"
        y="152"
        fill="#ffffff"
        fontSize="12"
        fontWeight="900"
        textAnchor="middle"
        letterSpacing="2"
      >
        ESCENARIO PRINCIPAL
      </text>
      <text
        x="400"
        y="167"
        fill="#e9d5ff"
        fontSize="8.5"
        fontWeight="bold"
        textAnchor="middle"
        letterSpacing="1"
      >
        MAIN STAGE
      </text>
    </g>
  );
};
