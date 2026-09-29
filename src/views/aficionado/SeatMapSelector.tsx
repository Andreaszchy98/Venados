import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UserProfile, VenueEvent, SeatSection, EventSeat, EventType, Ticket } from '../../types';
import { PurchaseSuccessModal } from '../../components/shared/PurchaseSuccessModal';
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
  getClientLockToken,
  isSeatLockedByOther,
  SEAT_LOCK_DURATION_MS,
  MAX_TICKETS_PER_PURCHASE,
  getZonePrice,
  MARISCAL_ZONES,
  MARISCAL_SECTION_ZONE_MAP,
  getMariscalSectionZone,
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
import { useTheme } from '../../context/ThemeContext';
import { createStripeCheckoutSession } from '../../lib/stripe';
import { CardPaymentModal } from '../../components/shared/CardPaymentModal';
import { DirectPaymentResult } from '../../lib/stripe';
import {
  buildTicketOrderHostEmail,
  sendHostOrderEmailAutomatically,
} from '../../lib/orderEmailService';
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
  onPurchaseSuccess?: (purchaseId: string, count: number) => void;
  onCancel?: () => void;
  onRequireAuth?: () => void;
  isPosMode?: boolean;
  posSelectedSeats?: SeatPurchaseItem[];
  onSelectionChangeForPos?: (seats: SeatPurchaseItem[]) => void;
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
  isPosMode = false,
  posSelectedSeats,
  onSelectionChangeForPos,
}) => {
  const { theme } = useTheme();

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

  // Cargar instantáneamente las secciones maestro de memoria para un render inicial sin pantalla de carga (< 5ms)
  const [sections, setSections] = useState<SeatSection[]>(() => {
    const initial = buildSectionsForVenue(event.venueId, event.type);
    return initial.map((d) => ({
      id: `${event.venueId}_sec_${d.sectionNumber.replace(/\s+/g, '_')}`,
      ...d,
    }));
  });
  const [eventSeats, setEventSeats] = useState<EventSeat[]>([]);
  const [loading, setLoading] = useState(false);
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
      return Array.from(uniqueMap.values()).slice(0, MAX_TICKETS_PER_PURCHASE);
    } catch {
      return [];
    }
  });

  // Referencia para rastrear la selección más reciente sin disparar efectos
  const selectedSeatsRef = useRef<SeatPurchaseItem[]>(selectedSeats);
  useEffect(() => {
    selectedSeatsRef.current = selectedSeats;
    // Si por alguna razón la selección excede el límite máximo (por ejemplo estado previo en sesión), truncar inmediatamente a 5
    if (selectedSeats.length > MAX_TICKETS_PER_PURCHASE) {
      const trimmed = selectedSeats.slice(0, MAX_TICKETS_PER_PURCHASE);
      const toRelease = selectedSeats.slice(MAX_TICKETS_PER_PURCHASE);
      const userId = user?.uid || 'guest';
      const clientToken = getClientLockToken();
      toRelease.forEach((s) => {
        releaseSeatLockTransaction(s.seatId, userId, clientToken).catch(() => {});
      });
      setSelectedSeats(trimmed);
    }
  }, [selectedSeats, user?.uid]);

  // Referencia para evitar bucles infinitos de notificación
  const lastNotifiedSeatsStr = useRef<string>('');

  // Notificar cambios de selección al Punto de Venta POS cuando se usa en modo Taquillera
  useEffect(() => {
    if (isPosMode && onSelectionChangeForPos) {
      const currentStr = selectedSeats.map((s) => s.seatId).sort().join(',');
      if (currentStr !== lastNotifiedSeatsStr.current) {
        lastNotifiedSeatsStr.current = currentStr;
        onSelectionChangeForPos(selectedSeats);
      }
    }
  }, [selectedSeats, isPosMode, onSelectionChangeForPos]);

  // Sincronizar selección interna con la del Punto de Venta POS externa si cambia fuera (ej: limpiar o quitar asiento)
  useEffect(() => {
    if (isPosMode && posSelectedSeats) {
      const currentInternal = selectedSeatsRef.current;
      const internalIds = currentInternal.map((s) => s.seatId).sort().join(',');
      const externalIds = posSelectedSeats.map((s) => s.seatId).sort().join(',');
      if (internalIds !== externalIds) {
        // Identificar asientos eliminados externamente para liberar sus bloqueos en Firestore
        const removedSeats = currentInternal.filter(
          (s) => !posSelectedSeats.some((ext) => ext.seatId === s.seatId)
        );
        const userId = user?.uid || 'guest';
        const clientToken = getClientLockToken();
        removedSeats.forEach((s) => {
          releaseSeatLockTransaction(s.seatId, userId, clientToken).catch(() => {});
        });

        lastNotifiedSeatsStr.current = externalIds;
        setSelectedSeats(posSelectedSeats);
        if (posSelectedSeats.length === 0) {
          setLockExpiresAt(null);
          try {
            sessionStorage.removeItem(`vxp_seats_${event.id}`);
            sessionStorage.removeItem(`vxp_seats_lock_${event.id}`);
          } catch {}
        }
      }
    }
  }, [posSelectedSeats, isPosMode, event.id, user?.uid]);

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
        const clientToken = getClientLockToken();
        selectedSeats.forEach((s) => {
          releaseSeatLockTransaction(s.seatId, userId, clientToken).catch(() => {});
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

  // Al autenticarse el aficionado, transferir de forma transparente los bloqueos de su carrito a su UID
  useEffect(() => {
    if (user?.uid && selectedSeats.length > 0) {
      const clientToken = getClientLockToken();
      selectedSeats.forEach((s) => {
        lockSeatSelectionTransaction({
          eventId: event.id,
          seatId: s.seatId,
          userId: user.uid,
          sectionNumber: s.sectionNumber,
          rowLabel: s.rowLabel,
          seatNumber: s.seatNumber,
          zoneName: s.zoneName,
          sectionId: s.sectionId,
          clientLockToken: clientToken,
        }).catch(() => {});
      });
    }
  }, [user?.uid, event.id]);

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

  // Popup de confirmación oficial de boletos
  const [completedTickets, setCompletedTickets] = useState<Ticket[] | null>(null);
  const [completedPurchaseId, setCompletedPurchaseId] = useState<string | null>(null);
  const [completedTicketsCount, setCompletedTicketsCount] = useState<number>(0);

  // Helper para normalizar identificadores de sección (elimina guiones, espacios y mayúsculas)
  const normalizeSec = (val?: string | null) => (val || '').trim().toUpperCase().replace(/[\s_-]+/g, '');

  // Cargar y escuchar secciones del estadio en segundo plano
  useEffect(() => {
    const unsubscribeSections = subscribeSeatSections(
      event.venueId,
      (fetchedSections) => {
        if (fetchedSections && fetchedSections.length > 0) {
          setSections(fetchedSections);
        }
      },
      (err) => {
        console.warn('Error en secciones:', err);
      }
    );

    return () => unsubscribeSections();
  }, [event.venueId]);

  // Cargar y escuchar asientos del evento en tiempo real en segundo plano
  useEffect(() => {
    const unsubscribeSeats = subscribeEventSeats(
      event.id,
      (seats) => {
        setEventSeats(seats);
        // Filtrar automáticamente de selectedSeats cualquier butaca que ya esté vendida
        const soldIds = new Set(seats.filter((s) => s.status === 'vendido').map((s) => s.id));
        setSelectedSeats((prev) => prev.filter((s) => !soldIds.has(s.seatId)));
      },
      (err) => {
        console.warn('Aviso escuchando asientos de evento:', err);
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

  // Mapa de secciones totalmente agotadas
  const soldOutSectionsSet = useMemo(() => {
    const set = new Set<string>();
    sections.forEach((sec) => {
      const secKey = normalizeSec(sec.sectionNumber);
      const seats = seatsBySection.get(secKey) || [];
      const totalSeats = sec.totalSeats || (sec.rows || 3) * (sec.seatsPerRow || 10);
      const soldCount = seats.filter((s) => s.status === 'vendido' || s.status === 'reservado').length;
      if (seats.length > 0 && soldCount >= totalSeats) {
        set.add(sec.sectionNumber);
        set.add(secKey);
      }
    });
    return set;
  }, [sections, seatsBySection]);

  // Mapa de zonas totalmente agotadas
  const soldOutZonesSet = useMemo(() => {
    const set = new Set<string>();
    const zoneSecsMap = new Map<string, SeatSection[]>();
    sections.forEach((sec) => {
      if (!zoneSecsMap.has(sec.zoneName)) {
        zoneSecsMap.set(sec.zoneName, []);
      }
      zoneSecsMap.get(sec.zoneName)!.push(sec);
    });

    zoneSecsMap.forEach((zoneSecs, zoneName) => {
      const allSoldOut = zoneSecs.length > 0 && zoneSecs.every((sec) => {
        const secKey = normalizeSec(sec.sectionNumber);
        const seats = seatsBySection.get(secKey) || [];
        const totalSeats = sec.totalSeats || (sec.rows || 3) * (sec.seatsPerRow || 10);
        const soldCount = seats.filter((s) => s.status === 'vendido' || s.status === 'reservado').length;
        return seats.length > 0 && soldCount >= totalSeats;
      });
      if (allSoldOut) {
        set.add(zoneName);
      }
    });
    return set;
  }, [sections, seatsBySection]);

  // Sección actualmente seleccionada: resuelve dinámicamente según la sección seleccionada por el usuario
  const currentSection = useMemo<SeatSection | null>(() => {
    const targetNumber = activeSectionNumber || (isEncanto ? 'PC-1' : '104');
    const normTarget = normalizeSec(targetNumber);

    // 1. Coincidencia exacta o normalizada en las secciones obtenidas de Firestore
    let found = sections.find((s) => s.sectionNumber === targetNumber);
    if (!found) {
      found = sections.find((s) => normalizeSec(s.sectionNumber) === normTarget);
    }
    if (found) {
      if (!isEncanto) {
        const canonicalZone = getMariscalSectionZone(found.sectionNumber) || getMariscalSectionZone(targetNumber);
        if (canonicalZone) {
          return { ...found, zoneName: canonicalZone };
        }
      }
      return found;
    }

    // 2. Coincidencia en catálogo maestro de la sede
    const masterSections = buildSectionsForVenue(event.venueId, event.type);
    const masterFound = masterSections.find((s) => normalizeSec(s.sectionNumber) === normTarget);
    if (masterFound) {
      const canonicalZone = !isEncanto
        ? getMariscalSectionZone(masterFound.sectionNumber) || masterFound.zoneName
        : masterFound.zoneName;
      return {
        id: `${event.venueId}_sec_${masterFound.sectionNumber.replace(/\s+/g, '_')}`,
        ...masterFound,
        zoneName: canonicalZone,
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

    // 4. Si no se encuentra en las anteriores, preservar estrictamente el targetNumber y zona oficial de Teodoro Mariscal
    const fallbackZone = !isEncanto
      ? getMariscalSectionZone(targetNumber) || sections[0]?.zoneName || 'Plus'
      : sections[0]?.zoneName || 'General';

    return {
      id: `${event.venueId}_sec_${targetNumber.replace(/\s+/g, '_')}`,
      venueId: event.venueId,
      sectionNumber: targetNumber,
      zoneName: fallbackZone,
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

  // Alternar selección de un asiento mediante actualización optimista inmediata (0 ms) y bloqueo en segundo plano
  const handleToggleSeat = (seat: EventSeat, section: SeatSection) => {
    if (isEventClosed) {
      setPurchaseError('La venta de boletos ha finalizado o está cerrada para este evento.');
      return;
    }

    if (seat.status === 'vendido') return;

    // Prevenir clics duplicados mientras se sincroniza
    if (pendingSeatLocks.current.has(seat.id)) return;

    const userId = user?.uid || 'guest';
    const clientToken = getClientLockToken();
    setPurchaseError(null);
    const isAlreadySelected = selectedSeatsRef.current.some((s) => s.seatId === seat.id);

    // Límite estricto de 5 boletos por compra
    if (!isAlreadySelected && selectedSeatsRef.current.length >= MAX_TICKETS_PER_PURCHASE) {
      setPurchaseError(
        `¡Límite alcanzado! Máximo ${MAX_TICKETS_PER_PURCHASE} boletos por aficionado en cada compra. Si deseas seleccionar este asiento, deselecciona uno previamente apartado.`
      );
      return;
    }

    if (isAlreadySelected) {
      // 1. Deselección visual instantánea en la interfaz
      setSelectedSeats((prev) => {
        const remaining = prev.filter((s) => s.seatId !== seat.id);
        if (remaining.length === 0) {
          setLockExpiresAt(null);
        }
        return remaining;
      });
      // 2. Liberar bloqueo atómico en Firestore en segundo plano
      releaseSeatLockTransaction(seat.id, userId, clientToken).catch(() => {});
    } else {
      // 1. Selección visual INMEDIATA en la interfaz (0ms de retraso percibido)
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
        if (prev.some((s) => s.seatId === newItem.seatId)) return prev;
        if (prev.length >= MAX_TICKETS_PER_PURCHASE) return prev;
        return [...prev, newItem];
      });

      // Si no había tiempo de expiración activo, establecer el temporizador visual de 8 minutos
      if (!lockExpiresAt) {
        setLockExpiresAt(new Date(Date.now() + 8 * 60 * 1000).toISOString());
      }

      // 2. Registrar el bloqueo atómico en Firestore en segundo plano
      pendingSeatLocks.current.add(seat.id);
      lockSeatSelectionTransaction({
        eventId: event.id,
        seatId: seat.id,
        userId,
        sectionNumber: section.sectionNumber,
        rowLabel: seat.rowLabel,
        seatNumber: seat.seatNumber,
        zoneName: section.zoneName,
        sectionId: section.id,
        clientLockToken: clientToken,
      })
        .then((lockRes) => {
          // Si el usuario no lo deseleccionó mientras se procesaba, actualizar tiempo exacto
          if (selectedSeatsRef.current.some((s) => s.seatId === seat.id)) {
            setLockExpiresAt(lockRes.lockedUntil);
          } else {
            // Si el usuario lo deseleccionó antes de que respondiera la red, liberarlo
            releaseSeatLockTransaction(seat.id, userId, clientToken).catch(() => {});
          }
        })
        .catch((err: any) => {
          console.warn('Conflicto al apartar asiento:', err);
          // Revertir la selección optimista si el asiento fue tomado o hubo conflicto
          setSelectedSeats((prev) => prev.filter((s) => s.seatId !== seat.id));
          const cleanMsg =
            err.message
              ?.replace('SEAT_LOCKED_BY_OTHER: ', '')
              ?.replace('SEAT_ALREADY_SOLD: ', '') ||
            'Este asiento no está disponible en este momento.';
          setPurchaseError(cleanMsg);
        })
        .finally(() => {
          pendingSeatLocks.current.delete(seat.id);
        });
    }
  };

  // Quitar un asiento de la lista de compra y liberar el bloqueo
  const handleRemoveSeat = (seatId: string) => {
    const userId = user?.uid || 'guest';
    const clientToken = getClientLockToken();
    releaseSeatLockTransaction(seatId, userId, clientToken).catch(() => {});
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
    const clientToken = getClientLockToken();
    selectedSeats.forEach((s) => {
      releaseSeatLockTransaction(s.seatId, userId, clientToken).catch(() => {});
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
    setPurchaseError(null);

    // Conservar snapshot inmutable de los asientos a comprar
    const seatsToPurchase = [...selectedSeats];
    if (seatsToPurchase.length === 0) {
      setIsCardModalOpen(false);
      setPurchasing(false);
      return;
    }

    const stadiumZones = getStadiumZones(event.venueId, stadiumName, event.type);
    const isEncanto = isEncantoVenue(event.venueId, stadiumName, event.type);
    const qrPrefix = isEncanto ? 'DOR-2026-TKT-' : 'VND-2026-TKT-';
    const clientToken = getClientLockToken();
    const purchaseId = `PURCHASE-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Construir los boletos oficiales de forma inmediata
    const generatedTickets: Ticket[] = seatsToPurchase.map((seat, idx) => ({
      id: `tkt_${Date.now()}_${idx}_${seat.seatId}`,
      userId: user?.uid || 'guest',
      eventId: event.id,
      venueId: event.venueId,
      purchaseId,
      seatId: seat.seatId,
      matchTitle: event.name,
      opponent: event.opponent || '',
      matchDate: event.date,
      matchTime: event.time || '20:00 hrs',
      stadium: stadiumName,
      section: `${seat.zoneName} - Sec. ${seat.sectionNumber}`,
      row: `Fila ${seat.rowLabel}`,
      seat: `Asiento ${seat.seatNumber}`,
      price: seat.price,
      status: 'activo',
      qrId: `${qrPrefix}${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      gate: stadiumZones[seat.zoneName]?.gate || event.gate || 'Puertas Generales',
      createdAt: new Date().toISOString(),
      paymentStatus: 'paid',
      paymentMethod: `Tarjeta (${paymentResult.cardBrand || 'Visa'} •••• ${paymentResult.cardLast4 || '4242'})`,
      customerName: user?.displayName || user?.email || 'Aficionado',
      customerEmail: user?.email || undefined,
    }));

    try {
      sessionStorage.removeItem(`vxp_seats_${event.id}`);
    } catch {}

    // Limpiar selección de butacas de inmediato
    setSelectedSeats([]);

    // ¡DESPLEGAR DE INMEDIATO EL MODAL DE COMPRA EXITOSA!
    // Como la tarjeta ya fue cobrada con éxito en Stripe/Pasarela, mostramos el modal con los QRs al instante (0ms de retraso).
    setCompletedTickets(generatedTickets);
    setCompletedPurchaseId(purchaseId);
    setCompletedTicketsCount(generatedTickets.length);
    setPurchasing(false);
    setIsCardModalOpen(false);

    // Registrar en segundo plano la transacción en Firestore
    purchaseSeatsTransaction({
      userId: user?.uid || 'guest',
      customerName: user?.displayName || user?.email || 'Aficionado',
      customerEmail: user?.email || undefined,
      event,
      stadiumName,
      selectedSeats: seatsToPurchase,
      paymentMethod: `Tarjeta (${paymentResult.cardBrand || 'Visa'} •••• ${paymentResult.cardLast4 || '4242'})`,
      stripePaymentIntentId: paymentResult.paymentIntentId,
      clientLockToken: clientToken,
    })
      .then((result) => {
        if (result.tickets && result.tickets.length > 0) {
          setCompletedTickets(result.tickets);
          try {
            const emailPayload = buildTicketOrderHostEmail(result.tickets, stadiumName || 'Estadio Teodoro Mariscal');
            sendHostOrderEmailAutomatically(emailPayload).catch(() => {});
          } catch (e) {
            console.warn('Envío automático de correo de boletos al anfitrión en background:', e);
          }
        }
      })
      .catch((err) => {
        console.warn('Aviso sincronizando transacción en Firestore en segundo plano:', err);
      });
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

  const activeZoneMeta = useMemo(() => {
    if (!currentSection) return null;
    const cleanZone = currentSection.zoneName.trim().toLowerCase();
    const zonesToSearch = isEncanto ? stadiumZones : MARISCAL_ZONES;
    const foundKey = Object.keys(zonesToSearch).find(
      (k) => k.trim().toLowerCase() === cleanZone
    );
    if (foundKey) return zonesToSearch[foundKey];

    if (!isEncanto) {
      const canonicalZone = getMariscalSectionZone(currentSection.sectionNumber);
      if (canonicalZone && MARISCAL_ZONES[canonicalZone]) {
        return MARISCAL_ZONES[canonicalZone];
      }
    }
    return null;
  }, [currentSection, isEncanto, stadiumZones]);

  return (
    <div className="space-y-4 pb-24">
      {/* 1. Header Estructurado Limpio con Fecha, Hora, Lugar y Asientos Disponibles */}
      <div className={`border rounded-2xl p-4 shadow-xl space-y-3 transition-colors ${
        theme === 'light'
          ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
          : 'bg-[#0E1626] border-slate-800 text-white shadow-xl'
      }`}>
        {/* Fila 1: Botón Volver & Badge de Disponibilidad */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onCancel}
            className={`inline-flex items-center gap-1.5 text-xs font-sports font-bold tracking-wider uppercase transition-colors cursor-pointer ${
              theme === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowLeft className="w-4 h-4" /> Volver a eventos
          </button>

          <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-500/50 font-sports flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {globalStats.available.toLocaleString('es-MX')} Asientos Disponibles
          </span>
        </div>

        {/* Fila 2: Título del Partido completo sin recortes */}
        <h2 className={`text-sm sm:text-lg font-black font-sports uppercase tracking-wide leading-snug ${
          theme === 'light' ? 'text-slate-900' : 'text-white'
        }`}>
          {event.name}
        </h2>

        {/* Fila 3: Metadata - Fecha, Hora y Lugar */}
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs pt-2 border-t font-sans ${
          theme === 'light' ? 'border-slate-200 text-slate-700' : 'border-slate-800/80 text-slate-300'
        }`}>
          <div className="flex items-center gap-1.5">
            <Calendar className={`w-3.5 h-3.5 ${isEncanto ? 'text-amber-500' : 'text-red-500'}`} />
            <span className={`font-semibold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{event.date}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className={`w-3.5 h-3.5 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`} />
            <span className={theme === 'light' ? 'text-slate-700' : 'text-slate-300'}>{event.time || '20:00 hrs'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-amber-500" />
            <span className={`font-bold ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>{stadiumName}</span>
          </div>
        </div>

        {Boolean(event.synopsis || event.description) && (
          <p className={`text-xs leading-relaxed pt-2 border-t font-sans ${
            theme === 'light' ? 'border-slate-100 text-slate-600' : 'border-slate-800 text-slate-300'
          }`}>
            {event.synopsis || event.description}
          </p>
        )}
      </div>

      {/* Banner si el evento ya finalizó o la venta está cerrada */}
      {isEventClosed && (
        <div className="bg-red-950/80 border border-red-500/70 rounded-2xl p-3 flex items-center gap-3 text-red-200 shadow-xl">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="font-bold text-xs font-sports uppercase tracking-wider text-red-100">
            Venta de boletos concluida / Juego o evento finalizado (Modo consulta)
          </p>
        </div>
      )}

      {/* 2. Selección de Zona Minimalista-Dinámica (Grid Adaptativo sin scroll horizontal) */}
      <div className={`border rounded-2xl p-3.5 shadow-lg space-y-2.5 transition-colors ${
        theme === 'light'
          ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
          : 'bg-[#0E1626] border-slate-800/90 text-white shadow-lg'
      }`}>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 font-sports ${
            theme === 'light' ? 'text-slate-800' : 'text-slate-300'
          }`}>
            <Layers className={`w-4 h-4 ${isEncanto ? 'text-amber-500' : 'text-red-500'}`} />
            Filtrar Zona del Estadio
          </span>

          {activeZoneFilter !== 'Todas' && (
            <button
              onClick={() => setActiveZoneFilter('Todas')}
              className="text-[11px] font-bold text-red-500 hover:text-red-600 font-sports uppercase tracking-wider transition-colors cursor-pointer"
            >
              Ver Todas ({sections.length})
            </button>
          )}
        </div>

        {/* Grid Adaptativo Minimalista de Zonas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 font-sports">
          <button
            onClick={() => setActiveZoneFilter('Todas')}
            className={`p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer border ${
              activeZoneFilter === 'Todas'
                ? isEncanto
                  ? 'bg-amber-500 text-black border-amber-400 font-black shadow-md'
                  : 'bg-red-600 text-white border-red-500 font-black shadow-md'
                : theme === 'light'
                ? 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'
                : 'bg-[#141E34] text-slate-300 border-slate-700/60 hover:border-slate-600'
            }`}
          >
            <span>Todas</span>
            <span className="text-[10px] opacity-80 font-mono">({sections.length})</span>
          </button>

          {availableZones.map((zName) => {
            const zMeta = stadiumZones[zName];
            const price = getZonePrice(zName, event);
            const isFilterActive = activeZoneFilter === zName;
            const isZoneSoldOut = soldOutZonesSet.has(zName);

            return (
              <button
                key={zName}
                onClick={() => setActiveZoneFilter(zName)}
                className={`p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-1.5 cursor-pointer border ${
                  isZoneSoldOut
                    ? theme === 'light'
                      ? 'border-slate-200 bg-slate-100 text-slate-400 opacity-60'
                      : 'border-slate-800/80 bg-[#101827]/60 text-slate-500 opacity-60'
                    : isFilterActive
                    ? 'ring-2 ring-red-500 text-white bg-red-600 border-red-500 shadow-md scale-[1.02]'
                    : theme === 'light'
                    ? 'border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200'
                    : 'border-slate-800 bg-[#141E34] text-slate-300 hover:bg-[#1A2846] hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ${isZoneSoldOut ? 'bg-slate-400' : ''}`}
                    style={isZoneSoldOut ? undefined : { backgroundColor: zMeta.colorHex }}
                  />
                  <span className={`truncate ${isZoneSoldOut ? 'line-through opacity-70' : ''}`}>{zName}</span>
                </div>
                <span className={`text-[10px] font-mono font-black shrink-0 ${
                  isZoneSoldOut
                    ? 'text-red-500 font-sans uppercase'
                    : theme === 'light'
                    ? 'text-emerald-700 font-bold'
                    : 'text-emerald-400'
                }`}>
                  {isZoneSoldOut ? 'Agotado' : `$${price}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Panel Principal: Mapa Interactivo SVG + Cuadrícula de Asientos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LADO IZQUIERDO: Mapa del Estadio (Herradura / Diamante de Béisbol o Cancha Fútbol Encanto) */}
        <div className={`lg:col-span-7 p-4 sm:p-5 rounded-3xl border shadow-xl space-y-4 flex flex-col transition-colors ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
            : 'bg-[#0F1626] border-slate-700/80 text-white shadow-xl'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-sm font-black flex items-center gap-2 font-sports tracking-wide uppercase ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>
                <Maximize2 className={`w-4 h-4 ${isEncanto ? 'text-amber-500' : 'text-red-500'}`} />
                {isEncanto ? `Distribución Oficial: ${stadiumName}` : 'Mapa Físico del Estadio'}
              </h3>
              <p className={`text-[11px] ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
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

          {/* RENDERIZADO DEL MAPA CON DESHABILITACIÓN DE SECCIONES AGOTADAS */}
          {isEncanto ? (
            <EncantoStadiumMap
              sections={sections}
              activeSectionNumber={activeSectionNumber}
              activeZoneFilter={activeZoneFilter === 'Todas' ? null : activeZoneFilter}
              onSelectSection={handleSelectSection}
              event={event}
              soldOutSectionsSet={soldOutSectionsSet}
            />
          ) : (
            <TeodoroMariscalStadiumMap
              sections={sections}
              activeSectionNumber={activeSectionNumber}
              activeZoneFilter={activeZoneFilter === 'Todas' ? null : activeZoneFilter}
              onSelectSection={handleSelectSection}
              event={event}
              soldOutSectionsSet={soldOutSectionsSet}
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
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs border border-white/20"
                  style={{
                    backgroundColor:
                      activeZoneMeta?.colorHex ||
                      activeZoneMeta?.fillColor ||
                      MARISCAL_ZONES[currentSection.zoneName]?.colorHex ||
                      '#FA8E5C',
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
          className={`lg:col-span-5 p-5 rounded-3xl border shadow-xl flex flex-col justify-start space-y-5 scroll-mt-6 transition-colors ${
            theme === 'light'
              ? 'bg-white border-slate-200 text-slate-900 shadow-sm'
              : 'bg-[#0F1626] border-slate-700/80 text-white shadow-xl'
          }`}
        >
          {currentSection ? (
            <div className="space-y-4">
              {/* Header de la sección activa */}
              <div className={`flex items-start justify-between gap-3 pb-3 border-b ${
                theme === 'light' ? 'border-slate-200' : 'border-slate-700/70'
              }`}>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="w-4 h-4 rounded-full shrink-0 shadow-sm border border-black/20 ring-2 ring-white/10"
                      style={{
                        backgroundColor:
                          activeZoneMeta?.colorHex ||
                          activeZoneMeta?.fillColor ||
                          MARISCAL_ZONES[currentSection.zoneName]?.colorHex ||
                          '#FA8E5C',
                      }}
                    ></span>
                    <h3 className={`text-base font-black font-sports tracking-wide ${
                      theme === 'light' ? 'text-slate-900' : 'text-white'
                    }`}>
                      {isEncanto
                        ? `Sección ${currentSection.sectionNumber}`
                        : `Sección #${currentSection.sectionNumber} • ${currentSection.zoneName}`}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${
                      activeZoneMeta?.badgeBg || 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                    }`}>
                      {currentSection.zoneName}
                    </span>
                  </div>
                  <p className={`text-xs mt-0.5 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                    {activeZoneMeta?.description ||
                      (isEncanto
                        ? 'Excelente visibilidad del terreno de juego'
                        : 'Excelente visibilidad del diamante')}
                  </p>
                  {activeZoneMeta?.gate && (
                    <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-md bg-amber-950/60 text-[10px] font-bold text-amber-300 border border-amber-500/50">
                      <DoorOpen className="w-3.5 h-3.5" /> Acceso: {activeZoneMeta.gate}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className={`text-[10px] font-bold uppercase block font-sports tracking-wider ${
                    theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                  }`}>Precio</span>
                  <span className={`text-base sm:text-lg font-black font-scoreboard ${
                    theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'
                  }`}>
                    ${getZonePrice(currentSection.zoneName, event)}{' '}
                    <span className={`text-[10px] font-normal font-sans ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>MXN</span>
                  </span>
                </div>
              </div>

              {/* Notificación de límite de 5 boletos */}
              <div className={`flex items-center justify-between text-xs px-3 py-2 rounded-xl border ${
                selectedSeats.length >= MAX_TICKETS_PER_PURCHASE
                  ? 'bg-amber-950/40 border-amber-500/50 text-amber-300'
                  : theme === 'light'
                  ? 'bg-slate-100 border-slate-200 text-slate-700'
                  : 'bg-[#0A0E17] border-slate-700 text-slate-300'
              }`}>
                <div className="flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Disponibilidad justa: <strong>Máximo {MAX_TICKETS_PER_PURCHASE} boletos</strong> por compra
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border ${
                  selectedSeats.length >= MAX_TICKETS_PER_PURCHASE
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}>
                  {selectedSeats.length} / {MAX_TICKETS_PER_PURCHASE}
                </span>
              </div>

              {/* Indicador visual hacia el terreno de juego */}
              <div className={`w-full py-1.5 px-3 rounded-xl text-center text-[10px] font-black uppercase tracking-widest border font-sports ${
                theme === 'light' ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-[#0A0E17] border-slate-700/70 text-slate-400'
              }`}>
                ▲ FRENTE / TERRENO DE JUEGO ▲
              </div>

              {/* Leyenda de estado de butaca */}
              <div className={`flex flex-wrap items-center justify-center gap-3.5 text-[11px] font-sports ${
                theme === 'light' ? 'text-slate-700' : 'text-slate-300'
              }`}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-4 h-4 rounded-md border-2 border-emerald-500 ${theme === 'light' ? 'bg-emerald-50' : 'bg-[#141C2E]'}`}></div>
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
                  <span className={`font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Tu Selección</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-md bg-amber-950/70 border border-amber-500/80 text-amber-300 flex items-center justify-center text-[9px] font-mono">
                    ⏳
                  </div>
                  <span className={theme === 'light' ? 'text-amber-700 font-bold' : 'text-amber-300'}>Apartado (8 min)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-4 h-4 rounded-md border text-[10px] flex items-center justify-center ${
                    theme === 'light' ? 'bg-slate-200 border-slate-300 text-slate-500' : 'bg-slate-800 border-slate-700 text-slate-500'
                  }`}>
                    ✕
                  </div>
                  <span className={theme === 'light' ? 'text-slate-500' : 'text-slate-500'}>Vendido</span>
                </div>
              </div>

              {/* Cuadrícula de Asientos por Fila */}
              <div className={`space-y-3 p-4 rounded-2xl border ${
                theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-[#0A0E17] border-slate-700/80'
              }`}>
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
                      <span className={`w-6 h-6 rounded-lg font-mono font-bold text-[11px] flex items-center justify-center shrink-0 border ${
                        theme === 'light'
                          ? 'bg-slate-200 text-slate-800 border-slate-300'
                          : 'bg-slate-800 text-amber-400 border-slate-700'
                      }`}>
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
                          const isLimitReached = !isSelected && selectedSeats.length >= MAX_TICKETS_PER_PURCHASE;
                          const isSold =
                            seat.status === 'vendido' &&
                            normalizeSec(seat.sectionNumber) === normalizeSec(currentSection.sectionNumber);
                          const now = Date.now();
                          const clientToken = getClientLockToken();
                          const isLockedByOther =
                            !isSelected &&
                            isSeatLockedByOther(seat, user?.uid, clientToken, now) &&
                            normalizeSec(seat.sectionNumber) === normalizeSec(currentSection.sectionNumber);

                          return (
                            <button
                              key={`seat_btn_${currentSection.sectionNumber}_${rowLabel}_${seat.seatNumber}_${seat.id || sIdx}`}
                              type="button"
                              onClick={() => handleToggleSeat(seat, currentSection)}
                              disabled={isSold || isLockedByOther || isEventClosed || isLimitReached}
                              title={
                                isEventClosed
                                  ? 'Venta de boletos concluida'
                                  : isSold
                                  ? `Fila ${seat.rowLabel} Asiento ${seat.seatNumber} - Vendido`
                                  : isLockedByOther
                                  ? `Fila ${seat.rowLabel} Asiento ${seat.seatNumber} - Apartado por otro usuario (8 min)`
                                  : isSelected
                                  ? `Fila ${seat.rowLabel} Asiento ${seat.seatNumber} - Tu selección`
                                  : isLimitReached
                                  ? `Límite máximo de ${MAX_TICKETS_PER_PURCHASE} boletos alcanzado. Deselecciona uno si deseas cambiarlo.`
                                  : `Fila ${seat.rowLabel} Asiento ${seat.seatNumber} - Disponible`
                              }
                              className={`aspect-square rounded-lg text-[10px] font-extrabold transition-all flex items-center justify-center cursor-pointer ${
                                isEventClosed
                                  ? 'bg-slate-200 border border-slate-300 text-slate-400 cursor-not-allowed opacity-60'
                                  : isSold
                                  ? 'bg-slate-300 dark:bg-slate-900 border border-slate-400 dark:border-slate-800 text-slate-500 cursor-not-allowed line-through'
                                  : isLockedByOther
                                  ? 'bg-amber-100 dark:bg-amber-950/70 border border-amber-400 text-amber-800 dark:text-amber-300 cursor-not-allowed shadow-inner font-mono'
                                  : isSelected
                                  ? isEncanto
                                    ? 'bg-amber-500 text-black font-black shadow-md scale-105 ring-2 ring-amber-400'
                                    : 'bg-red-600 text-white shadow-md scale-105 ring-2 ring-red-400'
                                  : isLimitReached
                                  ? theme === 'light'
                                    ? 'bg-slate-100 border border-slate-300 text-slate-400 cursor-not-allowed opacity-40'
                                    : 'bg-[#0E1524] border border-slate-800 text-slate-600 cursor-not-allowed opacity-40'
                                  : theme === 'light'
                                  ? 'bg-white hover:bg-emerald-100 text-slate-900 border-2 border-emerald-600 hover:scale-105 font-bold shadow-xs'
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

              <div className={`flex items-center justify-between text-xs px-1 font-sports ${
                theme === 'light' ? 'text-slate-600' : 'text-slate-400'
              }`}>
                <span>
                  Disponibles en Sec. {currentSection.sectionNumber}:{' '}
                  <strong className={theme === 'light' ? 'text-emerald-700 font-bold' : 'text-emerald-400'}>
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
                <span className={theme === 'light' ? 'text-slate-500' : 'text-slate-500'}>
                  {isEncanto
                    ? `${currentSection.rows || 3} filas × ${currentSection.seatsPerRow || 10} asientos`
                    : 'Filas A a la C (10 asientos c/u)'}
                </span>
              </div>
            </div>
          ) : (
            <div className={`p-8 text-center ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
              Selecciona una sección en el mapa para cargar su cuadrícula.
            </div>
          )}

          {/* 4. Panel de Resumen de Compra y Botón de Transacción Atómica */}
          <div className={`pt-4 border-t space-y-4 mt-auto ${theme === 'light' ? 'border-slate-200' : 'border-slate-700/70'}`}>
            {/* Mensaje de error de transacción / Colisión de asientos */}
            {purchaseError && (
              <div className="p-3.5 bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-500/50 rounded-2xl flex items-start gap-2.5 text-xs text-red-800 dark:text-red-200 font-semibold animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">No se pudo completar la compra:</p>
                  <p className="font-normal text-red-700 dark:text-red-300">{purchaseError}</p>
                </div>
              </div>
            )}

            {/* Asientos Seleccionados (Chips) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-bold flex items-center gap-1 font-sports uppercase tracking-wide ${
                    theme === 'light' ? 'text-slate-800' : 'text-slate-300'
                  }`}>
                    <Users className={`w-3.5 h-3.5 ${isEncanto ? 'text-amber-500' : 'text-red-500'}`} />
                    Asientos ({selectedSeats.length}/{MAX_TICKETS_PER_PURCHASE})
                  </span>
                  {selectedSeats.length >= MAX_TICKETS_PER_PURCHASE ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase font-sports bg-amber-500/20 text-amber-400 border border-amber-500/40">
                      Límite 5/5
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400">
                      (Máx. {MAX_TICKETS_PER_PURCHASE})
                    </span>
                  )}
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
                <div className={`p-3 rounded-xl text-center text-xs border border-dashed ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-300 text-slate-500'
                    : 'bg-[#0A0E17] border-slate-700 text-slate-400'
                }`}>
                  Toca uno o varios asientos arriba para agregarlos a tu compra.
                </div>
              ) : (
                <div className={`flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 rounded-xl border ${
                  theme === 'light'
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-[#0A0E17] border-slate-700/80'
                }`}>
                  {selectedSeats.map((item, itemIdx) => (
                    <span
                      key={`selected_chip_${item.seatId}_${itemIdx}`}
                      className={`inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg text-xs font-bold shadow-xs font-sports border ${
                        theme === 'light'
                          ? 'bg-white border-slate-300 text-slate-900'
                          : 'bg-[#141C2E] border-slate-700 text-white'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/20"
                        style={{
                          backgroundColor:
                            (isEncanto ? stadiumZones[item.zoneName] : MARISCAL_ZONES[item.zoneName])?.colorHex ||
                            '#FA8E5C',
                        }}
                      />
                      <span>
                        Sec. {item.sectionNumber} ({item.zoneName}) • {item.rowLabel}#{item.seatNumber}
                      </span>
                      <span className={theme === 'light' ? 'text-emerald-700 font-mono text-[11px]' : 'text-emerald-400 font-mono text-[11px]'}>
                        ${item.price}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSeat(item.seatId)}
                        className="w-4 h-4 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-red-500 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Modo POS o Método de Pago Online */}
            {isPosMode ? (
              <div className="p-3 bg-red-950/40 border border-red-500/50 rounded-xl text-center space-y-1">
                <span className="text-xs font-black text-white font-sports uppercase tracking-wider block">
                  🎟️ Módulo POS Ventanilla Activo
                </span>
                <p className="text-[11px] text-slate-300">
                  {selectedSeats.length > 0
                    ? `${selectedSeats.length} asiento(s) seleccionado(s). Procesa el pago y la impresión térmica en el panel derecho del POS.`
                    : 'Toca una o varias butacas arriba para agregarlas a la comanda de la taquilla.'}
                </p>
              </div>
            ) : (
              <>
                {/* Método de Pago (Exclusivo Tarjeta en Línea) */}
                <div className={`space-y-2 pt-2 border-t ${theme === 'light' ? 'border-slate-200' : 'border-slate-700/70'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-black uppercase tracking-wider block font-sports ${
                      theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      Método de Pago
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold font-sports ${
                      theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                    }`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Pasarela SSL Segura
                    </span>
                  </div>

                  <div className={`p-3 rounded-xl border flex items-center justify-between ${
                    isEncanto
                      ? theme === 'light'
                        ? 'border-amber-300 bg-amber-50 text-amber-900'
                        : 'border-amber-500/50 bg-amber-950/30 text-amber-200'
                      : theme === 'light'
                      ? 'border-red-200 bg-red-50 text-red-900'
                      : 'border-red-500/50 bg-red-950/30 text-red-200'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isEncanto
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-red-500/20 text-red-600 dark:text-red-400'
                      }`}>
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <p className={`text-xs font-black uppercase tracking-wide font-sports ${
                          theme === 'light' ? 'text-slate-900' : 'text-white'
                        }`}>
                          Tarjeta en Línea
                        </p>
                        <p className={`text-[10px] font-sans ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                          Visa, Mastercard, Amex • Cobro directo Stripe
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40">
                      Activo
                    </span>
                  </div>
                </div>

                {/* Total y Botón Atómico */}
                <div className={`pt-3 border-t space-y-3 ${theme === 'light' ? 'border-slate-200' : 'border-slate-700/70'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-[10px] font-bold uppercase block font-sports tracking-wider ${
                        theme === 'light' ? 'text-slate-600' : 'text-slate-400'
                      }`}>
                        Total ({selectedSeats.length} {selectedSeats.length === 1 ? 'boleto' : 'boletos'})
                      </span>
                      <span className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Impuestos y cargos incluidos</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xl sm:text-2xl font-black font-scoreboard ${
                        theme === 'light' ? 'text-emerald-600' : 'text-emerald-400'
                      }`}>
                        ${totalAmount} <span className={`text-xs font-normal font-sans ${
                          theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                        }`}>MXN</span>
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
              </>
            )}
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

      {/* Modal Popup de Confirmación Oficial de Boletos Emitidos */}
      {completedTickets && completedTickets.length > 0 && (
        <PurchaseSuccessModal
          isOpen={true}
          type="ticket"
          tickets={completedTickets}
          onClose={() => {
            const pid = completedPurchaseId || '';
            const cnt = completedTicketsCount || completedTickets.length;
            setCompletedTickets(null);
            onPurchaseSuccess(pid, cnt);
          }}
          onNavigateToTickets={() => {
            const pid = completedPurchaseId || '';
            const cnt = completedTicketsCount || completedTickets.length;
            setCompletedTickets(null);
            onPurchaseSuccess(pid, cnt);
          }}
        />
      )}
    </div>
  );
};
