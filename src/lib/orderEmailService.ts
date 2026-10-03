import { FoodOrder, Ticket, StadiumStand } from '../types';
import { DEFAULT_VENUE_ID } from './defaultVenue';
import { auth } from './firebase';

export interface HostEmailPayload {
  orderType: 'food' | 'ticket' | 'merch';
  hostName: string;
  hostEmail: string;
  customerName: string;
  customerEmail?: string;
  orderIdOrCode: string;
  date: string;
  subject: string;
  bodyText: string;
  htmlBody: string;
  summary: {
    total: number;
    paymentMethod: string;
    itemsCount: number;
    destinationOrSeat?: string;
    venueName?: string;
    gate?: string;
    zoneSection?: string;
    row?: string;
    seat?: string;
    eventTitle?: string;
  };
}

/**
 * Genera el template HTML con el formato idéntico al pase digital oficial / tarjeta
 * incluyendo aviso de seguridad anticapturas para el código QR estático de auditoría.
 */
export function generateHostDigitalPassHtml(data: {
  badgeTitle: string;
  eventTitle: string;
  leagueOrCategory: string;
  qrCodeValue: string;
  orderCode: string;
  eventDateText: string;
  venueName: string;
  zoneSection: string;
  rowNumber: string;
  seatNumber: string;
  gate: string;
  totalAmountFormatted: string;
  referenceId: string;
  customerName: string;
  customerEmail?: string;
  notesOrItemsHtml?: string;
}): string {
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    data.qrCodeValue
  )}&bgcolor=ffffff&color=000000&margin=2`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.eventTitle}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #050811; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <div style="max-width: 480px; margin: 0 auto; background-color: #0A0E17; border-radius: 28px; overflow: hidden; border: 1px solid #1E293B; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
    
    <!-- Barra Superior Arcoíris Oficial -->
    <div style="height: 6px; width: 100%; background: linear-gradient(90deg, #EF4444 0%, #F59E0B 35%, #10B981 70%, #06B6D4 100%);"></div>

    <div style="padding: 24px 20px 20px; text-align: center;">
      
      <!-- Badge Superior Pase Digital -->
      <div style="display: inline-block; padding: 5px 14px; background-color: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 9999px; margin-bottom: 14px;">
        <span style="color: #EF4444; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px;">
          🎟️ ${data.badgeTitle}
        </span>
      </div>

      <!-- Título Principal del Evento / Orden -->
      <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: 900; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.25;">
        ${data.eventTitle}
      </h1>
      <p style="margin: 0 0 20px 0; font-size: 12px; color: #94A3B8; font-weight: 500;">
        ${data.leagueOrCategory}
      </p>

      <!-- Contenedor Código QR Blanco Centrado -->
      <div style="background-color: #ffffff; border-radius: 24px; padding: 14px; display: inline-block; margin: 0 auto 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <img src="${qrImageUrl}" alt="Código QR de Auditoría" width="210" height="210" style="display: block; border-radius: 12px; margin: 0 auto;" />
      </div>

      <!-- Badge del Código de Texto -->
      <div style="display: inline-block; background-color: #101625; border: 1px solid #1E293B; border-radius: 12px; padding: 8px 18px; margin-bottom: 8px;">
        <span style="font-family: monospace; font-size: 15px; font-weight: 900; color: #ffffff; letter-spacing: 2px;">
          ${data.orderCode}
        </span>
      </div>

      <!-- Indicación Molinete -->
      <p style="margin: 0 0 12px 0; font-size: 10px; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px;">
        COMPROBANTE OFICIAL PARA EL ANFITRIÓN
      </p>

      <!-- ADVERTENCIA DE SEGURIDAD ANTICAPTURAS -->
      <div style="background-color: rgba(245, 158, 11, 0.1); border: 1px dashed rgba(245, 158, 11, 0.4); border-radius: 14px; padding: 10px 12px; margin-bottom: 18px; text-align: left;">
        <div style="color: #F59E0B; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">
          🛡️ AVISO DE SEGURIDAD ANTICAPTURA
        </div>
        <p style="margin: 0; color: #CBD5E1; font-size: 10px; line-height: 1.4;">
          Este código QR estático es un comprobante de auditoría emitido al anfitrión. <strong>No funciona para acceder al estadio por molinete</strong>, ya que el ingreso físico requiere el código QR dinámico de alta seguridad generado en tiempo real dentro de la app oficial.
        </p>
      </div>

      <!-- Línea Divisoria Punteada Tipo Boleto con Muescas -->
      <div style="border-top: 2px dashed #1E293B; margin: 18px -20px 20px; position: relative;"></div>

      <!-- Fecha y Hora -->
      <div style="text-align: left; margin-bottom: 14px;">
        <div style="font-size: 9px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px;">
          FECHA Y HORA DEL EVENTO / COMPRA
        </div>
        <div style="font-size: 14px; font-weight: 900; color: #ffffff;">
          ${data.eventDateText}
        </div>
      </div>

      <!-- Recinto / Estadio -->
      <div style="text-align: left; margin-bottom: 18px;">
        <div style="font-size: 9px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px;">
          RECINTO
        </div>
        <div style="font-size: 14px; font-weight: 900; color: #ffffff;">
          📍 ${data.venueName}
        </div>
      </div>

      <!-- Caja de Asignación de Butacas (3 Columnas) -->
      <div style="text-align: left; margin-bottom: 18px;">
        <div style="font-size: 9px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
          ASIGNACIÓN / DETALLE DE LOCALIDAD
        </div>
        
        <table style="width: 100%; border-collapse: separate; border-spacing: 0; background-color: #0F1626; border: 1px solid #1E293B; border-radius: 16px; overflow: hidden;">
          <tr>
            <td style="padding: 12px 10px; width: 40%; border-right: 1px solid #1E293B; vertical-align: middle;">
              <div style="font-size: 8px; font-weight: 800; color: #64748B; text-transform: uppercase;">ZONA / SECCIÓN</div>
              <div style="font-size: 12px; font-weight: 900; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">
                ${data.zoneSection}
              </div>
            </td>
            <td style="padding: 12px 10px; width: 28%; border-right: 1px solid #1E293B; vertical-align: middle; text-align: center;">
              <div style="font-size: 8px; font-weight: 800; color: #64748B; text-transform: uppercase;">FILA</div>
              <div style="font-size: 13px; font-weight: 900; color: #F59E0B; margin-top: 2px;">
                ${data.rowNumber}
              </div>
            </td>
            <td style="padding: 12px 10px; width: 32%; vertical-align: middle; text-align: center;">
              <div style="font-size: 8px; font-weight: 800; color: #64748B; text-transform: uppercase;">BUTACA / AS.</div>
              <div style="font-size: 13px; font-weight: 900; color: #EF4444; margin-top: 2px;">
                ${data.seatNumber}
              </div>
            </td>
          </tr>
        </table>
      </div>

      ${
        data.notesOrItemsHtml
          ? `
      <!-- Detalle Adicional de Productos / Artículos -->
      <div style="text-align: left; margin-bottom: 18px; background-color: #0F1626; border: 1px solid #1E293B; border-radius: 16px; padding: 12px;">
        ${data.notesOrItemsHtml}
      </div>`
          : ''
      }

      <!-- Resumen Inferior: Puerta, Total y Autenticación -->
      <table style="width: 100%; border-collapse: separate; border-spacing: 0; background-color: #0F1626; border: 1px solid #1E293B; border-radius: 16px; margin-bottom: 16px;">
        <tr>
          <td style="padding: 12px 14px; text-align: left; vertical-align: middle;">
            <div style="font-size: 9px; color: #94A3B8;">Puerta de ingreso:</div>
            <div style="font-size: 12px; font-weight: 900; color: #ffffff; margin-top: 2px;">
              ${data.gate}
            </div>
          </td>
          <td style="padding: 12px 14px; text-align: right; vertical-align: middle;">
            <div style="font-size: 9px; color: #94A3B8;">Total:</div>
            <div style="font-size: 16px; font-weight: 900; color: #10B981; margin-top: 2px; font-family: monospace;">
              ${data.totalAmountFormatted}
            </div>
          </td>
        </tr>
      </table>

      <!-- Pie de Seguridad y Auditoría -->
      <table style="width: 100%; font-size: 10px; color: #64748B; margin-top: 10px;">
        <tr>
          <td style="text-align: left;">
            Ref: <strong style="color: #94A3B8;">${data.referenceId}</strong>
          </td>
          <td style="text-align: right; color: #10B981; font-weight: 800;">
            🛡️ Autenticado por Stripe
          </td>
        </tr>
      </table>

      <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #1E293B; font-size: 9px; color: #475569; text-align: center;">
        Cliente: ${data.customerName} ${data.customerEmail ? `(${data.customerEmail})` : ''} • Venue Experience Platform
      </div>

    </div>
  </div>
</body>
</html>
`;
}

/**
 * Genera el paquete completo de correo electrónico para el anfitrión / concesionario
 * a partir de un pedido de alimentos (comanda de stand).
 */
export function buildFoodOrderHostEmail(
  orders: FoodOrder[],
  stand?: StadiumStand | null,
  venueName: string = 'Estadio Teodoro Mariscal'
): HostEmailPayload {
  const primaryOrder = orders[0];
  const allCount = orders.length;
  const totalAmount = orders.reduce((sum, o) => sum + o.total, 0);
  const nowFormatted = new Date().toLocaleString('es-MX', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const hostName = stand?.ownerName || stand?.name || primaryOrder?.standName || 'Anfitrión de Concesión';
  const hostEmail =
    stand?.contactEmail ||
    'concesiones@venadosmazatlan.com';

  const orderCodes = orders.map((o) => o.pickupCode).join(', ');
  const subject = `[ORDEN DE COMPRA] ${primaryOrder.pickupCode} — ${primaryOrder.standName} ($${totalAmount.toFixed(2)} MXN)`;

  // Desglose de artículos
  const sectionsText = orders
    .map((ord, idx) => {
      const itemsList = ord.items
        .map(
          (i) =>
            `  • ${i.quantity}x ${i.name.padEnd(28, ' ')} - $${(i.price * i.quantity).toFixed(2)} MXN ${
              i.notes ? `(Nota: ${i.notes})` : ''
            }`
        )
        .join('\n');

      const modalText =
        ord.orderType === 'in-seat'
          ? `📍 ENTREGA EN BUTACA: Sección ${ord.section || 'General'}, Fila ${ord.row || '-'}, Asiento ${ord.seat || '-'}`
          : '⚡ MODALIDAD: Retiro Express en Mostrador / Barra';

      return `=======================================================
COMANDA #${idx + 1} DE ${allCount} | STAND: ${ord.standName.toUpperCase()}
CÓDIGO DE RETIRO / ENTREGA: [ ${ord.pickupCode} ]
${modalText}
-------------------------------------------------------
ARTÍCULOS ORDENADOS:
${itemsList}

SUBTOTAL NEGOCIO: $${ord.total.toFixed(2)} MXN
ESTADO DE PAGO: ${ord.paymentStatus === 'pagado' ? 'PAGADO (STRIPE SSL APROBADO)' : 'PENDIENTE / COBRO EN SITIO'}
=======================================================`;
    })
    .join('\n\n');

  const destinationText =
    primaryOrder.orderType === 'in-seat'
      ? `Entrega en Butaca (Sec. ${primaryOrder.section || '-'}, Fila ${primaryOrder.row || '-'}, As. ${primaryOrder.seat || '-'})`
      : 'Pick Up Express en Barra';

  const bodyText = `Estimado(a) ${hostName},

Se ha generado y confirmado una nueva ORDEN DE COMPRA a través de la plataforma oficial de ${venueName}.

A continuación se detallan los datos de la comanda para su inmediata preparación y despacho:

=======================================================
             RESUMEN OFICIAL DE COMPRA
=======================================================
FECHA Y HORA:      ${nowFormatted}
SEDE / ESTADIO:    ${venueName}
CLIENTE:           ${primaryOrder.customerName || 'Aficionado Registrado'}
${primaryOrder.userId ? `ID DE USUARIO:     ${primaryOrder.userId}\n` : ''}CÓDIGO(S):         ${orderCodes}
MÉTODO DE PAGO:    ${primaryOrder.paymentMethod || 'Tarjeta en Línea (Stripe SSL)'}
TOTAL CONSOLIDADO: $${totalAmount.toFixed(2)} MXN
=======================================================

DETALLE DE COMANDAS:

${sectionsText}

INSTRUCCIONES PARA EL ANFITRIÓN / COCINA:
1. Comience la preparación de los platillos solicitados de inmediato.
2. Si el pedido es "Retiro Express en Mostrador", marque el pedido como LISTO en su panel de Concesionario para notificar al cliente.
3. Si el pedido es "Entrega en Butaca", asigne la comanda al Runner disponible para llevar los alimentos al asiento indicado.

Este comprobante electrónico fue generado automáticamente por Venue Experience Platform (VXP).
`;

  const itemsHtml = `
    <div style="font-size: 9px; font-weight: 800; color: #64748B; text-transform: uppercase; margin-bottom: 6px;">ARTÍCULOS DE LA COMANDA:</div>
    ${orders
      .map(
        (ord) => `
        <div style="margin-bottom: 6px; font-size: 11px; color: #ffffff;">
          <strong style="color: #EF4444;">${ord.standName}:</strong>
          ${ord.items.map((i) => `<div style="padding-left: 8px; color: #CBD5E1;">• ${i.quantity}x ${i.name} ($${(i.price * i.quantity).toFixed(2)} MXN)</div>`).join('')}
        </div>
      `
      )
      .join('')}
  `;

  const htmlBody = generateHostDigitalPassHtml({
    badgeTitle: 'ORDEN OFICIAL DE COMIDA',
    eventTitle: primaryOrder.standName.toUpperCase(),
    leagueOrCategory: `${venueName} • Concesión Gastronómica`,
    qrCodeValue: primaryOrder.pickupCode,
    orderCode: primaryOrder.pickupCode,
    eventDateText: nowFormatted,
    venueName,
    zoneSection: primaryOrder.orderType === 'in-seat' ? (primaryOrder.section || 'General') : 'Mostrador Express',
    rowNumber: primaryOrder.orderType === 'in-seat' ? (primaryOrder.row || '-') : 'Barra',
    seatNumber: primaryOrder.orderType === 'in-seat' ? (primaryOrder.seat || '-') : 'Pickup',
    gate: primaryOrder.orderType === 'in-seat' ? 'Runner Butaca' : 'Barra de Concesionario',
    totalAmountFormatted: `$${totalAmount.toFixed(2)} MXN`,
    referenceId: `#FOOD-${primaryOrder.id.slice(-6).toUpperCase()}`,
    customerName: primaryOrder.customerName || 'Aficionado',
    notesOrItemsHtml: itemsHtml,
  });

  return {
    orderType: 'food',
    hostName,
    hostEmail,
    customerName: primaryOrder.customerName || 'Aficionado',
    customerEmail: (primaryOrder as any).customerEmail || auth.currentUser?.email || undefined,
    orderIdOrCode: orderCodes,
    date: nowFormatted,
    subject,
    bodyText,
    htmlBody,
    summary: {
      total: totalAmount,
      paymentMethod: primaryOrder.paymentMethod || 'Tarjeta en Línea',
      itemsCount: orders.reduce((s, o) => s + o.items.reduce((si, it) => si + it.quantity, 0), 0),
      destinationOrSeat: destinationText,
      venueName,
      gate: primaryOrder.orderType === 'in-seat' ? 'Entrega Butaca' : 'Barra Mostrador',
      zoneSection: primaryOrder.section || 'General',
      row: primaryOrder.row || '-',
      seat: primaryOrder.seat || '-',
      eventTitle: primaryOrder.standName,
    },
  };
}

/**
 * Genera el paquete de correo para el anfitrión / organizador para compra de boletos
 */
export function buildTicketOrderHostEmail(
  tickets: Ticket[],
  venueName: string = 'Estadio Teodoro Mariscal',
  hostEmail: string = 'boletos@venadosmazatlan.com'
): HostEmailPayload {
  const primary = tickets[0];
  const total = tickets.reduce((s, t) => s + (t.price || 0), 0);
  const nowFormatted = new Date().toLocaleString('es-MX', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const eventTitle = (primary?.matchTitle || 'VENADOS DE MAZATLÁN VS TOMATEROS DE CULIACÁN').toUpperCase();
  const subject = `[COMPRA DE BOLETOS] Acceso #${primary?.qrId || primary?.id} — ${primary?.stadium || venueName} (${tickets.length} boletos)`;

  const ticketsDetail = tickets
    .map(
      (t, idx) =>
        `• Boleto #${idx + 1}: ${t.matchTitle || 'Evento Deportivo'} | Sec: ${t.section || '-'} | Fila: ${t.row || '-'} | Asiento: ${
          t.seat || '-'
        } | $${t.price} MXN (ID: ${t.id} - QR: ${t.qrId || t.id})`
    )
    .join('\n');

  const bodyText = `Estimado Anfitrión / Taquilla ${venueName},

Se ha confirmado una compra exitosa de accesos/boletos para el evento:

EVENTO:         ${eventTitle}
SEDE:           ${primary?.stadium || venueName}
FECHA COMPRA:   ${nowFormatted}
CLIENTE:        ${primary?.customerName || 'Aficionado'}
CANTIDAD:       ${tickets.length} acceso(s)
TOTAL PAGADO:   $${total.toFixed(2)} MXN
ESTADO:         PAGADO (STRIPE SSL APROBADO)

DETALLE DE LOCALIDADES:
${ticketsDetail}

Este correo es un comprobante de auditoría de venta de accesos generado automáticamente por el sistema.
`;

  const itemsHtml = `
    <div style="font-size: 9px; font-weight: 800; color: #64748B; text-transform: uppercase; margin-bottom: 6px;">LOCALIDADES ADQUIRIDAS (${tickets.length} BOLETOS):</div>
    ${tickets
      .map(
        (t, idx) => `
        <div style="font-size: 11px; color: #ffffff; margin-bottom: 4px;">
          <span style="color: #F59E0B; font-weight: 800;">#${idx + 1}:</span> ${t.section} • Fila ${t.row} • Asiento ${t.seat} — <strong style="color: #10B981;">$${t.price} MXN</strong> <span style="font-size: 9px; color: #94A3B8;">(${t.qrId || t.id})</span>
        </div>
      `
      )
      .join('')}
  `;

  const htmlBody = generateHostDigitalPassHtml({
    badgeTitle: 'PASE DIGITAL OFICIAL',
    eventTitle,
    leagueOrCategory: 'Liga ARCO Mexicana del Pacífico',
    qrCodeValue: primary?.qrId || `VND-2026-TKT-${primary?.id?.slice(-7).toUpperCase() || 'OFFICIAL'}`,
    orderCode: primary?.qrId || `VND-2026-TKT-${primary?.id?.slice(-7).toUpperCase() || 'OFFICIAL'}`,
    eventDateText: primary?.matchDate ? `${primary.matchDate} • 18:00 HRS` : `${nowFormatted}`,
    venueName: primary?.stadium || venueName,
    zoneSection: primary?.section || 'DIAMANTE',
    rowNumber: primary?.row ? `Fila ${primary.row}` : 'Fila A',
    seatNumber: primary?.seat ? `Asiento ${primary.seat}` : 'Asiento 1',
    gate: primary?.gate || 'Puertas 1 y 2',
    totalAmountFormatted: `$${total.toFixed(2)} MXN`,
    referenceId: `#${primary?.id?.slice(-7).toUpperCase() || 'AVVOW'}`,
    customerName: primary?.customerName || 'Aficionado',
    notesOrItemsHtml: tickets.length > 1 ? itemsHtml : undefined,
  });

  return {
    orderType: 'ticket',
    hostName: 'Administración de Taquilla',
    hostEmail,
    customerName: primary?.customerName || 'Aficionado',
    customerEmail: primary?.customerEmail || auth.currentUser?.email || undefined,
    orderIdOrCode: tickets.map((t) => t.qrId || t.id.slice(-6)).join(', '),
    date: nowFormatted,
    subject,
    bodyText,
    htmlBody,
    summary: {
      total,
      paymentMethod: 'Tarjeta en Línea (Stripe SSL)',
      itemsCount: tickets.length,
      destinationOrSeat: `${tickets.length} localidad(es) asignadas`,
      venueName,
      gate: primary?.gate || 'Puertas 1 y 2',
      zoneSection: primary?.section || 'DIAMANTE',
      row: primary?.row || 'Fila A',
      seat: primary?.seat || 'Asiento 1',
      eventTitle,
    },
  };
}

/**
 * Envía automáticamente la orden por correo al anfitrión en background
 */
export async function sendHostOrderEmailAutomatically(
  payload: HostEmailPayload
): Promise<{ success: boolean; dispatchId?: string; error?: string }> {
  try {
    const res = await fetch('/api/send-host-order-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderType: payload.orderType,
        hostName: payload.hostName,
        hostEmail: payload.hostEmail,
        customerName: payload.customerName,
        customerEmail: payload.customerEmail,
        orderIdOrCode: payload.orderIdOrCode,
        subject: payload.subject,
        htmlBody: payload.htmlBody,
        bodyText: payload.bodyText,
        summary: payload.summary,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return { success: false, error: errJson.error || `HTTP ${res.status}` };
    }

    const json = await res.json();
    return { success: true, dispatchId: json.dispatchId };
  } catch (err: any) {
    console.warn('Advertencia en sendHostOrderEmailAutomatically:', err?.message);
    return { success: false, error: err?.message || 'Error de red' };
  }
}

/**
 * Genera el enlace mailto: listo para abrir en el cliente de correo
 */
export function generateMailtoUrl(toEmail: string, subject: string, body: string): string {
  const cleanTo = (toEmail || '').trim();
  const encSub = encodeURIComponent(subject);
  const encBody = encodeURIComponent(body);
  return `mailto:${cleanTo}?subject=${encSub}&body=${encBody}`;
}

export { generateGmailComposeUrl, sendEmailViaGmailApi } from './gmailService';
