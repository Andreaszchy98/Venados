// scripts/test_tomateros_geometry.js
// Calculation and verification of Estadio Tomateros SVG polygons

function flipX(pts, cx = 500) {
  return pts.map(([x, y]) => [Math.round((2 * cx - x) * 10) / 10, y]);
}

function polyToPath(pts) {
  return `M ${pts.map(p => `${p[0]} ${p[1]}`).join(' L ')} Z`;
}

function getBBox(pts) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pts.forEach(([x, y]) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

function getCentroid(pts) {
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const cross = (x0 * y1 - x1 * y0);
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area = area / 2;
  if (Math.abs(area) < 1e-5) {
    const bb = getBBox(pts);
    return { x: Math.round((bb.minX + bb.maxX) / 2), y: Math.round((bb.minY + bb.maxY) / 2) };
  }
  cx = cx / (6 * area);
  cy = cy / (6 * area);
  return { x: Math.round(cx * 10) / 10, y: Math.round(cy * 10) / 10 };
}

// 1. JARDÍN IZQUIERDO: 7 bloques de gradas diagonales
const bleachersLF = [];
// Vector diagonal para jardines: de (180, 310) a (365, 120)
const pStartLF = [185, 305];
const uLF = [0.695, -0.719]; // unit vector along row
const nLF = [-0.719, -0.695]; // normal pointing outward/up-left
const bWidth = 34;
const bDepth = 45;
const bGap = 3.5;

for (let i = 0; i < 7; i++) {
  const dist = i * (bWidth + bGap);
  const p1 = [pStartLF[0] + dist * uLF[0], pStartLF[1] + dist * uLF[1]];
  const p2 = [p1[0] + bWidth * uLF[0], p1[1] + bWidth * uLF[1]];
  const p3 = [p2[0] + bDepth * nLF[0], p2[1] + bDepth * nLF[1]];
  const p4 = [p1[0] + bDepth * nLF[0], p1[1] + bDepth * nLF[1]];
  bleachersLF.push([p1, p2, p3, p4].map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]));
}

// Jardín Derecho: reflejo de Jardín Izquierdo
const bleachersRF = bleachersLF.map(pts => flipX(pts).reverse());

// 2. ZONAS ESPECIALES JARDINES (franja junto a la barda)
// LF: 2 bloques alargados
const specialLF = [
  [[218, 316], [274, 258], [260, 244], [204, 302]],
  [[280, 252], [338, 194], [324, 180], [266, 238]],
];
const specialRF = specialLF.map(pts => flipX(pts).reverse());

// 3. TRIBUNA LATERAL IZQUIERDA - VERTICAL EXTERIOR (4 bloques)
const vertLF = [
  [[195, 408], [265, 408], [265, 450], [195, 450]],
  [[195, 454], [265, 454], [265, 496], [195, 496]],
  [[195, 500], [265, 500], [265, 542], [195, 542]],
  [[195, 546], [265, 546], [278, 592], [208, 592]], // bloque 18 de transición angular
];
const vertRF = vertLF.map(pts => flipX(pts).reverse());

// 4. TRIBUNA LATERAL IZQUIERDA - GRADAS PRINCIPALES BAJAS (5 bloques escalonados 17..13)
const mainLowerLF = [
  // Bloque 17
  [[272, 552], [330, 526], [352, 574], [294, 600]],
  // Bloque 16
  [[298, 604], [356, 578], [378, 626], [320, 652]],
  // Bloque 15
  [[324, 656], [382, 630], [404, 678], [346, 704]],
  // Bloque 14
  [[350, 708], [408, 682], [430, 730], [372, 756]],
  // Bloque 13
  [[376, 760], [434, 734], [452, 778], [394, 804]],
];
const mainLowerRF = mainLowerLF.map(pts => flipX(pts).reverse());

// 5. PALCOS PEGADOS AL CAMPO (LADO 3RA BASE - 3 bloques)
const fieldPalcosLF = [
  [[334, 522], [374, 566], [358, 580], [318, 536]],
  [[378, 570], [418, 614], [402, 628], [362, 584]],
  [[422, 618], [462, 662], [446, 676], [406, 632]],
];
const fieldPalcosRF = fieldPalcosLF.map(pts => flipX(pts).reverse());

// 6. ZONA DETRÁS DE HOME (CENTRAL)
// 3 bloques grandes centrales + 2 bloques de flanco
const homeMain = [
  // Flanco Izquierdo (conecta con lateral 3B)
  [[398, 808], [454, 782], [466, 826], [410, 852]],
  // Bloque 12 (Izquierda de Home)
  [[414, 856], [468, 830], [482, 882], [428, 908]],
  // Bloque 11 (Centro absoluto detrás de Home)
  [[472, 882], [528, 882], [528, 938], [472, 938]],
  // Bloque 10 (Derecha de Home - reflejo de 12)
  [[532, 830], [586, 856], [572, 908], [518, 882]],
  // Flanco Derecho (conecta con lateral 1B - reflejo de flanco izq)
  [[546, 782], [602, 808], [590, 852], [534, 826]],
];

// Palcos Home (frente a backstop): 2 bloques
const homePalcos = [
  [[450, 742], [496, 742], [496, 774], [450, 774]],
  [[504, 742], [550, 742], [550, 774], [504, 774]],
];

// Numerados Home (detrás de los 3 bloques centrales): 2 bloques
const numeradosHome = [
  [[432, 912], [496, 942], [496, 972], [432, 942]],
  [[504, 942], [568, 912], [568, 942], [504, 972]],
];

// Suite Presidencial y Suites Diamante (fondo centro inferior): 4 bloques
const suitesHome = [
  // Suite Diamante Izquierda
  [[380, 914], [428, 914], [428, 952], [380, 952]],
  // Suite Presidencial Centro-Izq
  [[432, 946], [496, 976], [496, 996], [432, 966]],
  // Suite Presidencial Centro-Der
  [[504, 976], [568, 946], [568, 966], [504, 996]],
  // Suite Diamante Derecha
  [[572, 914], [620, 914], [620, 952], [572, 952]],
];

// 7. SUITES Y PLATEAS DIAGONALES EXTERIORES (3RA BASE: 6 bloques medios + 6 bloques exteriores)
const suitesDiagLF_Mid = [
  [[212, 596], [252, 608], [236, 650], [196, 638]],
  [[240, 654], [280, 666], [264, 708], [224, 696]],
  [[268, 712], [308, 724], [292, 766], [252, 754]],
  [[296, 770], [336, 782], [320, 824], [280, 812]],
  [[324, 828], [364, 840], [348, 882], [308, 870]],
  [[352, 886], [392, 898], [376, 940], [336, 928]],
];
const suitesDiagRF_Mid = suitesDiagLF_Mid.map(pts => flipX(pts).reverse());

const suitesDiagLF_Out = [
  [[152, 624], [192, 636], [176, 678], [136, 666]],
  [[180, 682], [220, 694], [204, 736], [164, 724]],
  [[208, 740], [248, 752], [232, 794], [192, 782]],
  [[236, 798], [276, 810], [260, 852], [220, 840]],
  [[264, 856], [304, 868], [288, 910], [248, 898]],
  [[292, 914], [332, 926], [316, 968], [276, 956]],
];
const suitesDiagRF_Out = suitesDiagLF_Out.map(pts => flipX(pts).reverse());

// Juntamos todos los grupos en una lista
const allGroups = [
  { name: 'Jardines LF', items: bleachersLF, zone: 'Jardines' },
  { name: 'Jardines RF', items: bleachersRF, zone: 'Jardines' },
  { name: 'Especial LF', items: specialLF, zone: 'Zona Especial Jardines' },
  { name: 'Especial RF', items: specialRF, zone: 'Zona Especial Jardines' },
  { name: 'Vertical LF', items: vertLF, zone: 'Lateral Superior 3A' },
  { name: 'Vertical RF', items: vertRF, zone: 'Lateral Superior 1A' },
  { name: 'Principal LF', items: mainLowerLF, zone: 'Lateral 3A' },
  { name: 'Principal RF', items: mainLowerRF, zone: 'Lateral 1A' },
  { name: 'Palcos LF', items: fieldPalcosLF, zone: 'Palcos Campo 3A' },
  { name: 'Palcos RF', items: fieldPalcosRF, zone: 'Palcos Campo 1A' },
  { name: 'Central Home', items: homeMain, zone: 'Central Home' },
  { name: 'Palco Home', items: homePalcos, zone: 'Palco Home' },
  { name: 'Numerados Home', items: numeradosHome, zone: 'Numerados Home' },
  { name: 'Suites Home', items: suitesHome, zone: 'Suites Home' },
  { name: 'Plateas Diag LF', items: suitesDiagLF_Mid, zone: 'Plateas 3A' },
  { name: 'Plateas Diag RF', items: suitesDiagRF_Mid, zone: 'Plateas 1A' },
  { name: 'Suites Diag LF', items: suitesDiagLF_Out, zone: 'Suites 3A' },
  { name: 'Suites Diag RF', items: suitesDiagRF_Out, zone: 'Suites 1A' },
];

// Export test SVG to check visual appearance
const fs = require('fs');

const svgHeader = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000" style="background:#F8FAFC;">
  <defs>
    <filter id="activeGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#F59E0B" floodOpacity="0.8" />
    </filter>
  </defs>
`;

let svgBody = '';

// 1. TERRENO DE JUEGO (BASEBALL FIELD)
// Coordenadas clave
const homePlate = [500, 670];
const poleLF = [245, 360];
const poleRF = [755, 360];
const cornerLF = [395, 205];
const centerTopLF = [450, 160];
const centerTopRF = [550, 160];
const cornerRF = [605, 205];

// Perímetro del campo (Pasto Verde)
const fieldPoly = [
  homePlate,
  [390, 560], // foul line 3B
  poleLF,
  cornerLF,
  centerTopLF,
  centerTopRF,
  cornerRF,
  poleRF,
  [610, 560], // foul line 1B
];

svgBody += `
  <!-- Field Turf Background -->
  <polygon points="${fieldPoly.map(p => p.join(',')).join(' ')}" fill="#1E824C" stroke="#14532D" stroke-width="2" />

  <!-- Outfield Warning Track (Arcilla naranja) -->
  <path d="M ${poleLF[0]} ${poleLF[1]} L ${cornerLF[0]} ${cornerLF[1]} L ${centerTopLF[0]} ${centerTopLF[1]} L ${centerTopRF[0]} ${centerTopRF[1]} L ${cornerRF[0]} ${cornerRF[1]} L ${poleRF[0]} ${poleRF[1]} L ${poleRF[0] - 10} ${poleRF[1] + 10} L ${cornerRF[0] - 12} ${cornerRF[1] + 12} L ${centerTopRF[0]} ${centerTopRF[1] + 16} L ${centerTopLF[0]} ${centerTopLF[1] + 16} L ${cornerLF[0] + 12} ${cornerLF[1] + 12} L ${poleLF[0] + 10} ${poleLF[1] + 10} Z" fill="#D97706" opacity="0.9" />

  <!-- Foul Lines (Cal blanca) -->
  <line x1="${homePlate[0]}" y1="${homePlate[1]}" x2="${poleLF[0]}" y2="${poleLF[1]}" stroke="#FFFFFF" stroke-width="2.5" />
  <line x1="${homePlate[0]}" y1="${homePlate[1]}" x2="${poleRF[0]}" y2="${poleRF[1]}" stroke="#FFFFFF" stroke-width="2.5" />

  <!-- Infield Dirt Fan/Arc (Arcilla naranja del diamante) -->
  <path d="M 405,575 C 385,465 615,465 595,575 L 535,635 C 515,655 485,655 465,635 Z" fill="#D97706" stroke="#FFFFFF" stroke-width="2" />

  <!-- Infield Grass Diamond (Pasto interior) -->
  <polygon points="500,490 565,555 500,620 435,555" fill="#1E824C" stroke="#22C55E" stroke-width="1.5" />

  <!-- Bases and Pitcher Mound -->
  <circle cx="500" cy="555" r="11" fill="#FFFFFF" />
  <circle cx="500" cy="555" r="8" fill="#D97706" />
  <rect x="497" y="553.5" width="6" height="3" fill="#FFFFFF" rx="0.5" />

  <!-- 1B, 2B, 3B Bases -->
  <rect x="495" y="485" width="10" height="10" fill="#FFFFFF" transform="rotate(45 500 490)" />
  <rect x="560" y="550" width="10" height="10" fill="#FFFFFF" transform="rotate(45 565 555)" />
  <rect x="430" y="550" width="10" height="10" fill="#FFFFFF" transform="rotate(45 435 555)" />

  <!-- Home Plate -->
  <polygon points="500,665 494,657 494,651 506,651 506,657" fill="#FFFFFF" />
`;

// Paleta cromática acorde a la Imagen A de referencia
const ZONE_COLORS = {
  'Jardines': { fill: '#475569', stroke: '#1E293B', text: '#F8FAFC' },
  'Zona Especial Jardines': { fill: '#1E3A8A', stroke: '#0F172A', text: '#FFFFFF' },
  'Lateral Superior 3A': { fill: '#0EA5E9', stroke: '#0369A1', text: '#FFFFFF' },
  'Lateral Superior 1A': { fill: '#0EA5E9', stroke: '#0369A1', text: '#FFFFFF' },
  'Lateral 3A': { fill: '#38BDF8', stroke: '#0284C7', text: '#0C4A6E' },
  'Lateral 1A': { fill: '#38BDF8', stroke: '#0284C7', text: '#0C4A6E' },
  'Palcos Campo 3A': { fill: '#0284C7', stroke: '#0369A1', text: '#FFFFFF' },
  'Palcos Campo 1A': { fill: '#0284C7', stroke: '#0369A1', text: '#FFFFFF' },
  'Central Home': { fill: '#0F172A', stroke: '#0284C7', text: '#FFFFFF' },
  'Palco Home': { fill: '#0369A1', stroke: '#0284C7', text: '#FFFFFF' },
  'Numerados Home': { fill: '#64748B', stroke: '#334155', text: '#FFFFFF' },
  'Suites Home': { fill: '#475569', stroke: '#1E293B', text: '#FFFFFF' },
  'Plateas 3A': { fill: '#9333EA', stroke: '#6B21A8', text: '#FFFFFF' },
  'Plateas 1A': { fill: '#9333EA', stroke: '#6B21A8', text: '#FFFFFF' },
  'Suites 3A': { fill: '#64748B', stroke: '#334155', text: '#FFFFFF' },
  'Suites 1A': { fill: '#64748B', stroke: '#334155', text: '#FFFFFF' },
};

let blockCounter = 1;
const blockRecords = [];

allGroups.forEach(g => {
  const col = ZONE_COLORS[g.zone] || { fill: '#64748B', stroke: '#334155', text: '#FFFFFF' };
  g.items.forEach(pts => {
    const id = `bloque-${String(blockCounter).padStart(2, '0')}`;
    blockCounter++;
    const pathD = polyToPath(pts);
    const centroid = getCentroid(pts);
    blockRecords.push({
      id,
      zone: g.zone,
      pathD,
      centerPoint: centroid,
      fillColor: col.fill,
      strokeColor: col.stroke,
    });

    svgBody += `
      <path
        id="${id}"
        d="${pathD}"
        fill="${col.fill}"
        stroke="${col.stroke}"
        stroke-width="1.5"
        data-zone="${g.zone}"
        cursor="pointer"
      />
    `;
  });
});

const svgContent = svgHeader + svgBody + '</svg>';
fs.writeFileSync('/tmp/estadio-tomateros-test.svg', svgContent);
fs.writeFileSync('/tmp/tomateros-blocks-data.json', JSON.stringify(blockRecords, null, 2));
console.log(`Generated ${blockRecords.length} block records into /tmp/tomateros-blocks-data.json`);


