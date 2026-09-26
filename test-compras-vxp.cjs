#!/usr/bin/env node

/**
 * Script de Prueba: Simulador de Compras Múltiples para VXP
 * 
 * Simula 5 compras de boletos en paralelo y registra las ventas
 * en Firestore a través del servidor backend local (puerto 3000).
 */

const http = require('http');
const fs = require('fs');

const CONFIG = {
  baseUrl: 'http://localhost:3000',
  endpoint: '/api/stripe/processDirectPayment',
  eventId: 'event-temporada-2026',
  venueId: 'venue-teodoro-mariscal',
  cardLast4: '4242',
  cardBrand: 'Visa',
};

const compras = [
  {
    id: 1,
    amount: 1500,
    concept: '2x Boletos Zona Preferente (Venados vs Cañeros)',
    customerName: 'Cliente Test 1',
    customerEmail: 'test1@vxp.local',
    seats: 'sec104_a1,sec104_a2',
  },
  {
    id: 2,
    amount: 1600,
    concept: '2x Boletos Zona Platino + 1x Diamante',
    customerName: 'Cliente Test 2',
    customerEmail: 'test2@vxp.local',
    seats: 'sec104_b1,sec105_a5,sec105_a6',
  },
  {
    id: 3,
    amount: 2000,
    concept: '4x Boletos Zona Deluxe Supreme',
    customerName: 'Cliente Test 3',
    customerEmail: 'test3@vxp.local',
    seats: 'sec200_c1,sec200_c2,sec200_c3,sec200_c4',
  },
  {
    id: 4,
    amount: 900,
    concept: '1x Boleto Zona Sky Plus',
    customerName: 'Cliente Test 4',
    customerEmail: 'test4@vxp.local',
    seats: 'sec300_a1',
  },
  {
    id: 5,
    amount: 1200,
    concept: '2x Boletos Zona Fan',
    customerName: 'Cliente Test 5',
    customerEmail: 'test5@vxp.local',
    seats: 'sec150_b3,sec150_b4',
  },
];

function hacerCompra(datosCompra) {
  return new Promise((resolve, reject) => {
    const payload = {
      amount: datosCompra.amount,
      concept: datosCompra.concept,
      customerName: datosCompra.customerName,
      customerEmail: datosCompra.customerEmail,
      cardLast4: CONFIG.cardLast4,
      cardBrand: CONFIG.cardBrand,
      orderType: 'boletos',
      metadata: {
        eventId: CONFIG.eventId,
        venueId: CONFIG.venueId,
        seatIds: datosCompra.seats,
        testMode: true,
        timestamp: new Date().toISOString(),
      },
    };

    const dataString = JSON.stringify(payload);
    const url = new URL(CONFIG.baseUrl + CONFIG.endpoint);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString),
        'User-Agent': 'VXP-TestScript/1.0',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const responseData = JSON.parse(body);
          resolve({
            compraId: datosCompra.id,
            statusCode: res.statusCode,
            success: res.statusCode >= 200 && res.statusCode < 300,
            response: responseData,
            timestamp: new Date().toISOString(),
          });
        } catch (e) {
          resolve({
            compraId: datosCompra.id,
            statusCode: res.statusCode,
            success: false,
            error: 'No se pudo parsear la respuesta',
            rawBody: body.substring(0, 200),
            timestamp: new Date().toISOString(),
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        compraId: datosCompra.id,
        statusCode: 500,
        success: false,
        error: e.message,
        timestamp: new Date().toISOString(),
      });
    });

    req.write(dataString);
    req.end();
  });
}

async function ejecutarPrueba() {
  console.log('\n🚀 Iniciando prueba de compras en VXP (localhost:3000)...');
  const inicio = Date.now();
  const resultados = await Promise.all(compras.map(c => hacerCompra(c)));
  const tiempoTotal = Date.now() - inicio;

  console.log('\n' + '='.repeat(80));
  console.log('📊 REPORTE DE PRUEBA DE COMPRAS - VXP');
  console.log('='.repeat(80) + '\n');

  const exitosas = resultados.filter(r => r.success).length;
  console.log(`✅ Compras Exitosas: ${exitosas}/${resultados.length}`);
  console.log(`❌ Compras Fallidas: ${resultados.length - exitosas}/${resultados.length}`);

  const totalRecaudado = resultados
    .filter(r => r.success)
    .reduce((sum, r) => sum + (r.response?.amount || 0), 0);

  console.log(`💰 Total Recaudado: $${totalRecaudado} MXN\n`);

  resultados.forEach(r => {
    const icon = r.success ? '✅' : '❌';
    const c = compras.find(item => item.id === r.compraId);
    console.log(`${icon} COMPRA #${r.compraId} (${c.customerName}) - $${c.amount} MXN - Status: ${r.statusCode}`);
    if (r.success) {
      console.log(`   ✓ ID Transacción: ${r.response?.paymentIntentId || 'N/A'} | Auth: ${r.response?.authCode || 'N/A'}`);
    } else {
      console.log(`   ✗ Error: ${r.error || r.response?.error || 'Desconocido'}`);
    }
  });

  fs.writeFileSync('./reporte-prueba-vxp.json', JSON.stringify(resultados, null, 2));
  console.log(`\n📄 Reporte guardado en reporte-prueba-vxp.json. Tiempo: ${(tiempoTotal/1000).toFixed(2)}s\n`);
}

ejecutarPrueba();
