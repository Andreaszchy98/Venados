import React, { useState, useEffect, useMemo } from 'react';
import { HistoricalGame, Venue } from '../../types';
import { subscribeGameHistory } from '../../lib/gameHistory';
import { DEFAULT_VENUES, DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { getAllowedEventTypesForVenue } from '../../lib/venues';
import { useTheme } from '../../context/ThemeContext';
import {
  Trophy,
  Calendar,
  MapPin,
  ChevronRight,
  Shield,
  Activity,
  CheckCircle2,
  Filter,
  Flame,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';

interface HistorialJuegosProps {
  initialVenueId?: string;
  venues?: Venue[];
  onSelectGame?: (eventId: string) => void;
  onBack?: () => void;
}

export const HistorialJuegos: React.FC<HistorialJuegosProps> = ({
  initialVenueId = 'todos',
  venues = DEFAULT_VENUES,
  onSelectGame,
  onBack,
}) => {
  const { theme } = useTheme();

  const [selectedVenue, setSelectedVenue] = useState<string>(initialVenueId);
  const [selectedSport, setSelectedSport] = useState<'todos' | 'baseball' | 'football' | 'basketball'>('todos');
  const [games, setGames] = useState<HistoricalGame[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Sincronizar initialVenueId si cambia
  useEffect(() => {
    if (initialVenueId) {
      setSelectedVenue(initialVenueId);
    }
  }, [initialVenueId]);

  // Suscribirse al historial
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeGameHistory(
      selectedVenue === 'todos' ? 'todos' : selectedVenue,
      (history) => {
        setGames(history);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedVenue]);

  // Deportes permitidos según el recinto seleccionado
  const availableSports = useMemo(() => {
    const selectedVenueObj = venues.find((v) => v.id === selectedVenue);
    const allowed = getAllowedEventTypesForVenue(selectedVenueObj || (selectedVenue !== 'todos' ? selectedVenue : null));

    const sports: { id: 'todos' | 'baseball' | 'football' | 'basketball'; label: string }[] = [
      { id: 'todos', label: 'Todos los deportes' },
      { id: 'baseball', label: '⚾ Béisbol' },
      { id: 'football', label: '⚽ Fútbol' },
      { id: 'basketball', label: '🏀 Básquetbol' },
    ];

    if (!allowed) return sports;
    return sports.filter((s) => s.id === 'todos' || allowed.includes(s.id as any));
  }, [selectedVenue, venues]);

  // Si cambia la sede y el deporte seleccionado no está permitido, reiniciar a 'todos'
  useEffect(() => {
    if (selectedVenue === 'todos') return;
    const selectedVenueObj = venues.find((v) => v.id === selectedVenue);
    const allowed = getAllowedEventTypesForVenue(selectedVenueObj || selectedVenue);
    if (allowed && selectedSport !== 'todos' && !allowed.includes(selectedSport as any)) {
      setSelectedSport('todos');
    }
  }, [selectedVenue, venues, selectedSport]);

  // Filtrar por deporte
  const filteredGames = useMemo(() => {
    let list = games;
    if (selectedSport !== 'todos') {
      list = list.filter((g) => g.sport === selectedSport);
    }
    // Asegurar que si hay sede seleccionada, solo muestre juegos de deportes permitidos
    if (selectedVenue !== 'todos') {
      const selectedVenueObj = venues.find((v) => v.id === selectedVenue);
      const allowed = getAllowedEventTypesForVenue(selectedVenueObj || selectedVenue);
      if (allowed) {
        list = list.filter((g) => allowed.includes(g.sport as any));
      }
    }
    return list;
  }, [games, selectedSport, selectedVenue, venues]);

  // Obtener nombre del recinto
  const getVenueName = (venueId: string): string => {
    const found = venues.find((v) => v.id === venueId);
    if (found) return found.name;
    if (venueId === DEFAULT_VENUE_ID) return 'Estadio Teodoro Mariscal';
    if (venueId === 'venue-encanto') return 'Estadio El Encanto';
    return 'Recinto Deportivo';
  };

  const getSportBadge = (sport: string) => {
    switch (sport) {
      case 'baseball':
        return { label: '⚾ Béisbol (LMP)', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
      case 'football':
        return { label: '⚽ Fútbol (Liga)', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
      case 'basketball':
        return { label: '🏀 Básquetbol', color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' };
      default:
        return { label: '🏆 Deporte', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' };
    }
  };

  return (
    <div className={`min-h-screen py-6 px-4 sm:px-6 max-w-5xl mx-auto transition-colors duration-200 ${
      theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-[#0B0F19] text-white'
    }`}>
      {/* 1. ENCABEZADO PRINCIPAL */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5 border-slate-200 dark:border-slate-800">
        <div>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-400 mb-2 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver a la cartelera
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-xs">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                Historial de Juegos y Resultados
              </h1>
              <p className={`text-xs ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                Consulta marcadores finales, estadísticas por entrada y resultados históricos por recinto.
              </p>
            </div>
          </div>
        </div>

        {/* Resumen de juegos */}
        <div className={`flex items-center gap-3 px-3.5 py-2 rounded-2xl border text-xs self-start sm:self-auto ${
          theme === 'light'
            ? 'bg-white border-slate-200 text-slate-700 shadow-xs'
            : 'bg-[#101625] border-slate-800 text-slate-300'
        }`}>
          <div className="text-right">
            <span className="block text-[10px] uppercase font-bold text-slate-400">Total Juegos</span>
            <span className="text-base font-black text-red-500">{filteredGames.length}</span>
          </div>
          <div className="w-px h-7 bg-slate-200 dark:bg-slate-800" />
          <div className="text-right">
            <span className="block text-[10px] uppercase font-bold text-slate-400">Estado</span>
            <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Oficial
            </span>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS: SEDE Y DEPORTE */}
      <div className="mb-6 space-y-3">
        {/* Selector de Sede */}
        <div>
          <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-red-500" />
            Filtrar por Recinto / Estadio:
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedVenue('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedVenue === 'todos'
                  ? 'bg-red-600 text-white shadow-md'
                  : theme === 'light'
                  ? 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  : 'bg-[#121826] text-slate-300 hover:bg-[#182032] border border-slate-800'
              }`}
            >
              Todos los recintos
            </button>

            {venues.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVenue(v.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedVenue === v.id
                    ? 'bg-red-600 text-white shadow-md'
                    : theme === 'light'
                    ? 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    : 'bg-[#121826] text-slate-300 hover:bg-[#182032] border border-slate-800'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {v.name}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro de Deporte */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {availableSports.map((sport) => {
            const isSel = selectedSport === sport.id;
            return (
              <button
                key={sport.id}
                type="button"
                onClick={() => setSelectedSport(sport.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  isSel
                    ? theme === 'light'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-950 shadow-xs'
                    : theme === 'light'
                    ? 'bg-slate-100 text-slate-600 hover:text-slate-900'
                    : 'bg-[#141b2b] text-slate-400 hover:text-slate-200'
                }`}
              >
                {sport.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. LISTADO DE JUEGOS FINALIZADOS */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-semibold">Cargando marcadores del historial...</p>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className={`p-8 text-center rounded-3xl border space-y-3 max-w-md mx-auto my-8 ${
          theme === 'light' ? 'bg-white border-slate-200 shadow-xs' : 'bg-[#101625] border-slate-800'
        }`}>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <RotateCcw className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold">No hay juegos registrados para este filtro</h3>
          <p className="text-xs text-slate-400">
            No se encontraron partidos finalizados para el recinto o deporte seleccionado. Prueba cambiando los filtros.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedVenue('todos');
              setSelectedSport('todos');
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-md"
          >
            Ver todos los juegos
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGames.map((game) => {
            const sportInfo = getSportBadge(game.sport);
            const homeWon = game.homeScore > game.awayScore;
            const awayWon = game.awayScore > game.homeScore;

            return (
              <div
                key={game.id}
                className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-sm hover:shadow-md ${
                  theme === 'light'
                    ? 'bg-white border-slate-200/90 hover:border-slate-300'
                    : 'bg-[#101625] border-slate-800/90 hover:border-slate-700'
                }`}
              >
                {/* Encabezado de la Card: Fecha, Recinto, Deporte, Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex items-center gap-1 font-semibold text-slate-500 dark:text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-red-500" />
                      {game.date}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {game.venueName || getVenueName(game.venueId)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${sportInfo.color}`}>
                      {sportInfo.label}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      Finalizado
                    </span>
                  </div>
                </div>

                {/* Marcador Principal */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Bloque de Equipos y Resultados */}
                  <div className="md:col-span-8 space-y-2.5">
                    {/* Equipo Visitante */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center border ${
                          awayWon
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                        }`}>
                          VIS
                        </div>
                        <div>
                          <span className={`text-sm sm:text-base font-extrabold ${awayWon ? 'text-red-500 dark:text-red-400' : ''}`}>
                            {game.awayTeamName}
                          </span>
                          <span className="text-[10px] text-slate-400 block">Visitante</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {awayWon && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            Ganador
                          </span>
                        )}
                        <span className={`text-2xl sm:text-3xl font-black font-mono px-2 ${awayWon ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                          {game.awayScore}
                        </span>
                      </div>
                    </div>

                    {/* Equipo Local */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center border ${
                          homeWon
                            ? 'bg-red-500/10 border-red-500/30 text-red-500'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                        }`}>
                          LOC
                        </div>
                        <div>
                          <span className={`text-sm sm:text-base font-extrabold ${homeWon ? 'text-red-500 dark:text-red-400' : ''}`}>
                            {game.homeTeamName}
                          </span>
                          <span className="text-[10px] text-slate-400 block">Local</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {homeWon && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            Ganador
                          </span>
                        )}
                        <span className={`text-2xl sm:text-3xl font-black font-mono px-2 ${homeWon ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                          {game.homeScore}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones e Indicadores */}
                  <div className="md:col-span-4 flex flex-col justify-center items-start md:items-end border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800/80 pt-3 md:pt-0 md:pl-4">
                    {onSelectGame && (
                      <button
                        type="button"
                        onClick={() => onSelectGame(game.eventId)}
                        className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm hover:shadow"
                      >
                        Ver Pizarra Completa
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {game.summaryNote && (
                      <p className="text-[11px] text-slate-400 mt-2 italic line-clamp-2 md:text-right">
                        "{game.summaryNote}"
                      </p>
                    )}
                  </div>
                </div>

                {/* DETALLE ESPECÍFICO DE BÉISBOL: PIZARRA ENTRADA POR ENTRADA */}
                {game.sport === 'baseball' && game.baseballState && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                      Pizarra Entrada por Entrada (Box Score)
                    </div>
                    <div className="overflow-x-auto no-scrollbar">
                      <table className="w-full text-center text-xs font-mono">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400">
                            <th className="text-left font-sans py-1 pr-2">Equipo</th>
                            {Array.from({ length: 9 }, (_, i) => (
                              <th key={i} className="px-1.5 py-1 w-6">{i + 1}</th>
                            ))}
                            <th className="px-2 py-1 font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/60">C</th>
                            <th className="px-2 py-1 font-bold text-slate-700 dark:text-slate-200">H</th>
                            <th className="px-2 py-1 font-bold text-slate-700 dark:text-slate-200">E</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Fila Visitante */}
                          <tr className="border-b border-slate-100 dark:border-slate-800/50">
                            <td className="text-left font-sans font-bold py-1 pr-2 truncate max-w-[120px]">
                              {game.awayTeamName}
                            </td>
                            {Array.from({ length: 9 }, (_, i) => {
                              const score = game.baseballState?.inningScores[i]?.away;
                              return (
                                <td key={i} className="px-1.5 py-1 text-slate-500">
                                  {score !== null && score !== undefined ? score : '-'}
                                </td>
                              );
                            })}
                            <td className="px-2 py-1 font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800/60">
                              {game.awayScore}
                            </td>
                            <td className="px-2 py-1 font-bold text-slate-600 dark:text-slate-300">
                              {game.baseballState.awayHits}
                            </td>
                            <td className="px-2 py-1 font-bold text-slate-600 dark:text-slate-300">
                              {game.baseballState.awayErrors}
                            </td>
                          </tr>

                          {/* Fila Local */}
                          <tr>
                            <td className="text-left font-sans font-bold py-1 pr-2 truncate max-w-[120px]">
                              {game.homeTeamName}
                            </td>
                            {Array.from({ length: 9 }, (_, i) => {
                              const score = game.baseballState?.inningScores[i]?.home;
                              return (
                                <td key={i} className="px-1.5 py-1 text-slate-500">
                                  {score !== null && score !== undefined ? score : '-'}
                                </td>
                              );
                            })}
                            <td className="px-2 py-1 font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800/60">
                              {game.homeScore}
                            </td>
                            <td className="px-2 py-1 font-bold text-slate-600 dark:text-slate-300">
                              {game.baseballState.homeHits}
                            </td>
                            <td className="px-2 py-1 font-bold text-slate-600 dark:text-slate-300">
                              {game.baseballState.homeErrors}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* DETALLE ESPECÍFICO DE FÚTBOL: GOLES E INCIDENCIAS */}
                {game.sport === 'football' && game.footballState && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-emerald-500" />
                      Goles e Incidencias del Partido
                    </div>
                    {game.footballState.goals && game.footballState.goals.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {game.footballState.goals.map((g, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border ${
                              g.team === 'home'
                                ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            <span>⚽</span>
                            <span>{g.minute}' {g.playerName}</span>
                            <span className="text-[10px] text-slate-400">({g.team === 'home' ? 'Local' : 'Vis'})</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Sin anotaciones en tiempo regular.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
