import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, VenueEvent, SeatSection, EventSeat } from '../../types';
import {
  subscribeSeatSections,
  subscribeEventSeats,
  generateEventSeats,
  purchaseSeatsTransaction,
  getZonePrice,
  MARISCAL_ZONES,
  SeatPurchaseItem,
} from '../../lib/seatMap';
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

export const SeatMapSelector: React.FC<SeatMapSelectorProps> = ({
  event,
  user,
  stadiumName,
  onPurchaseSuccess,
  onCancel,
}) => {
  const [sections, setSections] = useState<SeatSection[]>([]);
  const [eventSeats, setEventSeats] = useState<EventSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Sección activa para visualizar la cuadrícula
  const [activeSectionNumber, setActiveSectionNumber] = useState<string>('104');
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

  // Lista única de zonas para filtrar
  const availableZones = useMemo(() => {
    return Object.keys(MARISCAL_ZONES);
  }, []);

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

          {/* Canvas SVG del Estadio de Béisbol */}
          <div className="relative w-full aspect-[4/3] bg-radial from-slate-900 via-slate-950 to-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center p-2">
            <svg
              viewBox="0 0 800 620"
              className="w-full h-full select-none"
              style={{ maxHeight: '420px' }}
            >
              <defs>
                {/* Pasto de los jardines */}
                <radialGradient id="outfieldGrass" cx="50%" cy="80%" r="70%">
                  <stop offset="0%" stopColor="#15803d" />
                  <stop offset="70%" stopColor="#166534" />
                  <stop offset="100%" stopColor="#14532d" />
                </radialGradient>
                {/* Arcilla del infield */}
                <radialGradient id="infieldClay" cx="50%" cy="75%" r="60%">
                  <stop offset="0%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#92400e" />
                </radialGradient>
              </defs>

              {/* Terreno Exterior / Outfield Grass (Abanico de béisbol) */}
              <path
                d="M 120 180 A 380 380 0 0 1 680 180 L 400 460 Z"
                fill="url(#outfieldGrass)"
                stroke="#22c55e"
                strokeWidth="2"
                opacity="0.9"
              />

              {/* Barda de jonrón / Home Run Wall */}
              <path
                d="M 120 180 A 380 380 0 0 1 680 180"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="4"
                strokeDasharray="6 4"
              />

              {/* Cuadrante de Arcilla del Infield */}
              <path
                d="M 280 340 L 400 220 L 520 340 L 400 460 Z"
                fill="url(#infieldClay)"
                stroke="#f59e0b"
                strokeWidth="2"
              />

              {/* Pasto interior del diamante */}
              <path
                d="M 320 340 L 400 260 L 480 340 L 400 420 Z"
                fill="#15803d"
                stroke="#86efac"
                strokeWidth="1.5"
              />

              {/* Líneas de Cal (Foul lines) */}
              <line x1="400" y1="460" x2="115" y2="175" stroke="#ffffff" strokeWidth="2.5" strokeOpacity="0.8" />
              <line x1="400" y1="460" x2="685" y2="175" stroke="#ffffff" strokeWidth="2.5" strokeOpacity="0.8" />

              {/* Montículo del Pitcher */}
              <circle cx="400" cy="340" r="14" fill="#b45309" stroke="#ffffff" strokeWidth="1.5" />
              <rect x="395" y="338" width="10" height="3" fill="#ffffff" />

              {/* Bases */}
              {/* Home Plate */}
              <polygon points="400,466 394,460 394,453 406,453 406,460" fill="#ffffff" />
              {/* Primera Base */}
              <rect x="475" y="335" width="10" height="10" fill="#ffffff" transform="rotate(45 480 340)" />
              {/* Segunda Base */}
              <rect x="395" y="255" width="10" height="10" fill="#ffffff" transform="rotate(45 400 260)" />
              {/* Tercera Base */}
              <rect x="315" y="335" width="10" height="10" fill="#ffffff" transform="rotate(45 320 340)" />

              {/* Texto en terreno de juego */}
              <text x="400" y="200" fill="#ffffff" opacity="0.6" fontSize="13" fontWeight="bold" textAnchor="middle" letterSpacing="2">
                JARDÍN CENTRAL
              </text>
              <text x="250" y="240" fill="#ffffff" opacity="0.4" fontSize="11" fontWeight="bold" textAnchor="middle">
                JARDÍN IZQ.
              </text>
              <text x="550" y="240" fill="#ffffff" opacity="0.4" fontSize="11" fontWeight="bold" textAnchor="middle">
                JARDÍN DER.
              </text>

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
                  const secData = sections.find((s) => s.sectionNumber === pos.num);
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

              {/* Indicador de Home Plate en SVG */}
              <text x="400" y="445" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">
                HOME
              </text>
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
                const zoneMeta = MARISCAL_ZONES[sec.zoneName] || MARISCAL_ZONES['Plus'];

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
                      style={{ backgroundColor: zoneMeta.colorHex }}
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
                        backgroundColor:
                          MARISCAL_ZONES[currentSection.zoneName]?.colorHex || '#D97706',
                      }}
                    ></span>
                    <h3 className="text-base font-black text-slate-900">
                      Sección {currentSection.sectionNumber}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                      {currentSection.zoneName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {MARISCAL_ZONES[currentSection.zoneName]?.description ||
                      'Excelente visibilidad del diamante'}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Precio</span>
                  <span className="text-base sm:text-lg font-black text-red-900">
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
