// scripts/test_refinement.cjs
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
// 1. JARDINES (BLEACHERS Y ZONA ESPECIAL PEGADOS A LA BARDA)
// ============================================================================
const uJardines = [0.7071, -0.7071];
const nJardines = [-0.7071, -0.7071];

// Zona Especial LF (2 bloques pegados a la barda)
const specialLF = [];
const startSpecial = [256, 308];
const specLen = 94;
const specGap = 2.5;
for (let i = 0; i < 2; i++) {
  const s0 = i * (specLen + specGap);
  const p1 = [startSpecial[0] + s0 * uJardines[0], startSpecial[1] + s0 * uJardines[1]];
  const p2 = [p1[0] + specLen * uJardines[0], p1[1] + specLen * uJardines[1]];
  const p3 = [p2[0] + 19 * nJardines[0], p2[1] + 19 * nJardines[1]];
  const p4 = [p1[0] + 19 * nJardines[0], p1[1] + 19 * nJardines[1]];
  specialLF.push([p1, p2, p3, p4].map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]));
}
const specialRF = specialLF.map(pts => flipX(pts).reverse());

// Bleachers LF (7 bloques pegados detrás de Zona Especial)
const bleachersLF = [];
const startBleach = [248, 316];
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

// ============================================================================
// 2. PILAS LATERALES (4 BLOQUES AZUL CLARO EN CADA COSTADO, SIN SLIVERS)
// ============================================================================
// Pegadas al costado del campo (outfield lateral X=[175, 248], Y=[312, 472])
const vertLF = [];
const vTop = 312;
const vHeight = 37.5;
const vGap = 2.5;
for (let i = 0; i < 4; i++) {
  const y1 = vTop + i * (vHeight + vGap);
  const y2 = y1 + vHeight;
  vertLF.push([
    [175, y1], [248, y1], [248, y2], [175, y2]
  ].map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]));
}
const vertRF = vertLF.map(pts => flipX(pts).reverse());

// ============================================================================
// 3. ALAS DIAGONALES (45°, PEGADAS A 4 PX DE LA LÍNEA DE FOUL, SIN HUECOS)
// ============================================================================
const uFoul = [-0.7071, -0.7071];
const nFoul = [-0.7071, 0.7071];

// Línea base en el origen del foul territory: (475, 640)
// Foul line va de (500, 665) a (265, 430). Distancia a la línea base = 4px
const pBase_3B = [472, 637];

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

// Longitud ajustada para que las alas lleguen exactamente a la base de la pila lateral (Y=475)
const lateralLen = 228;

// Franja 1: Palcos Campo 3A (3 bloques, d=4px a 26px desde la línea)
const fieldPalcosLF = createParallelStrip(pBase_3B, uFoul, nFoul, lateralLen, 3, 4, 26, 2.5);
const fieldPalcosRF = fieldPalcosLF.map(pts => flipX(pts).reverse());

// Franja 2: Gradas Principales Lateral 3A (5 bloques, d=29px a 85px)
const mainLowerLF = createParallelStrip(pBase_3B, uFoul, nFoul, lateralLen, 5, 29, 85, 2.5);
const mainLowerRF = mainLowerLF.map(pts => flipX(pts).reverse());

// Franja 3: Plateas 3A (6 bloques, d=88px a 128px)
const plateasLF = createParallelStrip(pBase_3B, uFoul, nFoul, lateralLen, 6, 88, 128, 2.5);
const plateasRF = plateasLF.map(pts => flipX(pts).reverse());

// Franja 4: Suites 3A (6 bloques, d=131px a 174px)
const suitesLF = createParallelStrip(pBase_3B, uFoul, nFoul, lateralLen, 6, 131, 174, 2.5);
const suitesRF = suitesLF.map(pts => flipX(pts).reverse());

// ============================================================================
// 4. DETRÁS DE HOME: 3 GRANDES ANCHOS AL CENTRO + FLANCOS EN ABANICO (7 BLOQUES)
// Espacio libre de 18px hasta el home plate (Y>=690)
// ============================================================================
// Los 7 bloques forman la corona principal de Home:
// bloque-48 (extremo izq), bloque-43 (flanco izq), bloque-44 (centro-izq),
// bloque-45 (centro absoluto), bloque-46 (centro-der), bloque-47 (flanco der), bloque-49 (extremo der)
const homeMain = [
  // bloque-43: Flanco Izquierdo
  [[328, 705], [392, 695], [402, 785], [338, 795]],
  // bloque-44: Centro-Izquierda (Grande y ancho, de frente al diamante)
  [[396, 695], [463, 692], [463, 785], [406, 785]],
  // bloque-45: Centro Absoluto (Grande y ancho, de frente al diamante)
  [[466, 692], [534, 692], [534, 785], [466, 785]],
  // bloque-46: Centro-Derecha (Grande y ancho, de frente al diamante)
  [[537, 692], [604, 695], [594, 785], [537, 785]],
  // bloque-47: Flanco Derecho
  [[608, 695], [672, 705], [662, 795], [598, 785]],
];

// Extremos en abanico que conectan con las alas a 45°:
// bloque-48 (conecta a 3B) y bloque-49 (conecta a 1B)
const homeWings = [
  // bloque-48: Abanico exterior 3B
  [[262, 720], [325, 706], [335, 796], [272, 810]],
  // bloque-49: Abanico exterior 1B
  [[675, 706], [738, 720], [728, 810], [665, 796]],
];

// ============================================================================
// 5. FRANJA CONTINUA DE SUITES DEBAJO DE HOME (6 BLOQUES CONTINUOS, SIN LADRILLOS SUELTOS)
// bloque-50 a bloque-55 en una sola franja horizontal limpia de Y=[790, 845]
// ============================================================================
const suitesHomeRow = [];
const sHomeX1 = 295;
const sHomeTotalW = 410;
const sHomeBlockW = (sHomeTotalW - 5 * 2.5) / 6;
for (let i = 0; i < 6; i++) {
  const x1 = sHomeX1 + i * (sHomeBlockW + 2.5);
  const x2 = x1 + sHomeBlockW;
  suitesHomeRow.push([
    [x1, 790], [x2, 790], [x2, 845], [x1, 845]
  ].map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]));
}

// Separación de suitesHomeRow en 2 bloques (bloque-50, 51) y 4 bloques (bloque-52..55)
const numeradosHome = [suitesHomeRow[0], suitesHomeRow[1]];
const suitesHome = [suitesHomeRow[2], suitesHomeRow[3], suitesHomeRow[4], suitesHomeRow[5]];

// ============================================================================
// COMPILACIÓN DE TODOS LOS 79 BLOQUES EN EL ORDEN EXACTO
// ============================================================================
const allGroups = [
  { name: 'Jardines LF', items: bleachersLF, zone: 'Jardines' },               // 7 bloques: bloque-01 a bloque-07
  { name: 'Jardines RF', items: bleachersRF, zone: 'Jardines' },               // 7 bloques: bloque-08 a bloque-14
  { name: 'Especial LF', items: specialLF, zone: 'Zona Especial Jardines' },   // 2 bloques: bloque-15 a bloque-16
  { name: 'Especial RF', items: specialRF, zone: 'Zona Especial Jardines' },   // 2 bloques: bloque-17 a bloque-18
  { name: 'Vertical LF', items: vertLF, zone: 'Lateral Superior 3A' },         // 4 bloques: bloque-19 a bloque-22
  { name: 'Vertical RF', items: vertRF, zone: 'Lateral Superior 1A' },         // 4 bloques: bloque-23 a bloque-26
  { name: 'Principal LF', items: mainLowerLF, zone: 'Lateral 3A' },            // 5 bloques: bloque-27 a bloque-31
  { name: 'Principal RF', items: mainLowerRF, zone: 'Lateral 1A' },            // 5 bloques: bloque-32 a bloque-36
  { name: 'Palcos LF', items: fieldPalcosLF, zone: 'Palcos Campo 3A' },        // 3 bloques: bloque-37 a bloque-39
  { name: 'Palcos RF', items: fieldPalcosRF, zone: 'Palcos Campo 1A' },        // 3 bloques: bloque-40 a bloque-42
  { name: 'Central Home', items: homeMain, zone: 'Central Home' },             // 5 bloques: bloque-43 a bloque-47
  { name: 'Palco Home', items: homeWings, zone: 'Central Home' },              // 2 bloques: bloque-48 a bloque-49
  { name: 'Numerados Home', items: numeradosHome, zone: 'Suites Home' },       // 2 bloques: bloque-50 a bloque-51
  { name: 'Suites Home', items: suitesHome, zone: 'Suites Home' },             // 4 bloques: bloque-52 a bloque-55
  { name: 'Plateas Diag LF', items: plateasLF, zone: 'Plateas 3A' },           // 6 bloques: bloque-56 a bloque-61
  { name: 'Plateas Diag RF', items: plateasRF, zone: 'Plateas 1A' },           // 6 bloques: bloque-62 a bloque-67
  { name: 'Suites Diag LF', items: suitesLF, zone: 'Suites 3A' },              // 6 bloques: bloque-68 a bloque-73
  { name: 'Suites Diag RF', items: suitesRF, zone: 'Suites 1A' },              // 6 bloques: bloque-74 a bloque-79
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
  g.items.forEach((pts) => {
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

fs.writeFileSync('/tmp/tomateros-perfect-blocks.json', JSON.stringify(blockRecords, null, 2));
