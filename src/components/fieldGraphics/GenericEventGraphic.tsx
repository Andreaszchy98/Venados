import React from 'react';

export const GenericEventGraphic: React.FC<React.SVGProps<SVGGElement>> = (props) => {
  return (
    <g id="generic-event-graphic" {...props}>
      <defs>
        {/* Gradiente neutro para eventos generales */}
        <radialGradient id="genericFloorGradient" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="70%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
      </defs>

      {/* Terreno Central Neutro Multipropósito */}
      <rect
        x="180"
        y="130"
        width="440"
        height="275"
        rx="20"
        fill="url(#genericFloorGradient)"
        stroke="#475569"
        strokeWidth="2"
      />

      {/* Línea perimetral interior con patrón punteado */}
      <rect
        x="196"
        y="146"
        width="408"
        height="243"
        rx="14"
        fill="none"
        stroke="#64748b"
        strokeWidth="1.5"
        strokeDasharray="6 4"
        opacity="0.6"
      />

      {/* Círculo central decorativo neutro */}
      <circle
        cx="400"
        cy="268"
        r="54"
        fill="none"
        stroke="#64748b"
        strokeWidth="1.5"
        strokeDasharray="5 4"
        opacity="0.6"
      />
      <circle
        cx="400"
        cy="268"
        r="20"
        fill="#334155"
        fillOpacity="0.4"
        stroke="#94a3b8"
        strokeWidth="1"
        opacity="0.5"
      />
      <circle cx="400" cy="268" r="4" fill="#94a3b8" opacity="0.8" />

      {/* Líneas divisorias suaves */}
      <line
        x1="400"
        y1="150"
        x2="400"
        y2="385"
        stroke="#334155"
        strokeWidth="1"
        strokeDasharray="4 4"
        opacity="0.4"
      />
      <line
        x1="200"
        y1="268"
        x2="600"
        y2="268"
        stroke="#334155"
        strokeWidth="1"
        strokeDasharray="4 4"
        opacity="0.4"
      />

      {/* Textos informativos de evento general */}
      <text
        x="400"
        y="118"
        fill="#ffffff"
        opacity="0.6"
        fontSize="11"
        fontWeight="bold"
        textAnchor="middle"
        letterSpacing="2"
      >
        ÁREA CENTRAL DE ACTIVIDADES
      </text>
      <text
        x="400"
        y="263"
        fill="#ffffff"
        opacity="0.65"
        fontSize="12"
        fontWeight="900"
        textAnchor="middle"
        letterSpacing="2"
      >
        PISTA GENERAL
      </text>
      <text
        x="400"
        y="280"
        fill="#94a3b8"
        opacity="0.5"
        fontSize="9.5"
        fontWeight="bold"
        textAnchor="middle"
        letterSpacing="1"
      >
        EVENTO MULTIPROPÓSITO
      </text>
    </g>
  );
};
