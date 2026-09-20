import React, { useState, useEffect, useMemo } from 'react';
import { GameScoreboard, VenueEvent } from '../../types';
import { subscribeScoreboard, subscribeAllScoreboards } from '../../lib/scoreboard';
import { subscribeVenueEvents } from '../../lib/venueEvents';
import { DEFAULT_VENUE_ID } from '../../lib/defaultVenue';
import { useTheme } from '../../context/ThemeContext';
import {
  ArrowLeft,
  Radio,
  Calendar,
  Clock,
  MapPin,
  Flame,
  Award,
  Share2,
  Ticket,
  ChevronRight,
  Shield,
  Activity,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface MarcadorEnVivoProps {
  eventId?: string | null;
  venueId?: string;
  onBack?: () => void;
  onBuyTickets?: (eventId: string) => void;
}

// Genera abreviatura elegante de 3-4 letras para el equipo
function getTeamAbbr(teamName: string): string {
  if (!teamName) return 'EQU';
  const clean = teamName.replace(/(club|de|los|las|fc|sc|cd)\s+/gi, '').trim();
  const words = clean.split(/\s+/);
  if (words.length >= 2) {
    return (words[0].substring(0, 2) + words[1].substring(0, 2)).toUpperCase();
  }
  return teamName.substring(0, 3).toUpperCase();
}

export const MarcadorEnVivo: React.FC<MarcadorEnVivoProps> = ({
  eventId: initialEventId,
  venueId = DEFAULT_VENUE_ID,
  onBack,
  onBuyTickets,
}) => {
  const { theme } = useTheme();

  const [activeEventId, setActiveEventId] = useState<string | null>(initialEventId || null);
  const [scoreboard, setScoreboard] = useState<GameScoreboard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Lista de todos los partidos para la barra superior/selector
  const [allEvents, setAllEvents] = useState<VenueEvent[]>([]);
  const [allScoreboards, setAllScoreboards] = useState<Record<string, GameScoreboard>>({});

  // Cargar eventos deportivos
  useEffect(() => {
    const unsubEvents = subscribeVenueEvents(venueId, (evs) => {
      const sports = evs.filter((e) => e.type === 'baseball' || e.type === 'football');
      setAllEvents(sports);
      if (!activeEventId && sports.length > 0) {
        setActiveEventId(sports[0].id);
      }
    });

    const unsubAllScores = subscribeAllScoreboards((scores) => {
      setAllScoreboards(scores);
    });

    return () => {
      unsubEvents();
      unsubAllScores();
    };
  }, [venueId, activeEventId]);

  // Si cambia el initialEventId
  useEffect(() => {
    if (initialEventId) {
      setActiveEventId(initialEventId);
    }
  }, [initialEventId]);

  // Suscribirse al marcador en tiempo real del evento activo
  useEffect(() => {
    if (!activeEventId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeScoreboard(activeEventId, (score) => {
      setScoreboard(score);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeEventId]);

  // Evento activo de la lista
  const activeEvent = useMemo(() => {
    return allEvents.find((e) => e.id === activeEventId) || null;
  }, [allEvents, activeEventId]);

  // Lista de incidencias de fútbol ordenadas cronológicamente (Goles + Tarjetas)
  const footballTimeline = useMemo(() => {
    if (!scoreboard || scoreboard.sport !== 'football' || !scoreboard.footballState) return [];

    const items: Array<{
      kind: 'goal' | 'card';
      minute: number;
      team: 'home' | 'away';
      playerName: string;
      cardType?: 'amarilla' | 'roja';
    }> = [];

    scoreboard.footballState.goals.forEach((g) => {
      items.push({
        kind: 'goal',
        minute: g.minute,
        team: g.team,
        playerName: g.playerName,
      });
    });

    scoreboard.footballState.cards.forEach((c) => {
      items.push({
        kind: 'card',
        minute: c.minute,
        team: c.team,
        playerName: c.playerName,
        cardType: c.type,
      });
    });

    return items.sort((a, b) => a.minute - b.minute);
  }, [scoreboard]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* BARRA SUPERIOR: Botón Regresar y Selector de Partidos */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-2 font-sports font-bold text-xs uppercase ${
                theme === 'light'
                  ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                  : 'bg-[#101625] hover:bg-[#182032] border-slate-800 text-slate-300'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a la Cartelera</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              {scoreboard?.status === 'en_vivo' ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-400" />
              )}
            </span>
            <span className="text-xs font-mono uppercase font-bold text-slate-400 tracking-wider">
              Marcador Deportivo Oficial
            </span>
          </div>
        </div>

        {/* Carrusel de otros partidos disponibles si hay varios */}
        {allEvents.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {allEvents.map((ev) => {
              const evScore = allScoreboards[ev.id];
              const isSelected = ev.id === activeEventId;
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setActiveEventId(ev.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-sports font-bold border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-red-600 border-red-500 text-white shadow-sm'
                      : theme === 'light'
                      ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      : 'bg-[#101625] border-slate-800 text-slate-300 hover:bg-[#182032]'
                  }`}
                >
                  <span>{ev.type === 'baseball' ? '⚾' : '⚽'}</span>
                  <span className="truncate max-w-[130px]">{ev.name}</span>
                  {evScore?.status === 'en_vivo' && (
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* CASO: NO HAY MARCADOR O ESTÁ CARGANDO */}
      {loading ? (
        <div className="p-12 text-center rounded-3xl border border-slate-800 bg-[#101625] space-y-3">
          <div className="w-8 h-8 mx-auto border-3 border-red-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-mono">Conectando con el marcador de la sede...</p>
        </div>
      ) : !scoreboard ? (
        <div className="p-10 text-center rounded-3xl border border-slate-800 bg-[#101625] space-y-4">
          <Radio className="w-12 h-12 text-slate-600 mx-auto" />
          <div>
            <h3 className="text-base font-black text-white font-sports uppercase">
              Marcador no iniciado aún
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              El personal operativo de la sede activará el marcador en vivo al dar inicio el encuentro.
            </p>
          </div>
          {activeEvent && onBuyTickets && activeEvent.ticketsAvailable && (
            <button
              type="button"
              onClick={() => onBuyTickets(activeEvent.id)}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-sports font-black text-xs uppercase tracking-wider inline-flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Ticket className="w-4 h-4" />
              <span>Conseguir Boletos para este Partido</span>
            </button>
          )}
        </div>
      ) : (
        /* ======================================================== */
        /* TARJETA PRINCIPAL ESTILO GOOGLE SPORTS EN VIVO           */
        /* ======================================================== */
        <div className="space-y-6">
          <div
            className={`rounded-3xl border overflow-hidden transition-all shadow-2xl ${
              theme === 'light'
                ? 'bg-white border-slate-200'
                : 'bg-[#0E1526] border-slate-800 shadow-slate-950/60'
            }`}
          >
            {/* CABECERA: Estadio, Deporte y Estado Pulsante */}
            <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>{scoreboard.sport === 'baseball' ? '⚾ BÉISBOL LMP' : '⚽ FÚTBOL LIGA'}</span>
                <span>•</span>
                <span className="hidden sm:inline">
                  {activeEvent?.date ? `${activeEvent.date} · ${activeEvent.time}` : 'Hoy en vivo'}
                </span>
              </div>

              {/* Badges de Estado */}
              <div className="flex items-center gap-2">
                {scoreboard.status === 'en_vivo' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white font-sports font-black text-[11px] uppercase tracking-wider shadow-sm animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span>EN VIVO</span>
                  </span>
                )}

                {scoreboard.status === 'finalizado' && (
                  <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-sports font-black text-[11px] uppercase tracking-wider">
                    FINAL
                  </span>
                )}

                {scoreboard.status === 'programado' && (
                  <span className="px-3 py-1 rounded-full bg-blue-900/60 border border-blue-500/40 text-blue-300 font-sports font-black text-[11px] uppercase tracking-wider">
                    PROGRAMADO
                  </span>
                )}
              </div>
            </div>

            {/* CUERPO DEL MARCADOR: Equipos y Marcador Grande */}
            <div className="p-6 sm:p-8">
              <div className="grid grid-cols-5 items-center gap-2 sm:gap-4">
                {/* Equipo Visitante (Away) */}
                <div className="col-span-2 flex flex-col items-center sm:items-start text-center sm:text-left space-y-2">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-700 flex items-center justify-center font-sports font-black text-xl sm:text-2xl text-amber-400 shadow-md">
                    {getTeamAbbr(scoreboard.awayTeamName)}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-xl font-black font-sports uppercase tracking-tight text-white leading-tight">
                      {scoreboard.awayTeamName}
                    </h2>
                    <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-400 uppercase tracking-widest block">
                      Visitante
                    </span>
                  </div>
                </div>

                {/* Score Central Gigante */}
                <div className="col-span-1 flex flex-col items-center justify-center space-y-1">
                  <div className="flex items-center gap-2 sm:gap-4 text-4xl sm:text-6xl font-black font-sports tracking-tight text-white drop-shadow-md">
                    <span className={scoreboard.awayScore > scoreboard.homeScore ? 'text-amber-400' : 'text-white'}>
                      {scoreboard.awayScore}
                    </span>
                    <span className="text-slate-500 text-2xl sm:text-3xl font-light">-</span>
                    <span className={scoreboard.homeScore > scoreboard.awayScore ? 'text-amber-400' : 'text-white'}>
                      {scoreboard.homeScore}
                    </span>
                  </div>

                  {/* Estado en vivo central (ej. Entrada 7 ▲ o 72' 2T) */}
                  {scoreboard.status === 'en_vivo' && (
                    <div className="text-center">
                      {scoreboard.sport === 'baseball' && scoreboard.baseballState && (
                        <div className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-sports font-black text-xs uppercase flex items-center gap-1 justify-center">
                          <span>{scoreboard.baseballState.isTopInning ? '▲ Alta' : '▼ Baja'}</span>
                          <span>Entrada {scoreboard.baseballState.currentInning}</span>
                        </div>
                      )}

                      {scoreboard.sport === 'football' && scoreboard.footballState && (
                        <div className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-sports font-black text-xs uppercase flex items-center gap-1 justify-center">
                          <span>
                            {scoreboard.footballState.minute}'
                            {scoreboard.footballState.addedTime > 0 ? `+${scoreboard.footballState.addedTime}` : ''}
                          </span>
                          <span>·</span>
                          <span>
                            {scoreboard.footballState.half === 'primer_tiempo'
                              ? '1T'
                              : scoreboard.footballState.half === 'entretiempo'
                              ? 'ET'
                              : '2T'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {scoreboard.status === 'finalizado' && (
                    <span className="text-[11px] font-sports font-bold text-slate-400 uppercase tracking-widest">
                      Tiempo Cumplido
                    </span>
                  )}
                </div>

                {/* Equipo Local (Home) */}
                <div className="col-span-2 flex flex-col items-center sm:items-end text-center sm:text-right space-y-2">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-red-700 to-red-950 border border-red-600/50 flex items-center justify-center font-sports font-black text-xl sm:text-2xl text-white shadow-md">
                    {getTeamAbbr(scoreboard.homeTeamName)}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-xl font-black font-sports uppercase tracking-tight text-white leading-tight">
                      {scoreboard.homeTeamName}
                    </h2>
                    <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-400 uppercase tracking-widest block">
                      Local
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ======================================================== */}
            {/* SUB-SECCIÓN BÉISBOL: CUENTA (OUTS, BOLAS, STRIKES)       */}
            {/* ======================================================== */}
            {scoreboard.sport === 'baseball' && scoreboard.baseballState && (
              <div className="border-t border-slate-800 bg-black/30 p-4 sm:p-6 space-y-5">
                {/* Visualizador de Cuenta Google-Style */}
                {scoreboard.status === 'en_vivo' && (
                  <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-12 py-2">
                    {/* Outs */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase">Outs</span>
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className={`w-3.5 h-3.5 rounded-full transition-all ${
                              i < (scoreboard.baseballState?.outs || 0)
                                ? 'bg-red-500 shadow-sm shadow-red-500/50'
                                : 'bg-slate-700/80'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Strikes */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase">Strikes</span>
                      <div className="flex gap-1.5">
                        {[0, 1].map((i) => (
                          <span
                            key={i}
                            className={`w-3.5 h-3.5 rounded-full transition-all ${
                              i < (scoreboard.baseballState?.strikes || 0)
                                ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                                : 'bg-slate-700/80'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Bolas */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-400 uppercase">Bolas</span>
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className={`w-3.5 h-3.5 rounded-full transition-all ${
                              i < (scoreboard.baseballState?.balls || 0)
                                ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                                : 'bg-slate-700/80'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TABLA CLÁSICA BOX SCORE DE ENTRADAS (1 a 9 + C - H - E) */}
                <div className="overflow-x-auto">
                  <table className="w-full text-center text-xs border-collapse min-w-[480px]">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[11px] font-mono">
                        <th className="py-2 text-left px-3 font-bold">Equipo</th>
                        {scoreboard.baseballState.inningScores.map((item) => (
                          <th
                            key={item.inning}
                            className={`w-7 py-1.5 ${
                              scoreboard.status === 'en_vivo' && item.inning === scoreboard.baseballState?.currentInning
                                ? 'text-amber-400 font-black bg-amber-500/10 rounded-t'
                                : ''
                            }`}
                          >
                            {item.inning}
                          </th>
                        ))}
                        <th className="w-8 py-1.5 font-bold text-white bg-slate-800/60">C</th>
                        <th className="w-8 py-1.5 font-bold text-slate-300">H</th>
                        <th className="w-8 py-1.5 font-bold text-slate-300">E</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Fila Visitante */}
                      <tr className="border-b border-slate-800/60 font-mono">
                        <td className="py-2.5 text-left px-3 font-bold text-white flex items-center gap-1.5 truncate max-w-[140px]">
                          {scoreboard.status === 'en_vivo' && scoreboard.baseballState.isTopInning && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                          )}
                          <span>{scoreboard.awayTeamName}</span>
                        </td>
                        {scoreboard.baseballState.inningScores.map((item) => (
                          <td
                            key={item.inning}
                            className={`py-2.5 ${
                              scoreboard.status === 'en_vivo' && item.inning === scoreboard.baseballState?.currentInning
                                ? 'bg-amber-500/10 font-bold text-amber-300'
                                : 'text-slate-300'
                            }`}
                          >
                            {item.away !== null ? item.away : '-'}
                          </td>
                        ))}
                        <td className="py-2.5 font-black text-amber-400 bg-slate-800/60 text-sm">
                          {scoreboard.awayScore}
                        </td>
                        <td className="py-2.5 text-slate-300">
                          {scoreboard.baseballState.awayHits}
                        </td>
                        <td className="py-2.5 text-slate-400">
                          {scoreboard.baseballState.awayErrors}
                        </td>
                      </tr>

                      {/* Fila Local */}
                      <tr className="font-mono">
                        <td className="py-2.5 text-left px-3 font-bold text-white flex items-center gap-1.5 truncate max-w-[140px]">
                          {scoreboard.status === 'en_vivo' && !scoreboard.baseballState.isTopInning && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                          )}
                          <span>{scoreboard.homeTeamName}</span>
                        </td>
                        {scoreboard.baseballState.inningScores.map((item) => (
                          <td
                            key={item.inning}
                            className={`py-2.5 ${
                              scoreboard.status === 'en_vivo' && item.inning === scoreboard.baseballState?.currentInning
                                ? 'bg-amber-500/10 font-bold text-amber-300'
                                : 'text-slate-300'
                            }`}
                          >
                            {item.home !== null ? item.home : '-'}
                          </td>
                        ))}
                        <td className="py-2.5 font-black text-amber-400 bg-slate-800/60 text-sm">
                          {scoreboard.homeScore}
                        </td>
                        <td className="py-2.5 text-slate-300">
                          {scoreboard.baseballState.homeHits}
                        </td>
                        <td className="py-2.5 text-slate-400">
                          {scoreboard.baseballState.homeErrors}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* SUB-SECCIÓN FÚTBOL: LÍNEA DE TIEMPO ESTILO GOOGLE        */}
            {/* ======================================================== */}
            {scoreboard.sport === 'football' && scoreboard.footballState && (
              <div className="border-t border-slate-800 bg-black/30 p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Línea de Tiempo del Partido</span>
                  </h4>
                  <span className="text-[11px] font-sports text-slate-400 font-bold">
                    {scoreboard.footballState.half === 'primer_tiempo'
                      ? '1er Tiempo'
                      : scoreboard.footballState.half === 'entretiempo'
                      ? 'Entretiempo'
                      : scoreboard.footballState.half === 'segundo_tiempo'
                      ? '2do Tiempo'
                      : 'Partido Concluido'}
                  </span>
                </div>

                {footballTimeline.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500 font-medium">
                    Sin incidencias registradas todavía. Los goles y tarjetas aparecerán aquí al momento.
                  </div>
                ) : (
                  <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                    {footballTimeline.map((item, idx) => {
                      const isHome = item.team === 'home';
                      const teamDisplayName = isHome ? scoreboard.homeTeamName : scoreboard.awayTeamName;

                      return (
                        <div key={idx} className="relative flex items-center justify-between text-xs font-sports">
                          {/* Nodo en la línea */}
                          <div className="absolute -left-6 sm:-left-8 w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-xs shadow-sm">
                            {item.kind === 'goal' ? '⚽' : item.cardType === 'amarilla' ? '🟨' : '🟥'}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-400 text-sm">
                              {item.minute}'
                            </span>
                            <span className="font-bold text-white text-sm">
                              {item.playerName}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {teamDisplayName}
                            </span>
                          </div>

                          <span className="text-[10px] font-mono text-slate-400 uppercase">
                            {item.kind === 'goal'
                              ? '¡Gol!'
                              : item.cardType === 'amarilla'
                              ? 'Tarjeta Amarilla'
                              : 'Tarjeta Roja'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botón CTA para aficionado si el evento tiene boletos a la venta */}
          {activeEvent && onBuyTickets && activeEvent.ticketsAvailable && (
            <div className="p-5 rounded-3xl bg-gradient-to-r from-red-950/40 via-[#101625] to-red-950/40 border border-red-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-black font-sports uppercase text-white">
                  ¿Quieres vivir la emoción desde las gradas?
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Selecciona tu butaca en el mapa interactivo y apoya a tu equipo en el estadio.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onBuyTickets(activeEvent.id)}
                className="px-5 py-2.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-sports font-black text-xs uppercase tracking-wider shadow-lg shadow-red-950/50 transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5"
              >
                <Ticket className="w-4 h-4" />
                <span>Elegir Butacas</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
