import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Printer,
  Ticket as TicketIcon,
  CreditCard,
  Banknote,
  QrCode,
  Sparkles,
  RotateCcw,
  FileText,
  CheckCircle2,
  Building2,
  AlertTriangle,
  Calendar,
  MapPin,
  Clock,
  Plus,
  Minus,
  Trash2,
  Receipt,
  User,
  Search,
  DollarSign,
  ShieldCheck,
  Percent,
  X,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { UserProfile, Ticket, VenueEvent } from '../../types';
import { QRCodeDisplay } from '../../components/shared/QRCodeDisplay';
import { createPosTicketBatch, PosTicketItemRequest } from '../../lib/tickets';
import { DEFAULT_EVENT_ID, DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { SeatMapSelector } from '../aficionado/SeatMapSelector';
import { SeatPurchaseItem } from '../../lib/seatMap';

interface TaquilleraPOSViewProps {
  user: UserProfile;
}

interface CartItem {
  id: string;
  section: string;
  price: number;
  row: string;
  seatStart: number;
  quantity: number;
  gate: string;
}

const EVENTS_CATALOG = [
  {
    id: DEFAULT_EVENT_ID,
    matchTitle: 'Venados de Mazatlán vs Tomateros de Culiacán',
    opponent: 'Tomateros de Culiacán',
    matchDate: '2026-10-15',
    matchTime: '20:00 hrs',
    stadium: 'Estadio Teodoro Mariscal',
    venueId: DEFAULT_VENUE_ID,
    status: 'Inauguración de Temporada',
  },
  {
    id: 'event-naranjeros-2026',
    matchTitle: 'Venados de Mazatlán vs Naranjeros de Hermosillo',
    opponent: 'Naranjeros de Hermosillo',
    matchDate: '2026-10-22',
    matchTime: '19:30 hrs',
    stadium: 'Estadio Teodoro Mariscal',
    venueId: DEFAULT_VENUE_ID,
    status: 'Serie de Fin de Semana',
  },
  {
    id: 'event-cañeros-2026',
    matchTitle: 'Venados de Mazatlán vs Cañeros de Los Mochis',
    opponent: 'Cañeros de Los Mochis',
    matchDate: '2026-10-28',
    matchTime: '20:00 hrs',
    stadium: 'Estadio Teodoro Mariscal',
    venueId: DEFAULT_VENUE_ID,
    status: 'Serie Regular',
  },
];

const SECTIONS_CONFIG = [
  {
    name: 'Platino VIP',
    price: 750,
    color: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
    badge: 'Zona Central VIP',
    gate: 'Puerta 1 - Central VIP',
    description: 'Butaca Acolchonada con servicio a asiento',
  },
  {
    name: 'Oro / Central',
    price: 500,
    color: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-300',
    badge: 'Detrás de Home',
    gate: 'Puerta 2 - Central',
    description: 'Vista privilegiada al plato principal',
  },
  {
    name: 'Plata / Lateral',
    price: 350,
    color: 'border-blue-500/50 bg-blue-500/10 text-blue-300',
    badge: 'Dugout Local / Visita',
    gate: 'Puerta 3 - Lateral',
    description: 'Sobre los dugouts de los equipos',
  },
  {
    name: 'General Bleachers / Sol',
    price: 180,
    color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
    badge: 'Graderías Sol',
    gate: 'Puerta 5 - Sol',
    description: 'Acceso General por orden de llegada',
  },
  {
    name: 'Preferente Especial (INAPAM / Niños)',
    price: 100,
    color: 'border-purple-500/50 bg-purple-500/10 text-purple-300',
    badge: 'Descuento Especial',
    gate: 'Puerta 4 - Preferente',
    description: 'Identificación oficial requerida al entrar',
  },
];

export const TaquilleraPOSView: React.FC<TaquilleraPOSViewProps> = ({ user }) => {
  const [selectedEventId, setSelectedEventId] = useState<string>(DEFAULT_EVENT_ID);
  const selectedEvent = EVENTS_CATALOG.find((e) => e.id === selectedEventId) || EVENTS_CATALOG[0];

  const [terminalId, setTerminalId] = useState<string>('Ventanilla 1 - Taquilla Principal');
  const [posSelectedSeats, setPosSelectedSeats] = useState<SeatPurchaseItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('Cliente Ventanilla');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'transferencia'>('efectivo');

  // Evento activo formateado para el mapa
  const activeVenueEvent: VenueEvent = useMemo(() => ({
    id: selectedEvent.id,
    venueId: selectedEvent.venueId || DEFAULT_VENUE_ID,
    name: selectedEvent.matchTitle,
    type: 'baseball',
    date: selectedEvent.matchDate,
    time: selectedEvent.matchTime,
    venueName: selectedEvent.stadium,
  }), [selectedEvent]);

  // Limpiar asientos al cambiar de partido
  useEffect(() => {
    setPosSelectedSeats([]);
  }, [selectedEventId]);
  
  // Efectivo calculator
  const [cashReceived, setCashReceived] = useState<string>('');
  const [discountCode, setDiscountCode] = useState<string>('');
  const [appliedDiscountPercent, setAppliedDiscountPercent] = useState<number>(0);

  // Estados de proceso
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Impresión y venta completada
  const [lastCompletedSale, setLastCompletedSale] = useState<{
    posSaleId: string;
    tickets: Ticket[];
    totalAmount: number;
    paymentMethod: string;
    customerName: string;
    date: string;
  } | null>(null);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Corte de caja / Shift Summary
  const [showShiftModal, setShowShiftModal] = useState<boolean>(false);
  const [shiftSales, setShiftSales] = useState<any[]>([]);
  const [loadingShift, setLoadingShift] = useState<boolean>(false);

  // Impresora status simulation
  const [printerConnected, setPrinterConnected] = useState<boolean>(true);

  // Cargar ventas del turno/día para la taquillera
  const fetchShiftSales = async () => {
    setLoadingShift(true);
    try {
      const q = query(
        collection(db, 'sales'),
        where('issuedBy', '==', user.displayName || user.email || 'Taquillera POS'),
        limit(50)
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setShiftSales(docs);
    } catch (e) {
      console.warn('Nota al cargar ventas del turno:', e);
    } finally {
      setLoadingShift(false);
    }
  };

  useEffect(() => {
    fetchShiftSales();
  }, [user.displayName, user.email]);

  // Cálculos de Totales
  const subtotal = useMemo(() => {
    return posSelectedSeats.reduce((sum, item) => sum + item.price, 0);
  }, [posSelectedSeats]);

  const discountAmount = Math.round((subtotal * appliedDiscountPercent) / 100);
  const grandTotal = Math.max(0, subtotal - discountAmount);

  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const changeAmount = paymentMethod === 'efectivo' ? Math.max(0, cashReceivedNum - grandTotal) : 0;

  const handleApplyDiscount = () => {
    const code = discountCode.trim().toUpperCase();
    if (code === 'SOCIO10') {
      setAppliedDiscountPercent(10);
      setErrorMessage(null);
    } else if (code === 'SOCIO20') {
      setAppliedDiscountPercent(20);
      setErrorMessage(null);
    } else if (code === 'CORTESIA') {
      setAppliedDiscountPercent(100);
      setErrorMessage(null);
    } else {
      setErrorMessage('Código de descuento no válido.');
    }
  };

  // Procesar venta en POS utilizando las butacas seleccionadas en el mapa
  const handleProcessPosSale = async () => {
    if (posSelectedSeats.length === 0) {
      setErrorMessage('Selecciona al menos un asiento en el mapa para continuar.');
      return;
    }
    if (paymentMethod === 'efectivo' && cashReceivedNum < grandTotal) {
      setErrorMessage(`El efectivo recibido ($${cashReceivedNum}) es menor al total ($${grandTotal}).`);
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    try {
      // Mapear asientos seleccionados en el mapa interactivo
      const ticketRequests: PosTicketItemRequest[] = posSelectedSeats.map((item) => ({
        seatId: item.seatId,
        section: `Sec. ${item.sectionNumber} (${item.zoneName})`,
        price: item.price,
        row: `Fila ${item.rowLabel}`,
        seat: `Asiento ${String(item.seatNumber).padStart(2, '0')}`,
        gate: 'Puerta Principal',
      }));

      const operatorName = user.displayName || user.email || 'Taquillera de Turno';

      const result = await createPosTicketBatch({
        eventId: selectedEvent.id,
        venueId: selectedEvent.venueId,
        matchTitle: selectedEvent.matchTitle,
        opponent: selectedEvent.opponent,
        matchDate: selectedEvent.matchDate,
        matchTime: selectedEvent.matchTime,
        stadium: selectedEvent.stadium,
        items: ticketRequests,
        paymentMethod,
        customerName: customerName.trim() || 'Cliente Ventanilla',
        customerEmail: customerEmail.trim() || undefined,
        issuedBy: operatorName,
        terminalId,
      });

      const completed = {
        posSaleId: result.posSaleId,
        tickets: result.tickets,
        totalAmount: grandTotal,
        paymentMethod,
        customerName: customerName.trim() || 'Cliente Ventanilla',
        date: new Date().toISOString(),
      };

      setLastCompletedSale(completed);
      setShowPrintModal(true);
      
      // Limpiar comanda para la siguiente venta de ventanilla
      setPosSelectedSeats([]);
      setCashReceived('');
      setDiscountCode('');
      setAppliedDiscountPercent(0);
      setCustomerName('Cliente Ventanilla');
      setCustomerEmail('');
      
      fetchShiftSales();
    } catch (err: any) {
      console.error('Error al emitir boletos en POS:', err);
      setErrorMessage('Ocurrió un error al procesar la venta. Intenta nuevamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Disparar la impresión física real de los boletos térmicos (window.print)
  const handleTriggerPrint = () => {
    window.print();
  };

  // Resumen del turno (Corte de caja)
  const shiftTotalAmount = shiftSales.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const shiftTicketsCount = shiftSales.reduce((sum, s) => sum + (Number(s.ticketCount) || 1), 0);
  const shiftCashAmount = shiftSales.filter((s) => s.paymentMethod === 'efectivo').reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const shiftCardAmount = shiftSales.filter((s) => s.paymentMethod === 'tarjeta').reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  return (
    <div className="min-h-screen bg-[#0A0F1D] text-white p-3 md:p-6 pb-20 font-sans">
      {/* 1. Header de Estado y Control de Terminal */}
      <div className="bg-[#141E34] border border-red-900/30 rounded-2xl p-4 mb-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-900/40">
            <Printer className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black font-sports tracking-wide uppercase text-white">
                Punto de Venta POS (Boletos)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                Ventanilla Activa
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Operador: <strong className="text-slate-200">{user.displayName || user.email}</strong></span>
              <span>•</span>
              <span className="text-red-400 font-semibold">{terminalId}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de Ventanilla */}
          <select
            value={terminalId}
            onChange={(e) => setTerminalId(e.target.value)}
            className="bg-[#0D1527] border border-slate-700/60 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-medium focus:outline-hidden focus:border-red-500"
          >
            <option value="Ventanilla 1 - Taquilla Principal">Ventanilla 1 - Principal</option>
            <option value="Ventanilla 2 - Sol y Techo">Ventanilla 2 - Sol</option>
            <option value="Ventanilla 3 - Preferente">Ventanilla 3 - Preferente</option>
            <option value="Taquilla Móvil 4">Taquilla Móvil 4</option>
          </select>

          {/* Impresora Status Toggle */}
          <button
            onClick={() => setPrinterConnected(!printerConnected)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              printerConnected
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{printerConnected ? 'Impresora 80mm OK' : 'Revisar Papel/Conexión'}</span>
          </button>

          {/* Botón Corte de Caja */}
          <button
            onClick={() => {
              fetchShiftSales();
              setShowShiftModal(true);
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-red-600/20 text-red-300 border border-red-500/40 text-xs font-bold hover:bg-red-600/30 transition-all font-sports uppercase tracking-wider"
          >
            <Receipt className="w-3.5 h-3.5 text-red-400" />
            <span>Corte de Caja (${shiftTotalAmount.toLocaleString('es-MX')})</span>
          </button>
        </div>
      </div>

      {/* Selector de Partido Activo */}
      <div className="bg-[#10172A] border border-slate-800 rounded-2xl p-3 mb-6">
        <div className="flex items-center gap-2 mb-2 px-1">
          <Calendar className="w-4 h-4 text-red-500" />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Evento Seleccionado para Venta:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {EVENTS_CATALOG.map((evt) => {
            const isSelected = evt.id === selectedEventId;
            return (
              <button
                key={evt.id}
                onClick={() => setSelectedEventId(evt.id)}
                className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
                  isSelected
                    ? 'bg-gradient-to-r from-red-950/60 to-red-900/40 border-red-500 shadow-lg shadow-red-950/30'
                    : 'bg-[#152037] border-slate-800 hover:border-slate-700 opacity-80'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                )}
                <div className="text-xs font-black text-red-400 uppercase tracking-wide mb-1 font-sports">
                  {evt.status}
                </div>
                <div className="text-sm font-bold text-white line-clamp-1">{evt.matchTitle}</div>
                <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-slate-500" /> {evt.matchDate}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-500" /> {evt.matchTime}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid Principal POS: Izquierda Selección de Boletos | Derecha Resumen & Cobro */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Izquierda: Mapa Interactivo de Asientos y Secciones en Tiempo Real (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white font-sports uppercase tracking-wider flex items-center gap-2">
              <TicketIcon className="w-5 h-5 text-red-500" />
              Mapa Oficial de Asientos (Ventanilla POS)
            </h2>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Disponibilidad en Vivo
            </span>
          </div>

          {/* Renderizar el Mapa de Asientos Interactivo idéntico al del Aficionado */}
          <div className="bg-[#141E34] border border-slate-800 rounded-2xl p-2 sm:p-4 shadow-xl">
            <SeatMapSelector
              event={activeVenueEvent}
              user={user}
              stadiumName={selectedEvent.stadium}
              isPosMode={true}
              onSelectionChangeForPos={(seats) => setPosSelectedSeats(seats)}
            />
          </div>

          {/* Información del Estadio y Puertas */}
          <div className="bg-[#121A2D] border border-slate-800 rounded-xl p-4 text-xs text-slate-400 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-red-500" />
              <span>{selectedEvent.stadium} • Asignación Atómica de Butacas</span>
            </div>
            <span className="text-slate-500 font-mono">Impresión Térmica Directa (Escáner Molinete Habilitado)</span>
          </div>
        </div>

        {/* Derecha: Carrito de Venta, Cliente y Cobro (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-[#141E34] border border-slate-800 rounded-2xl p-5 shadow-2xl sticky top-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white font-sports uppercase tracking-wider flex items-center gap-2">
                <Receipt className="w-5 h-5 text-red-500" />
                Resumen de Venta POS ({posSelectedSeats.length})
              </h2>
              {posSelectedSeats.length > 0 && (
                <button
                  onClick={() => setPosSelectedSeats([])}
                  className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer font-sports uppercase tracking-wider"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Vaciar
                </button>
              )}
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 bg-red-950/80 border border-red-700 rounded-xl text-red-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Lista de Boletos Seleccionados en el Mapa */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 scrollbar-thin">
              {posSelectedSeats.length === 0 ? (
                <div className="text-center py-8 text-slate-500 space-y-2 border border-dashed border-slate-800 rounded-xl">
                  <TicketIcon className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-400">Ninguna butaca seleccionada.</p>
                  <span className="text-[11px] text-slate-500 block max-w-xs mx-auto">
                    Toca las butacas disponibles en el mapa interactivo a la izquierda para agregarlas a la orden POS.
                  </span>
                </div>
              ) : (
                posSelectedSeats.map((item) => (
                  <div
                    key={item.seatId}
                    className="p-3 bg-[#0E1626] border border-slate-800 rounded-xl flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-xs font-black text-white font-sports uppercase tracking-wide truncate">
                        Sec. #{item.sectionNumber} ({item.zoneName})
                      </div>
                      <div className="text-[11px] text-slate-300 font-semibold">
                        Fila {item.rowLabel} • Asiento {String(item.seatNumber).padStart(2, '0')}
                      </div>
                      <div className="text-[10px] text-emerald-400 font-bold font-mono">
                        ${item.price} MXN
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPosSelectedSeats((prev) => prev.filter((s) => s.seatId !== item.seatId))}
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-red-400 cursor-pointer transition-colors"
                      title="Quitar de la comanda"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Datos del Cliente y Descuento */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Nombre del Comprador
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Cliente Ventanilla General"
                    className="w-full bg-[#0D1527] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Correo (Opcional Enviarle copia)
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className="w-full bg-[#0D1527] border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-red-500"
                  />
                </div>
              </div>

              {/* Código Promocional / Socio */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Percent className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    placeholder="Código Socio (SOCIO10, CORTESIA)"
                    className="w-full bg-[#0D1527] border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white uppercase placeholder-slate-600 focus:outline-hidden focus:border-red-500"
                  />
                </div>
                <button
                  onClick={handleApplyDiscount}
                  className="px-3 py-1.5 bg-[#1E2C4A] border border-slate-700 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-xl"
                >
                  Aplicar
                </button>
              </div>

              {appliedDiscountPercent > 0 && (
                <div className="text-xs text-emerald-400 flex items-center justify-between bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/40">
                  <span>Descuento aplicado ({appliedDiscountPercent}%):</span>
                  <span className="font-bold">-${discountAmount} MXN</span>
                </div>
              )}
            </div>

            {/* Método de Pago */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Método de Pago
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
                  { id: 'tarjeta', label: 'Tarjeta TPV', icon: CreditCard },
                  { id: 'transferencia', label: 'SPEI', icon: Sparkles },
                ].map((m) => {
                  const IconComp = m.icon;
                  const isSel = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`p-2.5 rounded-xl border text-center text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                        isSel
                          ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-950/50'
                          : 'bg-[#0D1527] text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Calculadora de Efectivo */}
              {paymentMethod === 'efectivo' && (
                <div className="p-3 bg-[#0D1527] border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Efectivo Recibido:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">$</span>
                      <input
                        type="number"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        placeholder={`${grandTotal}`}
                        className="w-24 bg-[#141E34] border border-slate-700 rounded-lg px-2 py-1 text-right text-xs font-bold text-white focus:outline-hidden focus:border-red-500"
                      />
                    </div>
                  </div>

                  {/* Botones de billetes rápidos */}
                  <div className="flex items-center gap-1 justify-end">
                    {[200, 500, 1000].map((billete) => (
                      <button
                        key={billete}
                        onClick={() => setCashReceived(String(billete))}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 rounded-md"
                      >
                        ${billete}
                      </button>
                    ))}
                    <button
                      onClick={() => setCashReceived(String(grandTotal))}
                      className="px-2 py-0.5 bg-red-950 hover:bg-red-900 text-[10px] font-bold text-red-300 rounded-md border border-red-800/40"
                    >
                      Exacto
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                    <span className="font-bold text-slate-400">Cambio a Entregar:</span>
                    <span className={`text-base font-black font-sports ${changeAmount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      ${changeAmount.toLocaleString('es-MX')} MXN
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Total General & Botón Principal de Cobro */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 uppercase font-bold tracking-wider block">Total a Cobrar</span>
                  <span className="text-[10px] text-slate-500">{posSelectedSeats.length} boletos en total</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-white font-sports">
                    ${grandTotal.toLocaleString('es-MX')} <span className="text-xs text-slate-400 font-normal">MXN</span>
                  </span>
                </div>
              </div>

              <button
                onClick={handleProcessPosSale}
                disabled={isProcessing || posSelectedSeats.length === 0}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 text-white font-black text-sm uppercase tracking-wider font-sports flex items-center justify-center gap-2 shadow-xl shadow-red-950/60 active:scale-[0.99] transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Emitiendo Boletos...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-5 h-5" />
                    <span>Cobrar e Imprimir Boletos Térmicos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. MODAL DE IMPRESIÓN DE BOLETOS TÉRMICOS Y RECEPTOR (WINDOW.PRINT) */}
      {showPrintModal && lastCompletedSale && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141E34] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            {/* Header Modal */}
            <div className="p-4 bg-gradient-to-r from-red-900/60 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-sports font-bold text-lg uppercase">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <span>¡Venta Completada con Éxito! Folio: {lastCompletedSale.posSaleId}</span>
              </div>
              <button
                onClick={() => setShowPrintModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-3 text-xs text-emerald-300 flex items-center justify-between">
                <span>{lastCompletedSale.tickets.length} boletos generados correctamente en Firestore.</span>
                <span className="font-bold">Pago en {lastCompletedSale.paymentMethod.toUpperCase()}</span>
              </div>

              {/* Botón de Acción Principal de Impresión */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={handleTriggerPrint}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase font-sports rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-5 h-5" />
                  <span>Imprimir Todos los Boletos ({lastCompletedSale.tickets.length})</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="py-3 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase rounded-xl"
                >
                  Cerrar
                </button>
              </div>

              {/* Vista Previa de Formato Térmico Físico (80mm width standard) */}
              <div className="border border-slate-700 rounded-xl p-4 bg-slate-900 space-y-4 max-h-[60vh] overflow-y-auto">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Vista Previa de Impresión Térmica (Papel 80mm Estadio)
                </h3>

                {/* AREA DE IMPRESIÓN REAL IDENTIFICABLE CON ID PARA @media print */}
                <div id="thermal-print-area" className="space-y-6">
                  {lastCompletedSale.tickets.map((tkt, idx) => (
                    <div
                      key={tkt.id}
                      className="bg-white text-black p-4 font-mono text-[11px] leading-tight rounded-sm shadow-md max-w-[80mm] mx-auto border-2 border-black"
                      style={{ width: '80mm', color: '#000', backgroundColor: '#fff' }}
                    >
                      {/* Logo / Header */}
                      <div className="text-center font-bold text-[13px] uppercase border-b-2 border-black pb-2 mb-2">
                        CLUB DE BÉISBOL VENADOS DE MAZATLÁN
                        <div className="text-[10px] font-normal">ESTADIO TEODORO MARISCAL</div>
                        <div className="text-[9px] font-semibold mt-0.5">TEMPORADA REGULAR LMP 2026</div>
                      </div>

                      {/* Detalles del Juego */}
                      <div className="space-y-1 mb-2 text-center">
                        <div className="font-bold text-[12px]">{tkt.matchTitle}</div>
                        <div>FECHA: {tkt.matchDate} - {tkt.matchTime}</div>
                        <div>ACCESO: {tkt.gate || 'PUERTA 1 - CENTRAL'}</div>
                      </div>

                      <div className="border-t border-b border-black py-2 my-2 text-center font-bold text-[13px]">
                        <div>SECCIÓN: {tkt.section}</div>
                        <div className="text-[14px]">UBICACIÓN: {tkt.row} • {tkt.seat}</div>
                        <div>PRECIO: ${tkt.price}.00 MXN</div>
                      </div>

                      {/* QR Escaneable para Molinete */}
                      <div className="flex flex-col items-center justify-center my-3 py-1">
                        <QRCodeDisplay value={tkt.qrId} size={150} alt={`QR Boleto ${tkt.qrId}`} />
                        <div className="font-bold text-[10px] tracking-wider mt-1.5">{tkt.qrId}</div>
                      </div>

                      {/* Información de Transacción */}
                      <div className="text-[9px] space-y-0.5 border-t border-dashed border-black pt-2">
                        <div>FOLIO POS: {tkt.posSaleId}</div>
                        <div>COMPRADOR: {tkt.customerName || 'VENTANILLA'}</div>
                        <div>EMITIDO POR: {tkt.issuedBy}</div>
                        <div>TERMINAL: {tkt.terminalId}</div>
                        <div>FECHA: {new Date(tkt.createdAt).toLocaleString()}</div>
                      </div>

                      {/* Talonario Desprendible */}
                      <div className="border-t-2 border-dashed border-black mt-3 pt-2 text-center text-[9px]">
                        <div className="font-bold">- - - TALÓN DE MOLINETE / CONTROL - - -</div>
                        <div>FOLIO: {tkt.qrId}</div>
                        <div>SECCIÓN: {tkt.section} • {tkt.seat}</div>
                        <div>* VÁLIDO PARA 1 ACCESO AL ESTADIO *</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL DE CORTE DE CAJA / RESUMEN DE TURNO */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141E34] border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-sports font-bold text-lg uppercase">
                <Receipt className="w-5 h-5 text-red-500" />
                <span>Corte de Caja del Turno</span>
              </div>
              <button
                onClick={() => setShowShiftModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0E1626] p-4 rounded-xl border border-slate-800 text-center">
                <span className="text-xs text-slate-400 uppercase font-bold block mb-1">Ventas Totales</span>
                <span className="text-2xl font-black text-white font-sports">
                  ${shiftTotalAmount.toLocaleString('es-MX')} MXN
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">{shiftSales.length} transacciones</span>
              </div>
              <div className="bg-[#0E1626] p-4 rounded-xl border border-slate-800 text-center">
                <span className="text-xs text-slate-400 uppercase font-bold block mb-1">Boletos Emitidos</span>
                <span className="text-2xl font-black text-red-400 font-sports">
                  {shiftTicketsCount} Boletos
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">Impresos en papel térmico</span>
              </div>
            </div>

            <div className="bg-[#0E1626] p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5"><Banknote className="w-4 h-4 text-emerald-400" /> Efectivo en Caja:</span>
                <span className="font-bold text-white">${shiftCashAmount.toLocaleString('es-MX')} MXN</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-slate-400 flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-blue-400" /> Cobros TPV Tarjeta:</span>
                <span className="font-bold text-white">${shiftCardAmount.toLocaleString('es-MX')} MXN</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Imprimir Reporte de Caja
              </button>
              <button
                onClick={() => setShowShiftModal(false)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase font-sports rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ESTILOS CSS REQUERIDOS PARA IMPRESIÓN TÉRMICA EN PAPEL DE 80MM */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #thermal-print-area, #thermal-print-area * {
            visibility: visible !important;
          }
          #thermal-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};
export default TaquilleraPOSView;
