import React, { useState, useEffect, useMemo } from 'react';
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
  getZonePrice,
  MARISCAL_ZONES,
  getStadiumZones,
  isEncantoVenue,
  ENCANTO_GATES_GUIDE,
  SeatPurchaseItem,
} from '../../lib/seatMap';
import { EncantoStadiumMap } from '../../components/stadiumMaps/EncantoStadiumMap';
import { TeodoroMariscalStadiumMap } from '../../components/stadiumMaps/TeodoroMariscalStadiumMap';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  MapPin,
  Calendar,
  Clock,
  ArrowLeft,
  AlertCircle,
  ShieldCheck,
  CreditCard,
  Banknote,
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
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

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

  // Método de pago
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo / Taquilla' | 'Tarjeta en Línea' | 'Venados Pay'>('Efectivo / Taquilla');
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // Cargar y escuchar secciones del estadio
  useEffect(() => {
    setLoading(true);
    const unsubscribeSections = subscribeSeatSections(
      event.venueId,
      (fetchedSections) => {
        setSections(fetchedSections);
        // Ajustar sección activa si no existe en las secciones obtenidas
        if (fetchedSections.length > 0) {
          const exists = fetchedSections.some((s) => s.sectionNumber === activeSectionNumber);
          if (!exists) {
            setActiveSectionNumber(fetchedSections[0].sectionNumber);
          }
        }
      },
      (err) => {
        console.warn('Error en secciones:', err);
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

  // Index de asientos por sección para acceso rápido
  const seatsBySection = useMemo(() => {
    const map = new Map<string, EventSeat[]>();
    for (const seat of eventSeats) {
      const secNum = seat.sectionNumber || seat.sectionId?.split('_sec_')[1] || '';
      if (!map.has(secNum)) {
        map.set(secNum, []);
      }
      map.get(secNum)!.push(seat);
    }
    return map;
  }, [eventSeats]);

  // Sección actualmente seleccionada
  const currentSection = useMemo(() => {
    return sections.find((s) => s.sectionNumber === activeSectionNumber) || sections[0] || null;
  }, [sections, activeSectionNumber]);

  // Asientos de la sección activa
  const currentSectionSeats = useMemo(() => {
    if (!currentSection) return [];
    return seatsBySection.get(currentSection.sectionNumber) || [];
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

  // Alternar selección de un asiento
  const handleToggleSeat = (seat: EventSeat, section: SeatSection) => {
    if (seat.status === 'vendido') return;

    setPurchaseError(null);
    const isAlreadySelected = selectedSeats.some((s) => s.seatId === seat.id);

    if (isAlreadySelected) {
      setSelectedSeats((prev) => prev.filter((s) => s.seatId !== seat.id));
    } else {
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
      setSelectedSeats((prev) => [...prev, newItem]);
    }
  };

  // Quitar un asiento de la lista de compra
  const handleRemoveSeat = (seatId: string) => {
    setSelectedSeats((prev) => prev.filter((s) => s.seatId !== seatId));
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

    try {
      const result = await purchaseSeatsTransaction({
        userId: user.uid,
        customerName: user.displayName || user.email || 'Aficionado',
        event,
        stadiumName,
        selectedSeats,
        paymentMethod,
      });

      try {
        sessionStorage.removeItem(`vxp_seats_${event.id}`);
      } catch {}

      onPurchaseSuccess(result.purchaseId, result.count);
    } catch (err: any) {
      console.error('Error en transacción de compra:', err);
      const message = err.message || 'Error al procesar la compra de asientos.';
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
                isEncanto ? 'bg-purple-900/40 text-purple-300 border border-purple-700/50' : 'bg-red-900/40 text-red-300 border border-red-700/50'
              }`}
            >
              {isEncanto ? 'Fútbol • Liga MX' : event.type}
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
              <Calendar className={`w-3.5 h-3.5 ${isEncanto ? 'text-purple-400' : 'text-red-500'}`} />
              {event.date}
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {event.time || '20:00 hrs'}
            </span>
            <span className="flex items-center gap-1 font-bold text-slate-200">
              <MapPin className={`w-3.5 h-3.5 ${isEncanto ? 'text-purple-400' : 'text-amber-400'}`} />
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

      {/* 2. Barra de Leyenda de Zonas y Filtro Rápido */}
      <div className="bg-[#0F1626] p-3 sm:p-4 rounded-2xl border border-slate-700/80 shadow-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5 font-sports">
            <Layers className={`w-4 h-4 ${isEncanto ? 'text-purple-400' : 'text-red-500'}`} />
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
                  ? 'bg-purple-600 text-white shadow-md'
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
        <div className="bg-[#0A0E17] border border-purple-500/40 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-black shrink-0">
              <DoorOpen className="w-3.5 h-3.5" />
            </span>
            <span className="font-sports font-bold tracking-wide text-purple-300 uppercase">Guía de Puertas de Acceso Oficiales:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ENCANTO_GATES_GUIDE.map((g) => (
              <span
                key={g.gate}
                className="px-2 py-0.5 rounded-lg bg-[#141C2E] border border-purple-700/50 text-[11px] text-purple-200 font-medium"
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
                <Maximize2 className={`w-4 h-4 ${isEncanto ? 'text-purple-400' : 'text-red-500'}`} />
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
                    ? 'bg-purple-950/60 text-purple-300 border-purple-700/60'
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
              className="lg:hidden w-full py-3 px-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black text-xs flex items-center justify-between shadow-md cursor-pointer transition-all font-sports uppercase tracking-wider"
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
              <span className="text-amber-300 font-extrabold flex items-center gap-1">
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
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-purple-950/60 text-[10px] font-bold text-purple-300 border border-purple-700/50">
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
              <div className="flex items-center justify-center gap-4 text-[11px] text-slate-300 font-sports">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-md border-2 border-emerald-500 bg-[#141C2E]"></div>
                  <span>Disponible</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-4 h-4 rounded-md text-white flex items-center justify-center text-[9px] font-bold ${
                      isEncanto ? 'bg-purple-600' : 'bg-red-600'
                    }`}
                  >
                    ✓
                  </div>
                  <span className="font-bold text-white">Seleccionado</span>
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
                    const existingSeat = rowSeats.find((s) => s.seatNumber === seatNum);
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
                    <div key={rowLabel} className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-800 text-amber-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0 border border-slate-700">
                        {rowLabel}
                      </span>

                      <div
                        className="grid gap-1.5 flex-1"
                        style={{
                          gridTemplateColumns: `repeat(${seatsPerRow}, minmax(0, 1fr))`,
                        }}
                      >
                        {seatsList.map((seat) => {
                          const isSelected = selectedSeats.some((s) => s.seatId === seat.id);
                          const isSold = seat.status === 'vendido';

                          return (
                            <button
                              key={seat.id}
                              type="button"
                              onClick={() => handleToggleSeat(seat, currentSection)}
                              disabled={isSold}
                              title={`Fila ${seat.rowLabel} Asiento ${seat.seatNumber} - ${
                                isSold ? 'Vendido' : isSelected ? 'Seleccionado' : 'Disponible'
                              }`}
                              className={`aspect-square rounded-lg text-[10px] font-extrabold transition-all flex items-center justify-center cursor-pointer ${
                                isSold
                                  ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed line-through'
                                  : isSelected
                                  ? isEncanto
                                    ? 'bg-purple-600 text-white shadow-md scale-105 ring-2 ring-purple-400'
                                    : 'bg-red-600 text-white shadow-md scale-105 ring-2 ring-red-400'
                                  : 'bg-[#141C2E] hover:bg-emerald-950/60 text-slate-100 border-2 border-emerald-500/80 hover:scale-105 hover:border-emerald-400'
                              }`}
                            >
                              {isSelected ? '✓' : seat.seatNumber}
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
                    {currentSectionSeats.filter((s) => s.status === 'disponible').length} de{' '}
                    {isEncanto
                      ? currentSectionSeats.length ||
                        (currentSection.rows || 3) * (currentSection.seatsPerRow || 10)
                      : currentSectionSeats.length || 30}
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
                <span className="font-bold text-slate-300 flex items-center gap-1 font-sports uppercase tracking-wide">
                  <Users className={`w-3.5 h-3.5 ${isEncanto ? 'text-purple-400' : 'text-red-500'}`} />
                  Asientos Seleccionados ({selectedSeats.length})
                </span>
                {selectedSeats.length > 0 && (
                  <button
                    onClick={() => setSelectedSeats([])}
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
                  {selectedSeats.map((item) => (
                    <span
                      key={item.seatId}
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

            {/* Método de Pago */}
            <div className="space-y-2 pt-2 border-t border-slate-700/70">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block font-sports">
                Método de Pago
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Efectivo / Taquilla')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                    paymentMethod === 'Efectivo / Taquilla'
                      ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 font-bold ring-1 ring-emerald-500'
                      : 'border-slate-700 bg-[#0A0E17] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <Banknote className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs truncate font-sports">Efectivo / Taquilla</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('Tarjeta en Línea')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                    paymentMethod === 'Tarjeta en Línea'
                      ? isEncanto
                        ? 'border-purple-500 bg-purple-950/40 text-purple-300 font-bold ring-1 ring-purple-500'
                        : 'border-red-500 bg-red-950/40 text-red-300 font-bold ring-1 ring-red-500'
                      : 'border-slate-700 bg-[#0A0E17] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <CreditCard className={`w-4 h-4 ${isEncanto ? 'text-purple-400' : 'text-red-500'} shrink-0`} />
                  <span className="text-xs truncate font-sports">Tarjeta en Línea</span>
                </button>
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
                disabled={purchasing || selectedSeats.length === 0}
                className={`w-full py-3.5 ${
                  isEncanto
                    ? 'bg-purple-600 hover:bg-purple-500 active:bg-purple-700'
                    : 'bg-red-600 hover:bg-red-500 active:bg-red-700'
                } disabled:opacity-50 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer font-sports uppercase tracking-wider`}
              >
                {purchasing ? (
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
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      Confirmar Compra ({selectedSeats.length}{' '}
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
    </div>
  );
};
