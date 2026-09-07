import React from 'react';

export const SoccerFieldGraphic: React.FC<React.SVGProps<SVGGElement>> = (props) => {
  return (
    <g id="soccer-field-graphic" {...props}>
      <defs>
        <radialGradient id="soccerGrassGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#15803d" />
          <stop offset="100%" stopColor="#14532d" />
        </radialGradient>
      </defs>

      {/* Franja perimetral exterior de pasto */}
      <rect
        x="180"
        y="125"
        width="440"
        height="280"
        rx="10"
        fill="url(#soccerGrassGlow)"
        stroke="#22c55e"
        strokeWidth="1.5"
        opacity="0.9"
      />

      {/* Franjas de corte de pasto (mowing stripes) */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect
          key={i}
          x={195 + i * 51.25}
          y="135"
          width="51.25"
          height="260"
          fill={i % 2 === 0 ? '#16a34a' : '#15803d'}
          opacity="0.35"
        />
      ))}

      {/* Líneas perimetrales de la cancha */}
      <rect
        x="195"
        y="135"
        width="410"
        height="260"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeOpacity="0.85"
      />

      {/* Línea de medio campo */}
      <line
        x1="400"
        y1="135"
        x2="400"
        y2="395"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeOpacity="0.85"
      />

      {/* Círculo central */}
      <circle
        cx="400"
        cy="265"
        r="44"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeOpacity="0.85"
      />
      <circle cx="400" cy="265" r="3.5" fill="#ffffff" />

      {/* Portería y Área Grande Izquierda */}
      <rect
        x="195"
        y="190"
        width="70"
        height="150"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeOpacity="0.85"
      />
      {/* Área Chica Izquierda */}
      <rect
        x="195"
        y="225"
        width="30"
        height="80"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeOpacity="0.85"
      />
      {/* Punto Penal Izquierdo */}
      <circle cx="245" cy="265" r="3" fill="#ffffff" />
      {/* Arco del Área Penal Izquierda */}
      <path
        d="M 265 235 A 44 44 0 0 1 265 295"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeOpacity="0.85"
      />
      {/* Marco de portería izquierdo */}
      <rect
        x="183"
        y="235"
        width="12"
        height="60"
        fill="#ffffff"
        opacity="0.25"
        stroke="#ffffff"
        strokeWidth="1.5"
      />

      {/* Portería y Área Grande Derecha */}
      <rect
        x="535"
        y="190"
        width="70"
        height="150"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeOpacity="0.85"
      />
      {/* Área Chica Derecha */}
      <rect
        x="575"
        y="225"
        width="30"
        height="80"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.8"
        strokeOpacity="0.85"
      />
      {/* Punto Penal Derecho */}
      <circle cx="555" cy="265" r="3" fill="#ffffff" />
      {/* Arco del Área Penal Derecha */}
      <path
        d="M 535 235 A 44 44 0 0 0 535 295"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeOpacity="0.85"
      />
      {/* Marco de portería derecho */}
      <rect
        x="605"
        y="235"
        width="12"
        height="60"
        fill="#ffffff"
        opacity="0.25"
        stroke="#ffffff"
        strokeWidth="1.5"
      />

      {/* Arcos de tiro de esquina */}
      <path d="M 195 145 A 10 10 0 0 0 205 135" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeOpacity="0.8" />
      <path d="M 195 385 A 10 10 0 0 1 205 395" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeOpacity="0.8" />
      <path d="M 605 145 A 10 10 0 0 1 595 135" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeOpacity="0.8" />
      <path d="M 605 385 A 10 10 0 0 0 595 395" fill="none" stroke="#ffffff" strokeWidth="1.8" strokeOpacity="0.8" />

      {/* Textos descriptivos de la cancha */}
      <text
        x="400"
        y="115"
        fill="#ffffff"
        opacity="0.65"
        fontSize="12"
        fontWeight="bold"
        textAnchor="middle"
        letterSpacing="2"
      >
        CANCHA DE FÚTBOL
      </text>
      <text x="330" y="270" fill="#ffffff" opacity="0.3" fontSize="10" fontWeight="bold" textAnchor="middle">
        LOCAL
      </text>
      <text x="470" y="270" fill="#ffffff" opacity="0.3" fontSize="10" fontWeight="bold" textAnchor="middle">
        VISITANTE
      </text>
    </g>
  );
};
