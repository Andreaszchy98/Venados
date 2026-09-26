import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Printer,
  Ticket as TicketIcon,
  CreditCard,
  Banknote,
  Sparkles,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Clock,
  Trash2,
  User,
  Mail,
  Tag,
  ChevronDown,
  ChevronUp,
  X,
  RefreshCw,
  Building2,
  Percent,
} from 'lucide-react';
import { UserProfile, Ticket, VenueEvent } from '../../types';
import { QRCodeDisplay } from '../../components/shared/QRCodeDisplay';
import { createPosTicketBatch, PosTicketItemRequest } from '../../lib/tickets';
import { DEFAULT_EVENT_ID, DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { collection, query, where, getDocs, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { SeatMapSelector } from '../aficionado/SeatMapSelector';
import { SeatPurchaseItem } from '../../lib/seatMap';
import { useTheme } from '../../context/ThemeContext';
import { DEFAULT_FALLBACK_EVENTS } from '../../lib/venueEvents';

interface TaquilleraPOSViewProps {
  user: UserProfile;
}

const FALLBACK_POS_EVENTS = DEFAULT_FALLBACK_EVENTS
  .filter((e) => e.active !== false && e.ticketsAvailable !== false)
  .map((e) => ({
    id: e.id,
    matchTitle: e.name,
    opponent: e.opponent || '',
    matchDate: e.date,
    matchTime: e.time,
    stadium: e.venueName || (e.venueId === 'venue-encanto' ? 'Estadio El Encanto' : 'Estadio Teodoro Mariscal'),
    venueId: e.venueId,
    status: e.name.includes('Inaugural') || e.name.includes('Inauguración') ? 'Serie Inaugural' : 'Disponible para Venta',
    type: e.type,
    active: true,
    ticketsAvailable: true,
  }))
  .sort((a, b) => (a.matchDate || '').localeCompare(b.matchDate || '') || (a.matchTime || '').localeCompare(b.matchTime || ''));

export const TaquilleraPOSView: React.FC<TaquilleraPOSViewProps> = ({ user }) => {
  const { theme } = useTheme();

  // Catálogo dinámico de eventos de venta de boletos cargados de Firestore
  const [eventsCatalog, setEventsCatalog] = useState<any[]>(FALLBACK_POS_EVENTS);
  const [loadingEventsCatalog, setLoadingEventsCatalog] = useState<boolean>(true);
  const [selectedEventId, setSelectedEventId] = useState<string>(FALLBACK_POS_EVENTS[0]?.id || DEFAULT_EVENT_ID);
  const [isEventDropdownOpen, setIsEventDropdownOpen] = useState<boolean>(false);

  // Escuchar eventos disponibles para venta en la base de datos en tiempo real y ordenados por fecha
  useEffect(() => {
    const currentVenueId = user.venueId || DEFAULT_VENUE_ID;
    const q = query(
      collection(db, 'venueEvents'),
      limit(60)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let loaded = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            matchTitle: data.name || 'Evento Deportivo',
            opponent: data.opponent || '',
            matchDate: data.date || '2026-10-15',
            matchTime: data.time || '20:00 hrs',
            stadium: data.venueName || (data.venueId === 'venue-encanto' ? 'Estadio El Encanto' : 'Estadio Teodoro Mariscal'),
            venueId: data.venueId || currentVenueId,
            status: data.status || 'Disponible para Venta',
            active: data.active !== false,
            ticketsAvailable: data.ticketsAvailable !== false,
            type: data.type || 'baseball',
          };
        }).filter(e => e.active && e.ticketsAvailable); // Solo eventos disponibles para venta

        // Priorizar eventos de la sede del usuario si los hay, pero mostrar todos los disponibles
        const venueEvents = loaded.filter(e => e.venueId === currentVenueId);
        const finalEvents = venueEvents.length > 0 ? venueEvents : loaded;

        // Ordenar cronológicamente por fecha de evento y hora (más próximos primero)
        finalEvents.sort((a, b) => (a.matchDate || '').localeCompare(b.matchDate || '') || (a.matchTime || '').localeCompare(b.matchTime || ''));

        if (finalEvents.length > 0) {
          setEventsCatalog(finalEvents);
          setSelectedEventId((prev) => (finalEvents.some(e => e.id === prev) ? prev : finalEvents[0].id));
        } else {
          const fallbackForVenue = FALLBACK_POS_EVENTS.filter(e => e.venueId === currentVenueId);
          const fallbackList = fallbackForVenue.length > 0 ? fallbackForVenue : FALLBACK_POS_EVENTS;
          setEventsCatalog(fallbackList);
          setSelectedEventId((prev) => (fallbackList.some(e => e.id === prev) ? prev : fallbackList[0].id));
        }
        setLoadingEventsCatalog(false);
      },
      (error) => {
        console.error('Error al escuchar eventos en tiempo real:', error);
        const fallbackForVenue = FALLBACK_POS_EVENTS.filter(e => e.venueId === currentVenueId);
        const fallbackList = fallbackForVenue.length > 0 ? fallbackForVenue : FALLBACK_POS_EVENTS;
        setEventsCatalog(fallbackList);
        setSelectedEventId((prev) => (fallbackList.some(e => e.id === prev) ? prev : fallbackList[0].id));
        setLoadingEventsCatalog(false);
      }
    );

    return () => unsubscribe();
  }, [user.venueId]);

  const selectedEvent = eventsCatalog.find((e) => e.id === selectedEventId) || eventsCatalog[0] || FALLBACK_POS_EVENTS[0];

  const [terminalId, setTerminalId] = useState<string>('Ventanilla 1 - Taquilla Principal');
  const [posSelectedSeats, setPosSelectedSeats] = useState<SeatPurchaseItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('Cliente Ventanilla');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'transferencia'>('efectivo');

  // Estado para desplegar datos opcionales del cliente y descuentos
  const [showOptionalDetails, setShowOptionalDetails] = useState<boolean>(false);

  // Evento activo formateado para el mapa
  const activeVenueEvent: VenueEvent = useMemo(() => ({
    id: selectedEvent.id,
    venueId: selectedEvent.venueId || DEFAULT_VENUE_ID,
    name: selectedEvent.matchTitle,
    type: selectedEvent.type || 'baseball',
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

  const [isReprinting, setIsReprinting] = useState<string | null>(null);

  const handleReprintSale = async (sale: any) => {
    setIsReprinting(sale.posSaleId);
    try {
      const ticketsQ = query(
        collection(db, 'tickets'),
        where('posSaleId', '==', sale.posSaleId)
      );
      const ticketsSnap = await getDocs(ticketsQ);
      const tickets = ticketsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Ticket[];

      if (tickets.length === 0) {
        setErrorMessage('No se encontraron boletos asociados a esta venta para reimpresión.');
        return;
      }

      setLastCompletedSale({
        posSaleId: sale.posSaleId,
        tickets,
        totalAmount: sale.amount,
        paymentMethod: sale.paymentMethod,
        customerName: sale.customerName || 'Cliente Ventanilla',
        date: sale.date || new Date().toISOString(),
      });
      setShowPrintModal(true);
      setShowShiftModal(false); // Cerrar corte de caja para ver la vista previa de impresión
    } catch (err) {
      console.error('Error al reimprimir venta:', err);
      setErrorMessage('Ocurrió un error al recuperar los boletos para reimpresión.');
    } finally {
      setIsReprinting(null);
    }
  };

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

  // Listener para cerrar modales y dropdowns con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showShiftModal) setShowShiftModal(false);
        if (showPrintModal) setShowPrintModal(false);
        if (isEventDropdownOpen) setIsEventDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showShiftModal, showPrintModal, isEventDropdownOpen]);

  // Cálculos de Totales
  const subtotal = useMemo(() => {
    return posSelectedSeats.reduce((sum, item) => sum + item.price, 0);
  }, [posSelectedSeats]);

  const discountAmount = Math.round((subtotal * appliedDiscountPercent) / 100);
  const grandTotal = Math.max(0, subtotal - discountAmount);

  const cashReceivedNum = cashReceived.trim() === '' ? grandTotal : (parseFloat(cashReceived) || 0);
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

  const processingRef = useRef(false);

  // Procesar venta en POS utilizando las butacas seleccionadas en el mapa
  const handleProcessPosSale = async () => {
    if (isProcessing || processingRef.current) return;
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
    processingRef.current = true;

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
      setShowOptionalDetails(false);

      fetchShiftSales();
    } catch (err: any) {
      console.error('Error al emitir boletos en POS:', err);
      setErrorMessage('Ocurrió un error al procesar la venta. Intenta nuevamente.');
    } finally {
      setIsProcessing(false);
      processingRef.current = false;
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
    <div className={`min-h-screen p-3 md:p-5 pb-20 font-sans ${theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-[#0A0F1D] text-white'}`}>
      {/* 1. HEADER POS: ESTADO, TERMINAL Y CORTE DE CAJA */}
      <div className={`border rounded-2xl p-3.5 mb-4 shadow-xl flex flex-wrap items-center justify-between gap-3 ${
        theme === 'light' ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-[#141E34] border-red-900/30 text-white'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-md shadow-red-900/40">
            <Printer className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-base sm:text-lg font-black font-sports tracking-wide uppercase ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                Punto de Venta POS
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                Ventanilla Activa
              </span>
            </div>
            <p className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Operador: <strong className="text-slate-200">{user.displayName || user.email}</strong></span>
              <span>•</span>
              <span className="text-red-400 font-semibold">{terminalId}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Ventanilla */}
          <select
            value={terminalId}
            onChange={(e) => setTerminalId(e.target.value)}
            className="bg-[#0D1527] border border-slate-700/60 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-medium focus:outline-hidden focus:border-red-500"
          >
            <option value="Ventanilla 1 - Taquilla Principal">Ventanilla 1 - Principal</option>
            <option value="Ventanilla 2 - Sol y Techo">Ventanilla 2 - Sol</option>
            <option value="Ventanilla 3 - Preferente">Ventanilla 3 - Preferente</option>
            <option value="Taquilla Móvil 4">Taquilla Móvil 4</option>
          </select>

          {/* Estado de Impresora */}
          <button
            onClick={() => setPrinterConnected(!printerConnected)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              printerConnected
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{printerConnected ? 'Impresora OK' : 'Revisar Papel'}</span>
          </button>

          {/* Botón Reimprimir Compras */}
          <button
            onClick={() => {
              fetchShiftSales();
              setShowShiftModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold hover:bg-slate-700 transition-all font-sports uppercase tracking-wider"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span>Reimprimir Compras</span>
          </button>

          {/* Botón Corte de Caja */}
          <button
            onClick={() => {
              fetchShiftSales();
              setShowShiftModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/20 text-red-300 border border-red-500/40 text-xs font-bold hover:bg-red-600/30 transition-all font-sports uppercase tracking-wider"
          >
            <Receipt className="w-3.5 h-3.5 text-red-400" />
            <span>Corte de Caja (${shiftTotalAmount.toLocaleString('es-MX')})</span>
          </button>
        </div>
      </div>

      {/* 2. SELECTOR VISUAL DE EVENTO COMPACTO (DROPDOWN) */}
      <div className="relative mb-5 z-30">
        <button
          type="button"
          onClick={() => setIsEventDropdownOpen(!isEventDropdownOpen)}
          className={`w-full border rounded-2xl p-3 flex items-center justify-between shadow-lg transition-all text-left cursor-pointer ${
            theme === 'light' ? 'bg-white border-slate-200 hover:bg-slate-50 text-slate-900 shadow-sm' : 'bg-[#141E34] border-slate-700/80 hover:bg-[#1A2846] text-white'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-red-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-red-400 font-sports bg-red-950/80 px-2 py-0.5 rounded border border-red-800/40">
                  {selectedEvent.status}
                </span>
                <span className="text-[11px] text-slate-400 font-medium truncate">
                  {selectedEvent.stadium}
                </span>
              </div>
              <h2 className={`text-sm sm:text-base font-black font-sports uppercase tracking-wide truncate mt-0.5 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                {selectedEvent.matchTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 ml-2">
            <div className="hidden sm:flex items-center gap-3 text-xs text-slate-300 font-mono bg-[#0D1527] px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="flex items-center gap-1 text-slate-300">
                <Calendar className="w-3.5 h-3.5 text-slate-500" /> {selectedEvent.matchDate}
              </span>
              <span className="flex items-center gap-1 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> {selectedEvent.matchTime}
              </span>
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${isEventDropdownOpen ? 'rotate-180 text-white' : ''}`} />
          </div>
        </button>

        {/* Menú Desplegable con los Demás Eventos */}
        {isEventDropdownOpen && (
          <div className={`absolute top-full left-0 right-0 mt-2 border rounded-2xl shadow-2xl overflow-hidden z-40 divide-y animate-in fade-in duration-150 max-h-80 overflow-y-auto ${
            theme === 'light'
              ? 'bg-white border-slate-200 divide-slate-100 shadow-xl text-slate-900'
              : 'bg-[#0E1626] border-slate-700/90 divide-slate-800 text-white'
          }`}>
            <div className={`p-2.5 text-[10px] font-bold uppercase tracking-wider px-3.5 ${
              theme === 'light' ? 'bg-slate-100 text-slate-600' : 'bg-[#080D18] text-slate-400'
            }`}>
              Seleccionar evento para la venta de ventanilla ({eventsCatalog.length} disponibles):
            </div>
            {eventsCatalog.map((evt) => {
              const isSelected = evt.id === selectedEventId;
              return (
                <button
                  key={evt.id}
                  onClick={() => {
                    setSelectedEventId(evt.id);
                    setIsEventDropdownOpen(false);
                  }}
                  className={`w-full p-3.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                    isSelected
                      ? (theme === 'light' ? 'bg-red-50 text-red-950 font-bold' : 'bg-red-950/40 text-white font-bold')
                      : (theme === 'light' ? 'hover:bg-slate-50 text-slate-800' : 'hover:bg-[#141E34] text-slate-300')
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isSelected ? 'bg-red-500 ring-2 ring-red-400/40' : (theme === 'light' ? 'bg-slate-300' : 'bg-slate-600')}`} />
                    <div className="min-w-0">
                      <div className={`text-xs sm:text-sm font-bold truncate ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{evt.matchTitle}</div>
                      <div className={`text-[11px] flex items-center gap-2 mt-0.5 font-sans ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                        <span className="font-semibold text-red-500">{evt.matchDate}</span>
                        <span>•</span>
                        <span>{evt.matchTime}</span>
                        <span>•</span>
                        <span className={theme === 'light' ? 'text-slate-400' : 'text-slate-500'}>{evt.stadium}</span>
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-xs font-bold text-red-500 uppercase font-sports tracking-wider shrink-0 ml-2">
                      ✓ Seleccionado
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. ESTRUCTURA PRINCIPAL POS: IZQUIERDA (60%) MAPA | DERECHA (40%) RESUMEN COMPACTO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* IZQUIERDA (60%): Mapa Interactivo de Asientos sin Duplicados */}
        <div className="lg:col-span-7 space-y-3">
          <div className="bg-[#141E34] border border-slate-800 rounded-2xl p-2 sm:p-3.5 shadow-xl">
            <SeatMapSelector
              event={activeVenueEvent}
              user={user}
              stadiumName={selectedEvent.stadium}
              isPosMode={true}
              posSelectedSeats={posSelectedSeats}
              onSelectionChangeForPos={(seats) => setPosSelectedSeats(seats)}
            />
          </div>
        </div>

        {/* DERECHA (40%): Resumen Compacto de Venta POS */}
        <div className="lg:col-span-5">
          <div className={`border rounded-2xl p-4 shadow-2xl lg:sticky lg:top-[128px] space-y-3.5 ${
            theme === 'light' ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-[#141E34] border-slate-800 text-white'
          }`}>
            {/* Cabecera del Resumen */}
            <div className={`flex items-center justify-between border-b pb-2.5 ${theme === 'light' ? 'border-slate-200 text-slate-900' : 'border-slate-800 text-white'}`}>
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-red-500" />
                <h2 className={`text-sm font-bold font-sports uppercase tracking-wider ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                  Resumen de Venta ({posSelectedSeats.length})
                </h2>
              </div>
              {posSelectedSeats.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPosSelectedSeats([])}
                  className="text-[11px] text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors cursor-pointer font-sports uppercase tracking-wider"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpiar
                </button>
              )}
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-2.5 bg-red-950/80 border border-red-700 rounded-xl text-red-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Lista Compacta de Boletos Seleccionados */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {posSelectedSeats.length === 0 ? (
                <div className="text-center py-6 text-slate-500 space-y-1 border border-dashed border-slate-800 rounded-xl p-3">
                  <TicketIcon className="w-6 h-6 text-slate-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-400">Ninguna butaca seleccionada.</p>
                  <span className="text-[10px] text-slate-500 block">
                    Selecciona las butacas directamente sobre el mapa de la izquierda.
                  </span>
                </div>
              ) : (
                posSelectedSeats.map((item) => (
                  <div
                    key={item.seatId}
                    className={`p-2 rounded-xl flex items-center justify-between gap-2 text-xs border ${
                      theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-[#0E1626] border-slate-800 text-white'
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className={`font-bold font-sports uppercase tracking-wide truncate ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                        Sec. #{item.sectionNumber} ({item.zoneName})
                      </div>
                      <div className={`text-[11px] font-medium ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
                        Fila {item.rowLabel} • Asiento {String(item.seatNumber).padStart(2, '0')}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                        ${item.price} MXN
                      </span>
                      <button
                        type="button"
                        onClick={() => setPosSelectedSeats((prev) => prev.filter((s) => s.seatId !== item.seatId))}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                          theme === 'light' ? 'bg-slate-200 hover:bg-slate-300 text-slate-600 hover:text-red-600' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400'
                        }`}
                        title="Quitar boleto"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total General Prominente */}
            <div className={`p-3 rounded-xl flex items-center justify-between border ${
              theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-[#0E1626] border-slate-800 text-white'
            }`}>
              <div>
                <span className={`text-[10px] uppercase font-bold tracking-wider block ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Total a Cobrar</span>
                <span className={`text-[11px] font-semibold ${theme === 'light' ? 'text-slate-600' : 'text-slate-500'}`}>{posSelectedSeats.length} {posSelectedSeats.length === 1 ? 'boleto' : 'boletos'}</span>
              </div>
              <div className="text-right">
                <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-scoreboard">
                  ${grandTotal.toLocaleString('es-MX')} <span className={`text-xs font-normal ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>MXN</span>
                </span>
              </div>
            </div>

            {/* Datos Opcionales del Comprador y Descuento (Accordion Colapsable) */}
            <div className="border-t border-slate-800/80 pt-2">
              <button
                type="button"
                onClick={() => setShowOptionalDetails(!showOptionalDetails)}
                className="w-full text-[11px] font-bold text-slate-400 hover:text-slate-200 flex items-center justify-between py-1 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Datos de Comprador y Descuentos (Opcional)</span>
                </span>
                {showOptionalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showOptionalDetails && (
                <div className="space-y-2 mt-2 pt-2 border-t border-slate-800/60 animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Nombre Comprador
                      </label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Cliente Ventanilla"
                        className={`w-full rounded-lg px-2.5 py-1 text-xs focus:outline-hidden focus:border-red-500 border ${
                          theme === 'light' ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400' : 'bg-[#0D1527] border-slate-700/80 text-white placeholder-slate-600'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Correo Copia
                      </label>
                      <input
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="cliente@email.com"
                        className={`w-full rounded-lg px-2.5 py-1 text-xs focus:outline-hidden focus:border-red-500 border ${
                          theme === 'light' ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400' : 'bg-[#0D1527] border-slate-700/80 text-white placeholder-slate-600'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Código Socio / Descuento */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <div className="relative flex-1">
                      <Percent className="w-3 h-3 text-slate-500 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value)}
                        placeholder="Código (SOCIO10, CORTESIA)"
                        className={`w-full rounded-lg pl-7 pr-2 py-1 text-xs uppercase focus:outline-hidden focus:border-red-500 font-mono border ${
                          theme === 'light' ? 'bg-white border-slate-300 text-slate-900 placeholder-slate-400' : 'bg-[#0D1527] border-slate-700/80 text-white placeholder-slate-600'
                        }`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyDiscount}
                      className={`px-2.5 py-1 border text-xs font-bold rounded-lg cursor-pointer ${
                        theme === 'light' ? 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-700' : 'bg-[#1E2C4A] border-slate-700 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      Aplicar
                    </button>
                  </div>

                  {appliedDiscountPercent > 0 && (
                    <div className="text-[11px] text-emerald-400 flex items-center justify-between bg-emerald-950/40 p-1.5 rounded-lg border border-emerald-800/40">
                      <span>Descuento ({appliedDiscountPercent}%):</span>
                      <span className="font-bold">-${discountAmount} MXN</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. MÉTODO DE PAGO COMPACTO (Fila Horizontal con Padding Reducido) */}
            <div className="space-y-1.5 border-t border-slate-800/80 pt-2.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Método de Pago
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
                  { id: 'tarjeta', label: 'Tarjeta TPV', icon: CreditCard },
                ].map((m) => {
                  const IconComp = m.icon;
                  const isSel = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`py-2 px-2.5 rounded-xl border text-center text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isSel
                          ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-950/50'
                          : theme === 'light'
                          ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          : 'bg-[#0D1527] text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <IconComp className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Calculadora de Efectivo */}
              {paymentMethod === 'efectivo' && (
                <div className={`p-2.5 rounded-xl space-y-1.5 mt-2 border ${
                  theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-[#0D1527] border-slate-800'
                }`}>
                  <div className={`flex items-center justify-between text-xs ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>
                    <span>Efectivo Recibido:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">$</span>
                      <input
                        type="number"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                        placeholder={`${grandTotal}`}
                        className={`w-24 rounded-lg px-2 py-1 text-right text-xs font-bold focus:outline-hidden focus:border-red-500 border ${
                          theme === 'light' ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#141E34] border-slate-700 text-white'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Billetes Rápidos */}
                  <div className="flex items-center gap-1 justify-end">
                    {[200, 500, 1000].map((billete) => (
                      <button
                        key={billete}
                        type="button"
                        onClick={() => setCashReceived(String(billete))}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-md cursor-pointer ${
                          theme === 'light' ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        ${billete}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCashReceived(String(grandTotal))}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md border cursor-pointer ${
                        theme === 'light' ? 'bg-red-100 hover:bg-red-200 text-red-700 border-red-300' : 'bg-red-950 hover:bg-red-900 text-red-300 border-red-800/40'
                      }`}
                    >
                      Exacto
                    </button>
                  </div>

                  <div className={`flex items-center justify-between text-xs pt-1 border-t ${
                    theme === 'light' ? 'border-slate-200 text-slate-900' : 'border-slate-800/80 text-white'
                  }`}>
                    <span className={`font-bold ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Cambio:</span>
                    <span className={`text-sm font-black font-sports ${changeAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                      ${changeAmount.toLocaleString('es-MX')} MXN
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 5. STATUS VISUAL CLARO DE ASIGNACIÓN */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className={`p-2 rounded-xl border flex items-center gap-2 text-xs font-bold ${
                posSelectedSeats.length > 0
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : 'bg-amber-950/30 border-amber-800/50 text-amber-300'
              }`}>
                {posSelectedSeats.length > 0 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Status: ✓ Listo para cobrar e imprimir ({posSelectedSeats.length} {posSelectedSeats.length === 1 ? 'boleto' : 'boletos'})</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Status: ⚠️ Pendiente de seleccionar asientos</span>
                  </>
                )}
              </div>

              {/* Botón Principal Accionable */}
              <button
                type="button"
                onClick={handleProcessPosSale}
                disabled={isProcessing || posSelectedSeats.length === 0}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:opacity-50 text-white font-black text-xs sm:text-sm uppercase tracking-wider font-sports flex items-center justify-center gap-2 shadow-xl shadow-red-950/60 active:scale-[0.99] transition-all cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Emitiendo Boletos...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>Cobrar e Imprimir Boletos Térmicos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE IMPRESIÓN DE BOLETOS TÉRMICOS (WINDOW.PRINT) */}
      {showPrintModal && lastCompletedSale && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#141E34] border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="p-4 bg-gradient-to-r from-red-900/60 to-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-sports font-bold text-lg uppercase">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <span>¡Venta Completada con Éxito! Folio: {lastCompletedSale.posSaleId}</span>
              </div>
              <button
                type="button"
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

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleTriggerPrint}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm uppercase font-sports rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-5 h-5" />
                  <span>Imprimir Todos los Boletos ({lastCompletedSale.tickets.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="py-3 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase rounded-xl cursor-pointer"
                >
                  Cerrar
                </button>
              </div>

              {/* Vista Previa de Formato Térmico Físico (80mm width standard) */}
              <div className="border border-slate-700 rounded-xl p-4 bg-slate-900 space-y-4 max-h-[60vh] overflow-y-auto">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Vista Previa de Impresión Térmica (Papel 80mm Estadio)
                </h3>

                <div id="thermal-print-area" className="space-y-6">
                  {lastCompletedSale.tickets.map((tkt) => (
                    <div
                      key={tkt.id}
                      className="bg-white text-black p-4 font-mono text-[11px] leading-tight rounded-sm shadow-md max-w-[80mm] mx-auto border-2 border-black"
                      style={{ width: '80mm', color: '#000', backgroundColor: '#fff' }}
                    >
                      <div className="text-center font-bold text-[13px] uppercase border-b-2 border-black pb-2 mb-2">
                        CLUB DE BÉISBOL VENADOS DE MAZATLÁN
                        <div className="text-[10px] font-normal">ESTADIO TEODORO MARISCAL</div>
                        <div className="text-[9px] font-semibold mt-0.5">TEMPORADA REGULAR LMP 2026</div>
                      </div>

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

                      <div className="flex flex-col items-center justify-center my-3 py-1">
                        <QRCodeDisplay value={tkt.qrId} size={150} alt={`QR Boleto ${tkt.qrId}`} />
                        <div className="font-bold text-[10px] tracking-wider mt-1.5">{tkt.qrId}</div>
                      </div>

                      <div className="text-[9px] space-y-0.5 border-t border-dashed border-black pt-2">
                        <div>FOLIO POS: {tkt.posSaleId}</div>
                        <div>COMPRADOR: {tkt.customerName || 'VENTANILLA'}</div>
                        <div>EMITIDO POR: {tkt.issuedBy}</div>
                        <div>TERMINAL: {tkt.terminalId}</div>
                        <div>FECHA: {new Date(tkt.createdAt).toLocaleString()}</div>
                      </div>

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

      {/* MODAL DE CORTE DE CAJA / RESUMEN DE TURNO */}
      {showShiftModal && (
        <div 
          onClick={() => setShowShiftModal(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className={`border rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85vh] h-full sm:h-auto overflow-hidden cursor-default transition-colors duration-200 my-auto ${
              theme === 'light'
                ? 'bg-white border-slate-200 text-slate-900 shadow-2xl'
                : 'bg-[#141E34] border-slate-800 text-white'
            }`}
          >
            {/* Cabecera del Modal (Fija) */}
            <div className={`flex items-center justify-between border-b p-3.5 sm:p-5 shrink-0 ${
              theme === 'light' ? 'border-slate-100 bg-slate-50' : 'border-slate-800 bg-[#10192e]'
            }`}>
              <div className={`flex items-center gap-2 font-sports font-bold text-sm sm:text-lg uppercase ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>
                <Receipt className="w-5 h-5 text-red-500 shrink-0" />
                <span>Corte de Caja del Turno</span>
              </div>
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className={`p-2 rounded-xl transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center ${
                  theme === 'light' ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Cerrar modal"
                aria-label="Cerrar modal"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Cuerpo del Modal (Desplazable) */}
            <div className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1 custom-scrollbar pb-6">
              <div className="flex flex-col sm:flex-row sm:grid sm:grid-cols-2 gap-3">
                <div className={`p-4 rounded-xl border text-center flex-1 ${
                  theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-[#0E1626] border-slate-800 text-white'
                }`}>
                  <span className={`text-xs uppercase font-bold block mb-1 ${
                    theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                  }`}>Ventas Totales</span>
                  <span className={`text-xl sm:text-2xl font-black font-sports block ${
                    theme === 'light' ? 'text-slate-950' : 'text-white'
                  }`}>
                    ${shiftTotalAmount.toLocaleString('es-MX')} MXN
                  </span>
                  <span className={`text-[10px] block mt-1 ${
                    theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                  }`}>{shiftSales.length} transacciones</span>
                </div>
                <div className={`p-4 rounded-xl border text-center flex-1 ${
                  theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-[#0E1626] border-slate-800 text-white'
                }`}>
                  <span className={`text-xs uppercase font-bold block mb-1 ${
                    theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                  }`}>Boletos Emitidos</span>
                  <span className={`text-xl sm:text-2xl font-black font-sports block ${
                    theme === 'light' ? 'text-red-600' : 'text-red-400'
                  }`}>
                    {shiftTicketsCount} Boletos
                  </span>
                  <span className={`text-[10px] block mt-1 ${
                    theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                  }`}>Impresos en papel térmico</span>
                </div>
              </div>

              <div className={`p-4 rounded-xl border space-y-2.5 text-xs ${
                theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-[#0E1626] border-slate-800 text-slate-300'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Banknote className={`w-4 h-4 ${theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'}`} /> 
                    <span>Efectivo en Caja:</span>
                  </span>
                  <span className={`font-bold ${theme === 'light' ? 'text-slate-950' : 'text-white'}`}>${shiftCashAmount.toLocaleString('es-MX')} MXN</span>
                </div>
                <div className={`flex items-center justify-between pt-2 border-t ${
                  theme === 'light' ? 'border-slate-200' : 'border-slate-800'
                }`}>
                  <span className="flex items-center gap-1.5 font-medium">
                    <CreditCard className={`w-4 h-4 ${theme === 'light' ? 'text-blue-600' : 'text-blue-400'}`} /> 
                    <span>Cobros TPV Tarjeta:</span>
                  </span>
                  <span className={`font-bold ${theme === 'light' ? 'text-slate-950' : 'text-white'}`}>${shiftCardAmount.toLocaleString('es-MX')} MXN</span>
                </div>
              </div>

              {/* Historial de transacciones para reimpresión de compras anteriores */}
              <div className={`border-t pt-4 ${
                theme === 'light' ? 'border-slate-200' : 'border-slate-800/80'
              }`}>
                <h4 className={`text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5 ${
                  theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                }`}>
                  <Printer className="w-4 h-4 text-slate-400" />
                  Historial de Ventas (Reimpresión)
                </h4>
                {loadingShift ? (
                  <div className="text-center py-4 text-xs text-slate-500">Cargando transacciones...</div>
                ) : shiftSales.length === 0 ? (
                  <div className={`text-center py-5 text-xs text-slate-500 border border-dashed rounded-xl ${
                    theme === 'light' ? 'border-slate-300 bg-slate-50/50' : 'border-slate-800 bg-[#0A0F1D]/50'
                  }`}>
                    No hay transacciones registradas en este turno todavía.
                  </div>
                ) : (
                  <div className={`max-h-60 overflow-y-auto border rounded-xl divide-y custom-scrollbar ${
                    theme === 'light' ? 'border-slate-200 bg-white divide-slate-100' : 'border-slate-800 bg-[#0A0F1D]/80 divide-slate-800/60'
                  }`}>
                    {shiftSales.map((sale) => (
                      <div key={sale.id || sale.posSaleId} className={`p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs transition-colors ${
                        theme === 'light' ? 'hover:bg-slate-50 text-slate-900' : 'hover:bg-[#1A2846] text-slate-300'
                      }`}>
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`font-mono font-bold ${theme === 'light' ? 'text-slate-950' : 'text-white'}`}>{sale.posSaleId}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              theme === 'light' ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300'
                            }`}>
                              {sale.paymentMethod === 'efectivo' ? '💵 Efectivo' : '💳 Tarjeta'}
                            </span>
                          </div>
                          <div className={`text-[11px] truncate ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                            Cliente: <strong className={theme === 'light' ? 'text-slate-800' : 'text-slate-200'}>{sale.customerName || 'Cliente Ventanilla'}</strong> • {sale.ticketCount || 1} {sale.ticketCount === 1 ? 'boleto' : 'boletos'}
                          </div>
                          {sale.date && (
                            <div className="text-[10px] text-slate-500">
                              {new Date(sale.date).toLocaleString('es-MX', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <span className={`font-bold font-mono text-sm ${
                            theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                          }`}>
                            ${(Number(sale.amount) || 0).toLocaleString('es-MX')} MXN
                          </span>
                          <button
                            type="button"
                            disabled={isReprinting === sale.posSaleId}
                            onClick={() => handleReprintSale(sale)}
                            className="px-2.5 py-1.5 rounded-lg bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white transition-all cursor-pointer flex items-center gap-1 font-bold text-[11px] min-h-[36px]"
                            title="Reimprimir esta compra"
                          >
                            {isReprinting === sale.posSaleId ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Printer className="w-3.5 h-3.5" />
                            )}
                            <span>Reimprimir</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pie del Modal (Fijo) */}
            <div className={`flex items-center justify-end gap-3 p-3.5 sm:p-4 border-t shrink-0 ${
              theme === 'light' ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-[#0F1626]/90'
            }`}>
              <button
                type="button"
                onClick={() => window.print()}
                className={`px-4 py-2.5 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs border min-h-[42px] ${
                  theme === 'light' 
                    ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300' 
                    : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'
                }`}
              >
                <Printer className="w-4 h-4" /> 
                <span className="hidden sm:inline">Imprimir Reporte</span>
                <span className="sm:hidden">Reporte</span>
              </button>
              <button
                type="button"
                onClick={() => setShowShiftModal(false)}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase font-sports rounded-xl cursor-pointer shadow-md min-h-[42px] flex items-center justify-center"
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
