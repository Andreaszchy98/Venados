import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserProfile, VenueEvent, SeatSection, EventSeat, EventType } from '../../types';
import {
  BaseballFieldGraphic,
  SoccerFieldGraphic,
  BasketballCourtGraphic,
  ConcertStageGraphic,
  GenericEventGraphic,
} from '../../components/fieldGraphics';
import {
  subscribeSeatSections,
  subscribeEventSeats,
  purchaseSeatsTransaction,
  lockSeatSelectionTransaction,
  releaseSeatLockTransaction,
  SEAT_LOCK_DURATION_MS,
  getZonePrice,
  MARISCAL_ZONES,
  getStadiumZones,
  isEncantoVenue,
  ENCANTO_GATES_GUIDE,
  SeatPurchaseItem,
  buildSectionsForVenue,
} from '../../lib/seatMap';
import { isEventPassed } from '../../lib/venueEvents';
import { EncantoStadiumMap } from '../../components/stadiumMaps/EncantoStadiumMap';
import { TeodoroMariscalStadiumMap } from '../../components/stadiumMaps/TeodoroMariscalStadiumMap';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import { createStripeCheckoutSession } from '../../lib/stripe';
import { CardPaymentModal } from '../../components/shared/CardPaymentModal';
import { DirectPaymentResult } from '../../lib/stripe';
import {
  MapPin,
  Calendar,
  Clock,
  ArrowLeft,
  AlertCircle,
  ShieldCheck,
  CreditCard,
  X,
  Users,
  Maximize2,
  Layers,
  DoorOpen,
} from 'lucide-react';

interface SeatMapSelectorProps {
  event: VenueEvent;
  user: UserProfile;
  stadiumName: string;
  onPurchaseSuccess: (purchaseId: string, count: number) => void;
  onCancel: () => void;
  onRequireAuth?: () => void;
}

function getFieldGraphic(type: EventType) {
  switch (type) {
    case 'baseball':
      return BaseballFieldGraphic;
    case 'football':
      return SoccerFieldGraphic;
    case 'basketball':
      return BasketballCourtGraphic;
    case 'concert':
      return ConcertStageGraphic;
    default:
      return GenericEventGraphic;
  }
}

export const SeatMapSelector: React.FC<SeatMapSelectorProps> = ({
  event,
  user,
  stadiumName,
  onPurchaseSuccess,
  onCancel,
  onRequireAuth,
}) => {
  const isEncanto = useMemo(
    () => isEncantoVenue(event.venueId, stadiumName, event.type),
    [event.venueId, stadiumName, event.type]
  );

  const stadiumZones = useMemo(
    () => (isEncanto ? getStadiumZones(event.venueId, stadiumName, event.type) : MARISCAL_ZONES),
    [isEncanto, event.venueId, stadiumName, event.type]
  );

  // Gráfico central del recinto/cancha según el tipo de evento
  const FieldGraphic = getFieldGraphic(event.type);

  const [sections, setSections] = useState<SeatSection[]>([]);
  const [eventSeats, setEventSeats] = useState<EventSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating] = useState(false);

  // Sección activa para visualizar la cuadrícula
  const [activeSectionNumber, setActiveSectionNumber] = useState<string>(
    isEncanto ? 'PC-1' : '104'
  );
  const [activeZoneFilter, setActiveZoneFilter] = useState<string>('Todas');

  // Asientos seleccionados para la compra conjunta (restaurado de sessionStorage para no perder progreso)
  const [selectedSeats, setSelectedSeats] = useState<SeatPurchaseItem[]>(() => {
    try {
      const saved = sessionStorage.getItem(`vxp_seats_${event.id}`);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      const uniqueMap = new Map<string, SeatPurchaseItem>();
      for (const item of parsed) {
        if (item && item.seatId && !uniqueMap.has(item.seatId)) {
          uniqueMap.set(item.seatId, item);
        }
      }
      return Array.from(uniqueMap.values());
    } catch {
      return [];
    }
  });

  // Evitar ejecuciones duplicadas concurrentes por doble clic sobre el mismo asiento
  const pendingSeatLocks = useRef<Set<string>>(new Set());

  // Detección automática de cierre de venta o evento finalizado
  const isEventClosed = useMemo(() => {
    return (
      isEventPassed(event) ||
      event.status === 'finalizado' ||
      event.status === 'cancelado' ||
      event.ticketsAvailable === false
    );
  }, [event]);

  // Timestamp de expiración de la reserva atómica de 8 minutos
  const [lockExpiresAt, setLockExpiresAt] = useState<number | null>(() => {
    try {
      const saved = sessionStorage.getItem(`vxp_seats_lock_${event.id}`);
      return saved ? Number(saved) : null;
    } catch {
      return null;
    }
  });
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState<number>(0);

  // Contador regresivo para el bloqueo de 8 minutos
  useEffect(() => {
    if (!lockExpiresAt || selectedSeats.length === 0) {
      setLockRemainingSeconds(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((lockExpiresAt - now) / 1000));
      setLockRemainingSeconds(diff);

      if (diff === 0) {
        // Expiraron los 8 minutos de reserva: liberar asientos automáticamente
        const userId = user?.uid || 'guest';
        selectedSeats.forEach((s) => {
          releaseSeatLockTransaction(s.seatId, userId).catch(() => {});
        });
        setSelectedSeats([]);
        setLockExpiresAt(null);
        try {
          sessionStorage.removeItem(`vxp_seats_${event.id}`);
          sessionStorage.removeItem(`vxp_seats_lock_${event.id}`);
        } catch {}
        setPurchaseError(
          'Tu tiempo de reserva exclusiva de 8 minutos ha concluido. Los asientos han sido liberados para otros aficionados.'
        );
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockExpiresAt, selectedSeats, event.id, user?.uid]);

  // Guardar lockExpiresAt en sessionStorage
  useEffect(() => {
    try {
      if (lockExpiresAt && selectedSeats.length > 0) {
        sessionStorage.setItem(`vxp_seats_lock_${event.id}`, String(lockExpiresAt));
      } else {
        sessionStorage.removeItem(`vxp_seats_lock_${event.id}`);
      }
    } catch {}
  }, [lockExpiresAt, selectedSeats.length, event.id]);

  // Guardar asientos seleccionados en sessionStorage en cada cambio
  useEffect(() => {
    try {
      if (selectedSeats.length > 0) {
        sessionStorage.setItem(`vxp_seats_${event.id}`, JSON.stringify(selectedSeats));
      } else {
        sessionStorage.removeItem(`vxp_seats_${event.id}`);
      }
    } catch (e) {
      console.warn('Error guardando asientos seleccionados:', e);
    }
  }, [selectedSeats, event.id]);

  // Método de pago (Exclusivo Tarjeta en Línea)
  const [paymentMethod] = useState<'Tarjeta en Línea'>('Tarjeta en Línea');
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [externalStripeUrl, setExternalStripeUrl] = useState<string | null>(null);

  // Helper para normalizar identificadores de sección (elimina guiones, espacios y mayúsculas)
  const normalizeSec = (val?: string | null) => (val || '').trim().toUpperCase().replace(/[\s_-]+/g, '');

  // Cargar y escuchar secciones del estadio
  useEffect(() => {
    setLoading(true);
    const unsubscribeSections = subscribeSeatSections(
      event.venueId,
      (fetchedSections) => {
        setSections(fetchedSections);
        setLoading(false);
      },
      (err) => {
        console.warn('Error en secciones:', err);
        setLoading(false);
      }
    );

    return () => unsubscribeSections();
  }, [event.venueId]);

  // Cargar y escuchar asientos del evento en tiempo real
  useEffect(() => {
    setLoading(true);
    const unsubscribeSeats = subscribeEventSeats(
      event.id,
      (seats) => {
        setEventSeats(seats);
        setLoading(false);
      },
      (err) => {
        console.warn('Aviso escuchando asientos de evento:', err);
        setLoading(false);
      }
    );

    return () => unsubscribeSeats();
  }, [event.id]);

  // Index de asientos por sección para acceso rápido y sin colisiones inter-sección
  const seatsBySection = useMemo(() => {
    const map = new Map<string, EventSeat[]>();
    for (const seat of eventSeats) {
      const secNum = seat.sectionNumber || seat.sectionId?.split('_sec_')[1] || '';
      const key = normalizeSec(secNum);
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(seat);
    }
    return map;
  }, [eventSeats]);

  // Sección actualmente seleccionada: resuelve dinámicamente según la sección seleccionada por el usuario
  const currentSection = useMemo<SeatSection | null>(() => {
    const targetNumber = activeSectionNumber || (isEncanto ? 'PC-1' : '104');
    const normTarget = normalizeSec(targetNumber);

    // 1. Coincidencia exacta o normalizada en las secciones obtenidas de Firestore
    let found = sections.find((s) => s.sectionNumber === targetNumber);
    if (!found) {
      found = sections.find((s) => normalizeSec(s.sectionNumber) === normTarget);
    }
    if (found) return found;

    // 2. Coincidencia en catálogo maestro de la sede
    const masterSections = buildSectionsForVenue(event.venueId, event.type);
    const masterFound = masterSections.find((s) => normalizeSec(s.sectionNumber) === normTarget);
    if (masterFound) {
      return {
        id: `${event.venueId}_sec_${masterFound.sectionNumber.replace(/\s+/g, '_')}`,
        ...masterFound,
      };
    }

    // 3. Inferencia precisa para Estadio El Encanto por prefijo de zona oficial
    if (isEncanto) {
      let zoneName = 'Poniente Central';
      let rows = 3;
      let seatsPerRow = 10;

      if (normTarget.startsWith('TE')) zoneName = 'Tiro de Esquina';
      else if (normTarget.startsWith('PL')) zoneName = 'Poniente Lateral';
      else if (normTarget.startsWith('PC')) zoneName = 'Poniente Central';
      else if (normTarget.startsWith('PS')) zoneName = 'Poniente Superior';
      else if (normTarget.startsWith('OC')) zoneName = 'Oriente Central';
      else if (normTarget.startsWith('OL')) zoneName = 'Oriente Lateral';
      else if (normTarget.startsWith('OS')) zoneName = 'Oriente Superior';
      else if (normTarget.startsWith('CS')) zoneName = 'Cabecera Superior';
      else if (normTarget.startsWith('GN')) zoneName = 'General Norte';
      else if (normTarget.startsWith('GS')) zoneName = 'General Sur';
      else if (normTarget.startsWith('SB')) {
        zoneName = 'Sky Boxes';
        rows = 2;
        seatsPerRow = 8;
      } else if (normTarget.startsWith('ZL')) {
        zoneName = 'Zona Lounge';
        rows = 2;
        seatsPerRow = 10;
      } else if (normTarget.startsWith('PALCO')) {
        zoneName = 'Palcos';
        rows = 2;
        seatsPerRow = 6;
      }

      return {
        id: `${event.venueId}_sec_${targetNumber.replace(/\s+/g, '_')}`,
        venueId: event.venueId,
        sectionNumber: targetNumber,
        zoneName,
        rows,
        seatsPerRow,
        totalSeats: rows * seatsPerRow,
      };
    }

    // 4. Si no se encuentra en las anteriores, preservar estrictamente el targetNumber
    return {
      id: `${event.venueId}_sec_${targetNumber.replace(/\s+/g, '_')}`,
      venueId: event.venueId,
      sectionNumber: targetNumber,
      zoneName: sections[0]?.zoneName || 'General',
      rows: 3,
      seatsPerRow: 10,
      totalSeats: 30,
    };
  }, [sections, activeSectionNumber, isEncanto, event.venueId, event.type]);

  // Asientos de la sección activa
  const currentSectionSeats = useMemo(() => {
    if (!currentSection) return [];
    const key = normalizeSec(currentSection.sectionNumber);
    const rawSeats = seatsBySection.get(key) || [];
    // Deduplicar estrictamente por id y por (rowLabel + seatNumber)
    const uniqueSeatsMap = new Map<string, EventSeat>();
    for (const s of rawSeats) {
      const uniqueKey = s.id || `${s.rowLabel}_${s.seatNumber}`;
      if (!uniqueSeatsMap.has(uniqueKey)) {
        uniqueSeatsMap.set(uniqueKey, s);
      }
    }
    return Array.from(uniqueSeatsMap.values());
  }, [currentSection, seatsBySection]);

  // Estadísticas globales de disponibilidad (Toma en cuenta si el admin de la sede declaró asientos disponibles)
  const globalStats = useMemo(() => {
    const sold = eventSeats.filter((s) => s.status === 'vendido').length;
    if (event?.availableSeats !== undefined && event.availableSeats > 0) {
      const declaredTotal = event.totalCapacity || event.availableSeats;
      const declaredAvailable = Math.max(0, event.availableSeats - sold);
      return { total: declaredTotal, sold, available: declaredAvailable };
    }

    const total = isEncanto
      ? sections.reduce(
          (acc, s) => acc + (s.totalSeats || (s.rows || 3) * (s.seatsPerRow || 10)),
          0
        ) || 3120
      : 94 * 30;
    const available = Math.max(0, total - sold);
    return { total, sold, available };
  }, [sections, eventSeats, isEncanto, event?.availableSeats, event?.totalCapacity]);

  // Alternar selección de un asiento mediante Transacción Atómica con bloqueo de 8 minutos
  const handleToggleSeat = async (seat: EventSeat, section: SeatSection) => {
    if (isEventClosed) {
      setPurchaseError('La venta de boletos ha finalizado o está cerrada para este evento.');
      return;
    }

    if (seat.status === 'vendido') return;

    // Prevenir bloqueos duplicados en transiciones concurrentes / doble clic
    if (pendingSeatLocks.current.has(seat.id)) return;

    const userId = user?.uid || 'guest';
    setPurchaseError(null);
    const isAlreadySelected = selectedSeats.some((s) => s.seatId === seat.id);

    if (isAlreadySelected) {
      // Liberar bloqueo atómico en Firestore
      releaseSeatLockTransaction(seat.id, userId).catch(() => {});
      setSelectedSeats((prev) => {
        const remaining = prev.filter((s) => s.seatId !== seat.id);
        if (remaining.length === 0) {
          setLockExpiresAt(null);
        }
        return remaining;
      });
    } else {
      pendingSeatLocks.current.add(seat.id);
      try {
        const lockRes = await lockSeatSelectionTransaction({
          eventId: event.id,
          seatId: seat.id,
          userId,
          sectionNumber: section.sectionNumber,
          rowLabel: seat.rowLabel,
          seatNumber: seat.seatNumber,
          zoneName: section.zoneName,
          sectionId: section.id,
        });

        // Registrar o actualizar expiración
        setLockExpiresAt(lockRes.lockedUntil);

        const price = getZonePrice(section.zoneName, event);
        const newItem: SeatPurchaseItem = {
          seatId: seat.id,
          sectionId: section.id,
          sectionNumber: section.sectionNumber,
          zoneName: section.zoneName,
          rowLabel: seat.rowLabel,
          seatNumber: seat.seatNumber,
          price,
        };
        setSelectedSeats((prev) => {
          if (prev.some((s) => s.seatId === newItem.seatId)) {
            return prev;
          }
          return [...prev, newItem];
        });
      } catch (err: any) {
        console.warn('Conflicto o error al bloquear asiento:', err);
        const cleanMsg =
          err.message
            ?.replace('SEAT_LOCKED_BY_OTHER: ', '')
            ?.replace('SEAT_ALREADY_SOLD: ', '') ||
          'Este asiento no está disponible en este momento.';
        setPurchaseError(cleanMsg);
      } finally {
        pendingSeatLocks.current.delete(seat.id);
      }
    }
  };

  // Quitar un asiento de la lista de compra y liberar el bloqueo
  const handleRemoveSeat = (seatId: string) => {
    const userId = user?.uid || 'guest';
    releaseSeatLockTransaction(seatId, userId).catch(() => {});
    setSelectedSeats((prev) => {
      const remaining = prev.filter((s) => s.seatId !== seatId);
      if (remaining.length === 0) {
        setLockExpiresAt(null);
      }
      return remaining;
    });
  };

  // Limpiar todos los asientos seleccionados y liberar sus bloqueos
  const handleClearSelectedSeats = () => {
    const userId = user?.uid || 'guest';
    selectedSeats.forEach((s) => {
      releaseSeatLockTransaction(s.seatId, userId).catch(() => {});
    });
    setSelectedSeats([]);
    setLockExpiresAt(null);
    try {
      sessionStorage.removeItem(`vxp_seats_${event.id}`);
      sessionStorage.removeItem(`vxp_seats_lock_${event.id}`);
    } catch {}
  };

  // Total acumulado a pagar
  const totalAmount = useMemo(() => {
    return selectedSeats.reduce((sum, item) => sum + item.price, 0);
  }, [selectedSeats]);

  // Confirmar compra en una sola transacción atómica
  const handleConfirmPurchase = async () => {
    if (selectedSeats.length === 0) return;

    // Si el usuario navega como invitado, solicitamos inicio de sesión sin perder los asientos seleccionados
    if (!user || !user.uid) {
      if (onRequireAuth) {
        onRequireAuth();
      }
      return;
    }

    setPurchasing(true);
    setPurchaseError(null);

    // Abrir pasarela segura de pago con tarjeta en línea (método exclusivo para boletos)
    setPurchasing(false);
    setIsCardModalOpen(true);

    // Precargar sesión externa opcional de Stripe (sin bloquear ni redirigir la ventana actual)
    try {
      const firstSeat = selectedSeats[0];
      createStripeCheckoutSession(
        {
          eventId: event.id,
          matchTitle: event.name,
          stadium: stadiumName,
          venueId: event.venueId,
          sectionId: firstSeat.sectionId || firstSeat.sectionNumber,
          section: `${firstSeat.zoneName} - Sec. ${firstSeat.sectionNumber}`,
          seatRow: `Fila ${firstSeat.rowLabel}`,
          seatNumber: `Asiento ${firstSeat.seatNumber}`,
          price: totalAmount,
          userId: user.uid,
          customerName: user.displayName || user.email || 'Aficionado',
          customerEmail: user.email || undefined,
          gate: stadiumZones[firstSeat.zoneName]?.gate || event.gate || 'Puertas Generales',
          seatId: firstSeat.seatId,
          selectedSeats,
        },
        user.email || undefined,
        `${window.location.origin}/?stripe_status=success`,
        `${window.location.origin}/?stripe_status=cancelled`
      )
        .then((res) => {
          if (res?.sessionUrl) {
            setExternalStripeUrl(res.sessionUrl);
          }
        })
        .catch((err) => {
          console.warn('Stripe checkout session externa opcional no disponible:', err);
        });
    } catch {}
  };

  const handleCardPaymentSuccess = async (paymentResult: DirectPaymentResult) => {
    setIsCardModalOpen(false);
    setPurchasing(true);
    setPurchaseError(null);

    try {
      const result = await purchaseSeatsTransaction({
        userId: user.uid,
        customerName: user.displayName || user.email || 'Aficionado',
        event,
        stadiumName,
        selectedSeats,
        paymentMethod: 'Tarjeta en Línea',
      });

      try {
        sessionStorage.removeItem(`vxp_seats_${event.id}`);
      } catch {}

      onPurchaseSuccess(result.purchaseId, result.count);
    } catch (err: any) {
      console.error('Error en transacción de compra con tarjeta:', err);
      const message = err.message || 'Error al emitir los boletos tras el pago.';
      setPurchaseError(message);
    } finally {
      setPurchasing(false);
    }
  };

  // Lista única de zonas para filtrar
  const availableZones = useMemo(() => {
    return Object.keys(stadiumZones);
  }, [stadiumZones]);

  // Secciones filtradas
  const filteredSections = useMemo(() => {
    if (activeZoneFilter === 'Todas') return sections;
    return sections.filter((s) => s.zoneName === activeZoneFilter);
  }, [sections, activeZoneFilter]);

  // Selección de sección con auto-scroll directo a la cuadrícula de butacas en móvil
  const handleSelectSection = (secNum: string) => {
    setActiveSectionNumber(secNum);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setTimeout(() => {
        document.getElementById('seat-grid-container')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  if (loading || generating) {
    return (
      <div className="bg-[#0F1626] rounded-3xl p-12 border border-slate-700/80 shadow-xl text-center space-y-4">
        <LoadingSpinner
          message={
            generating
              ? 'Configurando disponibilidad del mapa físico para este partido...'
              : isEncanto
              ? `Cargando mapa oficial de asientos de ${stadiumName}...`
              : 'Cargando mapa de asientos del Estadio Teodoro Mariscal...'
          }
        />
        <p className="text-xs text-slate-400">
          {isEncanto
            ? 'Sincronizando secciones y cuadrículas de butacas en tiempo real desde Firestore.'
            : 'Sincronizando 94 secciones y cuadrículas de butacas en tiempo real desde Firestore.'}
        </p>
      </div>
    );
  }

  const activeZoneMeta = currentSection
    ? isEncanto
      ? stadiumZones[currentSection.zoneName]
      : MARISCAL_ZONES[currentSection.zoneName]
    : null;

  return (
    <div className="space-y-6">
      {/* 1. Header con Información del Evento & Botón Volver */}
      <div className="bg-[#0F1626] p-4 sm:p-5 rounded-3xl border border-slate-700/80 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1 text-xs font-sports font-bold tracking-wider uppercase text-slate-400 hover:text-white transition-colors cursor-pointer mr-1"
            >
              <ArrowLeft className="w-4 h-4" /> Volver a eventos
            </button>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider font-sports ${
                isEncanto ? 'bg-amber-950/70 text-amber-300 border border-amber-500/50' : 'bg-red-900/40 text-red-300 border border-red-700/50'
              }`}
            >
              {isEncanto ? 'Fútbol • Liga Expansión MX' : event.type}
            </span>
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 font-sports">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {isEncanto ? 'Mapa Oficial en Vivo' : 'Mapa en Vivo'}
            </span>
          </div>

          <h2 className="text-base sm:text-xl font-black text-white tracking-wide font-sports uppercase">
            {event.name}
          </h2>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span className="flex items-center gap-1 font-semibold text-slate-200">
              <Calendar className={`w-3.5 h-3.5 ${isEncanto ? 'text-amber-400' : 'text-red-500'}`} />
              {event.date}
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {event.time || '20:00 hrs'}
            </span>
            <span className="flex items-center gap-1 font-bold text-slate-200">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              {stadiumName}
            </span>
          </div>
        </div>

        {/* Contadores globales */}
        <div className="flex items-center gap-3 bg-[#0A0E17] p-2.5 rounded-2xl border border-slate-700/80 text-xs">
          <div className="text-center px-2">
            <span className="block text-[10px] text-slate-400 font-sports font-bold uppercase tracking-wider">Disponibles</span>
            <span className="text-sm font-scoreboard font-bold text-emerald-400">{globalStats.available}</span>
          </div>
          <div className="w-px h-6 bg-slate-700"></div>
          <div className="text-center px-2">
            <span className="block text-[10px] text-slate-400 font-sports font-bold uppercase tracking-wider">Ocupados</span>
            <span className="text-sm font-scoreboard font-bold text-slate-400">{globalStats.sold}</span>
          </div>
          <div className="w-px h-6 bg-slate-700"></div>
          <div className="text-center px-2">
            <span className="block text-[10px] text-slate-400 font-sports font-bold uppercase tracking-wider">Capacidad</span>
            <span className="text-sm font-scoreboard font-bold text-white">{globalStats.total}</span>
          </div>
        </div>
      </div>

      {/* Banner si el evento ya finalizó o la venta está cerrada */}
      {isEventClosed && (
        <div className="bg-red-950/80 border border-red-500/70 rounded-2xl p-4 flex items-center gap-3 text-red-200 shadow-xl">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-bold text-sm font-sports uppercase tracking-wider text-red-100">
              Venta de boletos concluida / Juego o evento finalizado
            </p>
            <p className="text-xs text-red-300">
              La fecha y horario programados para este evento ya pasaron o la venta ha sido cerrada. El mapa de butacas está en modo de consulta.
            </p>
          </div>
        </div>
      )}

      {/* 2. Barra de Leyenda de Zonas y Filtro Rápido */}
      <div className="bg-[#0F1626] p-3 sm:p-4 rounded-2xl border border-slate-700/80 shadow-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-sports">
            <Layers className={`w-4 h-4 ${isEncanto ? 'text-amber-400' : 'text-red-500'}`} />
            {isEncanto ? `Zonas Oficiales: ${stadiumName}` : 'Zonas Oficiales del Teodoro Mariscal'}
          </span>
          <span className="text-[11px] text-slate-400">
            {isEncanto
              ? 'Haz clic en una zona para filtrar secciones o selecciónala directamente en el mapa'
              : 'Haz clic en una zona para filtrar secciones o selecciónala en el mapa'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 font-sports">
          <button
            onClick={() => setActiveZoneFilter('Todas')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeZoneFilter === 'Todas'
                ? isEncanto
                  ? 'bg-amber-500 text-black font-black shadow-md'
                  : 'bg-red-600 text-white shadow-md'
                : 'bg-[#0A0E17] text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            Todas ({sections.length})
          </button>

          {availableZones.map((zName) => {
            const zMeta = stadiumZones[zName];
            const price = getZonePrice(zName, event);
            const isFilterActive = activeZoneFilter === zName;

            return (
              <button
                key={zName}
                onClick={() => setActiveZoneFilter(zName)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  isFilterActive
                    ? 'ring-2 ring-red-500 text-white bg-red-950/40 border-red-500 shadow-md'
                    : 'border-slate-700 bg-[#0A0E17] text-slate-300 hover:bg-[#141C2E]'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: zMeta.colorHex }}
                ></span>
                <span>{zName}</span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  ${price}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* GUÍA DE PUERTAS DE ACCESO (Especial para Estadio El Encanto) */}
      {isEncanto && (
        <div className="bg-[#0A0E17] border border-amber-500/40 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-amber-500 text-black flex items-center justify-center text-xs font-black shrink-0">
              <DoorOpen className="w-3.5 h-3.5" />
            </span>
            <span className="font-sports font-bold tracking-wide text-amber-300 uppercase">Guía de Puertas de Acceso Oficiales:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ENCANTO_GATES_GUIDE.map((g) => (
              <span
                key={g.gate}
                className="px-2 py-0.5 rounded-lg bg-[#141C2E] border border-amber-700/50 text-[11px] text-amber-200 font-medium"
              >
                <strong className="font-bold text-white">{g.gate}:</strong> {g.zones.join(', ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. Panel Principal: Mapa Interactivo SVG + Cuadrícula de Asientos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LADO IZQUIERDO: Mapa del Estadio (Herradura / Diamante de Béisbol o Cancha Fútbol Encanto) */}
        <div className="lg:col-span-7 bg-[#0F1626] p-4 sm:p-5 rounded-3xl border border-slate-700/80 shadow-xl space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2 font-sports tracking-wide uppercase">
                <Maximize2 className={`w-4 h-4 ${isEncanto ? 'text-amber-400' : 'text-red-500'}`} />
                {isEncanto ? `Distribución Oficial: ${stadiumName}` : 'Mapa Físico del Estadio'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isEncanto
                  ? 'Toca cualquier sección directamente en el mapa para ver sus butacas'
                  : 'Selecciona una sección directamente en el estadio o en el listado inferior'}
              </p>
            </div>

            {currentSection && (
              <span
                className={`px-2.5 py-1 rounded-xl text-xs font-bold border font-sports tracking-wider ${
                  isEncanto
                    ? 'bg-amber-950/60 text-amber-300 border-amber-500/60'
                    : 'bg-red-950/60 text-red-300 border-red-700/60'
                }`}
              >
                Sección activa: <strong className="font-black text-white">#{currentSection.sectionNumber}</strong> ({currentSection.zoneName})
              </span>
            )}
          </div>

          {/* RENDERIZADO DEL MAPA */}
          {isEncanto ? (
            <EncantoStadiumMap
              sections={sections}
              activeSectionNumber={activeSectionNumber}
              activeZoneFilter={activeZoneFilter === 'Todas' ? null : activeZoneFilter}
              onSelectSection={handleSelectSection}
              event={event}
            />
          ) : (
            <TeodoroMariscalStadiumMap
              sections={sections}
              activeSectionNumber={activeSectionNumber}
              activeZoneFilter={activeZoneFilter === 'Todas' ? null : activeZoneFilter}
              onSelectSection={handleSelectSection}
              event={event}
            />
          )}

          {/* Botón directo en móvil para ir a las butacas si hay una sección activa */}
          {currentSection && (
            <button
              type="button"
              onClick={() => {
                document.getElementById('seat-grid-container')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`lg:hidden w-full py-3 px-4 ${
                isEncanto
                  ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 text-black shadow-amber-500/20'
                  : 'bg-red-600 hover:bg-red-500 text-white'
              } rounded-2xl font-black text-xs flex items-center justify-between shadow-md cursor-pointer transition-all font-sports uppercase tracking-wider`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      activeZoneMeta?.colorHex ||
                      MARISCAL_ZONES[currentSection.zoneName]?.colorHex ||
                      '#D97706',
                  }}
                />
                <span>Ver y Elegir Butacas en Sec. #{currentSection.sectionNumber} ({currentSection.zoneName})</span>
              </div>
              <span className={isEncanto ? 'text-black font-black flex items-center gap-1' : 'text-amber-300 font-extrabold flex items-center gap-1'}>
                Elegir ↓
              </span>
            </button>
          )}
        </div>

        {/* LADO DERECHO: Cuadrícula de Asientos de la Sección Activa */}
        <div
          id="seat-grid-container"
          className="lg:col-span-5 bg-[#0F1626] p-5 rounded-3xl border border-slate-700/80 shadow-xl flex flex-col justify-between space-y-5 scroll-mt-6"
        >
          {currentSection ? (
            <div className="space-y-4">
              {/* Header de la sección activa */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-700/70">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          activeZoneMeta?.colorHex ||
                          MARISCAL_ZONES[currentSection.zoneName]?.colorHex ||
                          '#D97706',
                      }}
                    ></span>
                    <h3 className="text-base font-black text-white font-sports tracking-wide">
                      {isEncanto
                        ? `Sección ${currentSection.sectionNumber}`
                        : `Sección #${currentSection.sectionNumber} • ${currentSection.zoneName}`}
                    </h3>
                    {isEncanto && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#0A0E17] text-slate-300 border border-slate-700">
                        {currentSection.zoneName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isEncanto
                      ? (activeZoneMeta?.description || 'Excelente visibilidad del terreno de juego')
                      : (MARISCAL_ZONES[currentSection.zoneName]?.description ||
                        'Excelente visibilidad del diamante')}
                  </p>
                  {isEncanto && activeZoneMeta?.gate && (
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-amber-950/60 text-[10px] font-bold text-amber-300 border border-amber-500/50">
                      <DoorOpen className="w-3 h-3" /> Acceso: {activeZoneMeta.gate}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block font-sports tracking-wider">Precio</span>
                  <span className="text-base sm:text-lg font-black text-emerald-400 font-scoreboard">
                    ${getZonePrice(currentSection.zoneName, event)}{' '}
                    <span className="text-[10px] font-normal text-slate-400 font-sans">MXN</span>
                  </span>
                </div>
              </div>

              {/* Indicador visual hacia el terreno de juego */}
              <div className="w-full py-1.5 px-3 bg-[#0A0E17] rounded-xl text-center text-[10px] font-black uppercase tracking-widest text-slate-400 border border-slate-700/70 font-sports">
                ▲ FRENTE / TERRENO DE JUEGO ▲
              </div>

              {/* Leyenda de estado de butaca */}
              <div className="flex flex-wrap items-center justify-center gap-3.5 text-[11px] text-slate-300 font-sports">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-md border-2 border-emerald-500 bg-[#141C2E]"></div>
                  <span>Disponible</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-bold ${
                      isEncanto ? 'bg-amber-500 text-black' : 'bg-red-600 text-white'
                    }`}
                  >
                    ✓
                  </div>
                  <span className="font-bold text-white">Tu Selección</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-md bg-amber-950/70 border border-amber-500/80 text-amber-300 flex items-center justify-center text-[9px] font-mono">
                    ⏳
                  </div>
                  <span className="text-amber-300">Apartado (8 min)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-md bg-slate-800 border border-slate-700 text-slate-500 flex items-center justify-center text-[10px]">
                    ✕
                  </div>
                  <span className="text-slate-500">Vendido</span>
                </div>
              </div>

              {/* Cuadrícula de Asientos por Fila */}
              <div className="space-y-3 bg-[#0A0E17] p-4 rounded-2xl border border-slate-700/80">
                {(isEncanto
                  ? Array.from(
                      { length: currentSection.rows || 3 },
                      (_, rIdx) => String.fromCharCode(65 + rIdx)
                    )
                  : ['A', 'B', 'C']
                ).map((rowLabel) => {
                  const rowSeats = currentSectionSeats.filter((s) => s.rowLabel === rowLabel);
                  const seatsPerRow = isEncanto ? currentSection.seatsPerRow || 10 : 10;
                  const seatsList = Array.from({ length: seatsPerRow }, (_, idx) => {
                    const seatNum = idx + 1;
                    const existingSeat = rowSeats.find((s) => Number(s.seatNumber) === seatNum);
                    if (existingSeat) {
                      return existingSeat;
                    }
                    return {
                      id: `${event.id}_${currentSection.sectionNumber.replace(/\s+/g, '_')}_${rowLabel}_${seatNum}`,
                      eventId: event.id,
                      sectionId: currentSection.id,
                      sectionNumber: currentSection.sectionNumber,
                      zoneName: currentSection.zoneName,
                      rowLabel,
                      seatNumber: seatNum,
                      status: 'disponible' as const,
                    };
                  });

                  return (
                    <div key={`row_${currentSection.sectionNumber}_${rowLabel}`} className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-800 text-amber-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 border border-slate-700">
                        {rowLabel}
                      </span>

                      <div
                        className="grid gap-1.5 flex-1"
                        style={{
                          gridTemplateColumns: `repeat(${seatsPerRow}, minmax(0, 1fr))`,
                        }}
                      >
                        {seatsList.map((seat, sIdx) => {
                          const isSelected = selectedSeats.some((s) => s.seatId === seat.id);
                          const isSold =
                            seat.status === 'vendido' &&
                            normalizeSec(seat.sectionNumber) === normalizeSec(currentSection.sectionNumber);
                          const now = Date.now();
                          const isLockedByOther =
                            !isSelected &&
                            seat.status === 'reservado' &&
                            seat.lockedUntil !== undefined &&
                            seat.lockedUntil > now &&
                            seat.lockedBy !== (user?.uid || 'guest') &&
                            normalizeSec(seat.sectionNumber) === normalizeSec(currentSection.sectionNumber);

                          return (
                            <button
                              key={`seat_btn_${currentSection.sectionNumber}_${rowLabel}_${seat.seatNumber}_${seat.id || sIdx}`}
                              type="button"
                              onClick={() => handleToggleSeat(seat, currentSection)}
                              disabled={isSold || isLockedByOther || isEventClosed}
                              title={
                                isEventClosed
                                  ? 'Venta de boletos concluida'
                                  : isSold
                                  ? `Fila ${seat.rowLabel} Asiento ${seat.seatNumber} - Vendido`
                                  : isLockedByOther
                                  ? `Fila ${seat.rowLabel} Asiento ${seat.seatNumber} - Apartado por otro usuario (8 min)`
                                  : isSelected
                                  ? `Fila ${seat.rowLabel} Asiento ${seat.seatNumber} - Tu selección`
                                  : `Fila ${seat.rowLabel} Asiento ${seat.seatNumber} - Disponible`
                              }
                              className={`aspect-square rounded-lg text-[10px] font-extrabold transition-all flex items-center justify-center cursor-pointer ${
                                isEventClosed
                                  ? 'bg-slate-900/90 border border-slate-800 text-slate-600 cursor-not-allowed opacity-60'
                                  : isSold
                                  ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed line-through'
                                  : isLockedByOther
                                  ? 'bg-amber-950/70 border border-amber-500/80 text-amber-300 cursor-not-allowed shadow-inner font-mono'
                                  : isSelected
                                  ? isEncanto
                                    ? 'bg-amber-500 text-black font-black shadow-md scale-105 ring-2 ring-amber-400'
                                    : 'bg-red-600 text-white shadow-md scale-105 ring-2 ring-red-400'
                                  : 'bg-[#141C2E] hover:bg-emerald-950/60 text-slate-100 border-2 border-emerald-500/80 hover:scale-105 hover:border-emerald-400'
                              }`}
                            >
                              {isLockedByOther ? '⏳' : isSelected ? '✓' : seat.seatNumber}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-sports">
                <span>
                  Disponibles en Sec. {currentSection.sectionNumber}:{' '}
                  <strong className="text-emerald-400">
                    {
                      currentSectionSeats.filter(
                        (s) => s.status === 'disponible' && normalizeSec(s.sectionNumber) === normalizeSec(currentSection.sectionNumber)
                      ).length ||
                      Math.max(
                        0,
                        (currentSection.totalSeats || (currentSection.rows || 3) * (currentSection.seatsPerRow || 10)) -
                        currentSectionSeats.filter(
                          (s) => s.status === 'vendido' && normalizeSec(s.sectionNumber) === normalizeSec(currentSection.sectionNumber)
                        ).length
                      )
                    }{' '}
                    de{' '}
                    {currentSection.totalSeats ||
                      (currentSection.rows || 3) * (currentSection.seatsPerRow || 10)}
                  </strong>
                </span>
                <span className="text-[11px] text-slate-500">
                  {isEncanto
                    ? `${currentSection.rows || 3} filas × ${currentSection.seatsPerRow || 10} asientos`
                    : 'Filas A a la C (10 asientos c/u)'}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">
              Selecciona una sección en el mapa para cargar su cuadrícula.
            </div>
          )}

          {/* 4. Panel de Resumen de Compra y Botón de Transacción Atómica */}
          <div className="pt-4 border-t border-slate-700/70 space-y-4">
            {/* Mensaje de error de transacción / Colisión de asientos */}
            {purchaseError && (
              <div className="p-3.5 bg-red-950/60 border border-red-500/50 rounded-2xl flex items-start gap-2.5 text-xs text-red-200 font-semibold animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">No se pudo completar la compra:</p>
                  <p className="font-normal text-red-300">{purchaseError}</p>
                </div>
              </div>
            )}

            {/* Asientos Seleccionados (Chips) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-300 flex items-center gap-1 font-sports uppercase tracking-wide">
                    <Users className={`w-3.5 h-3.5 ${isEncanto ? 'text-amber-400' : 'text-red-500'}`} />
                    Asientos Seleccionados ({selectedSeats.length})
                  </span>
                  {lockRemainingSeconds > 0 && selectedSeats.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-950/70 border border-amber-500/60 text-amber-300 text-[10px] font-bold font-mono animate-pulse">
                      <Clock className="w-3 h-3 text-amber-400" />
                      Reserva: {Math.floor(lockRemainingSeconds / 60)}:{(lockRemainingSeconds % 60).toString().padStart(2, '0')} min
                    </span>
                  )}
                </div>
                {selectedSeats.length > 0 && (
                  <button
                    onClick={handleClearSelectedSeats}
                    className="text-[11px] text-red-400 hover:text-red-300 font-bold cursor-pointer font-sports tracking-wider uppercase"
                  >
                    Limpiar selección
                  </button>
                )}
              </div>

              {selectedSeats.length === 0 ? (
                <div className="p-3 bg-[#0A0E17] rounded-xl text-center text-xs text-slate-400 border border-dashed border-slate-700">
                  Toca uno o varios asientos arriba para agregarlos a tu compra.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-[#0A0E17] rounded-xl border border-slate-700/80">
                  {selectedSeats.map((item, itemIdx) => (
                    <span
                      key={`selected_chip_${item.seatId}_${itemIdx}`}
                      className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg bg-[#141C2E] border border-slate-700 text-xs font-bold text-white shadow-xs font-sports"
                    >
                      <span>
                        Sec. {item.sectionNumber} • {item.rowLabel}#{item.seatNumber}
                      </span>
                      <span className="text-emerald-400 font-mono text-[11px]">
                        ${item.price}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSeat(item.seatId)}
                        className="w-4 h-4 rounded-full hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-red-400 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Método de Pago (Exclusivo Tarjeta en Línea) */}
            <div className="space-y-2 pt-2 border-t border-slate-700/70">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block font-sports">
                  Método de Pago
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 font-sports">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Pasarela SSL Segura
                </span>
              </div>

              <div className={`p-3 rounded-xl border flex items-center justify-between ${
                isEncanto
                  ? 'border-amber-500/50 bg-amber-950/30 text-amber-200'
                  : 'border-red-500/50 bg-red-950/30 text-red-200'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isEncanto ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-white font-sports">
                      Tarjeta en Línea
                    </p>
                    <p className="text-[10px] text-slate-400 font-sans">
                      Visa, Mastercard, Amex • Cobro directo Stripe
                    </p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  Activo
                </span>
              </div>
            </div>

            {/* Total y Botón Atómico */}
            <div className="pt-3 border-t border-slate-700/70 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block font-sports tracking-wider">
                    Total ({selectedSeats.length} {selectedSeats.length === 1 ? 'boleto' : 'boletos'})
                  </span>
                  <span className="text-xs text-slate-400">Impuestos y cargos incluidos</span>
                </div>
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-black text-emerald-400 font-scoreboard">
                    ${totalAmount} <span className="text-xs font-normal text-slate-400 font-sans">MXN</span>
                  </span>
                </div>
              </div>

              <button
                id="btn-confirm-seat-transaction"
                type="button"
                onClick={handleConfirmPurchase}
                disabled={purchasing || selectedSeats.length === 0 || isEventClosed}
                className={`w-full py-3.5 ${
                  isEncanto
                    ? 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black font-black shadow-amber-500/20'
                    : 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed font-black text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer font-sports uppercase tracking-wider`}
              >
                {isEventClosed ? (
                  <span>Venta Concluida (Evento Finalizado)</span>
                ) : purchasing ? (
                  'Verificando asientos en tiempo real...'
                ) : !user || !user.uid ? (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      Iniciar Sesión para Pagar ({selectedSeats.length}{' '}
                      {selectedSeats.length === 1 ? 'Boleto' : 'Boletos'} — ${totalAmount} MXN)
                    </span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>
                      Pagar con Tarjeta ({selectedSeats.length}{' '}
                      {selectedSeats.length === 1 ? 'Boleto' : 'Boletos'} — ${totalAmount} MXN)
                    </span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-center text-slate-400 flex items-center justify-center gap-1 font-sports">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Transacción atómica protegida • Asignación oficial de butacas
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Formulario de Pago con Tarjeta en Línea */}
      <CardPaymentModal
        isOpen={isCardModalOpen}
        onClose={() => setIsCardModalOpen(false)}
        amount={totalAmount}
        concept={`${event.name} — ${selectedSeats.length} boleto(s) (${selectedSeats
          .map((s) => `Sec. ${s.sectionNumber} Fila ${s.rowLabel} As.${s.seatNumber}`)
          .slice(0, 3)
          .join(', ')}${selectedSeats.length > 3 ? '...' : ''})`}
        customerName={user.displayName || user.email || 'Aficionado'}
        customerEmail={user.email || undefined}
        orderType="boletos"
        metadata={{
          eventId: event.id,
          venueId: event.venueId,
          matchTitle: event.name,
          seatsCount: String(selectedSeats.length),
        }}
        externalSessionUrl={externalStripeUrl}
        onSuccess={handleCardPaymentSuccess}
      />
    </div>
  );
};
