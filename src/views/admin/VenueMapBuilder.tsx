import React, { useState, useEffect, useMemo } from 'react';
import { Venue, VenueLayoutShape, VenueZone, SeatSection } from '../../types';
import { getAllVenues, updateVenue } from '../../lib/venues';
import {
  subscribeVenueZones,
  createVenueZone,
  updateVenueZone,
  deleteVenueZone,
  saveVenueLayoutShape,
} from '../../lib/venueZones';
import {
  getSeatSectionsForVenue,
  createSeatSection,
  createBulkSeatSections,
  updateSeatSection,
  deleteSeatSection,
} from '../../lib/seatMap';
import { generateSeatMapLayout } from '../../lib/venueLayoutEngine';
import { LoadingSpinner } from '../../components/shared/LoadingSpinner';
import {
  Layers,
  MapPin,
  Palette,
  Plus,
  Trash2,
  Edit2,
  Check,
  ChevronRight,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Building,
  Save,
  Grid,
  Info,
} from 'lucide-react';

interface VenueMapBuilderProps {
  initialVenueId?: string;
  onClose?: () => void;
}

const COLOR_PRESETS = [
  '#D97706', // Amber (Deluxe)
  '#6366F1', // Indigo (Sky)
  '#3B82F6', // Blue (Plus)
  '#0284C7', // Sky Blue
  '#10B981', // Emerald
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#F59E0B', // Yellow/Gold (Oro)
  '#E11D48', // Rose/Red (Platino)
  '#64748B', // Slate
];

export const VenueMapBuilder: React.FC<VenueMapBuilderProps> = ({
  initialVenueId,
}) => {
  // Sede seleccionada
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>(initialVenueId || '');
  const [loadingVenues, setLoadingVenues] = useState(true);

  // Pasos del Wizard: 1 = Forma/Config, 2 = Zonas, 3 = Secciones
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Estado de la Sede seleccionada
  const selectedVenue = useMemo(
    () => venues.find((v) => v.id === selectedVenueId),
    [venues, selectedVenueId]
  );

  // Configuración de Forma
  const [layoutShape, setLayoutShape] = useState<VenueLayoutShape>('baseball_horseshoe');
  const [savingVenueConfig, setSavingVenueConfig] = useState(false);

  // Zonas de la Sede
  const [zones, setZones] = useState<VenueZone[]>([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [editingZone, setEditingZone] = useState<VenueZone | null>(null);
  const [zoneForm, setZoneForm] = useState({
    name: '',
    color: '#3B82F6',
    order: 1,
  });
  const [savingZone, setSavingZone] = useState(false);

  // Secciones de la Sede
  const [sections, setSections] = useState<SeatSection[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);

  // Herramienta Bulk Secciones
  const [bulkForm, setBulkForm] = useState({
    zoneId: '',
    ring: 'Nivel 100',
    prefix: '',
    startNum: 1,
    endNum: 12,
    rowsPerSection: 3,
    seatsPerRow: 10,
  });
  const [generatingBulk, setGeneratingBulk] = useState(false);

  // Sección individual
  const [singleSecForm, setSingleSecForm] = useState({
    sectionNumber: '',
    zoneId: '',
    ring: 'Nivel 100',
    rowsCount: 3,
    seatsPerRow: 10,
  });
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [showSingleModal, setShowSingleModal] = useState(false);

  // Feedback y Notificaciones
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Cargar sedes disponibles
  const loadVenues = async () => {
    setLoadingVenues(true);
    try {
      const list = await getAllVenues();
      setVenues(list);
      if (!selectedVenueId && list.length > 0) {
        setSelectedVenueId(list[0].id);
      }
    } catch (err) {
      console.error('Error cargando sedes en VenueMapBuilder:', err);
      setNotification({ type: 'error', message: 'No se pudieron cargar las sedes' });
    } finally {
      setLoadingVenues(false);
    }
  };

  useEffect(() => {
    loadVenues();
  }, []);

  // Actualizar layoutShape local cuando cambia la sede seleccionada
  useEffect(() => {
    if (selectedVenue) {
      setLayoutShape(selectedVenue.layoutShape || 'baseball_horseshoe');
    }
  }, [selectedVenue]);

  // Suscribirse a zonas de la sede seleccionada
  useEffect(() => {
    if (!selectedVenueId) {
      setZones([]);
      return;
    }
    setLoadingZones(true);
    const unsubscribe = subscribeVenueZones(selectedVenueId, (data) => {
      setZones(data);
      setLoadingZones(false);
      // Preseleccionar zona para bulk si no hay seleccionada
      if (data.length > 0 && !bulkForm.zoneId) {
        setBulkForm((prev) => ({ ...prev, zoneId: data[0].id }));
      }
    });

    return () => unsubscribe();
  }, [selectedVenueId]);

  // Cargar secciones de la sede
  const loadSections = async () => {
    if (!selectedVenueId) return;
    setLoadingSections(true);
    try {
      const data = await getSeatSectionsForVenue(selectedVenueId);
      setSections(data);
    } catch (err) {
      console.error('Error cargando secciones:', err);
    } finally {
      setLoadingSections(false);
    }
  };

  useEffect(() => {
    loadSections();
  }, [selectedVenueId]);

  // Mapa de zonas por id para acceso rápido
  const zonesMap = useMemo(() => {
    const m: Record<string, VenueZone> = {};
    zones.forEach((z) => {
      m[z.id] = z;
    });
    return m;
  }, [zones]);

  // Cálculo en tiempo real de las posiciones visuales SVG
  const visualLayoutPositions = useMemo(() => {
    return generateSeatMapLayout(layoutShape, sections, zonesMap);
  }, [layoutShape, sections, zonesMap]);

  // Guardar configuración de sede (Paso 1)
  const handleSaveShape = async () => {
    if (!selectedVenueId) return;
    setSavingVenueConfig(true);
    try {
      await saveVenueLayoutShape(selectedVenueId, layoutShape);
      await updateVenue(selectedVenueId, { layoutShape });
      setNotification({
        type: 'success',
        message: `Arquitectura actualizada a: ${
          layoutShape === 'baseball_horseshoe'
            ? 'Béisbol / Herradura'
            : layoutShape === 'rectangular_bowl'
            ? 'Rectangular / Estadio de Fútbol'
            : 'Teatro / Auditorio en Abanico'
        }`,
      });
      // Actualizar en el estado local de venues
      setVenues((prev) =>
        prev.map((v) => (v.id === selectedVenueId ? { ...v, layoutShape } : v))
      );
    } catch (err) {
      console.error('Error guardando forma de sede:', err);
      setNotification({ type: 'error', message: 'Error al actualizar la arquitectura' });
    } finally {
      setSavingVenueConfig(false);
    }
  };

  // Crear o Editar Zona (Paso 2)
  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVenueId || !zoneForm.name.trim()) return;

    setSavingZone(true);
    try {
      if (editingZone) {
        await updateVenueZone(editingZone.id, {
          name: zoneForm.name.trim(),
          color: zoneForm.color,
          order: Number(zoneForm.order) || 1,
        });
        setNotification({ type: 'success', message: 'Zona actualizada' });
      } else {
        await createVenueZone(selectedVenueId, {
          name: zoneForm.name.trim(),
          color: zoneForm.color,
          order: Number(zoneForm.order) || (zones.length + 1),
        });
        setNotification({ type: 'success', message: 'Zona creada exitosamente' });
      }
      setEditingZone(null);
      setZoneForm({ name: '', color: '#3B82F6', order: zones.length + 2 });
    } catch (err) {
      console.error('Error guardando zona:', err);
      setNotification({ type: 'error', message: 'No se pudo guardar la zona' });
    } finally {
      setSavingZone(false);
    }
  };

  const handleEditZone = (zone: VenueZone) => {
    setEditingZone(zone);
    setZoneForm({
      name: zone.name,
      color: zone.color,
      order: zone.order,
    });
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta zona de precios?')) return;
    try {
      await deleteVenueZone(zoneId);
      setNotification({ type: 'info', message: 'Zona eliminada' });
      if (editingZone?.id === zoneId) {
        setEditingZone(null);
        setZoneForm({ name: '', color: '#3B82F6', order: 1 });
      }
    } catch (err) {
      console.error('Error eliminando zona:', err);
      setNotification({ type: 'error', message: 'No se pudo eliminar la zona' });
    }
  };

  // Generar Secciones en Lote (Paso 3)
  const handleGenerateBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVenueId) return;

    const start = Number(bulkForm.startNum);
    const end = Number(bulkForm.endNum);
    if (isNaN(start) || isNaN(end) || start > end) {
      setNotification({ type: 'error', message: 'Rango de números inválido' });
      return;
    }

    const count = end - start + 1;
    if (count > 100) {
      setNotification({ type: 'error', message: 'El lote máximo permitido es de 100 secciones por llamada' });
      return;
    }

    const targetZone = zonesMap[bulkForm.zoneId];
    const zoneName = targetZone?.name || 'General';

    setGeneratingBulk(true);
    try {
      const rows = Number(bulkForm.rowsPerSection) || 3;
      const seatsPerRow = Number(bulkForm.seatsPerRow) || 10;
      await createBulkSeatSections(selectedVenueId, {
        startNum: start,
        endNum: end,
        prefix: bulkForm.prefix.trim(),
        zoneId: bulkForm.zoneId,
        zoneName,
        ring: bulkForm.ring.trim() || 'Principal',
        rows,
        seatsPerRow,
        totalSeats: rows * seatsPerRow,
      });
      setNotification({
        type: 'success',
        message: `¡Se crearon ${count} secciones exitosamente!`,
      });
      await loadSections();
    } catch (err) {
      console.error('Error creando secciones en lote:', err);
      setNotification({ type: 'error', message: 'Error al generar las secciones' });
    } finally {
      setGeneratingBulk(false);
    }
  };

  // Eliminar sección individual
  const handleDeleteSection = async (sectionId: string) => {
    if (!window.confirm('¿Eliminar esta sección física?')) return;
    try {
      await deleteSeatSection(sectionId);
      setSections((prev) => prev.filter((s) => s.id !== sectionId));
      setNotification({ type: 'info', message: 'Sección eliminada' });
    } catch (err) {
      console.error('Error eliminando sección:', err);
      setNotification({ type: 'error', message: 'No se pudo eliminar la sección' });
    }
  };

  // Crear o Editar sección individual
  const handleSaveSingleSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVenueId || !singleSecForm.sectionNumber.trim()) return;

    const targetZone = zonesMap[singleSecForm.zoneId];
    const zoneName = targetZone?.name || 'General';
    const rows = Number(singleSecForm.rowsCount) || 3;
    const seatsPerRow = Number(singleSecForm.seatsPerRow) || 10;

    try {
      if (editingSectionId) {
        await updateSeatSection(editingSectionId, {
          sectionNumber: singleSecForm.sectionNumber.trim(),
          zoneId: singleSecForm.zoneId || undefined,
          zoneName,
          ring: singleSecForm.ring.trim() || 'Principal',
          rows,
          seatsPerRow,
          totalSeats: rows * seatsPerRow,
        });
        setNotification({ type: 'success', message: 'Sección actualizada' });
      } else {
        await createSeatSection(selectedVenueId, {
          sectionNumber: singleSecForm.sectionNumber.trim(),
          zoneId: singleSecForm.zoneId || undefined,
          zoneName,
          ring: singleSecForm.ring.trim() || 'Principal',
          order: sections.length + 1,
          rows,
          seatsPerRow,
          totalSeats: rows * seatsPerRow,
        });
        setNotification({ type: 'success', message: 'Sección individual creada' });
      }
      setShowSingleModal(false);
      setEditingSectionId(null);
      setSingleSecForm({
        sectionNumber: '',
        zoneId: zones[0]?.id || '',
        ring: 'Nivel 100',
        rowsCount: 3,
        seatsPerRow: 10,
      });
      await loadSections();
    } catch (err) {
      console.error('Error guardando sección individual:', err);
      setNotification({ type: 'error', message: 'Error al guardar la sección' });
    }
  };

  if (loadingVenues) {
    return (
      <div className="p-12 flex justify-center items-center">
        <LoadingSpinner message="Cargando configuración de recintos..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Encabezado Principal y Selector de Sede */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-red-100 text-red-700 rounded-2xl">
              <Building className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Constructor de Mapas de Asientos
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
              Personalizable
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
            Diseña y captura la arquitectura física de cualquier estadio o recinto deportivo:
            forma del mapa, zonas tarifarias y distribución por secciones sin programar código.
          </p>
        </div>

        {/* Selector de Sede Activa */}
        <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200 shrink-0">
          <MapPin className="w-4 h-4 text-slate-400" />
          <div className="flex flex-col">
            <label htmlFor="venue-select" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Sede a Construir:
            </label>
            <select
              id="venue-select"
              value={selectedVenueId}
              onChange={(e) => setSelectedVenueId(e.target.value)}
              className="text-xs font-black text-slate-900 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
            >
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.city || 'Sinaloa'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Banner de Notificaciones */}
      {notification && (
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold border transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : notification.type === 'error'
              ? 'bg-red-50 text-red-900 border-red-200'
              : 'bg-blue-50 text-blue-900 border-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 font-bold px-2 py-0.5 rounded-lg"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navegación del Asistente en 3 Pasos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          onClick={() => setCurrentStep(1)}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
            currentStep === 1
              ? 'bg-red-900 text-white border-red-900 shadow-md ring-2 ring-red-900/20'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                currentStep === 1 ? 'bg-white text-red-900' : 'bg-slate-100 text-slate-700'
              }`}
            >
              1
            </span>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider">Paso 1: Arquitectura</h4>
              <p
                className={`text-[11px] ${
                  currentStep === 1 ? 'text-red-200' : 'text-slate-400'
                }`}
              >
                Forma y trazo geométrico del estadio
              </p>
            </div>
          </div>
          <ChevronRight
            className={`w-4 h-4 ${currentStep === 1 ? 'text-white' : 'text-slate-300'}`}
          />
        </button>

        <button
          onClick={() => setCurrentStep(2)}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
            currentStep === 2
              ? 'bg-red-900 text-white border-red-900 shadow-md ring-2 ring-red-900/20'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                currentStep === 2 ? 'bg-white text-red-900' : 'bg-slate-100 text-slate-700'
              }`}
            >
              2
            </span>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider">Paso 2: Zonas</h4>
              <p
                className={`text-[11px] ${
                  currentStep === 2 ? 'text-red-200' : 'text-slate-400'
                }`}
              >
                {zones.length} zonas tarifarias configuradas
              </p>
            </div>
          </div>
          <ChevronRight
            className={`w-4 h-4 ${currentStep === 2 ? 'text-white' : 'text-slate-300'}`}
          />
        </button>

        <button
          onClick={() => setCurrentStep(3)}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
            currentStep === 3
              ? 'bg-red-900 text-white border-red-900 shadow-md ring-2 ring-red-900/20'
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                currentStep === 3 ? 'bg-white text-red-900' : 'bg-slate-100 text-slate-700'
              }`}
            >
              3
            </span>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider">Paso 3: Secciones</h4>
              <p
                className={`text-[11px] ${
                  currentStep === 3 ? 'text-red-200' : 'text-slate-400'
                }`}
              >
                {sections.length} secciones capturadas
              </p>
            </div>
          </div>
          <ChevronRight
            className={`w-4 h-4 ${currentStep === 3 ? 'text-white' : 'text-slate-300'}`}
          />
        </button>
      </div>

      {/* CONTENIDO DEL PASO 1: ARQUITECTURA / FORMA GEOMÉTRICA */}
      {currentStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Selecciona la Geometría Base del Recinto
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  El motor de trazado distribuirá las secciones automáticamente adaptándose a la
                  morfología del campo deportivo o escenario.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Opción 1: Béisbol / Herradura */}
                <div
                  onClick={() => setLayoutShape('baseball_horseshoe')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                    layoutShape === 'baseball_horseshoe'
                      ? 'border-red-600 bg-red-50/50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Esquema SVG en miniatura */}
                    <div className="w-full h-28 bg-slate-900 rounded-xl flex items-center justify-center p-2">
                      <svg viewBox="0 0 100 80" className="w-full h-full">
                        {/* Diamante central */}
                        <polygon points="50,60 40,50 50,40 60,50" fill="#22c55e" />
                        {/* Gradas en herradura */}
                        <path
                          d="M 20,25 C 20,10 80,10 80,25 C 85,55 70,75 55,75"
                          fill="none"
                          stroke="#fbbf24"
                          strokeWidth="6"
                          strokeDasharray="4 2"
                        />
                      </svg>
                    </div>
                    <h4 className="text-xs font-black text-slate-900">Béisbol / Herradura</h4>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Curva semicircular con apertura hacia el outfield (ideal para Mariscal y diamantes).
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      baseball_horseshoe
                    </span>
                    {layoutShape === 'baseball_horseshoe' && (
                      <span className="p-1 rounded-full bg-red-600 text-white">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Opción 2: Rectangular Bowl (Fútbol) */}
                <div
                  onClick={() => setLayoutShape('rectangular_bowl')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                    layoutShape === 'rectangular_bowl'
                      ? 'border-red-600 bg-red-50/50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Esquema SVG en miniatura */}
                    <div className="w-full h-28 bg-slate-900 rounded-xl flex items-center justify-center p-2">
                      <svg viewBox="0 0 100 80" className="w-full h-full">
                        {/* Cancha central */}
                        <rect x="30" y="25" width="40" height="30" rx="2" fill="#16a34a" />
                        <line x1="50" y1="25" x2="50" y2="55" stroke="#ffffff" strokeWidth="1" />
                        <circle cx="50" cy="40" r="6" fill="none" stroke="#ffffff" strokeWidth="1" />
                        {/* 4 Tribunas */}
                        <rect x="25" y="10" width="50" height="8" rx="2" fill="#38bdf8" />
                        <rect x="25" y="62" width="50" height="8" rx="2" fill="#38bdf8" />
                        <rect x="12" y="22" width="10" height="36" rx="2" fill="#38bdf8" />
                        <rect x="78" y="22" width="10" height="36" rx="2" fill="#38bdf8" />
                      </svg>
                    </div>
                    <h4 className="text-xs font-black text-slate-900">Rectangular / Fútbol</h4>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Cancha central con 4 frentes: Norte, Sur, Oriente y Poniente (ideal para El Encanto).
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      rectangular_bowl
                    </span>
                    {layoutShape === 'rectangular_bowl' && (
                      <span className="p-1 rounded-full bg-red-600 text-white">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Opción 3: Teatro / Abanico */}
                <div
                  onClick={() => setLayoutShape('fan_theater')}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                    layoutShape === 'fan_theater'
                      ? 'border-red-600 bg-red-50/50 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Esquema SVG en miniatura */}
                    <div className="w-full h-28 bg-slate-900 rounded-xl flex items-center justify-center p-2">
                      <svg viewBox="0 0 100 80" className="w-full h-full">
                        {/* Escenario */}
                        <rect x="30" y="65" width="40" height="8" rx="2" fill="#e11d48" />
                        {/* Filas concéntricas en abanico */}
                        <path d="M 25,50 A 30 30 0 0 1 75,50" fill="none" stroke="#a855f7" strokeWidth="4" />
                        <path d="M 15,35 A 45 45 0 0 1 85,35" fill="none" stroke="#a855f7" strokeWidth="4" />
                        <path d="M 5,20 A 60 60 0 0 1 95,20" fill="none" stroke="#a855f7" strokeWidth="4" />
                      </svg>
                    </div>
                    <h4 className="text-xs font-black text-slate-900">Teatro / Abanico</h4>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Gradas radiales concéntricas frente a escenario para auditorios y conciertos.
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      fan_theater
                    </span>
                    {layoutShape === 'fan_theater' && (
                      <span className="p-1 rounded-full bg-red-600 text-white">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Botón Guardar Paso 1 */}
              <div className="flex justify-end pt-3">
                <button
                  onClick={handleSaveShape}
                  disabled={savingVenueConfig}
                  className="px-5 py-2.5 bg-red-900 text-white rounded-xl text-xs font-black flex items-center gap-2 hover:bg-red-950 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {savingVenueConfig ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Guardar Arquitectura</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tarjeta de Resumen de la Sede */}
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Datos de la Sede Actual
            </h4>
            <div className="space-y-3 text-xs">
              <div className="bg-white p-3 rounded-2xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Nombre</span>
                <span className="text-sm font-bold text-slate-900">{selectedVenue?.name}</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Ubicación</span>
                <span className="font-semibold text-slate-800">
                  {selectedVenue?.city || 'Mazatlán'}, {selectedVenue?.state || 'Sinaloa'}
                </span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">ID Firestore</span>
                <span className="font-mono text-slate-500">{selectedVenue?.id}</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Zonas Creadas</span>
                <span className="font-black text-slate-900">{zones.length} zonas</span>
              </div>
              <div className="bg-white p-3 rounded-2xl border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Secciones Registradas</span>
                <span className="font-black text-slate-900">{sections.length} secciones</span>
              </div>
            </div>

            <button
              onClick={() => setCurrentStep(2)}
              className="w-full py-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl text-xs font-black flex items-center justify-center gap-2 hover:bg-slate-100 transition-all cursor-pointer"
            >
              <span>Continuar al Paso 2: Zonas</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* CONTENIDO DEL PASO 2: ZONAS TARIFARIAS (VenueZone) */}
      {currentStep === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario de Agregar / Editar Zona */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
            <div>
              <h3 className="text-base font-black text-slate-900">
                {editingZone ? 'Editar Zona de Precios' : 'Nueva Zona de Precios'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Define categorías como "Diamante", "Cabecera", "Platino" o "Grada General" con su color identificador.
              </p>
            </div>

            <form onSubmit={handleSaveZone} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Nombre de la Zona *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Cabecera Norte, Diamante, Palcos..."
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/30"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Color Representativo en el Mapa
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={zoneForm.color}
                    onChange={(e) => setZoneForm({ ...zoneForm, color: e.target.value })}
                    className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer p-0.5 bg-white"
                  />
                  <input
                    type="text"
                    value={zoneForm.color}
                    onChange={(e) => setZoneForm({ ...zoneForm, color: e.target.value })}
                    className="w-28 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold uppercase"
                  />
                  <span
                    className="w-5 h-5 rounded-full border border-slate-300 shadow-xs"
                    style={{ backgroundColor: zoneForm.color }}
                  ></span>
                </div>

                {/* Swatches rápidos */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {COLOR_PRESETS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setZoneForm({ ...zoneForm, color: hex })}
                      className="w-6 h-6 rounded-lg border border-slate-300 transition-transform hover:scale-110 cursor-pointer"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Orden de Visualización
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={zoneForm.order}
                  onChange={(e) => setZoneForm({ ...zoneForm, order: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Determina el orden de aparición en leyendas y listados de compra.
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingZone}
                  className="flex-1 py-2.5 bg-red-900 text-white rounded-xl text-xs font-black hover:bg-red-950 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {savingZone ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : editingZone ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>{editingZone ? 'Actualizar Zona' : 'Agregar Zona'}</span>
                </button>

                {editingZone && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingZone(null);
                      setZoneForm({ name: '', color: '#3B82F6', order: zones.length + 1 });
                    }}
                    className="px-3 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Lista de Zonas Creadas */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Zonas Definidas ({zones.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Zonas configuradas para {selectedVenue?.name}
                </p>
              </div>

              <button
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black flex items-center gap-1.5 hover:bg-slate-800 transition-all cursor-pointer"
              >
                <span>Ir al Paso 3: Secciones</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {loadingZones ? (
              <div className="py-8 text-center text-xs text-slate-400">Cargando zonas...</div>
            ) : zones.length === 0 ? (
              <div className="p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center space-y-2">
                <Palette className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">Aún no hay zonas configuradas</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Utiliza el formulario de la izquierda para agregar la primera zona tarifaria de esta sede.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
                {zones.map((z) => {
                  const zoneSectionsCount = sections.filter(
                    (s) => s.zoneId === z.id || s.zoneName === z.name
                  ).length;

                  return (
                    <div
                      key={z.id}
                      className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                          style={{ backgroundColor: z.color }}
                        ></span>
                        <div>
                          <h4 className="text-xs font-black text-slate-900">{z.name}</h4>
                          <span className="text-[10px] text-slate-500">
                            Orden #{z.order} • {zoneSectionsCount} secciones
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditZone(z)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200 transition-all cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteZone(z.id)}
                          className="p-1.5 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO DEL PASO 3: SECCIONES Y PREVIEW EN TIEMPO REAL */}
      {currentStep === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna Izquierda: Generador en lote y acciones rápidas (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Generador en Lote */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    Captura en Lote de Secciones
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Crea rápidamente un bloque de secciones consecutivas.
                  </p>
                </div>

                <button
                  onClick={() => setShowSingleModal(true)}
                  className="text-[11px] font-bold text-red-700 hover:text-red-900 underline cursor-pointer"
                >
                  + Una individual
                </button>
              </div>

              {zones.length === 0 ? (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-800 space-y-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <p className="font-bold">Debes crear al menos una Zona de Precios primero.</p>
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="px-3 py-1 bg-amber-600 text-white rounded-lg font-bold text-[11px] hover:bg-amber-700 cursor-pointer"
                  >
                    Ir al Paso 2: Crear Zonas
                  </button>
                </div>
              ) : (
                <form onSubmit={handleGenerateBulk} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Zona Asignada *
                      </label>
                      <select
                        value={bulkForm.zoneId}
                        onChange={(e) => setBulkForm({ ...bulkForm, zoneId: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                      >
                        {zones.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Anillo / Nivel *
                      </label>
                      <input
                        type="text"
                        placeholder="Nivel 100, Grada Norte..."
                        value={bulkForm.ring}
                        onChange={(e) => setBulkForm({ ...bulkForm, ring: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Prefijo (opc)
                      </label>
                      <input
                        type="text"
                        placeholder="ej. Norte-, Sec-"
                        value={bulkForm.prefix}
                        onChange={(e) => setBulkForm({ ...bulkForm, prefix: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Inicio *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={bulkForm.startNum}
                        onChange={(e) =>
                          setBulkForm({ ...bulkForm, startNum: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Fin *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={bulkForm.endNum}
                        onChange={(e) =>
                          setBulkForm({ ...bulkForm, endNum: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Filas por Sección
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={bulkForm.rowsPerSection}
                        onChange={(e) =>
                          setBulkForm({ ...bulkForm, rowsPerSection: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Butacas por Fila
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={bulkForm.seatsPerRow}
                        onChange={(e) =>
                          setBulkForm({ ...bulkForm, seatsPerRow: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Resumen del Lote */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                    <span>
                      Total:{' '}
                      <strong className="text-slate-900">
                        {Math.max(0, bulkForm.endNum - bulkForm.startNum + 1)} secciones
                      </strong>{' '}
                      (
                      {Math.max(0, bulkForm.endNum - bulkForm.startNum + 1) *
                        bulkForm.rowsPerSection *
                        bulkForm.seatsPerRow}{' '}
                      butacas)
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {bulkForm.prefix}
                      {bulkForm.startNum} .. {bulkForm.prefix}
                      {bulkForm.endNum}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={generatingBulk}
                    className="w-full py-2.5 bg-red-900 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 hover:bg-red-950 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {generatingBulk ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    <span>
                      Generar {Math.max(0, bulkForm.endNum - bulkForm.startNum + 1)} Secciones en Firestore
                    </span>
                  </button>
                </form>
              )}
            </div>

            {/* Listado / Explorador de Secciones Registradas */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Secciones en Firestore ({sections.length})
                </h4>
                <button
                  onClick={loadSections}
                  disabled={loadingSections}
                  className="text-[11px] text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingSections ? 'animate-spin' : ''}`} />
                  <span>Recargar</span>
                </button>
              </div>

              {loadingSections ? (
                <div className="py-6 text-center text-xs text-slate-400">Cargando secciones...</div>
              ) : sections.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No hay secciones registradas aún para este recinto.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {sections.map((sec) => {
                    const zone = zonesMap[sec.zoneId || ''] || zones.find((z) => z.name === sec.zoneName);
                    const color = zone?.color || '#3B82F6';

                    return (
                      <div
                        key={sec.id}
                        className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs hover:bg-slate-100 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: color }}
                          ></span>
                          <span className="font-black text-slate-900">
                            Sec. {sec.sectionNumber}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            ({sec.zoneName || zone?.name}) • {sec.ring || 'N/A'} • {sec.totalSeats || 30} butacas
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteSection(sec.id)}
                          className="text-slate-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
                          title="Eliminar sección"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Columna Derecha: Vista Previa Dinámica en Tiempo Real (7 cols) */}
          <div className="lg:col-span-7 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Grid className="w-4 h-4 text-slate-700" />
                  Previsualización en Tiempo Real del Mapa
                </h3>
                <p className="text-[11px] text-slate-500">
                  Forma:{' '}
                  <strong className="text-slate-800">
                    {layoutShape === 'baseball_horseshoe'
                      ? 'Béisbol / Herradura'
                      : layoutShape === 'rectangular_bowl'
                      ? 'Rectangular / Fútbol'
                      : 'Teatro / Auditorio'}
                  </strong>{' '}
                  • {visualLayoutPositions.length} bloques proyectados
                </p>
              </div>

              {/* Leyenda rápida */}
              <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                {zones.map((z) => (
                  <div key={z.id} className="flex items-center gap-1">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: z.color }}
                    ></span>
                    <span className="text-slate-600">{z.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Canvas SVG del Mapa Dinámico */}
            <div className="relative w-full aspect-[4/3] bg-radial from-slate-900 via-slate-950 to-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center p-2">
              <svg viewBox="0 0 800 620" className="w-full h-full select-none">
                {/* Gráfico de Campo de Fondo según Forma */}
                {layoutShape === 'baseball_horseshoe' && (
                  <g id="preview-field-baseball" opacity="0.45">
                    <path
                      d="M 270 230 C 270 120 530 120 530 230 L 400 370 Z"
                      fill="#1e293b"
                      stroke="#334155"
                      strokeWidth="2"
                    />
                    <polygon points="400,280 430,310 400,340 370,310" fill="#334155" />
                    <circle cx="400" cy="310" r="3" fill="#f8fafc" />
                  </g>
                )}

                {layoutShape === 'rectangular_bowl' && (
                  <g id="preview-field-soccer" opacity="0.45">
                    <rect
                      x="230"
                      y="190"
                      width="340"
                      height="230"
                      rx="8"
                      fill="#0f172a"
                      stroke="#334155"
                      strokeWidth="2"
                    />
                    <line x1="400" y1="190" x2="400" y2="420" stroke="#334155" strokeWidth="1.5" />
                    <circle cx="400" cy="305" r="45" fill="none" stroke="#334155" strokeWidth="1.5" />
                    <rect x="230" y="250" width="45" height="110" fill="none" stroke="#334155" strokeWidth="1.5" />
                    <rect x="525" y="250" width="45" height="110" fill="none" stroke="#334155" strokeWidth="1.5" />
                  </g>
                )}

                {layoutShape === 'fan_theater' && (
                  <g id="preview-field-theater" opacity="0.45">
                    <rect x="280" y="470" width="240" height="35" rx="6" fill="#e11d48" opacity="0.6" />
                    <text x="400" y="492" fill="#ffffff" fontSize="12" fontWeight="900" textAnchor="middle">
                      ESCENARIO / STAGE
                    </text>
                  </g>
                )}

                {/* Secciones Renderizadas Dinámicamente */}
                <g id="preview-sections">
                  {visualLayoutPositions.map((pos) => {
                    const zone = zonesMap[pos.zoneId || ''] || zones.find((z) => z.name === pos.zoneName);
                    const color = zone?.color || '#3B82F6';
                    const transform = pos.rotation
                      ? `rotate(${pos.rotation} ${pos.x + pos.width / 2} ${pos.y + pos.height / 2})`
                      : undefined;

                    return (
                      <g key={pos.sectionId || pos.sectionNumber} transform={transform}>
                        <rect
                          x={pos.x}
                          y={pos.y}
                          width={pos.width}
                          height={pos.height}
                          rx="4"
                          fill={color}
                          stroke="#0f172a"
                          strokeWidth="1.2"
                          opacity="0.9"
                        />
                        <text
                          x={pos.labelX}
                          y={pos.labelY}
                          fill="#ffffff"
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

              {/* Overlay cuando no hay secciones */}
              {visualLayoutPositions.length === 0 && (
                <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center space-y-2">
                  <Grid className="w-10 h-10 text-slate-500" />
                  <p className="text-xs font-black text-slate-200">
                    Sin secciones en el mapa
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    Utiliza la herramienta de la izquierda para generar secciones. Se dibujarán
                    en este lienzo en tiempo real conforme a la forma del estadio.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span>
                Capacidad aproximada mapeada:{' '}
                <strong className="text-slate-900 font-bold">
                  {sections.reduce((acc, s) => acc + (s.totalSeats || 30), 0)} butacas
                </strong>
              </span>
              <span className="text-slate-400">
                Los aficionados verán este mapa al comprar boletos para eventos en esta sede.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SECCIÓN INDIVIDUAL */}
      {showSingleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-sm font-black text-slate-900">
                {editingSectionId ? 'Editar Sección' : 'Agregar Sección Individual'}
              </h4>
              <button
                onClick={() => {
                  setShowSingleModal(false);
                  setEditingSectionId(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSingleSection} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Número / Código de Sección *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. 101, VIP-1, Poniente-A"
                  value={singleSecForm.sectionNumber}
                  onChange={(e) =>
                    setSingleSecForm({ ...singleSecForm, sectionNumber: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Zona Asignada *
                  </label>
                  <select
                    value={singleSecForm.zoneId}
                    onChange={(e) =>
                      setSingleSecForm({ ...singleSecForm, zoneId: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none"
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Anillo / Nivel
                  </label>
                  <input
                    type="text"
                    value={singleSecForm.ring}
                    onChange={(e) =>
                      setSingleSecForm({ ...singleSecForm, ring: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Filas
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={singleSecForm.rowsCount}
                    onChange={(e) =>
                      setSingleSecForm({ ...singleSecForm, rowsCount: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Butacas por Fila
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={singleSecForm.seatsPerRow}
                    onChange={(e) =>
                      setSingleSecForm({ ...singleSecForm, seatsPerRow: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSingleModal(false);
                    setEditingSectionId(null);
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-red-900 text-white rounded-xl text-xs font-black hover:bg-red-950 cursor-pointer shadow-xs"
                >
                  Guardar Sección
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
