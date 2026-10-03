// scripts/recompute_tomateros.cjs
const fs = require('fs');

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

// ============================================================================
// GEOMETRÍA DEL ESTADIO TOMATEROS (PROPORCIÓN CUADRADA ANCHA, 45°, FRANJAS CONTINUAS)
// ============================================================================

// 1. JARDINES (BLEACHERS Y ZONA ESPECIAL PEGADOS A LA BARDA)
// Barda LF diagonal: desde (245, 305) hasta (405, 145)
// Vector unitario a lo largo de la diagonal: u = (0.7071, -0.7071)
// Normal hacia afuera (arriba a la izquierda): n = (-0.7071, -0.7071)
const uJardines = [0.7071, -0.7071];
const nJardines = [-0.7071, -0.7071];

// Zona Especial Jardines (2 bloques alargados pegados a la barda, ancho 18px)
const specialLF = [];
const startSpecial = [252, 312];
const specLen = 92;
const specGap = 3;
for (let i = 0; i < 2; i++) {
  const s0 = i * (specLen + specGap);
  const p1 = [startSpecial[0] + s0 * uJardines[0], startSpecial[1] + s0 * uJardines[1]];
  const p2 = [p1[0] + specLen * uJardines[0], p1[1] + specLen * uJardines[1]];
  const p3 = [p2[0] + 18 * nJardines[0], p2[1] + 18 * nJardines[1]];
  const p4 = [p1[0] + 18 * nJardines[0], p1[1] + 18 * nJardines[1]];
  specialLF.push([p1, p2, p3, p4].map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]));
}
const specialRF = specialLF.map(pts => flipX(pts).reverse());

// Bleachers Jardines (7 bloques pegados detrás de la Zona Especial, fondo 46px)
const bleachersLF = [];
const startBleach = [242, 322];
const bleachLen = 27;
const bleachGap = 2.5;
const bleachDepth = 48;
for (let i = 0; i < 7; i++) {
  const s0 = i * (bleachLen + bleachGap);
  const basePoint = [startBleach[0] + s0 * uJardines[0] + 22 * nJardines[0], startBleach[1] + s0 * uJardines[1] + 22 * nJardines[1]];
  const p1 = basePoint;
  const p2 = [p1[0] + bleachLen * uJardines[0], p1[1] + bleachLen * uJardines[1]];
  const p3 = [p2[0] + bleachDepth * nJardines[0], p2[1] + bleachDepth * nJardines[1]];
  const p4 = [p1[0] + bleachDepth * nJardines[0], p1[1] + bleachDepth * nJardines[1]];
  bleachersLF.push([p1, p2, p3, p4].map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]));
}
const bleachersRF = bleachersLF.map(pts => flipX(pts).reverse());

// 2. TRIBUNA LATERAL IZQUIERDA (FRANJAS CONTINUAS PARALELAS A 45°)
// Origen en la esquina de home: (445, 685) hacia el poste de foul (235, 475)
// Vector unitario a lo largo de la línea de 45°: uFoul = (-0.7071, -0.7071)
// Normal hacia afuera (alejándose del campo): nFoul = (-0.7071, 0.7071)
const p0_3B = [435, 675];
const uFoul = [-0.7071, -0.7071];
const nFoul = [-0.7071, 0.7071];

function createParallelStrip(pBase, u, n, totalLen, numBlocks, dStart, dEnd, gap = 2.5) {
  const blocks = [];
  const blockLen = (totalLen - (numBlocks - 1) * gap) / numBlocks;
  for (let i = 0; i < numBlocks; i++) {
    const s1 = i * (blockLen + gap);
    const s2 = s1 + blockLen;
    const p1 = [pBase[0] + s1 * u[0] + dStart * n[0], pBase[1] + s1 * u[1] + dStart * n[1]];
    const p2 = [pBase[0] + s2 * u[0] + dStart * n[0], pBase[1] + s2 * u[1] + dStart * n[1]];
    const p3 = [pBase[0] + s2 * u[0] + dEnd * n[0], pBase[1] + s2 * u[1] + dEnd * n[1]];
    const p4 = [pBase[0] + s1 * u[0] + dEnd * n[0], pBase[1] + s1 * u[1] + dEnd * n[1]];
    blocks.push([p1, p2, p3, p4].map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]));
  }
  return blocks;
}

// Longitud de las franjas laterales a lo largo de la diagonal de 45°
const lateralTotalLen = 295;

// Franja 1: Palcos Campo 3A (3 bloques pegados a la barda de foul, espesor 22px)
const fieldPalcosLF = createParallelStrip(p0_3B, uFoul, nFoul, lateralTotalLen, 3, 0, 22, 2.5);
const fieldPalcosRF = fieldPalcosLF.map(pts => flipX(pts).reverse());

// Franja 2: Gradas Principales Bajas Lateral 3A (5 bloques continuos, espesor 60px)
const mainLowerLF = createParallelStrip(p0_3B, uFoul, nFoul, lateralTotalLen, 5, 25, 85, 2.5);
const mainLowerRF = mainLowerLF.map(pts => flipX(pts).reverse());

// Franja 3: Plateas 3A (6 bloques continuos alineados en línea recta, espesor 42px)
const plateasLF = createParallelStrip(p0_3B, uFoul, nFoul, lateralTotalLen, 6, 88, 130, 2.5);
const plateasRF = plateasLF.map(pts => flipX(pts).reverse());

// Franja 4: Suites 3A (6 bloques continuos exteriores alineados en línea recta, espesor 46px)
const suitesLF = createParallelStrip(p0_3B, uFoul, nFoul, lateralTotalLen, 6, 133, 179, 2.5);
const suitesRF = suitesLF.map(pts => flipX(pts).reverse());

// 3. LATERAL SUPERIOR VERTICAL (NUMERADOS 2A / 1A: 4 bloques)
// En el extremo exterior de la tribuna (past 3B hacia el poste):
// Cuatro bloques alineados a lo largo del perímetro exterior
const vertLF = [
  [[92, 420], [152, 420], [152, 466], [92, 466]],
  [[92, 470], [152, 470], [152, 516], [92, 516]],
  [[92, 520], [152, 520], [152, 566], [92, 566]],
  [[92, 570], [152, 570], [172, 620], [108, 620]],
];
const vertRF = vertLF.map(pts => flipX(pts).reverse());

// 4. DETRÁS DE HOME (3 GRANDES ANCHOS AL CENTRO + FLANCOS EN ABANICO)
// Home central en Y = 715 a Y = 945
const homeMain = [
  // Flanco Izquierdo (conecta con lateral 3A)
  [[325, 755], [382, 735], [398, 835], [342, 855]],
  // Bloque 44 (Izquierda de Home, grande y ancho, de frente al diamante)
  [[386, 735], [458, 735], [460, 835], [402, 835]],
  // Bloque 45 (Centro absoluto de Home, muy grande y ancho, de frente al diamante)
  [[462, 735], [538, 735], [538, 835], [462, 835]],
  // Bloque 46 (Derecha de Home, grande y ancho, de frente al diamante - reflejo de 44)
  [[542, 735], [614, 735], [598, 835], [540, 835]],
  // Flanco Derecho (conecta con lateral 1A - reflejo de flanco izq)
  [[618, 735], [675, 755], [658, 855], [602, 835]],
];

// Palcos Home (frente al backstop): 2 bloques anchos
const homePalcos = [
  [[430, 702], [497, 702], [497, 730], [430, 730]],
  [[503, 702], [570, 702], [570, 730], [503, 730]],
];

// Numerados Home (detrás de los 3 bloques centrales): 2 bloques
const numeradosHome = [
  [[398, 840], [497, 840], [497, 882], [398, 882]],
  [[503, 840], [602, 840], [602, 882], [503, 882]],
];

// Suite Presidencial y Suites Diamante (fondo centro inferior): 4 bloques
const suitesHome = [
  // Suite Diamante Izquierda
  [[345, 887], [426, 887], [426, 938], [345, 938]],
  // Suite Presidencial Izquierda
  [[430, 887], [497, 887], [497, 938], [430, 938]],
  // Suite Presidencial Derecha
  [[503, 887], [570, 887], [570, 938], [503, 938]],
  // Suite Diamante Derecha
  [[574, 887], [655, 887], [655, 938], [574, 938]],
];

// Comprobación de asignación de IDs de bloque-01 a bloque-79
const allGroups = [
  { name: 'Jardines LF', items: bleachersLF, zone: 'Jardines' },               // 7 bloques (bloque-01 a bloque-07)
  { name: 'Jardines RF', items: bleachersRF, zone: 'Jardines' },               // 7 bloques (bloque-08 a bloque-14)
  { name: 'Especial LF', items: specialLF, zone: 'Zona Especial Jardines' },   // 2 bloques (bloque-15 a bloque-16)
  { name: 'Especial RF', items: specialRF, zone: 'Zona Especial Jardines' },   // 2 bloques (bloque-17 a bloque-18)
  { name: 'Vertical LF', items: vertLF, zone: 'Lateral Superior 3A' },         // 4 bloques (bloque-19 a bloque-22)
  { name: 'Vertical RF', items: vertRF, zone: 'Lateral Superior 1A' },         // 4 bloques (bloque-23 a bloque-26)
  { name: 'Principal LF', items: mainLowerLF, zone: 'Lateral 3A' },            // 5 bloques (bloque-27 a bloque-31)
  { name: 'Principal RF', items: mainLowerRF, zone: 'Lateral 1A' },            // 5 bloques (bloque-32 a bloque-36)
  { name: 'Palcos LF', items: fieldPalcosLF, zone: 'Palcos Campo 3A' },        // 3 bloques (bloque-37 a bloque-39)
  { name: 'Palcos RF', items: fieldPalcosRF, zone: 'Palcos Campo 1A' },        // 3 bloques (bloque-40 a bloque-42)
  { name: 'Central Home', items: homeMain, zone: 'Central Home' },             // 5 bloques (bloque-43 a bloque-47)
  { name: 'Palco Home', items: homePalcos, zone: 'Palco Home' },               // 2 bloques (bloque-48 a bloque-49)
  { name: 'Numerados Home', items: numeradosHome, zone: 'Numerados Home' },     // 2 bloques (bloque-50 a bloque-51)
  { name: 'Suites Home', items: suitesHome, zone: 'Suites Home' },             // 4 bloques (bloque-52 a bloque-55)
  { name: 'Plateas Diag LF', items: plateasLF, zone: 'Plateas 3A' },           // 6 bloques (bloque-56 a bloque-61)
  { name: 'Plateas Diag RF', items: plateasRF, zone: 'Plateas 1A' },           // 6 bloques (bloque-62 a bloque-67)
  { name: 'Suites Diag LF', items: suitesLF, zone: 'Suites 3A' },              // 6 bloques (bloque-68 a bloque-73)
  { name: 'Suites Diag RF', items: suitesRF, zone: 'Suites 1A' },              // 6 bloques (bloque-74 a bloque-79)
];

const ZONE_COLORS = {
  'Jardines': { fill: '#475569', stroke: '#1E293B' },
  'Zona Especial Jardines': { fill: '#1E3A8A', stroke: '#0F172A' },
  'Lateral Superior 3A': { fill: '#0EA5E9', stroke: '#0369A1' },
  'Lateral Superior 1A': { fill: '#0EA5E9', stroke: '#0369A1' },
  'Lateral 3A': { fill: '#38BDF8', stroke: '#0284C7' },
  'Lateral 1A': { fill: '#38BDF8', stroke: '#0284C7' },
  'Palcos Campo 3A': { fill: '#0284C7', stroke: '#0369A1' },
  'Palcos Campo 1A': { fill: '#0284C7', stroke: '#0369A1' },
  'Central Home': { fill: '#0F172A', stroke: '#0284C7' },
  'Palco Home': { fill: '#0369A1', stroke: '#0284C7' },
  'Numerados Home': { fill: '#64748B', stroke: '#334155' },
  'Suites Home': { fill: '#475569', stroke: '#1E293B' },
  'Plateas 3A': { fill: '#9333EA', stroke: '#6B21A8' },
  'Plateas 1A': { fill: '#9333EA', stroke: '#6B21A8' },
  'Suites 3A': { fill: '#64748B', stroke: '#334155' },
  'Suites 1A': { fill: '#64748B', stroke: '#334155' },
};

let counter = 1;
const blockRecords = [];
let minWidth = Infinity, minHeight = Infinity;
let globalMinX = Infinity, globalMaxX = -Infinity, globalMinY = Infinity, globalMaxY = -Infinity;

allGroups.forEach(g => {
  const col = ZONE_COLORS[g.zone] || { fill: '#64748B', stroke: '#334155' };
  g.items.forEach((pts, idx) => {
    const id = `bloque-${String(counter).padStart(2, '0')}`;
    counter++;
    const bb = getBBox(pts);
    const c = getCentroid(pts);

    if (bb.width < minWidth) minWidth = bb.width;
    if (bb.height < minHeight) minHeight = bb.height;
    if (bb.minX < globalMinX) globalMinX = bb.minX;
    if (bb.maxX > globalMaxX) globalMaxX = bb.maxX;
    if (bb.minY < globalMinY) globalMinY = bb.minY;
    if (bb.maxY > globalMaxY) globalMaxY = bb.maxY;

    blockRecords.push({
      id,
      zone: g.zone,
      pathD: polyToPath(pts),
      centerPoint: c,
      fillColor: col.fill,
      strokeColor: col.stroke,
    });
  });
});

console.log(`Total blocks: ${blockRecords.length}`);
console.log(`Min width: ${minWidth.toFixed(1)}px, Min height: ${minHeight.toFixed(1)}px`);
console.log(`Overall bounding box: X [${globalMinX.toFixed(1)}, ${globalMaxX.toFixed(1)}], Y [${globalMinY.toFixed(1)}, ${globalMaxY.toFixed(1)}]`);
console.log(`Overall stadium span: Width = ${(globalMaxX - globalMinX).toFixed(1)}px, Height = ${(globalMaxY - globalMinY).toFixed(1)}px`);
console.log(`Aspect ratio: ${((globalMaxX - globalMinX) / (globalMaxY - globalMinY)).toFixed(2)}`);

fs.writeFileSync('/tmp/tomateros-recomputed-blocks.json', JSON.stringify(blockRecords, null, 2));
