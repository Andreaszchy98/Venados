import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, VenueEvent, GameScoreboard, ScoreboardSport } from '../../types';
import { subscribeVenueEvents } from '../../lib/venueEvents';
import { DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import {
  subscribeScoreboard,
  createScoreboard,
  startGame,
  finalizeGame,
  updateGameState,
  addRun,
  decrementRun,
  advanceInning,
  markOut,
  markBall,
  markStrike,
  resetCount,
  updateHitsErrors,
  addGoal,
  removeGoal,
  addCard,
  removeCard,
  advanceHalf,
  updateMinute,
} from '../../lib/scoreboard';
import {
  Radio,
  Play,
  CheckCircle2,
  RotateCcw,
  ArrowRight,
  Plus,
  Minus,
  Sparkles,
  AlertCircle,
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  ChevronRight,
  X,
  Trash2,
  Layers,
  Activity,
  Flame,
  Shield,
  Eye,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface MarcadorControlProps {
  user: UserProfile;
  initialEventId?: string | null;
  onViewFanScoreboard?: (eventId: string) => void;
}

export const MarcadorControl: React.FC<MarcadorControlProps> = ({
  user,
  initialEventId,
  onViewFanScoreboard,
}) => {
  const { theme } = useTheme();
  const currentVenueId = user.venueId || DEFAULT_VENUE_ID;

  // Lista de eventos de la sede
  const [events, setEvents] = useState<VenueEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Evento seleccionado
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEventId || null);

  // Marcador en vivo del evento seleccionado
  const [scoreboard, setScoreboard] = useState<GameScoreboard | null>(null);
  const [loadingScoreboard, setLoadingScoreboard] = useState(false);
  const [creatingScoreboard, setCreatingScoreboard] = useState(false);

  // Modales rápidos de captura para Fútbol
  const [goalModal, setGoalModal] = useState<{
    open: boolean;
    team: 'home' | 'away';
    playerName: string;
    minute: number;
  }>({
    open: false,
    team: 'home',
    playerName: '',
    minute: 1,
  });

  const [cardModal, setCardModal] = useState<{
    open: boolean;
    team: 'home' | 'away';
    type: 'amarilla' | 'roja';
    playerName: string;
    minute: number;
  }>({
    open: false,
    team: 'home',
    type: 'amarilla',
    playerName: '',
    minute: 1,
  });

  // Mensaje temporal de feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Cargar eventos de la sede (Solo baseball y football según requerimiento explícito)
  useEffect(() => {
    setLoadingEvents(true);
    const unsubscribe = subscribeVenueEvents(
      currentVenueId,
      (loadedEvents) => {
        // Filtrar exclusivamente baseball y football (excluir conciertos y basketball)
        const sportEvents = loadedEvents.filter(
          (ev) => ev.type === 'baseball' || ev.type === 'football'
        );
        setEvents(sportEvents);
        setLoadingEvents(false);

        // Si no hay evento seleccionado, seleccionar el primero disponible
        if (!selectedEventId && sportEvents.length > 0) {
          setSelectedEventId(sportEvents[0].id);
        }
      },
      () => setLoadingEvents(false)
    );

    return () => unsubscribe();
  }, [currentVenueId, selectedEventId]);

  // Si cambia initialEventId desde props
  useEffect(() => {
    if (initialEventId) {
      setSelectedEventId(initialEventId);
    }
  }, [initialEventId]);

  // Escuchar el marcador en tiempo real cuando cambia selectedEventId
  useEffect(() => {
    if (!selectedEventId) {
      setScoreboard(null);
      return;
    }

    setLoadingScoreboard(true);
    const unsubscribe = subscribeScoreboard(selectedEventId, (loadedScoreboard) => {
      setScoreboard(loadedScoreboard);
      setLoadingScoreboard(false);
    });

    return () => unsubscribe();
  }, [selectedEventId]);

  // Evento activo
  const activeEvent = useMemo(() => {
    return events.find((ev) => ev.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // Nombres de equipos sugeridos para el evento
  const teamNames = useMemo(() => {
    if (!activeEvent) {
      return { home: 'Local', away: 'Visitante' };
    }
    // Ej: "Venados de Mazatlán vs Tomateros de Culiacán" o "Mazatlán FC vs América"
    const parts = activeEvent.name.split(/\s+vs\.?\s+/i);
    if (parts.length >= 2) {
      return { home: parts[0].trim(), away: parts[1].trim() };
    }
    return {
      home: activeEvent.name,
      away: activeEvent.opponent || 'Visitante',
    };
  }, [activeEvent]);

  // Crear marcador para el evento
  const handleCreateScoreboard = async () => {
    if (!activeEvent) return;
    try {
      setCreatingScoreboard(true);
      const sport: ScoreboardSport = activeEvent.type === 'football' ? 'football' : 'baseball';
      await createScoreboard(
        activeEvent.id,
        currentVenueId,
        sport,
        teamNames.home,
        teamNames.away
      );
      showToast('¡Marcador inicializado correctamente!');
    } catch (error) {
      console.error('Error al crear marcador:', error);
      showToast('Error al inicializar el marcador');
    } finally {
      setCreatingScoreboard(false);
    }
  };

  // Acciones globales de estado
  const handleStartGame = async () => {
    if (!scoreboard) return;
    await startGame(scoreboard.eventId);
    showToast('🟢 ¡Partido iniciado! Estado cambiado a EN VIVO.');
  };

  const handleFinalizeGame = async () => {
    if (!scoreboard) return;
    await finalizeGame(scoreboard.eventId);
    showToast('🏁 Partido marcado como FINALIZADO.');
  };

  const handleSetProgramado = async () => {
    if (!scoreboard) return;
    await updateGameState(scoreboard.eventId, { status: 'programado' });
    showToast('Partido regresado a estado PROGRAMADO.');
  };

  // Abrir modal de gol con minuto actual
  const handleOpenGoalModal = (team: 'home' | 'away') => {
    const currentMin = scoreboard?.footballState?.minute || 1;
    setGoalModal({
      open: true,
      team,
      playerName: '',
      minute: Math.max(1, currentMin),
    });
  };

  const handleConfirmGoal = async () => {
    if (!scoreboard) return;
    await addGoal(scoreboard.eventId, goalModal.team, goalModal.playerName, goalModal.minute);
    setGoalModal((prev) => ({ ...prev, open: false, playerName: '' }));
    showToast(`⚽ ¡Gol de ${goalModal.team === 'home' ? scoreboard.homeTeamName : scoreboard.awayTeamName}!`);
  };

  // Abrir modal de tarjeta
  const handleOpenCardModal = (team: 'home' | 'away', type: 'amarilla' | 'roja') => {
    const currentMin = scoreboard?.footballState?.minute || 1;
    setCardModal({
      open: true,
      team,
      type,
      playerName: '',
      minute: Math.max(1, currentMin),
    });
  };

  const handleConfirmCard = async () => {
    if (!scoreboard) return;
    await addCard(
      scoreboard.eventId,
      cardModal.team,
      cardModal.playerName,
      cardModal.minute,
      cardModal.type
    );
    setCardModal((prev) => ({ ...prev, open: false, playerName: '' }));
    showToast(`Tarjeta ${cardModal.type} registrada.`);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-20 right-4 z-50 px-4 py-2.5 rounded-xl bg-slate-900 border border-amber-500/50 text-amber-300 text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Encabezado del Panel */}
      <div className={`p-4 sm:p-6 rounded-3xl border transition-all ${
        theme === 'light'
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-[#101625] border-slate-800 shadow-xl'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-red-600/10 text-red-500 border border-red-500/20">
                <Radio className="w-5 h-5 animate-pulse" />
              </span>
              <h1 className={`text-xl sm:text-2xl font-black font-sports tracking-wide uppercase ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}>
                Control de Marcador en Vivo
              </h1>
            </div>
            <p className={`text-xs sm:text-sm ${
              theme === 'light' ? 'text-slate-600' : 'text-slate-400'
            }`}>
              Captura táctil en tiempo real para partidos de Béisbol y Fútbol. Se sincroniza instantáneamente con la cartelera y el portal del aficionado.
            </p>
          </div>

          {/* Selector de Evento Deportivo */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-bold text-slate-400 sr-only" htmlFor="event-selector">
              Seleccionar partido
            </label>
            <select
              id="event-selector"
              value={selectedEventId || ''}
              onChange={(e) => setSelectedEventId(e.target.value)}
              disabled={loadingEvents || events.length === 0}
              className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 ${
                theme === 'light'
                  ? 'bg-slate-50 border-slate-300 text-slate-900'
                  : 'bg-[#182235] border-slate-700 text-slate-100'
              }`}
            >
              {events.length === 0 ? (
                <option value="">No hay partidos de béisbol/fútbol programados</option>
              ) : (
                events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.type === 'baseball' ? '⚾' : '⚽'} {ev.name} ({ev.date})
                  </option>
                ))
              )}
            </select>

            {scoreboard && (
              <button
                type="button"
                onClick={() => onViewFanScoreboard?.(scoreboard.eventId)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-sports font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Abrir vista aficionado en tiempo real"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Vista Aficionado</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Si no hay eventos de béisbol o fútbol */}
      {events.length === 0 && !loadingEvents && (
        <div className="p-8 rounded-3xl border border-dashed border-slate-700/80 bg-slate-900/40 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="text-sm font-black text-white font-sports uppercase tracking-wider">
            No hay partidos deportivos en esta sede
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Para utilizar el marcador en vivo, crea un evento deportivo de tipo <strong>Béisbol</strong> o <strong>Fútbol</strong> desde la sección de Eventos & Partidos.
          </p>
        </div>
      )}

      {/* Si hay evento pero aún NO tiene marcador inicializado */}
      {activeEvent && !scoreboard && !loadingScoreboard && (
        <div className={`p-8 rounded-3xl border text-center space-y-4 ${
          theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#101625] border-slate-800'
        }`}>
          <div className="w-16 h-16 mx-auto rounded-2xl bg-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 text-3xl">
            {activeEvent.type === 'baseball' ? '⚾' : '⚽'}
          </div>
          <div>
            <h3 className={`text-lg font-black font-sports uppercase ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}>
              {activeEvent.name}
            </h3>
            <p className={`text-xs mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
              Deporte: <strong className="capitalize">{activeEvent.type}</strong> • Fecha: {activeEvent.date} • {activeEvent.time}
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled={creatingScoreboard}
              onClick={handleCreateScoreboard}
              className="px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-sports font-black text-sm uppercase tracking-wider shadow-lg shadow-red-950/40 transition-all cursor-pointer active:scale-98 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{creatingScoreboard ? 'Creando marcador...' : 'Habilitar Marcador en Vivo para este Partido'}</span>
            </button>
          </div>
        </div>
      )}

      {/* PANEL ACTIVO CUANDO EXISTE SCOREBOARD */}
      {scoreboard && (
        <div className="space-y-6">
          {/* BARRA SUPERIOR: Estado del Partido y Acciones de Transición */}
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
            scoreboard.status === 'en_vivo'
              ? 'bg-red-950/30 border-red-500/50'
              : scoreboard.status === 'finalizado'
              ? 'bg-slate-900/60 border-slate-700'
              : 'bg-blue-950/30 border-blue-500/40'
          }`}>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 rounded-xl font-sports font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm ${
                scoreboard.status === 'en_vivo'
                  ? 'bg-red-600 text-white animate-pulse'
                  : scoreboard.status === 'finalizado'
                  ? 'bg-slate-700 text-slate-200'
                  : 'bg-blue-600 text-white'
              }`}>
                {scoreboard.status === 'en_vivo' && <span className="w-2 h-2 rounded-full bg-white animate-ping" />}
                <span>
                  {scoreboard.status === 'en_vivo'
                    ? '🔴 EN VIVO'
                    : scoreboard.status === 'finalizado'
                    ? '🏁 FINALIZADO'
                    : '📅 PROGRAMADO'}
                </span>
              </span>

              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                Última act: {new Date(scoreboard.updatedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            {/* Controles de estado */}
            <div className="flex flex-wrap items-center gap-2">
              {scoreboard.status !== 'en_vivo' && (
                <button
                  type="button"
                  onClick={handleStartGame}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-sports font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Iniciar Partido (En Vivo)</span>
                </button>
              )}

              {scoreboard.status === 'en_vivo' && (
                <button
                  type="button"
                  onClick={handleFinalizeGame}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-amber-400 border border-amber-500/40 font-sports font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Finalizar Partido</span>
                </button>
              )}

              {scoreboard.status === 'finalizado' && (
                <button
                  type="button"
                  onClick={handleSetProgramado}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reabrir</span>
                </button>
              )}
            </div>
          </div>

          {/* TABLERO PRINCIPAL TÁCTIL (HOME vs AWAY) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* EQUIPO VISITANTE (AWAY) - Batea primero en Béisbol */}
            <div className={`p-5 rounded-3xl border flex flex-col justify-between space-y-4 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#101625] border-slate-800'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                    Visitante {scoreboard.sport === 'baseball' && scoreboard.baseballState?.isTopInning ? '• BATEANDO ▲' : ''}
                  </span>
                  <h2 className={`text-lg sm:text-xl font-black font-sports uppercase truncate ${
                    theme === 'light' ? 'text-slate-900' : 'text-white'
                  }`}>
                    {scoreboard.awayTeamName}
                  </h2>
                </div>
                <div className="text-5xl sm:text-6xl font-black font-sports text-red-500 drop-shadow-md">
                  {scoreboard.awayScore}
                </div>
              </div>

              {/* Botones táctiles de puntos/carreras */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60">
                {scoreboard.sport === 'baseball' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => addRun(scoreboard.eventId, 'away')}
                      className="py-3 px-3 rounded-2xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-sports font-black text-sm uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+1 Carrera Visitante</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => decrementRun(scoreboard.eventId, 'away')}
                      disabled={scoreboard.awayScore <= 0}
                      className="py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 font-sports font-bold text-xs uppercase tracking-wider border border-slate-700 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>-1 Corrección</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenGoalModal('away')}
                      className="py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-sports font-black text-sm uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 col-span-2"
                    >
                      <span>⚽</span>
                      <span>Registrar Gol Visitante</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCardModal('away', 'amarilla')}
                      className="py-2.5 px-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-sports font-bold text-xs uppercase flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>🟨 Amarilla</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCardModal('away', 'roja')}
                      className="py-2.5 px-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-sports font-bold text-xs uppercase flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>🟥 Roja</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* EQUIPO LOCAL (HOME) */}
            <div className={`p-5 rounded-3xl border flex flex-col justify-between space-y-4 ${
              theme === 'light' ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#101625] border-slate-800'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                    Local {scoreboard.sport === 'baseball' && !scoreboard.baseballState?.isTopInning ? '• BATEANDO ▼' : ''}
                  </span>
                  <h2 className={`text-lg sm:text-xl font-black font-sports uppercase truncate ${
                    theme === 'light' ? 'text-slate-900' : 'text-white'
                  }`}>
                    {scoreboard.homeTeamName}
                  </h2>
                </div>
                <div className="text-5xl sm:text-6xl font-black font-sports text-red-500 drop-shadow-md">
                  {scoreboard.homeScore}
                </div>
              </div>

              {/* Botones táctiles de puntos/carreras */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60">
                {scoreboard.sport === 'baseball' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => addRun(scoreboard.eventId, 'home')}
                      className="py-3 px-3 rounded-2xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-sports font-black text-sm uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+1 Carrera Local</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => decrementRun(scoreboard.eventId, 'home')}
                      disabled={scoreboard.homeScore <= 0}
                      className="py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-300 font-sports font-bold text-xs uppercase tracking-wider border border-slate-700 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>-1 Corrección</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleOpenGoalModal('home')}
                      className="py-3 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-sports font-black text-sm uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 col-span-2"
                    >
                      <span>⚽</span>
                      <span>Registrar Gol Local</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCardModal('home', 'amarilla')}
                      className="py-2.5 px-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-sports font-bold text-xs uppercase flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>🟨 Amarilla</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCardModal('home', 'roja')}
                      className="py-2.5 px-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-sports font-bold text-xs uppercase flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>🟥 Roja</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* SECCIÓN ESPECÍFICA DE BÉISBOL: ENTRADAS, OUTS, STRIKES */}
          {/* ======================================================== */}
          {scoreboard.sport === 'baseball' && scoreboard.baseballState && (
            <div className="space-y-4">
              <div className={`p-5 rounded-3xl border space-y-5 ${
                theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#101625] border-slate-800'
              }`}>
                {/* Cabecera de Entrada y Cambios */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl sm:text-3xl font-black font-sports text-amber-400 flex items-center gap-1.5">
                      <span>{scoreboard.baseballState.isTopInning ? '▲ Alta' : '▼ Baja'}</span>
                      <span>Entrada {scoreboard.baseballState.currentInning}</span>
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      ({scoreboard.baseballState.isTopInning ? `Batea ${scoreboard.awayTeamName}` : `Batea ${scoreboard.homeTeamName}`})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => advanceInning(scoreboard.eventId)}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-sports font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>Avanzar Entrada Manual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => resetCount(scoreboard.eventId)}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-sports font-bold text-xs uppercase border border-slate-700 cursor-pointer"
                      title="Resetear bolas y strikes a 0-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Cuenta 0-0</span>
                    </button>
                  </div>
                </div>

                {/* Controles Táctiles de OUTS, BOLAS, STRIKES */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* OUTS */}
                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 text-center">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase">Outs (3 = Avanza)</span>
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map((idx) => (
                          <span
                            key={idx}
                            className={`w-3.5 h-3.5 rounded-full transition-colors ${
                              idx < (scoreboard.baseballState?.outs || 0)
                                ? 'bg-red-500 shadow-sm shadow-red-500/50'
                                : 'bg-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => markOut(scoreboard.eventId)}
                      className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-sports font-black text-sm uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Marcar OUT ({scoreboard.baseballState.outs})</span>
                    </button>
                  </div>

                  {/* STRIKES */}
                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 text-center">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase">Strikes (3 = Out)</span>
                      <div className="flex gap-1.5">
                        {[0, 1].map((idx) => (
                          <span
                            key={idx}
                            className={`w-3.5 h-3.5 rounded-full transition-colors ${
                              idx < (scoreboard.baseballState?.strikes || 0)
                                ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                                : 'bg-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => markStrike(scoreboard.eventId)}
                      className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-sports font-black text-sm uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Marcar STRIKE ({scoreboard.baseballState.strikes})</span>
                    </button>
                  </div>

                  {/* BOLAS */}
                  <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 text-center">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase">Bolas (4 = Base)</span>
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map((idx) => (
                          <span
                            key={idx}
                            className={`w-3.5 h-3.5 rounded-full transition-colors ${
                              idx < (scoreboard.baseballState?.balls || 0)
                                ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                                : 'bg-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => markBall(scoreboard.eventId)}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-sports font-black text-sm uppercase tracking-wider shadow-md transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Marcar BOLA ({scoreboard.baseballState.balls})</span>
                    </button>
                  </div>
                </div>

                {/* CONTROL DE HITS Y ERRORES */}
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-xs font-mono uppercase font-bold text-slate-400 tracking-wider block mb-2">
                    Ajustes de Hits y Errores Totales
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-slate-400 block text-[10px]">Vis. Hits</span>
                        <span className="font-bold text-white text-base">{scoreboard.baseballState.awayHits}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => updateHitsErrors(scoreboard.eventId, 'away', 'hit', 1)}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs font-bold"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => updateHitsErrors(scoreboard.eventId, 'away', 'hit', -1)}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center text-xs font-bold"
                        >
                          -
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-slate-400 block text-[10px]">Vis. Errores</span>
                        <span className="font-bold text-white text-base">{scoreboard.baseballState.awayErrors}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => updateHitsErrors(scoreboard.eventId, 'away', 'error', 1)}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs font-bold"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => updateHitsErrors(scoreboard.eventId, 'away', 'error', -1)}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center text-xs font-bold"
                        >
                          -
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-slate-400 block text-[10px]">Loc. Hits</span>
                        <span className="font-bold text-white text-base">{scoreboard.baseballState.homeHits}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => updateHitsErrors(scoreboard.eventId, 'home', 'hit', 1)}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs font-bold"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => updateHitsErrors(scoreboard.eventId, 'home', 'hit', -1)}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center text-xs font-bold"
                        >
                          -
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-slate-400 block text-[10px]">Loc. Errores</span>
                        <span className="font-bold text-white text-base">{scoreboard.baseballState.homeErrors}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => updateHitsErrors(scoreboard.eventId, 'home', 'error', 1)}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center text-xs font-bold"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => updateHitsErrors(scoreboard.eventId, 'home', 'error', -1)}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center text-xs font-bold"
                        >
                          -
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* TABLA BOX SCORE EN TIEMPO REAL */}
                <div className="pt-2 border-t border-slate-800/80 overflow-x-auto">
                  <div className="text-xs font-mono uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-amber-400" />
                    <span>Box Score en Vivo (Previsualización)</span>
                  </div>

                  <table className="w-full text-center text-xs border-collapse min-w-[500px]">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[11px] font-mono">
                        <th className="py-2 text-left px-2 font-bold">Equipo</th>
                        {scoreboard.baseballState.inningScores.map((item) => (
                          <th
                            key={item.inning}
                            className={`w-7 py-1 ${
                              item.inning === scoreboard.baseballState?.currentInning
                                ? 'text-amber-400 font-black bg-amber-500/10 rounded-t'
                                : ''
                            }`}
                          >
                            {item.inning}
                          </th>
                        ))}
                        <th className="w-8 py-1 font-bold text-white bg-slate-800/50">C</th>
                        <th className="w-8 py-1 font-bold text-slate-300">H</th>
                        <th className="w-8 py-1 font-bold text-slate-300">E</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Visitante */}
                      <tr className="border-b border-slate-800/60 font-mono">
                        <td className="py-2 text-left px-2 font-bold text-slate-200 truncate max-w-[120px]">
                          {scoreboard.awayTeamName}
                        </td>
                        {scoreboard.baseballState.inningScores.map((item) => (
                          <td
                            key={item.inning}
                            className={`py-2 ${
                              item.inning === scoreboard.baseballState?.currentInning
                                ? 'bg-amber-500/10 font-bold text-amber-300'
                                : 'text-slate-300'
                            }`}
                          >
                            {item.away !== null ? item.away : '-'}
                          </td>
                        ))}
                        <td className="py-2 font-black text-white bg-slate-800/50 text-sm">
                          {scoreboard.awayScore}
                        </td>
                        <td className="py-2 text-slate-300">
                          {scoreboard.baseballState.awayHits}
                        </td>
                        <td className="py-2 text-slate-400">
                          {scoreboard.baseballState.awayErrors}
                        </td>
                      </tr>

                      {/* Local */}
                      <tr className="font-mono">
                        <td className="py-2 text-left px-2 font-bold text-slate-200 truncate max-w-[120px]">
                          {scoreboard.homeTeamName}
                        </td>
                        {scoreboard.baseballState.inningScores.map((item) => (
                          <td
                            key={item.inning}
                            className={`py-2 ${
                              item.inning === scoreboard.baseballState?.currentInning
                                ? 'bg-amber-500/10 font-bold text-amber-300'
                                : 'text-slate-300'
                            }`}
                          >
                            {item.home !== null ? item.home : '-'}
                          </td>
                        ))}
                        <td className="py-2 font-black text-white bg-slate-800/50 text-sm">
                          {scoreboard.homeScore}
                        </td>
                        <td className="py-2 text-slate-300">
                          {scoreboard.baseballState.homeHits}
                        </td>
                        <td className="py-2 text-slate-400">
                          {scoreboard.baseballState.homeErrors}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SECCIÓN ESPECÍFICA DE FÚTBOL: MINUTO, TIEMPO, GOLES, CARDS */}
          {/* ======================================================== */}
          {scoreboard.sport === 'football' && scoreboard.footballState && (
            <div className="space-y-4">
              <div className={`p-5 rounded-3xl border space-y-5 ${
                theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#101625] border-slate-800'
              }`}>
                {/* Control de Tiempo y Mitades */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black font-sports text-emerald-400 flex items-center gap-1.5">
                      <span>
                        {scoreboard.footballState.minute}'
                        {scoreboard.footballState.addedTime > 0 && `+${scoreboard.footballState.addedTime}'`}
                      </span>
                    </span>
                    <span className="px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-amber-300 font-sports uppercase tracking-wider">
                      {scoreboard.footballState.half === 'primer_tiempo'
                        ? '1er Tiempo (1T)'
                        : scoreboard.footballState.half === 'entretiempo'
                        ? 'Entretiempo (Descanso)'
                        : scoreboard.footballState.half === 'segundo_tiempo'
                        ? '2do Tiempo (2T)'
                        : 'Finalizado'}
                    </span>
                  </div>

                  {/* Botón táctil para avanzar etapa de fútbol */}
                  <button
                    type="button"
                    onClick={() => advanceHalf(scoreboard.eventId)}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-sports font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>
                      {scoreboard.footballState.half === 'primer_tiempo'
                        ? 'Avanzar a Entretiempo'
                        : scoreboard.footballState.half === 'entretiempo'
                        ? 'Iniciar 2do Tiempo'
                        : scoreboard.footballState.half === 'segundo_tiempo'
                        ? 'Finalizar Partido'
                        : 'Reiniciar Tiempo'}
                    </span>
                  </button>
                </div>

                {/* Controles de Minuto actual */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                    <span className="text-xs font-mono font-bold text-slate-400 uppercase block">
                      Ajuste de Minuto en Vivo
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateMinute(scoreboard.eventId, (scoreboard.footballState?.minute || 0) + 1)}
                        className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
                      >
                        +1 min
                      </button>
                      <button
                        type="button"
                        onClick={() => updateMinute(scoreboard.eventId, (scoreboard.footballState?.minute || 0) + 5)}
                        className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
                      >
                        +5 min
                      </button>
                      <button
                        type="button"
                        onClick={() => updateMinute(scoreboard.eventId, Math.max(0, (scoreboard.footballState?.minute || 0) - 1))}
                        className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold text-xs cursor-pointer"
                      >
                        -1 min
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                    <span className="text-xs font-mono font-bold text-slate-400 uppercase block">
                      Tiempo Agregado (Compensación)
                    </span>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((add) => (
                        <button
                          key={add}
                          type="button"
                          onClick={() => updateMinute(scoreboard.eventId, scoreboard.footballState?.minute || 0, add)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                            scoreboard.footballState?.addedTime === add
                              ? 'bg-amber-500 text-slate-950 font-black ring-2 ring-amber-400'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                          }`}
                        >
                          +{add}'
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => updateMinute(scoreboard.eventId, scoreboard.footballState?.minute || 0, 0)}
                        className="py-2.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-bold"
                        title="Quitar tiempo agregado"
                      >
                        0'
                      </button>
                    </div>
                  </div>
                </div>

                {/* LÍNEA DE TIEMPO / FEED DE GOLES Y TARJETAS */}
                <div className="pt-2 border-t border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Línea de Tiempo del Encuentro (Goles y Tarjetas)</span>
                    </span>
                  </div>

                  {/* Lista combinada de incidencias */}
                  {scoreboard.footballState.goals.length === 0 && scoreboard.footballState.cards.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-900/40 text-center text-xs text-slate-500 font-medium">
                      Aún no se han registrado goles ni tarjetas en este partido.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {/* Goles */}
                      {scoreboard.footballState.goals.map((goal, gIdx) => (
                        <div
                          key={`goal_${gIdx}`}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs font-sports"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">⚽</span>
                            <span className="font-bold text-emerald-300 font-mono">{goal.minute}'</span>
                            <span className="font-bold text-white">{goal.playerName}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono uppercase">
                              {goal.team === 'home' ? scoreboard.homeTeamName : scoreboard.awayTeamName}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeGoal(scoreboard.eventId, gIdx)}
                            className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950/50 cursor-pointer"
                            title="Eliminar gol"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Tarjetas */}
                      {scoreboard.footballState.cards.map((card, cIdx) => (
                        <div
                          key={`card_${cIdx}`}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-sports ${
                            card.type === 'amarilla'
                              ? 'bg-amber-950/20 border-amber-500/30'
                              : 'bg-red-950/20 border-red-500/30'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{card.type === 'amarilla' ? '🟨' : '🟥'}</span>
                            <span className={`font-bold font-mono ${card.type === 'amarilla' ? 'text-amber-300' : 'text-red-300'}`}>
                              {card.minute}'
                            </span>
                            <span className="font-bold text-white">{card.playerName}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono uppercase">
                              {card.team === 'home' ? scoreboard.homeTeamName : scoreboard.awayTeamName}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCard(scoreboard.eventId, cIdx)}
                            className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950/50 cursor-pointer"
                            title="Eliminar tarjeta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL RÁPIDO DE REGISTRO DE GOL                          */}
      {/* ======================================================== */}
      {goalModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-[#101625] border border-emerald-500/50 p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚽</span>
                <h3 className="text-base font-black font-sports uppercase text-white">
                  Registrar Gol de {goalModal.team === 'home' ? scoreboard?.homeTeamName : scoreboard?.awayTeamName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setGoalModal((prev) => ({ ...prev, open: false }))}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono font-bold text-slate-400 block mb-1">
                  Nombre del Anotador / Jugador
                </label>
                <input
                  type="text"
                  value={goalModal.playerName}
                  onChange={(e) => setGoalModal((prev) => ({ ...prev, playerName: e.target.value }))}
                  placeholder="Ej: Ramiro Árciga, Autogol, etc."
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-slate-400 block mb-1">
                  Minuto de Anotación
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="130"
                    value={goalModal.minute}
                    onChange={(e) => setGoalModal((prev) => ({ ...prev, minute: parseInt(e.target.value) || 1 }))}
                    className="w-24 py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-xs text-slate-400">Minuto de juego</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setGoalModal((prev) => ({ ...prev, open: false }))}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmGoal}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-sports font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg shadow-emerald-950/40"
              >
                Confirmar Gol ⚽
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL RÁPIDO DE REGISTRO DE TARJETA                      */}
      {/* ======================================================== */}
      {cardModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-[#101625] border border-amber-500/50 p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{cardModal.type === 'amarilla' ? '🟨' : '🟥'}</span>
                <h3 className="text-base font-black font-sports uppercase text-white">
                  Tarjeta {cardModal.type === 'amarilla' ? 'Amarilla' : 'Roja'} • {cardModal.team === 'home' ? scoreboard?.homeTeamName : scoreboard?.awayTeamName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCardModal((prev) => ({ ...prev, open: false }))}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono font-bold text-slate-400 block mb-1">
                  Nombre del Jugador Amonestado
                </label>
                <input
                  type="text"
                  value={cardModal.playerName}
                  onChange={(e) => setCardModal((prev) => ({ ...prev, playerName: e.target.value }))}
                  placeholder="Ej: Nicolás Benedetti"
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-amber-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-mono font-bold text-slate-400 block mb-1">
                  Minuto
                </label>
                <input
                  type="number"
                  min="1"
                  max="130"
                  value={cardModal.minute}
                  onChange={(e) => setCardModal((prev) => ({ ...prev, minute: parseInt(e.target.value) || 1 }))}
                  className="w-24 py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono font-bold focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCardModal((prev) => ({ ...prev, open: false }))}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmCard}
                className={`flex-1 py-2.5 rounded-xl text-white font-sports font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg ${
                  cardModal.type === 'amarilla'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/40 text-slate-950'
                    : 'bg-red-600 hover:bg-red-500 shadow-red-950/40'
                }`}
              >
                Registrar Tarjeta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
