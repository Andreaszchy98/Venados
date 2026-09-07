import React from 'react';

export const BasketballCourtGraphic: React.FC<React.SVGProps<SVGGElement>> = (props) => {
  return (
    <g id="basketball-court-graphic" {...props}>
      <defs>
        {/* Duela de madera cálida */}
        <radialGradient id="basketballWood" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="60%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>
        {/* Zona pintada (paint / llave) */}
        <linearGradient id="basketballKeyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#991b1b" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </linearGradient>
      </defs>

      {/* Área perimetral exterior / banquillos (apron de duela oscura) */}
      <rect
        x="195"
        y="140"
        width="410"
        height="250"
        rx="10"
        fill="#1e293b"
        stroke="#475569"
        strokeWidth="1.5"
      />

      {/* Superficie de madera de la duela */}
      <rect
        x="208"
        y="152"
        width="384"
        height="226"
        rx="4"
        fill="url(#basketballWood)"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeOpacity="0.9"
      />

      {/* Tablones de duela sutiles */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <line
          key={i}
          x1="208"
          y1={152 + (i + 1) * 25.1}
          x2="592"
          y2={152 + (i + 1) * 25.1}
          stroke="#92400e"
          strokeWidth="0.8"
          strokeOpacity="0.4"
        />
      ))}

      {/* Línea central */}
      <line
        x1="400"
        y1="152"
        x2="400"
        y2="378"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeOpacity="0.9"
      />

      {/* Círculo central */}
      <circle
        cx="400"
        cy="265"
        r="38"
        fill="#b45309"
        fillOpacity="0.4"
        stroke="#ffffff"
        strokeWidth="2"
        strokeOpacity="0.9"
      />
      <circle
        cx="400"
        cy="265"
        r="14"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeOpacity="0.85"
      />

      {/* ÁREA IZQUIERDA: Llave, Tiro Libre y Arco de 3 Puntos */}
      {/* Llave / Pintura Izquierda */}
      <rect
        x="208"
        y="228"
        width="80"
        height="74"
        fill="url(#basketballKeyGradient)"
        stroke="#ffffff"
        strokeWidth="2"
        strokeOpacity="0.9"
      />
      {/* Círculo de Tiro Libre Izquierdo */}
      <path
        d="M 288 228 A 37 37 0 0 1 288 302"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeOpacity="0.9"
      />
      <path
        d="M 288 228 A 37 37 0 0 0 288 302"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        strokeOpacity="0.8"
      />
      {/* Línea de 3 puntos Izquierda */}
      <path
        d="M 208 174 L 236 174 A 108 108 0 0 1 236 356 L 208 356"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeOpacity="0.9"
      />
      {/* Tablero y Canasta Izquierda */}
      <line x1="222" y1="250" x2="222" y2="280" stroke="#ffffff" strokeWidth="3" />
      <line x1="222" y1="265" x2="228" y2="265" stroke="#ea580c" strokeWidth="2" />
      <circle cx="233" cy="265" r="5" fill="none" stroke="#ea580c" strokeWidth="2" />

      {/* ÁREA DERECHA: Llave, Tiro Libre y Arco de 3 Puntos */}
      {/* Llave / Pintura Derecha */}
      <rect
        x="512"
        y="228"
        width="80"
        height="74"
        fill="url(#basketballKeyGradient)"
        stroke="#ffffff"
        strokeWidth="2"
        strokeOpacity="0.9"
      />
      {/* Círculo de Tiro Libre Derecho */}
      <path
        d="M 512 228 A 37 37 0 0 0 512 302"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeOpacity="0.9"
      />
      <path
        d="M 512 228 A 37 37 0 0 1 512 302"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        strokeOpacity="0.8"
      />
      {/* Línea de 3 puntos Derecha */}
      <path
        d="M 592 174 L 564 174 A 108 108 0 0 0 564 356 L 592 356"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2"
        strokeOpacity="0.9"
      />
      {/* Tablero y Canasta Derecha */}
      <line x1="578" y1="250" x2="578" y2="280" stroke="#ffffff" strokeWidth="3" />
      <line x1="578" y1="265" x2="572" y2="265" stroke="#ea580c" strokeWidth="2" />
      <circle cx="567" cy="265" r="5" fill="none" stroke="#ea580c" strokeWidth="2" />

      {/* Textos descriptivos */}
      <text
        x="400"
        y="125"
        fill="#ffffff"
        opacity="0.65"
        fontSize="12"
        fontWeight="bold"
        textAnchor="middle"
        letterSpacing="2"
      >
        CANCHA DE BÁSQUETBOL
      </text>
      <text
        x="400"
        y="269"
        fill="#ffffff"
        opacity="0.3"
        fontSize="10"
        fontWeight="900"
        textAnchor="middle"
        letterSpacing="1"
      >
        DUELA PROFESIONAL
      </text>
    </g>
  );
};
