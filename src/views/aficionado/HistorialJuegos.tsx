import React, { useState, useEffect, useMemo } from 'react';
import { HistoricalGame, Venue } from '../../types';
import { subscribeGameHistory } from '../../lib/gameHistory';
import { DEFAULT_VENUES, DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { getAllowedEventTypesForVenue } from '../../lib/venues';
import { useTheme } from '../../context/ThemeContext';
import {
  Calendar,
  MapPin,
  ChevronRight,
  Activity,
  Trophy,
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
}) => {
  const { theme } = useTheme();

  const [selectedVenue, setSelectedVenue] = useState<string>(initialVenueId || 'todos');
  const [selectedSport, setSelectedSport] = useState<'todos' | 'baseball' | 'football' | 'basketball'>('todos');
  const [games, setGames] = useState<HistoricalGame[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Sincronizar initialVenueId automáticamente con la sede elegida en la barra superior
  useEffect(() => {
    setSelectedVenue(initialVenueId || 'todos');
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

  // Deportes disponibles según el recinto
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

  // Si cambia la sede y el deporte no está permitido, reiniciar
  useEffect(() => {
    if (selectedVenue === 'todos') return;
    const selectedVenueObj = venues.find((v) => v.id === selectedVenue);
    const allowed = getAllowedEventTypesForVenue(selectedVenueObj || selectedVenue);
    if (allowed && selectedSport !== 'todos' && !allowed.includes(selectedSport as any)) {
      setSelectedSport('todos');
    }
  }, [selectedVenue, venues, selectedSport]);

  // Filtrar juegos
  const filteredGames = useMemo(() => {
    let list = games;
    if (selectedSport !== 'todos') {
      list = list.filter((g) => g.sport === selectedSport);
    }
    if (selectedVenue !== 'todos') {
      const selectedVenueObj = venues.find((v) => v.id === selectedVenue);
      const allowed = getAllowedEventTypesForVenue(selectedVenueObj || selectedVenue);
      if (allowed) {
        list = list.filter((g) => allowed.includes(g.sport as any));
      }
    }
    return list;
  }, [games, selectedSport, selectedVenue, venues]);

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
        return { label: '⚾ Béisbol', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' };
      case 'football':
        return { label: '⚽ Fútbol', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
      case 'basketball':
        return { label: '🏀 Básquetbol', color: 'text-orange-500 bg-orange-500/10 border-orange-500/20' };
      default:
        return { label: '🏆 Deporte', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' };
    }
  };

  return (
    <div className="space-y-4 pt-1 pb-6 px-1 sm:px-0">
      {/* Filtro compacto de Deportes (solo si hay más de 1 deporte relevante) */}
      {availableSports.length > 2 && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {availableSports.map((sport) => {
            const isSel = selectedSport === sport.id;
            return (
              <button
                key={sport.id}
                type="button"
                onClick={() => setSelectedSport(sport.id as any)}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                  isSel
                    ? theme === 'light'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-950 shadow-xs'
                    : theme === 'light'
                    ? 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                    : 'bg-[#101625] text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {sport.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Listado directo de Marcadores */}
      {loading ? (
        <div className="py-16 text-center space-y-2">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-semibold">Cargando marcadores...</p>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className={`p-8 text-center rounded-2xl border space-y-2 max-w-md mx-auto my-6 ${
          theme === 'light' ? 'bg-white border-slate-200 shadow-xs text-slate-800' : 'bg-[#101625] border-slate-800 text-slate-200'
        }`}>
          <Trophy className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
          <h3 className="text-sm font-bold">Sin marcadores finalizados registrados</h3>
          <p className="text-xs text-slate-400">
            Los resultados oficiales se mostrarán aquí una vez concluido cada partido.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredGames.map((game) => {
            const sportInfo = getSportBadge(game.sport);
            const homeWon = game.homeScore > game.awayScore;
            const awayWon = game.awayScore > game.homeScore;

            return (
              <div
                key={game.id}
                className={`rounded-2xl border p-4 transition-all shadow-xs hover:shadow-md ${
                  theme === 'light'
                    ? 'bg-white border-slate-200 hover:border-slate-300'
                    : 'bg-[#101625] border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Encabezado de la Card: Fecha, Recinto, Deporte, Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800/80">
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
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      Finalizado
                    </span>
                  </div>
                </div>

                {/* Marcador Principal */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  {/* Bloque de Equipos y Resultados */}
                  <div className="md:col-span-8 space-y-2">
                    {/* Equipo Visitante */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg font-black text-[11px] flex items-center justify-center border ${
                          awayWon
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                        }`}>
                          VIS
                        </div>
                        <div>
                          <span className={`text-xs sm:text-sm font-extrabold ${awayWon ? 'text-red-500 dark:text-red-400' : ''}`}>
                            {game.awayTeamName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {awayWon && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            Ganador
                          </span>
                        )}
                        <span className={`text-xl sm:text-2xl font-black font-mono px-2 ${awayWon ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                          {game.awayScore}
                        </span>
                      </div>
                    </div>

                    {/* Equipo Local */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg font-black text-[11px] flex items-center justify-center border ${
                          homeWon
                            ? 'bg-red-500/10 border-red-500/30 text-red-500'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                        }`}>
                          LOC
                        </div>
                        <div>
                          <span className={`text-xs sm:text-sm font-extrabold ${homeWon ? 'text-red-500 dark:text-red-400' : ''}`}>
                            {game.homeTeamName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {homeWon && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            Ganador
                          </span>
                        )}
                        <span className={`text-xl sm:text-2xl font-black font-mono px-2 ${homeWon ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                          {game.homeScore}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Acciones e Indicadores */}
                  <div className="md:col-span-4 flex flex-col justify-center items-start md:items-end border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800/80 pt-2.5 md:pt-0 md:pl-3">
                    {onSelectGame && (
                      <button
                        type="button"
                        onClick={() => onSelectGame(game.eventId)}
                        className="w-full sm:w-auto px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1 shadow-xs"
                      >
                        Ver Pizarra
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {game.summaryNote && (
                      <p className="text-[11px] text-slate-400 mt-1 italic line-clamp-2 md:text-right">
                        "{game.summaryNote}"
                      </p>
                    )}
                  </div>
                </div>

                {/* DETALLE DE BÉISBOL: PIZARRA ENTRADA POR ENTRADA */}
                {game.sport === 'baseball' && game.baseballState && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                      Pizarra Entrada por Entrada
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

                {/* DETALLE DE FÚTBOL: GOLES E INCIDENCIAS */}
                {game.sport === 'football' && game.footballState && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-emerald-500" />
                      Goles e Incidencias del Partido
                    </div>
                    {game.footballState.goals && game.footballState.goals.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {game.footballState.goals.map((g, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-0.5 rounded-lg text-xs font-semibold flex items-center gap-1 border ${
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
