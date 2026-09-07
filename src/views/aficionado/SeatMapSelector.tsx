import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, VenueEvent, SeatSection, EventSeat, EventType, VenueZone, VenueLayoutShape } from '../../types';
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
  generateEventSeats,
  purchaseSeatsTransaction,
  getZonePrice,
  MARISCAL_ZONES,
  SeatPurchaseItem,
} from '../../lib/seatMap';
import { generateSeatMapLayout, SeatMapPosition } from '../../lib/venueLayoutEngine';
import { subscribeVenueZones } from '../../lib/venueZones';
import { getVenueById } from '../../lib/venues';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  MapPin,
  Calendar,
  Clock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  CreditCard,
  Banknote,
  X,
  Info,
  Sparkles,
  Users,
  Maximize2,
  Layers,
} from 'lucide-react';

interface SeatMapSelectorProps {
  event: VenueEvent;
  user: UserProfile;
  stadiumName: string;
  onPurchaseSuccess: (purchaseId: string, count: number) => void;
  onCancel: () => void;
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
}) => {
  // Gráfico central del recinto/cancha según el tipo de evento
  const FieldGraphic = getFieldGraphic(event.type);

  const [sections, setSections] = useState<SeatSection[]>([]);
  const [eventSeats, setEventSeats] = useState<EventSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Sección activa para visualizar la cuadrícula
  const [activeSectionNumber, setActiveSectionNumber] = useState<string>('104');
  const [activeZoneFilter, setActiveZoneFilter] = useState<string>('Todas');

  // Forma del recinto y zonas de precios
  const [venueLayoutShape, setVenueLayoutShape] = useState<VenueLayoutShape>('baseball_horseshoe');
  const [venueZones, setVenueZones] = useState<VenueZone[]>([]);

  // Asientos seleccionados para la compra conjunta
  const [selectedSeats, setSelectedSeats] = useState<SeatPurchaseItem[]>([]);

  // Método de pago
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo / Taquilla' | 'Tarjeta en Línea' | 'Venados Pay'>('Efectivo / Taquilla');
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  // Cargar forma arquitectónica y zonas de la sede
  useEffect(() => {
    getVenueById(event.venueId).then((v) => {
      if (v?.layoutShape) {
        setVenueLayoutShape(v.layoutShape);
      }
    });

    const unsubscribeZones = subscribeVenueZones(
      event.venueId,
      (fetchedZones) => {
        setVenueZones(fetchedZones);
      },
      (err) => console.warn('Aviso escuchando zonas del recinto:', err)
    );

    return () => unsubscribeZones();
  }, [event.venueId]);

  // Cargar y escuchar secciones del estadio
  useEffect(() => {
    setLoading(true);
    const unsubscribeSections = subscribeSeatSections(
      event.venueId,
      (fetchedSections) => {
        setSections(fetchedSections);
        if (fetchedSections.length > 0 && !fetchedSections.some((s) => s.sectionNumber === activeSectionNumber)) {
          setActiveSectionNumber(fetchedSections[0].sectionNumber);
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

  // Estadísticas globales de disponibilidad (Capacidad Estadio Teodoro Mariscal: 94 secciones x 30 = 2,820 asientos)
  const globalStats = useMemo(() => {
    const total = 94 * 30;
    const sold = eventSeats.filter((s) => s.status === 'vendido').length;
    const available = Math.max(0, total - sold);
    return { total, sold, available };
  }, [eventSeats]);

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

      onPurchaseSuccess(result.purchaseId, result.count);
    } catch (err: any) {
      console.error('Error en transacción de compra:', err);
      const message = err.message || 'Error al procesar la compra de asientos.';
      setPurchaseError(message);
    } finally {
      setPurchasing(false);
    }
  };

  // Mapa indexado de VenueZones para acceso instantáneo
  const zonesMap = useMemo(() => {
    const map: Record<string, VenueZone> = {};
    for (const z of venueZones) {
      map[z.id] = z;
    }
    return map;
  }, [venueZones]);

  // Generador dinámico de posiciones espaciales de cada sección
  const layoutPositions = useMemo(() => {
    return generateSeatMapLayout(venueLayoutShape, sections, zonesMap);
  }, [venueLayoutShape, sections, zonesMap]);

  // Resolver color de zona oficial
  const getSectionColor = (sec: SeatSection | SeatMapPosition) => {
    if ('color' in sec && sec.color) return sec.color;
    if (sec.zoneId && zonesMap[sec.zoneId]) return zonesMap[sec.zoneId].color;
    const name = sec.zoneName || (sec.zoneId && zonesMap[sec.zoneId]?.name);
    if (name && MARISCAL_ZONES[name]) return MARISCAL_ZONES[name].colorHex;
    return '#3B82F6';
  };

  // Lista única de zonas para filtrar
  const availableZones = useMemo(() => {
    if (venueZones.length > 0) {
      return venueZones.map((z) => z.name);
    }
    return Object.keys(MARISCAL_ZONES);
  }, [venueZones]);

  // Secciones filtradas
  const filteredSections = useMemo(() => {
    if (activeZoneFilter === 'Todas') return sections;
    return sections.filter((s) => {
      const zName = s.zoneName || (s.zoneId && zonesMap[s.zoneId]?.name);
      return zName === activeZoneFilter;
    });
  }, [sections, activeZoneFilter, zonesMap]);

  if (loading || generating) {
    return (
      <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-xs text-center space-y-4">
        <LoadingSpinner
          message={
            generating
              ? 'Configurando disponibilidad del mapa físico para este partido...'
              : 'Cargando mapa de asientos del Estadio Teodoro Mariscal...'
          }
        />
        <p className="text-xs text-slate-400">
          Sincronizando 94 secciones y cuadrículas de butacas en tiempo real desde Firestore.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header con Información del Evento & Botón Volver */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer mr-1"
            >
              <ArrowLeft className="w-4 h-4" /> Volver a eventos
            </button>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-800">
              {event.type}
            </span>
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Mapa en Vivo
            </span>
          </div>

          <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
            {event.name}
          </h2>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1 font-semibold text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-red-600" />
              {event.date}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {event.time || '20:00 hrs'}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-red-600" />
              {stadiumName}
            </span>
          </div>
        </div>

        {/* Contadores globales */}
        <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 text-xs">
          <div className="text-center px-2">
            <span className="block text-[10px] text-slate-400 font-bold uppercase">Disponibles</span>
            <span className="text-sm font-black text-emerald-600">{globalStats.available}</span>
          </div>
          <div className="w-px h-6 bg-slate-200"></div>
          <div className="text-center px-2">
            <span className="block text-[10px] text-slate-400 font-bold uppercase">Ocupados</span>
            <span className="text-sm font-black text-slate-500">{globalStats.sold}</span>
          </div>
          <div className="w-px h-6 bg-slate-200"></div>
          <div className="text-center px-2">
            <span className="block text-[10px] text-slate-400 font-bold uppercase">Capacidad</span>
            <span className="text-sm font-black text-slate-800">{globalStats.total}</span>
          </div>
        </div>
      </div>

      {/* 2. Barra de Leyenda de Zonas y Filtro Rápido */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-red-600" /> Zonas Oficiales del Teodoro Mariscal
          </span>
          <span className="text-[11px] text-slate-400">
            Haz clic en una zona para filtrar secciones o selecciónala en el mapa
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveZoneFilter('Todas')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeZoneFilter === 'Todas'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todas ({sections.length})
          </button>

          {availableZones.map((zName) => {
            const zMeta = MARISCAL_ZONES[zName];
            const zoneColor =
              venueZones.find((z) => z.name === zName)?.color ||
              zMeta?.colorHex ||
              '#3B82F6';
            const price = getZonePrice(zName, event);
            const isFilterActive = activeZoneFilter === zName;

            return (
              <button
                key={zName}
                onClick={() => setActiveZoneFilter(zName)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  isFilterActive
                    ? 'ring-2 ring-slate-900 text-slate-900 bg-white border-slate-400 shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: zoneColor }}
                ></span>
                <span>{zName}</span>
                <span className="text-[10px] font-mono text-slate-400 font-normal">
                  ${price}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Panel Principal: Mapa Interactivo SVG + Cuadrícula de Asientos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LADO IZQUIERDO: Mapa del Estadio (Herradura / Diamante de Béisbol) */}
        <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Maximize2 className="w-4 h-4 text-red-600" />
                Mapa Físico del Estadio
              </h3>
              <p className="text-[11px] text-slate-500">
                Selecciona una sección directamente en el estadio o en el listado inferior
              </p>
            </div>

            {currentSection && (
              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-red-50 text-red-800 border border-red-200">
                Sección activa: <strong className="font-black">#{currentSection.sectionNumber}</strong> ({currentSection.zoneName})
              </span>
            )}
          </div>

          {/* Canvas SVG del Recinto / Estadio */}
          <div className="relative w-full aspect-[4/3] bg-radial from-slate-900 via-slate-950 to-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center p-2">
            <svg
              viewBox="0 0 800 620"
              className="w-full h-full select-none"
              style={{ maxHeight: '420px' }}
            >
              {/* Gráfico central dinámico según event.type */}
              <FieldGraphic />

              {/* SECCIONES DINÁMICAS GENERADAS POR EL MOTOR ARQUITECTÓNICO */}
              <g id="dynamic-venue-sections">
                {layoutPositions.map((pos) => {
                  const isSelected = activeSectionNumber === pos.sectionNumber;
                  const zoneColor = getSectionColor(pos);
                  const transform = pos.rotation
                    ? `rotate(${pos.rotation} ${pos.x + pos.width / 2} ${pos.y + pos.height / 2})`
                    : undefined;

                  return (
                    <g
                      key={pos.sectionId || pos.sectionNumber}
                      onClick={() => setActiveSectionNumber(pos.sectionNumber)}
                      className="cursor-pointer transition-transform hover:opacity-100"
                      transform={transform}
                    >
                      <rect
                        x={pos.x}
                        y={pos.y}
                        width={pos.width}
                        height={pos.height}
                        rx="4"
                        fill={isSelected ? '#ffffff' : zoneColor}
                        stroke={isSelected ? '#fbbf24' : '#0f172a'}
                        strokeWidth={isSelected ? 2.5 : 1}
                        opacity={isSelected ? 1 : 0.88}
                      />
                      <text
                        x={pos.labelX}
                        y={pos.labelY}
                        fill={isSelected ? '#0f172a' : '#ffffff'}
                        fontSize={pos.width < 28 ? '7' : '8.5'}
                        fontWeight="900"
                        textAnchor="middle"
                      >
                        {pos.sectionNumber}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Etiqueta flotante inferior del mapa */}
            <div className="absolute bottom-2 left-3 right-3 bg-slate-900/80 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-slate-700/50 flex items-center justify-between text-[11px] text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                Sección activa: <strong className="text-white font-bold">{currentSection?.sectionNumber} ({currentSection?.zoneName})</strong>
              </span>
              <span className="text-slate-400">Toca cualquier sección para ver butacas</span>
            </div>
          </div>

          {/* Selector rápido de secciones en carrusel/rejilla */}
          <div className="space-y-1.5 pt-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
              Explorador de Secciones ({filteredSections.length})
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200">
              {filteredSections.map((sec) => {
                const isSelected = activeSectionNumber === sec.sectionNumber;
                const secSeats = seatsBySection.get(sec.sectionNumber) || [];
                const soldCount = secSeats.filter((s) => s.status === 'vendido').length;
                const availableCount = Math.max(0, (sec.totalSeats || 30) - soldCount);
                const color = getSectionColor(sec);

                return (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSectionNumber(sec.sectionNumber)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                      isSelected
                        ? 'bg-red-700 text-white border-red-700 shadow-xs ring-1 ring-red-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: color }}
                    ></span>
                    <span>Sec. {sec.sectionNumber}</span>
                    <span
                      className={`text-[10px] font-normal ${
                        isSelected ? 'text-red-200' : 'text-slate-400'
                      }`}
                    >
                      ({availableCount})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* LADO DERECHO: Cuadrícula de Asientos de la Sección Activa */}
        <div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-5">
          {currentSection ? (
            <div className="space-y-4">
              {/* Header de la sección activa */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{
                        backgroundColor: getSectionColor(currentSection),
                      }}
                    ></span>
                    <h3 className="text-base font-black text-slate-900">
                      Sección {currentSection.sectionNumber}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                      {currentSection.zoneName || (currentSection.zoneId && zonesMap[currentSection.zoneId]?.name) || 'General'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {currentSection.ring ? `Nivel / Anillo: ${currentSection.ring}` : 'Excelente visibilidad del evento'}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Precio</span>
                  <span className="text-base sm:text-lg font-black text-red-900">
                    ${getZonePrice(currentSection.zoneName || (currentSection.zoneId && zonesMap[currentSection.zoneId]?.name) || '', event)}{' '}
                    <span className="text-[10px] font-normal text-slate-500">MXN</span>
                  </span>
                </div>
              </div>

              {/* Indicador visual hacia el terreno de juego */}
              <div className="w-full py-1.5 px-3 bg-slate-100 rounded-xl text-center text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-200">
                ▲ FRENTE / TERRENO DE JUEGO ▲
              </div>

              {/* Leyenda de estado de butaca */}
              <div className="flex items-center justify-center gap-4 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-md border-2 border-emerald-500 bg-emerald-50"></div>
                  <span>Disponible</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-md bg-red-700 text-white flex items-center justify-center text-[9px] font-bold">
                    ✓
                  </div>
                  <span className="font-bold text-red-950">Seleccionado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-md bg-slate-200 border border-slate-300 text-slate-400 flex items-center justify-center text-[10px]">
                    ✕
                  </div>
                  <span className="text-slate-400">Vendido</span>
                </div>
              </div>

              {/* Cuadrícula de Asientos por Fila (A, B, C) */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                {['A', 'B', 'C'].map((rowLabel) => {
                  const rowSeats = currentSectionSeats.filter((s) => s.rowLabel === rowLabel);
                  const seatsList = Array.from({ length: 10 }, (_, idx) => {
                    const seatNum = idx + 1;
                    const existingSeat = rowSeats.find((s) => s.seatNumber === seatNum);
                    if (existingSeat) {
                      return existingSeat;
                    }
                    return {
                      id: `${event.id}_${currentSection.sectionNumber}_${rowLabel}_${seatNum}`,
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
                      <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                        {rowLabel}
                      </span>

                      <div className="grid grid-cols-10 gap-1.5 flex-1">
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
                                  ? 'bg-slate-200 border border-slate-300 text-slate-400 cursor-not-allowed line-through'
                                  : isSelected
                                  ? 'bg-red-700 text-white shadow-xs scale-105 ring-2 ring-red-500'
                                  : 'bg-white hover:bg-emerald-50 text-slate-800 border-2 border-emerald-500 hover:scale-105'
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

              <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                <span>
                  Disponibles en Sec. {currentSection.sectionNumber}:{' '}
                  <strong className="text-slate-800">
                    {currentSectionSeats.filter((s) => s.status === 'disponible').length} de{' '}
                    {currentSectionSeats.length || 30}
                  </strong>
                </span>
                <span className="text-[11px] text-slate-400">Filas A a la C (10 asientos c/u)</span>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">
              Selecciona una sección en el mapa para cargar su cuadrícula.
            </div>
          )}

          {/* 4. Panel de Resumen de Compra y Botón de Transacción Atómica */}
          <div className="pt-4 border-t border-slate-100 space-y-4">
            {/* Mensaje de error de transacción / Colisión de asientos */}
            {purchaseError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-xs text-red-900 font-semibold animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">No se pudo completar la compra:</p>
                  <p className="font-normal text-red-800">{purchaseError}</p>
                </div>
              </div>
            )}

            {/* Asientos Seleccionados (Chips) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-red-600" />
                  Asientos Seleccionados ({selectedSeats.length})
                </span>
                {selectedSeats.length > 0 && (
                  <button
                    onClick={() => setSelectedSeats([])}
                    className="text-[11px] text-red-600 hover:text-red-800 font-bold cursor-pointer"
                  >
                    Limpiar selección
                  </button>
                )}
              </div>

              {selectedSeats.length === 0 ? (
                <div className="p-3 bg-slate-50 rounded-xl text-center text-xs text-slate-400 border border-dashed border-slate-200">
                  Toca uno o varios asientos arriba para agregarlos a tu compra.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200">
                  {selectedSeats.map((item) => (
                    <span
                      key={item.seatId}
                      className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 shadow-xs"
                    >
                      <span>
                        Sec. {item.sectionNumber} • {item.rowLabel}#{item.seatNumber}
                      </span>
                      <span className="text-emerald-700 font-mono text-[11px]">
                        ${item.price}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSeat(item.seatId)}
                        className="w-4 h-4 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Método de Pago */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                Método de Pago
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Efectivo / Taquilla')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                    paymentMethod === 'Efectivo / Taquilla'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-1 ring-emerald-600'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs truncate">Efectivo / Taquilla</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('Tarjeta en Línea')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                    paymentMethod === 'Tarjeta en Línea'
                      ? 'border-red-600 bg-red-50 text-red-950 font-bold ring-1 ring-red-600'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="text-xs truncate">Tarjeta en Línea</span>
                </button>
              </div>
            </div>

            {/* Total y Botón Atómico */}
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Total ({selectedSeats.length} {selectedSeats.length === 1 ? 'boleto' : 'boletos'})
                  </span>
                  <span className="text-xs text-slate-500">Impuestos y cargos incluidos</span>
                </div>
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-black text-red-900">
                    ${totalAmount} <span className="text-xs font-normal text-slate-500">MXN</span>
                  </span>
                </div>
              </div>

              <button
                id="btn-confirm-seat-transaction"
                type="button"
                onClick={handleConfirmPurchase}
                disabled={purchasing || selectedSeats.length === 0}
                className="w-full py-3.5 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {purchasing ? (
                  'Verificando asientos en tiempo real...'
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

              <p className="text-[10px] text-center text-slate-400 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Transacción atómica protegida con Firestore • Garantía de no doble venta
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
