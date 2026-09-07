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

  // Asientos seleccionados para la compra conjunta
  const [selectedSeats, setSelectedSeats] = useState<SeatPurchaseItem[]>([]);

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

  // Estadísticas globales de disponibilidad (Capacidad Estadio Teodoro Mariscal: 94 secciones x 30 = 2,820 asientos)
  const globalStats = useMemo(() => {
    const total = isEncanto
      ? sections.reduce(
          (acc, s) => acc + (s.totalSeats || (s.rows || 3) * (s.seatsPerRow || 10)),
          0
        ) || 3120
      : 94 * 30;
    const sold = eventSeats.filter((s) => s.status === 'vendido').length;
    const available = Math.max(0, total - sold);
    return { total, sold, available };
  }, [sections, eventSeats, isEncanto]);

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

  // Lista única de zonas para filtrar
  const availableZones = useMemo(() => {
    return Object.keys(stadiumZones);
  }, [stadiumZones]);

  // Secciones filtradas
  const filteredSections = useMemo(() => {
    if (activeZoneFilter === 'Todas') return sections;
    return sections.filter((s) => s.zoneName === activeZoneFilter);
  }, [sections, activeZoneFilter]);

  if (loading || generating) {
    return (
      <div className="bg-white rounded-3xl p-12 border border-slate-200 shadow-xs text-center space-y-4">
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
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer mr-1"
            >
              <ArrowLeft className="w-4 h-4" /> Volver a eventos
            </button>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isEncanto ? 'bg-purple-100 text-purple-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {isEncanto ? 'Fútbol • Liga MX' : event.type}
            </span>
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {isEncanto ? 'Mapa Oficial en Vivo' : 'Mapa en Vivo'}
            </span>
          </div>

          <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
            {event.name}
          </h2>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1 font-semibold text-slate-700">
              <Calendar className={`w-3.5 h-3.5 ${isEncanto ? 'text-purple-600' : 'text-red-600'}`} />
              {event.date}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {event.time || '20:00 hrs'}
            </span>
            <span className="flex items-center gap-1 font-bold text-slate-700">
              <MapPin className={`w-3.5 h-3.5 ${isEncanto ? 'text-purple-600' : 'text-red-600'}`} />
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
            <Layers className={`w-4 h-4 ${isEncanto ? 'text-purple-600' : 'text-red-600'}`} />
            {isEncanto ? `Zonas Oficiales: ${stadiumName}` : 'Zonas Oficiales del Teodoro Mariscal'}
          </span>
          <span className="text-[11px] text-slate-400">
            {isEncanto
              ? 'Haz clic en una zona para filtrar secciones o selecciónala directamente en el mapa'
              : 'Haz clic en una zona para filtrar secciones o selecciónala en el mapa'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveZoneFilter('Todas')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeZoneFilter === 'Todas'
                ? isEncanto
                  ? 'bg-purple-900 text-white shadow-xs'
                  : 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                    ? 'ring-2 ring-slate-900 text-slate-900 bg-white border-slate-400 shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: zMeta.colorHex }}
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

      {/* GUÍA DE PUERTAS DE ACCESO (Especial para Estadio El Encanto) */}
      {isEncanto && (
        <div className="bg-purple-50/70 border border-purple-200/80 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-purple-800 text-white flex items-center justify-center text-xs font-black shrink-0">
              <DoorOpen className="w-3.5 h-3.5" />
            </span>
            <span className="font-black text-purple-950">Guía de Puertas de Acceso Oficiales:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {ENCANTO_GATES_GUIDE.map((g) => (
              <span
                key={g.gate}
                className="px-2 py-0.5 rounded-lg bg-white border border-purple-200 text-[11px] text-purple-900 font-medium"
              >
                <strong className="font-bold text-purple-950">{g.gate}:</strong> {g.zones.join(', ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. Panel Principal: Mapa Interactivo SVG + Cuadrícula de Asientos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LADO IZQUIERDO: Mapa del Estadio (Herradura / Diamante de Béisbol o Cancha Fútbol Encanto) */}
        <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4 flex flex-col">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Maximize2 className={`w-4 h-4 ${isEncanto ? 'text-purple-600' : 'text-red-600'}`} />
                {isEncanto ? `Distribución Oficial: ${stadiumName}` : 'Mapa Físico del Estadio'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isEncanto
                  ? 'Toca cualquier sección directamente en el mapa para ver sus butacas'
                  : 'Selecciona una sección directamente en el estadio o en el listado inferior'}
              </p>
            </div>

            {currentSection && (
              <span
                className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${
                  isEncanto
                    ? 'bg-purple-50 text-purple-900 border-purple-200'
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}
              >
                Sección activa: <strong className="font-black">#{currentSection.sectionNumber}</strong> ({currentSection.zoneName})
              </span>
            )}
          </div>

          {/* RENDERIZADO DEL MAPA */}
          {isEncanto ? (
            <EncantoStadiumMap
              sections={sections}
              activeSectionNumber={activeSectionNumber}
              activeZoneFilter={activeZoneFilter === 'Todas' ? null : activeZoneFilter}
              onSelectSection={setActiveSectionNumber}
              event={event}
            />
          ) : (
            <div className="relative w-full aspect-[4/3] bg-radial from-slate-900 via-slate-950 to-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center p-2">
              <svg
                viewBox="0 0 800 620"
                className="w-full h-full select-none"
                style={{ maxHeight: '420px' }}
              >
                {/* Gráfico central dinámico según event.type */}
                <FieldGraphic />

                {/* SECCIONES EN HERRADURA ALREDEDOR DEL CAMPO */}

                {/* ANILLO 3: Nivel 300 - Sky (Arco Superior) */}
                <g id="tier-sky-300">
                  {[
                    { num: '301', x: 80, y: 150 },
                    { num: '302', x: 110, y: 120 },
                    { num: '303', x: 150, y: 90 },
                    { num: '304', x: 195, y: 68 },
                    { num: '305', x: 245, y: 52 },
                    { num: '306', x: 300, y: 44 },
                    { num: '307', x: 355, y: 40 },
                    { num: '308', x: 410, y: 40 },
                    { num: '309', x: 465, y: 44 },
                    { num: '310', x: 520, y: 52 },
                    { num: '311', x: 570, y: 68 },
                    { num: '312', x: 615, y: 90 },
                    { num: '313', x: 655, y: 120 },
                    { num: '314', x: 685, y: 150 },
                    { num: '315', x: 705, y: 190 },
                    { num: '316', x: 715, y: 235 },
                  ].map((pos) => {
                    const isSelected = activeSectionNumber === pos.num;
                    const zoneColor = MARISCAL_ZONES['Sky']?.colorHex || '#6366F1';
                    return (
                      <g
                        key={pos.num}
                        onClick={() => setActiveSectionNumber(pos.num)}
                        className="cursor-pointer transition-transform hover:opacity-100"
                      >
                        <rect
                          x={pos.x}
                          y={pos.y}
                          width="38"
                          height="22"
                          rx="4"
                          fill={isSelected ? '#ffffff' : zoneColor}
                          stroke={isSelected ? '#fbbf24' : '#1e1b4b'}
                          strokeWidth={isSelected ? 3 : 1}
                          opacity={isSelected ? 1 : 0.85}
                        />
                        <text
                          x={pos.x + 19}
                          y={pos.y + 15}
                          fill={isSelected ? '#0f172a' : '#ffffff'}
                          fontSize="9"
                          fontWeight="900"
                          textAnchor="middle"
                        >
                          {pos.num}
                        </text>
                      </g>
                    );
                  })}
                </g>

                {/* ANILLO 2: Nivel 200 (Gradas Intermedias) */}
                <g id="tier-level-200">
                  {[
                    // Fan Plus & Fan (Jardines laterales 200s)
                    { num: '233', x: 95, y: 220, zone: 'Fan Plus' },
                    { num: '232', x: 105, y: 250, zone: 'Fan Plus' },
                    { num: '231', x: 115, y: 280, zone: 'Fan Plus' },
                    { num: '227', x: 130, y: 310, zone: 'Fan' },
                    { num: '226', x: 145, y: 340, zone: 'Fan' },
                    { num: '225', x: 165, y: 370, zone: 'Fan' },

                    // Plus & Sky Plus (Tercera Base 200s)
                    { num: '221', x: 190, y: 400, zone: 'Plus' },
                    { num: '220', x: 215, y: 430, zone: 'Plus' },
                    { num: '217', x: 245, y: 460, zone: 'Sky Plus' },
                    { num: '216', x: 275, y: 485, zone: 'Sky Plus' },

                    // Diamante, Oro & Platino 200s (Detrás de Home)
                    { num: '208', x: 310, y: 510, zone: 'Diamante' },
                    { num: '203', x: 345, y: 525, zone: 'Oro' },
                    { num: '207', x: 380, y: 535, zone: 'Platino' },
                    { num: '204', x: 418, y: 535, zone: 'Platino' },
                    { num: '202', x: 453, y: 525, zone: 'Oro' },
                    { num: '201', x: 488, y: 510, zone: 'Diamante' },

                    // Sky Plus & Plus (Primera Base 200s)
                    { num: '210', x: 523, y: 485, zone: 'Sky Plus' },
                    { num: '209', x: 553, y: 460, zone: 'Sky Plus' },
                    { num: '218', x: 583, y: 430, zone: 'Plus' },
                    { num: '219', x: 608, y: 400, zone: 'Plus' },

                    // Fan & Fan Plus (Jardín Derecho 200s)
                    { num: '222', x: 633, y: 370, zone: 'Fan' },
                    { num: '223', x: 653, y: 340, zone: 'Fan' },
                    { num: '224', x: 668, y: 310, zone: 'Fan' },
                    { num: '228', x: 683, y: 280, zone: 'Fan Plus' },
                    { num: '229', x: 693, y: 250, zone: 'Fan Plus' },
                    { num: '230', x: 703, y: 220, zone: 'Fan Plus' },
                  ].map((pos) => {
                    const isSelected = activeSectionNumber === pos.num;
                    const zoneColor = MARISCAL_ZONES[pos.zone]?.colorHex || '#3B82F6';
                    return (
                      <g
                        key={pos.num}
                        onClick={() => setActiveSectionNumber(pos.num)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={pos.x}
                          y={pos.y}
                          width="34"
                          height="20"
                          rx="3"
                          fill={isSelected ? '#ffffff' : zoneColor}
                          stroke={isSelected ? '#fbbf24' : '#0f172a'}
                          strokeWidth={isSelected ? 2.5 : 1}
                          opacity={isSelected ? 1 : 0.9}
                        />
                        <text
                          x={pos.x + 17}
                          y={pos.y + 14}
                          fill={isSelected ? '#0f172a' : '#ffffff'}
                          fontSize="8.5"
                          fontWeight="900"
                          textAnchor="middle"
                        >
                          {pos.num}
                        </text>
                      </g>
                    );
                  })}
                </g>

                {/* ANILLO 1: Nivel 100 (Infield Boxes) */}
                <g id="tier-level-100">
                  {[
                    // Fan & Fan Plus (Jardín Izquierdo 100s)
                    { num: '133', x: 135, y: 240, zone: 'Fan Plus' },
                    { num: '130', x: 145, y: 270, zone: 'Fan Plus' },
                    { num: '127', x: 160, y: 300, zone: 'Fan' },
                    { num: '124', x: 180, y: 335, zone: 'Fan' },
                    { num: '121', x: 205, y: 370, zone: 'Plus' },
                    { num: '118', x: 230, y: 405, zone: 'Plus' },
                    { num: '115', x: 260, y: 440, zone: 'Sky Plus' },
                    { num: '112', x: 290, y: 470, zone: 'Sky Plus' },

                    // Diamante, Oro & Platino 100s
                    { num: '108', x: 325, y: 495, zone: 'Diamante' },
                    { num: '103', x: 355, y: 508, zone: 'Oro' },
                    { num: '107', x: 385, y: 515, zone: 'Platino' },
                    { num: '104', x: 415, y: 515, zone: 'Platino' },
                    { num: '102', x: 445, y: 508, zone: 'Oro' },
                    { num: '101', x: 475, y: 495, zone: 'Diamante' },

                    // Sky Plus, Plus & Fan (Jardín Derecho 100s)
                    { num: '109', x: 505, y: 470, zone: 'Sky Plus' },
                    { num: '113', x: 535, y: 440, zone: 'Sky Plus' },
                    { num: '119', x: 565, y: 405, zone: 'Plus' },
                    { num: '120', x: 590, y: 370, zone: 'Plus' },
                    { num: '122', x: 615, y: 335, zone: 'Fan' },
                    { num: '125', x: 635, y: 300, zone: 'Fan' },
                    { num: '128', x: 650, y: 270, zone: 'Fan Plus' },
                    { num: '131', x: 660, y: 240, zone: 'Fan Plus' },
                  ].map((pos) => {
                    const isSelected = activeSectionNumber === pos.num;
                    const zoneColor = MARISCAL_ZONES[pos.zone]?.colorHex || '#0284C7';
                    return (
                      <g
                        key={pos.num}
                        onClick={() => setActiveSectionNumber(pos.num)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={pos.x}
                          y={pos.y}
                          width="28"
                          height="18"
                          rx="3"
                          fill={isSelected ? '#ffffff' : zoneColor}
                          stroke={isSelected ? '#fbbf24' : '#ffffff'}
                          strokeWidth={isSelected ? 2.5 : 0.8}
                          opacity={isSelected ? 1 : 0.95}
                        />
                        <text
                          x={pos.x + 14}
                          y={pos.y + 12.5}
                          fill={isSelected ? '#0f172a' : '#ffffff'}
                          fontSize="8"
                          fontWeight="900"
                          textAnchor="middle"
                        >
                          {pos.num}
                        </text>
                      </g>
                    );
                  })}
                </g>

                {/* ANILLO 0: Deluxe Supreme 1 a 12 (Central Baja, pegado a Home Plate) */}
                <g id="tier-deluxe-supreme">
                  {[
                    { num: '12', x: 260, y: 420 },
                    { num: '11', x: 280, y: 435 },
                    { num: '10', x: 305, y: 450 },
                    { num: '9', x: 330, y: 462 },
                    { num: '8', x: 355, y: 472 },
                    { num: '7', x: 380, y: 478 },
                    { num: '6', x: 405, y: 478 },
                    { num: '5', x: 430, y: 472 },
                    { num: '4', x: 455, y: 462 },
                    { num: '3', x: 480, y: 450 },
                    { num: '2', x: 505, y: 435 },
                    { num: '1', x: 525, y: 420 },
                  ].map((pos) => {
                    const isSelected = activeSectionNumber === pos.num;
                    const zoneColor = MARISCAL_ZONES['Deluxe Supreme']?.colorHex || '#D97706';
                    return (
                      <g
                        key={pos.num}
                        onClick={() => setActiveSectionNumber(pos.num)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={pos.x}
                          y={pos.y}
                          width="22"
                          height="15"
                          rx="2.5"
                          fill={isSelected ? '#ffffff' : zoneColor}
                          stroke={isSelected ? '#fbbf24' : '#fef08a'}
                          strokeWidth={isSelected ? 2.5 : 1}
                          opacity="1"
                        />
                        <text
                          x={pos.x + 11}
                          y={pos.y + 10.5}
                          fill={isSelected ? '#0f172a' : '#ffffff'}
                          fontSize="7"
                          fontWeight="900"
                          textAnchor="middle"
                        >
                          {pos.num}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          )}

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
                const availableCount = Math.max(0, (sec.totalSeats || (sec.rows || 3) * (sec.seatsPerRow || 10)) - soldCount);
                const zoneMeta = stadiumZones[sec.zoneName] || (MARISCAL_ZONES[sec.zoneName] || { colorHex: '#64748B' });

                return (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSectionNumber(sec.sectionNumber)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                      isSelected
                        ? isEncanto
                          ? 'bg-purple-900 text-white border-purple-900 shadow-xs ring-1 ring-purple-900'
                          : 'bg-red-700 text-white border-red-700 shadow-xs ring-1 ring-red-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: zoneMeta.colorHex }}
                    ></span>
                    <span>{isEncanto ? sec.sectionNumber : `Sec. ${sec.sectionNumber}`}</span>
                    <span
                      className={`text-[10px] font-normal ${
                        isSelected
                          ? isEncanto
                            ? 'text-purple-200'
                            : 'text-red-200'
                          : 'text-slate-400'
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
                        backgroundColor:
                          activeZoneMeta?.colorHex ||
                          MARISCAL_ZONES[currentSection.zoneName]?.colorHex ||
                          '#D97706',
                      }}
                    ></span>
                    <h3 className="text-base font-black text-slate-900">
                      {isEncanto
                        ? `Sección ${currentSection.sectionNumber}`
                        : `Sección #${currentSection.sectionNumber} • ${currentSection.zoneName}`}
                    </h3>
                    {isEncanto && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                        {currentSection.zoneName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {isEncanto
                      ? (activeZoneMeta?.description || 'Excelente visibilidad del terreno de juego')
                      : (MARISCAL_ZONES[currentSection.zoneName]?.description ||
                        'Excelente visibilidad del diamante')}
                  </p>
                  {isEncanto && activeZoneMeta?.gate && (
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-purple-50 text-[10px] font-bold text-purple-800 border border-purple-200">
                      <DoorOpen className="w-3 h-3" /> Acceso: {activeZoneMeta.gate}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Precio</span>
                  <span
                    className={`text-base sm:text-lg font-black ${
                      isEncanto ? 'text-purple-950' : 'text-red-900'
                    }`}
                  >
                    ${getZonePrice(currentSection.zoneName, event)}{' '}
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
                  <div
                    className={`w-4 h-4 rounded-md text-white flex items-center justify-center text-[9px] font-bold ${
                      isEncanto ? 'bg-purple-800' : 'bg-red-700'
                    }`}
                  >
                    ✓
                  </div>
                  <span className="font-bold text-slate-900">Seleccionado</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-md bg-slate-200 border border-slate-300 text-slate-400 flex items-center justify-center text-[10px]">
                    ✕
                  </div>
                  <span className="text-slate-400">Vendido</span>
                </div>
              </div>

              {/* Cuadrícula de Asientos por Fila */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
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
                      <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
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
                                  ? 'bg-slate-200 border border-slate-300 text-slate-400 cursor-not-allowed line-through'
                                  : isSelected
                                  ? isEncanto
                                    ? 'bg-purple-800 text-white shadow-xs scale-105 ring-2 ring-purple-600'
                                    : 'bg-red-700 text-white shadow-xs scale-105 ring-2 ring-red-500'
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
                    {isEncanto
                      ? currentSectionSeats.length ||
                        (currentSection.rows || 3) * (currentSection.seatsPerRow || 10)
                      : currentSectionSeats.length || 30}
                  </strong>
                </span>
                <span className="text-[11px] text-slate-400">
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
                  <Users className={`w-3.5 h-3.5 ${isEncanto ? 'text-purple-600' : 'text-red-600'}`} />
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
                      ? isEncanto
                        ? 'border-purple-600 bg-purple-50 text-purple-950 font-bold ring-1 ring-purple-600'
                        : 'border-red-600 bg-red-50 text-red-950 font-bold ring-1 ring-red-600'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <CreditCard className={`w-4 h-4 ${isEncanto ? 'text-purple-600' : 'text-red-600'} shrink-0`} />
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
                  <span className={`text-xl sm:text-2xl font-black ${isEncanto ? 'text-purple-950' : 'text-red-900'}`}>
                    ${totalAmount} <span className="text-xs font-normal text-slate-500">MXN</span>
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
                    ? 'bg-purple-900 hover:bg-purple-950'
                    : 'bg-red-700 hover:bg-red-800'
                } disabled:opacity-50 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer`}
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
                Transacción atómica protegida • Asignación oficial de butacas
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
